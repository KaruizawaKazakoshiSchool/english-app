import { ReflectionTableCard } from './ReflectionTableCard';
import { CertificateCard } from './CertificateCard';
import { SpendPinCard } from './SpendPinCard';
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { ArrowLeft, Key, Save, Target, Gauge } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { setCap, getUsage, DEFAULT_CAP } from '../../lib/apiUsage';
import { checkStaffPin, fetchAzureSpeechToken, generateWithGemini } from '../../lib/aiProxy';
import { DIALOGUES } from '../dialogue/dialogueData';
import { DEFAULT_QUIZZES } from '../textbook/textbookQuizData';
import { stages } from '../../data/stages';
import { FREETALK_UNITS } from '../dictionary/games/AIAssistant';
import { fetchConversationLogs, type ConversationLog } from '../../lib/conversationLogs';
import { saveTeacherFeedback } from '../../lib/teacherFeedback';
import { WORLD_BENTO_QUIZZES } from '../textbook/worldBentoQuizData';
import { KARUIZAWA_QUIZZES } from '../textbook/karuizawaQuizData';
import { vocabulary } from '../../data/vocabulary';
import { isArchived } from '../../data/archivedUnits';

// 長いカードを「たたむ／ひらく」。状態はこの端末に覚えておく（次に開いたときも同じ）。
const useFold = (key: string, defaultOpen: boolean): [boolean, () => void] => {
  const [open, setOpen] = useState<boolean>(() => {
    try { const v = localStorage.getItem(key); return v === null ? defaultOpen : v === '1'; } catch { return defaultOpen; }
  });
  const toggle = () => setOpen(prev => {
    try { localStorage.setItem(key, prev ? '0' : '1'); } catch { /* noop */ }
    return !prev;
  });
  return [open, toggle];
};

const FoldButton: React.FC<{ open: boolean; onClick: () => void }> = ({ open, onClick }) => (
  <Button variant="outline" onClick={onClick} style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>
    {open ? '▲ たたむ' : '▼ ひらく'}
  </Button>
);

