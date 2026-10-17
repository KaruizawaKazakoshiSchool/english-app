import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { stages } from '../../data/stages';
import { useSafeBack } from '../../hooks/useSafeBack';
import { getPreferredVoice } from '../../lib/voice';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { MicButton } from '../ui/MicButton';
import { Button } from '../ui/Button';
import { ArrowLeft, Trophy, Star, Volume2, RefreshCw } from 'lucide-react';
import { usePoints } from '../../hooks/usePoints';
import { pushToSupabase } from '../../lib/sync';
import { TypingTrainer } from '../common/TypingTrainer';
import { useLockPause } from '../../lib/lockPause';

const phonicsEmojis: Record<string, string> = {
  A: '🍎', B: '🐻', C: '🐱', D: '🐶', E: '🐘', F: '🐸', G: '🦍', H: '🎩', I: '🧊', J: '🧃', K: '🐨', L: '🦁', M: '🐒', N: '🥜', O: '🐙', P: '🐷', Q: '👑', R: '🐰', S: '☀️', T: '🐯', U: '☂️', V: '🎻', W: '🍉', X: '❌', Y: '🛥️', Z: '🦓',
  cat: '🐱', dog: '🐶', pig: '🐷', bed: '🛏️', sun: '☀️', hat: '🎩', bat: '🦇', map: '🗺️', pin: '📍', lip: '👄', box: '📦', fox: '🦊', cup: '☕', bug: '🐛', net: '🕸️', red: '🔴',
  ship: '🚢', shop: '🏪', fish: '🐟', dish: '🍽️', star: '⭐', stop: '🛑', chop: '🔪', chin: '🧔', thin: '📏', math: '🔢', phone: '📱', whale: '🐳', duck: '🦆', ring: '💍', queen: '👑',
  cake: '🍰', make: '🛠️', take: '🤲', bike: '🚲', like: '👍', kite: '🪁', nose: '👃', rose: '🌹', cute: '🥰', mute: '🔇',
  rain: '🌧️', train: '🚂', tree: '🌳', see: '👀', boat: '⛵', coat: '🧥', meat: '🥩', seat: '💺',
  smile: '😊', snack: '🍪', black: '⬛', clock: '🕒', spoon: '🥄', park: '🏞️', short: '👖', girl: '👧', chair: '🪑', work: '💼', ear: '👂', bird: '🐦', car: '🚗',
  // Stage 7: 母音チーム その2
  play: '🎮', key: '🔑', pie: '🥧', tie: '👔', snow: '⛄', yellow: '🟡', blue: '🔵', suit: '🤵', juice: '🧃', fruit: '🍓',
  // Stage 8: 2文字の母音
  zoo: '🦁', moon: '🌙', book: '📖', mouth: '👄', house: '🏠', cloud: '☁️', coin: '🪙', toy: '🧸', boy: '👦', draw: '🎨', saw: '🪚',
  // Stage 9: 連続子音ブレンド①
  snake: '🐍', sky: '🌌', swim: '🏊', plane: '✈️', glass: '🥛', flower: '🌸', sleep: '😴',
  // Stage 10: 連続子音ブレンド②
  brush: '🪥', frog: '🐸', crab: '🦀', grape: '🍇', drum: '🥁', truck: '🚚', three: '3️⃣', spring: '🌱', strawberry: '🍓', dragon: '🐉', crown: '👑'
};

const LOCAL_PHONEMES = new Set([
  'a', 'b', 'c', 'k', 'ck', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'l', 'm', 'n', 'o', 'p', 'qu', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  'sh', 'ch', 'th', 'ph', 'wh', 'ng',
  'ee', 'ea', 'oo', 'a_e', 'ai', 'ay', 'o_e', 'oa', 'ow',
  'ar', 'or', 'ir', 'ur', 'er', 'ear', 'air', 'wor',
  // 新グループ：母音チーム・2文字母音・マジックE
  'e_e', 'i_e', 'u_e', 'ey', 'ie', 'ue', 'ui', 'ou', 'oi', 'oy', 'au', 'aw',
  // 新グループ：連続子音ブレンド
  'sm', 'sn', 'sk', 'sp', 'st', 'sw', 'bl', 'pl', 'cl', 'gl', 'fl', 'sl',
  'br', 'fr', 'cr', 'gr', 'dr', 'tr', 'thr', 'spr', 'str'
]);

const getLevenshteinDistance = (a: string, b: string): number => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

