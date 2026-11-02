-- 旧URLの案内ページ（ログインなし）から声を受け取る入口。feedback への書きこみはここ経由だけ。
-- screen='old-url' に固定、文字数を制限、1日の件数に上限（いたずらで受付箱があふれないように）。
create or replace function public.old_url_voice(p_message text, p_student_id text default null, p_student_name text default null, p_ua text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  msg text := left(trim(coalesce(p_message, '')), 1000);
begin
  if msg = '' then return false; end if;
  if (select count(*) from feedback where screen = 'old-url' and ts > now() - interval '1 day') >= 100 then
    return false;
  end if;
  insert into feedback (student_id, student_name, kind, message, screen, ua)
  values (left(p_student_id, 8), coalesce(nullif(left(trim(coalesce(p_student_name, '')), 40), ''), 'ゲスト'), 'bug', msg, 'old-url', left(p_ua, 120));
  return true;
end;
$$;
revoke all on function public.old_url_voice(text, text, text, text) from public;
grant execute on function public.old_url_voice(text, text, text, text) to anon, authenticated;
