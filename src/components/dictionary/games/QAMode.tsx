import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { type Vocabulary } from '../../../data/vocabulary';
import { useVocabulary } from '../../../hooks/useVocabulary';
import { useSpeechSynthesis } from '../../../hooks/useSpeechSynthesis';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';
import { Button } from "../../ui/Button";
import { ArrowLeft, Volume2, Star, Trophy, RefreshCw, Mic, Keyboard } from 'lucide-react';
import { usePoints } from '../../../hooks/usePoints';
import { useDictionaryProgress } from '../../../hooks/useDictionaryProgress';

// 「文をつくることば」は1語の質問の型に当てはまらないので、語ごとに質問を持つ（子どもの声 2026-10-11「Q and A モードが出てない！」）。
// 「（英語で たずねよう）」で始まるものは、答えが質問文になる語（what・where…）。日本語なので読み上げない。
const SENTENCE_QA: Record<string, string> = {
  'I': 'Can you swim?',
  you: 'Nice to meet you.',
  he: 'Who is he?',
  she: 'Who is she?',
  we: 'What do you and your friends play?',
  they: 'Where are your friends?',
  it: 'Is this your pen?',
  this: 'What is this?',
  that: 'What is that?',
  my: 'Whose bag is this?',
  your: 'Is this my pen?',
  am: 'Are you happy?',
  is: 'Is she your sister?',
  are: 'Are they your friends?',
  what: '（英語で たずねよう）どんな食べ物が好き？',
  where: '（英語で たずねよう）駅はどこ？',
  who: '（英語で たずねよう）かれは だれ？',
  when: '（英語で たずねよう）誕生日は いつ？',
  how: '（英語で たずねよう）元気？',
  and: 'What animals do you like?',
  not: 'Are you hungry?',
};
const isJapanesePrompt = (q: string) => q.startsWith('（');

const getQuestionForPhrase = (keyPhrase: string, category?: string, english?: string) => {
  if (category === '文をつくることば' && english && SENTENCE_QA[english]) return SENTENCE_QA[english];
  if (category === '教科') return "What subject do you like?";
  if (category === 'スポーツ') return "What sport do you like?";
  if (category === '動物') return "What animal do you like?";
  if (keyPhrase.includes("I'd like")) return "What would you like?";
  if (keyPhrase.includes("One ◯◯")) return "May I take your order?";
  if (keyPhrase.includes("Let's eat")) return "What shall we eat?";
  if (keyPhrase.includes("◯◯, please")) return "What would you like?";
  if (keyPhrase.includes("I want to be")) return "What do you want to be?";
  if (keyPhrase.includes("I want to join")) return "What club do you want to join?";
  if (keyPhrase.includes("I want a new")) return "What do you want?";
  if (keyPhrase.includes("I want to")) return "What do you want to do?";
  if (keyPhrase === "You can ◯◯.") return "What can I do?";
  if (keyPhrase.includes("I can play the")) return "What can you play?";
  if (keyPhrase.includes("I can")) return "What can you do?";
  if (keyPhrase.includes("This is my")) return "What is this?";
  if (keyPhrase.includes("He is")) return "What is he like?";
  if (keyPhrase.includes("It's ◯◯.")) return "How is it?";
  if (keyPhrase.includes("I ◯◯")) return "What did you do?";
  if (keyPhrase.includes("I'm ◯◯ years old.")) return "How old are you?";
  if (keyPhrase.includes("I'm ◯◯.")) return "How are you?";
  if (keyPhrase.includes("I like")) return "What do you like?";
  if (keyPhrase.includes("My birthday")) return "When is your birthday?";
  return "What is this?";
};

