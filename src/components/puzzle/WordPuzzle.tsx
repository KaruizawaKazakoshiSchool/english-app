import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Volume2, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { usePoints } from '../../hooks/usePoints';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { wordForSpeech } from '../../lib/wordSound';
import { currentIsTrial } from '../../lib/trial';
import { PUZZLE_UNITS, toCards, type PuzzleSentence, type PuzzleUnit } from './puzzleData';

// ことばパズル：日本語を見て、単語カードを正しい順にならべる。
//
// ポイント（CLAUDE.md のルールどおり）：
//   - 一発で正解した問題だけ数える（1回まちがえると合っている場所が色で分かる＝ヒントなので数えない）
//   - 正答率でスケール。半分未満は加点なし（addPoints も呼ばない＝逓減カウンタを使わない）
//   - 「やさしい」は半分の点（カードをならべるだけなので）
//   - 単元をたくさん回すより、1つの単元の やさしい→ふつう を得にする：
//     今日3つ目の新しい単元は ×0.75、4つ目からは ×0.5（辞書の dictDepth と同じ考え）
// AIは使わない。判定は全部この端末の中。

type Level = 'easy' | 'normal' | 'hard';
const LEVEL_JA: Record<Level, string> = { easy: 'やさしい', normal: 'ふつう', hard: 'むずかしい' };
const LEVEL_MUL: Record<Level, number> = { easy: 0.5, normal: 1, hard: 1.5 };
// 「むずかしい」で足す よけいなカードの候補（文にもう入っている語は使わない）
const DECOYS = ['a', 'the', 'is', 'are', 'do', 'does', 'am', 'not', 'to', 'in', 'can', 'was'];
const QUESTIONS = 5;
const keyOf = (unitId: string, level: Level) => `puzzle_${unitId}_${level}`;
const shuffle = <T,>(a: T[]): T[] => [...a].sort(() => Math.random() - 0.5);

interface Card { id: number; text: string }

const readJson = (k: string): Record<string, number> => {
  try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; }
};

/** 今日、ほかの単元をいくつ（加点つきで）やったか。この単元を今日もうやっていれば -1 */
const otherUnitsToday = (unitId: string): number => {
  const sid = localStorage.getItem('studentId');
  const at = readJson(`clearAt_${sid}`);
  const today = new Date().toDateString();
  const units = new Set<string>();
  for (const [k, t] of Object.entries(at)) {
    const m = k.match(/^puzzle_(.+)_(easy|normal|hard)$/);
    if (m && new Date(t).toDateString() === today) units.add(m[1]);
  }
  if (units.has(unitId)) return -1;
  return units.size;
};
const FULL_UNITS_PER_DAY = 2;
const breadthMul = (others: number) => (others < FULL_UNITS_PER_DAY ? 1 : others === FULL_UNITS_PER_DAY ? 0.75 : 0.5);

