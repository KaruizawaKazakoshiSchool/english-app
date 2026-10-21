import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSafeBack } from '../../hooks/useSafeBack';
import { ArrowLeft, Trophy } from 'lucide-react';
import { Button } from '../ui/Button';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { usePronunciationAssessment } from '../../hooks/usePronunciationAssessment';
import { usePronunciationHistory } from '../../hooks/usePronunciationHistory';
import { usePoints } from '../../hooks/usePoints';
import { showToast } from '../ui/Toast';
import { DIALOGUES, type Dialogue, type DialogueLine } from './dialogueData';
import { isArchived } from '../../data/archivedUnits';
import { SpeakableText } from '../ui/SpeakableText';

// 発音採点に通すため {…} のスロット記号を外した素の文を作る
const cleanText = (en: string) => en.replace(/[{}]/g, '');
const PASS = 60;

// むずかしさ（子どもの声 2026-10-19「ダイアログにも やさしい・ふつう・きびしい を」）
//   やさしい：英語を見ながら。全部読めばクリア（これまでと同じ）
//   ふつう　：英語を見ながら。自分のセリフが全部 合格ライン（60点）でクリア
//   きびしい：自分のセリフの英語をかくす（日本語だけ見て言う）。全部 合格ラインでクリア
// むずかしいほどポイントの倍率が上がる（同じ会話の逓減は共通）。
type Level = 'easy' | 'normal' | 'hard';
const LEVELS: { key: Level; label: string; desc: string; multiplier: number }[] = [
  { key: 'easy', label: 'やさしい', desc: '英語を見ながら。全部読めばクリア', multiplier: 0.5 },
  { key: 'normal', label: 'ふつう', desc: `英語を見ながら。全部${PASS}点以上でクリア`, multiplier: 0.75 },
  { key: 'hard', label: 'きびしい', desc: `自分のセリフは日本語だけ。全部${PASS}点以上でクリア`, multiplier: 1 },
];