// 📮 子どもから届いた「困った／こうしたい」（feedback）。
// 画面右下の📮ボタンから送られてくる。Mac側の巡回が新着をメールでも知らせる。
const FeedbackCard: React.FC<{ notifyTo: string; setNotifyTo: (v: string) => void; onSaveNotifyTo: () => void; notifyMsg: string }> =
  ({ notifyTo, setNotifyTo, onSaveNotifyTo, notifyMsg }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [showHandled, setShowHandled] = useState(false);
  const [open, toggleOpen] = useFold('fold_feedback', false);
  const load = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('feedback').select('*').order('ts', { ascending: false }).limit(200);
    setRows(data || []);
  };
  useEffect(() => { load(); }, []); // eslint-disable-line
  const toggleHandled = async (row: any) => {
    if (!supabase) return;
    await supabase.from('feedback').update({ handled: !row.handled }).eq('id', row.id);
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, handled: !r.handled } : r));
  };
  const visible = rows.filter(r => showHandled || !r.handled);
  const openCount = rows.filter(r => !r.handled).length;
  return (
    <div className="glass-card" style={{ border: '2px solid #6c5ce7' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>📮 子どもからの声（困った／こうしたい）</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {open && <Button variant="outline" onClick={load} style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>更新</Button>}
          {open && (
            <Button variant="outline" onClick={() => setShowHandled(v => !v)} style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>
              {showHandled ? '未対応だけ' : '対応済みも見る'}
            </Button>
          )}
          <FoldButton open={open} onClick={toggleOpen} />
        </div>
      </div>
      <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.5rem 0 1rem' }}>
        子どもの画面の右下にある📮から届きます。未対応 <b style={{ color: openCount ? '#b91c1c' : 'var(--color-success)' }}>{openCount}件</b>。
      </p>

      {open && (<>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.9rem', color: '#475569' }}>新着のお知らせ先：</span>
        <input value={notifyTo} onChange={e => setNotifyTo(e.target.value)} placeholder="thunder.ymd@gmail.com"
          style={{ flex: 1, minWidth: '220px', padding: '0.5rem 0.7rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '0.9rem' }} />
        <Button onClick={onSaveNotifyTo} style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>保存</Button>
        {notifyMsg && <span style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>{notifyMsg}</span>}
      </div>

      {visible.length === 0 ? (
        <div style={{ color: '#94a3b8' }}>{rows.length === 0 ? 'まだ届いていません' : '未対応のものはありません'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {visible.map(r => (
            <div key={r.id} style={{
              background: r.handled ? '#f8fafc' : 'white', borderRadius: '10px', padding: '0.8rem 1rem',
              borderLeft: `4px solid ${r.kind === 'bug' ? '#e17055' : r.kind === 'question' ? '#6366f1' : '#00b894'}`, opacity: r.handled ? 0.6 : 1,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#64748b' }}>
                <span>
                  <b style={{ color: r.kind === 'bug' ? '#c0392b' : r.kind === 'question' ? '#4338ca' : '#0f9d58' }}>
                    {r.kind === 'bug' ? '🐛 うまく動かない' : r.kind === 'question' ? '❓ これなぁに？' : '💡 こうしたい'}
                  </b>
                  {' '}／ {r.student_name || '?'}
                </span>
                <span>{new Date(r.ts).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div style={{ margin: '0.4rem 0', whiteSpace: 'pre-wrap', fontSize: '1rem' }}>{r.message}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontFamily: 'monospace' }}>{(r.screen || '').replace(/^#/, '')}</span>
                <Button variant="outline" onClick={() => toggleHandled(r)} style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem' }}>
                  {r.handled ? '未対応にもどす' : '対応済みにする'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      </>)}
    </div>
  );
};

// 🎙️ 音声の成功／失敗ログ（voice_logs）。「マイクが認識されない」がどの経路・どんな理由かを数字で見る。
const VoiceLogCard: React.FC<{ students: any[] }> = ({ students }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const load = async () => {
    if (!supabase) return;
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase.from('voice_logs').select('*').gte('ts', since).order('ts', { ascending: false }).limit(500);
    if (error) { setMsg('読み込みエラー'); return; }
    setRows(data || []); setMsg('');
  };
  useEffect(() => { load(); }, []); // eslint-disable-line
  const name = (id: string | null) => students.find(s => s.id === id)?.name || id || '?';
  const kindLabel: Record<string, string> = { chrome: 'AI英会話の聞き取り(Chrome)', azure: '発音チェック(Azure)', mic: 'マイク取得' };
  const codeLabel: Record<string, string> = {
    '429': '混雑(429)', '429-retry': '混雑(429)・再送も失敗', 'ok-after-retry': '成功(再送で)', ok: '成功',
    'not-allowed': 'マイク許可オフ', 'service-not-allowed': 'マイク許可オフ', network: 'ネットワーク', 'no-speech': '無音',
    'audio-capture': 'マイク無し', unsupported: '非対応ブラウザ', silent: 'ほぼ無音', nomatch: '聞き取れず', auth: 'キー/設定', canceled: '中止(その他)', denied: '許可されず',
  };
  // 集計：経路×理由
  const agg: Record<string, Record<string, number>> = {};
  for (const r of rows) { agg[r.kind] = agg[r.kind] || {}; agg[r.kind][r.code] = (agg[r.kind][r.code] || 0) + 1; }
  const lastHour = rows.filter(r => Date.now() - new Date(r.ts).getTime() < 3600 * 1000);
  const fails1h = lastHour.filter(r => !r.ok).length;
  return (
    <div className="glass-card" style={{ border: '2px solid #0984e3' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>🎙️ 音声の成功／失敗ログ（7日間）</h2>
        <Button variant="outline" onClick={load} style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>更新</Button>
      </div>
      <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.5rem 0 1rem' }}>
        「マイクが認識されない」がどこで起きているか。<b>混雑(429)</b>が多ければAzureの同時接続上限（無料枠F0＝1）、
        <b>マイク許可オフ／ネットワーク</b>が多ければ端末・校内ネットワーク側の問題。
        直近1時間：{lastHour.length}回中 <b style={{ color: fails1h ? '#b91c1c' : 'var(--color-success)' }}>{fails1h}回 失敗</b>
      </p>
      {msg && <div style={{ color: '#b91c1c' }}>{msg}</div>}
      {rows.length === 0 ? (
        <div style={{ color: '#94a3b8' }}>まだ記録がありません（次にマイクを使うと入ります）</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
            {Object.entries(agg).map(([kind, codes]) => {
              const total = Object.values(codes).reduce((a, b) => a + b, 0);
              const okN = (codes['ok'] || 0) + (codes['ok-after-retry'] || 0);
              return (
                <div key={kind} style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.8rem 1rem' }}>
                  <div style={{ fontWeight: 'bold' }}>{kindLabel[kind] || kind}</div>
                  <div style={{ fontSize: '0.9rem', color: '#475569' }}>{total}回・成功 {okN}（{total ? Math.round(okN / total * 100) : 0}%）</div>
                  <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem', fontSize: '0.85rem' }}>
                    {Object.entries(codes).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
                      <li key={c} style={{ color: c.startsWith('ok') ? 'var(--color-success)' : '#b91c1c' }}>{codeLabel[c] || c}：{n}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <details>
            <summary style={{ cursor: 'pointer', color: '#475569' }}>直近の記録を見る（新しい順・最大40件）</summary>
            <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '600px' }}>
                <thead><tr style={{ background: '#f1f5f9' }}>
                  {['時刻', '生徒', '経路', '結果', '画面', '詳細'].map(h => <th key={h} style={{ textAlign: 'left', padding: '0.3rem 0.6rem' }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.slice(0, 40).map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.3rem 0.6rem', whiteSpace: 'nowrap' }}>{new Date(r.ts).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ padding: '0.3rem 0.6rem' }}>{name(r.student_id)}</td>
                      <td style={{ padding: '0.3rem 0.6rem' }}>{kindLabel[r.kind] || r.kind}</td>
                      <td style={{ padding: '0.3rem 0.6rem', color: r.ok ? 'var(--color-success)' : '#b91c1c', fontWeight: 'bold' }}>{codeLabel[r.code] || r.code}</td>
                      <td style={{ padding: '0.3rem 0.6rem', fontFamily: 'monospace' }}>{(r.screen || '').replace(/^#/, '').slice(0, 28)}</td>
                      <td style={{ padding: '0.3rem 0.6rem', color: '#64748b' }}>{(r.detail || '').slice(0, 60)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
};

// 今日のミッションに設定できる候補（ダイアログ＋教科書の全Unit）
interface MissionOption { label: string; route: string; videoUrl?: string; afterSign?: boolean; final?: boolean }
const MISSION_OPTIONS: MissionOption[] = [
  // ※アーカイブ中の単元も先生には残す（📦付き）。配信すれば今までどおり使える。
  ...DIALOGUES.map(d => {
    // 「Unit 5」だけだと話型A/B/Cが同じ名前になって選べないので、（…）の中は残す
    const base = d.unitName.replace(/:.*/, '');
    const paren = (d.unitName.match(/（.*）$/) || [''])[0];
    return {
      label: `${isArchived(d.id) ? '📦 ' : ''}ダイアログ ${d.grade}年 ${base}${base.includes(paren) ? '' : paren}`,
      route: `/dialogue?grade=${d.grade}&id=${d.id}`,
    };
  }),
  ...DEFAULT_QUIZZES.map(q => ({
    label: `教科書 ${q.grade}年 ${q.unitName.replace(/:.*/, '')}`,
    route: `/textbook?grade=${q.grade}&id=${q.id}`,
    videoUrl: q.url,
  })),
  // World Bento（世界の弁当）クイズ：トップ画面（国の一覧）を開く。今回は国別までは指定しない。
  { label: '📦 🍱 世界の弁当クイズ（トップ画面）', route: '/textbook?set=worldbento' },
  // まちクイズ（軽井沢スポット）：P5 Town Guide の CHARGE の床。トップ画面（スポット一覧）を開く。
  { label: '🏔 軽井沢まちクイズ（トップ画面）', route: '/textbook?set=karuizawa' },
  ...KARUIZAWA_QUIZZES.map(q => ({
    label: `🏔 まちクイズ ${q.unitName}`,
    route: `/textbook?id=${q.id}`,
  })),
  // Picture Dictionary の各カテゴリ（例：食べ物）。クイズと一緒に配信して「クイズ→語彙」の流れを作れる。
  ...Array.from(new Set(vocabulary.map(v => v.category))).map(cat => ({
    label: `📕 辞書 ${cat}`,
    route: `/dictionary/${encodeURIComponent(cat)}`,
  })),
  // AI英会話：トップ（場面えらび）と、Unit別フリートークへの直接リンク
  { label: '🤖 AI英会話（場面えらび画面）', route: '/ai' },
  // World Bento お店屋さん（AI＝客／児童＝店員）。開店前の練習を配信できる。
  { label: '📦 🍱 AI英会話 お店屋さん（シンプル）', route: '/ai?shop=simple' },
  { label: '📦 🍱 AI英会話 お店屋さん（チャレンジ）', route: '/ai?shop=challenge' },
  ...FREETALK_UNITS.map(u => ({
    label: `${isArchived(u.id) ? '📦 ' : ''}🤖 AI英会話 ${u.label}`,
    route: `/ai?unit=${u.id}`,
  })),
];

export const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  // ログイン画面のPINモーダルで認証済みなら、このタブの間はPIN画面をスキップ
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('staff_authed') === '1');
  
  // AIのキー（サーバー側）の動作確認と、発音チェックのオン/オフ
  const [azureDisabled, setAzureDisabled] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [aiIsError, setAiIsError] = useState(false);
  // ロック：none / screen（注目モード）/ reflection（ふりかえりだけ書ける）
  const [lockMode, setLockMode] = useState<'none' | 'screen' | 'reflection' | 'missions'>('none');
  const [customVocabEnabled, setCustomVocabEnabled] = useState(false);
  // AI英会話：Unitゴールの上書き（{id:{goal,missionJa,greetingEn,greetingJa}}）と保存メッセージ
  const [freetalkGoals, setFreetalkGoals] = useState<Record<string, { goal?: string; missionJa?: string; greetingEn?: string; greetingJa?: string; clearAll?: string[]; bonusAny?: string[]; hints?: { en: string; ja: string }[] }>>({});
  const [goalSaveMsg, setGoalSaveMsg] = useState('');
  // AI英会話：記録された会話ログ
  const [convLogs, setConvLogs] = useState<ConversationLog[] | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  // ふりかえりへの先生コメント/スタンプの下書き（"生徒id__ふりかえりid" ごと）と保存中フラグ
  const [fbDrafts, setFbDrafts] = useState<Record<string, { comment: string; stamp: string }>>({});
  const [fbSavingId, setFbSavingId] = useState<string | null>(null);
  // 日別ビューでTab移動するためのコメント入力欄の参照（キーは "生徒id__ふりかえりid"）
  const fbInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const STAMPS = ['👍', '🌟', '💯', '😊', '🎉', '🔥'];
  const [students, setStudents] = useState<any[]>([]);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [studentsOpen, toggleStudentsOpen] = useFold('fold_students', true);
  const [studentView, setStudentView] = useState<'byStudent' | 'byDate' | 'map'>('byStudent');
  // ポイント手動加算（消失時の補填用）。同期がmaxマージのため加算のみ対応。
  const [adjStudentId, setAdjStudentId] = useState('');
  const [bgStudentId, setBgStudentId] = useState('');
  const [notifyTo, setNotifyTo] = useState('');
  const [notifyMsg, setNotifyMsg] = useState('');
  const [bgMsg, setBgMsg] = useState('');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjMsg, setAdjMsg] = useState('');
  // クラスの木のグループ分け（56A対56B / 5年対6年）
  const [treeMode, setTreeMode] = useState<'cls' | 'grade'>('cls');
  const [spendMode, setSpendMode] = useState<'locked' | 'setup' | 'open'>('locked');
  const [salePercent, setSalePercent] = useState(0);
  const [saleLabel, setSaleLabel] = useState('');
  const [saleMsg, setSaleMsg] = useState('');
  const [treeMsg, setTreeMsg] = useState('');
  const [missionRoute, setMissionRoute] = useState('');
  const [missionStatus, setMissionStatus] = useState('');
  // 今日のミッション（複数OK）。旧形式（単数todayMission）のデータも読み込み時に配列へ変換
  const [currentMissions, setCurrentMissions] = useState<MissionOption[]>([]);
  // 1日あたりのAPI利用上限（0以下＝無制限）。この端末の今日の利用数も参考表示する。
  const [geminiCap, setGeminiCap] = useState<number>(DEFAULT_CAP.gemini);
  const [azureCap, setAzureCap] = useState<number>(DEFAULT_CAP.azure);
  const [capStatus, setCapStatus] = useState('');

  // Handle PIN
  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await checkStaffPin(pin)) {
      sessionStorage.setItem('staff_authed', '1'); // このタブの間は再入力不要
      setIsAuthenticated(true);
    } else {
      alert('PINが違います');
      setPin('');
    }
  };

  // 認証できたら設定・生徒データを読み込む（PINスキップ経由でも必ず動くようにeffectで）
  useEffect(() => {
    if (isAuthenticated) fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const fetchSettings = async () => {
    if (!supabase) return;
    const { data } = await supabase
      .from('students')
      .select('dictionary_progress')
      .eq('id', 'app_settings_v1')
      .single();
      
    if (data && data.dictionary_progress) {
      setAzureDisabled(data.dictionary_progress.azureDisabled === true);
      if (data.dictionary_progress.feedbackNotifyTo !== undefined) {
        setNotifyTo(data.dictionary_progress.feedbackNotifyTo || '');
      }
      if (data.dictionary_progress.lockMode !== undefined) {
        setLockMode(data.dictionary_progress.lockMode || 'none');
      } else if (data.dictionary_progress.isScreenLocked !== undefined) {
        setLockMode(data.dictionary_progress.isScreenLocked ? 'screen' : 'none');
      }
      if (data.dictionary_progress.customVocabEnabled !== undefined) {
        setCustomVocabEnabled(data.dictionary_progress.customVocabEnabled);
      }
      if (data.dictionary_progress.freetalkGoals !== undefined) {
        setFreetalkGoals(data.dictionary_progress.freetalkGoals || {});
      }
      if (data.dictionary_progress.salePercent !== undefined) setSalePercent(Number(data.dictionary_progress.salePercent) || 0);
      if (data.dictionary_progress.saleLabel !== undefined) setSaleLabel(data.dictionary_progress.saleLabel || '');
      {
        const sm = data.dictionary_progress.spendMode;
        setSpendMode(sm === 'setup' || sm === 'open' ? sm : 'locked');
      }
      if (data.dictionary_progress.treeMode !== undefined) {
        setTreeMode(data.dictionary_progress.treeMode || 'cls');
      }
      if (data.dictionary_progress.todayMissions !== undefined) {
        setCurrentMissions(data.dictionary_progress.todayMissions || []);
      } else if (data.dictionary_progress.todayMission) {
        // 旧形式（単数）からの移行
        setCurrentMissions([data.dictionary_progress.todayMission]);
      }
      if (data.dictionary_progress.geminiDailyCap !== undefined) {
        setGeminiCap(data.dictionary_progress.geminiDailyCap);
        setCap('gemini', data.dictionary_progress.geminiDailyCap);
      }
      if (data.dictionary_progress.azureDailyCap !== undefined) {
        setAzureCap(data.dictionary_progress.azureDailyCap);
        setCap('azure', data.dictionary_progress.azureDailyCap);
      }
    }

    // Fetch students data
    const { data: studentsData } = await supabase
      .from('students')
      .select('*')
      .neq('id', 'app_settings_v1')
      .neq('id', 'conversation_logs_v1') // 会話ログ用の行は生徒一覧から除外
      .order('last_access', { ascending: false });
      
    if (studentsData) {
      setStudents(studentsData);
    }
  };

  // Saves the full settings object so individual saves/toggles never wipe other fields.
  const persistSettings = async (overrides: Record<string, any> = {}) => {
    if (!supabase) return { error: new Error('no supabase') };
    // ★DBの今の設定に重ねて保存する。以前はこの画面が知っている項目だけで丸ごと上書きしていたので、
    //   ここに書き忘れた設定（通知先・Azureエンドポイント・合言葉の受付など）が、
    //   別の設定を保存したとたんに消えていた。
    const { data: curRow } = await supabase.from('students').select('dictionary_progress').eq('id', 'app_settings_v1').maybeSingle();
    return supabase
      .from('students')
      .upsert({
        id: 'app_settings_v1',
        name: 'System Settings',
        dictionary_progress: {
          ...((curRow?.dictionary_progress as Record<string, any>) || {}),
          lockMode: lockMode,
          isScreenLocked: lockMode === 'screen', // 旧バージョンのアプリ（キャッシュ）向けの互換
          todayMissions: currentMissions,
          todayMission: currentMissions[0] || null, // 旧バージョンのアプリ（キャッシュ）向けの互換
          geminiDailyCap: geminiCap,
          azureDailyCap: azureCap,
          customVocabEnabled: customVocabEnabled,
          freetalkGoals: freetalkGoals,
          treeMode: treeMode,
          ...overrides
        }
      }, { onConflict: 'id' });
  };

  // ミッション一覧を保存（追加・削除・全解除の共通処理）
  const persistMissions = async (list: MissionOption[], okMsg: string) => {
    setCurrentMissions(list);
    const { error } = await persistSettings({ todayMissions: list, todayMission: list[0] || null });
    setMissionStatus(error ? '通信エラー' : okMsg);
    setTimeout(() => setMissionStatus(''), 4000);
  };

  const handleAddMission = async () => {
    const opt = MISSION_OPTIONS.find(o => o.route === missionRoute);
    if (!opt) { setMissionStatus('追加するミッションを選んでください'); setTimeout(() => setMissionStatus(''), 4000); return; }
    if (currentMissions.some(m => m.route === opt.route)) { setMissionStatus('すでに設定済みです'); setTimeout(() => setMissionStatus(''), 4000); return; }
    await persistMissions([...currentMissions, opt], `追加しました：${opt.label}`);
    setMissionRoute('');
  };

  const handleRemoveMission = async (route: string) => {
    await persistMissions(currentMissions.filter(m => m.route !== route), '削除しました');
  };

  const handleClearMission = async () => {
    setMissionRoute('');
    await persistMissions([], 'ミッションをすべて解除しました');
  };

  // ポイントを手動で加算する（消えた分の補填用）。DBの現在値に足す。
  // 児童側の同期はポイントを「多いほう優先」でマージするため、加算はそのまま反映される。
  // 背景写真のリセット（ふさわしくない写真だったときの取り消し）。
  // 子どもは1枚しか登録できないので、先生が消さないと直せない。
  const handleResetBackground = async () => {
    if (!supabase || !bgStudentId) { setBgMsg('生徒を選んでください'); setTimeout(() => setBgMsg(''), 4000); return; }
    const target = students.find(s => s.id === bgStudentId);
    if (!window.confirm(`${target?.name || bgStudentId} の背景写真を消します。\nこのあと、その子はもう一度（無料で）写真を選べるようになります。`)) return;

    const { data: row, error: readErr } = await supabase
      .from('students').select('shop, name').eq('id', bgStudentId).single();
    if (readErr || !row) { setBgMsg('読み込みエラー'); setTimeout(() => setBgMsg(''), 4000); return; }

    const shop = row.shop || {};
    // 「この時刻より前に登録された写真は無効」という印を立てる。
    // これで、その子の端末に残っている写真も次の同期で消える（sync.tsのmergeShop）。
    const next = { ...shop, bgImage: null, bgOn: false, bgSetAt: 0, bgClearedAt: Date.now() };
    const { error } = await supabase.from('students').update({ shop: next }).eq('id', bgStudentId);

    // 保存してあるファイル自体も消す（残しておく理由がない）
    await supabase.storage.from('backgrounds').remove([`${bgStudentId}.jpg`]);

    setBgMsg(error ? '保存エラー' : `${row.name} の背景写真を消しました（もう一度えらべます）`);
    setTimeout(() => setBgMsg(''), 6000);
  };

  // 📮 新着フィードバックのお知らせ先メールアドレスを保存
  const handleSaveNotifyTo = async () => {
    const { error } = await persistSettings({ feedbackNotifyTo: notifyTo.trim() || null });
    setNotifyMsg(error ? '通信エラー' : '保存しました');
    setTimeout(() => setNotifyMsg(''), 4000);
  };

  const handleAdjustPoints = async () => {
    if (!supabase) return;
    const amount = parseInt(adjAmount, 10);
    if (!adjStudentId || !amount || amount <= 0) {
      setAdjMsg('生徒と加算ポイント（正の数）を入れてください');
      setTimeout(() => setAdjMsg(''), 4000);
      return;
    }
    const { data: row, error: readErr } = await supabase
      .from('students').select('points, name, clear_counts').eq('id', adjStudentId).single();
    if (readErr || !row) { setAdjMsg('読み込みエラー'); setTimeout(() => setAdjMsg(''), 4000); return; }
    const newPoints = (row.points || 0) + amount;
    // DB側の見張り（クリア記録なしにポイントだけ増えたら差し戻す）を通すため、
    // 「先生からのボーナス」をクリア回数として一緒に記録する（1回=最大60P）
    const cc = { ...(row.clear_counts || {}) };
    cc.teacher_bonus = (cc.teacher_bonus || 0) + Math.ceil(amount / 60);
    const { error } = await supabase.from('students').update({ points: newPoints, clear_counts: cc }).eq('id', adjStudentId);
    if (error) { setAdjMsg('保存エラー'); }
    else {
      setAdjMsg(`${row.name} に +${amount}P（合計 ${newPoints}P）`);
      setStudents(prev => prev.map(s => s.id === adjStudentId ? { ...s, points: newPoints } : s));
      setAdjAmount('');
    }
    setTimeout(() => setAdjMsg(''), 6000);
  };

  const handleSaveGoals = async () => {
    const { error } = await persistSettings({ freetalkGoals });
    setGoalSaveMsg(error ? '通信エラー' : 'ゴールを保存しました');
    setTimeout(() => setGoalSaveMsg(''), 4000);
  };

  // ふりかえり1件に先生コメント/スタンプを保存し、画面にも即反映
  const handleSaveFeedback = async (studentId: string, ref: any) => {
    const key = `${studentId}__${ref.id}`;
    const draft = fbDrafts[key] || { comment: ref.teacherComment || '', stamp: ref.teacherStamp || '' };
    setFbSavingId(key);
    const { error } = await saveTeacherFeedback(studentId, ref.id, draft.comment, draft.stamp);
    setFbSavingId(null);
    if (error) return;
    setStudents(prev => prev.map(s => s.id !== studentId ? s : {
      ...s,
      reflections: (s.reflections || []).map((r: any) => r.id === ref.id ? { ...r, teacherComment: draft.comment.trim(), teacherStamp: draft.stamp, autoStamp: false } : r),
    }));
  };

  // ふりかえり1件への「先生から」コメント＋スタンプ入力UI（生徒ごと／日ごと 共用）。
  // navKeys を渡すと、Enter＝送信して次の子へ／Tab＝次の子へ移動できる。
  // ※ IME変換中（日本語入力の確定前）のEnter/Tabは変換操作なので奪わない。
  const renderFeedbackBox = (studentId: string, ref: any, navKeys?: string[]) => {
    const key = `${studentId}__${ref.id}`;
    const draft = fbDrafts[key] || { comment: ref.teacherComment || '', stamp: ref.teacherStamp || '' };
    const setDraft = (d: { comment: string; stamp: string }) => setFbDrafts(p => ({ ...p, [key]: d }));
    const focusNeighbor = (dir: 1 | -1) => {
      if (!navKeys) return;
      const pos = navKeys.indexOf(key);
      const nextKey = navKeys[pos + dir];
      if (nextKey) fbInputRefs.current[nextKey]?.focus();
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // IME変換中はEnterもTabも変換の操作。ここで奪うと日本語が打てないので何もしない。
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === 'Tab' && navKeys) {
        e.preventDefault();
        focusNeighbor(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveFeedback(studentId, ref); // 確定Enter＝送信して…
        focusNeighbor(1);                   // …次の子のコメント欄へ
      }
    };
    return (
      <div style={{ marginTop: '0.7rem', paddingTop: '0.7rem', borderTop: '1px dashed #cbd5e1' }}>
        <div style={{ fontSize: '0.8rem', color: '#0891b2', fontWeight: 'bold', marginBottom: '0.3rem' }}>スタッフから（子どもに見えます）</div>
        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
          {STAMPS.map(st => (
            // スタンプを押したら、そのままコメントを打てるように入力欄へフォーカスを移す
            <button key={st} onClick={() => { setDraft({ ...draft, stamp: draft.stamp === st ? '' : st }); fbInputRefs.current[key]?.focus(); }}
              style={{ fontSize: '1.2rem', padding: '0.1rem 0.4rem', borderRadius: '8px', cursor: 'pointer', background: draft.stamp === st ? '#cffafe' : 'white', border: `2px solid ${draft.stamp === st ? '#0891b2' : '#e2e8f0'}` }}>
              {st}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            ref={el => { fbInputRefs.current[key] = el; }}
            value={draft.comment}
            onChange={e => setDraft({ ...draft, comment: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="一言コメント（任意）"
            style={{ flex: 1, minWidth: '180px', padding: '0.4rem 0.6rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '0.9rem' }} />
          <Button onClick={() => handleSaveFeedback(studentId, ref)} disabled={fbSavingId === key} style={{ fontSize: '0.85rem', padding: '0.4rem 0.9rem' }}>
            {fbSavingId === key ? '保存中…' : '送る'}
          </Button>
        </div>
        {(ref.teacherComment || ref.teacherStamp) && (
          <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: ref.autoStamp ? '#94a3b8' : '#16a34a' }}>
            {ref.autoStamp ? `自動で ${ref.teacherStamp}（押し直すと 先生のスタンプに なります）` : `送信済み：${ref.teacherStamp} ${ref.teacherComment || ''}`}
          </div>
        )}
      </div>
    );
  };

  const loadConvLogs = async () => {
    setLogsLoading(true);
    const logs = await fetchConversationLogs();
    setConvLogs(logs);
    setLogsLoading(false);
  };

  const handleSaveCaps = async () => {
    setCap('gemini', geminiCap);
    setCap('azure', azureCap);
    const { error } = await persistSettings({ geminiDailyCap: geminiCap, azureDailyCap: azureCap });
    setCapStatus(error ? '通信エラー' : '上限を保存しました');
    setTimeout(() => setCapStatus(''), 4000);
  };

  // サーバー（Edge Function）に置いたキーが今使えるかを確かめる。
  // Geminiは短い返事を1回もらう（ごく少額）、Azureはトークンを1つもらうだけ（音声は送らない）。
  const handleTestAi = async () => {
    setAiIsError(false);
    setAiStatus('確かめています…');
    const results: string[] = [];
    let ng = false;
    try {
      await generateWithGemini({ contents: [{ role: 'user', parts: [{ text: 'Say OK.' }] }], maxOutputTokens: 5 });
      results.push('✅ Gemini（AI英会話・お話づくり）は使えます');
    } catch (e) {
      ng = true;
      results.push(`❌ Gemini：${(e as Error).message}`);
    }
    try {
      await fetchAzureSpeechToken();
      results.push('✅ Azure（発音チェック）は使えます');
    } catch (e) {
      ng = true;
      results.push(`❌ Azure：${(e as Error).message}`);
    }
    setAiIsError(ng);
    setAiStatus(results.join(' ／ '));
  };

  const handleToggleAzure = async () => {
    const next = !azureDisabled;
    if (next && !window.confirm('発音チェックをオフにします。\n全員の端末で、マイクは「かんたんな聞き取り（ブラウザの音声認識）」に切り替わります。\nあとで「オンにする」を押せば、また使えます。')) return;
    const { error } = await persistSettings({ azureDisabled: next });
    setAiIsError(!!error);
    if (error) { setAiStatus('通信エラー'); return; }
    setAzureDisabled(next);
    setAiStatus(next ? '発音チェックをオフにしました（全端末で かんたんな聞き取りに切り替わります）' : '発音チェックをオンにしました');
  };

  if (!isAuthenticated) {
    return (
      <div className="flex-col flex-center" style={{ flex: 1 }}>
        <div className="glass-card flex-col flex-center" style={{ padding: '3rem', gap: '1rem' }}>
          <h2 className="text-primary">スタッフ用ダッシュボード</h2>
          <p>PINコードを入力してください</p>
          <form onSubmit={handlePinSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <input 
              type="password" 
              value={pin}
              onChange={e => setPin(e.target.value)}
              style={{ fontSize: '1.6rem', textAlign: 'center', width: '260px', maxWidth: '100%', padding: '0.5rem', borderRadius: '8px', border: '1px solid #ccc' }}
              maxLength={20}
              autoComplete="one-time-code"
              name="teacher_pin"
            />
            <Button type="submit">ログイン</Button>
          </form>
          <Button variant="outline" onClick={() => navigate(-1)} style={{ marginTop: '1rem' }}>戻る</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col gap-lg" style={{ flex: 1, padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Button variant="outline" onClick={() => navigate(-1)} icon={ArrowLeft}>もどる</Button>
        <h1 className="text-primary" style={{ margin: 0 }}>スタッフ用ダッシュボード</h1>
      </div>

      {/* 今日のミッション設定 */}
      <div className="glass-card" style={{ border: '2px solid #ee5253' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Target color="#ee5253" />
          <h2 style={{ margin: 0 }}>今日のミッション</h2>
        </div>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
          設定すると、児童のホーム画面の一番上に大きく表示され、ワンクリックでそのページに飛べます。<b>複数設定OK</b>（上から順に表示されます）。
        </p>
        {currentMissions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
            {currentMissions.map((m, i) => (
              <div key={m.route} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1rem', background: 'rgba(238,82,83,0.1)', borderRadius: '8px', fontWeight: 'bold', color: '#c0392b' }}>
                <span style={{ flex: 1 }}>🎯 {i + 1}. {m.label}</span>
                <label title="ミッションだけロックのとき、いつ開くか" style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  開くとき
                  <select value={m.afterSign ? 'sign' : m.final ? 'final' : 'open'}
                    onChange={e => {
                      const v = e.target.value;
                      persistMissions(currentMissions.map(x => x.route === m.route ? { ...x, afterSign: v === 'sign' || undefined, final: v === 'final' || undefined } : x),
                        v === 'sign' ? '✍️ サインのあと にしました' : v === 'final' ? '🏁 さいご にしました' : 'はじめから開く にしました');
                    }}
                    style={{ fontSize: '0.85rem', padding: '0.2rem', borderRadius: '6px', border: '1px solid #ccc' }}>
                    <option value="open">はじめから</option>
                    <option value="final">🏁 さいご（ほかを全部クリアしたら）</option>
                    <option value="sign">✍️ サインのあと</option>
                  </select>
                </label>
                <button
                  onClick={() => handleRemoveMission(m.route)}
                  title="このミッションを削除"
                  style={{ border: 'none', background: 'white', color: '#c0392b', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={missionRoute}
            onChange={e => setMissionRoute(e.target.value)}
            style={{ flex: 1, minWidth: '240px', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem' }}
          >
            <option value="">（追加するミッションを選ぶ）</option>
            {MISSION_OPTIONS.map(o => (
              <option key={o.route} value={o.route}>{o.label}</option>
            ))}
          </select>
          <Button onClick={handleAddMission} icon={Save}>追加する</Button>
          <Button variant="outline" onClick={handleClearMission}>すべて解除</Button>
        </div>
        {missionStatus && <span style={{ display: 'block', marginTop: '0.8rem', fontWeight: 'bold', color: 'var(--color-success)' }}>{missionStatus}</span>}
      </div>

      {/* ポイント手動加算（消失時の補填用） */}
      <div className="glass-card" style={{ border: '2px solid #f59e0b' }}>
        <h2 style={{ margin: '0 0 0.5rem 0' }}>🎁 ポイント加算（補填）</h2>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
          不具合でポイントが消えた子への補填用です。DBの現在値に<b>加算</b>します（減算は不可）。
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={adjStudentId}
            onChange={e => setAdjStudentId(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem' }}
          >
            <option value="">（生徒を選ぶ）</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.id}. {s.name}（現在 {s.points || 0}P）</option>
            ))}
          </select>
          <input
            type="number" min="1" placeholder="加算P"
            value={adjAmount} onChange={e => setAdjAmount(e.target.value)}
            style={{ width: '110px', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem' }}
          />
          <Button onClick={handleAdjustPoints}>加算する</Button>
        </div>
        {adjMsg && <span style={{ display: 'block', marginTop: '0.8rem', fontWeight: 'bold', color: 'var(--color-success)' }}>{adjMsg}</span>}
      </div>

      {/* 背景写真のリセット（1人1枚・入れ替え不可なので、先生だけが取り消せる） */}
      <div className="glass-card" style={{ border: '2px solid #fd79a8' }}>
        <h2 style={{ margin: '0 0 0.5rem 0' }}>🖼️ 背景写真のリセット</h2>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
          子どもが登録できる背景写真は<b>1人1枚・入れ替え不可</b>です。
          ふさわしくない写真や、まちがえて登録した場合はここで消してください。
          消すと、その子は<b>もう一度（追加のポイントなしで）</b>写真を選べます。
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={bgStudentId}
            onChange={e => setBgStudentId(e.target.value)}
            style={{ flex: 1, minWidth: '200px', padding: '0.8rem', borderRadius: '8px', border: '1px solid #ccc', fontSize: '1rem' }}
          >
            <option value="">（生徒を選ぶ）</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>{s.id}. {s.name}{s.shop?.bgImage ? '（背景あり）' : ''}</option>
            ))}
          </select>
          <Button onClick={handleResetBackground} variant="outline">背景を消す</Button>
        </div>
        {bgMsg && <span style={{ display: 'block', marginTop: '0.8rem', fontWeight: 'bold', color: 'var(--color-success)' }}>{bgMsg}</span>}
      </div>

      <VoiceLogCard students={students} />

      {/* クラスの木：グループ分けの切替 */}
      <div className="glass-card" style={{ border: '2px solid #00b894' }}>
        <h2 style={{ margin: '0 0 0.5rem 0' }}>🌳 みんなの木：チーム分け</h2>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
          「みんなの木」を どのグループで競うか。切り替えると過去の寄付ぶんも組み替わります。
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {([['cls', '🔵 56A 対 🟠 56B'], ['grade', '🟢 5年 対 🟣 6年']] as const).map(([v, label]) => (
            <button key={v}
              onClick={async () => {
                setTreeMode(v);
                const { error } = await persistSettings({ treeMode: v });
                setTreeMsg(error ? '通信エラー' : `「${label}」にしました`);
                setTimeout(() => setTreeMsg(''), 4000);
              }}
              style={{ padding: '0.6rem 1.2rem', borderRadius: '999px', border: '2px solid #00b894', cursor: 'pointer', fontWeight: 'bold',
                background: treeMode === v ? '#00b894' : 'white', color: treeMode === v ? 'white' : '#00b894' }}>
              {label}
            </button>
          ))}
        </div>
        {treeMsg && <span style={{ display: 'block', marginTop: '0.8rem', fontWeight: 'bold', color: 'var(--color-success)' }}>{treeMsg}</span>}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Key color="var(--color-accent)" />
            <h2 style={{ margin: 0 }}>AIのキー（Gemini / Azure）</h2>
          </div>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
            キーはアプリには置かず、Supabaseの管理画面（Edge Functions → Secrets）で管理しています。<br />
            取り替えるときは <code>GEMINI_API_KEY</code> / <code>AZURE_SPEECH_KEY</code> / <code>AZURE_SPEECH_REGION</code>
            （必要なら <code>AZURE_SPEECH_ENDPOINT</code>）を更新してから、下の「いまのキーを試す」で確かめてください。
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Button variant="outline" onClick={handleTestAi}>いまのキーを試す</Button>
            <Button variant="outline" onClick={handleToggleAzure}>
              {azureDisabled ? '発音チェックをオンにする' : '発音チェックをオフにする'}
            </Button>
          </div>
          {aiStatus && <p style={{ color: aiIsError ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 'bold', marginBottom: 0 }}>{aiStatus}</p>}
        </div>

        <div className="glass-card">
          <h2>クラス管理機能</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
            全員の画面を強制的に切り替えます。<b>画面ロック</b>＝何もできない（注目モード）。
            <b>ふりかえりロック</b>＝「ふりかえりを書く」だけ使える（ほかの画面ではふりかえりへ行くボタンだけ出る）。
            <b>ミッションだけ</b>＝今日のミッション（とトップ・ふりかえり）だけ使える。ミッションごとの「開くとき」：
            <b>🏁 さいご</b>＝ほかのミッションを全部クリアすると開き、クリアするとその端末はその日ロックが外れる（スタッフの手はいらない）。
            <b>✍️ サインのあと</b>＝閉じたまま。制作物にサインをしたら、スタッフがその端末で<b>サインの合言葉</b>（このページのPINとは別）を入れる → その端末は30分ロックが外れる。
            Test（00）はどのロックもかかりません。おためし（99）はかかります。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8f9fa', borderRadius: '8px' }}>
              <span style={{ fontWeight: 'bold' }}>ロック状態</span>
              <span style={{ color: lockMode !== 'none' ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 'bold' }}>
                {lockMode === 'screen' ? '🔒 画面ロック中（注目モード）' : lockMode === 'reflection' ? '✏️ ふりかえりロック中' : lockMode === 'missions' ? '🎯 ミッションだけ（ほかはロック）' : '🔓 解除中'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Button
                style={{ flex: 1, background: lockMode === 'screen' ? '#ccc' : 'var(--color-error)' }}
                disabled={lockMode === 'screen'}
                onClick={async () => { setLockMode('screen'); await persistSettings({ lockMode: 'screen', isScreenLocked: true }); }}
              >
                🔒 画面ロック
              </Button>
              <Button
                style={{ flex: 1, background: lockMode === 'reflection' ? '#ccc' : '#d97706' }}
                disabled={lockMode === 'reflection'}
                onClick={async () => { setLockMode('reflection'); await persistSettings({ lockMode: 'reflection', isScreenLocked: false }); }}
              >
                ✏️ ふりかえりロック
              </Button>
              <Button
                style={{ flex: 1, background: lockMode === 'missions' ? '#ccc' : '#e17055' }}
                disabled={lockMode === 'missions'}
                onClick={async () => { setLockMode('missions'); await persistSettings({ lockMode: 'missions', isScreenLocked: false }); }}
              >
                🎯 ミッションだけ
              </Button>
              <Button
                style={{ flex: 1, background: lockMode === 'none' ? '#ccc' : 'var(--color-success)' }}
                disabled={lockMode === 'none'}
                onClick={async () => { setLockMode('none'); await persistSettings({ lockMode: 'none', isScreenLocked: false }); }}
              >
                🔓 ロックを解除する
              </Button>
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h2>🎉 セールの日（ショップの値引き）</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
            子どもの声「◯◯の日は50%オフがいい」から。称号・着せ替え・名前のわく・背景が、この割合で安く買えます。
            <b>0%＝ふだん</b>。貯めたポイントの価値が下がりすぎないよう、期間を決めて使ってください。
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {[0, 20, 30, 50].map(p => (
              <button key={p} onClick={async () => {
                setSalePercent(p);
                const { error } = await persistSettings({ salePercent: p });
                setSaleMsg(error ? '通信エラー' : p === 0 ? 'セールを終わりにしました' : `${p}%オフにしました`);
                setTimeout(() => setSaleMsg(''), 5000);
              }}
                style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold',
                  border: '2px solid var(--color-primary)',
                  background: salePercent === p ? 'var(--color-primary)' : 'white',
                  color: salePercent === p ? 'white' : 'var(--color-primary)' }}>
                {p === 0 ? 'ふだん' : `${p}%オフ`}
              </button>
            ))}
            <input value={saleLabel} onChange={e => setSaleLabel(e.target.value)} placeholder="名前（例：がんばったね の日）"
              style={{ flex: 1, minWidth: '220px', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            <Button variant="outline" onClick={async () => {
              const { error } = await persistSettings({ saleLabel: saleLabel.trim() });
              setSaleMsg(error ? '通信エラー' : '名前を保存しました');
              setTimeout(() => setSaleMsg(''), 5000);
            }}>名前を保存</Button>
          </div>
          {saleMsg && <div style={{ marginTop: '0.5rem', fontWeight: 'bold', color: 'var(--color-primary)' }}>{saleMsg}</div>}
        </div>

        <SpendPinCard students={students} mode={spendMode}
          onChangeMode={async m => { setSpendMode(m); await persistSettings({ spendMode: m }); }} />

        <div className="glass-card">
          <h2>🧪 マイ単語ついか機能（準備中）</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
            子どもやスタッフが「地域の言葉（懐古園など）」をPicture Dictionaryに追加できる機能です。
            運用を決めてからONにしてください。<b>OFFの間は子どもの画面には出ません。</b>
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f8f9fa', borderRadius: '8px', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 'bold' }}>いまの状態</span>
            <span style={{ color: customVocabEnabled ? 'var(--color-success)' : '#94a3b8', fontWeight: 'bold' }}>
              {customVocabEnabled ? '🟢 ON（子どもも追加できる）' : '⚪️ OFF（子どもには非表示）'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <Button
              style={{ flex: 1, background: customVocabEnabled ? '#ccc' : 'var(--color-success)' }}
              disabled={customVocabEnabled}
              onClick={async () => { setCustomVocabEnabled(true); await persistSettings({ customVocabEnabled: true }); }}
            >
              🟢 ONにする
            </Button>
            <Button
              style={{ flex: 1, background: !customVocabEnabled ? '#ccc' : 'var(--color-error)' }}
              disabled={!customVocabEnabled}
              onClick={async () => { setCustomVocabEnabled(false); await persistSettings({ customVocabEnabled: false }); }}
            >
              ⚪️ OFFにする
            </Button>
          </div>
        </div>

        <div className="glass-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Gauge size={22} /> APIの1日あたり上限（コスト対策）</h2>
          <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
            1台の端末が1日に使えるAIの回数の上限です。上限に達すると、その日はやさしいメッセージが出て止まります（翌日リセット）。
            <br />Gemini＝AI英会話・お話づくり、Azure＝発音チェックの回数。<b>0にすると無制限</b>になります。
            <br />これとは別に、サーバー側で<b>クラス全体の1日上限</b>（Gemini 1500回・Azure 2000回）がかかります。変更はSupabaseのSecrets（<code>GEMINI_DAILY_CAP</code> / <code>AZURE_DAILY_CAP</code>）で。
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>🤖 Gemini（AI英会話・お話づくり）</label>
              <input type="number" min={0} value={geminiCap}
                onChange={e => setGeminiCap(Number(e.target.value))}
                style={{ width: '100%', padding: '0.6rem', fontSize: '1.1rem', borderRadius: '8px', border: '2px solid #e2e8f0', boxSizing: 'border-box' }} />
              <span style={{ fontSize: '0.8rem', color: '#888' }}>この端末の今日の利用：{getUsage('gemini')} 回</span>
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.3rem' }}>🎤 Azure（発音チェック）</label>
              <input type="number" min={0} value={azureCap}
                onChange={e => setAzureCap(Number(e.target.value))}
                style={{ width: '100%', padding: '0.6rem', fontSize: '1.1rem', borderRadius: '8px', border: '2px solid #e2e8f0', boxSizing: 'border-box' }} />
              <span style={{ fontSize: '0.8rem', color: '#888' }}>この端末の今日の利用：{getUsage('azure')} 回</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
            <Button onClick={handleSaveCaps} icon={Save}>上限を保存</Button>
            {capStatus && <span style={{ color: capStatus === '通信エラー' ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 'bold' }}>{capStatus}</span>}
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: '2rem' }}>
        <h2>🗣️ AI英会話：Unitゴールの編集</h2>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
          各Unitの「ミッション（子ども向け表示）」と「ゴール（AIが[CLEAR]を判定する条件・英語）」を編集できます。
          空欄のままなら既定の文が使われます。U6の注文〜会計など、判定を厳しく/ゆるくしたいときに調整してください。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.5rem' }}>
          {FREETALK_UNITS.map(u => (
            <div key={u.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.8rem' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--color-primary)', marginBottom: '0.4rem' }}>{u.label}</div>
              <label style={{ fontSize: '0.8rem', color: '#64748b' }}>ミッション（子ども向け）
                <input
                  value={freetalkGoals[u.id]?.missionJa ?? u.missionJa}
                  onChange={e => setFreetalkGoals(p => ({ ...p, [u.id]: { ...p[u.id], missionJa: e.target.value } }))}
                  style={{ display: 'block', width: '100%', marginTop: '0.2rem', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }} />
              </label>
              <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginTop: '0.4rem' }}>ゴール（AI判定・英語）
                <textarea
                  value={freetalkGoals[u.id]?.goal ?? u.goal}
                  onChange={e => setFreetalkGoals(p => ({ ...p, [u.id]: { ...p[u.id], goal: e.target.value } }))}
                  style={{ display: 'block', width: '100%', marginTop: '0.2rem', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.85rem', minHeight: '48px' }} />
              </label>
              <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginTop: '0.4rem' }}>AIの第一声（英語）※ゴールの場面を変えたときに合わせる
                <input
                  value={freetalkGoals[u.id]?.greetingEn ?? u.greeting.en}
                  onChange={e => setFreetalkGoals(p => ({ ...p, [u.id]: { ...p[u.id], greetingEn: e.target.value } }))}
                  style={{ display: 'block', width: '100%', marginTop: '0.2rem', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }} />
              </label>
              <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginTop: '0.4rem' }}>AIの第一声（日本語訳）
                <input
                  value={freetalkGoals[u.id]?.greetingJa ?? u.greeting.ja}
                  onChange={e => setFreetalkGoals(p => ({ ...p, [u.id]: { ...p[u.id], greetingJa: e.target.value } }))}
                  style={{ display: 'block', width: '100%', marginTop: '0.2rem', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontSize: '0.9rem' }} />
              </label>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
          <Button onClick={handleSaveGoals} icon={Save}>ゴールを保存</Button>
          {goalSaveMsg && <span style={{ color: goalSaveMsg === '通信エラー' ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 'bold' }}>{goalSaveMsg}</span>}
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: '2rem' }}>
        <h2>📒 AI英会話の記録（チーム／個人）</h2>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
          子どもが「📝 記録」を押した会話だけが残ります（自動では残りません）。班名つきはチームの記録です。
          ✅はそのときゴール（[CLEAR]）に到達していたことを示します。
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <Button onClick={loadConvLogs} disabled={logsLoading}>{logsLoading ? '読み込み中…' : '記録を読み込む'}</Button>
          {convLogs && <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{convLogs.length}件</span>}
        </div>
        {convLogs && convLogs.length === 0 && (
          <div style={{ padding: '1.5rem', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px', color: '#666' }}>まだ記録はありません</div>
        )}
        {convLogs && convLogs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {convLogs.map(log => (
              <div key={log.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                  style={{ padding: '0.7rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', background: expandedLogId === log.id ? '#f8fafc' : 'white' }}>
                  {log.cleared ? <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✅クリア</span> : <span style={{ color: '#94a3b8' }}>―</span>}
                  {log.team ? <span style={{ background: '#eef2ff', color: '#4338ca', borderRadius: '6px', padding: '0.1rem 0.5rem', fontWeight: 'bold', fontSize: '0.85rem' }}>班：{log.team}</span> : <span style={{ color: '#64748b', fontSize: '0.85rem' }}>{log.studentName}</span>}
                  <span style={{ fontWeight: 'bold' }}>{log.unitTitle}</span>
                  <span style={{ marginLeft: 'auto', color: '#94a3b8', fontSize: '0.8rem' }}>{new Date(log.ts).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {expandedLogId === log.id && (
                  <div style={{ padding: '0.8rem 1rem', borderTop: '1px solid #e2e8f0', background: 'white', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {log.lines.map((l, i) => (
                      <div key={i} style={{ fontSize: '0.9rem' }}>
                        <span style={{ fontWeight: 'bold', color: l.role === 'model' ? 'var(--color-primary)' : '#0984e3' }}>{l.role === 'model' ? 'AI' : (l.speaker || '子ども')}：</span>
                        <span>{l.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ReflectionTableCard students={students} />
      <CertificateCard students={students} />

      <div className="glass-card" style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0 }}>生徒の学習状況・ふりかえり</h2>
          <FoldButton open={studentsOpen} onClick={toggleStudentsOpen} />
        </div>
        {studentsOpen && (<>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '1rem' }}>
          クラス全員の学習状況を一覧で確認できます。「生徒ごと」「日ごと」「到達マップ（誰が未達か＋ペア提案）」で切り替えられます。
        </p>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {([['byStudent', '👤 生徒ごと'], ['byDate', '📅 日ごと'], ['map', '📊 到達マップ']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setStudentView(v)}
              style={{ padding: '0.5rem 1.2rem', borderRadius: '999px', border: '2px solid var(--color-primary)', cursor: 'pointer', fontWeight: 'bold', background: studentView === v ? 'var(--color-primary)' : 'white', color: studentView === v ? 'white' : 'var(--color-primary)' }}
            >
              {label}
            </button>
          ))}
        </div>

        {students.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px', color: '#666' }}>
            まだ生徒のデータがありません
          </div>
        ) : studentView === 'byStudent' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {students.map(student => {
              const isExpanded = expandedStudentId === student.id;
              const lastAccess = student.last_access ? new Date(student.last_access).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未アクセス';
              const reflections = student.reflections || [];

              return (
                <div key={student.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  {/* Summary Header */}
                  <div 
                    style={{ padding: '1rem 1.5rem', background: isExpanded ? '#f8fafc' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.2s' }}
                    onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                    className="hover-scale"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', width: '150px' }}>
                        {student.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: 'bold' }}>
                        ★ {student.points || 0} P
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', fontWeight: 'bold' }}>
                        🏅 バッジ {student.badges?.length || 0}個
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
                      最終アクセス: {lastAccess}
                      <span style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                    </div>
                  </div>

                  {/* Expanded Content: Reflections */}
                  {isExpanded && (
                    <div style={{ padding: '1.5rem', background: 'white', borderTop: '1px solid #e2e8f0' }}>
                      <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', color: '#475569' }}>ふりかえりノート</h3>
                      {reflections.length === 0 ? (
                        <p style={{ color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>まだふりかえりを書いていません</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {reflections.map((ref: any) => (
                            <div key={ref.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                                <span style={{ color: '#64748b' }}>{new Date(ref.date).toLocaleDateString('ja-JP')}</span>
                                <span style={{ letterSpacing: '2px' }}>
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <span key={i} style={{ color: i < ref.stars ? '#f59e0b' : '#cbd5e1' }}>★</span>
                                  ))}
                                </span>
                              </div>
                              <p style={{ margin: 0, color: '#334155', lineHeight: '1.5' }}>{ref.comment}</p>
                              {/* 先生からのコメント／スタンプ（双方向） */}
                              {renderFeedbackBox(student.id, ref)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : studentView === 'byDate' ? (
          (() => {
            // 全生徒のふりかえりを日付ごとにまとめる（新しい日付が上）。
            // 生徒idとふりかえり本体を保持して、その場で先生コメントを書けるようにする。
            const byDate: Record<string, { studentId: string; name: string; ref: any }[]> = {};
            students.forEach(s => {
              (s.reflections || []).forEach((r: any) => {
                const d = new Date(r.date).toLocaleDateString('ja-JP');
                (byDate[d] = byDate[d] || []).push({ studentId: s.id, name: s.name, ref: r });
              });
            });
            const dates = Object.keys(byDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
            if (dates.length === 0) {
              return <div style={{ padding: '2rem', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px', color: '#666' }}>まだふりかえりがありません</div>;
            }
            // Tab移動の順番（表示順）：上の日付から、各日の中の生徒順
            const navKeys: string[] = [];
            dates.forEach(d => byDate[d].forEach(item => navKeys.push(`${item.studentId}__${item.ref.id}`)));
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#0891b2' }}>
                  💡 コメント欄で <b>Enter</b>＝送信して次の子へ／<b>Tab</b>＝送信せずに次の子へ（Shift+Tabで前へ）。日本語変換中のEnter/Tabはそのまま変換に使えます。
                </p>
                {dates.map(date => (
                  <div key={date} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{ padding: '0.8rem 1.2rem', background: 'var(--color-primary)', color: 'white', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                      <span>📅 {date}</span>
                      <span>{byDate[date].length}件</span>
                    </div>
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                      {byDate[date].map(item => (
                        <div key={`${item.studentId}__${item.ref.id}`} style={{ background: '#f8fafc', padding: '0.8rem 1rem', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                            <span style={{ fontWeight: 'bold', color: '#334155' }}>{item.name}</span>
                            <span style={{ letterSpacing: '2px' }}>
                              {Array.from({ length: 5 }).map((_, j) => (
                                <span key={j} style={{ color: j < item.ref.stars ? '#f59e0b' : '#cbd5e1' }}>★</span>
                              ))}
                            </span>
                          </div>
                          <p style={{ margin: 0, color: '#334155', lineHeight: '1.5' }}>{item.ref.comment}</p>
                          {renderFeedbackBox(item.studentId, item.ref, navKeys)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        ) : (
          (() => {
            // 各生徒の到達状況を集計（students行のclear_counts/badges/dictionary_progress/pronunciation_historyから）
            const dialogueClear = (cc: any, id: string) => (cc?.[`dialogue_${id}`] || 0) > 0;
            const dialogueTotal = DIALOGUES.length;
            const phonicsTotal = stages.filter(st => !st.extra).length; // エクストラは到達数に含めない
            const wbTotal = WORLD_BENTO_QUIZZES.length;
            const kzTotal = KARUIZAWA_QUIZZES.length;
            const rows = students.map(s => {
              const cc = s.clear_counts || {};
              const badges: number[] = s.badges || [];
              const dict = s.dictionary_progress || {};
              const dialogueCount = DIALOGUES.filter(d => dialogueClear(cc, d.id)).length;
              const phonicsCount = badges.filter((b: number) => stages.find(st => st.id === b && !st.extra)).length;
              const wbCount = WORLD_BENTO_QUIZZES.filter(q => (cc[`textbook_quiz_${q.id}`] || 0) > 0).length;
              const kzCount = KARUIZAWA_QUIZZES.filter(q => (cc[`textbook_quiz_${q.id}`] || 0) > 0).length;
              const dictCount = Object.values(dict).filter((p: any) => p && (p.practice || p.spelling || p.speedKaruta || p.memoryGame)).length;
              const pron = s.pronunciation_history || [];
              const pronAvg = pron.length ? Math.round(pron.reduce((a: number, r: any) => a + (r.score || 0), 0) / pron.length) : null;
              const mastery = phonicsCount + dialogueCount + wbCount + kzCount + dictCount;
              return { s, cc, badges, dialogueCount, phonicsCount, wbCount, kzCount, dictCount, pronAvg, pronCount: pron.length, mastery, points: s.points || 0 };
            });
            // ペア提案：到達スコア順にならべ、上位（ヘルパー）×下位（サポート）でペアに
            const sorted = [...rows].sort((a, b) => b.mastery - a.mastery);
            const pairs: { helper: typeof rows[0]; support: typeof rows[0] }[] = [];
            let i = 0, j = sorted.length - 1;
            while (i < j) { pairs.push({ helper: sorted[i], support: sorted[j] }); i++; j--; }
            const leftover = i === j ? sorted[i] : null;

            // 「○/○」を色付きセルで（0=赤、満=緑、途中=オレンジ）
            const fracCell = (n: number, total: number) => {
              const color = n === 0 ? '#dc2626' : n >= total ? '#16a34a' : '#d97706';
              const bg = n === 0 ? '#fef2f2' : n >= total ? '#dcfce7' : '#fffbeb';
              return <td style={{ textAlign: 'center', padding: '0.35rem 0.4rem', borderRight: '1px solid #f1f5f9', background: bg, color, fontWeight: 'bold', whiteSpace: 'nowrap' }}>{n}/{total}</td>;
            };
            const th = (label: string) => <th style={{ padding: '0.4rem 0.4rem', color: '#64748b', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{label}</th>;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* ペア提案 */}
                <div className="glass-card" style={{ padding: '1.2rem', background: '#eef2ff', border: '1px solid #c7d2fe' }}>
                  <h3 style={{ margin: '0 0 0.3rem 0', color: '#4338ca' }}>🤝 ペア提案（教え合い）</h3>
                  <p style={{ margin: '0 0 0.8rem 0', fontSize: '0.85rem', color: '#6366f1' }}>
                    到達スコア（フォニックス＋ダイアログ＋World Bento＋まちクイズ＋辞書のクリア数）が高い子（ヘルパー）と、サポートが要る子を組み合わせた案です。
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {pairs.map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', background: 'white', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#16a34a' }}>🦸 {p.helper.s.name}</span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>(到達{p.helper.mastery})</span>
                        <span style={{ color: '#94a3b8' }}>×</span>
                        <span style={{ fontWeight: 'bold', color: '#2563eb' }}>🌱 {p.support.s.name}</span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>(到達{p.support.mastery})</span>
                      </div>
                    ))}
                    {leftover && (
                      <div style={{ background: 'white', padding: '0.5rem 0.8rem', borderRadius: '8px', color: '#64748b' }}>
                        あまり：{leftover.s.name}（到達{leftover.mastery}）— 3人組にするかスタッフとペアに
                      </div>
                    )}
                  </div>
                </div>

                {/* 人ごと 全モード一覧 */}
                <div>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.4rem 0' }}>
                    各モードの「クリア数／全体」。<span style={{ color: '#dc2626', fontWeight: 'bold' }}>赤=0（要支援）</span>・<span style={{ color: '#d97706', fontWeight: 'bold' }}>オレンジ=途中</span>・<span style={{ color: '#16a34a', fontWeight: 'bold' }}>緑=全部</span>。発音は平均点（回数）。
                  </p>
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem', width: '100%' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc' }}>
                          <th style={{ textAlign: 'left', padding: '0.4rem 0.6rem', position: 'sticky', left: 0, background: '#f8fafc', minWidth: '110px' }}>生徒</th>
                          {th('🔤 フォニックス')}{th('🗣️ ダイアログ')}{th('🍱 World Bento')}{th('🏔 まちクイズ')}{th('📖 辞書')}{th('🎤 発音')}{th('🏅 到達')}{th('⭐ P')}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.s.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.3rem 0.6rem', position: 'sticky', left: 0, background: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{r.s.name}</td>
                            {fracCell(r.phonicsCount, phonicsTotal)}
                            {fracCell(r.dialogueCount, dialogueTotal)}
                            {fracCell(r.wbCount, wbTotal)}
                            {fracCell(r.kzCount, kzTotal)}
                            <td style={{ textAlign: 'center', padding: '0.35rem 0.4rem', borderRight: '1px solid #f1f5f9', fontWeight: 'bold', color: r.dictCount === 0 ? '#dc2626' : '#334155' }}>{r.dictCount}</td>
                            <td style={{ textAlign: 'center', padding: '0.35rem 0.4rem', borderRight: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                              {r.pronAvg !== null
                                ? <span style={{ fontWeight: 'bold', color: r.pronAvg >= 80 ? '#16a34a' : r.pronAvg >= 60 ? '#d97706' : '#dc2626' }}>{r.pronAvg}<span style={{ color: '#94a3b8', fontWeight: 'normal' }}>点({r.pronCount})</span></span>
                                : <span style={{ color: '#cbd5e1' }}>―</span>}
                            </td>
                            <td style={{ textAlign: 'center', padding: '0.35rem 0.4rem', borderRight: '1px solid #f1f5f9', fontWeight: 'bold', color: 'var(--color-primary)' }}>{r.mastery}</td>
                            <td style={{ textAlign: 'center', padding: '0.35rem 0.4rem', color: '#f59e0b', fontWeight: 'bold' }}>{r.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()
        )}
        </>)}
      </div>

      {/* 子どもの声はメールでもまとめが届くので、いちばん下に置く */}
      <div style={{ marginTop: '2rem' }}>
        <FeedbackCard notifyTo={notifyTo} setNotifyTo={setNotifyTo} onSaveNotifyTo={handleSaveNotifyTo} notifyMsg={notifyMsg} />
      </div>
    </div>
  );
};
