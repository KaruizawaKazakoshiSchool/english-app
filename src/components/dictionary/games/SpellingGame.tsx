import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { type Vocabulary } from '../../../data/vocabulary';
import { useVocabulary } from '../../../hooks/useVocabulary';
import { useSpeechSynthesis } from '../../../hooks/useSpeechSynthesis';
import { Button } from "../../ui/Button";
import { ArrowLeft, Volume2, Star, Trophy, RefreshCw } from 'lucide-react';
import { useDictionaryProgress } from '../../../hooks/useDictionaryProgress';
import { usePoints } from '../../../hooks/usePoints';
import { useLockPause } from '../../../lib/lockPause';

export const SpellingGame: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const decodedCategory = decodeURIComponent(category || '');
  const { speak, speakSlow } = useSpeechSynthesis();
  const { saveProgress } = useDictionaryProgress();
  const { addPoints } = usePoints();
  const vocabulary = useVocabulary();

  const words = React.useMemo(() => vocabulary.filter(v => v.category === decodedCategory), [decodedCategory, vocabulary]);

  const [targetWord, setTargetWord] = useState<Vocabulary | null>(null);
  const [typingInput, setTypingInput] = useState('');
  const [difficulty, setDifficulty] = useState<'select' | 'easy' | 'hard'>('select');
  const [scrambledLetters, setScrambledLetters] = useState<{char: string, id: number}[]>([]);
  const [selectedLetters, setSelectedLetters] = useState<{char: string, id: number}[]>([]);
  const [shuffledWords, setShuffledWords] = useState<Vocabulary[]>([]);
  
  const [questionCount, setQuestionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  
  const [startTime, setStartTime] = useState<number | null>(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const lockPaused = useLockPause(setStartTime); // ロック中は時計を止める
  const [bestTime, setBestTime] = useState<{ name: string; time: number } | null>(null);
  const [newRecordMsg, setNewRecordMsg] = useState('');
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);

  const [showAnswerState, setShowAnswerState] = useState(false);
  const [showCorrectMark, setShowCorrectMark] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showFailure, setShowFailure] = useState(false);
  const [choiceError, setChoiceError] = useState(false);

  const DEFAULT_TOTAL_QUESTIONS = 10;
  const TOTAL_QUESTIONS = words.length > 0 ? Math.min(DEFAULT_TOTAL_QUESTIONS, words.length) : DEFAULT_TOTAL_QUESTIONS;
  const PASS_MARK = Math.max(1, Math.floor(TOTAL_QUESTIONS * 0.8));

  // Load best time
  useEffect(() => {
    const recordKey = `dict_typing_${decodedCategory}`;
    const recordStr = localStorage.getItem(recordKey);
    if (recordStr) {
      setBestTime(JSON.parse(recordStr));
    } else {
      setBestTime(null);
    }
  }, [decodedCategory]);

  // Live timer
  useEffect(() => {
    if (!lockPaused && difficulty !== 'select' && startTime && !showCelebration && !showFailure) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [difficulty, startTime, showCelebration, showFailure, lockPaused]);

  useEffect(() => {
    if (words.length > 0 && shuffledWords.length === 0) {
      setShuffledWords([...words].sort(() => 0.5 - Math.random()));
    }
  }, [words, shuffledWords.length]);

  const generateQuestion = useCallback((qCount: number, sWords: Vocabulary[]) => {
    if (sWords.length === 0) return;
    const target = sWords[qCount % sWords.length];
    setTargetWord(target);
    setTypingInput('');
    
    // Setup easy mode letters
    const wordStr = target.english.toLowerCase().replace(/\s/g, '');
    const letters = wordStr.split('').map((char, id) => ({ char, id }));
    setScrambledLetters(letters.sort(() => 0.5 - Math.random()));
    setSelectedLetters([]);
  }, []);

  useEffect(() => {
    if (shuffledWords.length > 0 && questionCount === 0 && !targetWord && !showCelebration && !showFailure) {
      generateQuestion(0, shuffledWords);
    }
  }, [shuffledWords, questionCount, targetWord, showCelebration, showFailure, generateQuestion]);

  // Auto-play audio
  useEffect(() => {
    if (difficulty !== 'select' && targetWord && !showCelebration && !showFailure && !showAnswerState && !showCorrectMark) {
      const timer = setTimeout(() => {
        speak(targetWord.english);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [difficulty, targetWord, showCelebration, showFailure, showAnswerState, showCorrectMark, speak]);

  const moveToNextQuestion = (nextQC: number) => {
    generateQuestion(nextQC, shuffledWords);
  };

  const proceedToNextTurn = (isCorrect: boolean) => {
    const newQC = questionCount + 1;
    const newCC = isCorrect ? correctCount + 1 : correctCount;
    
    setQuestionCount(newQC);
    setCorrectCount(newCC);
    setMistakes(0);

    if (newQC >= TOTAL_QUESTIONS) {
      if (newCC >= PASS_MARK) {
        saveProgress(decodedCategory, { spelling: true }); // Keep 'spelling' key for backward compatibility

        let isNewBest = false;

        if (newCC === TOTAL_QUESTIONS && startTime) {
          const timeTaken = Date.now() - startTime;
          const recordKey = `dict_typing_${decodedCategory}`;
          const recordStr = localStorage.getItem(recordKey);
          
          if (!recordStr) {
            isNewBest = true;
          } else {
            const currentBest = JSON.parse(recordStr);
            if (timeTaken < currentBest.time) {
              isNewBest = true;
            }
          }

          if (isNewBest) {
            const studentName = localStorage.getItem('studentName') || '名無し';
            const newRecord = { name: studentName, time: timeTaken };
            localStorage.setItem(recordKey, JSON.stringify(newRecord));
            setBestTime(newRecord);
            setNewRecordMsg(`🏆 新記録達成！ ${(timeTaken / 1000).toFixed(1)}秒！`);
          } else {
            setNewRecordMsg(`クリアタイム: ${(timeTaken / 1000).toFixed(1)}秒`);
          }
        }

        const savePoints = async () => {
          const pts = await addPoints(`dict_typing_${decodedCategory}`, {
            isPerfect: newCC === TOTAL_QUESTIONS,
            isNewRecord: isNewBest,
            multiplier: TOTAL_QUESTIONS / DEFAULT_TOTAL_QUESTIONS
          });
          setEarnedPoints(pts);
        };
        savePoints();

        setShowCelebration(true);
      } else {
        setShowFailure(true);
      }
    } else {
      moveToNextQuestion(newQC);
    }
  };

  const handleCorrectAnswer = () => {
    setChoiceError(false);
    setShowCorrectMark(true);
    setTimeout(() => {
      setShowCorrectMark(false);
      proceedToNextTurn(true);
    }, 500);
  };

  const handleMistake = () => {
    setChoiceError(true);
    setTimeout(() => setChoiceError(false), 500);
    
    const newMistakes = mistakes + 1;
    setMistakes(newMistakes);

    if (newMistakes >= 2) {
      setShowAnswerState(true);
      setTimeout(() => {
        setShowAnswerState(false);
        proceedToNextTurn(false);
      }, 2000);
    }
  };

  const handleSkip = () => {
    if (showAnswerState || !targetWord) return;
    setShowAnswerState(true);
    setTimeout(() => {
      setShowAnswerState(false);
      proceedToNextTurn(false);
    }, 2000);
  };

  const handleTypingSubmit = () => {
    if (showAnswerState || !targetWord) return;
    if (!typingInput.trim()) return;

    // Check if correct (case-insensitive, ignore spaces)
    const normalizedInput = typingInput.toLowerCase().replace(/\s/g, '');
    const normalizedTarget = targetWord.english.toLowerCase().replace(/\s/g, '');

    if (normalizedInput === normalizedTarget) {
      handleCorrectAnswer();
    } else {
      handleMistake();
    }
  };

  const handleLetterClick = (letter: {char: string, id: number}) => {
    if (showAnswerState || !targetWord) return;
    
    const targetStr = targetWord.english.toLowerCase().replace(/\s/g, '');
    const nextChar = targetStr[selectedLetters.length];
    
    if (letter.char !== nextChar) {
      handleMistake();
      return;
    }
    
    const newSelected = [...selectedLetters, letter];
    setSelectedLetters(newSelected);
    
    if (newSelected.length === targetStr.length) {
      handleCorrectAnswer();
    }
  };

  const handleResetLetters = () => {
    if (showAnswerState || !targetWord) return;
    const wordStr = targetWord.english.toLowerCase().replace(/\s/g, '');
    const letters = wordStr.split('').map((char, id) => ({ char, id }));
    setScrambledLetters(letters.sort(() => 0.5 - Math.random()));
    setSelectedLetters([]);
  };

  const resetSession = () => {
    setQuestionCount(0);
    setCorrectCount(0);
    setMistakes(0);
    setShowAnswerState(false);
    setShowCelebration(false);
    setShowFailure(false);
    setNewRecordMsg('');
    setEarnedPoints(null);
    const newShuffled = [...words].sort(() => 0.5 - Math.random());
    setShuffledWords(newShuffled);
    setElapsedTime(0);
    setStartTime(Date.now());
    generateQuestion(0, newShuffled);
    setDifficulty('select'); // Always go back to difficulty selection
  };

  if (showCelebration) {
    return (
      <div className="flex-col flex-center gap-lg" style={{ height: '100%', textAlign: 'center' }}>
        <h1 className="text-primary" style={{ fontSize: '3rem' }}>ステージクリア！</h1>
        {newRecordMsg && (
          <div className="animate-pop text-accent" style={{ fontSize: '2rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.8)', padding: '1rem 2rem', borderRadius: 'var(--radius-md)', color: 'var(--color-primary)' }}>
            {newRecordMsg}
          </div>
        )}
        <div className="animate-float">
          <Trophy size={100} color="var(--color-accent)" />
        </div>
        {earnedPoints !== null && (
          <div className="animate-pop" style={{ fontSize: '2rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
            +{earnedPoints} ポイントゲット！✨
          </div>
        )}
        <p style={{ fontSize: '1.5rem' }}>{TOTAL_QUESTIONS}問中 <strong>{correctCount}</strong>問 正解！</p>
        <p style={{ fontSize: '1.5rem' }}>タイピングモードをクリアしたよ！</p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button onClick={resetSession} variant="outline">もう一度プレイ</Button>
          <Button onClick={() => navigate(`/dictionary/${category}`)}>もどる</Button>
        </div>
      </div>
    );
  }

  if (showFailure) {
    return (
      <div className="flex-col flex-center gap-lg" style={{ height: '100%', textAlign: 'center' }}>
        <h1 className="text-primary" style={{ fontSize: '3rem' }}>おしい！</h1>
        <p style={{ fontSize: '1.5rem' }}>{TOTAL_QUESTIONS}問中 <strong>{correctCount}</strong>問 正解でした。</p>
        <p style={{ fontSize: '1.2rem', color: '#666' }}>{PASS_MARK}問正解でクリアだよ。もう一度挑戦しよう！</p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <Button onClick={resetSession} icon={RefreshCw}>もう一度</Button>
          <Button onClick={() => navigate(`/dictionary/${category}`)} variant="outline">もどる</Button>
        </div>
      </div>
    );
  }

  if (difficulty === 'select') {
    return (
      <div className="flex-col flex-center gap-lg" style={{ height: '100%' }}>
        <h1 className="text-primary" style={{ fontSize: '2.5rem' }}>タイピングモード</h1>
        <p style={{ fontSize: '1.2rem', color: '#666' }}>難しさを選んでね！</p>
        
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem', maxWidth: '800px', width: '100%' }}>
          <div 
            className="glass-card flex-col flex-center animate-pop"
            style={{ padding: '3rem 2rem', cursor: 'pointer', background: 'rgba(29, 209, 161, 0.2)' }}
            onClick={() => { setDifficulty('easy'); setStartTime(Date.now()); }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👆</div>
            <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '2rem' }}>かんたん</h2>
            <p style={{ marginTop: '0.5rem', color: '#666' }}>アルファベットを順番におそう</p>
          </div>

          <div 
            className="glass-card flex-col flex-center animate-pop"
            style={{ padding: '3rem 2rem', cursor: 'pointer', background: 'rgba(255, 107, 107, 0.2)' }}
            onClick={() => { setDifficulty('hard'); setStartTime(Date.now()); }}
          >
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⌨️</div>
            <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '2rem' }}>難しい</h2>
            <p style={{ marginTop: '0.5rem', color: '#666' }}>キーボードでタイピングしよう</p>
          </div>
        </div>
        
        <Button onClick={() => navigate(`/dictionary/${category}`)} variant="outline" style={{ marginTop: '2rem' }}>
          もどる
        </Button>
      </div>
    );
  }

  if (!targetWord) return null;

  return (
    <div className="flex-col flex-center gap-lg" style={{ minHeight: '100%', width: '100%' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="outline" onClick={() => navigate(`/dictionary/${category}`)} icon={ArrowLeft}>
          もどる
        </Button>
        <h1 className="text-primary" style={{ fontSize: '2rem', margin: 0 }}>タイピングモード</h1>
        <div style={{ width: '100px' }} /> {/* Spacer */}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
          ⏱️ {(elapsedTime / 1000).toFixed(1)}秒
        </div>
        <div style={{ textAlign: 'center', animation: 'float 3s infinite' }}>
          {bestTime ? (
            <span className="badge" style={{ background: 'var(--color-accent)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', color: '#000', fontWeight: 'bold' }}>
              👑 このタブレットの最速記録: {bestTime.name}さん {(bestTime.time / 1000).toFixed(1)}秒
            </span>
          ) : (
            <span className="badge" style={{ background: '#eee', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', color: '#888' }}>
              👑 このタブレットでは まだ記録がないよ！一番のりをめざそう！
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--color-primary)', marginRight: '1rem' }}>
          {questionCount + 1} / {TOTAL_QUESTIONS} 問目
        </div>
        {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
          <Star 
            key={i} 
            size={24} 
            fill={i < correctCount ? "var(--color-accent)" : "transparent"} 
            color={i < correctCount ? "var(--color-accent)" : i < questionCount ? "#ff9f43" : "#ccc"} 
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Button 
          onClick={() => speak(targetWord.english)} 
          icon={Volume2}
          style={{ fontSize: '1.5rem', padding: '1rem 3rem', background: 'var(--color-accent)', color: '#000' }}
        >
          音をきく
        </Button>
        <Button
          variant="outline"
          onClick={() => speakSlow(targetWord.english)}
          style={{ fontSize: '1.2rem', padding: '1rem 1.6rem' }}
        >
          🐢 ゆっくり
        </Button>
      </div>

      <div style={{ minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%' }}>
        {showCorrectMark && (
          <div className="animate-pop" style={{ position: 'absolute', fontSize: '8rem', color: 'var(--color-success)', fontWeight: 'bold', zIndex: 10 }}>
            ◯
          </div>
        )}
        {showAnswerState && (
          <div className="animate-pop text-error" style={{ fontSize: '2.5rem', fontWeight: 'bold', textAlign: 'center' }}>
            正解は: {targetWord.english} {targetWord.emoji}
          </div>
        )}
      </div>

      {!showAnswerState && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '1rem', width: '100%' }}>
          {mistakes >= 1 && (
            <div className="animate-pop" style={{ fontSize: '5rem', marginBottom: '1rem' }}>
              {targetWord.emoji}
            </div>
          )}
          
          {difficulty === 'hard' ? (
            <>
              <input 
                type="text" 
                value={typingInput}
                onChange={(e) => setTypingInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTypingSubmit();
                }}
                placeholder="ここにタイピングしてね"
                style={{ 
                  fontSize: '2.5rem', 
                  padding: '1rem 2rem', 
                  width: '100%', 
                  maxWidth: '400px',
                  textAlign: 'center', 
                  borderRadius: 'var(--radius-sm)',
                  border: choiceError ? '3px solid var(--color-error)' : '3px solid var(--color-primary)',
                  fontFamily: 'var(--font-heading)'
                }}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
              />
              <Button onClick={handleTypingSubmit} style={{ marginTop: '1rem', padding: '1rem 3rem', fontSize: '1.5rem' }}>
                答える
              </Button>
            </>
          ) : (
            <>
              <div 
                className="flex-center" 
                style={{ 
                  minHeight: '80px', 
                  borderBottom: choiceError ? '4px solid var(--color-error)' : '4px solid var(--color-primary)',
                  marginBottom: '1rem',
                  padding: '0.5rem 2rem',
                  fontSize: '3rem',
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--color-primary)',
                  minWidth: '200px',
                  letterSpacing: '0.2rem'
                }}
              >
                {selectedLetters.map(l => l.char).join('')}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '600px' }}>
                {scrambledLetters.map(letter => {
                  const isSelected = selectedLetters.some(sl => sl.id === letter.id);
                  return (
                    <button
                      key={letter.id}
                      onClick={() => !isSelected && handleLetterClick(letter)}
                      className={`btn btn-secondary ${isSelected ? '' : 'animate-pop'}`}
                      style={{ 
                        fontSize: '2rem', 
                        width: '60px', 
                        height: '60px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        fontFamily: 'var(--font-heading)',
                        padding: 0,
                        visibility: isSelected ? 'hidden' : 'visible'
                      }}
                    >
                      {letter.char}
                    </button>
                  );
                })}
              </div>

              <Button 
                onClick={handleResetLetters} 
                variant="outline" 
                icon={RefreshCw}
                style={{ marginTop: '1rem' }}
              >
                やりなおす
              </Button>
            </>
          )}

          {/* パス（子どもの声 2026-10-29「タイピングにスキップを。教科のは難しい」）。
              答えを見せて次へ。その問題は「まちがい」あつかい＝ポイントは正解した数で決まるので、パスで得はしない */}
          <Button onClick={handleSkip} variant="outline" style={{ marginTop: '0.5rem' }}>
            ⏭ パスする（答えを見て 次へ）
          </Button>
        </div>
      )}
    </div>
  );
};
