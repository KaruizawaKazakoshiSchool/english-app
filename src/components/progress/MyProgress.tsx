import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSafeBack } from '../../hooks/useSafeBack';
import { ArrowLeft, Star, Trophy } from 'lucide-react';
import { Button } from '../ui/Button';
import { useVocabulary } from '../../hooks/useVocabulary';
import { stages } from '../../data/stages';
import { DEFAULT_QUIZZES } from '../textbook/textbookQuizData';
import { DIALOGUES } from '../dialogue/dialogueData';
import { isArchived } from '../../data/archivedUnits';
import { useDictionaryProgress, type DictCategoryProgress } from '../../hooks/useDictionaryProgress';
import { usePronunciationHistory, type ScoreMode } from '../../hooks/usePronunciationHistory';

const MODE_STYLE: Record<ScoreMode, { color: string; label: string }> = {
  battle: { color: '#ff6b6b', label: 'モンスターバトル' },
  story: { color: '#d946ef', label: 'お話音読' },
  textbook: { color: '#00b894', label: '教科書ボーナス' },
  dialogue: { color: '#0984e3', label: 'ダイアログ' },
  test: { color: '#f59e0b', label: '単語テスト' },
};

// 1カテゴリで挑戦できる4つのスキル。現在地マップの軸になる。
const SKILLS: { key: keyof DictCategoryProgress; label: string; emoji: string; path: string }[] = [
  { key: 'practice', label: '選択', emoji: '🎯', path: 'practice' },
  { key: 'wordsearch', label: '言葉さがし', emoji: '🔍', path: 'game/wordsearch' },
  { key: 'spelling', label: 'タイピング', emoji: '⌨️', path: 'game/spelling' },
  { key: 'voice', label: '発音', emoji: '🎤', path: 'game/voice' },
  { key: 'qa', label: 'Q&A', emoji: '❓', path: 'game/qa' },   // 子どもの声 2026-09-15
];

// 進捗リング（％を円グラフで表示）
const Ring: React.FC<{ pct: number; color: string; label: string; sub: string; emoji: string }> = ({ pct, color, label, sub, emoji }) => {
  const R = 42;
  const C = 2 * Math.PI * R;
  return (
    <div className="glass-card flex-col flex-center" style={{ padding: '1.2rem', gap: '0.4rem' }}>
      <div style={{ position: 'relative', width: '110px', height: '110px' }}>
        <svg width="110" height="110" viewBox="0 0 110 110">
          <circle cx="55" cy="55" r={R} fill="none" stroke="#e2e8f0" strokeWidth="11" />
          <circle
            cx="55" cy="55" r={R} fill="none"
            stroke={color} strokeWidth="11" strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C - (C * pct) / 100}
            transform="rotate(-90 55 55)"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
          <text x="55" y="52" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>{pct}%</text>
          <text x="55" y="72" textAnchor="middle" fontSize="11" fill="#666">{sub}</text>
        </svg>
      </div>
      <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: '#2d3436', textAlign: 'center' }}>{emoji} {label}</div>
    </div>
  );
};

