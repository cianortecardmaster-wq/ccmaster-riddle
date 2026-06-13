-- CC MASTER Riddles — correção de progresso e ranking
-- Cole no Supabase: SQL Editor > New query > Run.
-- Objetivo:
-- 1) garantir que o progresso do jogador possa ser salvo na tabela progress;
-- 2) manter respostas erradas fora do cálculo do ranking;
-- 3) usar dicas extras apenas como critério de desempate;
-- 4) mostrar ranking público apenas com apelido, progresso e dicas.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  riddle_id integer not null,
  solved boolean not null default false,
  solved_at timestamptz,
  hints_used integer not null default 0,
  attempts_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  riddle_id integer not null,
  answer_submitted text,
  correct boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.progress add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.progress add column if not exists riddle_id integer;
alter table public.progress add column if not exists solved boolean not null default false;
alter table public.progress add column if not exists solved_at timestamptz;
alter table public.progress add column if not exists hints_used integer not null default 0;
alter table public.progress add column if not exists attempts_count integer not null default 0;
alter table public.progress add column if not exists updated_at timestamptz not null default now();

alter table public.attempts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.attempts add column if not exists riddle_id integer;
alter table public.attempts add column if not exists answer_submitted text;
alter table public.attempts add column if not exists correct boolean not null default false;
alter table public.attempts add column if not exists created_at timestamptz not null default now();

update public.profiles
set nickname = 'Investigador'
where nickname is null or trim(nickname) = '';

update public.progress
set
  solved = coalesce(solved, false),
  hints_used = greatest(coalesce(hints_used, 0), 0),
  attempts_count = greatest(coalesce(attempts_count, 0), 0),
  updated_at = coalesce(updated_at, now())
where true;

-- Índice para acelerar consultas e evitar duplicar progresso do mesmo riddle.
-- Se você já tiver registros duplicados, o ranking abaixo não duplica pontos mesmo assim.
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'progress'
      and indexname = 'progress_user_riddle_unique_idx'
  ) then
    begin
      create unique index progress_user_riddle_unique_idx
        on public.progress (user_id, riddle_id);
    exception
      when unique_violation then
        raise notice 'Existem registros duplicados em progress. O ranking foi protegido contra duplicidade, mas o índice único não foi criado.';
      when others then
        raise notice 'Não foi possível criar índice único em progress: %', SQLERRM;
    end;
  end if;
end $$;

alter table public.profiles enable row level security;
alter table public.progress enable row level security;
alter table public.attempts enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "progress_select_own" on public.progress;
drop policy if exists "progress_insert_own" on public.progress;
drop policy if exists "progress_update_own" on public.progress;

create policy "progress_select_own"
  on public.progress for select
  to authenticated
  using (auth.uid() = user_id);

create policy "progress_insert_own"
  on public.progress for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "progress_update_own"
  on public.progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "attempts_select_own" on public.attempts;
drop policy if exists "attempts_insert_own" on public.attempts;

create policy "attempts_select_own"
  on public.attempts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "attempts_insert_own"
  on public.attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.progress to authenticated;
grant select, insert on public.attempts to authenticated;

-- Remove a função antiga antes de recriar.
-- Isso é necessário quando o formato de retorno mudou.
drop function if exists public.get_public_leaderboard();

create or replace function public.get_public_leaderboard()
returns table (
  user_id uuid,
  nickname text,
  solved_count bigint,
  total_hints_used bigint,
  last_solved_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with progress_by_riddle as (
    select
      pr.user_id,
      pr.riddle_id,
      bool_or(coalesce(pr.solved, false)) as solved,
      max(greatest(coalesce(pr.hints_used, 0), 0))::bigint as hints_used,
      min(pr.solved_at) filter (where pr.solved = true) as first_solved_at,
      max(pr.updated_at) as last_activity_at
    from public.progress pr
    where pr.user_id is not null
      and pr.riddle_id is not null
    group by pr.user_id, pr.riddle_id
  )
  select
    p.id as user_id,
    coalesce(nullif(trim(p.nickname), ''), 'Investigador') as nickname,
    count(*) filter (where pr.solved = true) as solved_count,
    coalesce(sum(pr.hints_used), 0)::bigint as total_hints_used,
    max(pr.first_solved_at) filter (where pr.solved = true) as last_solved_at
  from public.profiles p
  join progress_by_riddle pr
    on pr.user_id = p.id
  group by p.id, p.nickname
  having count(*) > 0
  order by
    solved_count desc,
    total_hints_used asc,
    last_solved_at asc nulls last,
    nickname asc;
$$;

grant execute on function public.get_public_leaderboard() to anon, authenticated;
