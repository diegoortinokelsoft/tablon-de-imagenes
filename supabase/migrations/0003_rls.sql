-- 0003_rls: RLS en las cinco tablas y solo políticas de lectura.
-- Ninguna tabla tiene políticas de insert, update ni delete: toda escritura pasa por RPC.

alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.rounds enable row level security;
alter table public.submissions enable row level security;
alter table public.votes enable row level security;

-- admins: sin políticas, nadie la lee directamente.

create policy "Lectura para usuarios del dominio" on public.profiles
  for select to authenticated using ((select public.is_allowed_user()));

create policy "Lectura para usuarios del dominio" on public.rounds
  for select to authenticated using ((select public.is_allowed_user()));

create policy "Lectura para usuarios del dominio" on public.submissions
  for select to authenticated using ((select public.is_allowed_user()));

create policy "Lectura para usuarios del dominio" on public.votes
  for select to authenticated using ((select public.is_allowed_user()));

-- Defensa adicional: sin privilegios de escritura directa, y anon no ve nada.
revoke all on public.admins, public.profiles, public.rounds, public.submissions, public.votes from anon, authenticated;
revoke all on public.board, public.vote_details from anon, authenticated;
grant select on public.profiles, public.rounds, public.submissions, public.votes to authenticated;
grant select on public.board, public.vote_details to authenticated;