export const MyProgress: React.FC = () => {
  const navigate = useNavigate();
  const goBack = useSafeBack();
  const { progress } = useDictionaryProgress();
  const { history } = usePronunciationHistory();
  const vocabulary = useVocabulary();

  const categories = useMemo(() => Array.from(new Set(vocabulary.map(v => v.category))), [vocabulary]);

  const studentId = localStorage.getItem('studentId');
  const points = parseInt(localStorage.getItem(`points_${studentId}`) || '0', 10);
  const badges: number[] = useMemo(() => {
    const dataStr = studentId ? localStorage.getItem(`student_${studentId}`) : null;
    return dataStr ? (JSON.parse(dataStr).badges || []) : [];
  }, [studentId]);
  const clearCounts: Record<string, number> = useMemo(() => {
    const str = studentId ? localStorage.getItem(`clearCounts_${studentId}`) : null;
    return str ? JSON.parse(str) : {};
  }, [studentId]);

  // 各カテゴリの達成スキル数（0〜4）を計算（Picture Dictionary）
  const catStats = useMemo(() => {
    return categories.map(cat => {
      const p = progress[cat] || {};
      const done = SKILLS.filter(s => (p as any)[s.key]).length;
      return { cat, done, p };
    });
  }, [categories, progress]);

  // ===== 3領域のざっくり進捗 =====
  // フォニックス：クリアしたステージ数 / 全ステージ
  // フォニックス進捗はコアステージ（エクストラ除く）で計算
  const coreStages = stages.filter(st => !st.extra);
  const coreBadgeCount = badges.filter(b => coreStages.some(st => st.id === b)).length;
  const phonicsPct = coreStages.length > 0 ? Math.round((coreBadgeCount / coreStages.length) * 100) : 0;

  // Picture Dictionary：達成スキル数 / (単元数 × 4スキル)
  const dictDone = catStats.reduce((sum, c) => sum + c.done, 0);
  const dictTotal = categories.length * SKILLS.length;
  const dictPct = dictTotal > 0 ? Math.round((dictDone / dictTotal) * 100) : 0;
  const masteredCount = catStats.filter(c => c.done === SKILLS.length).length;

  // 教科書モード：クリアしたUnit数 / 全Unit
  const textbookDone = DEFAULT_QUIZZES.filter(q => (clearCounts[`textbook_quiz_${q.id}`] || 0) > 0).length;
  const textbookPct = DEFAULT_QUIZZES.length > 0 ? Math.round((textbookDone / DEFAULT_QUIZZES.length) * 100) : 0;

  // ダイアログ・お話づくり・AI英会話の記録（子どもの声 2026-10-17「ダイアログとかお話作りの記録もほしい」）
  const dialogueList = DIALOGUES.filter(d => !isArchived(d.id));
  const dialogueDone = dialogueList.filter(d => (clearCounts[`dialogue_${d.id}`] || 0) > 0).length;
  const dialoguePct = dialogueList.length > 0 ? Math.round((dialogueDone / dialogueList.length) * 100) : 0;
  const storyCount = (clearCounts['story_mode'] || 0) + (clearCounts['story_mode_reading'] || 0);
  const aiClearCount = Object.entries(clearCounts).filter(([k]) => k.startsWith('ai_clear_')).reduce((n, [, v]) => n + (v || 0), 0);

  // ===== 発音スコアの推移 =====
  const recent = history.slice(-30);
  const bestScore = history.length ? Math.max(...history.map(h => h.score)) : 0;
  const last10 = history.slice(-10);
  const avgRecent = last10.length ? Math.round(last10.reduce((s, h) => s + h.score, 0) / last10.length) : 0;

  // チャート座標
  const CW = 600, CH = 220, padL = 40, padR = 10, padT = 15, padB = 35;
  const plotW = CW - padL - padR;
  const plotH = CH - padT - padB;
  const xFor = (i: number) => padL + (recent.length <= 1 ? plotW / 2 : (i / (recent.length - 1)) * plotW);
  const yFor = (score: number) => padT + plotH - (score / 100) * plotH;
  const linePoints = recent.map((r, i) => `${xFor(i)},${yFor(r.score)}`).join(' ');

  // 「次にやるといいよ」：まだ達成が少ない順に、最初の未挑戦スキルをおすすめ
  const recommendations = useMemo(() => {
    return catStats
      .filter(c => c.done < SKILLS.length)
      .sort((a, b) => a.done - b.done)
      .slice(0, 3)
      .map(c => {
        const nextSkill = SKILLS.find(s => !(c.p as any)[s.key])!;
        return { cat: c.cat, skill: nextSkill };
      });
  }, [catStats]);

  const colorFor = (done: number) => {
    if (done === SKILLS.length) return { bg: 'rgba(0, 184, 148, 0.15)', border: '#00b894', label: 'マスター！', labelColor: '#00b894' };
    if (done > 0) return { bg: 'rgba(253, 203, 110, 0.15)', border: '#fdcb6e', label: 'がんばり中', labelColor: '#b45309' };
    return { bg: 'rgba(0,0,0,0.03)', border: '#e2e8f0', label: 'まだ', labelColor: '#94a3b8' };
  };

  return (
    <div className="flex-col gap-lg" style={{ flex: 1, maxWidth: '900px', margin: '0 auto', width: '100%', paddingBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button variant="outline" onClick={goBack} icon={ArrowLeft}>もどる</Button>
        <h1 className="text-primary" style={{ flex: 1, textAlign: 'center', margin: 0, fontSize: '1.8rem', marginRight: '90px' }}>
          🗺️ 自分の記録
        </h1>
      </div>

      {/* 3領域のざっくり進捗 */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        <Ring pct={phonicsPct} color="#ff6b6b" emoji="🔤" label="Phonics" sub={`${coreBadgeCount}/${coreStages.length}`} />
        <Ring pct={dictPct} color="#48dbfb" emoji="📚" label="Picture Dictionary" sub={`${masteredCount}/${categories.length} 単元`} />
        <Ring pct={textbookPct} color="#00b894" emoji="📖" label="教科書モード" sub={`${textbookDone}/${DEFAULT_QUIZZES.length} Unit`} />
        <Ring pct={dialoguePct} color="#0984e3" emoji="🗣️" label="ダイアログ" sub={`${dialogueDone}/${dialogueList.length} 会話`} />
      </div>

      {/* お話づくり・AI英会話（回数で見せる） */}
      <div className="glass-card" style={{ padding: '1rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', fontSize: '1.1rem' }}>
        <span>📚 お話づくり <strong>{storyCount}</strong> 回</span>
        <span>🤖 AI英会話 クリア <strong>{aiClearCount}</strong> 回</span>
      </div>

      {/* ポイント・トロフィー */}
      <div className="glass-card" style={{ padding: '1.2rem', display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
          <Star size={24} color="var(--color-accent)" fill="var(--color-accent)" />
          <span><strong>{points}</strong> ポイント</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.2rem' }}>
          <Trophy size={24} color="var(--color-accent)" />
          <span>バッジ <strong>{badges.length}</strong> 個</span>
        </div>
      </div>

      {/* これまでのふりかえりへ（自分の記録からも飛べるように） */}
      <button
        className="glass-card hover-scale"
        onClick={() => navigate('/reflection/history')}
        style={{ padding: '1.1rem 1.4rem', display: 'flex', alignItems: 'center', gap: '0.9rem', cursor: 'pointer', border: '2px solid #f59e0b', background: 'rgba(245, 158, 11, 0.12)', textAlign: 'left', width: '100%' }}
      >
        <span style={{ fontSize: '1.8rem' }}>📔</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#b45309' }}>これまでのふりかえりを見る</div>
          <div style={{ fontSize: '0.85rem', color: '#92700a' }}>今までに書いたふりかえりと、スタッフからのコメントが読めるよ</div>
        </div>
        <span style={{ fontSize: '1.3rem', color: '#b45309' }}>›</span>
      </button>

      {/* 発音スコアの推移グラフ */}
      <div className="glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, color: 'var(--color-primary)' }}>🎤 発音スコアの記録</h3>
          {history.length > 0 && (
            <div style={{ display: 'flex', gap: '1.2rem', fontSize: '0.95rem', color: '#555' }}>
              <span>直近平均 <strong style={{ color: 'var(--color-primary)' }}>{avgRecent}</strong>点</span>
              <span>最高 <strong style={{ color: 'var(--color-accent)' }}>{bestScore}</strong>点</span>
              <span>記録 <strong>{history.length}</strong>回</span>
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
            まだ発音の記録がないよ。<br/>
            モンスターバトル・お話音読・教科書のボーナスでマイクを使うと、ここに点数の記録がたまっていくよ！
          </div>
        ) : (
          <>
            <svg width="100%" viewBox={`0 0 ${CW} ${CH}`} style={{ display: 'block' }}>
              {/* 目盛り線 0/50/100 */}
              {[0, 50, 100].map(v => (
                <g key={v}>
                  <line x1={padL} y1={yFor(v)} x2={CW - padR} y2={yFor(v)} stroke="#e2e8f0" strokeWidth="1" />
                  <text x={padL - 6} y={yFor(v) + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{v}</text>
                </g>
              ))}
              {/* 合格ライン60点 */}
              <line x1={padL} y1={yFor(60)} x2={CW - padR} y2={yFor(60)} stroke="#00b894" strokeWidth="1" strokeDasharray="4 4" opacity="0.6" />
              {/* 推移の線 */}
              {recent.length > 1 && (
                <polyline points={linePoints} fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              )}
              {/* 各回の点（活動ごとに色分け） */}
              {recent.map((r, i) => (
                <circle key={r.ts} cx={xFor(i)} cy={yFor(r.score)} r="4.5" fill={MODE_STYLE[r.mode]?.color || '#888'} stroke="white" strokeWidth="1.5">
                  <title>{`${MODE_STYLE[r.mode]?.label || r.mode}: ${r.score}点 (${r.label})`}</title>
                </circle>
              ))}
            </svg>

            {/* 凡例 */}
            <div style={{ display: 'flex', gap: '1.2rem', justifyContent: 'center', marginTop: '0.8rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#555' }}>
              {(Object.keys(MODE_STYLE) as ScoreMode[]).map(m => (
                <span key={m} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: MODE_STYLE[m].color, display: 'inline-block' }} />
                  {MODE_STYLE[m].label}
                </span>
              ))}
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', margin: '0.5rem 0 0 0' }}>
              ※ 直近{recent.length}回ぶんのスコアを表示
            </p>

            {/* 最近の記録リスト（タップでも見える） */}
            <div style={{ marginTop: '1rem' }}>
              <div style={{ fontWeight: 'bold', color: '#555', marginBottom: '0.5rem', fontSize: '0.95rem' }}>最近の記録</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {[...history].slice(-8).reverse().map(r => (
                  <div key={r.ts} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem 0.7rem', background: 'rgba(0,0,0,0.03)', borderRadius: '8px' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: MODE_STYLE[r.mode]?.color || '#888', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 'bold', color: '#2d3436', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', flexShrink: 0 }}>{MODE_STYLE[r.mode]?.label}</span>
                    <span style={{ fontWeight: 'bold', flexShrink: 0, color: r.score >= 60 ? 'var(--color-success)' : 'var(--color-error)' }}>{r.score}点</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* おすすめ */}
      {recommendations.length > 0 && (
        <div className="glass-card" style={{ padding: '1.5rem', background: 'rgba(162, 155, 254, 0.12)', border: '2px solid #a29bfe' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: '#6c5ce7' }}>✨ 次にやってみよう！</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem' }}>
            {recommendations.map(({ cat, skill }) => (
              <button
                key={cat + skill.key}
                className="hover-scale"
                onClick={() => navigate(`/dictionary/${encodeURIComponent(cat)}/${skill.path}`)}
                style={{ padding: '0.8rem 1.2rem', borderRadius: '12px', border: '2px solid #a29bfe', background: 'white', cursor: 'pointer', fontWeight: 'bold', color: '#6c5ce7', fontSize: '1rem' }}
              >
                {skill.emoji} {cat} の{skill.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Picture Dictionary 単元ごとの現在地 */}
      <div>
        <h3 style={{ margin: '0 0 0.3rem 0', color: 'var(--color-primary)' }}>📍 Picture Dictionary 単元ごとの現在地</h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.85rem', color: '#64748b' }}>
          9月16日から <b>❓Q&amp;A</b> も 仲間に入ったよ（ぜんぶで {SKILLS.length}つ）。
          そのため「マスター！」だった単元が「がんばり中」に もどって見えることがあるよ。記録は 消えていないよ
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
          {catStats.map(({ cat, done, p }) => {
            const c = colorFor(done);
            return (
              <div
                key={cat}
                className="glass-card hover-scale"
                style={{ padding: '1.2rem', background: c.bg, border: `2px solid ${c.border}`, cursor: 'pointer' }}
                onClick={() => navigate(`/dictionary/${encodeURIComponent(cat)}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#2d3436' }}>{cat}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: c.labelColor }}>{c.label}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between' }}>
                  {SKILLS.map(s => {
                    const ok = !!(p as any)[s.key];
                    return (
                      <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', opacity: ok ? 1 : 0.35 }}>
                        <div style={{ fontSize: '1.4rem', filter: ok ? 'none' : 'grayscale(1)' }}>{s.emoji}</div>
                        <div style={{ fontSize: '0.7rem', color: ok ? c.labelColor : '#94a3b8' }}>{ok ? '✓' : '−'}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '0.8rem', height: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${(done / SKILLS.length) * 100}%`, height: '100%', background: c.border, transition: 'width 0.4s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
