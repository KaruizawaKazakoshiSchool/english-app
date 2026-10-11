import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSafeBack } from '../../../hooks/useSafeBack';
import { useVocabulary } from '../../../hooks/useVocabulary';
import { Button } from '../../ui/Button';
import { ArrowLeft, Trophy, RefreshCw, Volume2 } from 'lucide-react';
import { useSpeechSynthesis } from '../../../hooks/useSpeechSynthesis';
import { usePoints } from '../../../hooks/usePoints';
import { useDictionaryProgress } from '../../../hooks/useDictionaryProgress';
import { useLeaderboard } from '../../../hooks/useLeaderboard';
import { Timer, Crown } from 'lucide-react';
import { useLockPause } from '../../../lib/lockPause';

// --- Logic to Generate the Word Search Grid ---
// 盤の大きさ。ふつうは8マスだが、「年中行事」のように長い語が多い単元では
// 語が入りきらず出題できなくなるため、いちばん長い語に合わせて最大12マスまで広げる。
const GRID_MIN = 8;
const GRID_MAX = 12;
const DIRS = [
  { dr: 0, dc: 1 }, // Horizontal right
  { dr: 1, dc: 0 }  // Vertical down
];

interface CellInfo {
  letter: string;
  isTarget: boolean;
}

interface WordLocation {
  word: string;
  startR: number;
  startC: number;
  endR: number;
  endC: number;
}

// 1回分の盤を作る。長い語から置き、はみ出さない開始位置だけを試す。置けなかった語があれば null。
const tryPlace = (words: string[], size: number) => {
  const grid: string[][] = Array(size).fill(null).map(() => Array(size).fill(''));
  const locations: WordLocation[] = [];
  const sorted = words
    .map(word => word.toUpperCase().replace(/[^A-Z0-9]/g, '')) // 記号・空白は詰めて1マス1文字にする
    .sort((x, y) => y.length - x.length);

  for (const w of sorted) {
    let placed = false;
    for (let attempts = 0; !placed && attempts < 300; attempts++) {
      const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
      const maxR = size - 1 - dir.dr * (w.length - 1);
      const maxC = size - 1 - dir.dc * (w.length - 1);
      if (maxR < 0 || maxC < 0) break;
      const startR = Math.floor(Math.random() * (maxR + 1));
      const startC = Math.floor(Math.random() * (maxC + 1));
      let clear = true;
      for (let i = 0; i < w.length; i++) {
        const cell = grid[startR + dir.dr * i][startC + dir.dc * i];
        if (cell !== '' && cell !== w[i]) { clear = false; break; }
      }
      if (!clear) continue;
      for (let i = 0; i < w.length; i++) grid[startR + dir.dr * i][startC + dir.dc * i] = w[i];
      locations.push({ word: w, startR, startC, endR: startR + dir.dr * (w.length - 1), endC: startC + dir.dc * (w.length - 1) });
      placed = true;
    }
    if (!placed) return null;
  }
  return { grid, locations };
};

// 全部の語が置けた盤だけを使う（以前は12文字の SEEREDLEAVES などが置けずに、一覧にだけ残ることがあった）。
// 何回やっても置けない組み合わせのときは、置けた語だけで盤を作る（一覧もそれに合わせる）。
const generateGrid = (words: string[], size: number) => {
  let result: { grid: string[][]; locations: WordLocation[] } | null = null;
  for (let tries = 0; !result && tries < 50; tries++) result = tryPlace(words, size);
  if (!result) {
    const kept: string[] = [];
    for (const w of words) {
      if (tryPlace([...kept, w], size)) kept.push(w);
    }
    for (let tries = 0; !result && tries < 50; tries++) result = tryPlace(kept, size);
  }
  const { grid, locations } = result || { grid: Array(size).fill(null).map(() => Array(size).fill('')), locations: [] };

  // Fill empty spaces
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const finalGrid: CellInfo[][] = grid.map(row => 
    row.map(cell => ({
      letter: cell === '' ? letters[Math.floor(Math.random() * letters.length)] : cell,
      isTarget: false // will be used for UI highlighting
    }))
  );

  return { grid: finalGrid, locations };
};

