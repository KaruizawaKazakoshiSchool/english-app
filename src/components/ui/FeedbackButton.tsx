import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { showToast } from './Toast';

// 画面の右下に置く「困った／こうしたい」の受付。
// 子どもがその場で気づいたことを、先生を探しに行かずに送れるようにする。
// 送り先はSupabaseの feedback テーブル。スタッフ画面で読めるほか、
// Mac側の巡回（feedback_watch.py）が新着をメールで知らせる。

const KINDS = [
  { id: 'bug', emoji: '🐛', label: 'うまく動かない', hint: '（れい）マイクを押しても なにも おきない' },
  { id: 'idea', emoji: '💡', label: 'こうしたい', hint: '（れい）◯◯のゲームが あったら たのしい' },
] as const;

export const FeedbackButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'bug' | 'idea'>('bug');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    const msg = text.trim();
    if (!msg || !supabase) return;
    setSending(true);
    const { error } = await supabase.from('feedback').insert({
      student_id: localStorage.getItem('studentId'),
      student_name: localStorage.getItem('studentName') || 'ゲスト',
      kind,
      message: msg.slice(0, 1000),
      screen: (() => { const h = window.location.hash || ''; try { return decodeURI(h).slice(0, 80); } catch { return h.slice(0, 80); } })(),
      ua: navigator.userAgent.slice(0, 120),
    });
    setSending(false);
    if (error) {
      showToast('送れませんでした。もう一度試してね', 'fail');
      return;
    }
    setText(''); setOpen(false);
    showToast('📮 送ったよ！ 先生に 届きます。ありがとう！', 'points');
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="困ったこと・こうしたいことを先生に送る"
        style={{
          position: 'fixed', right: '16px', bottom: '16px', zIndex: 900,
          width: '54px', height: '54px', borderRadius: '50%', cursor: 'pointer',
          border: '2px solid white', background: 'var(--color-primary)', color: 'white',
          fontSize: '1.5rem', boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        }}
      >
        📮
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed', right: '16px', bottom: '16px', zIndex: 900,
      width: 'min(340px, calc(100vw - 32px))', background: 'white',
      borderRadius: '16px', border: '2px solid var(--color-primary)',
      boxShadow: '0 8px 28px rgba(0,0,0,0.25)', padding: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <b style={{ color: 'var(--color-primary)' }}>📮 先生に 伝える</b>
        <button onClick={() => setOpen(false)}
          style={{ border: 'none', background: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.6rem' }}>
        {KINDS.map(k => (
          <button key={k.id} onClick={() => setKind(k.id)}
            style={{
              flex: 1, padding: '0.5rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold',
              border: `2px solid ${kind === k.id ? 'var(--color-primary)' : '#e2e8f0'}`,
              background: kind === k.id ? 'var(--color-primary)' : 'white',
              color: kind === k.id ? 'white' : '#475569',
            }}>
            {k.emoji} {k.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={KINDS.find(k => k.id === kind)?.hint}
        style={{
          width: '100%', height: '90px', padding: '0.6rem', fontSize: '0.95rem',
          borderRadius: '10px', border: '2px solid #e2e8f0', boxSizing: 'border-box',
          resize: 'none', fontFamily: 'inherit',
        }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button onClick={send} disabled={sending || !text.trim()}
          style={{
            flex: 1, padding: '0.6rem', borderRadius: '999px', fontWeight: 'bold', fontSize: '0.95rem',
            border: 'none', cursor: text.trim() ? 'pointer' : 'default',
            background: text.trim() ? 'var(--color-primary)' : '#e2e8f0',
            color: text.trim() ? 'white' : '#94a3b8',
          }}>
          {sending ? '送っています…' : '送る'}
        </button>
      </div>
      <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.5rem 0 0' }}>
        いま見ている画面と 名前も いっしょに 届きます
      </p>
    </div>
  );
};
