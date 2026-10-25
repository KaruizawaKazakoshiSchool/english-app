import React, { useState } from 'react';
import { TOWN_BUILDINGS, FOREST_STAGES, TOWN_OPEN } from '../../data/townItems';

// みんなの町を「絵」で見せる（子どもの声 2026-09-29「できあがった町とかじゃ分からない。イラストがあればいいのに」）。
// 空・浅間山・道・10区画の土地を描き、建てた建物を区画に置く。まだの区画は「空き地」。
// 区画をタップすると、そこに建った建物の名前と説明が出る。
// 町ひらき前のチームは、森の絵を出す。

const KINDS = Array.from(new Set(TOWN_BUILDINGS.map(b => b.kind)));   // 10種類（区画の並び）

export const TownScene: React.FC<{ built: string[]; total: number; label: string }> = ({ built, total, label }) => {
  const [picked, setPicked] = useState<string | null>(null);
  const opened = total >= TOWN_OPEN;
  const forestIdx = Math.min(FOREST_STAGES.length - 1, Math.floor(total / (TOWN_OPEN / FOREST_STAGES.length)));

  // 区画ごとに、建っている建物（Lvの高い順）
  const plots = KINDS.map(kind => ({
    kind,
    items: TOWN_BUILDINGS.filter(b => b.kind === kind && built.includes(b.id)).sort((a, b) => b.level - a.level),
  }));
  const pickedPlot = plots.find(p => p.kind === picked);

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '16 / 10', borderRadius: '18px', overflow: 'hidden',
        containerType: 'inline-size',   // 中の絵文字を「町の幅」に合わせた大きさにする（cqw）
        background: 'linear-gradient(#bfe6ff 0%, #e6f6ff 45%, #9fd98b 45%, #7cc46a 100%)',
        border: '3px solid white', boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
      }}>
        {/* 浅間山と雲 */}
        <svg viewBox="0 0 160 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden>
          <polygon points="20,45 62,14 70,17 78,14 120,45" fill="#8aa6c1" />
          <polygon points="56,19 62,14 70,17 78,14 84,19 76,21 70,19 64,21" fill="white" opacity="0.9" />
          <ellipse cx="30" cy="12" rx="10" ry="3.5" fill="white" opacity="0.85" />
          <ellipse cx="128" cy="9" rx="13" ry="4" fill="white" opacity="0.85" />
          {/* 町の中を通る道 */}
          <path d="M0,72 C40,66 120,78 160,70 L160,77 C120,85 40,73 0,79 Z" fill="#d9c7a3" />
        </svg>

        {!opened ? (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '8%', textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(2rem, 8vw, 3.6rem)', lineHeight: 1.1 }}>{FOREST_STAGES[forestIdx]}</div>
            <div style={{ display: 'inline-block', marginTop: '0.4rem', background: 'rgba(255,255,255,0.85)', borderRadius: '999px', padding: '0.2rem 0.8rem', fontSize: '0.8rem', fontWeight: 'bold', color: '#15803d' }}>
              森を育て中 … 町ひらきまで あと{Math.max(0, TOWN_OPEN - total).toLocaleString()}P
            </div>
          </div>
        ) : (
          // 10区画（上5・下5）。上の段は道の向こう（小さめ）、下の段は手前
          <div style={{ position: 'absolute', left: '3%', right: '3%', top: '44%', bottom: '4%', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: '1fr 1fr', columnGap: '2%', rowGap: '14%' }}>
            {plots.map(p => {
              const top = p.items[0];
              return (
                <button key={p.kind} onClick={() => setPicked(v => (v === p.kind ? null : p.kind))}
                  title={top ? top.name : `${p.kind}（空き地）`}
                  style={{
                    position: 'relative', border: picked === p.kind ? '2px solid #f59e0b' : 'none', borderRadius: '10px', cursor: 'pointer',
                    background: top ? 'rgba(255,255,255,0.35)' : 'rgba(120, 90, 50, 0.25)', padding: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6cqw', overflow: 'hidden',
                  }}>
                  {/* いちばん高いLvの建物を大きく、ほかのLvは下に小さく並べる（重ねない。子どもの声 2026-10-25「アイコンが重なって見える」） */}
                  {top ? (
                    <>
                      <span style={{ fontSize: '5.2cqw', lineHeight: 1 }}>{top.emoji}</span>
                      {p.items.length > 1 && (
                        <span style={{ fontSize: '2.3cqw', lineHeight: 1, letterSpacing: '0.3cqw', whiteSpace: 'nowrap' }}>{p.items.slice(1).map(b => b.emoji).join('')}</span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: '2.6cqw', opacity: 0.55 }}>🚧</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div style={{ position: 'absolute', left: '0.6rem', top: '0.5rem', background: 'rgba(255,255,255,0.85)', borderRadius: '999px', padding: '0.15rem 0.7rem', fontWeight: 'bold', fontSize: '0.85rem' }}>
          {label}
        </div>
        {opened && (
          <div style={{ position: 'absolute', right: '0.6rem', top: '0.5rem', background: 'rgba(255,255,255,0.85)', borderRadius: '999px', padding: '0.15rem 0.7rem', fontSize: '0.8rem' }}>
            建物 {built.length}／{TOWN_BUILDINGS.length}
          </div>
        )}
      </div>

      {opened && (
        <div style={{ minHeight: '2.6rem', marginTop: '0.4rem', fontSize: '0.85rem', color: '#475569', textAlign: 'center' }}>
          {pickedPlot
            ? (pickedPlot.items.length
                ? pickedPlot.items.map(b => `${b.emoji} ${b.name}（Lv${b.level}）：${b.desc}`).join('　')
                : `🚧 ${pickedPlot.kind}の土地は まだ空き地。建物をたてると ここに できるよ`)
            : '土地をタップすると、何が建っているか 見られるよ'}
        </div>
      )}
    </div>
  );
};