export const WordPuzzle: React.FC = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { addPoints } = usePoints();
  const { speak, speakWord } = useSpeechSynthesis();

  const grade = params.get('grade') === '6' ? 6 : params.get('grade') === '5' ? 5 : null;
  const unit: PuzzleUnit | undefined = PUZZLE_UNITS.find(u => u.id === params.get('id'));

  const [level, setLevel] = useState<Level | null>(null);
  const [questions, setQuestions] = useState<PuzzleSentence[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [pool, setPool] = useState<Card[]>([]);
  const [placed, setPlaced] = useState<Card[]>([]);
  const [tries, setTries] = useState(0);            // この問題でまちがえた回数
  const [marks, setMarks] = useState<boolean[] | null>(null); // まちがえたあと、場所ごとの合否
  const [phase, setPhase] = useState<'play' | 'correct' | 'answer' | 'result'>('play');
  const [firstTry, setFirstTry] = useState(0);
  const [earned, setEarned] = useState<number | null>(null);

  // 単元が変わったら（ブラウザの「戻る」など）、レベルえらびからやり直す
  const unitId = unit?.id;
  useEffect(() => { setLevel(null); }, [unitId]);

  const current = questions[qIndex];
  const answer = useMemo(() => (current ? toCards(current.en) : { words: [], end: '' }), [current]);

  const setup = (s: PuzzleSentence, lv: Level) => {
    const { words } = toCards(s.en);
    const used = new Set([...words.map(w => w.toLowerCase()), ...s.extra.map(w => w.toLowerCase())]);
    const decoy = shuffle(DECOYS.filter(d => !used.has(d))).slice(0, 1);
    const texts = lv === 'hard' ? [...words, ...s.extra, ...decoy] : lv === 'normal' ? [...words, ...s.extra] : words;
    let cards = shuffle(texts.map((text, id) => ({ id, text })));
    // たまたま正しい順にならんでしまったら、まぜ直す
    if (cards.slice(0, words.length).every((c, i) => c.text === words[i])) cards = [...cards].reverse();
    setPool(cards); setPlaced([]); setTries(0); setMarks(null); setPhase('play');
  };

  const start = (lv: Level) => {
    if (!unit) return;
    const qs = shuffle(unit.sentences).slice(0, QUESTIONS);
    setLevel(lv); setQuestions(qs); setQIndex(0); setFirstTry(0); setEarned(null);
    setup(qs[0], lv);
  };

  const place = (c: Card) => {
    if (phase !== 'play' || (level !== 'hard' && placed.length >= answer.words.length)) return;
    setPool(p => p.filter(x => x.id !== c.id)); setPlaced(p => [...p, c]); setMarks(null);
    // 置いたカードの音を出す（子どもの声 2026-11-19「言い方がわからないから音が出てほしい」）
    // 文の中の位置が分かるカード（正解の語）は、前後の語を見て読み方を決める（live＝リヴ、the＝ザ／ジ）
    speakWord(wordForSpeech(c.text.replace(/_/g, ' '), c.id < answer.words.length ? answer.words : undefined, c.id));
  };
  const unplace = (c: Card) => {
    if (phase !== 'play') return;
    setPlaced(p => p.filter(x => x.id !== c.id)); setPool(p => [...p, c]); setMarks(null);
  };

  const finish = async (count: number) => {
    setPhase('result');
    if (!unit || !level) return;
    const ratio = count / QUESTIONS;
    if (ratio < 0.5) { setEarned(0); return; }   // 不合格：加点なし・回数も数えない
    const mul = ratio * LEVEL_MUL[level] * breadthMul(otherUnitsToday(unit.id));
    const pts = await addPoints(keyOf(unit.id, level), { multiplier: mul, isPerfect: count === QUESTIONS && level !== 'easy' });
    setEarned(pts);
  };

  const next = (count: number) => {
    if (qIndex + 1 >= questions.length) { finish(count); return; }
    setQIndex(qIndex + 1);
    setup(questions[qIndex + 1], level!);
  };

  const check = () => {
    if (!current) return;
    const ok = placed.length === answer.words.length && placed.every((c, i) => c.text === answer.words[i]);
    if (ok) {
      const count = tries === 0 ? firstTry + 1 : firstTry;
      setFirstTry(count);
      setPhase('correct');
      speak(current.en.replace(/_/g, ' '));
      setTimeout(() => next(count), 2200);
      return;
    }
    if (tries >= 1 || level === 'hard') { setPhase('answer'); speak(current.en.replace(/_/g, ' ')); return; }
    setTries(tries + 1);
    setMarks(placed.map((c, i) => c.text === answer.words[i]));
  };

  const showSentence = (words: string[], end: string) => {
    const s = words.join(' ');
    return s.charAt(0).toUpperCase() + s.slice(1) + end;
  };

  // ---------- 学年えらび ----------
  if (!grade && !unit) {
    return (
      <div className="flex-col gap-lg" style={{ flex: 1, padding: '2rem', maxWidth: '640px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="outline" onClick={() => navigate('/home')} icon={ArrowLeft}>もどる</Button>
          <h2 className="text-primary" style={{ margin: 0 }}>🧩 ことばパズル</h2>
        </div>
        <p style={{ margin: 0, color: '#475569' }}>単語カードをならべて、英語の文をつくろう。学年を選んでね。</p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button size="lg" onClick={() => setParams({ grade: '5' })}>5年生</Button>
          <Button size="lg" onClick={() => setParams({ grade: '6' })}>6年生</Button>
        </div>
      </div>
    );
  }

  // ---------- 単元えらび ----------
  if (!unit) {
    const sid = localStorage.getItem('studentId');
    const counts = readJson(`clearCounts_${sid}`);
    const list = PUZZLE_UNITS.filter(u => u.grade === grade);
    const at = readJson(`clearAt_${sid}`);
    const today = new Date().toDateString();
    const doneToday = new Set(Object.entries(at).map(([k, t]) => {
      const m = k.match(/^puzzle_(.+)_(easy|normal|hard)$/);
      return m && new Date(t).toDateString() === today ? m[1] : '';
    }).filter(Boolean)).size;
    const left = Math.max(0, FULL_UNITS_PER_DAY - doneToday);
    return (
      <div className="flex-col gap-lg" style={{ flex: 1, padding: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="outline" onClick={() => navigate('/home')} icon={ArrowLeft}>もどる</Button>
          <h2 className="text-primary" style={{ margin: 0, flex: 1, textAlign: 'center', marginRight: '120px' }}>🧩 {grade}年生のことばパズル</h2>
        </div>
        <p style={{ margin: 0, color: '#475569', textAlign: 'center' }}>
          {left > 0
            ? `今日は あと${left}単元 まんてんでもらえるよ。1つの単元で「やさしい」→「ふつう」と進むのがおすすめ！`
            : '今日やった単元の「ふつう」にちょうせんすると、ポイントが大きいよ！'}
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {list.map(u => {
            const e = (counts[keyOf(u.id, 'easy')] || 0) > 0;
            const h = (counts[keyOf(u.id, 'hard')] || 0) > 0;
            const n = h || (counts[keyOf(u.id, 'normal')] || 0) > 0;
            return (
              <div key={u.id} className="glass-card hover-scale"
                style={{ padding: '1.5rem', cursor: 'pointer', border: n ? '2px solid var(--color-success)' : '2px solid #e2e8f0', background: n ? '#f0fdf4' : 'white' }}
                onClick={() => { setLevel(null); setParams({ grade: String(u.grade), id: u.id }); }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary)' }}>{u.unitName}</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
                  やさしい {e ? '✅' : '—'}　ふつう {n ? '✅' : '—'}　むずかしい {h ? '✅' : '—'}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const backToList = () => { setLevel(null); setParams({ grade: String(unit.grade) }); };

  // ---------- レベルえらび ----------
  if (!level) {
    return (
      <div className="flex-col gap-lg" style={{ flex: 1, padding: '2rem', maxWidth: '640px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="outline" onClick={backToList} icon={ArrowLeft}>一覧へ</Button>
          <h3 className="text-primary" style={{ margin: 0 }}>{unit.unitName}</h3>
        </div>
        <div className="glass-card hover-scale" style={{ padding: '1.5rem', cursor: 'pointer', background: 'white' }} onClick={() => start('easy')}>
          <h3 style={{ margin: '0 0 0.4rem 0' }}>🌱 やさしい</h3>
          <p style={{ margin: 0, color: '#64748b' }}>カードをならべるだけ。全部使うよ。</p>
        </div>
        <div className="glass-card hover-scale" style={{ padding: '1.5rem', cursor: 'pointer', background: 'white' }} onClick={() => start('normal')}>
          <h3 style={{ margin: '0 0 0.4rem 0' }}>🔥 ふつう</h3>
          <p style={{ margin: 0, color: '#64748b' }}>使わないカードが1枚まざっているよ。ポイントは「やさしい」の2倍！</p>
        </div>
        <div className="glass-card hover-scale" style={{ padding: '1.5rem', cursor: 'pointer', background: 'white' }} onClick={() => start('hard')}>
          <h3 style={{ margin: '0 0 0.4rem 0' }}>🏔️ むずかしい</h3>
          <p style={{ margin: 0, color: '#64748b' }}>使わないカードが2枚。何語の文かのわくも出ない。チャンスは1回だけ。ポイントは「やさしい」の3倍！</p>
        </div>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>全部で{QUESTIONS}問。一発で正解した数で、ポイントが決まるよ。</p>
      </div>
    );
  }

  // ---------- 結果 ----------
  if (phase === 'result') {
    const pass = firstTry / QUESTIONS >= 0.5;
    return (
      <div className="flex-col flex-center gap-lg" style={{ flex: 1, padding: '2rem', maxWidth: '640px', margin: '0 auto', width: '100%', textAlign: 'center' }}>
        <span style={{ fontSize: '64px' }}>{pass ? '🎉' : '💪'}</span>
        <h2 style={{ margin: 0 }}>{QUESTIONS}問中 {firstTry}問 一発で正解！</h2>
        <p style={{ margin: 0, color: '#475569' }}>
          {!pass ? '3問以上 一発で正解すると、ポイントがもらえるよ。もう一度やってみよう！'
            : earned === null ? '確認中…'
            : earned > 0 ? `＋${earned}ポイント`
            : currentIsTrial() ? 'お試しでは、ポイントはたまりません。'
            : 'くり返しのため、今回はポイントなし。'}
        </p>
        {pass && level === 'easy' && <p style={{ margin: 0, color: '#475569' }}>次は「ふつう」にちょうせんしよう。ポイントが大きいよ！</p>}
        {pass && level === 'normal' && <p style={{ margin: 0, color: '#475569' }}>「むずかしい」もあるよ。ちょうせんしてみよう！</p>}
        <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button variant="outline" onClick={() => start(level)} icon={RefreshCw}>もう一度</Button>
          {level === 'easy' && <Button onClick={() => start('normal')}>🔥 ふつうに進む</Button>}
          {level === 'normal' && <Button onClick={() => start('hard')}>🏔️ むずかしいに進む</Button>}
          <Button variant="outline" onClick={backToList}>単元を選ぶ</Button>
        </div>
      </div>
    );
  }

  // ---------- 問題 ----------
  // 「むずかしい」は空きのわくを見せない＝何語の文かも自分で考える。1枚以上ならべれば答え合わせできる
  const full = level === 'hard' ? placed.length > 0 : placed.length === answer.words.length;
  const cardStyle: React.CSSProperties = {
    fontSize: '1.3rem', fontWeight: 'bold', padding: '0.6rem 1rem', borderRadius: '12px',
    border: '2px solid #94a3b8', background: 'white', color: '#0f172a', cursor: 'pointer',
  };
  return (
    <div className="flex-col gap-lg" style={{ flex: 1, padding: '1.5rem', maxWidth: '760px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button variant="outline" size="sm" onClick={() => setLevel(null)} icon={ArrowLeft}>やめる</Button>
        <span style={{ flex: 1, color: '#64748b' }}>{unit.unitName}（{LEVEL_JA[level]}）</span>
        <strong>{qIndex + 1} / {questions.length}</strong>
      </div>

      <div className="glass-card" style={{ padding: '1.2rem', background: 'white', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 'bold' }}>{current.ja}</p>
      </div>

      {/* ならべる場所 */}
      <div style={{ minHeight: '84px', padding: '0.8rem', borderRadius: '16px', border: '2px dashed #94a3b8', background: '#f8fafc', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        {placed.map((c, i) => (
          <button key={c.id} onClick={() => unplace(c)}
            style={{ ...cardStyle,
              borderColor: phase === 'correct' ? 'var(--color-success)' : marks ? (marks[i] ? 'var(--color-success)' : '#ef4444') : '#0984e3',
              background: phase === 'correct' ? '#f0fdf4' : marks ? (marks[i] ? '#f0fdf4' : '#fef2f2') : '#eff6ff' }}>
            {i === 0 ? c.text.charAt(0).toUpperCase() + c.text.slice(1) : c.text}
          </button>
        ))}
        {level !== 'hard' && Array.from({ length: answer.words.length - placed.length }).map((_, i) => (
          <span key={`s${i}`} style={{ width: '64px', height: '48px', borderRadius: '12px', background: '#e2e8f0' }} />
        ))}
        <span style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#475569' }}>{answer.end}</span>
      </div>

      {phase === 'play' && marks && (
        <p style={{ margin: 0, color: '#b91c1c', textAlign: 'center', fontWeight: 'bold' }}>おしい！ 赤いカードをタップして外して、ならべ直そう。</p>
      )}
      {phase === 'correct' && (
        <p style={{ margin: 0, color: 'var(--color-success)', textAlign: 'center', fontWeight: 'bold', fontSize: '1.3rem' }}>⭕ 正解！</p>
      )}
      {phase === 'answer' && (
        <div className="glass-card" style={{ padding: '1rem', background: '#fffbeb', textAlign: 'center' }}>
          <p style={{ margin: '0 0 0.4rem 0', color: '#92400e' }}>正しい文はこれ。声に出して読んでみよう。</p>
          <p style={{ margin: 0, fontSize: '1.4rem', fontWeight: 'bold' }}>{showSentence(answer.words, answer.end)}</p>
        </div>
      )}

      {/* カード置き場 */}
      {phase === 'play' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center', minHeight: '56px' }}>
          {pool.map(c => (
            <button key={c.id} className="hover-scale" onClick={() => place(c)} style={cardStyle}>{c.text}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        {phase === 'play' && <Button size="lg" onClick={check} disabled={!full}>できた！</Button>}
        {phase === 'answer' && (
          <>
            <Button variant="outline" icon={Volume2} onClick={() => speak(current.en.replace(/_/g, ' '))}>聞く</Button>
            <Button size="lg" onClick={() => next(firstTry)}>次へ</Button>
          </>
        )}
      </div>
    </div>
  );
};