export const WordSearch: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const goBack = useSafeBack(`/dictionary/${category}`); // 1つ上＝このカテゴリのモード一覧へ
  const { speak } = useSpeechSynthesis();
  const { addPoints } = usePoints();
  const vocabulary = useVocabulary();
  const { progress, saveProgress } = useDictionaryProgress();
  const { classBest } = useLeaderboard(category || '', 'wordsearch');

  const [grid, setGrid] = useState<CellInfo[][]>([]);
  const [gridSize, setGridSize] = useState<number>(GRID_MIN);
  const [targetWords, setTargetWords] = useState<string[]>([]);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  
  // Selection state
  const [selectionStart, setSelectionStart] = useState<{r: number, c: number} | null>(null);
  
  const [showCelebration, setShowCelebration] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);

  // Time Attack State
  const [startTime, setStartTime] = useState<number | null>(null);
  // スタートを押すまで盤を見せず、時計も動かさない（子どもの声 2026-10-11「いきなり始まって記録が変になると嫌」）
  const [started, setStarted] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const lockPaused = useLockPause(setStartTime); // ロック中は時計を止める
  const [finalTime, setFinalTime] = useState<number | null>(null);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const initGame = useCallback(() => {
    const catWords = vocabulary.filter(v => v.category === category);

    // ★盤に置けるかは「記号・スペースを除いた文字数」で決まる（盤は8〜12マス）。
    //   以前は英語表記そのままの長さで絞っていたため、"New Year's Day" のように
    //   区切りを含む語が全部はじかれ、「年中行事」などは出せる語がゼロ＝
    //   ターゲットが表示されないクロスワードになっていた。
    const gridLen = (w: string) => w.toUpperCase().replace(/[^A-Z0-9]/g, '').length;
    const fits = (w: string) => { const n = gridLen(w); return n >= 3 && n <= GRID_MAX; };

    const shuffled = [...catWords].filter(w => fits(w.english)).sort(() => 0.5 - Math.random());

    // それでも足りないカテゴリは、短い順に拾って最低限成立させる。
    //   「位置」(by / in / on / under)のように2文字の語しかない単元があるため、
    //   このときだけ2文字まで許す（通常は3文字以上）。
    const pool = shuffled.length >= 3
      ? shuffled
      : [...catWords].sort((a, b) => gridLen(a.english) - gridLen(b.english)).filter(w => gridLen(w.english) >= 2);

    const selected = pool.slice(0, 4).map(v => v.english);
    // いちばん長い語が入る大きさにする（8〜12マス）
    const needed = Math.max(GRID_MIN, ...selected.map(gridLen));
    const size = Math.min(GRID_MAX, needed);
    setGridSize(size);
    const { grid: newGrid, locations } = generateGrid(selected, size);

    // 探す語の一覧は、盤に実際に置けた語だけにする
    const placedWords = new Set(locations.map(l => l.word));
    setTargetWords(selected.map(w => w.toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(w => placedWords.has(w)));
    setGrid(newGrid);
    setFoundWords([]);
    setSelectionStart(null);
    setShowCelebration(false);
    setEarnedPoints(null);
    setStartTime(null);
    setStarted(false);
    setElapsedMs(0);
    setFinalTime(null);
    setIsNewRecord(false);
  }, [category, vocabulary]);

  // Timer loop
  useEffect(() => {
    if (!startTime || showCelebration || lockPaused) return;
    
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 100);
    
    return () => clearInterval(interval);
  }, [startTime, showCelebration, lockPaused]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleCellClick = async (r: number, c: number) => {
    if (showCelebration) return;

    if (!selectionStart) {
      setSelectionStart({ r, c });
      return;
    }

    // Second tap: Check if path is valid
    const r1 = selectionStart.r;
    const c1 = selectionStart.c;
    const r2 = r;
    const c2 = c;

    // Check if horizontal or vertical
    if (r1 !== r2 && c1 !== c2) {
      // Invalid diagonal selection, reset
      setSelectionStart(null);
      return;
    }

    // Build the string from (r1,c1) to (r2,c2)
    const dr = r1 === r2 ? 0 : (r2 > r1 ? 1 : -1);
    const dc = c1 === c2 ? 0 : (c2 > c1 ? 1 : -1);
    
    let pathString = '';
    const pathCells = [];
    
    let currR = r1;
    let currC = c1;
    
    // Safety break to prevent infinite loop
    let steps = 0;
    while (steps < 20) {
      pathString += grid[currR][currC].letter;
      pathCells.push({r: currR, c: currC});
      if (currR === r2 && currC === c2) break;
      currR += dr;
      currC += dc;
      steps++;
    }

    // Check if pathString matches any target word
    // Also check reverse because kids might select from end to start
    const reversePathString = pathString.split('').reverse().join('');
    
    let matchedWord = targetWords.find(w => w === pathString);
    let matchedCells = pathCells;

    if (!matchedWord) {
      matchedWord = targetWords.find(w => w === reversePathString);
      if (matchedWord) {
        matchedCells = [...pathCells].reverse();
      }
    }

        if (matchedWord && !foundWords.includes(matchedWord)) {
      // Found a word!
      const originalWord = vocabulary.find(v => v.english.toUpperCase().replace(/[^A-Z0-9]/g, '') === matchedWord)?.english;
      if (originalWord) speak(originalWord);

      setFoundWords(prev => {
        const next = [...prev, matchedWord as string];
        checkWinCondition(next);
        return next;
      });

      setGrid(prev => {
        const newGrid = [...prev];
        for (const cell of matchedCells) {
          newGrid[cell.r][cell.c] = { ...newGrid[cell.r][cell.c], isTarget: true };
        }
        return newGrid;
      });
    }

    setSelectionStart(null); // Reset selection
  };

  const checkWinCondition = async (found: string[]) => {
    if (found.length === targetWords.length) {
      const endTime = Date.now();
      const totalSeconds = startTime ? (endTime - startTime) / 1000 : 0;
      setFinalTime(totalSeconds);

      const pts = await addPoints(`dictionary_${category}_wordsearch`, { isPerfect: true });
      setEarnedPoints(pts);

      // Check for personal best
      const currentBest = progress[category || '']?.wordsearch_best_time;
      let newBest = currentBest;

      if (!currentBest || totalSeconds < currentBest) {
        newBest = totalSeconds;
        setIsNewRecord(true);
      }

      saveProgress(category || '', { 
        wordsearch: true, 
        ...(newBest ? { wordsearch_best_time: newBest } : {})
      });
      
      setShowCelebration(true);
    }
  };

  if (showCelebration) {
    return (
      <div className="flex-col flex-center gap-lg" style={{ height: '100%', textAlign: 'center' }}>
        <h1 className="text-primary" style={{ fontSize: '3rem' }}>クリア！</h1>
        <div className="animate-float">
          <Trophy size={100} color="var(--color-accent)" />
        </div>
        
        {finalTime !== null && (
          <div className="glass-card flex-col flex-center animate-pop" style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.9)', border: isNewRecord ? '3px solid var(--color-accent)' : 'none' }}>
            <div style={{ fontSize: '1.2rem', color: '#666' }}>クリアタイム</div>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', fontFamily: 'monospace', color: 'var(--color-primary)' }}>
              {finalTime.toFixed(1)}秒
            </div>
            {isNewRecord && (
              <div style={{ color: 'var(--color-accent)', fontWeight: 'bold', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Crown size={20} /> NEW RECORD! 自己ベスト更新！
              </div>
            )}
          </div>
        )}

        {earnedPoints !== null && (
          <div className="animate-pop" style={{ fontSize: '2rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
            +{earnedPoints} ポイントゲット！✨
          </div>
        )}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <Button onClick={initGame} variant="outline" icon={RefreshCw}>もう一度</Button>
          <Button onClick={() => navigate(`/dictionary/${category}`)}>別のモードを選ぶ</Button>
          <Button onClick={() => navigate('/home')} variant="outline">ホームにもどる</Button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="flex-col flex-center gap-lg" style={{ minHeight: '60vh', textAlign: 'center' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start' }}>
          <Button variant="outline" onClick={goBack} icon={ArrowLeft}>もどる</Button>
        </div>
        <h1 className="text-primary" style={{ margin: 0 }}>言葉さがし：{decodeURIComponent(category || '')}</h1>
        <p style={{ fontSize: '1.1rem', color: '#475569', margin: 0 }}>スタートを押すと 盤が出て、時間を はかり始めるよ ⏱️</p>
        <button
          onClick={() => { setStarted(true); setStartTime(Date.now()); }}
          style={{ padding: '1rem 3rem', fontSize: '1.6rem', fontWeight: 'bold', borderRadius: '999px', border: 'none',
            background: 'var(--color-primary)', color: 'white', cursor: 'pointer', boxShadow: '0 6px 18px rgba(0,0,0,0.2)' }}>
          ▶ スタート
        </button>
      </div>
    );
  }

  return (
    <div className="flex-col gap-md" style={{ flex: 1, paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button variant="outline" onClick={goBack} icon={ArrowLeft}>
          もどる
        </Button>
        <h1 className="text-primary" style={{ margin: 0 }}>言葉さがし</h1>
        
        {/* Timer UI */}
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'white' }}>
          <Timer size={24} color="var(--color-primary)" />
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold', fontFamily: 'monospace', minWidth: '80px', textAlign: 'right' }}>
            {(elapsedMs / 1000).toFixed(1)}s
          </span>
        </div>
      </div>

      {classBest && (
        <div className="animate-pop" style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', 
            color: 'white', 
            padding: '0.5rem 1.5rem', 
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <Crown size={20} />
            クラス記録: {classBest.time.toFixed(1)}秒 ({classBest.name}さん)
          </div>
        </div>
      )}

      <div className="glass-card flex-col flex-center" style={{ gap: '1rem' }}>
        <p style={{ fontSize: '1.2rem', textAlign: 'center' }}>
          最初の文字と最後の文字をタップして、隠れた単語を見つけよう！
        </p>
        
        {/* Target Words List */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1rem' }}>
          {targetWords.map(word => {
            const isFound = foundWords.includes(word);
            const orig = vocabulary.find(v => v.english.toUpperCase().replace(/[^A-Z0-9]/g, '') === word);
            return (
              <div 
                key={word}
                className="glass-card hover-scale"
                style={{ 
                  padding: '0.5rem 1rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  background: isFound ? 'var(--color-success)' : 'white',
                  color: isFound ? 'white' : 'black',
                  cursor: 'pointer'
                }}
                onClick={() => orig && speak(orig.english)}
              >
                <span style={{ fontWeight: 'bold' }}>{word}</span>
                {isFound && <span>✅</span>}
                {!isFound && <Volume2 size={16} />}
              </div>
            );
          })}
        </div>

        {/* The Grid */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`, 
            gap: '0.5rem',
            background: 'var(--color-primary)',
            padding: '0.5rem',
            borderRadius: 'var(--radius-md)'
          }}
        >
          {grid.map((row, r) => 
            row.map((cell, c) => {
              const isSelected = selectionStart?.r === r && selectionStart?.c === c;
              return (
                <button
                  key={`${r}-${c}`}
                  className="hover-scale"
                  style={{
                    width: '3rem',
                    height: '3rem',
                    fontSize: '1.5rem',
                    fontFamily: 'var(--font-heading)',
                    fontWeight: 'bold',
                    border: 'none',
                    borderRadius: '8px',
                    background: cell.isTarget 
                      ? 'var(--color-success)' 
                      : isSelected 
                        ? 'var(--color-accent)' 
                        : 'white',
                    color: cell.isTarget || isSelected ? 'white' : 'var(--color-text-main)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => handleCellClick(r, c)}
                >
                  {cell.letter}
                </button>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
