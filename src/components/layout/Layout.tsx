import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, LogOut, Star, Coins } from 'lucide-react';
import { usePoints } from '../../hooks/usePoints';
import { useAppSettings } from '../../hooks/useAppSettings';
import { useShop } from '../../hooks/useShop';
import { findTitle } from '../../data/shopItems';
import { GlobalLockScreen } from '../ui/GlobalLockScreen';
import { recordActivity, labelForHash } from '../../lib/activityLog';
import { stages } from '../../data/stages';
import { FeedbackButton } from '../ui/FeedbackButton';
import { SpendGate } from '../ui/SpendGate';

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const { totalPoints } = usePoints();
  const { lockMode, todayMissions } = useAppSettings();
  const { shop, balance } = useShop();

  // Basic mock auth check (to be replaced with real context later)
  const studentId = localStorage.getItem('studentId');

  // 「さっき何をやったか」をここ1か所で記録する（ふりかえり画面で思い出す材料にする）。
  // 画面ごとにコードを足さなくて済むよう、URLから活動名を作っている。
  const location = useLocation();
  // 画面が変わったら一番上から見せる（子どもの声 2026-10-17「Picture Dictionary を選ぶと中間くらいで開く」）。
  // 前の画面のスクロール位置が残り、上にある「単語実力テスト」なども見えなくなっていた
  useEffect(() => {
    // 「今の単元」から入った画面の「もどる」は、トップの今の単元の位置へ（lib/hubReturn）
    const anchor = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (anchor) {
      // 今の単元は設定を読み込んでから出るので、出てくるまで少し待つ（最大2秒）
      let tries = 0;
      const t = setInterval(() => {
        const el = document.getElementById(anchor);
        if (el || ++tries > 20) { clearInterval(t); el?.scrollIntoView({ block: 'start' }); }
      }, 100);
      return () => clearInterval(t);
    }
    window.scrollTo(0, 0);
  }, [location.pathname, location.search, location.state]);
  useEffect(() => {
    if (!studentId) return;
    const dict: Record<string, string> = {};
    stages.forEach(st => { dict[`stage_${st.id}`] = st.title; });
    const label = labelForHash(location.pathname + location.search, dict);
    if (label) recordActivity(label);
  }, [location.pathname, location.search, studentId]);

  // 装備中テーマ・背景画像を画面全体に適用する
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = shop.equippedTheme || '';
    // グラデーションのテーマ（背景写真をつけているときは写真が勝つ）
    const gradientTheme = !!shop.equippedTheme && getComputedStyle(root).getPropertyValue('--theme-gradient').trim() !== '';
    document.body.classList.toggle('has-theme-gradient', gradientTheme && !(shop.bgImage && shop.bgOn));
    if (shop.bgImage && shop.bgOn) {
      // 白の半透明オーバーレイで文字の可読性を確保
      document.body.style.backgroundImage =
        `linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.82)), url("${shop.bgImage}")`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      document.body.style.backgroundImage = '';
    }
    return () => {
      root.dataset.theme = '';
      document.body.style.backgroundImage = '';
    };
  }, [shop.equippedTheme, shop.bgImage, shop.bgOn]);

  const title = findTitle(shop.equippedTitle);   // 名前の上に小さく出す（子どもの声 2026-10-09）

  const handleLogout = () => {
    localStorage.removeItem('studentId');
    localStorage.removeItem('studentName');
    navigate('/');
  };

  return (
    <div className="app-container">
      <SpendGate />
      <GlobalLockScreen mode={lockMode} missions={todayMissions} />
      {studentId && (
        <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              onClick={() => navigate('/home')} 
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
            >
              <Home size={20} />
              ホーム
            </button>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
              {title && (
                <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>{title.emoji} {title.name}</span>
              )}
              <h2 className="text-primary" style={{ margin: 0 }}>
                こんにちは、{localStorage.getItem('studentName')}さん！
              </h2>
            </div>
            {/* ポイントは2種類ある。ひとつの帯に並べると読み違えるので、
                「これまでの合計（減らない記録）」と「いま 使える（残高）」を
                別々のカードにして、ラベルを数字の上に置く。 */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
              <div
                title="これまでに ためた 全部の ポイント。使っても 減りません。"
                style={{ background: 'rgba(253, 203, 110, 0.28)', border: '2px solid var(--color-accent)', borderRadius: '14px', padding: '0.3rem 0.9rem', minWidth: '108px', textAlign: 'center' }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#7a5a00', letterSpacing: '0.02em' }}>これまでの合計</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '1.15rem', fontWeight: 'bold', color: '#000', lineHeight: 1.2 }}>
                  <Star fill="var(--color-accent)" stroke="var(--color-accent)" size={16} />
                  {totalPoints.toLocaleString()}<span style={{ fontSize: '0.8rem' }}>P</span>
                </div>
              </div>
              <div
                title="いま 使える ポイント。合計から、ショップで 使った分と 町に入れた分を 引いた 残りです。"
                style={{ background: 'rgba(253, 121, 168, 0.16)', border: '2px solid #fd79a8', borderRadius: '14px', padding: '0.3rem 0.9rem', minWidth: '108px', textAlign: 'center' }}
              >
                <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#b83280', letterSpacing: '0.02em' }}>いま 使える</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '1.15rem', fontWeight: 'bold', color: '#000', lineHeight: 1.2 }}>
                  <Coins size={16} color="#fd79a8" />
                  {balance.toLocaleString()}<span style={{ fontSize: '0.8rem' }}>P</span>
                </div>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleLogout} 
            className="btn btn-outline"
            style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
          >
            <LogOut size={20} />
            おわる
          </button>
        </header>
      )}

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>

      {/* 画面の右下から、いつでも「困った／こうしたい」を送れる */}
      {studentId && <FeedbackButton />}
    </div>
  );
};
