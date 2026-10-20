import React from 'react';
import type { Vocabulary } from '../../data/vocabulary';

// Picture Dictionary の単元さがし（2026-10-20：単元が50を超えて探しにくくなった）。
// 単元名だけでなく、中の単語（英語・日本語）でも見つかる。「dog」「いぬ」→「動物」。
// ひらがな・カタカナ、大文字・小文字の違いは気にしない。

const norm = (s: string) => s.toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/\s+/g, '');

export interface UnitHit { match: boolean; words: string[] }

export const searchUnit = (category: string, query: string, vocabulary: Vocabulary[]): UnitHit => {
  const q = norm(query);
  if (!q) return { match: true, words: [] };
  if (norm(category).includes(q)) return { match: true, words: [] };
  const words = vocabulary
    .filter(v => v.category === category && (norm(v.english).includes(q) || norm(v.japanese).includes(q)))
    .map(v => `${v.emoji} ${v.english}`);
  return { match: words.length > 0, words };
};

export const UnitSearchBox: React.FC<{ value: string; onChange: (v: string) => void; count: number; total: number }> = ({ value, onChange, count, total }) => (
  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
    <div style={{ position: 'relative' }}>
      <input type="search" value={value} onChange={e => onChange(e.target.value)}
        placeholder="🔍 単元や単語でさがす（例：動物、dog、いぬ）"
        style={{ width: '100%', boxSizing: 'border-box', padding: '0.8rem 2.6rem 0.8rem 1rem', fontSize: '1.1rem', borderRadius: '999px', border: '2px solid var(--color-primary)', background: 'white' }} />
      {value && (
        <button onClick={() => onChange('')} aria-label="消す"
          style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#64748b' }}>✕</button>
      )}
    </div>
    {value && (
      <div style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
        {count > 0 ? `${total}単元のうち ${count}単元が 見つかったよ` : '見つからなかったよ。ちがう言葉で さがしてみよう'}
      </div>
    )}
  </div>
);
