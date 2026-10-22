-- 0001_schema: tipos, tablas, índices, vistas y competencia inicial.

create extension if not exists pgcrypto;

create type public.round_status as enum ('pending', 'open', 'closed', 'finalized', 'archived');

-- Emails con rol de administrador (siempre en minúsculas).
create table public.admins (
  email text primary key check (email = lower(email))
);
insert into public.admins (email) values ('diego.martin.ortino@grupokelsoft.com');

-- Nombre y avatar de cada usuario, tomados de Google.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Competencias: la actual y las archivadas.
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  status public.round_status not null default 'pending',
  winner_submission_id uuid,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz,
  finalized_at timestamptz,
  archived_at timestamptz
);
-- Siempre hay exactamente una competencia actual (no archivada).
create unique index rounds_one_current on public.rounds ((true)) where status <> 'archived';

-- Publicaciones: como máximo una por usuario y competencia.
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  image_path text not null,
  width int,
  height int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, user_id)
);
create index submissions_user_idx on public.submissions (user_id);

alter table public.rounds
  add constraint rounds_winner_fk foreign key (winner_submission_id)
  references public.submissions (id) on delete set null;
create index rounds_winner_idx on public.rounds (winner_submission_id);

-- Un voto por fila; hasta 3 filas por votante y competencia (lo controla cast_vote).
-- Borrar una publicación borra sus votos en cascada, y así vuelven a estar disponibles.
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  voter_id uuid not null references public.profiles (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index votes_round_voter_idx on public.votes (round_id, voter_id);
create index votes_submission_idx on public.votes (submission_id);
create index votes_voter_idx on public.votes (voter_id);

-- Tablón: una fila por publicación con autor, votos y posición (los empates comparten posición).
create view public.board with (security_invoker = true) as
select
  s.id,
  s.round_id,
  s.user_id,
  s.title,
  s.image_path,
  s.width,
  s.height,
  s.created_at,
  s.updated_at,
  p.full_name as author_name,
  p.avatar_url as author_avatar,
  coalesce(v.vote_count, 0)::int as vote_count,
  rank() over (partition by s.round_id order by coalesce(v.vote_count, 0) desc)::int as position
from public.submissions s
join public.profiles p on p.id = s.user_id
left join (
  select submission_id, count(*) as vote_count
  from public.votes
  group by submission_id
) v on v.submission_id = s.id;

-- Quién votó cada publicación y cuántas veces.
create view public.vote_details with (security_invoker = true) as
select
  v.submission_id,
  v.round_id,
  v.voter_id,
  p.full_name as voter_name,
  p.avatar_url as voter_avatar,
  count(*)::int as vote_count
from public.votes v
join public.profiles p on p.id = v.voter_id
group by v.submission_id, v.round_id, v.voter_id, p.full_name, p.avatar_url;

-- Primera competencia
insert into public.rounds (name) values ('Competencia 1');
