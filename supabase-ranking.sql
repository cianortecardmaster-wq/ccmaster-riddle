-- Função pública do ranking do CC MASTER Riddles.
-- Cole este SQL no Supabase se precisar atualizar o cálculo do ranking.
-- Regra:
-- 1) quem resolveu mais riddles fica na frente;
-- 2) em empate, quem viu menos dicas extras fica na frente;
-- 3) respostas erradas NÃO interferem no ranking.

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
  select
    p.id as user_id,
    coalesce(nullif(trim(p.nickname), ''), 'Investigador') as nickname,
    count(pr.id) filter (where pr.solved = true) as solved_count,
    coalesce(sum(coalesce(pr.hints_used, 0)), 0)::bigint as total_hints_used,
    max(pr.solved_at) filter (where pr.solved = true) as last_solved_at
  from public.profiles p
  join public.progress pr
    on pr.user_id = p.id
  group by p.id, p.nickname
  having count(pr.id) > 0
  order by
    solved_count desc,
    total_hints_used asc,
    last_solved_at asc nulls last,
    nickname asc;
$$;

grant execute on function public.get_public_leaderboard() to anon, authenticated;
