import { ensureSpendAllowed } from '../../lib/spendPin';
import { TownScene } from './TownScene';
import { SpendLockedNotice } from '../ui/SpendGate';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { STUDENTS, isRosterLoaded, loadRoster } from '../../data/students';
import { useShop } from '../../hooks/useShop';
import { useAppSettings } from '../../hooks/useAppSettings';
import { Button } from '../ui/Button';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { showToast } from '../ui/Toast';
import {
  FOREST_STAGES, TOWN_OPEN, pickCandidates, type TownBuilding,
} from '../../data/townItems';

// みんなの町（もと「クラスの木」）。
// 木 → 森（〜TOWN_OPEN）→ 町ひらき → 建物を建てる、と積み上がる。
// 寄付は個人(shop.donated)に記録し、表示時にチームで集計する（組分けの切替に強い）。
// 建物への配分は town_state テーブル（チームごと）に持つ。
interface Group { key: string; label: string; emoji: string; total: number; donors: number }
interface TownState { built: string[]; funds: Record<string, number> }

const forestStage = (total: number) =>
  Math.min(FOREST_STAGES.length - 1, Math.floor(total / (TOWN_OPEN / FOREST_STAGES.length)));

export const ClassTree: React.FC = () => {
  const navigate = useNavigate();
  const { shop, balance, donate } = useShop();
  const { treeMode } = useAppSettings();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [myTeam, setMyTeam] = useState<string | null>(null);
  const [town, setTown] = useState<TownState>({ built: [], funds: {} });
  // どのチームの町の絵を見るか（相手チームの町ものぞける。子どもの声 2026-09-29）
  const [allTowns, setAllTowns] = useState<Record<string, string[]>>({});
  const [viewTeam, setViewTeam] = useState<string | null>(null);
  const [todayGain, setTodayGain] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const studentId = localStorage.getItem('studentId');

  // 自分がどのチームか（組分けの設定に合わせて決まる）
  const teamOf = (id: string | null): string | null => {
    if (!id) return null;
    const me = STUDENTS.find(s => s.id === id);
    if (!me) return null;
    return treeMode === 'grade' ? (me.grade === 5 ? 'g5' : 'g6') : (me.cls || null);
  };

  const load = async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);

    // ★名簿はSupabaseから非同期で入る。空のまま集計すると全員がどの組にも属さない
    //   扱いになり、みんなの寄付が0Pに見えてしまう。読み込みを待ってから集計する。
    if (!isRosterLoaded()) {
      try { await loadRoster(); } catch { /* 下のフォールバックで救う */ }
    }

    const { data } = await supabase.from('students').select('id, shop');
    const donatedById = new Map<string, number>();
    (data || []).forEach((r: any) => { donatedById.set(r.id, r.shop?.donated || 0); });

    const roster = STUDENTS.filter(s => s.id !== '00');
    const team = teamOf(studentId);
    setMyTeam(team);

    // 名簿が取れないときは、組に分けず全体合計を1つとして出す（0Pと出して誤解させない）
    if (roster.length === 0) {
      const total = [...donatedById.entries()]
        .filter(([id]) => id !== '00' && /^\d+$/.test(id))
        .reduce((a, [, v]) => a + v, 0);
      setGroups([{ key: 'all', label: 'みんな', emoji: '🌏', total, donors: 0 }]);
      setLoading(false);
      return;
    }

    const build = (key: string, label: string, emoji: string, members: typeof roster): Group => ({
      key, label, emoji,
      total: members.reduce((a, s) => a + (donatedById.get(s.id) || 0), 0),
      // 「何人が参加したか」も見せる（少額の子の参加も等しく可視化するため）
      donors: members.filter(s => (donatedById.get(s.id) || 0) > 0).length,
    });

    const g = treeMode === 'grade'
      ? [build('g5', '5年生', '🟢', roster.filter(s => s.grade === 5)),
         build('g6', '6年生', '🟣', roster.filter(s => s.grade === 6))]
      : [build('A', '56A', '🔵', roster.filter(s => s.cls === 'A')),
         build('B', '56B', '🟠', roster.filter(s => s.cls === 'B'))];
    setGroups(g);

    // 町の状態（全チームぶん。自分のチームは建てる用にも使う）
    const { data: towns } = await supabase.from('town_state').select('team, built, funds');
    const byTeam: Record<string, string[]> = {};
    (towns || []).forEach((t: any) => { byTeam[t.team] = t.built || []; });
    setAllTowns(byTeam);
    if (team) {
      const mine = (towns || []).find((t: any) => t.team === team);
      setTown({ built: mine?.built || [], funds: mine?.funds || {} });
    }

    // きょうの伸び（この端末で今日入れた分）
    const key = `treeGain_${new Date().toDateString()}`;
    setTodayGain(parseInt(localStorage.getItem(key) || '0', 10));

    setLoading(false);
  };

  useEffect(() => { load(); }, [treeMode]); // eslint-disable-line
  // ほかの子が入れたポイントも、開いているあいだ30秒ごとに自動で反映する
  // （子どもの声「画面を新しくするとは何？」＝押す理由が分からないボタンだった 2026-09-24）
  useEffect(() => { const t = setInterval(() => { if (!busy) load(); }, 30000); return () => clearInterval(t); }, [treeMode, busy]); // eslint-disable-line

  const myGroup = groups?.find(g => g.key === myTeam) || null;
  const townOpened = (myGroup?.total || 0) >= TOWN_OPEN;
  const candidates = pickCandidates(town.built);

  /** 木/森に寄付する（町がひらく前） */
  const handleDonate = async (amount: number) => {
    if (busy) return;
    if (!(await ensureSpendAllowed())) return;   // 合言葉（なりすまし対策 2026-09-19）
    if (!donate(amount)) return;
    const key = `treeGain_${new Date().toDateString()}`;
    const gained = parseInt(localStorage.getItem(key) || '0', 10) + amount;
    localStorage.setItem(key, String(gained));
    setTodayGain(gained);
    setBusy(true);
    setTimeout(() => { load(); setBusy(false); }, 900);
  };

  /** 建物にポイントを入れる。貯まりきったら完成させて町に追加する。 */
  const handleFund = async (b: TownBuilding, amount: number) => {
    if (busy || !supabase || !myTeam) return;
    const give = Math.min(amount, balance, Math.max(0, b.cost - (town.funds[b.id] || 0)));
    if (give <= 0) return;
    if (!(await ensureSpendAllowed())) return;   // 合言葉（なりすまし対策 2026-09-19）
    if (!donate(give)) return;

    setBusy(true);
    const key = `treeGain_${new Date().toDateString()}`;
    const gained = parseInt(localStorage.getItem(key) || '0', 10) + give;
    localStorage.setItem(key, String(gained));
    setTodayGain(gained);

    // 最新の町の状態を読んでから足す（他の子と同時に入れても消えないように）
    const { data: cur } = await supabase.from('town_state').select('built, funds').eq('team', myTeam).maybeSingle();
    const built: string[] = cur?.built || [];
    const funds: Record<string, number> = cur?.funds || {};
    const next = (funds[b.id] || 0) + give;

    if (next >= b.cost && !built.includes(b.id)) {
      built.push(b.id);
      delete funds[b.id];
      showToast(`🎉 ${b.emoji} ${b.name} が かんせい！ 町にくわわったよ`, 'points');
    } else {
      funds[b.id] = next;
      showToast(`${b.emoji} ${b.name} に ${give}P！ あと${Math.max(0, b.cost - next)}P`, 'points');
    }
    await supabase.from('town_state').upsert({ team: myTeam, built, funds, updated_at: new Date().toISOString() });
    setTown({ built, funds });
    setTimeout(() => { load(); setBusy(false); }, 700);
  };

  const totalAll = groups?.reduce((a, g) => a + g.total, 0) || 0;

  return (
    <div className="flex-col gap-lg" style={{ flex: 1, maxWidth: '760px', margin: '0 auto', width: '100%', padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button variant="outline" onClick={() => navigate('/home')} icon={ArrowLeft}>もどる</Button>
        <h2 className="text-primary" style={{ margin: 0, flex: 1, textAlign: 'center', marginRight: '80px' }}>
          {townOpened ? '🏘️ みんなの町' : '🌳 みんなの森'}
        </h2>
      </div>

      <SpendLockedNotice />
      <p style={{ textAlign: 'center', color: '#666', margin: 0 }}>
        ポイントを入れると、森が育って やがて町ができるよ。みんなで大きくしよう🌱
      </p>

      {loading || !groups ? (
        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>読み込み中…</div>
      ) : (
        <>
          {/* 町の絵（じぶんのチーム／相手チームを切り替え） */}
          {(() => {
            const shownKey = viewTeam || myTeam || groups[0]?.key;
            const g = groups.find(x => x.key === shownKey) || groups[0];
            return (
              <div className="glass-card" style={{ padding: '0.9rem' }}>
                {groups.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                    {groups.map(x => (
                      <button key={x.key} onClick={() => setViewTeam(x.key)}
                        style={{ padding: '0.35rem 1rem', borderRadius: '999px', border: '2px solid var(--color-primary)', cursor: 'pointer', fontWeight: 'bold',
                          background: g.key === x.key ? 'var(--color-primary)' : 'white', color: g.key === x.key ? 'white' : 'var(--color-primary)' }}>
                        {x.emoji} {x.label}の{x.total >= TOWN_OPEN ? '町' : '森'}{x.key === myTeam ? '（じぶん）' : ''}
                      </button>
                    ))}
                  </div>
                )}
                <TownScene built={allTowns[g.key] || []} total={g.total} label={`${g.emoji} ${g.label}`} />
              </div>
            );
          })()}

          {/* 森／町の様子 */}
          <div className="grid" style={{ gridTemplateColumns: groups.length > 1 ? '1fr 1fr' : '1fr', gap: '1rem' }}>
            {groups.map(g => {
              const opened = g.total >= TOWN_OPEN;
              const st = forestStage(g.total);
              const pct = Math.min(100, Math.round((g.total / TOWN_OPEN) * 100));
              return (
                <div key={g.key} className="glass-card flex-col flex-center gap-sm"
                  style={{ padding: '1.3rem 1rem', textAlign: 'center', border: g.key === myTeam ? '2px solid var(--color-primary)' : undefined }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.15rem' }}>
                    {g.emoji} {g.label}{g.key === myTeam && <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)' }}> ← じぶん</span>}
                  </div>
                  <div style={{ fontSize: opened ? '2rem' : '2.6rem', lineHeight: 1.3, minHeight: '3rem' }}>
                    {opened ? '🏘️' : FOREST_STAGES[st]}
                  </div>
                  <div style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>{g.total.toLocaleString()}P</div>
                  {!opened && (
                    <>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-success)', transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>町ひらきまで あと{(TOWN_OPEN - g.total).toLocaleString()}P</div>
                    </>
                  )}
                  {opened && <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>町ひらき！建物をたてよう🎉</div>}
                  {/* 少額の子もふくめ「何人が参加したか」を見せる */}
                  <div style={{ fontSize: '0.85rem' }}>{'🍃'.repeat(Math.min(g.donors, 12))}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{g.donors}人が 入れたよ</div>
                </div>
              );
            })}
          </div>

          {/* みんなの共同目標（対戦だけにしない） */}
          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: '#666' }}>
            全部 合わせて <b style={{ color: 'var(--color-success)' }}>{totalAll.toLocaleString()}P</b>
            {todayGain > 0 && <span style={{ marginLeft: '0.8rem', color: 'var(--color-primary)' }}>きょう あなたは +{todayGain}P</span>}
          </div>
          {/* 自分がこれまでに入れた合計（子どもの声 2026-11-13） */}
          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: '#666' }}>
            あなたが これまでに 入れたのは <b style={{ color: 'var(--color-primary)' }}>{(shop.donated || 0).toLocaleString()}P</b>
          </div>

          {/* 入れる：町ひらき前は森、後は建物3択 */}
          {!townOpened ? (
            <div className="glass-card flex-col flex-center gap-md" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold' }}>森に ポイントを入れる</div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                いま 使える：<b>{balance.toLocaleString()}P</b>（入れると 減ります。これまでの合計は 減りません）
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {[10, 50, 100].map(a => (
                  <Button key={a} onClick={() => handleDonate(a)} disabled={balance < a || busy}>
                    {a}P（残り{Math.max(0, balance - a)}P）
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-col gap-md">
              <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
                つぎに つくるもの（すきなものに 入れてね）
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.85rem', color: '#666' }}>
                いま 使える：<b>{balance.toLocaleString()}P</b>
              </div>
              {candidates.map(b => {
                const got = town.funds[b.id] || 0;
                const left = Math.max(0, b.cost - got);
                const pct = Math.min(100, Math.round((got / b.cost) * 100));
                return (
                  <div key={b.id} className="glass-card flex-col gap-sm" style={{ padding: '1.1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                      <div style={{ fontSize: '2.2rem' }}>{b.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 'bold' }}>{b.name} <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Lv{b.level}・{b.kind}</span></div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>{b.desc}</div>
                      </div>
                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>{got.toLocaleString()}/{b.cost.toLocaleString()}P</div>
                        <div style={{ fontSize: '0.8rem', color: '#ee5253', fontWeight: 'bold' }}>あと{left.toLocaleString()}P</div>
                      </div>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--color-success)', transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {[10, 50, 100].map(a => (
                        <Button key={a} onClick={() => handleFund(b, a)} disabled={balance < a || busy}
                          style={{ fontSize: '0.9rem', padding: '0.45rem 0.9rem' }}>{a}P</Button>
                      ))}
                      {left <= balance && left > 0 && (
                        <Button onClick={() => handleFund(b, left)} disabled={busy}
                          style={{ fontSize: '0.9rem', padding: '0.45rem 0.9rem', background: '#ee5253', color: '#fff' }}>
                          あと{left}P全部！
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {candidates.length === 0 && (
                <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  🏆 全部 たてた！ すごい町ができたね！
                </div>
              )}
            </div>
          )}

          <div className="flex-center">
            <Button variant="outline" onClick={load} icon={RefreshCw}>🔄 みんなのポイントを 見直す</Button>
          </div>
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#64748b', margin: '0.3rem 0 0' }}>
            ほかの人が いま入れたポイントが 反映されるよ（30秒ごとにも 自動で 反映）。押しても 自分のポイントは へらないよ
          </p>
        </>
      )}
    </div>
  );
};
