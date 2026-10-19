import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { CurrentUnit } from '../../lib/unitProgress';
import { itemProgress, type ItemKind } from '../../lib/unitProgress';
import type { DictCategoryProgress } from '../../hooks/useDictionaryProgress';
import type { TodayMission } from '../../hooks/useAppSettings';
import { isOnMission, MISSION_MULTIPLIER } from '../../lib/missionBonus';
import { SpeakableText } from '../ui/SpeakableText';

// トップの「今の単元」パネル。
// 単元で使うモードを全部並べて、それぞれの達成率を見せる（子どもが「次はこれ」と選べるように）。
// 今日のミッションと同じ行き先には「今日のミッション」の印をつける。

const KIND: Record<ItemKind, { emoji: string; label: string; color: string }> = {
  dictionary: { emoji: '📕', label: '辞書', color: '#48dbfb' },
  textbook: { emoji: '📘', label: '教科書', color: '#00b894' },
  dialogue: { emoji: '🗣️', label: 'ダイアログ', color: '#0984e3' },
  ai: { emoji: '🤖', label: 'AI英会話', color: '#a29bfe' },
  other: { emoji: '✨', label: '', color: '#b2bec3' },
};

const unitLabel = (kind: ItemKind, done: number, total: number) => {
  if (total === 0) return '';
  if (done >= total) return kind === 'dictionary' ? 'マスター！' : 'クリア！';
  if (kind === 'dictionary') return `${done} / ${total} モード`;
  // 「クリア（ボーナスまだ）」が意味不明と言われた（子どもの声 2026-10-17）。クリアは済み・もう一歩でボーナス、と分かる言い方に
  if (kind === 'ai') return done === 1 ? 'クリア！ ⭐ボーナスにも ちょうせんできるよ' : 'まだ';
  return 'まだ';
};

export const UnitHub: React.FC<{
  unit: CurrentUnit;
  dictProgress: Record<string, DictCategoryProgress>;
  studentId: string | null;
  todayMissions: TodayMission[];
}> = ({ unit, dictProgress, studentId, todayMissions }) => {
  const navigate = useNavigate();
  const rows = unit.items.map(it => ({ it, p: itemProgress(it.route, dictProgress, studentId) }));
  const sumDone = rows.reduce((s, r) => s + Math.min(r.p.done, r.p.total), 0);
  const sumTotal = rows.reduce((s, r) => s + r.p.total, 0);
  const pct = sumTotal ? Math.round((sumDone / sumTotal) * 100) : 0;

  return (
    <div className="glass-card animate-pop" style={{ width: '100%', maxWidth: '900px', padding: '1.2rem 1.4rem', border: '3px solid var(--color-primary)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#666' }}>📚 今の単元</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#000' }}>{unit.title}</div>
          {unit.subtitle && <div style={{ fontSize: '1rem', color: '#555' }}>{unit.subtitle}</div>}
        </div>
        <div style={{ minWidth: '160px', textAlign: 'right' }}>
          <div style={{ fontSize: '0.95rem', color: '#666', fontWeight: 'bold' }}>この単元の達成率</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{pct}%</div>
          <div style={{ height: '10px', background: '#eee', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-success)' }} />
          </div>
        </div>
      </div>
      <div style={{ fontSize: '0.95rem', color: '#555', marginBottom: '0.6rem' }}>
        ぜんぶ、この単元で使う練習だよ。まだのところから、次にやるものを選ぼう。
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.7rem' }}>
        {rows.map(({ it, p }, i) => {
          const k = KIND[p.kind];
          const done = p.total > 0 && p.done >= p.total;
          const mission = todayMissions.some(m => m.route && isOnMission(it.route, m.route));
          const ratio = p.total ? Math.min(1, p.done / p.total) : 0;
          return (
            <div
              key={it.route + i}
              className="hover-scale"
              onClick={() => navigate(it.route)}
              style={{
                cursor: 'pointer', padding: '0.8rem 1rem', borderRadius: '14px', background: done ? 'rgba(0, 184, 148, 0.12)' : 'white',
                border: mission ? '3px solid #ee5253' : `2px solid ${k.color}`, display: 'flex', flexDirection: 'column', gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.3rem' }}>{k.emoji}</span>
                {k.label && <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#666' }}>{k.label}</span>}
                {mission && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold', background: '#ee5253', color: 'white', borderRadius: '999px', padding: '0.1rem 0.5rem', whiteSpace: 'nowrap' }}>
                    🎯 今日のミッション ⭐{MISSION_MULTIPLIER}倍
                  </span>
                )}
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#000' }}>{it.label}</div>
              {it.note && <div style={{ fontSize: '0.9rem', color: '#666' }}><SpeakableText text={it.note} /></div>}
              {p.total > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1, height: '8px', background: '#eee', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${ratio * 100}%`, height: '100%', background: done ? 'var(--color-success)' : k.color }} />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: done ? '#00b894' : '#666', whiteSpace: 'nowrap' }}>
                    {done ? '✅ ' : ''}{unitLabel(p.kind, p.done, p.total)}
                  </span>
                </div>
              )}
              {!done && p.missing && p.missing.length > 0 && p.done > 0 && (
                <div style={{ fontSize: '0.8rem', color: '#b45309' }}>あと：{p.missing.join('・')}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
