import React, { useState, useEffect, useRef, useCallback } from 'react';
import { WordPic } from '../ui/WordPic';
import { playClip, stopAllSound } from '../../lib/playOne';
import { Button } from '../ui/Button';
import { Volume2, Volume2 as VolOn, VolumeX, RefreshCw, Play } from 'lucide-react';
import { getPreferredVoice } from '../../lib/voice';

export interface TypingWord {
  text: string;
  emoji?: string;
  imageUrl?: string;
}

interface TypingTrainerProps {
  words: TypingWord[];
  /** お手本（単語まるごと）を鳴らす関数。なければブラウザ読み上げ */
  speakWord?: (text: string) => void;
  durationSec?: number;
}

// キーボードの並び（ホームポジション学習用）
const KEY_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];
// ホームポジション（指を置く場所）
const HOME_KEYS = new Set(['a', 's', 'd', 'f', 'j', 'k', 'l']);
// 左手 / 右手 でうっすら色分け
const LEFT_KEYS = new Set(['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g', 'z', 'x', 'c', 'v', 'b']);

const isLetter = (ch: string) => /^[a-z]$/i.test(ch);

export const TypingTrainer: React.FC<TypingTrainerProps> = ({ words, speakWord, durationSec = 60 }) => {
  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [soundOn, setSoundOn] = useState(true);
  const [timeLeft, setTimeLeft] = useState(durationSec);
  const [pool, setPool] = useState<TypingWord[]>([]);
  const [idx, setIdx] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [correctKeys, setCorrectKeys] = useState(0);
  const [missKeys, setMissKeys] = useState(0);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [wrongKey, setWrongKey] = useState<string | null>(null);

  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  // a.mp3 〜 z.mp3（フォニックス読み）を鳴らす
  const playLetter = useCallback((ch: string) => {
    if (!soundOnRef.current) return;
    const l = ch.toLowerCase();
    if (!isLetter(l)) return;
    playClip(`${import.meta.env.BASE_URL}audio/${l}.mp3`).catch(() => {});
  }, []);

  const speak = useCallback((text: string) => {
    if (speakWord) { speakWord(text); return; }
    const msg = new SpeechSynthesisUtterance();
    msg.text = text;
    msg.lang = 'en-US';
    msg.rate = 0.8;
    const voice = getPreferredVoice(); // クリアな英語ボイスに固定
    if (voice) msg.voice = voice;
    stopAllSound();
    window.speechSynthesis.speak(msg);
  }, [speakWord]);

  const shuffle = useCallback(() => {
    const arr = [...words];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [words]);

  const start = () => {
    const sh = shuffle();
    setPool(sh);
    setIdx(0);
    setCursor(0);
    setCompleted(0);
    setCorrectKeys(0);
    setMissKeys(0);
    setTimeLeft(durationSec);
    setPhase('playing');
  };

  const current = pool[idx];

  // 単語が変わったらお手本を鳴らす
  useEffect(() => {
    if (phase === 'playing' && current) {
      const t = setTimeout(() => speak(current.text), 200);
      return () => clearTimeout(t);
    }
  }, [phase, idx, current, speak]);

  // タイマー
  useEffect(() => {
    if (phase !== 'playing') return;
    if (timeLeft <= 0) { setPhase('done'); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  // 次に押すべき文字（記号・スペースは自動でスキップ）
  const nextExpected = useCallback((word: string, from: number) => {
    let c = from;
    while (c < word.length && !isLetter(word[c])) c++;
    return c;
  }, []);

  const handleKey = useCallback((rawKey: string) => {
    if (phase !== 'playing' || !current) return;
    const key = rawKey.toLowerCase();
    if (!isLetter(key)) return;

    playLetter(key);
    setFlashKey(key);
    setTimeout(() => setFlashKey(null), 120);

    const word = current.text;
    const pos = nextExpected(word, cursor);
    const expected = word[pos]?.toLowerCase();

    if (expected === key) {
      setCorrectKeys((n) => n + 1);
      const after = nextExpected(word, pos + 1);
      if (after >= word.length) {
        // 単語クリア
        setCompleted((n) => n + 1);
        setCursor(0);
        setIdx((i) => {
          const ni = i + 1;
          if (ni >= pool.length) {
            const sh = shuffle();
            setPool(sh);
            return 0;
          }
          return ni;
        });
      } else {
        setCursor(after);
      }
    } else {
      setMissKeys((n) => n + 1);
      setWrongKey(key);
      setTimeout(() => setWrongKey(null), 200);
    }
  }, [phase, current, cursor, pool.length, nextExpected, playLetter, shuffle]);

  // 物理キーボード
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length === 1 && isLetter(e.key)) {
        e.preventDefault();
        handleKey(e.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase, handleKey]);

  // 次に押すキー（ハイライト用）
  const expectedKey = (() => {
    if (!current) return null;
    const pos = nextExpected(current.text, cursor);
    return current.text[pos]?.toLowerCase() ?? null;
  })();

  // ===== 画面 =====
  if (phase === 'ready') {
    return (
      <div className="flex-col flex-center gap-lg" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '4rem' }}>⌨️</div>
        <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>タイピング練習</h2>
        <p style={{ fontSize: '1.1rem', color: '#555', maxWidth: '480px', lineHeight: 1.6 }}>
          画面に出てくる単語を、キーボードでタイプしよう！<br/>
          キーを押すと、そのアルファベットの<strong>フォニックスの音</strong>が鳴るよ。<br/>
          <strong>{durationSec}秒</strong>でいくつタイプできるかな？
        </p>
        <div style={{ background: 'rgba(255,255,255,0.6)', borderRadius: '12px', padding: '0.8rem 1.2rem', color: '#666', fontSize: '0.95rem' }}>
          💡 緑色のキーが「次に押すところ」だよ。<span style={{ color: '#e17055', fontWeight: 'bold' }}>オレンジ</span>のキーはホームポジション（指を置く場所）！
        </div>
        <Button onClick={start} icon={Play} style={{ fontSize: '1.3rem', padding: '1rem 2.5rem' }}>スタート！</Button>
      </div>
    );
  }

  if (phase === 'done') {
    const total = correctKeys + missKeys;
    const acc = total > 0 ? Math.round((correctKeys / total) * 100) : 100;
    return (
      <div className="flex-col flex-center gap-lg" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '2.2rem' }}>おわり！🎉</h2>
        <div className="glass-card" style={{ padding: '2rem 3rem', background: 'rgba(255,255,255,0.7)' }}>
          <div style={{ fontSize: '1.2rem', color: '#666' }}>タイプできた単語</div>
          <div style={{ fontSize: '4rem', fontWeight: 'bold', color: 'var(--color-success)' }}>{completed}</div>
          <div style={{ fontSize: '1.1rem', color: '#666', marginTop: '0.5rem' }}>
            正しく押せたキー: <strong>{correctKeys}</strong> ／ 正確さ: <strong>{acc}%</strong>
          </div>
        </div>
        <Button onClick={start} icon={RefreshCw} style={{ fontSize: '1.2rem', padding: '0.9rem 2rem' }}>もう一度</Button>
      </div>
    );
  }

  // playing
  return (
    <div className="flex-col flex-center gap-md" style={{ padding: '1rem', width: '100%' }}>
      {/* ステータスバー */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: timeLeft <= 10 ? 'var(--color-error)' : 'var(--color-primary)', fontFamily: 'monospace' }}>
          ⏱️ {timeLeft}秒
        </div>
        <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: 'var(--color-success)' }}>
          ✅ {completed}個
        </div>
        <button
          onClick={() => setSoundOn((s) => !s)}
          className="hover-scale"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: soundOn ? 'var(--color-secondary)' : '#ddd', color: soundOn ? '#fff' : '#777', border: 'none', borderRadius: '999px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {soundOn ? <VolOn size={18} /> : <VolumeX size={18} />}
          {soundOn ? '音オン' : '音オフ'}
        </button>
      </div>

      {/* お題の単語 */}
      <div className="flex-col flex-center" style={{ gap: '0.5rem', minHeight: '160px' }}>
        {(current?.emoji || current?.imageUrl) && <div style={{ fontSize: '3.5rem' }}><WordPic word={current} /></div>}
        <div style={{ display: 'flex', gap: '0.1rem', fontFamily: 'var(--font-heading)', fontSize: '3.5rem' }}>
          {current?.text.split('').map((ch, i) => {
            const done = i < cursor;
            const isNext = i === nextExpected(current.text, cursor);
            return (
              <span key={i} style={{
                color: done ? 'var(--color-success)' : isNext ? 'var(--color-primary)' : '#bbb',
                borderBottom: isNext ? '5px solid var(--color-primary)' : '5px solid transparent',
                padding: '0 0.05em',
                transition: 'color 0.1s',
              }}>{ch === ' ' ? ' ' : ch}</span>
            );
          })}
        </div>
        <Button variant="outline" icon={Volume2} onClick={() => current && speak(current.text)} style={{ padding: '0.4rem 1rem', fontSize: '0.95rem' }}>
          お手本を聞く
        </Button>
      </div>

      {/* キーボード */}
      <div className="flex-col flex-center" style={{ gap: '0.4rem', width: '100%', maxWidth: '620px' }}>
        {KEY_ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center', paddingLeft: ri * 18 }}>
            {row.map((k) => {
              const isExpected = k === expectedKey;
              const isHome = HOME_KEYS.has(k);
              const flashing = flashKey === k;
              const wrong = wrongKey === k;
              return (
                <button
                  key={k}
                  onClick={() => handleKey(k)}
                  style={{
                    width: '46px', height: '46px',
                    borderRadius: '10px',
                    border: isHome ? '2px solid #e17055' : '2px solid #ccc',
                    background: wrong ? 'var(--color-error)'
                      : isExpected ? 'var(--color-success)'
                      : flashing ? 'var(--color-accent)'
                      : LEFT_KEYS.has(k) ? '#eef6ff' : '#fff5ee',
                    color: isExpected || wrong ? '#fff' : '#444',
                    fontSize: '1.3rem',
                    fontWeight: 'bold',
                    fontFamily: 'var(--font-heading)',
                    cursor: 'pointer',
                    boxShadow: isExpected ? '0 0 12px var(--color-success)' : 'var(--shadow-sm)',
                    transform: flashing ? 'translateY(2px)' : 'none',
                    transition: 'all 0.08s',
                    position: 'relative',
                  }}
                >
                  {k.toUpperCase()}
                  {isHome && <span style={{ position: 'absolute', bottom: '2px', left: 0, right: 0, fontSize: '0.5rem', color: '#e17055' }}>●</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