// 単語の中の「このステージで学ぶつづり」を色分けして強調する（例：brush の "br"）。
// graphemes はそのステージの practiceItems。連続つづりは最長一致、マジックE(a_e)は母音＋末尾eを強調。
const HL_STYLE: React.CSSProperties = { color: '#e8590c', fontWeight: 800 };
const highlightWord = (word: string, graphemes: string[] = []): React.ReactNode => {
  const lw = word.toLowerCase();
  // マジックE（a_e など）：母音 + 子音 + 末尾e の2か所を強調
  for (const g of graphemes) {
    if (!g.includes('_')) continue;
    const vi = lw.indexOf(g[0].toLowerCase());
    const ei = lw.lastIndexOf('e');
    if (vi >= 0 && ei > vi) {
      return word.split('').map((ch, i) =>
        (i === vi || i === ei)
          ? <span key={i} style={HL_STYLE}>{ch}</span>
          : <React.Fragment key={i}>{ch}</React.Fragment>
      );
    }
  }
  // 連続つづり（最長一致でひとかたまりを強調）
  let best: { idx: number; len: number } | null = null;
  for (const g of graphemes) {
    if (g.includes('_')) continue;
    const idx = lw.indexOf(g.toLowerCase());
    if (idx >= 0 && (!best || g.length > best.len)) best = { idx, len: g.length };
  }
  if (best) {
    return <>{word.slice(0, best.idx)}<span style={HL_STYLE}>{word.slice(best.idx, best.idx + best.len)}</span>{word.slice(best.idx + best.len)}</>;
  }
  return word;
};

