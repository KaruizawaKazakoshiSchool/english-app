import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Database features may not work.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  // Googleログイン（準備中）：戻ってくるときに ?code= で受け取る方式。
  // ハッシュ（#access_token=…）で返す方式だと HashRouter の #/ とぶつかるため
  { auth: { flowType: 'pkce' } }
);

// We define a standard interface for the student data structure
export interface StudentData {
  id: string; // The student ID
  name: string;
  points: number;
  badges: number[]; // array of stage IDs
  clear_counts: Record<string, number>;
  dictionary_progress: Record<string, any>;
  reflections: any[];
}
