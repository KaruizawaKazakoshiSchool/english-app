import React, { useEffect, useState } from 'react';
import { UPDATES } from '../../data/updates';

const SEEN_KEY = 'updatesSeen';
const readSeen = () => { try { return localStorage.getItem(SEEN_KEY) || ''; } catch { return ''; } };

// 「最近の更新」。最初は新しい3件だけ、「もっと見る」で全部。
// compact（トップ画面用）：まだ見ていない更新があるときだけ開いて🆕を付ける。見たものは1行にたたむ。
// Googleで入ると名前を選ぶ画面を通らず、更新が見られなくなっていた（2026-11-27 子どもの声）。
export const RecentUpdates: React.FC<{ compact?: boolean }> = ({ compact }) => {
  const [seen] = useState(readSeen);
  const newOnes = UPDATES.filter(u => u.date > seen);
  const [open, setOpen] = useState(!compact || newOnes.length > 0);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (compact && UPDATES[0]) { try { localStorage.setItem(SEEN_KEY, UPDATES[0].date); } catch { /* noop */ } }
  }, [compact]);
  if (UPDATES.length === 0) return null;
  if (compact && !open) {
    return (
      <button onClick={() => setOpen(true)}
        style={{ maxWidth: '900px', width: '100%', textAlign: 'left', background: 'white', border: '2px solid var(--color-primary)', borderRadius: '14px', padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 'bold' }}>
        📰 最近の更新（{UPDATES[0].date.slice(5).replace('-', '/').replace(/^0/, '')}）▼
      </button>
    );
  }
  // 前に見たことがある端末だけ、まだ見ていない分をまとめて出す（はじめての端末は新しい3件）。多すぎるときは8件まで
  const base = compact && seen && newOnes.length > 3 ? newOnes.slice(0, 8) : UPDATES.slice(0, 3);
  const list = all ? UPDATES : base;
  const md = (d: string) => { const [, m, day] = d.split('-'); return `${Number(m)}/${Number(day)}`; };

  return (
    <div style={{
      maxWidth: compact ? '900px' : '640px', width: '100%', margin: compact ? 0 : '0 auto', background: 'white', boxSizing: 'border-box',
      border: '2px solid var(--color-primary)', borderRadius: '14px', padding: '0.8rem 1rem',
    }}>
      <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.4rem', display: 'flex', justifyContent: 'space-between' }}>
        <span>📰 最近の更新</span>
        {compact && <button onClick={() => setOpen(false)} style={{ border: 'none', background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.85rem' }}>▲ たたむ</button>}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {list.map((u, i) => (
          <li key={i} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.92rem', alignItems: 'baseline' }}>
            <span style={{ color: '#94a3b8', minWidth: '2.8rem' }}>{md(u.date)}</span>
            <span style={{ flex: 1 }}>
              {compact && u.date > seen && <span style={{ marginRight: '0.3rem', fontSize: '0.75rem', fontWeight: 'bold', color: 'white', background: '#ef4444', borderRadius: '999px', padding: '0.05rem 0.45rem' }}>NEW</span>}
              {u.text}
              {u.fromVoice && (
                <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#b45309',
                  background: '#fef3c7', borderRadius: '999px', padding: '0.05rem 0.5rem', whiteSpace: 'nowrap' }}>
                  📮 みんなの声から
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      {UPDATES.length > list.length || all ? (UPDATES.length > 3 && (
        <button onClick={() => setAll(v => !v)}
          style={{ marginTop: '0.4rem', border: 'none', background: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.85rem', padding: 0 }}>
          {all ? '▲ とじる' : `▼ もっと見る（全${UPDATES.length}件）`}
        </button>
      )) : null}
    </div>
  );
};
