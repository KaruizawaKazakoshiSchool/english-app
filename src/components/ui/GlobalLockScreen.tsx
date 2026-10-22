import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Lock, PenLine } from 'lucide-react';
import { STAFF_TEST_ID } from '../../lib/trial';
import type { TodayMission } from '../../hooks/useAppSettings';
import { isMissionDone, isOnMission } from '../../lib/missionBonus';
import { isSignUnlocked, unlockWithSignPin, SIGN_FREE_MINUTES } from '../../lib/signUnlock';
import { finishedToday, isMissionOpen } from '../../lib/missionGate';
import { LockActiveMarker } from '../../lib/lockPause';

export type LockMode = 'none' | 'screen' | 'reflection' | 'missions';

// 全員の画面にかぶせるロック。
//   screen     … 何もできない（スタッフの話を聞く）
//   reflection … ふりかえりを書く画面と、ショップ・みんなの木だけ使える（2026-10-23〜）。ほかの画面ではこのロックが出て、ボタンで ふりかえりへ
//   missions   … 今日のミッションの画面（とトップ・ふりかえり）だけ使える。ミッションごとの「開くとき」は lib/missionGate
//                （🏁 さいご＝ほかを全部クリアしたら開き、クリアでその日ロックなし／✍️ サインのあと＝合言葉で30分ロックなし）
export const GlobalLockScreen: React.FC<{ mode: LockMode; missions?: TodayMission[] }> = ({ mode, missions = [] }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [pin, setPin] = useState(''); const [pinMsg, setPinMsg] = useState(''); const [, force] = useState(0);
  // 30分たったらロックにもどす（画面を開いたままでも）
  useEffect(() => {
    if (mode !== 'missions') return;
    const t = setInterval(() => force(x => x + 1), 20000);
    return () => clearInterval(t);
  }, [mode]);

  // Test（00）はロック対象外（ロック中にスタッフがデモを見せられるように）。
  // TestのログインにはPINが必要なので、子どもがここを抜け道にはできない。
  // おためし（99）はPIN無しで入れるので、子どもと同じにロックする。
  if (mode === 'none' || localStorage.getItem('studentId') === STAFF_TEST_ID) return null;

  const onReflection = location.pathname.startsWith('/reflection');
  // ふりかえりロック中も、ショップとみんなの木には入れる（ためたポイントを使う時間にする）
  const onShopOrTree = location.pathname.startsWith('/shop') || location.pathname.startsWith('/tree');
  if (mode === 'reflection' && (onReflection || onShopOrTree)) return null;

  // ── ミッションロック
  let blocked: TodayMission | null = null;
  if (mode === 'missions') {
    if (onReflection || location.pathname === '/home' || location.pathname === '/') return null;
    if (isSignUnlocked() || finishedToday(missions)) return null;
    const here = location.pathname + location.search;
    const hit = missions.find(m => m.route && isOnMission(here, m.route));
    if (hit && isMissionOpen(hit, missions)) return null;
    if (hit) blocked = hit;
  }
  const signBlocked = blocked?.afterSign ? blocked : null;
  const unlock = async () => {
    const ok = await unlockWithSignPin(pin);
    setPin('');
    if (ok) { setPinMsg(''); force(x => x + 1); }
    else setPinMsg('ちがうよ（スタッフが入れてね）');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(10px)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      textAlign: 'center',
      padding: '1rem',
    }}>
      <LockActiveMarker />
      {mode === 'missions' ? (
        <>
          <div style={{ fontSize: '4rem' }}>{signBlocked ? '✍️' : blocked ? '🏁' : '🎯'}</div>
          <h1 style={{ color: 'white', fontSize: '2.6rem', margin: 0 }}>{signBlocked ? 'スタッフのサインのあとで 使えるよ' : blocked ? 'ほかのミッションを 全部クリアしたら 使えるよ' : '今は 今日のミッションだけ 使えるよ'}</h1>
          <p style={{ fontSize: '1.3rem', marginTop: '1rem', color: '#ccc' }}>
            {signBlocked ? `「${signBlocked.label}」は、制作物にサインをもらってから。`
              : blocked ? `「${blocked.label}」は さいごのミッション。クリアすると、ほかのモードも使えるよ。`
              : 'ミッションを選んでね。'}
          </p>
          {!signBlocked && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginTop: '0.4rem' }}>
              {missions.map(m => {
                const open = isMissionOpen(m, missions);
                return (
                  <button key={m.route} onClick={() => navigate(m.route)}
                    style={{ padding: '0.8rem 1.6rem', fontSize: '1.2rem', fontWeight: 'bold', borderRadius: '999px', border: 'none', cursor: 'pointer', background: open ? 'var(--color-accent)' : '#b2bec3', color: '#222' }}>
                    {isMissionDone(m.route) ? '✅ ' : !open ? (m.afterSign ? '✍️ ' : '🏁 ') : '🎯 '}{m.label}
                    {!open && (m.afterSign ? '（サインのあと）' : '（ほかを全部クリアしたら）')}
                  </button>
                );
              })}
            </div>
          )}
          {/* サインの合言葉はここ1か所。スタッフが子どもの端末で入れる */}
          <p style={{ color: '#ccc', margin: '1.6rem 0 0.5rem' }}>
            ✍️ サインをもらったら、スタッフが合言葉を入れるよ（{SIGN_FREE_MINUTES}分、ほかの画面も使える）
          </p>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* type="password" にすると、子どもの端末のブラウザが「パスワードを保存しますか？」と聞いてくる。
                文字欄＋伏せ字（-webkit-text-security）にして、保存・自動入力の対象にしない */}
            <input type="text" value={pin} onChange={e => { setPin(e.target.value); setPinMsg(''); }}
              onKeyDown={e => { if (e.key === 'Enter') unlock(); }} placeholder="サインの合言葉"
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
              data-lpignore="true" data-1p-ignore="true" data-form-type="other"
              style={{ fontSize: '1.2rem', padding: '0.5rem 1rem', borderRadius: '12px', border: 'none', width: '12rem', WebkitTextSecurity: 'disc' } as React.CSSProperties} />
            <button onClick={unlock} style={{ padding: '0.6rem 1.5rem', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '999px', border: 'none', cursor: 'pointer', background: 'white', color: '#222' }}>ひらく</button>
          </div>
          {pinMsg && <p style={{ color: '#ff7675', fontWeight: 'bold', margin: '0.5rem 0 0' }}>{pinMsg}</p>}
          <button onClick={() => navigate('/home')} style={{ marginTop: '1.4rem', padding: '0.7rem 2rem', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '999px', border: '2px solid white', cursor: 'pointer', background: 'transparent', color: 'white' }}>← トップにもどる</button>
        </>
      ) : mode === 'reflection' ? (
        <>
          <PenLine size={80} color="var(--color-accent)" className="animate-pop" style={{ marginBottom: '2rem' }} />
          <h1 style={{ color: 'white', fontSize: '3.2rem', margin: 0 }}>✏️ ふりかえりの時間です</h1>
          <p style={{ fontSize: '1.4rem', marginTop: '1rem', color: '#ccc' }}>
            今は ふりかえりと、ショップ・みんなの木だけ 使えます。
          </p>
          <button
            onClick={() => navigate('/reflection')}
            className="animate-pop"
            style={{ marginTop: '2rem', padding: '1rem 2.5rem', fontSize: '1.5rem', fontWeight: 'bold', borderRadius: '999px', border: 'none', cursor: 'pointer', background: 'var(--color-accent)', color: '#222', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            ふりかえりを書く →
          </button>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => navigate('/shop')}
              style={{ padding: '0.7rem 1.8rem', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '999px', border: '2px solid white', cursor: 'pointer', background: 'transparent', color: 'white' }}>
              🛍️ ショップ
            </button>
            <button onClick={() => navigate('/tree')}
              style={{ padding: '0.7rem 1.8rem', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '999px', border: '2px solid white', cursor: 'pointer', background: 'transparent', color: 'white' }}>
              🌳 みんなの木
            </button>
          </div>
        </>
      ) : (
        <>
          <Lock size={80} color="var(--color-accent)" className="animate-pop" style={{ marginBottom: '2rem' }} />
          <h1 style={{ color: 'white', fontSize: '4rem', margin: 0 }}>👀 スタッフのお話を聞きましょう！</h1>
          <p style={{ fontSize: '1.5rem', marginTop: '1rem', color: '#ccc' }}>
            画面がロックされています。スタッフの指示を待ってください。
          </p>
        </>
      )}
    </div>
  );
};
