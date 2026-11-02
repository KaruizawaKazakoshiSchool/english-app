import { supabase } from './supabase';

// Googleログイン（段階②）の入口の整理。起動時に1回だけ呼ぶ。
//   1. ?google=1 で開いたのに、端末に合言葉の入室や前の人の名前が残っている → 消して、Googleのボタンが出る画面へ
//      （残っていると、URLを変えても前の人のまま入ってしまった。2026-11-02）
//   2. Googleで入っているのに、端末に別の人の番号が残っている → 消す（Login.tsx が本人で入り直す）
// 消すのはこの端末の入室だけ。signOut は必ず scope:'local'（既定の global だと、
// クラス共用アカウントで入っている全員の端末が出されてしまう）。

export const isGoogleEmail = (email?: string | null) => !!email && !email.endsWith('@kazakoshi.app');

const forgetStudent = () => {
  localStorage.removeItem('studentId');
  localStorage.removeItem('studentName');
};

/** 戻り値：入室済みなら true（false なら ClassGate を出す） */
export const prepareEntry = async (): Promise<boolean> => {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const wantGoogle = new URLSearchParams(window.location.search).get('google') === '1';
  const google = isGoogleEmail(session?.user?.email);

  if (wantGoogle && !google) {
    forgetStudent();
    if (session) await supabase.auth.signOut({ scope: 'local' });
    return false;
  }

  if (google) {
    const { data: me } = await supabase.rpc('my_student');
    const myId: string | undefined = Array.isArray(me) ? me[0]?.id : undefined;
    const saved = localStorage.getItem('studentId');
    // 名簿にないスタッフがPINで使う Test（00）だけはそのまま
    if (saved && (myId ? saved !== myId : saved !== '00')) forgetStudent();
  }
  return !!session;
};

/** 「おわる」：Googleで入っていたら、次の人が入れるよう、この端末の入室も消す */
export const logoutEntry = async (): Promise<boolean> => {
  forgetStudent();
  const { data } = await supabase.auth.getSession();
  if (!isGoogleEmail(data.session?.user?.email)) return false;
  await supabase.auth.signOut({ scope: 'local' });
  window.location.href = `${window.location.origin}${window.location.pathname}?google=1`;
  return true;
};