// {slot} を色付きで表示する
const renderEn = (en: string) => {
  const parts = en.split(/(\{.*?\})/g);
  return parts.map((p, i) => {
    if (p.startsWith('{') && p.endsWith('}')) {
      return (
        <span key={i} style={{ color: '#0984e3', fontWeight: 'bold', borderBottom: '2px dashed #0984e3' }}>
          {p.slice(1, -1)}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
};

export const DialogueTrainer: React.FC = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack();
  const { speak } = useSpeechSynthesis();
  const { assess, isAssessing, isAvailable: azureAvailable, lastRecordingUrl, getLastError } = usePronunciationAssessment();
  const { addScore } = usePronunciationHistory();
  const { addPoints } = usePoints();
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  const awardedRolesRef = useRef<Set<string>>(new Set());   // 「役_むずかしさ」ごとに1回
  const [level, setLevel] = useState<Level>('easy');

  const [grade, setGrade] = useState<5 | 6 | null>(null);
  const [dialogue, setDialogue] = useState<Dialogue | null>(null);
  const [myRole, setMyRole] = useState<'A' | 'B'>('A');
  const [showJa, setShowJa] = useState(true);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [activeLine, setActiveLine] = useState<number | null>(null);

  const startDialogue = (d: Dialogue) => {
    setDialogue(d);
    setScores({});
    setActiveLine(null);
    setMyRole('A');
    setEarnedPoints(null);
    awardedRolesRef.current = new Set();
  };

  // 役を変えたら前のクリア表示は消す
  useEffect(() => { setEarnedPoints(null); }, [myRole]);

  // 自分の役のセリフを全部読んだら（点数の良し悪しに関わらず）クリア＝ポイント付与（役ごとに1回）。
  useEffect(() => {
    const awardKey = `${myRole}_${level}`;
    if (!dialogue || awardedRolesRef.current.has(awardKey)) return;
    const myIdx = dialogue.lines.map((l, i) => (l.speaker === myRole ? i : -1)).filter(i => i >= 0);
    const ok = (i: number) => scores[i] !== undefined && (level === 'easy' || scores[i] >= PASS);
    if (myIdx.length > 0 && myIdx.every(ok)) {
      awardedRolesRef.current.add(awardKey);
      (async () => {
        const pts = await addPoints(`dialogue_${dialogue.id}`, { multiplier: LEVELS.find(l => l.key === level)!.multiplier });
        setEarnedPoints(pts);
      })();
    }
  }, [scores, myRole, level, dialogue, addPoints]);

  // むずかしさを変えたら、点数をリセットしてやり直す
  useEffect(() => { setScores({}); setEarnedPoints(null); }, [level]);

  // 学年・Unitの選択状態はURL（?grade=5&id=g5-u1）を正にする。
  // こうすると、関連単語練習などへ飛んでから「もどる」で戻ったとき、
  // 学年選択ではなく“さっき開いていたUnit”にちゃんと戻れる（今日のミッションの直接リンクも兼用）。
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const g = searchParams.get('grade');
    const id = searchParams.get('id');
    if (id) {
      const d = DIALOGUES.find(x => x.id === id);
      if (d) { setGrade(d.grade); startDialogue(d); return; }
    }
    setDialogue(null);
    // 学年はTOPのカードでえらぶ前提。学年選択画面は廃止し、未指定なら5年を既定にする。
    setGrade(g === '6' ? 6 : 5);
  }, [searchParams]);

  const handleSpeak = (line: DialogueLine) => speak(cleanText(line.en));

  const handlePractice = async (idx: number, line: DialogueLine) => {
    if (isAssessing) return;
    setActiveLine(idx);
    const result = await assess(cleanText(line.en));
    if (!result) {
      // 聞き取れなかった/通信エラー：無反応だと押せたか分からないので、その場に通知
      showToast(getLastError() || '🎙️ 声が聞こえなかったよ。もう一度ゆっくり言ってみてね', 'fail');
      return;
    }
    // 採点は accuracyScore（発音の正確さ）で統一（なめらかさ等で不当に下がるのを防ぐ）
    setScores(prev => ({ ...prev, [idx]: Math.max(prev[idx] ?? 0, result.accuracyScore) }));   // 言い直したら いちばん良い点を残す
    addScore('dialogue', result.accuracyScore, cleanText(line.en));
  };

  // 学年はTOPカードでえらぶ前提なので、ここでは必ず5/6が入っている（保険のガード）
  if (!grade) return null;

  // Unitえらび
  if (!dialogue) {
    // アーカイブ中の単元は一覧に出さない（URL直指定では今までどおり開ける＝先生が配信できる）
    const list = DIALOGUES.filter(d => d.grade === grade && !isArchived(d.id));
    // クリア済みの会話に印をつける（子どもの声 2026-10-17「クリア済みが見た目で分からない」）。
    // クリア＝自分の役のセリフを全部読んだ（dialogue_◯◯ の合格回数が1以上）
    let counts: Record<string, number> = {};
    try { counts = JSON.parse(localStorage.getItem(`clearCounts_${localStorage.getItem('studentId')}`) || '{}'); } catch { /* 空のまま */ }
    const isDone = (id: string) => (counts[`dialogue_${id}`] || 0) > 0;
    return (
      <div className="flex-col gap-lg" style={{ flex: 1, padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="outline" onClick={goBack} icon={ArrowLeft}>もどる</Button>
          <h2 className="text-primary" style={{ margin: 0, flex: 1, textAlign: 'center', marginRight: '120px' }}>🗣️ {grade}年生のダイアログ</h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {list.map(d => (
            <div key={d.id} className="glass-card hover-scale" style={{ position: 'relative', padding: '1.5rem', cursor: 'pointer', border: isDone(d.id) ? '2px solid var(--color-success)' : '2px solid #e2e8f0', background: isDone(d.id) ? '#f0fdf4' : 'white' }} onClick={() => setSearchParams({ grade: String(d.grade), id: d.id })}>
              {isDone(d.id) && (
                <span style={{ position: 'absolute', top: '0.6rem', right: '0.7rem', background: 'var(--color-success)', color: 'white', borderRadius: '999px', padding: '0.1rem 0.6rem', fontSize: '0.8rem', fontWeight: 'bold' }}>✅ クリア</span>
              )}
              <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary)', paddingRight: isDone(d.id) ? '4.5rem' : 0 }}>{d.unitName}</h4>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>“{d.targetPhrase}”</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 練習画面
  return (
    <div className="flex-col gap-lg" style={{ flex: 1, padding: '2rem', maxWidth: '700px', margin: '0 auto', width: '100%', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button variant="outline" onClick={() => setSearchParams({ grade: String(grade) })} icon={ArrowLeft}>一覧へ</Button>
        <h2 className="text-primary" style={{ margin: 0, flex: 1, textAlign: 'center', fontSize: '1.3rem', marginRight: '80px' }}>{dialogue.unitName}</h2>
      </div>

      {earnedPoints !== null && (
        <div className="glass-card animate-pop" style={{ padding: '1.2rem', textAlign: 'center', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '2px solid var(--color-success)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
            <Trophy color="var(--color-accent)" />
            <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
              クリア！「{myRole}」の役（{LEVELS.find(l => l.key === level)!.label}）を全部読めたね 🎉 +{earnedPoints}ポイント
            </span>
          </div>
          <div style={{ marginTop: '0.6rem', color: '#555' }}>
            🔄 役を交代して、もう片方の役も練習してみよう！
          </div>
        </div>
      )}

      {/* 役えらび＆訳トグル */}
      <div className="glass-card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 'bold', color: '#555' }}>自分の役：</span>
          {(['A', 'B'] as const).map(r => (
            <button key={r} onClick={() => setMyRole(r)}
              style={{ padding: '0.5rem 1.2rem', borderRadius: '999px', border: `2px solid var(--color-primary)`, background: myRole === r ? 'var(--color-primary)' : 'white', color: myRole === r ? 'white' : 'var(--color-primary)', fontWeight: 'bold', cursor: 'pointer' }}>
              {r}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => setShowJa(s => !s)} style={{ padding: '0.4rem 1rem', fontSize: '0.9rem' }}>
          {showJa ? '訳をかくす' : '訳を見る'}
        </Button>
      </div>

      <div className="glass-card" style={{ padding: '0.8rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', color: '#555' }}>むずかしさ：</span>
          {LEVELS.map(l => (
            <button key={l.key} onClick={() => setLevel(l.key)}
              style={{ padding: '0.4rem 1rem', borderRadius: '999px', border: '2px solid var(--color-primary)', background: level === l.key ? 'var(--color-primary)' : 'white', color: level === l.key ? 'white' : 'var(--color-primary)', fontWeight: 'bold', cursor: 'pointer' }}>
              {l.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{LEVELS.find(l => l.key === level)!.desc}</div>
      </div>

      <p style={{ textAlign: 'center', color: '#888', margin: 0, fontSize: '0.9rem' }}>
        相手のセリフは🔈で聞けるよ。自分（{myRole}）のセリフは🎤で読んで発音チェック！
      </p>

      {dialogue.note && (
        <div className="glass-card" style={{ padding: '0.8rem 1rem', background: 'rgba(253, 203, 110, 0.18)', border: '2px solid #fdcb6e', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.3rem' }}>💡</span>
          <SpeakableText text={dialogue.note} style={{ fontSize: '0.95rem', color: '#7a5a00' }} />
        </div>
      )}

      {dialogue.aiRoute && (
        <div className="glass-card" style={{ padding: '0.8rem 1rem', background: 'rgba(245, 158, 11, 0.12)', border: '2px solid #f59e0b' }}>
          <div style={{ fontSize: '0.9rem', color: '#7a5a00', marginBottom: '0.5rem' }}>
            🤖 れんしゅうしたら、AIをあいてに本番の練習をしてみよう！
          </div>
          <button
            className="hover-scale"
            onClick={() => navigate(dialogue.aiRoute!)}
            style={{ padding: '0.6rem 1.2rem', borderRadius: '999px', border: 'none', background: '#f59e0b', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}
          >
            {dialogue.aiLabel || 'AIと練習する'} →
          </button>
        </div>
      )}

      {dialogue.relatedCategories && dialogue.relatedCategories.length > 0 && (
        <div className="glass-card" style={{ padding: '0.8rem 1rem', background: 'rgba(72, 219, 251, 0.12)', border: '2px solid var(--color-primary)' }}>
          <div style={{ fontSize: '0.9rem', color: '#555', marginBottom: '0.5rem' }}>
            📚 この会話で使う単語は、Picture Dictionaryでも練習できるよ！
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {dialogue.relatedCategories.map(cat => (
              <button
                key={cat}
                className="hover-scale"
                onClick={() => navigate(`/dictionary/${encodeURIComponent(cat)}`, { state: { fromCrossLink: true } })}
                style={{ padding: '0.5rem 1rem', borderRadius: '999px', border: '2px solid var(--color-primary)', background: 'white', color: 'var(--color-primary)', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}
              >
                「{cat}」を練習する →
              </button>
            ))}
          </div>
        </div>
      )}

      {/* セリフ一覧 */}
      <div className="flex-col gap-md">
        {dialogue.lines.map((line, idx) => {
          const isMine = line.speaker === myRole;
          const score = scores[idx];
          return (
            <div key={idx}
              className="glass-card"
              style={{
                padding: '1rem 1.2rem',
                alignSelf: line.speaker === 'A' ? 'flex-start' : 'flex-end',
                maxWidth: '85%',
                background: isMine ? 'rgba(72, 219, 251, 0.12)' : 'white',
                border: isMine ? '2px solid var(--color-primary)' : '2px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: line.speaker === 'A' ? '#e17055' : '#0984e3', marginBottom: '0.3rem' }}>
                {line.speaker} {isMine && '（あなた）'}
              </div>
              {level === 'hard' && isMine && !(score !== undefined && score >= PASS) ? (
                <>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{line.ja}</div>
                  <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.2rem' }}>（英語は かくしているよ。合格すると 見えるよ）</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)' }}>{renderEn(line.en)}</div>
                  {showJa && <div style={{ fontSize: '0.95rem', color: '#666', marginTop: '0.3rem' }}>{line.ja}</div>}
                </>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginTop: '0.6rem' }}>
                {!(level === 'hard' && isMine && !(score !== undefined && score >= PASS)) && (
                  <button onClick={() => handleSpeak(line)} title="聞く"
                    style={{ background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}>
                    🔈
                  </button>
                )}

                {isMine && azureAvailable && (
                  <button
                    onClick={() => handlePractice(idx, line)}
                    disabled={isAssessing}
                    title="マイクで読む"
                    className={isAssessing && activeLine === idx ? 'animate-pulse' : ''}
                    style={{ background: (isAssessing && activeLine === idx) ? 'var(--color-error)' : 'var(--color-accent)', color: '#000', border: 'none', borderRadius: '50%', width: '38px', height: '38px', cursor: isAssessing ? 'default' : 'pointer', fontSize: '1.1rem', flexShrink: 0 }}
                  >
                    🎤
                  </button>
                )}

                {isMine && azureAvailable && lastRecordingUrl && activeLine === idx && !isAssessing && (
                  <button onClick={() => new Audio(lastRecordingUrl).play()} title="自分の声を聞く"
                    style={{ background: 'white', color: 'var(--color-primary)', border: '2px solid var(--color-primary)', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}>
                    🔊
                  </button>
                )}

                {score !== undefined && (
                  <span style={{ fontWeight: 'bold', color: score >= PASS ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {Math.round(score)}点 {score >= PASS ? '✅' : '（もう一度！）'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!azureAvailable && (
        <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
          ※ 発音チェックを使うには、スタッフがAzureの設定をすると使えるようになるよ。今は🔈で聞いて練習しよう！
        </p>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
        <Button variant="outline" onClick={() => setMyRole(myRole === 'A' ? 'B' : 'A')}>
          🔄 役を交代する（今：{myRole}）
        </Button>
      </div>
    </div>
  );
};
