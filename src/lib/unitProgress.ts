// 「今の単元」パネル（トップ）の達成率を計算する。
//
// 先生が設定（app_settings_v1.currentUnit）に「この単元で使うモード」を並べると、
// トップにまとめて出す。子どもは達成率を見て「次はこれをやろう」と自分で選ぶ。
// 今日のミッションは、その中で「今日はここ！」を示す役（ポイント1.5倍）。
//
// 達成の数え方（すでにある記録をそのまま読む。新しく点は出さない）：
//   - 辞書 /dictionary/<単元>     … 自分の記録の「マスター！」と同じ5モード（選択・言葉さがし・タイピング・発音・Q&A）
//   - 教科書 /textbook?id=<id>    … その単元のクイズをクリアしたか
//   - 教科書 /textbook?set=<set>  … そのセットをクリアしたか
//   - ダイアログ /dialogue?id=<id> … その話型をクリアしたか
//   - AI英会話 /ai?unit=<id>      … その Unit で CLEAR ＋ ボーナス（2つ）
//     AI英会話の加点キーは以前 Unit をまたいで共通（ai_clear_freetalk）だった（2026-11-19からUnitごと）ので、Unit ごとの記録を別に残す（markUnitClear）
import { pushToSupabase } from './sync';
import type { DictCategoryProgress } from '../hooks/useDictionaryProgress';

export interface UnitHubItem { label: string; route: string; note?: string }
export interface CurrentUnit { title: string; subtitle?: string; items: UnitHubItem[] }

export const DICT_SKILLS: (keyof DictCategoryProgress)[] = ['practice', 'wordsearch', 'spelling', 'voice', 'qa'];

const clearCountsOf = (studentId: string | null): Record<string, number> => {
  if (!studentId) return {};
  try { return JSON.parse(localStorage.getItem(`clearCounts_${studentId}`) || '{}'); } catch { return {}; }
};

/** AI英会話で、どの Unit をクリアしたかを残す（点は出さない。記録だけ） */
export const markUnitClear = (key: string) => {
  const sid = localStorage.getItem('studentId');
  if (!sid) return;
  const counts = clearCountsOf(sid);
  counts[key] = (counts[key] || 0) + 1;
  localStorage.setItem(`clearCounts_${sid}`, JSON.stringify(counts));
  pushToSupabase(sid);
};

export type ItemKind = 'dictionary' | 'textbook' | 'dialogue' | 'ai' | 'other';

export interface ItemProgress { kind: ItemKind; done: number; total: number; missing?: string[] }

// 辞書の「あと何をやればマスターか」を見せるための名前（子どもの声 2026-09-26「3/5の下に、何が足りないか書いてほしい」）
export const DICT_SKILL_NAMES: Record<string, string> = { practice: '🎯選択', wordsearch: '🔍言葉さがし', spelling: '⌨️タイピング', voice: '🎤発音', qa: '❓Q&A' };

export const itemProgress = (route: string, dictProgress: Record<string, DictCategoryProgress>, studentId: string | null): ItemProgress => {
  const counts = clearCountsOf(studentId);
  const [rawPath, query] = route.replace(/^#/, '').split('?');
  let path = rawPath;
  try { path = decodeURIComponent(rawPath); } catch { /* そのまま */ }
  const q = new URLSearchParams(query || '');
  const seg = path.split('/').filter(Boolean);
  if (seg[0] === 'dictionary' && seg[1]) {
    const p = (dictProgress[seg[1]] || {}) as any;
    return { kind: 'dictionary', done: DICT_SKILLS.filter(k => p[k]).length, total: DICT_SKILLS.length,
             missing: DICT_SKILLS.filter(k => !p[k]).map(k => DICT_SKILL_NAMES[k as string]) };
  }
  if (seg[0] === 'textbook') {
    const id = q.get('id'); const set = q.get('set');
    const key = id ? `textbook_quiz_${id}` : set ? `textbook_set_${set}` : '';
    return { kind: 'textbook', done: key && counts[key] ? 1 : 0, total: 1 };
  }
  if (seg[0] === 'dialogue') {
    const id = q.get('id');
    return { kind: 'dialogue', done: id && counts[`dialogue_${id}`] ? 1 : 0, total: 1 };
  }
  if (seg[0] === 'ai') {
    const unit = q.get('unit');
    if (!unit) return { kind: 'ai', done: 0, total: 1 };
    const c = counts[`ai_unit_clear_${unit}`] ? 1 : 0;
    const b = counts[`ai_unit_bonus_${unit}`] ? 1 : 0;
    return { kind: 'ai', done: c + b, total: 2 };
  }
  return { kind: 'other', done: 0, total: 0 };
};
