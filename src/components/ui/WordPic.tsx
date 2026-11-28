import React from 'react';

// 単語の絵。絵文字が無い（合わない）単語は画像（imageUrl）で出す（子どもの声 2026-11-27「消しゴムがせっけんになってる」）。
// 画像は文字の大きさ（1em）に合わせるので、絵文字と同じように fontSize で大きさを決められる。
export const WordPic: React.FC<{ word: { emoji?: string; imageUrl?: string; english?: string } }> = ({ word }) =>
  word.imageUrl
    ? <img src={word.imageUrl} alt={word.english || ''} style={{ width: '1.2em', height: '1.2em', objectFit: 'contain', verticalAlign: 'middle' }} />
    : <>{word.emoji}</>;
