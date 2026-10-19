import React from 'react';
import { useSpeechSynthesis } from '../../hooks/useSpeechSynthesis';

// 課題文（ミッション・説明）の中の英語を、タップで読み上げる（子どもの声 2026-10-20「課題文がそもそも読めない」）。
// 日本語の中にまじった英語のかたまりだけを 🔈 つきのボタンにする。◯◯・＿ の空欄は読まずに少し間をあける。
const EN_CHUNK = /[A-Za-z][A-Za-z0-9'’ ,.!?\-◯＿_]*[A-Za-z0-9.!?◯＿_]|[A-Za-z]{2,}/g;

const toSpeech = (s: string) => s.replace(/[◯＿_]+/g, ' … ').replace(/\s+/g, ' ').trim();

export const SpeakableText: React.FC<{ text: string; style?: React.CSSProperties }> = ({ text, style }) => {
  const { speak } = useSpeechSynthesis();
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(EN_CHUNK)) {
    const chunk = m[0].trimEnd();
    const letters = chunk.replace(/[^A-Za-z]/g, '');
    if (letters.length < 2) continue;
    const i = m.index ?? 0;
    if (i > last) parts.push(text.slice(last, i));
    parts.push(
      <button key={i} type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); speak(toSpeech(chunk)); }}
        title="タップで読み上げ"
        style={{ display: 'inline', font: 'inherit', color: 'inherit', background: 'rgba(255,255,255,0.35)', border: 'none', borderBottom: '2px dotted currentColor', borderRadius: '4px', padding: '0 0.15em', margin: '0 0.1em', cursor: 'pointer' }}>
        🔈{chunk}
      </button>
    );
    last = i + chunk.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span style={style}>{parts}</span>;
};
