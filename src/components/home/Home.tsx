import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { stages } from '../../data/stages';
import { Trophy, Lock, BookOpen, Target, Keyboard, Mic, Search, Star, MessageCircleQuestion, Sparkles, Book } from 'lucide-react';
import { Button } from '../ui/Button';
import { useVocabulary } from '../../hooks/useVocabulary';
import { pushToSupabase } from '../../lib/sync';
import { useDictionaryProgress } from '../../hooks/useDictionaryProgress';
import { searchUnit, UnitSearchBox } from '../dictionary/UnitSearch';
import { useAppSettings, type TodayMission } from '../../hooks/useAppSettings';
import { finishedToday, isMissionOpen } from '../../lib/missionGate';
import { useShop } from '../../hooks/useShop';
import { findTitle } from '../../data/shopItems';
import { isMissionDone, MISSION_MULTIPLIER } from '../../lib/missionBonus';
import { DEFAULT_QUIZZES } from '../textbook/textbookQuizData';

// 教科書のミッションは、保存された動画URLが無くても、クイズのidから動画を探して出す
// （2026-09-29「ミッションの教科書クイズを押すと動画ではなくクイズに行く」＝動画ボタンが出ていなかった）
const missionVideo = (m: { route: string; videoUrl?: string }): string | undefined => {
  if (m.videoUrl) return m.videoUrl;
  if (!m.route.startsWith('/textbook')) return undefined;
  const id = new URLSearchParams(m.route.split('?')[1] || '').get('id');
  return DEFAULT_QUIZZES.find(q => q.id === id)?.url || undefined;
};
import { UnitHub } from './UnitHub';
import { SpeakableText } from '../ui/SpeakableText';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const vocabulary = useVocabulary();
  const [earnedBadges, setEarnedBadges] = useState<number[]>([]);
  const [studentName, setStudentName] = useState<string>('ゲスト');
  // タブ状態はURL(?tab=)で持つ。こうするとステージ等から「もどる」で戻ったとき、
  // フォニックス/辞書の一覧画面にちゃんと戻れる（stateだとTOPに戻ってしまうため）。
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'phonics' | 'dictionary' | null) || null;
  const setActiveTab = (tab: 'phonics' | 'dictionary' | null) =>
    setSearchParams(tab ? { tab } : {});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [unitQuery, setUnitQuery] = useState('');   // 単元さがし（2026-10-20）
  const { progress } = useDictionaryProgress();
  const { todayMissions, currentUnit, lockMode } = useAppSettings();
  // 「開くとき」（🏁 さいご／✍️ サインのあと）が効くのは、ミッションだけロックの間だけ
  const missionLock = lockMode === 'missions';
  const gateNote = (m: TodayMission): string => {
    if (!missionLock || isMissionDone(m.route)) return '';
    if (!isMissionOpen(m, todayMissions)) return m.afterSign ? '✍️ 制作物にスタッフのサインをもらってから' : m.final ? '🏁 さいご：ほかのミッションを全部クリアしたら開くよ' : '';
    return m.final ? '🏁 さいご：クリアすると、ほかのモードも使えるよ' : '';
  };
  const { shop } = useShop();
  // 称号は名前の上に小さく出す（子どもの声 2026-10-09「Pumpkin Ghost／Ao のように」）
  const title = findTitle(shop.equippedTitle);
  const studentId = localStorage.getItem('studentId');

  useEffect(() => {
    // Auto-sync local data to Supabase when returning to home
    if (studentId) {
      pushToSupabase(studentId);
    }
  }, [studentId]);

  // Get unique categories for dictionary
  const categories = Array.from(new Set(vocabulary.map(v => v.category)));

  useEffect(() => {
    const studentId = localStorage.getItem('studentId');
    if (!studentId) {
      navigate('/');
      return;
    }

    const dataStr = localStorage.getItem(`student_${studentId}`);
    if (dataStr) {
      const data = JSON.parse(dataStr);
      setEarnedBadges(data.badges || []);
      setStudentName(data.name || 'ゲスト');
    }
  }, [navigate]);

  // 修了証はコアステージ（エクストラ除く）を全部クリアで出す
  const coreStageIds = stages.filter(st => !st.extra).map(st => st.id);
  const allCleared = coreStageIds.every(sid => earnedBadges.includes(sid));

  // 各モードとクリア印の絵文字（単元一覧に表示）
  const MODE_BADGES: { key: 'learn' | 'wordsearch' | 'practice' | 'spelling' | 'voice' | 'qa'; emoji: string }[] = [
    { key: 'learn', emoji: '📖' },
    { key: 'wordsearch', emoji: '🔍' },
    { key: 'practice', emoji: '🎯' },
    { key: 'spelling', emoji: '⌨️' },
    { key: 'voice', emoji: '🎤' },
    { key: 'qa', emoji: '❓' },
  ];

  return (
    <div className="flex-col gap-lg" style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '900px', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="flex-col gap-sm">
          {title && (
            <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#64748b', marginBottom: '-0.4rem', letterSpacing: '0.03em' }}>{title.emoji} {title.name}</div>
          )}
          <h1 className="text-primary" style={{ fontSize: '2.5rem', margin: 0 }}>こんにちは、{studentName}さん！</h1>
          <p style={{ fontSize: '1.2rem', color: '#666', margin: 0 }}>今日も英語を楽しもう！</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div
            className="glass-card animate-pop hover-scale"
            style={{ padding: '0.8rem 1.5rem', cursor: 'pointer', background: 'rgba(72, 219, 251, 0.2)', border: '2px solid var(--color-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => navigate('/progress')}
          >
            <span style={{ fontSize: '1.4rem' }}>🗺️</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#000' }}>自分の記録</span>
          </div>
          <div
            className="glass-card animate-pop hover-scale"
            style={{ padding: '0.8rem 1.5rem', cursor: 'pointer', background: 'rgba(253, 203, 110, 0.2)', border: '2px solid var(--color-accent)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => navigate('/reflection')}
          >
            <Star size={24} color="var(--color-accent)" />
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#000' }}>今日のふりかえり</span>
          </div>
          <div
            className="glass-card animate-pop hover-scale"
            style={{ padding: '0.8rem 1.5rem', cursor: 'pointer', background: 'rgba(29, 209, 161, 0.15)', border: '2px solid var(--color-success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => navigate('/mictest')}
          >
            <span style={{ fontSize: '1.4rem' }}>🎙️</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#000' }}>マイクテスト</span>
          </div>
          <div
            className="glass-card animate-pop hover-scale"
            style={{ padding: '0.8rem 1.5rem', cursor: 'pointer', background: 'rgba(253, 121, 168, 0.18)', border: '2px solid #fd79a8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            onClick={() => navigate('/shop')}
          >
            <span style={{ fontSize: '1.4rem' }}>🎁</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#000' }}>ショップ</span>
          </div>
        </div>
      </div>

      {!activeTab && todayMissions.length > 0 && (
        <div style={{ width: '100%', maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
          {missionLock && finishedToday(todayMissions) && (
            <div className="animate-pop" style={{ padding: '0.9rem 1.2rem', borderRadius: '16px', background: '#00b894', color: 'white', fontWeight: 'bold', fontSize: '1.15rem', textAlign: 'center' }}>
              🎉 さいごのミッションまでクリア！ 今日は ほかのモードも 使えるよ
            </div>
          )}
          {todayMissions.map((mission, i) => (
            <div
              key={mission.route + i}
              className="animate-pop"
              style={{
                padding: '1.2rem 1.5rem', borderRadius: '20px',
                background: 'linear-gradient(135deg, #ff9f43, #ee5253)',
                color: 'white', boxShadow: 'var(--shadow-md)',
                display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap',
                border: '3px solid #fff'
              }}
            >
              <span style={{ fontSize: '2.5rem' }}>🎯</span>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.95rem', fontWeight: 'bold', opacity: 0.9 }}>
                    今日のミッション{todayMissions.length > 1 ? `（${i + 1}つ目）` : ''}
                  </span>
                  {isMissionDone(mission.route) && (
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', background: '#00b894', color: 'white', borderRadius: '999px', padding: '0.1rem 0.6rem', whiteSpace: 'nowrap' }}>✅ 今日クリア</span>
                  )}
                  {/* ここをやると得だと一目で分かるようにする（誘導のかなめ） */}
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', background: 'white', color: '#c0392b', borderRadius: '999px', padding: '0.1rem 0.6rem', whiteSpace: 'nowrap' }}>
                    ⭐ ポイント {MISSION_MULTIPLIER}倍
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}><SpeakableText text={mission.label} /></div>
                {gateNote(mission) && <div style={{ fontSize: '0.95rem', fontWeight: 'bold', opacity: 0.95 }}>{gateNote(mission)}</div>}
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                {missionVideo(mission) && (
                  <button
                    className="hover-scale"
                    onClick={() => window.open(missionVideo(mission), '_blank')}
                    style={{ fontSize: '1.05rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.95)', color: '#c0392b', border: 'none', padding: '0.7rem 1.2rem', borderRadius: '999px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    ① 📺 動画を見る
                  </button>
                )}
                <button
                  className="hover-scale"
                  onClick={() => navigate(mission.route)}
                  style={{ fontSize: '1.05rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.25)', color: 'white', border: '2px solid white', padding: '0.7rem 1.2rem', borderRadius: '999px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {missionVideo(mission) ? '② ✏️ 問題に挑戦' : 'やってみる →'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 今の単元：単元で使うモードをまとめて、達成率を見せる（次にやるものを子どもが選ぶ） */}
      {!activeTab && currentUnit && currentUnit.items.length > 0 && (
        <UnitHub unit={currentUnit} dictProgress={progress} studentId={studentId} todayMissions={todayMissions} />
      )}

      {!activeTab && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '900px', marginBottom: '2rem' }}>
          <div
            className="glass-card flex-col flex-center animate-pop hover-scale"
            style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(255, 107, 107, 0.2)', border: '2px solid #ff6b6b' }}
            onClick={() => setActiveTab('phonics')}
          >
            <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--color-primary)', textAlign: 'center' }}>Phonics</h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666', textAlign: 'center' }}>音と文字のルールを学ぼう！<br/>(全10ステージ)</p>
          </div>

          <div
            className="glass-card flex-col flex-center animate-pop hover-scale"
            style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(72, 219, 251, 0.2)', border: '2px solid #48dbfb' }}
            onClick={() => setActiveTab('dictionary')}
          >
            <h2 style={{ fontSize: '2rem', margin: 0, color: 'var(--color-primary)', textAlign: 'center' }}>Picture Dictionary</h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666', textAlign: 'center' }}>英単語の練習と<br/>ミニゲームで遊ぼう！</p>
          </div>

          <div
            className="glass-card flex-col flex-center animate-pop hover-scale"
            style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(85, 239, 196, 0.2)', border: '2px solid #00b894' }}
            onClick={() => navigate('/textbook')}
          >
            <Book size={40} color="#00b894" style={{ marginBottom: '0.5rem' }} />
            <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#000' }}>教科書モード</h2>
            <p style={{ margin: '0.5rem 0 0.8rem 0', color: '#666', textAlign: 'center' }}>教科書を見て<br/>クイズに挑戦！</p>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                className="hover-scale"
                onClick={(e) => { e.stopPropagation(); navigate('/textbook?grade=5'); }}
                style={{ fontSize: '1rem', fontWeight: 'bold', background: '#00b894', color: '#fff', border: 'none', padding: '0.5rem 1.1rem', borderRadius: '999px', cursor: 'pointer' }}
              >
                5年生
              </button>
              <button
                className="hover-scale"
                onClick={(e) => { e.stopPropagation(); navigate('/textbook?grade=6'); }}
                style={{ fontSize: '1rem', fontWeight: 'bold', background: '#00b894', color: '#fff', border: 'none', padding: '0.5rem 1.1rem', borderRadius: '999px', cursor: 'pointer' }}
              >
                6年生
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
              <button
                className="hover-scale"
                onClick={(e) => { e.stopPropagation(); navigate('/textbook?set=karuizawa'); }}
                style={{ fontSize: '0.95rem', fontWeight: 'bold', background: '#fff', color: '#0984e3', border: '2px solid #0984e3', padding: '0.4rem 1rem', borderRadius: '999px', cursor: 'pointer' }}
              >
                🏔 軽井沢まちクイズ
              </button>
            </div>
          </div>

          <div
            className="glass-card flex-col flex-center animate-pop hover-scale"
            style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(9, 132, 227, 0.15)', border: '2px solid #0984e3' }}
            onClick={() => navigate('/dialogue')}
          >
            <span style={{ fontSize: '40px', marginBottom: '0.5rem' }}>🗣️</span>
            <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#000' }}>ダイアログ</h2>
            <p style={{ margin: '0.5rem 0 0.8rem 0', color: '#666', textAlign: 'center' }}>ペアで話す前の<br/>会話練習！</p>
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                className="hover-scale"
                onClick={(e) => { e.stopPropagation(); navigate('/dialogue?grade=5'); }}
                style={{ fontSize: '1rem', fontWeight: 'bold', background: '#0984e3', color: '#fff', border: 'none', padding: '0.5rem 1.1rem', borderRadius: '999px', cursor: 'pointer' }}
              >
                5年生
              </button>
              <button
                className="hover-scale"
                onClick={(e) => { e.stopPropagation(); navigate('/dialogue?grade=6'); }}
                style={{ fontSize: '1rem', fontWeight: 'bold', background: '#0984e3', color: '#fff', border: 'none', padding: '0.5rem 1.1rem', borderRadius: '999px', cursor: 'pointer' }}
              >
                6年生
              </button>
            </div>
          </div>

          <div
            className="glass-card flex-col flex-center animate-pop hover-scale"
            style={{ padding: '2rem', cursor: 'pointer', background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(217, 70, 239, 0.2) 100%)', border: '2px solid #d946ef' }}
            onClick={() => navigate('/story')}
          >
            <Book size={40} color="#d946ef" style={{ marginBottom: '0.5rem' }} />
            <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#000' }}>お話づくり</h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666', textAlign: 'center' }}>覚えた単語で<br/>物語をつくろう！</p>
          </div>

          <div
            className="glass-card flex-col flex-center animate-pop hover-scale"
            style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(162, 155, 254, 0.2)', border: '2px solid #a29bfe' }}
            onClick={() => navigate('/ai')}
          >
            <Sparkles size={40} color="#a29bfe" style={{ marginBottom: '0.5rem' }} />
            <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#000' }}>AI英会話</h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666', textAlign: 'center' }}>AIキャラクターと<br/>声で英会話！</p>
          </div>

          <div
            className="glass-card flex-col flex-center animate-pop hover-scale"
            style={{ padding: '2rem', cursor: 'pointer', background: 'rgba(0, 184, 148, 0.15)', border: '2px solid #00b894' }}
            onClick={() => navigate('/tree')}
          >
            <span style={{ fontSize: '2.4rem', marginBottom: '0.3rem' }}>🌳</span>
            <h2 style={{ fontSize: '1.5rem', margin: 0, color: '#000' }}>みんなの町</h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666', textAlign: 'center' }}>森を育てて<br/>町をつくろう！</p>
          </div>
        </div>
      )}

      {/* Phonics Progress Dashboard */}
      {activeTab === 'phonics' && (
        <div style={{ width: '100%', maxWidth: '800px' }} className="animate-pop">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <Button variant="outline" onClick={() => setActiveTab(null)} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>← もどる</Button>
            <h2 style={{ flex: 1, textAlign: 'center', color: '#444', margin: 0, marginRight: '80px' }}>Phonics パスポート</h2>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {stages.map((stage) => {
            const isCleared = earnedBadges.includes(stage.id);
            
            return (
              <div 
                key={stage.id}
                className="glass-card flex-col flex-center"
                style={{ 
                  cursor: 'pointer', 
                  transform: isCleared ? 'scale(1.02)' : 'scale(1)',
                  border: isCleared ? `2px solid var(--color-success)` : '1px solid var(--glass-border)',
                  opacity: isCleared ? 1 : 0.8
                }}
                onClick={() => navigate(`/stage/${stage.id}`)}
              >
                <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '1rem' }}>
                  {isCleared ? (
                    <div className="animate-float" style={{ color: 'var(--color-accent)' }}>
                      <Trophy size={80} />
                    </div>
                  ) : (
                    <div style={{ color: 'var(--color-text-muted)' }}>
                      <Lock size={80} />
                    </div>
                  )}
                </div>
                <h3 style={{ textAlign: 'center' }}>Stage {stage.id}</h3>
                <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                  {stage.title}
                </p>
                {isCleared && (
                  <div style={{ marginTop: '0.5rem', color: 'var(--color-success)', fontWeight: 'bold' }}>
                    {stage.badgeName}
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Picture Dictionary Dashboard */}
      {activeTab === 'dictionary' && (
        <div style={{ width: '100%', maxWidth: '800px' }} className="animate-pop">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <Button variant="outline" onClick={() => setActiveTab(null)} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>← もどる</Button>
            <h2 style={{ flex: 1, textAlign: 'center', color: '#444', margin: 0, marginRight: '80px' }}>Picture Dictionary 単元一覧</h2>
          </div>
          {/* 単語実力テスト（子どもの声 2026-10-17・18「この画面でも単語テストが出るように」） */}
          <div className="glass-card hover-scale" onClick={() => navigate('/skilltest')}
            style={{ marginBottom: '0.8rem', padding: '0.9rem 1.2rem', cursor: 'pointer', border: '2px solid #f59e0b', background: 'rgba(245, 158, 11, 0.12)', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <span style={{ fontSize: '1.6rem' }}>🧪</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#b45309' }}>単語実力テスト</div>
              <div style={{ fontSize: '0.85rem', color: '#92700a' }}>習った単語からランダム10問・一発勝負！</div>
            </div>
            <span style={{ fontSize: '1.3rem', color: '#b45309' }}>›</span>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <UnitSearchBox value={unitQuery} onChange={setUnitQuery} total={categories.length}
              count={categories.filter(c => searchUnit(c, unitQuery, vocabulary).match).length} />
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {categories.map((category, idx) => {
              const hit = searchUnit(category, unitQuery, vocabulary);
              if (!hit.match) return null;
              const p = progress[category] || {};
              const cleared = MODE_BADGES.filter(m => (p as any)[m.key]);
              return (
                <div
                  key={idx}
                  className="glass-card flex-col flex-center hover-scale"
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: 'var(--glass-bg)',
                    border: '1px solid var(--glass-border)'
                  }}
                  onClick={() => setExpandedCategory(category)}
                >
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--color-primary)' }}>{category}</h3>
                  <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                    {vocabulary.filter(v => v.category === category).length} words
                  </p>
                  {hit.words.length > 0 && (
                    <p style={{ margin: '0.3rem 0 0 0', color: '#b45309', fontSize: '0.85rem', fontWeight: 'bold' }}>{hit.words.slice(0, 3).join('・')}</p>
                  )}
                  {/* クリアしたモードの印 */}
                  <div style={{ display: 'flex', gap: '0.2rem', marginTop: '0.5rem', minHeight: '1.4rem', fontSize: '1.1rem' }}>
                    {cleared.length === 0
                      ? <span style={{ fontSize: '0.8rem', color: '#bbb' }}>まだ</span>
                      : cleared.map(m => <span key={m.key} title={m.key}>{m.emoji}</span>)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal for Dictionary Category Modes */}
          {expandedCategory && (
            <div className="modal-overlay" onClick={() => setExpandedCategory(null)}>
              <div className="modal-content animate-pop" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={() => setExpandedCategory(null)}>✕</button>
                <h2 className="text-primary" style={{ margin: '0 0 1.5rem 0', textAlign: 'center', fontSize: '1.8rem' }}>【{expandedCategory}】のモードを選ぶ</h2>
                
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', width: '100%' }}>
                  <div
                    className="glass-card flex-col flex-center hover-scale"
                    style={{ padding: '1.5rem', cursor: 'pointer', background: 'rgba(72, 219, 251, 0.2)', position: 'relative' }}
                    onClick={() => navigate(`/dictionary/${encodeURIComponent(expandedCategory)}/learn`)}
                  >
                    <BookOpen size={40} color="var(--color-primary)" style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>学習モード</h3>
                  </div>

                  <div 
                    className="glass-card flex-col flex-center hover-scale" 
                    style={{ padding: '1.5rem', cursor: 'pointer', background: 'rgba(162, 155, 254, 0.2)', position: 'relative' }}
                    onClick={() => navigate(`/dictionary/${encodeURIComponent(expandedCategory)}/game/wordsearch`)}
                  >
                    <Search size={40} color="var(--color-primary)" style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>言葉さがし</h3>
                  </div>

                  <div 
                    className="glass-card flex-col flex-center hover-scale" 
                    style={{ padding: '1.5rem', cursor: 'pointer', background: 'rgba(29, 209, 161, 0.2)', position: 'relative' }}
                    onClick={() => navigate(`/dictionary/${encodeURIComponent(expandedCategory)}/practice`)}
                  >
                    <Target size={40} color="var(--color-primary)" style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>選択モード</h3>
                  </div>

                  {/* ハードもここから選べるように（子どもの声 2026-09-30「最初にモードを選ぶときにもハードを出して」） */}
                  <div 
                    className="glass-card flex-col flex-center hover-scale" 
                    style={{ padding: '1.5rem', cursor: 'pointer', background: 'rgba(238, 82, 83, 0.15)', position: 'relative', border: '2px dashed #ee5253' }}
                    onClick={() => navigate(`/dictionary/${encodeURIComponent(expandedCategory)}/practice?hard=1`)}
                  >
                    <Target size={40} color="#ee5253" style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>🔥 選択（ハード）</h3>
                  </div>

                  <div 
                    className="glass-card flex-col flex-center hover-scale" 
                    style={{ padding: '1.5rem', cursor: 'pointer', background: 'rgba(255, 159, 67, 0.2)', position: 'relative' }}
                    onClick={() => navigate(`/dictionary/${encodeURIComponent(expandedCategory)}/game/spelling`)}
                  >
                    <Keyboard size={40} color="var(--color-primary)" style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>タイピング</h3>
                  </div>

                  <div
                    className="glass-card flex-col flex-center hover-scale"
                    style={{ padding: '1.5rem', cursor: 'pointer', background: 'rgba(0, 184, 148, 0.2)', position: 'relative' }}
                    onClick={() => navigate(`/dictionary/${encodeURIComponent(expandedCategory)}/game/typing`)}
                  >
                    <Keyboard size={40} color="var(--color-primary)" style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>⌨️ タイピング練習</h3>
                  </div>

                  <div
                    className="glass-card flex-col flex-center hover-scale"
                    style={{ padding: '1.5rem', cursor: 'pointer', background: 'rgba(255, 107, 107, 0.2)', position: 'relative' }}
                    onClick={() => navigate(`/dictionary/${encodeURIComponent(expandedCategory)}/game/voice`)}
                  >
                    <Mic size={40} color="var(--color-primary)" style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>モンスターバトル</h3>
                  </div>

                  <div 
                    className="glass-card flex-col flex-center hover-scale" 
                    style={{ padding: '1.5rem', cursor: 'pointer', background: 'rgba(253, 121, 168, 0.2)' }}
                    onClick={() => navigate(`/dictionary/${encodeURIComponent(expandedCategory)}/game/qa`)}
                  >
                    <MessageCircleQuestion size={40} color="var(--color-primary)" style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>QAモード</h3>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {allCleared && (
        <div className="flex-center" style={{ marginTop: '2rem', animation: 'float 3s infinite', gap: '1rem', flexDirection: 'column' }}>
          <Button 
            onClick={() => navigate('/certificate')}
            style={{ fontSize: '1.5rem', padding: '1.5rem 3rem', background: 'var(--color-accent)', color: 'var(--color-text-main)' }}
            icon={Star}
          >
            修了証を見る！
          </Button>
          <div style={{ fontSize: '0.9rem', color: '#475569' }}>フォニックスを全部クリアした証明書だよ。スタッフにサインをもらおう</div>
        </div>
      )}
    </div>
  );
};
