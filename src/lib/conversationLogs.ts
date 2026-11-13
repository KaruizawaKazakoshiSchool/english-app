import { supabase } from './supabase';

// AI英会話の「この会話を記録する」で保存される会話ログ。
// 子ども全員がロードする app_settings_v1 とは分けて、専用行 conversation_logs_v1 に保存する
// （＝子ども側のuseAppSettingsには乗らない＝毎回ダウンロードされない）。先生ダッシュボードだけが読む。

const LOGS_ID = 'conversation_logs_v1';

export interface ConversationLog {
  id: string;
  ts: number;
  studentId: string | null;
  studentName: string;
  unitId: string;        // 例: g5-u6, freetalk, restaurant
  unitTitle: string;
  team: string;          // 班名（空なら個人記録）
  cleared: boolean;      // [CLEAR] に到達したか
  lines: { role: string; text: string; speaker?: string }[]; // 会話本文（AI/自分・チーム時は話者名）
}

// 1件追記（最新が先頭、200件まで）。DB関数 append_conversation_log が書く
// （Googleで入った子は students 行を直接書けないため。2026-11-13）
export const saveConversationLog = async (log: ConversationLog): Promise<{ error: any }> => {
  if (!supabase) return { error: new Error('no supabase') };
  const { data, error } = await supabase.rpc('append_conversation_log', { p_log: log });
  return { error: error || (data === true ? null : new Error('not saved')) };
};

// 先生ダッシュボード用：全ログ取得（最新順）
export const fetchConversationLogs = async (): Promise<ConversationLog[]> => {
  if (!supabase) return [];
  const { data } = await supabase
    .from('students')
    .select('dictionary_progress')
    .eq('id', LOGS_ID)
    .single();
  const logs = data?.dictionary_progress?.logs;
  return Array.isArray(logs) ? logs : [];
};
