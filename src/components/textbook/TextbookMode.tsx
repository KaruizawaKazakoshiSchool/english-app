import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSafeBack } from '../../hooks/useSafeBack';
import { ArrowLeft, HelpCircle, Mic, Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { usePoints } from '../../hooks/usePoints';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { usePronunciationAssessment } from '../../hooks/usePronunciationAssessment';
import { usePronunciationHistory } from '../../hooks/usePronunciationHistory';
import { DEFAULT_QUIZZES } from './textbookQuizData';
import { WORLD_BENTO_QUIZZES } from './worldBentoQuizData';
import { KARUIZAWA_QUIZZES } from './karuizawaQuizData';
import { showToast } from '../ui/Toast';

export type QuizQuestion = {
  question: string;
  videoRef: string;
} & (
  | { type: 'choice'; options: string[]; correctIndex: number; }
  | { type: 'typing'; correctAnswer: string; }
);

export interface TextbookQuiz {
  id: string;
  grade: 5 | 6;
  unitName: string;
  url?: string;
  keyPhrase: string;
  keyPhraseJapanese: string;
  questions: QuizQuestion[];
  noBonus?: boolean; // trueなら発音ボーナス課題を出さず、問題だけで完了（World Bento用）
}

const normalizeText = (text: string) => {
  return text
    .normalize('NFKC') // 全角英数を半角に
    .toLowerCase()
    .replace(/[.,!?'"・。\、「」\-\s]/g, '') // 記号や空白をすべて削除
    .trim();
};

// ボーナス課題（キーフレーズの音読）の合格ライン。Azure発音判定の総合スコア 0-100。
const BONUS_PASS_SCORE = 60;
// ボーナス課題（キーフレーズの音読）まで合格したときの上乗せ倍率。
// 「3問だけで抜ける」より「最後までやる」ほうが得になるようにする。
const BONUS_FINISH_MULTIPLIER = 1.5;

export const TextbookMode: React.FC = () => {
  const goBack = useSafeBack();
  const { addPoints } = usePoints();
  const { isRecording, transcript, startListening, stopListening, setTranscript } = useSpeechRecognition();
  const {
    assess,
    isAssessing,
    stopAssess,
    isAvailable: azureAvailable,
    lastRecordingUrl,
    getLastError,
  } = usePronunciationAssessment();
  const { addScore } = usePronunciationHistory();
  // ボーナス課題のAzureスコア（表示用）と、ボーナス獲得済みフラグ（ポイント二重取り防止）
  const [bonusScore, setBonusScore] = useState<number | null>(null);
  const [bonusEarned, setBonusEarned] = useState(false);
  
  const [grade, setGrade] = useState<5 | 6 | null>(null);
  const [quizzes, setQuizzes] = useState<TextbookQuiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<TextbookQuiz | null>(null);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [quizState, setQuizState] = useState<'idle' | 'playing' | 'bonus' | 'completed'>('idle');
  // 動画を見たUnitのid。動画があるUnitは「動画を見る」を押すまでクイズをロックする。
  const [watched, setWatched] = useState<Set<string>>(new Set());
  // 正解数（本問だけ・ボーナス除く）。加点を正答率でスケールするために数える。
  const [correctCount, setCorrectCount] = useState(0);
  // ★正解数は ref にも持つ。
  //   最終問題の答え合わせのあと 1.5秒後に finishQuiz を呼ぶが、そのときの
  //   correctCount は「最後の1問を数える前」の古い値になる（setTimeoutが
  //   古いレンダーの値を掴むため）。その結果、最終問題の正解が加点に
  //   反映されず、全問正解でも満額にならなかった。refなら常に最新が読める。
  const correctCountRef = useRef(0);
  // このクイズで実際にポイントが入ったか（正答率が足りないと0点）。完了画面の表示に使う。
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  // クイズ集を全部クリアしたときの完走ボーナス（出たときだけ完了画面に表示）
  const [setBonus, setSetBonus] = useState<number | null>(null);
  
  // Choice state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  
  // Typing/Bonus state
  const [typingInput, setTypingInput] = useState('');
  
  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const fetchQuizzes = async () => {
    let allQuizzes = [...DEFAULT_QUIZZES];

    if (supabase) {
      const { data } = await supabase
        .from('students')
        .select('dictionary_progress')
        .eq('id', 'app_settings_v1')
        .single();

      if (data?.dictionary_progress?.textbookQuizzes) {
        const dbQuizzes: TextbookQuiz[] = data.dictionary_progress.textbookQuizzes;
        const defaultIds = new Set(allQuizzes.map(q => q.id));
        for (const q of dbQuizzes) {
          if (!defaultIds.has(q.id)) {
            allQuizzes.push(q);
          }
        }
      }
    }
    setQuizzes(allQuizzes);
  };

  const handleQuizSelect = (quiz: TextbookQuiz) => {
    setSelectedQuiz(quiz);
    setQuizState('playing');
    setCurrentQuestionIndex(0);
    setCorrectCount(0);
    correctCountRef.current = 0;
    setEarnedPoints(null);
    setBonusScore(null);
    setBonusEarned(false);
    resetQuestionState();
  };

  // URLパラメータ（?grade=5&id=g5-u1）で特定Unitを直接ひらく（今日のミッション用）
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const g = searchParams.get('grade');
    const id = searchParams.get('id');
    // 学年はTOPのカードでえらぶ前提。学年選択画面は廃止し、未指定なら5年を既定にする。
    setGrade(g === '6' ? 6 : 5);
    if (id) {
      const quiz = DEFAULT_QUIZZES.find(q => q.id === id) || WORLD_BENTO_QUIZZES.find(q => q.id === id) || KARUIZAWA_QUIZZES.find(q => q.id === id);
      if (quiz) handleQuizSelect(quiz);
    }
  }, [searchParams]);

  const resetQuestionState = () => {
    setSelectedOption(null);
    setTypingInput('');
    setIsChecking(false);
    setFeedback(null);
    setTranscript('');
  };

  const handleChoiceSubmit = (index: number) => {
    if (isChecking) return;
    const currentQ = selectedQuiz!.questions[currentQuestionIndex];
    if (currentQ.type !== 'choice') return;

    setSelectedOption(index);
    setIsChecking(true);

    const isCorrect = index === currentQ.correctIndex;
    if (isCorrect) {
      setFeedback('correct');
      correctCountRef.current += 1;
      setCorrectCount(prev => prev + 1); // Weight 1 for choice
    } else {
      setFeedback('incorrect');
    }

    proceedToNext();
  };

  const handleTypingSubmit = () => {
    if (isChecking) return;
    const currentQ = selectedQuiz!.questions[currentQuestionIndex];
    if (currentQ.type !== 'typing') return;

    setIsChecking(true);

    const normInput = normalizeText(typingInput);
    const normTarget = normalizeText(currentQ.correctAnswer);
    // 多少の揺れ（一部の一致など）を許容
    const isCorrect = normInput === normTarget || normInput.includes(normTarget) || normTarget.includes(normInput);

    if (isCorrect) {
      setFeedback('correct');
      correctCountRef.current += 1;
      setCorrectCount(prev => prev + 1); // Weight 3 for typing
    } else {
      setFeedback('incorrect');
    }

    proceedToNext();
  };

  const handleBonusSubmit = (input: string) => {
    if (isChecking) return;
    setIsChecking(true);
    
    const normInput = normalizeText(input);
    const normTarget = normalizeText(selectedQuiz!.keyPhrase);
    // 単文として完全に抜き出せなくても、キーワードが含まれていればOKとする
    const isCorrect = normInput === normTarget || normInput.includes(normTarget) || normTarget.includes(normInput);

    if (isCorrect) {
      setFeedback('correct');
      if (!bonusEarned) { // Weight 5 for bonus
        setBonusEarned(true);
      }
    } else {
      setFeedback('incorrect');
    }

    setTimeout(() => {
      finishQuiz();
    }, 1500);
  };

  // Sync voice transcript to typing input for bonus (Azure未設定のWeb Speech時のみ)
  useEffect(() => {
    if (!azureAvailable && quizState === 'bonus' && transcript) {
      setTypingInput(transcript);
    }
  }, [azureAvailable, transcript, quizState]);

  // Azureの発音採点でボーナス課題（キーフレーズの音読）を判定する。
  // 自動で次に進まず、録音の聞き返しや読み直しを自分のペースでできるようにする。
  const handleAzureBonus = async () => {
    if (isAssessing || !selectedQuiz) return;

    const result = await assess(selectedQuiz.keyPhrase);
    if (!result) {
      // 聞き取れなかった/通信エラー：ノーカウントで再挑戦。その場に通知する。
      showToast(getLastError() || '🎙️ 声が聞こえなかったよ。もう一度ゆっくり言ってみてね', 'fail');
      return;
    }

    // 採点は accuracyScore（発音の正確さ）で統一（なめらかさ等で不当に下がるのを防ぐ）
    setBonusScore(result.accuracyScore);
    setTypingInput(result.recognizedText);
    addScore('textbook', result.accuracyScore, selectedQuiz.keyPhrase);

    if (result.accuracyScore >= BONUS_PASS_SCORE) {
      setFeedback('correct');
      if (!bonusEarned) { // Weight 5 for bonus（一度だけ）
        setBonusEarned(true);
      }
    } else {
      setFeedback('incorrect');
    }
  };

  const proceedToNext = () => {
    setTimeout(() => {
      if (currentQuestionIndex < selectedQuiz!.questions.length - 1) {
        setCurrentQuestionIndex(i => i + 1);
        resetQuestionState();
      } else if (selectedQuiz!.noBonus) {
        finishQuiz(); // ボーナスなし：4問で完了
      } else {
        setQuizState('bonus');
        resetQuestionState();
      }
    }, 1500);
  };

  /** いま開いているクイズ集（?set=… があればそれ、無ければ学年の教科書Unit） */
  const currentSetQuizzes = (): TextbookQuiz[] => {
    const sp = searchParams.get('set');
    if (sp === 'worldbento') return WORLD_BENTO_QUIZZES;
    if (sp === 'karuizawa') return KARUIZAWA_QUIZZES;
    return quizzes.filter(q => q.grade === grade);
  };
  const currentSetKey = (): string => searchParams.get('set') || `g${grade}`;

  const readClearCounts = (): Record<string, number> => {
    const id = localStorage.getItem('studentId');
    try { return JSON.parse(localStorage.getItem(`clearCounts_${id}`) || '{}'); } catch { return {}; }
  };

  const finishQuiz = async () => {
    setQuizState('completed');
    setSetBonus(null);
    // ポイントは「正答率」でスケールする。適当に押して完了しても点が入らないように、
    // 正答率が半分未満なら加点しない（まっとうに解いた分だけ加点＝チート抑止）。
    // 繰り返すほど加点は逓減する（addPoints内で共通処理。最終的に0）。
    const total = selectedQuiz!.questions.length;
    const correct = correctCountRef.current;
    const ratio = total > 0 ? correct / total : 0;
    if (ratio < 0.5) {
      setEarnedPoints(0); // ほとんど不正解 → 今回は加点なし（もう一度！）
      return;
    }
    // ボーナス課題（キーフレーズの音読）まで合格した子は上乗せ＝「最後までやると得」。
    // 合格ラインを満たしたときだけなので、押すだけでは増えない。
    const pts = await addPoints(`textbook_quiz_${selectedQuiz!.id}`, {
      multiplier: ratio * (bonusEarned ? BONUS_FINISH_MULTIPLIER : 1),
      isPerfect: correct === total,
    });
    setEarnedPoints(pts);
    await checkSetComplete();
  };

  /** このクイズ集（学年 or まちクイズ等）を全部クリアしたら、完走ボーナスを1回出す */
  const checkSetComplete = async () => {
    const list = currentSetQuizzes();
    if (list.length === 0) return;
    const counts = readClearCounts();
    // いま終えたUnitは、addPointsの書き込みが済んでいるので counts に入っている
    const done = list.filter(q => (counts[`textbook_quiz_${q.id}`] || 0) > 0).length;
    if (done < list.length) return;
    const gained = await addPoints(`textbook_set_${currentSetKey()}`, {});
    if (gained > 0) {
      setSetBonus(gained);
      showToast(`🏁 全部クリア！ 完走ボーナス ＋${gained}ポイント`, 'points');
    }
  };

  // 学年はTOPカードでえらぶ前提なので、ここでは必ず5/6が入っている（保険のガード）
  if (!grade) return null;

  // ?set=worldbento / ?set=karuizawa のときは専用クイズ集を表示。通常は学年の教科書Unit。
  const setParam = searchParams.get('set');
  const isWorldBento = setParam === 'worldbento';
  const isKaruizawa = setParam === 'karuizawa';
  const listQuizzes = isWorldBento ? WORLD_BENTO_QUIZZES
    : isKaruizawa ? KARUIZAWA_QUIZZES
    : quizzes.filter(q => q.grade === grade);

  return (
    <div className="flex-col" style={{ flex: 1, padding: '2rem', gap: '1.5rem', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button variant="outline" onClick={goBack} icon={ArrowLeft}>もどる</Button>
        <h2 className="text-primary" style={{ margin: 0, fontSize: '1.8rem', flex: 1, textAlign: 'center' }}>
          {isWorldBento ? '🍱 世界の料理クイズ' : isKaruizawa ? '🏔 軽井沢まちクイズ' : `📖 ${grade}年生の教科書`}
        </h2>
      </div>

      {quizState === 'idle' && (
        <>
          <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(0, 184, 148, 0.1)', border: '2px solid #00b894' }}>
            <p style={{ margin: 0, fontSize: '1.1rem', color: '#2d3436' }}>
              📺 まずUnitの「<strong>動画を見る</strong>」ボタンで動画を見よう。<br/>
              見終わったら「<strong>クイズに挑戦</strong>」でポイントをもらおう！<br/>
              <span style={{ fontSize: '0.9rem', color: '#555' }}>問題は動画の順番どおり（1本目の動画→1問目、2本目→2問目…）に出るよ。</span>
            </p>
          </div>

          {/* 完走の進み具合。あと何個かが見えると、途中でやめにくくなる。 */}
          {(() => {
            const counts = readClearCounts();
            const done = listQuizzes.filter(q => (counts[`textbook_quiz_${q.id}`] || 0) > 0).length;
            const rest = listQuizzes.length - done;
            const setDone = (counts[`textbook_set_${currentSetKey()}`] || 0) > 0;
            return (
              <div className="glass-card" style={{ padding: '1rem 1.5rem', background: 'rgba(253, 203, 110, 0.22)', border: '2px solid var(--color-accent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.5rem' }}>🏁</span>
                  <span style={{ fontWeight: 'bold', color: '#7a5a00', fontSize: '1.05rem' }}>
                    {setDone
                      ? `完走済み！ 全部（${listQuizzes.length}／${listQuizzes.length}）クリアしたよ`
                      : rest === 0
                        ? 'あと1回クイズをおえると 完走ボーナス！'
                        : `完走ボーナスまで あと${rest}Unit（${done}／${listQuizzes.length} クリア）`}
                  </span>
                </div>
                <div style={{ marginTop: '0.5rem', height: '10px', background: 'rgba(255,255,255,0.7)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${listQuizzes.length ? (done / listQuizzes.length) * 100 : 0}%`, height: '100%', background: 'var(--color-accent)' }} />
                </div>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#7a5a00' }}>
                  全部クリアすると 完走ボーナス。音読（ボーナス課題）までやると、そのUnitのポイントが {BONUS_FINISH_MULTIPLIER}倍！
                </p>
              </div>
            );
          })()}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <HelpCircle color="var(--color-primary)" />
            <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.3rem' }}>Unitクイズ一覧</h3>
          </div>

          {listQuizzes.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
              まだこの学年のクイズはありません。
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {listQuizzes.map(quiz => (
                <div
                  key={quiz.id}
                  className="glass-card"
                  style={{ padding: '1.5rem', background: 'white', border: '2px solid #e2e8f0' }}
                >
                  <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-primary)', fontSize: '1.2rem' }}>
                    {quiz.unitName}
                  </h4>
                  <p style={{ margin: '0 0 1rem 0', color: '#64748b', fontSize: '0.9rem' }}>
                    {quiz.questions.length}問のクイズ{quiz.noBonus ? '' : ' ＋ ボーナス課題'}
                  </p>
                  {(() => {
                    // 動画があるUnitは、動画を見るまでクイズをロック（見終わってから答える流れを守る）。
                    const locked = !!quiz.url && !watched.has(quiz.id);
                    return (
                  <div className="flex-col" style={{ gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {quiz.url && (
                        <button
                          onClick={() => { window.open(quiz.url, '_blank'); setWatched(w => new Set(w).add(quiz.id)); }}
                          style={{ flex: 1, padding: '0.7rem', borderRadius: '8px', border: '2px solid #00b894', background: 'rgba(0, 184, 148, 0.1)', color: '#00b894', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                        >
                          📺 動画を見る
                        </button>
                      )}
                      <button
                        onClick={() => !locked && handleQuizSelect(quiz)}
                        disabled={locked}
                        className={locked ? '' : 'hover-scale'}
                        style={{ flex: 1, padding: '0.7rem', borderRadius: '8px', border: 'none', background: locked ? '#cbd5e1' : 'var(--color-primary)', color: 'white', fontWeight: 'bold', cursor: locked ? 'not-allowed' : 'pointer', fontSize: '0.95rem' }}
                      >
                        {locked ? '🔒 クイズに挑戦' : '✏️ クイズに挑戦'}
                      </button>
                    </div>
                    {locked && (
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center' }}>
                        先に「📺 動画を見る」を見てね
                      </p>
                    )}
                  </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {quizState === 'playing' && selectedQuiz && (() => {
        const currentQuestion = selectedQuiz.questions[currentQuestionIndex];
        return (
        <div className="glass-card animate-pop" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.3rem' }}>
                {selectedQuiz.unitName}
              </h3>
              <span style={{ display: 'inline-block', background: '#e2e8f0', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold', color: '#475569', marginTop: '0.5rem' }}>
                📺 {currentQuestion.videoRef}（{currentQuestionIndex + 1}本目の動画の内容だよ）
              </span>
            </div>
            <span style={{ fontWeight: 'bold', color: '#64748b', fontSize: '1.1rem' }}>
              {currentQuestionIndex + 1} / {selectedQuiz.questions.length}
            </span>
          </div>

          <div style={{ padding: '2rem', background: '#f8fafc', borderRadius: '16px', marginBottom: '2rem', borderLeft: '4px solid var(--color-primary)' }}>
            <p style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold', lineHeight: '1.6' }}>
              {currentQuestion.question}
            </p>
          </div>

          {currentQuestion.type === 'choice' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrectAnswer = idx === currentQuestion.correctIndex;
                
                let bgColor = 'white';
                let borderColor = '#e2e8f0';
                let textColor = '#2d3436';
                if (isChecking) {
                  if (isCorrectAnswer) {
                    bgColor = 'var(--color-success)';
                    borderColor = 'var(--color-success)';
                    textColor = 'white';
                  } else if (isSelected) {
                    bgColor = 'var(--color-error)';
                    borderColor = 'var(--color-error)';
                    textColor = 'white';
                  }
                }

                // 答え合わせ中は ⭕/❌ を明示（色だけだと正解かどうか分かりづらい）
                const mark = isChecking
                  ? (isCorrectAnswer ? '⭕ ' : isSelected ? '❌ ' : '')
                  : '';

                return (
                  <button
                    key={idx}
                    onClick={() => handleChoiceSubmit(idx)}
                    disabled={isChecking}
                    style={{
                      padding: '1.2rem 1.5rem',
                      borderRadius: '12px',
                      border: `2px solid ${borderColor}`,
                      background: bgColor,
                      color: textColor,
                      fontSize: '1.2rem',
                      cursor: isChecking ? 'default' : 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                      fontWeight: 'bold'
                    }}
                  >
                    {mark}{option}
                  </button>
                );
              })}

              {/* 選択肢のすぐ下＝今見ている場所に、正解/不正解をはっきり出す */}
              {isChecking && feedback === 'correct' && (
                <div className="animate-pop" style={{ color: 'var(--color-success)', fontWeight: 'bold', fontSize: '1.4rem', padding: '1rem', background: '#dcfce7', borderRadius: '12px', textAlign: 'center', border: '2px solid var(--color-success)' }}>
                  ⭕ 正解！
                </div>
              )}
              {isChecking && feedback === 'incorrect' && (
                <div className="animate-pop" style={{ color: 'var(--color-error)', fontWeight: 'bold', fontSize: '1.2rem', padding: '1rem', background: '#fee2e2', borderRadius: '12px', textAlign: 'center', border: '2px solid var(--color-error)' }}>
                  ❌ 残念！ 正解は「{currentQuestion.options[currentQuestion.correctIndex]}」
                </div>
              )}
            </div>
          )}

          {currentQuestion.type === 'typing' && (
            <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <input
                  type="text"
                  value={typingInput}
                  onChange={(e) => setTypingInput(e.target.value)}
                  disabled={isChecking}
                  placeholder="英語で入力してね"
                  style={{ flex: 1, padding: '1rem 1.5rem', fontSize: '1.2rem', borderRadius: '12px', border: '2px solid #e2e8f0', outline: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTypingSubmit();
                  }}
                />
                <Button 
                  onClick={handleTypingSubmit} 
                  disabled={isChecking || !typingInput.trim()}
                  style={{ padding: '0 2rem' }}
                >
                  <Send size={20} />
                </Button>
              </div>
              {isChecking && feedback === 'incorrect' && (
                <div style={{ color: 'var(--color-error)', fontWeight: 'bold', marginTop: '1rem', padding: '1rem', background: '#fee2e2', borderRadius: '8px' }}>
                  ❌ おしい！正解は: {currentQuestion.correctAnswer}
                </div>
              )}
              {isChecking && feedback === 'correct' && (
                <div style={{ color: 'var(--color-success)', fontWeight: 'bold', marginTop: '1rem', padding: '1rem', background: '#dcfce7', borderRadius: '8px' }}>
                  ✅ 正解！
                </div>
              )}
            </div>
          )}
        </div>
        );
      })()}

      {quizState === 'bonus' && selectedQuiz && (
        <div className="glass-card animate-pop" style={{ padding: '3rem 2rem', textAlign: 'center', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)' }}>
          <h2 style={{ color: '#d97706', fontSize: '2rem', margin: '0 0 1rem 0' }}>🌟 ボーナス課題 🌟</h2>
          <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#451a03', marginBottom: '2rem' }}>
            動画の最後に出てくるフレーズ（単文）を答えよう！<br/>
            （マイクで話すか、タイピングしてね。多少間違えても大丈夫！）
          </p>

          <div style={{ padding: '2rem', background: 'white', borderRadius: '16px', border: '2px solid #fde68a', marginBottom: '2rem' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#1e293b' }}>
              「{selectedQuiz.keyPhraseJapanese}」
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column', maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <input
                type="text"
                value={typingInput}
                onChange={(e) => setTypingInput(e.target.value)}
                disabled={isChecking}
                placeholder="Type or use mic..."
                style={{ flex: 1, padding: '1rem', fontSize: '1.2rem', borderRadius: '12px', border: '2px solid #e2e8f0' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleBonusSubmit(typingInput);
                }}
              />
              <button
                onClick={() => {
                  if (azureAvailable) {
                    if (isAssessing) { stopAssess(); return; }
                    setBonusScore(null);
                    handleAzureBonus();
                  } else {
                    isRecording ? stopListening() : startListening();
                  }
                }}
                disabled={isChecking}
                title={azureAvailable ? '英語のフレーズを声に出して読んでね' : undefined}
                style={{
                  padding: '0 1.5rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: (azureAvailable ? isAssessing : isRecording) ? 'var(--color-error)' : 'var(--color-primary)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <Mic size={24} className={(azureAvailable ? isAssessing : isRecording) ? 'animate-pulse' : ''} />
              </button>
              {azureAvailable && lastRecordingUrl && !isAssessing && (
                <button
                  onClick={() => new Audio(lastRecordingUrl).play()}
                  title="さっきの自分の声を聞く"
                  style={{ padding: '0 1.2rem', borderRadius: '12px', border: '2px solid var(--color-primary)', background: 'white', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '1.4rem', flexShrink: 0 }}
                >
                  🔊
                </button>
              )}
            </div>

            {azureAvailable ? (
              <p style={{ fontSize: '0.9rem', color: '#92400e', margin: 0 }}>
                🎤 マイクを押して、英語のフレーズを声に出して読んでね（発音を採点するよ）。タイピングで答えてもOK。
              </p>
            ) : null}

            <Button
              onClick={() => handleBonusSubmit(typingInput)}
              disabled={isChecking || !typingInput.trim()}
              style={{ width: '100%', padding: '1rem', fontSize: '1.2rem', background: '#d97706' }}
            >
              {azureAvailable ? 'タイピングで答える' : '回答する！'}
            </Button>

            {azureAvailable && bonusScore !== null && (
              <div
                className="animate-pop"
                style={{
                  fontSize: '1.3rem',
                  fontWeight: 'bold',
                  color: bonusScore >= BONUS_PASS_SCORE ? 'var(--color-success)' : 'var(--color-error)'
                }}
              >
                発音スコア: {Math.round(bonusScore)} 点 {bonusScore >= BONUS_PASS_SCORE ? '✅' : '（おしい！）'}
              </div>
            )}

            {(isChecking || azureAvailable) && feedback === 'incorrect' && (
              <div style={{ color: 'var(--color-error)', fontWeight: 'bold', marginTop: '1rem', padding: '1rem', background: '#fee2e2', borderRadius: '8px' }}>
                ❌ おしい！正解は: {selectedQuiz.keyPhrase}
              </div>
            )}
            {(isChecking || azureAvailable) && feedback === 'correct' && (
              <div style={{ color: 'var(--color-success)', fontWeight: 'bold', marginTop: '1rem', padding: '1rem', background: '#dcfce7', borderRadius: '8px' }}>
                🎉 大正解！ボーナスポイントGET！
              </div>
            )}

            {azureAvailable && (
              <Button
                variant="outline"
                onClick={finishQuiz}
                style={{ width: '100%', marginTop: '0.5rem' }}
              >
                {bonusEarned ? 'おわって結果を見る →' : 'スキップして結果を見る →'}
              </Button>
            )}
          </div>
        </div>
      )}

      {quizState === 'completed' && selectedQuiz && (
        <div className="glass-card flex-col flex-center gap-md animate-pop" style={{ padding: '3rem' }}>
          <div>
            <div style={{ fontSize: '5rem' }}>{earnedPoints && earnedPoints > 0 ? '🏆' : '💪'}</div>
          </div>

          <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '2rem' }}>
            {earnedPoints && earnedPoints > 0 ? 'Unit Clear!' : 'おしい！もう一度！'}
          </h2>

          <p style={{ fontSize: '1.3rem', margin: 0 }}>
            {selectedQuiz.questions.length}問中 <strong>{correctCount}</strong>問 正解
          </p>
          {earnedPoints !== null && (
            earnedPoints > 0 ? (
              <>
                <p style={{ fontSize: '1.3rem', margin: 0, color: 'var(--color-accent)', fontWeight: 'bold' }}>
                  ＋{earnedPoints} ポイント！✨{bonusEarned && <span style={{ fontSize: '0.95rem' }}>（音読までやりきりボーナス）</span>}
                </p>
                {setBonus !== null && setBonus > 0 && (
                  <p style={{ fontSize: '1.2rem', margin: 0, fontWeight: 'bold', color: '#b45309', background: 'rgba(253,203,110,0.3)', border: '2px solid var(--color-accent)', borderRadius: '14px', padding: '0.5rem 1rem' }}>
                    🏁 全部クリア！ 完走ボーナス ＋{setBonus} ポイント
                  </p>
                )}
              </>
            ) : (
              <p style={{ fontSize: '1.05rem', margin: 0, color: '#94a3b8' }}>
                半分以上正解すると、ポイントがもらえるよ。動画をもう一度見てチャレンジ！
              </p>
            )
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <Button variant="outline" onClick={() => { setQuizState('idle'); setSelectedQuiz(null); }}>
              クイズ一覧にもどる
            </Button>
            <Button onClick={() => handleQuizSelect(selectedQuiz)}>
              もう一度チャレンジ！
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