export const Stage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const goBack = useSafeBack('/home?tab=phonics'); // 1つ上＝フォニックスのステージ一覧へ
  const stage = stages.find(s => s.id === parseInt(id || '1'));
  const nextStage = stage ? stages[stages.findIndex(s => s.id === stage.id) + 1] : undefined;
  
  const speak = useCallback((text: string) => {
    const ltext = text.toLowerCase();
    
    // Play authentic IPA audio if it's a known phoneme block.
    // BASE_URL を付けないと GitHub Pages（/english-app/）配下で404になり音が鳴らない。
    if (LOCAL_PHONEMES.has(ltext)) {
      const audio = new Audio(`${import.meta.env.BASE_URL}audio/${ltext}.mp3`);
      audio.play().catch(e => console.error("Audio play failed:", e));
      return;
    }

    // Fallback to TTS for full words or unknown texts
    const msg = new SpeechSynthesisUtterance();
    msg.text = text;
    msg.lang = 'en-US';
    msg.rate = 0.8;
    const voice = getPreferredVoice(); // クリアな英語ボイスに固定
    if (voice) msg.voice = voice;
    window.speechSynthesis.speak(msg);
  }, []);

  const { isRecording, transcript, error, startListening, stopListening, setTranscript } = useSpeechRecognition();
  const { addPoints } = usePoints();

  const [mode, setMode] = useState<'input' | 'choice' | 'typing' | 'typegame' | 'quiz' | 'lab' | 'blend' | 'alien' | 'story'>('input');
  
  const getCurrentItems = useCallback(() => {
    if (!stage) return [];
    if (mode === 'lab') return stage.labItems || [];
    if (mode === 'blend') return stage.blendItems || [];
    if (mode === 'alien') return stage.alienWords || [];
    if (mode === 'story') return stage.stories || [];
    return stage.items || [];
  }, [stage, mode]);

  const currentItems = getCurrentItems();
  const [quizIndexRaw, setQuizIndex] = useState(0);
  const quizIndex = currentItems.length > 0 ? Math.min(quizIndexRaw, currentItems.length - 1) : 0;
  
  // Game session states
  const [questionCount, setQuestionCount] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [showAnswerState, setShowAnswerState] = useState(false);
  const [labState, setLabState] = useState<'base' | 'added'>('base');
  const [alienInputBlocks, setAlienInputBlocks] = useState<string[]>([]);
  
  const [showCelebration, setShowCelebration] = useState(false);
  const [showFailure, setShowFailure] = useState(false);
  
  const [options, setOptions] = useState<string[]>([]);
  const [choiceError, setChoiceError] = useState(false);
  const [typingInput, setTypingInput] = useState('');

  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const lockPaused = useLockPause(setStartTime); // ロック中は時計を止める
  const [bestTime, setBestTime] = useState<{ name: string; time: number } | null>(null);
  const [newRecordMsg, setNewRecordMsg] = useState('');
  const [showCorrectMark, setShowCorrectMark] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  // フォニックスは「11ステージ×7モード」ぶんの初回20Pがあり、1日で取り放題になっていた。
  // 今日のミッションのあと、すぐフォニックスに流れるのを防ぐため、1日の加点回数に上限を置く。
  // 上限のあとも遊べる（バッジ・記録は残る）が、ポイントは翌日まで入らない。
  const PHONICS_DAILY_CAP = 3;
  const phonicsKey = () => `phonicsAwards_${localStorage.getItem('studentId')}_${new Date().toISOString().slice(0, 10)}`;
  const phonicsAwardsToday = () => Number(localStorage.getItem(phonicsKey())) || 0;
  const [capMsg, setCapMsg] = useState('');

  const checkIsCorrect = (input: string, target: string) => {
    const i = input.toLowerCase().trim();
    const t = target.toLowerCase().trim();
    if (i === t) return true;
    if ((t === 'c' && i === 'k') || (t === 'k' && i === 'c')) return true;
    return false;
  };

  // Generate options for choice mode
  const generateOptions = useCallback((currentIndex: number) => {
    if (!stage) return;
    
    let target = '';
    let allItems: string[] = [];
    
    if (mode === 'blend' && stage.blendItems) {
      target = stage.blendItems[currentIndex].word;
      allItems = stages.flatMap(s => s.blendItems?.map(b => b.word) || []);
    } else {
      const items = getCurrentItems() as string[];
      target = items[currentIndex];
      allItems = stages.flatMap(s => s.items);
    }

    if (!target) return;

    const others = allItems.filter(item => {
      if (item === target) return false;
      const i = item.toLowerCase();
      const t = target.toLowerCase();
      if ((t === 'c' && i === 'k') || (t === 'k' && i === 'c')) return false;
      return true;
    });
    
    const sortedOthers = [...others].sort((a, b) => {
      const distA = getLevenshteinDistance(target, a);
      const distB = getLevenshteinDistance(target, b);
      if (distA === distB) return Math.random() - 0.5;
      return distA - distB;
    });
    
    const distractors = sortedOthers.slice(0, 2);
    const newOptions = [target, ...distractors].sort(() => 0.5 - Math.random());
    setOptions(newOptions);
  }, [stage, mode, getCurrentItems]);

  const getAlienWordBlocks = useCallback((word: string) => {
    if (!stage) return word.split('');
    const practice = stage.practiceItems || [];
    let blocks: string[] = [];
    let i = 0;
    while (i < word.length) {
      // Also check standard consonant digraphs just in case
      const commonDigraphs = ['sh', 'ch', 'th', 'ph', 'wh', 'ck', 'ng', ...practice];
      let found = false;
      for (const p of commonDigraphs) {
        if (word.startsWith(p, i)) {
          blocks.push(p);
          i += p.length;
          found = true;
          break;
        }
      }
      if (!found) {
        blocks.push(word[i]);
        i++;
      }
    }
    return blocks;
  }, [stage]);

  useEffect(() => {
    if (mode === 'choice') {
      generateOptions(quizIndex);
    }
  }, [mode, quizIndex, generateOptions]);

  useEffect(() => {
    if (stage) {
      const recordKey = `global_record_stage_${stage.id}_${mode}`;
      const recordStr = localStorage.getItem(recordKey);
      if (recordStr) {
        setBestTime(JSON.parse(recordStr));
      } else {
        setBestTime(null);
      }
    }
  }, [stage?.id, mode]);

  // Auto-play audio when question changes
  useEffect(() => {
    if (['choice', 'typing', 'quiz'].includes(mode) && !showCelebration && !showFailure && !showAnswerState && !showCorrectMark && stage) {
      // Small delay to ensure smooth transition
      const timer = setTimeout(() => {
        if (mode === 'blend' && stage.blendItems) {
          // Play sequentially
          stage.blendItems[quizIndex].phonemes.forEach((p, i) => {
            setTimeout(() => speak(p), i * 1000);
          });
        } else if (['choice', 'typing', 'quiz', 'alien', 'story'].includes(mode)) {
          const items = getCurrentItems();
          if (typeof items[quizIndex] === 'string') {
             speak(items[quizIndex] as string);
          }
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [quizIndex, mode, showCelebration, showFailure, showAnswerState, showCorrectMark, stage, speak]);

  // Live timer
  useEffect(() => {
    if (!lockPaused && startTime && !showCelebration && !showFailure && ['choice', 'typing'].includes(mode)) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [startTime, showCelebration, showFailure, mode, lockPaused]);

  useEffect(() => {
    if (['quiz', 'story'].includes(mode) && transcript) {
      let targetWord = '';
      if (mode === 'quiz') targetWord = stage?.items[quizIndex]?.toLowerCase() || '';
      else if (mode === 'story') targetWord = stage?.stories?.[quizIndex]?.toLowerCase() || '';
      
      const normInput = transcript.toLowerCase().replace(/[.,!?'" ]/g, '').trim();
      const normTarget = targetWord.toLowerCase().replace(/[.,!?'" ]/g, '').trim();
      
      if (mode === 'story') {
        // Must speak at least 80% of the target length to prevent early progression
        if (normInput.length >= normTarget.length * 0.8) {
          const isClose = getLevenshteinDistance(normInput, normTarget) <= Math.max(2, normTarget.length * 0.15);
          if (normInput === normTarget || isClose) {
            handleCorrectAnswer();
          }
        }
      } else {
        if (normInput === normTarget || normInput.includes(normTarget)) {
          handleCorrectAnswer();
        }
      }
    }
  }, [transcript, mode, quizIndex, stage]);

  const DEFAULT_TOTAL_QUESTIONS = 10;
  const TOTAL_QUESTIONS = currentItems.length > 0 ? Math.min(DEFAULT_TOTAL_QUESTIONS, currentItems.length) : 0;
  const PASS_MARK = Math.max(1, Math.floor(TOTAL_QUESTIONS * 0.8));

  const moveToNextQuestion = () => {
    setQuizIndex((prev) => {
      if (currentItems.length <= 1) return 0;
      // For lab and story, sequential makes more sense. For others, random.
      if (mode === 'lab' || mode === 'story') {
        return (prev + 1) % currentItems.length;
      }
      let next = Math.floor(Math.random() * currentItems.length);
      while (next === prev) {
        next = Math.floor(Math.random() * currentItems.length);
      }
      return next;
    });
    setTypingInput('');
    setTranscript('');
    setLabState('base');
    setAlienInputBlocks([]);
  };

  const proceedToNextTurn = async (isCorrect: boolean) => {
    const newQC = questionCount + 1;
    const newCC = isCorrect ? correctCount + 1 : correctCount;
    
    setQuestionCount(newQC);
    setCorrectCount(newCC);
    setMistakes(0);

    if (newQC >= TOTAL_QUESTIONS) {
      if (newCC >= PASS_MARK) {
        saveBadge(stage!.id);

        let isNewBest = false;
        if (newCC === TOTAL_QUESTIONS && ['choice', 'typing'].includes(mode) && startTime) {
          const timeTaken = Date.now() - startTime;
          const recordKey = `global_record_stage_${stage!.id}_${mode}`;
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

        setCapMsg('');
        if (phonicsAwardsToday() >= PHONICS_DAILY_CAP) {
          // 今日のぶんは打ち止め。ポイントは出さないが、クリアの記録は必ず残す。
          // （ここで何もしないと addPoints が走らず、サーバへの送信も起きない）
          setEarnedPoints(0);
          setCapMsg(`今日のフォニックスのポイントは ここまで（1日${PHONICS_DAILY_CAP}回）。ほかの活動も やってみよう！ あしたまた もらえるよ`);
          const sid = localStorage.getItem('studentId');
          if (sid) pushToSupabase(sid);
        } else {
          const pts = await addPoints(`stage_${id}_${mode}`, {
            isPerfect: newCC === TOTAL_QUESTIONS,
            isNewRecord: isNewBest,
            multiplier: TOTAL_QUESTIONS / DEFAULT_TOTAL_QUESTIONS
          });
          setEarnedPoints(pts);
          if (pts > 0) {
            const n = phonicsAwardsToday() + 1;
            localStorage.setItem(phonicsKey(), String(n));
            if (n >= PHONICS_DAILY_CAP) setCapMsg(`フォニックスのポイントは 今日はこれで${PHONICS_DAILY_CAP}回目（今日はここまで）。ほかの活動も やってみよう！`);
          }
        }

        setShowCelebration(true);
      } else {
        setShowFailure(true);
      }
    } else {
      moveToNextQuestion();
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

  const handleOptionClick = (option: string) => {
    if (showAnswerState) return;
    const target = mode === 'blend' && stage?.blendItems ? stage.blendItems[quizIndex].word : stage!.items[quizIndex];
    if (checkIsCorrect(option, target)) {
      handleCorrectAnswer();
    } else {
      handleMistake();
    }
  };

  const handleTypingSubmit = () => {
    if (showAnswerState) return;
    if (!typingInput) return;
    
    if (checkIsCorrect(typingInput, stage!.items[quizIndex])) {
      handleCorrectAnswer();
    } else {
      handleMistake();
    }
  };

  const resetSession = () => {
    setQuestionCount(0);
    setCorrectCount(0);
    setMistakes(0);
    setShowAnswerState(false);
    setShowCelebration(false);
    setShowFailure(false);
    setTranscript('');
    setTypingInput('');
    setNewRecordMsg('');
    setEarnedPoints(null);
    setElapsedTime(0);
    setAlienInputBlocks([]);
    setStartTime(Date.now());
    moveToNextQuestion();
  };

  // バッジを保存する。
  // ★localStorageに書くだけでなく、その場でSupabaseにも送ること。
  //   以前は書くだけだったため、サーバに届くのは「ホームに戻ったとき」
  //   （Home.tsx のpush）まで遅れていた。ホームに寄らずに端末を閉じたり、
  //   別の端末で開いたりすると記録が無いように見える＝子どもからの
  //   「一回ホームに戻ってまた入んないと記録ができてない」の正体。
  const saveBadge = (stageId: number) => {
    const studentId = localStorage.getItem('studentId');
    if (!studentId) return;
    const dataStr = localStorage.getItem(`student_${studentId}`);
    if (!dataStr) return;
    const data = JSON.parse(dataStr);
    if (!Array.isArray(data.badges)) data.badges = [];
    if (data.badges.includes(stageId)) return;
    data.badges.push(stageId);
    localStorage.setItem(`student_${studentId}`, JSON.stringify(data));
    pushToSupabase(studentId);
  };

  if (!stage) return <div>Stage not found</div>;

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
        {earnedPoints !== null && earnedPoints > 0 && (
          <div className="animate-pop" style={{ fontSize: '2rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
            +{earnedPoints} ポイントゲット！✨
          </div>
        )}
        {capMsg && (
          <div style={{ fontSize: '1.05rem', color: '#7a5a00', background: 'rgba(253,203,110,0.3)', border: '2px solid var(--color-accent)', borderRadius: '14px', padding: '0.6rem 1.2rem', maxWidth: '520px' }}>
            🌙 {capMsg}
          </div>
        )}
        <p style={{ fontSize: '1.5rem' }}>{TOTAL_QUESTIONS}問中 <strong>{correctCount}</strong>問 正解！</p>
        <p style={{ fontSize: '1.5rem' }}><strong>{stage.badgeName}</strong> バッジをゲットしたよ！</p>
        {/* 次のステージ・ステージ一覧へも行けるように（子どもの声 2026-10-17「もう一度プレイとホームに戻るしかない」） */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {nextStage && (
            <Button onClick={() => navigate(`/stage/${nextStage.id}`)}>次のステージへ ▶</Button>
          )}
          <Button onClick={resetSession} variant="outline">もう一度プレイ</Button>
          <Button onClick={() => navigate('/home?tab=phonics')} variant="outline">ステージ一覧</Button>
          <Button onClick={() => navigate('/home')} variant="outline">ホームにもどる</Button>
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
          <Button onClick={() => navigate('/home?tab=phonics')} variant="outline">ステージ一覧</Button>
          <Button onClick={() => navigate('/home')} variant="outline">ホームにもどる</Button>
        </div>
      </div>
    );
  }

  const renderStars = () => (
    <>
      {['choice', 'typing'].includes(mode) && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)', fontFamily: 'monospace' }}>
            ⏱️ {(elapsedTime / 1000).toFixed(1)}秒
          </div>
          <div style={{ textAlign: 'center', animation: 'float 3s infinite' }}>
            {bestTime ? (
              <span className="badge" style={{ background: 'var(--color-accent)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', color: '#000', fontWeight: 'bold' }}>
                👑 最速記録 ({mode === 'choice' ? 'えらぶ' : 'タイピング'}): {bestTime.name}さん {(bestTime.time / 1000).toFixed(1)}秒
              </span>
            ) : (
              <span className="badge" style={{ background: '#eee', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)', color: '#888' }}>
                👑 最速記録 ({mode === 'choice' ? 'えらぶ' : 'タイピング'}): まだいないよ！最初のチャンピオンになろう！
              </span>
            )}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1rem' }}>
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
    </>
  );

  return (
    <div className="flex-col gap-lg" style={{ flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Button variant="outline" onClick={goBack} icon={ArrowLeft}>
            もどる
          </Button>
          <h1 className="text-primary" style={{ flex: 1, textAlign: 'center', margin: 0 }}>{stage.title}</h1>
          <div style={{ width: '110px', flexShrink: 0 }} aria-hidden="true" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button variant={mode === 'input' ? 'primary' : 'outline'} onClick={() => { setMode('input'); resetSession(); }}>きく</Button>
            <Button variant={mode === 'choice' ? 'primary' : 'outline'} onClick={() => { setMode('choice'); resetSession(); }}>えらぶ</Button>
            <Button variant={mode === 'typing' ? 'primary' : 'outline'} onClick={() => { setMode('typing'); resetSession(); }}>🎧 聞いてタイプ</Button>
            <Button variant={mode === 'typegame' ? 'primary' : 'outline'} onClick={() => { setMode('typegame'); resetSession(); }}>⌨️ タイピング練習</Button>
            {stage.id !== 1 && <Button variant={mode === 'quiz' ? 'secondary' : 'outline'} onClick={() => { setMode('quiz'); resetSession(); }}>マイク</Button>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', borderTop: '1px dashed #ccc', paddingTop: '0.5rem' }}>
            {stage.labItems && <Button variant={mode === 'lab' ? 'primary' : 'outline'} onClick={() => { setMode('lab'); resetSession(); }}>🔬 ラボ</Button>}
            {stage.stories && <Button variant={mode === 'story' ? 'primary' : 'outline'} onClick={() => { setMode('story'); resetSession(); }}>📖 絵本</Button>}
          </div>
        </div>
      </div>

      <div className={`glass-card flex-col flex-center ${stage.colorClass}`} style={{ flex: 1, gap: '1rem' }}>
        {stage.explanation && (
          <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.8)' }}>
            <p style={{ fontSize: '1.1rem', margin: 0, color: 'var(--color-primary)' }}>💡 {stage.explanation}</p>
          </div>
        )}

        {mode === 'input' && (
          <>
            {stage.practiceItems && !stage.hideListenPractice && (
              <div style={{ width: '100%', maxWidth: '600px', marginBottom: '1rem', background: 'rgba(255,255,255,0.5)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
                <p style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>🎧 練習コーナー (音だけをきこう)</p>
                <div className="badge-grid">
                  {stage.practiceItems.map((item, idx) => (
                    <div
                      key={`prac-${idx}`}
                      className="stage-tile hover-scale"
                      onClick={() => speak(item)}
                      style={{ padding: '0.5rem', fontSize: '1.5rem', minHeight: '60px', minWidth: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                    >
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: '1.2rem' }}>カードをタップして単語の音をきこう</p>
            {stage.hideListenPractice && (
              <p style={{ fontSize: '0.95rem', color: 'var(--color-text-muted)', marginTop: '-0.5rem' }}>
                色がついたところが、このステージで学ぶ音だよ
              </p>
            )}
            <div className="badge-grid" style={{ width: '100%', maxWidth: '600px' }}>
              {stage.items.map((item, idx) => (
                <div
                  key={idx}
                  className="stage-tile hover-scale"
                  onClick={() => speak(item)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  {phonicsEmojis[item] && <span style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{phonicsEmojis[item]}</span>}
                  <span>{highlightWord(item, stage.practiceItems)}</span>
                </div>
              ))}
            </div>
          </>
        )}
        
        {mode === 'typegame' && (
          <TypingTrainer
            words={stage.items.map((w) => ({ text: w, emoji: phonicsEmojis[w] }))}
            speakWord={speak}
          />
        )}

        {mode === 'choice' && (
          <>
            <p style={{ fontSize: '1.2rem' }}>音を聞いて、正しいものを選ぼう！</p>
            {renderStars()}

            <Button 
              onClick={() => speak(stage.items[quizIndex])} 
              icon={Volume2}
              style={{ fontSize: '1.5rem', padding: '1rem 3rem', background: 'var(--color-accent)', color: '#000' }}
            >
              音をきく
            </Button>
            
            <div style={{ minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {showCorrectMark && (
                <div className="animate-pop" style={{ position: 'absolute', fontSize: '8rem', color: 'var(--color-success)', fontWeight: 'bold', zIndex: 10 }}>
                  ◯
                </div>
              )}
              {showAnswerState && (
                <div className="animate-pop text-error" style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center' }}>
                  正解は: {stage.items[quizIndex]} {phonicsEmojis[stage.items[quizIndex]] || ''}
                </div>
              )}
            </div>
            
            {!showAnswerState && (
              <div className="badge-grid" style={{ width: '100%', maxWidth: '600px' }}>
                {options.map((option, idx) => (
                  <button
                    key={idx}
                    className="btn btn-secondary hover-scale"
                    style={{ 
                      padding: '1rem', 
                      fontSize: '1.8rem', 
                      fontFamily: 'var(--font-heading)',
                      background: choiceError ? 'var(--color-error)' : 'var(--color-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      opacity: mistakes >= 1 && !checkIsCorrect(option, stage.items[quizIndex]) ? 0.5 : 1
                    }}
                    onClick={() => handleOptionClick(option)}
                  >
                    {/* Show emoji ONLY if mistakes >= 1 OR if it's not the target word? 
                        Wait, the prompt says initially NO emoji. So only show emoji if mistakes >= 1.
                    */}
                    {mistakes >= 1 && phonicsEmojis[option] && (
                      <span className="animate-pop" style={{ fontSize: '2.5rem' }}>{phonicsEmojis[option]}</span>
                    )}
                    <span>{option}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {mode === 'typing' && (
          <>
            <p style={{ fontSize: '1.2rem' }}>音を聞いて、タイピングしよう！</p>
            {renderStars()}

            <Button 
              onClick={() => speak(stage.items[quizIndex])} 
              icon={Volume2}
              style={{ fontSize: '1.5rem', padding: '1rem 3rem', background: 'var(--color-accent)', color: '#000' }}
            >
              音をきく
            </Button>
            
            <div style={{ minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {showCorrectMark && (
                <div className="animate-pop" style={{ position: 'absolute', fontSize: '8rem', color: 'var(--color-success)', fontWeight: 'bold', zIndex: 10 }}>
                  ◯
                </div>
              )}
              {showAnswerState && (
                <div className="animate-pop text-error" style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center' }}>
                  正解は: {stage.items[quizIndex]}
                </div>
              )}
            </div>
            
            {!showAnswerState && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                {mistakes >= 1 && phonicsEmojis[stage.items[quizIndex]] && (
                  <div style={{ fontSize: '5rem', animation: 'pop 0.3s ease-out' }}>
                    {phonicsEmojis[stage.items[quizIndex]]}
                  </div>
                )}
                <input 
                  type="text" 
                  value={typingInput}
                  onChange={(e) => setTypingInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTypingSubmit();
                  }}
                  style={{ 
                    fontSize: '2rem', 
                    padding: '1rem', 
                    width: '300px', 
                    textAlign: 'center', 
                    borderRadius: 'var(--radius-sm)',
                    border: choiceError ? '2px solid var(--color-error)' : '2px solid var(--color-primary)' 
                  }}
                  autoFocus
                />
                <Button onClick={handleTypingSubmit}>
                  答える
                </Button>
              </div>
            )}
          </>
        )}

        {mode === 'quiz' && stage.id !== 1 && (
          <>
            <p style={{ fontSize: '1.2rem' }}>マイクをタップして発音しよう！</p>
            {renderStars()}
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              {phonicsEmojis[stage.items[quizIndex]] && (
                <div style={{ fontSize: '4rem', animation: 'pop 0.3s ease-out' }}>
                  {phonicsEmojis[stage.items[quizIndex]]}
                </div>
              )}
              <div style={{ fontSize: '4rem', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)' }}>
                {stage.items[quizIndex]}
              </div>
            </div>
            
            <div style={{ minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {showCorrectMark && (
                <div className="animate-pop" style={{ position: 'absolute', fontSize: '8rem', color: 'var(--color-success)', fontWeight: 'bold', zIndex: 10 }}>
                  ◯
                </div>
              )}
            </div>
            
            <MicButton 
              isRecording={isRecording} 
              onClick={isRecording ? stopListening : startListening} 
            />

            {transcript && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.05)', borderRadius: 'var(--radius-sm)' }}>
                あなたの発音: <strong>{transcript}</strong>
              </div>
            )}
            
            {error && (
              <div className="text-error" style={{ marginTop: '1rem' }}>
                {error}
              </div>
            )}
          </>
        )}
        {mode === 'lab' && stage.labItems && (
          <div className="flex-col flex-center gap-lg" style={{ padding: '2rem' }}>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>魔法の文字をくっつけてみよう！</p>
            {renderStars()}
            <p style={{ color: '#666' }}>{stage.labItems[quizIndex].description}</p>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', fontSize: '5rem', fontFamily: 'var(--font-heading)' }}>
               <div className="hover-scale" onClick={() => speak(stage.labItems![quizIndex].base)} style={{ cursor: 'pointer', padding: '1rem', background: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-sm)' }}>
                  {stage.labItems[quizIndex].base}
               </div>
               <div style={{ fontSize: '3rem', color: '#888' }}>+</div>
               <div 
                  className="hover-scale" 
                  style={{ background: 'var(--color-accent)', padding: '1rem 2rem', borderRadius: '16px', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
                  onClick={() => {
                     speak(stage.labItems![quizIndex].result);
                     setLabState('added');
                     setTimeout(() => {
                       handleCorrectAnswer();
                     }, 3000);
                  }}
               >
                  {stage.labItems[quizIndex].added}
               </div>
            </div>
            
            {labState === 'added' && (
               <div className="animate-pop text-primary" style={{ fontSize: '6rem', fontWeight: 'bold', marginTop: '2rem', color: 'var(--color-success)' }}>
                  ✨ {stage.labItems[quizIndex].result} ✨
               </div>
            )}
            
            {labState === 'base' && (
               <p className="animate-pulse" style={{ marginTop: '2rem', color: 'var(--color-primary)' }}>右側のボタンをタップして合体！</p>
            )}
          </div>
        )}

        {mode === 'blend' && stage.blendItems && (
          <div className="flex-col flex-center gap-lg" style={{ padding: '1rem', width: '100%' }}>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>バラバラの音をくっつけると、どんな単語になるかな？</p>
            {renderStars()}
            
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2rem' }}>
               {stage.blendItems[quizIndex].phonemes.map((p, i) => (
                  <Button key={i} onClick={() => speak(p)} variant="outline" style={{ fontSize: '2.5rem', padding: '1.5rem', borderRadius: '50%' }}>
                    🔈
                  </Button>
               ))}
            </div>
            
            <Button size="lg" icon={Volume2} onClick={() => {
                 stage.blendItems![quizIndex].phonemes.forEach((p, i) => {
                   setTimeout(() => speak(p), i * 1000);
                 });
            }} style={{ marginBottom: '2rem' }}>
               順番に全部聞く
            </Button>
            
            <div style={{ minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {showCorrectMark && (
                <div className="animate-pop" style={{ position: 'absolute', fontSize: '8rem', color: 'var(--color-success)', fontWeight: 'bold', zIndex: 10 }}>
                  ◯
                </div>
              )}
            </div>

            <div className="badge-grid" style={{ width: '100%', maxWidth: '600px' }}>
               {options.map((opt, i) => (
                 <button key={i} className="btn btn-secondary hover-scale" style={{ padding: '1.5rem', fontSize: '2rem', fontFamily: 'var(--font-heading)' }} onClick={() => handleOptionClick(opt)}>
                   {opt}
                 </button>
               ))}
            </div>
          </div>
        )}

        {mode === 'alien' && stage.alienWords && (
          <div className="flex-col flex-center gap-lg">
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>音を聞いて、宇宙人の言葉をつづってみよう！</p>
            {renderStars()}
            
            <div style={{ fontSize: '6rem', animation: 'float 3s infinite' }}>👽</div>
            
            <Button size="lg" icon={Volume2} onClick={() => speak(stage.alienWords![quizIndex])} style={{ background: 'var(--color-accent)', color: 'black' }}>
              宇宙人の声を聞く
            </Button>
            
            {(() => {
              const targetBlocks = getAlienWordBlocks(stage.alienWords[quizIndex]);
              const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
              const extraBlocks = stage.practiceItems || [];
              const allPossibleBlocks = Array.from(new Set([...alphabet, ...extraBlocks, ...targetBlocks]));
              // Generate some options: the required blocks + random distractors
              const optionsBlocks = [...targetBlocks];
              while (optionsBlocks.length < 10) {
                 const rand = allPossibleBlocks[Math.floor(Math.random() * allPossibleBlocks.length)];
                 if (!optionsBlocks.includes(rand)) optionsBlocks.push(rand);
              }
              const displayOptions = [...new Set(optionsBlocks)].sort(() => 0.5 - Math.random());

              return (
                <>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', minHeight: '60px' }}>
                    {targetBlocks.map((_, idx) => (
                      <div key={idx} style={{ 
                        width: '60px', height: '60px', borderBottom: '4px solid var(--color-primary)', 
                        fontSize: '3rem', fontFamily: 'var(--font-heading)', color: 'var(--color-primary)',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
                      }}>
                        {alienInputBlocks[idx] || ''}
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', maxWidth: '500px', justifyContent: 'center', marginTop: '2rem' }}>
                    {displayOptions.map(block => (
                      <button key={block} className="btn btn-outline hover-scale" style={{ fontSize: '1.5rem', padding: '0.5rem 1rem', background: 'white' }} onClick={() => {
                        if (alienInputBlocks.length >= targetBlocks.length) return;
                        const newBlocks = [...alienInputBlocks, block];
                        setAlienInputBlocks(newBlocks);
                        
                        if (newBlocks.join('') === targetBlocks.join('')) {
                          handleCorrectAnswer();
                        } else if (newBlocks.length === targetBlocks.length) {
                          handleMistake();
                          setTimeout(() => setAlienInputBlocks([]), 1000);
                        }
                      }}>
                        {block}
                      </button>
                    ))}
                    <Button variant="secondary" onClick={() => setAlienInputBlocks(prev => prev.slice(0, -1))} style={{ padding: '0.5rem 1rem' }}>
                      消す
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {mode === 'story' && stage.stories && (
          <div className="flex-col flex-center gap-lg" style={{ width: '100%' }}>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>絵本を音読してみよう！</p>
            {renderStars()}
            
            <div style={{ width: '100%', maxWidth: '700px', fontSize: '2.5rem', fontFamily: 'var(--font-heading)', color: '#333', textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', margin: '1rem 0', lineHeight: '1.5' }}>
              {stage.stories[quizIndex]}
            </div>
            
            <div style={{ minHeight: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {showCorrectMark && (
                <div className="animate-pop" style={{ position: 'absolute', fontSize: '8rem', color: 'var(--color-success)', fontWeight: 'bold', zIndex: 10 }}>
                  ◯
                </div>
              )}
            </div>

            <MicButton isRecording={isRecording} onClick={isRecording ? stopListening : startListening} />
            
            {transcript && (
              <div className="animate-pop" style={{ marginTop: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '12px', border: '1px solid var(--color-success)', textAlign: 'center' }}>
                あなたの声: <strong>{transcript}</strong>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <Button variant="outline" icon={Volume2} onClick={() => speak(stage.stories![quizIndex])}>お手本を聞く</Button>
              <Button onClick={() => handleCorrectAnswer()}>OKにする</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
