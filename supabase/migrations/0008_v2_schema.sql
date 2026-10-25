-- 0008_v2_schema: competencias múltiples. Tipos, columnas y tablas nuevas, y migración de los datos de la v1.
--
-- Cada competencia pasa a tener dueño, visibilidad y fecha de última actividad. Desaparece la regla
-- de "una sola competencia actual" y el estado 'archived': una finalizada queda como su propio historial.

create type public.round_visibility as enum ('public', 'private');
create type public.request_status as enum ('pending', 'approved', 'rejected');
create type public.member_source as enum ('invite_link', 'added', 'request');

-- ===== round_status sin 'archived' =====
-- Lo que depende del tipo o de rounds.status se borra antes de convertir la columna:
-- el índice de competencia única, la RPC de estados de la v1 (se reemplaza en 0010)
-- y la política de subida de Storage (se recrea en 0012).
drop index public.rounds_one_current;
drop function public.admin_set_round_status(public.round_status);
drop policy "submissions: subir en la competencia abierta" on storage.objects;

alter type public.round_status rename to round_status_v1;
create type public.round_status as enum ('pending', 'open', 'closed', 'finalized');

alter table public.rounds alter column status drop default;
alter table public.rounds
  alter column status type public.round_status
  using (case when status = 'archived' then 'finalized' else status::text end)::public.round_status;
alter table public.rounds alter column status set default 'pending';
drop type public.round_status_v1;

-- ===== Columnas nuevas de rounds =====
alter table public.rounds
  add column owner_id uuid references public.profiles (id) on delete restrict,
  add column visibility public.round_visibility not null default 'public',
  add column last_activity_at timestamptz not null default now(),
  add column cleaned_at timestamptz;

-- Las competencias de la v1 pasan a ser del administrador.
update public.rounds
   set owner_id = (
     select p.id from public.profiles p
     join public.admins a on a.email = p.email
     order by p.created_at
     limit 1
   );

-- Última actividad: la fecha más reciente de la competencia, sus publicaciones y sus votos.
update public.rounds r
   set last_activity_at = greatest(
     r.created_at, r.opened_at, r.closed_at, r.finalized_at, r.archived_at,
     (select max(s.updated_at) from public.submissions s where s.round_id = r.id),
     (select max(v.created_at) from public.votes v where v.round_id = r.id)
   );

-- Si había competencias y el administrador nunca inició sesión, esto falla: hay que entrar una vez antes de migrar.
alter table public.rounds alter column owner_id set not null;
alter table public.rounds drop column archived_at;

create index rounds_owner_active_idx on public.rounds (owner_id)
  where status <> 'finalized' and cleaned_at is null;
create index rounds_last_activity_idx on public.rounds (last_activity_at)
  where cleaned_at is null;

-- ===== Miembros de competencias privadas =====
create table public.round_members (
  round_id uuid not null references public.rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  source public.member_source not null,
  joined_at timestamptz not null default now(),
  primary key (round_id, user_id)
);
create index round_members_user_idx on public.round_members (user_id);

-- ===== Token del enlace de invitación (uno por competencia) =====
-- Tabla aparte porque rounds la lee todo el dominio y RLS filtra filas, no columnas.
create table public.round_invites (
  round_id uuid primary key references public.rounds (id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
insert into public.round_invites (round_id) select id from public.rounds;

-- ===== Solicitudes de acceso =====
create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
-- Una sola solicitud pendiente por persona y competencia.
create unique index access_requests_one_pending
  on public.access_requests (round_id, user_id) where status = 'pending';
create index access_requests_round_idx on public.access_requests (round_id, status);
create index access_requests_user_idx on public.access_requests (user_id);

-- ===== Exportación a Drive y foto del resultado al limpiar =====
create table public.round_archives (
  round_id uuid primary key references public.rounds (id) on delete cascade,
  drive_url text,                 -- null si el ZIP se descargó y se guardó a mano
  exported_at timestamptz not null default now(),
  snapshot jsonb                  -- se completa al limpiar: ganador, ranking y totales
);

-- ===== Competencias borradas con archivos pendientes de limpiar =====
-- Al borrar una competencia la fila desaparece, y quien la borró ya no es "dueño" de nada.
-- Esta tabla le permite listar y borrar los archivos que quedaron en Storage (ver 0012).
create table public.round_deletions (
  round_id uuid primary key,
  deleted_by uuid not null references public.profiles (id) on delete cascade,
  deleted_at timestamptz not null default now()
);
create index round_deletions_user_idx on public.round_deletions (deleted_by);
