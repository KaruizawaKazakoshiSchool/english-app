import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { STUDENTS } from '../../data/students';
import { pullFromSupabase, pushToSupabase } from '../../lib/sync';
import { supabase } from '../../lib/supabase';
import { checkStaffPin } from '../../lib/aiProxy';
import { findFrame, findTitle } from '../../data/shopItems';
import { RecentUpdates } from './RecentUpdates';
import { GUEST_ID, GUEST_NAME, resetGuestData } from '../../lib/trial';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [classFilter, setClassFilter] = useState<'all' | 'A' | 'B'>('all');
  const visibleStudents = STUDENTS.filter(s => classFilter === 'all' || s.cls === classFilter);

  // 学園のGoogleで入った人は、名前を選ばずに自分の記録へ（段階②・試験中）。
  // 名簿の email と一致する行だけ。合わなければ案内して、Googleからぬける
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || '';
      if (!email || email.endsWith('@kazakoshi.app')) return;   // クラス共用アカウント＝今までどおり名前を選ぶ
      const { data } = await supabase.rpc('my_student');
      const me = Array.isArray(data) ? data[0] : null;
      if (me?.id) { doLogin(me.id, me.name); return; }
      setGoogleMsg('この 学園アカウントは、まだ 名簿に つながっていないよ。先生に 伝えてね');
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 各生徒の装備中称号の絵文字（名前タイルに表示して競争心を後押し）。
  // fetch失敗してもログインは妨げない（絵文字なしで普通に表示）。
  const [titleEmojiById, setTitleEmojiById] = useState<Record<string, string>>({});
  // 名前のわく色（ショップで買った子だけ。子どもの声 2026-09-22）
  const [frameById, setFrameById] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase!.from('students').select('id, shop');
      if (!data) return;
      const map: Record<string, string> = {};
      const frames: Record<string, string> = {};
      data.forEach((r: any) => {
        const emoji = findTitle(r.shop?.equippedTitle)?.emoji;
        if (emoji) map[r.id] = emoji;
        const fr = findFrame(r.shop?.equippedFrame);
        if (fr) frames[r.id] = fr.color;
      });
      setTitleEmojiById(map);
      setFrameById(frames);
    })();
  }, []);

  // PIN入力モーダル（●●●●表示。モニター投影中でも見えないように）。
  // Testログインとスタッフ用画面の入口を兼ねる。
  const [pinTarget, setPinTarget] = useState<'test' | 'staff' | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const openPinModal = (target: 'test' | 'staff') => {
    setPinInput('');
    setPinError(false);
    setPinTarget(target);
  };

  const [pinChecking, setPinChecking] = useState(false);
  const handlePinSubmit = async () => {
    if (pinChecking) return;
    setPinChecking(true);
    const ok = await checkStaffPin(pinInput);
    setPinChecking(false);
    if (ok) {
      const target = pinTarget;
      setPinTarget(null);
      setPinInput('');
      setPinError(false);
      if (target === 'test') {
        doLogin('00', 'Test');
      } else {
        // 認証済みフラグ（このタブの間だけ有効）を立てて、PIN画面をスキップして直行
        sessionStorage.setItem('staff_authed', '1');
        navigate('/teacher');
      }
    } else {
      setPinError(true);
      setPinInput('');
    }
  };

  const handleLogin = async (studentId: string, studentName: string) => {
    // Testユーザー（id: 00）はスタッフ専用：PINを知らないと入れない。
    // その代わり全体ロック中でもロックされない（デモ用）ので、子どもに使わせない。
    if (studentId === '00') {
      openPinModal('test');
      return;
    }
    doLogin(studentId, studentName);
  };

  const doLogin = async (studentId: string, studentName: string) => {
    localStorage.setItem('studentId', studentId);
    localStorage.setItem('studentName', studentName);
    
    // Pull existing data from Supabase
    const hasData = await pullFromSupabase(studentId);
    
    // Initialize local entry if new
    const dataKey = `student_${studentId}`;
    if (!hasData && !localStorage.getItem(dataKey)) {
      localStorage.setItem(dataKey, JSON.stringify({
        id: studentId,
        name: studentName,
        badges: [],
        lastAccess: new Date().toISOString()
      }));
    } else {
      const dataStr = localStorage.getItem(dataKey);
      if (dataStr) {
        const data = JSON.parse(dataStr);
        data.lastAccess = new Date().toISOString();
        localStorage.setItem(dataKey, JSON.stringify(data));
      }
    }
    
    // Push the updated lastAccess (or new profile) back to Supabase
    await pushToSupabase(studentId);

    navigate('/home');
  };

  return (
    <div className="flex-col gap-lg" style={{ flex: 1, padding: '2rem' }}>
      <div className="flex-col flex-center gap-sm">
        <h1 className="text-primary" style={{ fontSize: '3rem' }}>Eigo no Mori 🌳</h1>
        <p style={{ fontSize: '1.2rem' }}>名前をタップして始めよう！</p>
      </div>

      {googleMsg && (
        <div style={{ background: '#fff7ed', border: '2px solid #f59e0b', borderRadius: '12px', padding: '0.8rem 1rem', textAlign: 'center', fontWeight: 'bold' }}>
          {googleMsg}
          <div><button className="btn" style={{ marginTop: '0.5rem' }} onClick={() => supabase.auth.signOut()}>ぬける</button></div>
        </div>
      )}

      <RecentUpdates />

      {/* 学年の色わけ凡例 */}
      <div className="flex-center" style={{ gap: '1.5rem', marginTop: '0.5rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'var(--color-secondary)', display: 'inline-block' }} />
          5年生
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'var(--color-primary)', display: 'inline-block' }} />
          6年生
        </span>
      </div>

      {/* A/B クラスのしぼりこみ（5・6年はAB2クラス） */}
      <div className="flex-center" style={{ gap: '0.5rem', marginTop: '0.5rem' }}>
        {([['all', 'すべて'], ['A', '56A'], ['B', '56B']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setClassFilter(v)}
            style={{ padding: '0.4rem 1.1rem', borderRadius: '999px', border: '2px solid var(--color-primary)', cursor: 'pointer', fontWeight: 'bold',
              background: classFilter === v ? 'var(--color-primary)' : 'white', color: classFilter === v ? 'white' : 'var(--color-primary)' }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="student-grid" style={{ marginTop: '1rem' }}>
        {visibleStudents.map((student) => (
          <button
            key={student.id}
            className="btn"
            style={{
              padding: '0.8rem 1rem',
              fontSize: '1rem',
              borderRadius: 'var(--radius-sm)',
              background: student.grade === 5 ? 'var(--color-secondary)' : 'var(--color-primary)',
              color: 'white',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
              ...(frameById[student.id] === 'rainbow'
                ? { border: '4px solid transparent', borderImage: 'linear-gradient(90deg,#f87171,#fbbf24,#34d399,#60a5fa,#a78bfa) 1' }
                : frameById[student.id] ? { border: `4px solid ${frameById[student.id]}` } : {}),
            }}
            onClick={() => handleLogin(student.id, student.name)}
            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
          >
            <span>{student.id}. {student.name}{titleEmojiById[student.id] || ''}</span>
            {student.cls && (
              <span style={{ background: 'white', color: student.cls === 'A' ? '#d97706' : '#0891b2', fontWeight: 'bold', fontSize: '0.8rem', padding: '0.05rem 0.5rem', borderRadius: '999px' }}>
56{student.cls}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-center" style={{ marginTop: '4rem', gap: '1rem', flexWrap: 'wrap' }}>
        {/* おうちの人・見学の方向け。PIN不要・記録はこの端末だけ・ポイントはたまらない・ロックはかかる */}
        <button
          className="btn btn-outline"
          onClick={() => { resetGuestData(); doLogin(GUEST_ID, GUEST_NAME); }}
          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
        >
          👪 おためし（おうちの人・見学の方）
        </button>
        <button
          className="btn btn-outline"
          onClick={() => openPinModal('staff')}
          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
        >
          スタッフ用画面 (Staff)
        </button>
      </div>

      {/* PIN入力モーダル（Test／スタッフ用画面 共用。●●●●表示で投影中も番号が見えない） */}
      {pinTarget && (
        <div
          onClick={() => setPinTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="animate-pop"
            style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', maxWidth: '90vw' }}
          >
            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#2d3436' }}>
              {pinTarget === 'test' ? '🔒 Testユーザーはスタッフ専用です' : '🔒 スタッフ用画面をひらきます'}
            </div>
            <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>PINを入力してください</p>
            <input
              type="password"
              autoFocus
              value={pinInput}
              onChange={e => { setPinInput(e.target.value); setPinError(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handlePinSubmit(); }}
              maxLength={20}
              autoComplete="one-time-code"
              style={{ fontSize: '1.6rem', textAlign: 'center', width: '260px', maxWidth: '100%', padding: '0.5rem', borderRadius: '8px', border: `2px solid ${pinError ? 'var(--color-error)' : '#ccc'}`, letterSpacing: '0.2rem' }}
            />
            {pinError && <div style={{ color: 'var(--color-error)', fontWeight: 'bold', fontSize: '0.9rem' }}>PINが違います</div>}
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button className="btn btn-outline" onClick={() => setPinTarget(null)} style={{ padding: '0.5rem 1.2rem' }}>やめる</button>
              <button className="btn" onClick={handlePinSubmit} style={{ padding: '0.5rem 1.6rem', background: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>ログイン</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
