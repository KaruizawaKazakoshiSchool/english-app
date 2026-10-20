import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { stages } from '../../data/stages';

// フォニックス修了証の書き出し（先生用・2026-10-20）。
// コアステージ（エクストラ以外）のバッジを全部持っている子を一覧にし、1人1枚の画像（PNG・A4横）にする。
// 名前は先生のブラウザの中で描くだけ（AIにもサーバーにも送らない）。
// 書き出した子は設定行の certIssued に { 番号: 日付 } で残し、次からは「新しく修了した子」だけを目立たせる。

const CORE_IDS = stages.filter(st => !st.extra).map(st => st.id);
const pad = (n: number) => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const jpDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${y}年${m}月${d}日`; };

// A4横・150dpi。印刷物なので白・黒・赤の3色、飾りは足さない
const W = 1754, H = 1240;
const FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';

const drawCertificate = (name: string, dateIso: string): Promise<Blob | null> => {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  // 外わく（黒）と、上の赤い帯
  g.strokeStyle = '#000'; g.lineWidth = 6; g.strokeRect(60, 60, W - 120, H - 120);
  g.fillStyle = '#d00000'; g.fillRect(60, 60, W - 120, 18);

  g.textAlign = 'center'; g.fillStyle = '#000';
  g.font = `bold 34px ${FONT}`; g.fillText('CERTIFICATE OF COMPLETION', W / 2, 200);
  g.font = `bold 120px ${FONT}`; g.fillText('修了証', W / 2, 340);
  g.font = `bold 40px ${FONT}`; g.fillStyle = '#d00000'; g.fillText('Eigo no Mori  Phonics', W / 2, 420);

  // 名前（長い名前は幅に合わせて小さく）
  g.fillStyle = '#000';
  let size = 110;
  const label = `${name} さん`;
  do { g.font = `bold ${size}px ${FONT}`; size -= 4; } while (g.measureText(label).width > W - 400 && size > 50);
  g.fillText(label, W / 2, 610);
  g.fillRect(W / 2 - 520, 640, 1040, 4);

  g.font = `36px ${FONT}`;
  g.fillText(`あなたは フォニックスの 全${CORE_IDS.length}ステージを クリアし、`, W / 2, 760);
  g.fillText('英語の 音と文字の ルールを 身につけました。ここに その努力を たたえます。', W / 2, 820);

  g.textAlign = 'left'; g.font = `32px ${FONT}`;
  g.fillText(jpDate(dateIso), 200, 1010);
  g.fillText('軽井沢風越学園 英語', 200, 1060);
  g.textAlign = 'center';
  g.fillRect(W - 640, 1040, 440, 3);
  g.font = `26px ${FONT}`; g.fillText('スタッフのサイン', W - 420, 1085);

  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
};

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const CertificateCard: React.FC<{ students: any[] }> = ({ students }) => {
  const [open, setOpen] = useState(false);
  const [issued, setIssued] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!supabase) return;
    supabase.from('students').select('dictionary_progress').eq('id', 'app_settings_v1').maybeSingle()
      .then(({ data }) => setIssued((data?.dictionary_progress as any)?.certIssued || {}));
  }, []);

  const finished = useMemo(() => students
    .filter(s => /^\d+$/.test(s.id) && s.id !== '00' && s.id !== '99')
    .filter(s => CORE_IDS.every(id => (s.badges || []).includes(id)))
    .sort((a, b) => a.id.localeCompare(b.id)), [students]);
  const fresh = finished.filter(s => !issued[s.id]);

  // 書き出した記録を設定行に重ねて保存（ほかの設定は消さない）
  const markIssued = async (ids: string[]) => {
    if (!supabase || ids.length === 0) return;
    const { data } = await supabase.from('students').select('dictionary_progress').eq('id', 'app_settings_v1').maybeSingle();
    const cur = (data?.dictionary_progress as Record<string, any>) || {};
    const next = { ...(cur.certIssued || {}) };
    ids.forEach(id => { if (!next[id]) next[id] = today(); });
    const { error } = await supabase.from('students').update({ dictionary_progress: { ...cur, certIssued: next } }).eq('id', 'app_settings_v1');
    if (!error) setIssued(next);
    else setMsg('⚠️ 書き出しの記録を保存できなかった（ファイルはできているよ）');
  };

  const exportOne = async (s: any) => {
    const blob = await drawCertificate(s.name || `No.${s.id}`, issued[s.id] || today());
    if (blob) download(blob, `修了証_No${s.id}_${s.name || ''}.png`);
  };

  const exportMany = async (list: any[]) => {
    setBusy(true); setMsg('');
    for (const s of list) {
      await exportOne(s);
      await new Promise(r => setTimeout(r, 500)); // まとめてダウンロードがブロックされにくいよう間をあける
    }
    await markIssued(list.map(s => s.id));
    setBusy(false);
    setMsg(`✅ ${list.length}人分を書き出したよ（ダウンロードフォルダ）。ブラウザが「複数のファイルのダウンロード」を聞いてきたら「許可」にしてね`);
  };

  return (
    <div className="glass-card" style={{ padding: '1.2rem', border: fresh.length ? '2px solid #d00000' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <h3 style={{ margin: 0, flex: 1 }}>🎓 フォニックス修了証（{finished.length}人）</h3>
        {fresh.length > 0 && <span style={{ background: '#d00000', color: 'white', borderRadius: '999px', padding: '0.1rem 0.7rem', fontWeight: 'bold', fontSize: '0.85rem' }}>まだ書き出していない {fresh.length}人</span>}
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ marginTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            コアの{CORE_IDS.length}ステージを全部クリアした子。1人1枚の画像（PNG・A4横）でダウンロードフォルダに保存する。名前はこのブラウザの中で描くだけで、どこにも送らない。
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button disabled={busy || fresh.length === 0} onClick={() => exportMany(fresh)}
              style={{ padding: '0.5rem 1rem', fontWeight: 'bold', background: '#d00000', color: 'white', border: 'none', cursor: 'pointer', opacity: busy || !fresh.length ? 0.5 : 1 }}>
              新しく修了した{fresh.length}人を書き出す
            </button>
            <button disabled={busy || finished.length === 0} onClick={() => exportMany(finished)}
              style={{ padding: '0.5rem 1rem', fontWeight: 'bold', background: 'white', border: '2px solid #000', cursor: 'pointer', opacity: busy ? 0.5 : 1 }}>
              全員分（{finished.length}人）を書き出す
            </button>
          </div>
          {msg && <div style={{ fontWeight: 'bold' }}>{msg}</div>}
          <table style={{ borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <tbody>
              {finished.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '0.3rem 0.5rem' }}>{s.id}</td>
                  <td style={{ padding: '0.3rem 0.5rem' }}>{s.name}</td>
                  <td style={{ padding: '0.3rem 0.5rem', color: issued[s.id] ? '#64748b' : '#d00000', fontWeight: issued[s.id] ? 'normal' : 'bold' }}>
                    {issued[s.id] ? `${jpDate(issued[s.id])} 書き出し済み` : 'まだ'}
                  </td>
                  <td style={{ padding: '0.3rem 0.5rem' }}>
                    <button onClick={async () => { await exportOne(s); await markIssued([s.id]); }} style={{ cursor: 'pointer' }}>⬇ 画像</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