// Tolerant match helper
const checkAnswer = (input: string, expectedPhrase: string, targetWord: string, strict = false) => {
  const normalize = (s: string) => {
    return s.toLowerCase()
      .replace(/\bi am\b/g, 'im')
      .replace(/\bit is\b/g, 'its')
      .replace(/\bi would\b/g, 'id')
      .replace(/['’.,!?〜◯\-]/g, '') // ignore punctuation
      .replace(/\b(a|an|the)\b/g, '') // ignore articles safely
      .replace(/\s+/g, ''); // ignore all spaces properly
  };
  
  const expected = expectedPhrase.replace(/◯◯/g, targetWord);
  
  const normInput = normalize(input);
  const normExpected = normalize(expected);
  
  // Also just checking if the target word is in the input as a fallback for extreme tolerance
  const normTarget = normalize(targetWord);
  
  if (strict) return normInput === normExpected;   // I・it・is のような短い語は「含んでいれば正解」だと何でも通るので、文ごと合わせる
  return normInput === normExpected || (normInput.includes(normTarget) && normInput.length > normTarget.length);
};

export const QAMode: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const decodedCategory = decodeURIComponent(category || '');
  const { speak } = useSpeechSynthesis();
  const { isRecording, transcript, startListening, stopListening, setTranscript } = useSpeechRecognition();
  const { addPoints } = usePoints();
  const { saveProgress } = useDictionaryProgress();
  const vocabulary = useVocabulary();

  const words = React.useMemo(() => vocabulary.filter(v => v.category === decodedCategory && v.keyPhrase), [decodedCategory, vocabulary]);

  const [difficulty, setDifficulty] = useState<'select' | 'voice' | 'typing'>('select');
  const [targetWord, setTargetWord] = useState<Vocabulary | null>(null);
  const [shuffledWords, setShuffledWords] = useState<Vocabulary[]>([]);
  
  const [questionCount, setQuestionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  
  const [typingInput, setTypingInput] = useState('');
  const [showAnswerState, setShowAnswerState] = useState(false);
  const [showCorrectMark, setShowCorrectMark] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showFailure, setShowFailure] = useState(false);
  const [choiceError, setChoiceError] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);

  const DEFAULT_TOTAL_QUESTIONS = 5;
  const TOTAL_QUESTIONS = words.length > 0 ? Math.min(DEFAULT_TOTAL_QUESTIONS, words.length) : DEFAULT_TOTAL_QUESTIONS;
  const PASS_MARK = Math.max(1, Math.floor(TOTAL_QUESTIONS * 0.8));

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
    setTranscript('');
    
    setTimeout(() => {
      { const q = getQuestionForPhrase(target.keyPhrase, target.category, target.english); if (!isJapanesePrompt(q)) speak(q); }
    }, 500);
  }, [speak, setTranscript]);

  useEffect(() => {
    if (difficulty !== 'select' && shuffledWords.length > 0 && questionCount === 0 && !targetWord && !showCelebration && !showFailure) {
      generateQuestion(0, shuffledWords);
    }
  }, [difficulty, shuffledWords, questionCount, targetWord, showCelebration, showFailure, generateQuestion]);

  // Voice checking
  useEffect(() => {
    if (difficulty === 'voice' && transcript && targetWord && !showAnswerState && !showCorrectMark) {
      if (checkAnswer(transcript, targetWord.keyPhrase, targetWord.english, targetWord.category === '文をつくることば')) {
        stopListening();
        handleCorrectAnswer();
      } else if (transcript.length > 5) {
        // If they said something but it's wrong, we can just treat it as a mistake if it's long enough
        // but it's safer to wait for them to finish, or manually trigger mistake if they stop.
      }
    }
  }, [transcript, difficulty, targetWord, showAnswerState, showCorrectMark, stopListening]);

  const moveToNextQuestion = (nextQC: number) => {
    generateQuestion(nextQC, shuffledWords);
  };

  const proceedToNextTurn = (isCorrect: boolean) => {
    const newQC = questionCount + 1;
    const newCC = isCorrect ? correctCount + 1 : correctCount;
    
    setQuestionCount(newQC);
    setCorrectCount(newCC);
    setMistakes(0);
    setTranscript('');
    setTypingInput('');

    if (newQC >= TOTAL_QUESTIONS) {
      if (newCC >= PASS_MARK) {
        const savePoints = async () => {
          const pts = await addPoints(`dict_qa_${decodedCategory}`, {
            isPerfect: newCC === TOTAL_QUESTIONS,
            multiplier: TOTAL_QUESTIONS / DEFAULT_TOTAL_QUESTIONS
          });
          setEarnedPoints(pts);
        };
        savePoints();
        saveProgress(decodedCategory, { qa: true });   // 単元一覧に❓の印がつく
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
    }, 1000);
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
      }, 3000);
    }
  };

  const handleTypingSubmit = () => {
    if (showAnswerState || !targetWord) return;
    if (!typingInput.trim()) return;

    if (checkAnswer(typingInput, targetWord.keyPhrase, targetWord.english, targetWord.category === '文をつくることば')) {
      handleCorrectAnswer();
    } else {
      handleMistake();
    }
  };

  const handleVoiceSkip = () => {
    // If they can't get it right by voice, let them skip/fail
    stopListening();
    handleMistake();
    handleMistake(); // fail immediately
  };

  const resetSession = () => {
    setQuestionCount(0);
    setCorrectCount(0);
    setMistakes(0);
    setShowAnswerState(false);
    setShowCelebration(false);
    setShowFailure(false);
    setEarnedPoints(null);
    const newShuffled = [...words].sort(() => 0.5 - Math.random());
    setShuffledWords(newShuffled);
    setDifficulty('select');
  };

  if (words.length === 0) {
    return (
      <div className="flex-col flex-center gap-lg">
        <h1>このカテゴリにはQAがありません</h1>
        <Button onClick={() => navigate(`/dictionary/${category}`)}>もどる</Button>
      </div>
    );
  }

  if (showCelebration) {
    return (
      <div className="flex-col flex-center gap-lg" style={{ height: '100%', textAlign: 'center' }}>
        <h1 className="text-primary" style={{ fontSize: '3rem' }}>ステージクリア！</h1>
        <div className="animate-float">
          <Trophy size={100} color="var(--color-accent)" />
        </div>
        {earnedPoints !== null && (
          <div className="animate-pop" style={{ fontSize: '2rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
            +{earnedPoints} ポイントゲット！✨
          </div>
        )}
        <p style={{ fontSize: '1.5rem' }}>{TOTAL_QUESTIONS}問中 <strong>{correctCount}</strong>問 正解！</p>
        <p style={{ fontSize: '1.5rem' }}>QAモードをクリアしたよ！</p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Button onClick={resetSession} variant="outline" icon={RefreshCw}>もう一度</Button>
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
        <h1 className="text-primary" style={{ fontSize: '2.5rem' }}>QAモード</h1>
        <p style={{ fontSize: '1.2rem', color: '#666' }}>答え方を選んでね！</p>
        
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem', maxWidth: '800px', width: '100%' }}>
          <div 
            className="glass-card flex-col flex-center animate-pop"
            style={{ padding: '3rem 2rem', cursor: 'pointer', background: 'rgba(29, 209, 161, 0.2)' }}
            onClick={() => setDifficulty('voice')}
          >
            <Mic size={64} color="var(--color-success)" style={{ marginBottom: '1rem' }} />
            <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '2rem' }}>マイクで答える</h2>
          </div>

          <div 
            className="glass-card flex-col flex-center animate-pop"
            style={{ padding: '3rem 2rem', cursor: 'pointer', background: 'rgba(255, 107, 107, 0.2)' }}
            onClick={() => setDifficulty('typing')}
          >
            <Keyboard size={64} color="var(--color-error)" style={{ marginBottom: '1rem' }} />
            <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '2rem' }}>キーボードでうつ</h2>
          </div>
        </div>
        
        <Button onClick={() => navigate(`/dictionary/${category}`)} variant="outline" style={{ marginTop: '2rem' }}>
          もどる
        </Button>
      </div>
    );
  }

  if (!targetWord) return null;

  const questionText = getQuestionForPhrase(targetWord.keyPhrase, targetWord.category, targetWord.english);
  const expectedRaw = targetWord.keyPhrase.replace(/◯◯/g, targetWord.english);
  const expectedAnswer = expectedRaw.charAt(0).toUpperCase() + expectedRaw.slice(1);   // 「he is…」→「He is…」

  return (
    <div className="flex-col flex-center gap-lg" style={{ minHeight: '100%', width: '100%' }}>
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="outline" onClick={() => navigate(`/dictionary/${category}`)} icon={ArrowLeft}>
          もどる
        </Button>
        <h1 className="text-primary" style={{ fontSize: '2rem', margin: 0 }}>QAモード</h1>
        <div style={{ width: '100px' }} /> {/* Spacer */}
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

      <div className="flex-col flex-center gap-md" style={{ background: 'rgba(255,255,255,0.8)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '600px', border: '2px solid var(--color-primary)' }}>
        {!isJapanesePrompt(questionText) && (
          <Button 
            onClick={() => speak(questionText)} 
            icon={Volume2}
            variant="outline"
          >
            質問をきく
          </Button>
        )}
        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)', textAlign: 'center' }}>
          {questionText}
        </div>
        
        <div style={{ fontSize: '5rem', margin: '1rem 0' }}>{targetWord.emoji}</div>
        <div style={{ fontSize: '1.5rem', color: '#666' }}>{targetWord.japanese}</div>
      </div>

      <div style={{ minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%' }}>
        {showCorrectMark && (
          <div className="animate-pop" style={{ position: 'absolute', fontSize: '8rem', color: 'var(--color-success)', fontWeight: 'bold', zIndex: 10 }}>
            ◯
          </div>
        )}
        {showAnswerState && (
          <div className="animate-pop text-error flex-col flex-center" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>正解は:</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{expectedAnswer}</div>
          </div>
        )}
      </div>

      {!showAnswerState && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '1rem', width: '100%' }}>
          <div style={{ fontSize: '1.2rem', color: '#666', background: '#eee', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)' }}>
            ヒント: {targetWord.keyPhrase}
          </div>
          
          {difficulty === 'typing' ? (
            <>
              <input 
                type="text" 
                value={typingInput}
                onChange={(e) => setTypingInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTypingSubmit();
                }}
                placeholder="ここに入力してね"
                style={{ 
                  fontSize: '2rem', 
                  padding: '1rem 2rem', 
                  width: '100%', 
                  maxWidth: '500px',
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
              <div style={{ fontSize: '1.5rem', minHeight: '3rem', color: 'var(--color-primary)' }}>
                {transcript || '（マイクに向かって答えてね）'}
              </div>
              <Button 
                onClick={isRecording ? stopListening : startListening}
                style={{ 
                  background: isRecording ? 'var(--color-error)' : 'var(--color-success)',
                  padding: '1rem 3rem',
                  fontSize: '1.5rem',
                  animation: isRecording ? 'pulse 1.5s infinite' : 'none'
                }}
                icon={Mic}
              >
                {isRecording ? 'おわり' : 'はなす'}
              </Button>
              <Button onClick={handleVoiceSkip} variant="outline" style={{ marginTop: '1rem' }}>
                パスする
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
