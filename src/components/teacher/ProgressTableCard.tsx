import React, { useMemo, useState } from 'react';
import { useVocabulary } from '../../hooks/useVocabulary';
import { stages } from '../../data/stages';
import { DEFAULT_QUIZZES } from '../textbook/textbookQuizData';
import { DIALOGUES } from '../dialogue/dialogueData';
import { isArchived } from '../../data/archivedUnits';

// 成績をつけるための「取組状況の一覧」（先生用・1人1行）。2026-11-11
// 表示は先生のブラウザの中だけで完結する（AIには通さない＝学園のルール）。CSVで保存もできる。
// 期間で絞れるのは、日時が残っているもの（ふりかえり・発音スコア）だけ。
// クリアの記録（フォニックス・辞書・教科書・ダイアログ・回数）は日時を持たないので、いつも「これまでの合計」。

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const DICT_SKILLS = ['practice', 'wordsearch', 'spelling', 'voice', 'qa'] as const;
const coreStages = stages.filter(st => !st.extra);

interface Row {
  id: string; name: string; grade: number | null; cls: string;
  phonics: number; dictMastered: number; dictModes: number;
  textbook: number; textbookAll: number; dialogue: number; dialogueAll: number;
  story: number; ai: number;
  pronBest: number | null; pronAvg10: number | null; pronCount: number;
  reflDays: number; reflStarsAvg: number | null;
  points: number;
}

