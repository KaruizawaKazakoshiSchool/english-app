import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { checkReflection } from '../../lib/reflectionCheck';

// 🌱 光るふりかえり（先生用）
// 「アプリで1人ずつ学ぶ価値」が見えるふりかえり（自分の課題に向き合う・できるようになった・次はこうする）を集める。
// ・候補はことばの決まり（下の CUES）で、先生のブラウザの中だけで選ぶ。AIには通さない（学園のルール）
// ・先生が ⭐ を押したものだけが「集めたもの」になる（テーブル reflection_picks。子どもは読めない）
// ・毎日書かれたふりかえりも、開くたびに自動で候補に入る
// 2026-11-19 さんだー「自分の課題に向き合っている子のふりかえりを集めて、今後も足していって」

const CUES: { label: string; re: RegExp }[] = [
  { label: '自分の課題', re: /課題|苦手|にがて|弱い|足りな|できなかった|むずかし|難し/ },
  { label: '次への一歩', re: /次は|次から|つぎは|つぎから|今度は|これから|頑張|がんば|目標|練習したい|直したい|気をつけ|挑戦|ちょうせん/ },
  { label: 'できた・伸びた', re: /できるようになった|わかるようになった|言えるようになった|上達|前より|成長|上手くなった|うまくなった|覚えられた|言えた|わかった/ },
  { label: '自分で選んで学ぶ', re: /発音|聞き取|分野|自分の|自分で|ペース|得意|モード|単元/ },
];

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

interface Item { sid: string; name: string; grade: number | null; rid: string; date: string; stars: number; comment: string; cues: string[]; }

export const ShiningReflectionsCard: React.FC<{ students: any[] }> = ({ students }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'picked' | 'cands'>('cands');
  const [picks, setPicks] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState('');
  const [wide, setWide] = useState(false);

  useEffect(() => {
    if (!open || !supabase) return;
    supabase.from('reflection_picks').select('student_id,reflection_id').then(({ data, error }) => {
      if (error) { setMsg('選んだものを読めなかった（先生のアカウントで開いてね）'); return; }
      setPicks(new Set((data || []).map((r: any) => `${r.student_id}__${r.reflection_id}`)));
    });
  }, [open]);

  const all: Item[] = useMemo(() => {
    const out: Item[] = [];
    for (const s of students) {
      if (!/^\d+$/.test(s.id) || s.id === '00' || s.id === '99') continue;
      for (const r of (Array.isArray(s.reflections) ? s.reflections : [])) {
        const comment = String(r?.comment || '').trim();
        if (!r?.id || !r?.date || !comment) continue;
        const chk = checkReflection(comment);
        const cues = CUES.filter(c => c.re.test(comment)).map(c => c.label);
        out.push({ sid: s.id, name: s.name, grade: s.grade ?? null, rid: r.id, date: r.date, stars: Number(r.stars) || 0, comment,
          cues: chk.ok && !r.noStamp && chk.length >= 25 ? cues : [] });
      }
    }
    return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [students]);

  const key = (it: Item) => `${it.sid}__${it.rid}`;
  // 候補：「課題」か「できた・伸びた」があり、ほかと合わせて2つ以上の手がかりがある
  // 「ゆるめに」：手がかりが1つでもあれば出す（拾いもれ用）
  const cands = all.filter(it => !picks.has(key(it)) && (wide ? it.cues.length >= 1 : it.cues.length >= 2 && (it.cues.includes('自分の課題') || it.cues.includes('できた・伸びた'))));
  const picked = all.filter(it => picks.has(key(it)));

  const toggle = async (it: Item) => {
    if (!supabase) return;
    const k = key(it);
    const on = picks.has(k);
    const { error } = on
      ? await supabase.from('reflection_picks').delete().eq('student_id', it.sid).eq('reflection_id', it.rid)
      : await supabase.from('reflection_picks').upsert({ student_id: it.sid, reflection_id: it.rid });
    if (error) { setMsg('保存できなかった'); return; }
    setPicks(prev => { const n = new Set(prev); if (on) n.delete(k); else n.add(k); return n; });
  };

  const downloadCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [['日付', '番号', '名前', '学年', '星', 'ふりかえり', '手がかり'].map(esc).join(',')];
    for (const it of picked) lines.push([fmt(it.date), it.sid, it.name, it.grade ? `${it.grade}年` : '', String(it.stars), it.comment, it.cues.join('・')].map(esc).join(','));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `光るふりかえり_${fmt(new Date().toISOString())}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const list = tab === 'picked' ? picked : cands;
  const pill = (on: boolean): React.CSSProperties => ({ padding: '0.35rem 0.9rem', borderRadius: '999px', cursor: 'pointer', fontWeight: 'bold',
    border: '1px solid var(--color-primary)', background: on ? 'var(--color-primary)' : 'white', color: on ? 'white' : 'var(--color-primary)' });

  return (
    <div className="glass-card" style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🌱 光るふりかえり</h2>
        <button onClick={() => setOpen(o => !o)}
          style={{ padding: '0.4rem 1rem', borderRadius: '999px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
          {open ? '▲ たたむ' : '▼ ひらく'}
        </button>
      </div>
      {open && (<>
        <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.6rem 0' }}>
          自分の課題・次の一歩・伸びたことが書かれたふりかえりを、ことばの手がかりで候補に出します（この画面の中だけで判定。AIには送りません）。⭐を押すと「集めたもの」に入ります。新しいふりかえりも、開くたびに候補に入ります。
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
          <button style={pill(tab === 'cands')} onClick={() => setTab('cands')}>候補 {cands.length}</button>
          <button style={pill(tab === 'picked')} onClick={() => setTab('picked')}>⭐ 集めたもの {picked.length}</button>
          {tab === 'cands' && <label style={{ fontSize: '0.85rem' }}><input type="checkbox" checked={wide} onChange={e => setWide(e.target.checked)} /> ゆるめに探す</label>}
          {tab === 'picked' && picked.length > 0 && (
            <button onClick={downloadCsv} style={{ marginLeft: 'auto', padding: '0.4rem 1rem', borderRadius: '999px', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>⬇ CSVで保存</button>
          )}
          {msg && <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{msg}</span>}
        </div>
        {list.length === 0 ? <p style={{ color: '#64748b' }}>{tab === 'picked' ? 'まだありません。候補から⭐を押してね' : '今のところ候補はありません'}</p> : (
          <div className="flex-col gap-sm" style={{ maxHeight: '520px', overflowY: 'auto' }}>
            {list.map(it => (
              <div key={key(it)} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.6rem 0', borderTop: '1px solid #e2e8f0' }}>
                <button onClick={() => toggle(it)} title={picks.has(key(it)) ? '集めたものから外す' : '集めたものに入れる'}
                  style={{ fontSize: '1.3rem', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>{picks.has(key(it)) ? '⭐' : '☆'}</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {fmt(it.date)}　{it.sid} {it.name}{it.grade ? `（${it.grade}年）` : ''}　{'★'.repeat(it.stars)}
                    {it.cues.length > 0 && <>　{it.cues.map(c => <span key={c} style={{ marginLeft: '0.3rem', padding: '0 0.4rem', borderRadius: '6px', background: '#ecfdf5', color: '#047857' }}>{c}</span>)}</>}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{it.comment}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>)}
    </div>
  );
};
