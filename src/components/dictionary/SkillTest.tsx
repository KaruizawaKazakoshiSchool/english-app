import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVocabulary } from '../../hooks/useVocabulary';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';
import { useDictionaryProgress } from '../../hooks/useDictionaryProgress';
import { usePronunciationHistory } from '../../hooks/usePronunciationHistory';
import { usePoints } from '../../hooks/usePoints';
import { Button } from '../ui/Button';
import { ArrowLeft, Volume2, RefreshCw, Trophy } from 'lucide-react';
import type { Vocabulary } from '../../data/vocabulary';

// 単語実力テスト（P2-1）：既習カテゴリからランダム10問・一発勝負・ヒントなし。
// スコアは「自分の記録」の推移グラフ（単語テスト）に記録される＝実力の伸びが見える。
const TOTAL = 10;

interface Question {
  word: Vocabulary;
  choices: Vocabulary[];
  type: 'audio' | 'ja'; // 音をきいて選ぶ／日本語を見て選ぶ
}

const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => 0.5 - Math.random());

export const SkillTest: React.FC = () => {
  const navigate = useNavigate();
  const vocabulary = useVocabulary();
  const { speak } = useSpeechSynthesis();
  const { progress } = useDictionaryProgress();
  const { addScore } = usePronunciationHistory();
  const { addPoints } = usePoints();

  // 出題プール：ふれたことのあるカテゴリ。少なすぎるときは全カテゴリ
  const pool = useMemo(() => {
    const touched = Object.keys(progress);
    let p = vocabulary.filter(v => touched.includes(v.category));
    if (p.length < TOTAL * 2) p = vocabulary;
    return p;
  }, [vocabulary, progress]);

  const makeQuestions = (): Question[] =>
    shuffle(pool).slice(0, TOTAL).map((word, i) => {
      const others = shuffle(pool.filter(v => v.id !== word.id && v.english !== word.english)).slice(0, 3);
      return {
        word,
        choices: shuffle([word, ...others]),
        type: i % 2 === 0 ? 'audio' : 'ja',
      };
    });

  const [questions, setQuestions] = useState<Question[]>(makeQuestions);
  const [qIndex, setQIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<string | null>(null); // 答え合わせ表示用
  const [finished, setFinished] = useState(false);
  const [earned, setEarned] = useState<number | null>(null);

  const q = questions[qIndex];

  // 音の問題は、出たときに自動で1回流す（子どもの声 2026-10-17「音を聞くを押さないと音が流れない」）
  useEffect(() => {
    if (q && q.type === 'audio' && !finished) {
      const t = setTimeout(() => speak(q.word.english), 400);
      return () => clearTimeout(t);
    }
  }, [qIndex, questions, finished]); // eslint-disable-line react-hooks/exhaustive-deps

  // 問題がまだ作れていなかったら作り直す（開いても何も出ないことがあった）
  useEffect(() => {
    if (questions.length === 0 && pool.length > 0) setQuestions(makeQuestions());
  }, [pool]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePick = (choice: Vocabulary) => {
    if (picked || finished) return;
    setPicked(choice.id);
    const isCorrect = choice.id === q.word.id;
    const newCorrect = isCorrect ? correct + 1 : correct;
    setCorrect(newCorrect);

    setTimeout(async () => {
      if (qIndex + 1 >= questions.length) {
        setFinished(true);
        const pct = Math.round((newCorrect / questions.length) * 100);
        // 実力の記録（自分の記録の推移グラフへ）
        addScore('test', pct, `単語テスト ${newCorrect}/${questions.length}問`);
        // 加点は正答率スケール・半分未満は0（ポイント設計ルール準拠）
        if (newCorrect / questions.length >= 0.5) {
          const pts = await addPoints('skill_test', {
            multiplier: newCorrect / questions.length,
            isPerfect: newCorrect === questions.length,
          });
          setEarned(pts);
        } else {
          setEarned(0);
        }
      } else {
        setQIndex(i => i + 1);
        setPicked(null);
      }
    }, 900);
  };

  const restart = () => {
    setQuestions(makeQuestions());
    setQIndex(0);
    setCorrect(0);
    setPicked(null);
    setFinished(false);
    setEarned(null);
  };

  if (finished) {
    const pct = Math.round((correct / questions.length) * 100);
    return (
      <div className="flex-col flex-center gap-lg" style={{ height: '100%', textAlign: 'center' }}>
        <h1 className="text-primary" style={{ fontSize: '2.6rem' }}>テストおわり！</h1>
        <div className="animate-float"><Trophy size={90} color="var(--color-accent)" /></div>
        <div className="animate-pop" style={{ fontSize: '2.2rem', fontWeight: 'bold', color: pct >= 80 ? 'var(--color-success)' : pct >= 50 ? '#d97706' : 'var(--color-error)' }}>
          {correct} / {questions.length} 問正解（{pct}点）
        </div>
        {earned !== null && (
          earned > 0
            ? <p style={{ fontSize: '1.3rem', color: 'var(--color-accent)', fontWeight: 'bold', margin: 0 }}>＋{earned} ポイント！✨</p>
            : <p style={{ fontSize: '1rem', color: '#94a3b8', margin: 0 }}>半分以上正解するとポイントがもらえるよ</p>
        )}
        <p style={{ fontSize: '1rem', color: '#666', margin: 0 }}>結果は「自分の記録」のグラフに残るよ📈</p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button onClick={restart} variant="outline" icon={RefreshCw}>もう一度</Button>
          <Button onClick={() => navigate('/progress')}>自分の記録を見る</Button>
          <Button variant="outline" onClick={() => navigate('/dictionary')}>もどる</Button>
        </div>
      </div>
    );
  }

  if (!q) return <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>読み込み中…</div>;

  return (
    <div className="flex-col gap-lg" style={{ flex: 1, maxWidth: '640px', margin: '0 auto', width: '100%', padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button variant="outline" onClick={() => navigate('/dictionary')} icon={ArrowLeft}>もどる</Button>
        <h2 className="text-primary" style={{ margin: 0, flex: 1, textAlign: 'center', marginRight: '80px' }}>🧪 単語実力テスト</h2>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-primary)', fontSize: '1.1rem' }}>
        {qIndex + 1} / {questions.length} 問目（一発勝負！）
      </div>

      <div className="glass-card flex-col flex-center gap-md" style={{ padding: '2rem', textAlign: 'center' }}>
        {q.type === 'audio' ? (
          <>
            <p style={{ margin: 0, fontSize: '1.1rem', color: '#666' }}>音をきいて、正しい英語を選ぼう</p>
            <Button onClick={() => speak(q.word.english)} icon={Volume2} style={{ fontSize: '1.3rem', padding: '0.9rem 2.4rem', background: 'var(--color-accent)', color: '#000' }}>
              音をきく
            </Button>
          </>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: '1.1rem', color: '#666' }}>この意味の英語を選ぼう</p>
            {/* 数の単元は絵文字と意味がどちらも「50」なので、同じなら1回だけ出す（子どもの声 2026-10-17「50 50って二つ」） */}
            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{q.word.emoji === q.word.japanese ? q.word.japanese : `${q.word.emoji} ${q.word.japanese}`}</div>
          </>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {q.choices.map(c => {
          const isAnswer = c.id === q.word.id;
          const isPicked = picked === c.id;
          let bg = 'white';
          if (picked) {
            if (isAnswer) bg = '#dcfce7';
            else if (isPicked) bg = '#fee2e2';
          }
          return (
            <button
              key={c.id}
              onClick={() => handlePick(c)}
              disabled={!!picked}
              className="glass-card"
              style={{ padding: '1.2rem', fontSize: '1.25rem', fontWeight: 'bold', cursor: picked ? 'default' : 'pointer', background: bg, border: `2px solid ${picked && isAnswer ? 'var(--color-success)' : picked && isPicked ? 'var(--color-error)' : '#e2e8f0'}`, color: 'var(--color-primary)', fontFamily: 'var(--font-heading)' }}
            >
              {picked && isAnswer && '⭕ '}{picked && isPicked && !isAnswer && '❌ '}{c.english}
            </button>
          );
        })}
      </div>
    </div>
  );
};