export const ProgressTableCard: React.FC<{ students: any[] }> = ({ students }) => {
  const vocabulary = useVocabulary();
  const categories = useMemo(() => Array.from(new Set(vocabulary.map(v => v.category))), [vocabulary]);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(localDate(new Date()));
  const [grade, setGrade] = useState('all');
  const [cls, setCls] = useState('all');

  const clsOptions = useMemo(() => Array.from(new Set(students.map(s => s.cls).filter(Boolean))).sort() as string[], [students]);

  const inRange = (t: number | string | undefined) => {
    if (t === undefined || t === null || t === '') return false;
    const d = localDate(new Date(t));
    return (!from || d >= from) && (!to || d <= to);
  };

  const rows: Row[] = useMemo(() => students
    .filter(s => /^\d+$/.test(s.id) && s.id !== '00' && s.id !== '99')
    .filter(s => grade === 'all' || String(s.grade) === grade)
    .filter(s => cls === 'all' || s.cls === cls)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(s => {
      const cc: Record<string, number> = s.clear_counts || {};
      const badges: number[] = Array.isArray(s.badges) ? s.badges : [];
      const dict: Record<string, any> = s.dictionary_progress || {};
      const forMe = (g: number) => !s.grade || g === s.grade;
      const tb = DEFAULT_QUIZZES.filter(q => forMe(q.grade));
      const dl = DIALOGUES.filter(d => !isArchived(d.id) && forMe(d.grade));
      const pron = (Array.isArray(s.pronunciation_history) ? s.pronunciation_history : [])
        .filter((p: any) => p && typeof p.score === 'number' && inRange(p.ts))
        .sort((a: any, b: any) => a.ts - b.ts);
      const last10 = pron.slice(-10);
      const refl = (Array.isArray(s.reflections) ? s.reflections : []).filter((r: any) => r && inRange(r.date));
      const starList = refl.map((r: any) => Number(r.stars) || 0).filter((n: number) => n > 0);
      return {
        id: s.id, name: s.name, grade: s.grade ?? null, cls: s.cls || '',
        phonics: badges.filter(b => coreStages.some(st => st.id === b)).length,
        dictMastered: categories.filter(c => DICT_SKILLS.every(k => dict[c]?.[k])).length,
        dictModes: categories.reduce((n, c) => n + DICT_SKILLS.filter(k => dict[c]?.[k]).length, 0),
        textbook: tb.filter(q => (cc[`textbook_quiz_${q.id}`] || 0) > 0).length, textbookAll: tb.length,
        dialogue: dl.filter(d => (cc[`dialogue_${d.id}`] || 0) > 0).length, dialogueAll: dl.length,
        story: (cc['story_mode'] || 0) + (cc['story_mode_reading'] || 0),
        ai: Object.entries(cc).filter(([k]) => k.startsWith('ai_clear_')).reduce((n, [, v]) => n + (v || 0), 0),
        pronBest: pron.length ? Math.max(...pron.map((p: any) => p.score)) : null,
        pronAvg10: last10.length ? Math.round(last10.reduce((n: number, p: any) => n + p.score, 0) / last10.length) : null,
        pronCount: pron.length,
        reflDays: new Set(refl.map((r: any) => localDate(new Date(r.date)))).size,
        reflStarsAvg: starList.length ? Math.round((starList.reduce((a: number, b: number) => a + b, 0) / starList.length) * 10) / 10 : null,
        points: s.points || 0,
      };
    }), [students, categories, from, to, grade, cls]);

  const COLS: { label: string; get: (r: Row) => string }[] = [
    { label: '番号', get: r => r.id },
    { label: '名前', get: r => r.name },
    { label: '学年', get: r => (r.grade ? `${r.grade}年` : '') },
    { label: 'クラス', get: r => r.cls },
    { label: `フォニックス（/${coreStages.length}）`, get: r => String(r.phonics) },
    { label: `辞書マスター単元（/${categories.length}）`, get: r => String(r.dictMastered) },
    { label: `辞書モードのクリア（/${categories.length * DICT_SKILLS.length}）`, get: r => String(r.dictModes) },
    { label: '教科書', get: r => `${r.textbook}/${r.textbookAll}` },
    { label: 'ダイアログ', get: r => `${r.dialogue}/${r.dialogueAll}` },
    { label: 'お話づくり（回）', get: r => String(r.story) },
    { label: 'AI英会話クリア（回）', get: r => String(r.ai) },
    { label: '発音 最高点', get: r => (r.pronBest ?? '') + '' },
    { label: '発音 最近10回の平均', get: r => (r.pronAvg10 ?? '') + '' },
    { label: '発音の回数', get: r => String(r.pronCount) },
    { label: 'ふりかえり（日数）', get: r => String(r.reflDays) },
    { label: 'ふりかえり ⭐平均', get: r => (r.reflStarsAvg ?? '') + '' },
    { label: 'ポイント（これまでの合計）', get: r => String(r.points) },
  ];

  const downloadCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [COLS.map(c => esc(c.label)).join(',')];
    for (const r of rows) lines.push(COLS.map(c => esc(c.get(r))).join(','));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `取組状況_${from || 'はじめ'}〜${to || '今日'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const cell: React.CSSProperties = { padding: '0.4rem 0.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem', whiteSpace: 'nowrap' };
  const ctrl: React.CSSProperties = { padding: '0.4rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.95rem' };

  return (
    <div className="glass-card" style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ margin: 0 }}>📊 取組状況の一覧（成績用）</h2>
        <button onClick={() => setOpen(o => !o)}
          style={{ padding: '0.4rem 1rem', borderRadius: '999px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>
          {open ? '▲ たたむ' : '▼ ひらく'}
        </button>
      </div>
      {open && (<>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', margin: '1rem 0' }}>
          <label>期間 <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={ctrl} /></label>
          〜 <input type="date" value={to} onChange={e => setTo(e.target.value)} style={ctrl} />
          <select value={grade} onChange={e => setGrade(e.target.value)} style={ctrl}>
            <option value="all">全学年</option><option value="5">5年</option><option value="6">6年</option>
          </select>
          <select value={cls} onChange={e => setCls(e.target.value)} style={ctrl}>
            <option value="all">全クラス</option>
            {clsOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <b>{rows.length}人</b>
          <button onClick={downloadCsv}
            style={{ marginLeft: 'auto', padding: '0.45rem 1.1rem', borderRadius: '999px', border: 'none', background: 'var(--color-primary)', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
            ⬇ CSVで保存
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 0.5rem' }}>
          期間で絞れるのは「発音」と「ふりかえり」だけ。ほかの列は日時が残っていないので、いつも これまでの合計です。
          教科書・ダイアログは その子の学年の分で数えています。画面を読み込んだ時点の内容です
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                {COLS.map(c => <th key={c.label} style={cell}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>{COLS.map(c => <td key={c.label} style={cell}>{c.get(r)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}
    </div>
  );
};
