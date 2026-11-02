-- 0009_v2_access: quién ve qué. Funciones de acceso, RLS de las tablas nuevas y trigger de actividad.
--
-- Una persona ve el contenido de una competencia (publicaciones, votos, imágenes) si es pública,
-- si es su dueña, si es miembro o si es superadmin. Los datos generales (rounds) los ve todo el dominio.

-- Verdadero si el usuario puede ver el contenido de la competencia.
create function public.can_view_round(p_round_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_allowed_user() and exists (
    select 1 from public.rounds r
    where r.id = p_round_id
      and (
        r.visibility = 'public'
        or r.owner_id = auth.uid()
        or exists (
          select 1 from public.round_members m
          where m.round_id = r.id and m.user_id = auth.uid()
        )
        or public.is_admin()
      )
  )
$$;

-- Verdadero si el usuario es el dueño de la competencia.
create function public.is_round_owner(p_round_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_allowed_user() and exists (
    select 1 from public.rounds r
    where r.id = p_round_id and r.owner_id = auth.uid()
  )
$$;

revoke execute on function public.can_view_round(uuid) from public, anon;
revoke execute on function public.is_round_owner(uuid) from public, anon;
grant execute on function public.can_view_round(uuid) to authenticated;
grant execute on function public.is_round_owner(uuid) to authenticated;

-- ===== Publicaciones y votos: solo con acceso a la competencia =====
drop policy "Lectura para usuarios del dominio" on public.submissions;
drop policy "Lectura para usuarios del dominio" on public.votes;

create policy "Lectura con acceso a la competencia" on public.submissions
  for select to authenticated
  using ((select public.is_allowed_user()) and public.can_view_round(round_id));

create policy "Lectura con acceso a la competencia" on public.votes
  for select to authenticated
  using ((select public.is_allowed_user()) and public.can_view_round(round_id));

-- ===== Tablas nuevas =====
alter table public.round_members enable row level security;
alter table public.round_invites enable row level security;
alter table public.access_requests enable row level security;
alter table public.round_archives enable row level security;
alter table public.round_deletions enable row level security;

-- Miembros: cada uno ve su membresía; el dueño y el superadmin, todas las de la competencia.
create policy "Lectura del miembro, el dueño o el superadmin" on public.round_members
  for select to authenticated
  using (
    (select public.is_allowed_user())
    and (user_id = (select auth.uid()) or public.is_round_owner(round_id) or (select public.is_admin()))
  );

-- Token de invitación: solo el dueño o el superadmin.
create policy "Lectura del dueño o el superadmin" on public.round_invites
  for select to authenticated
  using ((select public.is_allowed_user()) and (public.is_round_owner(round_id) or (select public.is_admin())));

-- Solicitudes: quien la pidió, el dueño o el superadmin.
create policy "Lectura del solicitante, el dueño o el superadmin" on public.access_requests
  for select to authenticated
  using (
    (select public.is_allowed_user())
    and (user_id = (select auth.uid()) or public.is_round_owner(round_id) or (select public.is_admin()))
  );

-- Archivo: quien tiene acceso a la competencia. El enlace a Drive no se expone (permiso por columna);
-- el superadmin lo lee con admin_archives().
create policy "Lectura con acceso a la competencia" on public.round_archives
  for select to authenticated
  using ((select public.is_allowed_user()) and public.can_view_round(round_id));

-- round_deletions: sin políticas, solo la usan las políticas de Storage.

-- Defensa adicional: sin escrituras directas, y anon no ve nada.
revoke all on public.round_members, public.round_invites, public.access_requests,
  public.round_archives, public.round_deletions from anon, authenticated;
grant select on public.round_members, public.round_invites, public.access_requests to authenticated;
grant select (round_id, exported_at, snapshot) on public.round_archives to authenticated;

-- ===== Actividad =====
-- Cualquier cambio en publicaciones o votos actualiza rounds.last_activity_at, como mucho una vez
-- por hora (así un voto no genera un evento de Realtime en el hub de todos). Si otra transacción
-- tiene bloqueada la competencia (por ejemplo, otro voto en curso), se saltea: lo anotará el siguiente.
-- No toca competencias limpiadas, para que la limpieza no cuente como actividad.
create function public.touch_round_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_round_id uuid;
begin
  if tg_op = 'DELETE' then
    v_round_id := old.round_id;
  else
    v_round_id := new.round_id;
  end if;

  update public.rounds
     set last_activity_at = now()
   where id = (
     select r.id from public.rounds r
      where r.id = v_round_id
        and r.cleaned_at is null
        and r.last_activity_at < now() - interval '1 hour'
      for update skip locked
   );
  return null;
end $$;

revoke execute on function public.touch_round_activity() from public, anon, authenticated;

create trigger touch_round_activity
  after insert or update or delete on public.submissions
  for each row execute function public.touch_round_activity();

create trigger touch_round_activity
  after insert or delete on public.votes
  for each row execute function public.touch_round_activity();
