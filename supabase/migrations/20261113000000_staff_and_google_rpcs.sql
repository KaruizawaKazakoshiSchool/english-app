-- 合言葉を子どもの入口から外す準備（2026-11-13）。本番には apply_migration で適用済み。
-- 先生（スタッフ）の学園Googleアカウント一覧。アプリからは読めない（ポリシーなし）。追加は管理画面で1行足すだけ
create table if not exists public.staff_members (
  email text primary key,
  note text,
  created_at timestamptz default now()
);
alter table public.staff_members enable row level security;
-- 最初の1人（さんだー）は auth.users から入れた。メールはここに書かない

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_members where email = lower(coalesce(auth.jwt() ->> 'email', '')))
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- 先生：子どもの行・設定の行を書ける
create policy staff_update on public.students for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy staff_insert on public.students for insert to authenticated with check (public.is_staff());

-- 背景写真：Googleで入った子は自分の1枚だけ、先生は全部（消すのも）
create policy bg_google_own_read on storage.objects for select to authenticated
  using (bucket_id = 'backgrounds' and name = public.my_student_id() || '.jpg');
create policy bg_google_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'backgrounds' and name = public.my_student_id() || '.jpg');
create policy bg_google_own_update on storage.objects for update to authenticated
  using (bucket_id = 'backgrounds' and name = public.my_student_id() || '.jpg')
  with check (bucket_id = 'backgrounds' and name = public.my_student_id() || '.jpg');
create policy bg_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'backgrounds' and public.is_staff())
  with check (bucket_id = 'backgrounds' and public.is_staff());

-- 入ってよい人（クラス共用アカウント or 学園ドメイン）
create or replace function public._is_member() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'class56@kazakoshi.app'
      or coalesce(auth.jwt() ->> 'email', '') ~* '@kazakoshi\.(ed\.)?jp$'
$$;

-- AI英会話の記録を1件足す（最新が先頭・200件まで）
create or replace function public.append_conversation_log(p_log jsonb) returns boolean
language plpgsql security definer set search_path = public as $$
declare logs jsonb; me text;
begin
  if not public._is_member() then return false; end if;
  if p_log is null or jsonb_typeof(p_log) <> 'object' or length(p_log::text) > 60000 then return false; end if;
  me := public.my_student_id();
  if me is not null then p_log := p_log || jsonb_build_object('studentId', me); end if;

  insert into public.students(id, name, dictionary_progress)
  values ('conversation_logs_v1', 'Conversation Logs', '{"logs":[]}'::jsonb)
  on conflict (id) do nothing;

  select coalesce(dictionary_progress -> 'logs', '[]'::jsonb) into logs
  from public.students where id = 'conversation_logs_v1' for update;
  if jsonb_typeof(logs) <> 'array' then logs := '[]'::jsonb; end if;
  logs := jsonb_build_array(p_log) || logs;
  select coalesce(jsonb_agg(e order by i), '[]'::jsonb) into logs
  from jsonb_array_elements(logs) with ordinality t(e, i) where i <= 200;

  update public.students
  set dictionary_progress = coalesce(dictionary_progress, '{}'::jsonb) || jsonb_build_object('logs', logs)
  where id = 'conversation_logs_v1';
  return true;
end $$;
revoke all on function public.append_conversation_log(jsonb) from public, anon;
grant execute on function public.append_conversation_log(jsonb) to authenticated;

-- マイ単語を1件足す（設定行の customVocab）
create or replace function public.add_custom_vocab(p_english text, p_japanese text, p_category text, p_emoji text, p_image_url text default null)
returns boolean
language plpgsql security definer set search_path = public as $$
declare entry jsonb; dp jsonb;
begin
  if not public._is_member() then return false; end if;
  p_english := btrim(coalesce(p_english, '')); p_japanese := btrim(coalesce(p_japanese, ''));
  if p_english = '' or p_japanese = '' or length(p_english) > 100 or length(p_japanese) > 100
     or length(coalesce(p_category, '')) > 40 or length(coalesce(p_emoji, '')) > 16
     or length(coalesce(p_image_url, '')) > 1000 then
    return false;
  end if;
  entry := jsonb_build_object(
    'id', 'custom_' || (extract(epoch from clock_timestamp()) * 1000)::bigint,
    'english', p_english,
    'japanese', p_japanese,
    'category', coalesce(nullif(btrim(p_category), ''), 'マイ単語'),
    'emoji', coalesce(nullif(btrim(p_emoji), ''), '✏️'));
  if nullif(btrim(coalesce(p_image_url, '')), '') is not null then
    entry := entry || jsonb_build_object('imageUrl', btrim(p_image_url));
  end if;

  select coalesce(dictionary_progress, '{}'::jsonb) into dp
  from public.students where id = 'app_settings_v1' for update;
  if not found then return false; end if;
  update public.students
  set dictionary_progress = dp || jsonb_build_object('customVocab', coalesce(dp -> 'customVocab', '[]'::jsonb) || jsonb_build_array(entry))
  where id = 'app_settings_v1';
  return true;
end $$;
revoke all on function public.add_custom_vocab(text, text, text, text, text) from public, anon;
grant execute on function public.add_custom_vocab(text, text, text, text, text) to authenticated;
