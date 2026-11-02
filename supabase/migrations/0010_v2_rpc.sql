-- 0010_v2_rpc: RPC de la v2. Toda RPC recibe la competencia (o la deduce de la publicación),
-- verifica el acceso y lanza un código fijo ante un error.
--
-- Bloqueos, como en la v1: las RPC de participación toman la competencia con `for share` y las del
-- dueño con `for update`, así un cambio de estado espera a que terminen los votos en curso.

-- ===== Baja de la v1 =====
-- admin_set_round_status se borró en 0008 (dependía del tipo viejo).
drop function public.current_round();
drop function public.create_submission(text, text, int, int);
drop function public.update_submission_title(text);
drop function public.replace_submission_image(text, int, int);
drop function public.delete_my_submission();
drop function public.cast_vote(uuid);
drop function public.remove_vote(uuid);
drop function public.admin_rename_round(text);
drop function public.admin_finalize_round(uuid);
drop function public.admin_delete_submission(uuid);
drop function public.admin_hard_reset(text);
drop function public.admin_start_new_round(text);
drop function public.admin_delete_archived_round(uuid);

-- ===== Auxiliares =====

-- Competencia para participar: existe, hay acceso y no fue limpiada. Bloqueo compartido.
create function public.round_for_participant(p_round_id uuid) returns public.rounds
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  select * into v_round from public.rounds where id = p_round_id for share;
  if v_round.id is null then raise exception 'ROUND_NOT_FOUND'; end if;
  if not public.can_view_round(p_round_id) then raise exception 'NO_ACCESS'; end if;
  if v_round.cleaned_at is not null then raise exception 'ROUND_CLEANED'; end if;
  return v_round;
end $$;

-- Competencia para gestionar: existe, el usuario es el dueño y no fue limpiada. Bloqueo exclusivo.
create function public.round_for_owner(p_round_id uuid) returns public.rounds
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null then raise exception 'ROUND_NOT_FOUND'; end if;
  if v_round.owner_id is distinct from auth.uid() then raise exception 'NOT_OWNER'; end if;
  if v_round.cleaned_at is not null then raise exception 'ROUND_CLEANED'; end if;
  return v_round;
end $$;

-- Saca a una persona de una competencia: borra sus votos y su publicación (los votos recibidos
-- vuelven a sus votantes) y su membresía. Si era la ganadora, la competencia vuelve a 'closed'.
-- Devuelve la ruta de la imagen, si tenía, para borrarla de Storage.
create function public.purge_participant(p_round public.rounds, p_user_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_submission public.submissions;
begin
  delete from public.votes where round_id = p_round.id and voter_id = p_user_id;

  delete from public.submissions
   where round_id = p_round.id and user_id = p_user_id
  returning * into v_submission;

  if v_submission.id is not null
     and p_round.status = 'finalized'
     and p_round.winner_submission_id = v_submission.id then
    update public.rounds
       set status = 'closed', winner_submission_id = null, finalized_at = null, last_activity_at = now()
     where id = p_round.id;
  end if;

  delete from public.round_members where round_id = p_round.id and user_id = p_user_id;
  return v_submission.image_path;
end $$;

-- ===== Participación =====

-- Crea la publicación del usuario en una competencia abierta. Devuelve su id.
create function public.create_submission(
  p_round_id uuid, p_title text, p_image_path text, p_width int, p_height int
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_round public.rounds;
  v_title text;
  v_id uuid;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  v_round := public.round_for_participant(p_round_id);
  if v_round.status <> 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

  if exists (select 1 from public.submissions where round_id = v_round.id and user_id = v_uid) then
    raise exception 'ALREADY_SUBMITTED';
  end if;

  v_title := public.clean_title(p_title);
  perform public.check_image_path(v_round.id, v_uid, p_image_path);

  begin
    insert into public.submissions (round_id, user_id, title, image_path, width, height)
    values (
      v_round.id, v_uid, v_title, p_image_path,
      nullif(greatest(p_width, 0), 0), nullif(greatest(p_height, 0), 0)
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ALREADY_SUBMITTED';
  end;

  return v_id;
end $$;

-- Cambia el título de la propia publicación. Conserva los votos.
create function public.update_submission_title(p_round_id uuid, p_title text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
  v_title text;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  v_round := public.round_for_participant(p_round_id);
  if v_round.status <> 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

  v_title := public.clean_title(p_title);

  update public.submissions
     set title = v_title, updated_at = now()
   where round_id = v_round.id and user_id = auth.uid();
  if not found then raise exception 'NO_SUBMISSION'; end if;
end $$;

-- Reemplaza la imagen de la propia publicación: borra los votos recibidos
-- (vuelven a sus votantes) y devuelve la ruta anterior para borrarla de Storage.
create function public.replace_submission_image(
  p_round_id uuid, p_image_path text, p_width int, p_height int
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_round public.rounds;
  v_submission public.submissions;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  v_round := public.round_for_participant(p_round_id);
  if v_round.status <> 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

  select * into v_submission from public.submissions
   where round_id = v_round.id and user_id = v_uid
   for update;
  if v_submission.id is null then raise exception 'NO_SUBMISSION'; end if;

  perform public.check_image_path(v_round.id, v_uid, p_image_path);
  if p_image_path = v_submission.image_path then raise exception 'INVALID_PATH'; end if;

  delete from public.votes where submission_id = v_submission.id;

  update public.submissions
     set image_path = p_image_path,
         width = nullif(greatest(p_width, 0), 0),
         height = nullif(greatest(p_height, 0), 0),
         updated_at = now()
   where id = v_submission.id;

  return v_submission.image_path;
end $$;

-- Borra la propia publicación (los votos caen en cascada). Devuelve la ruta de la imagen.
create function public.delete_my_submission(p_round_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
  v_path text;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  v_round := public.round_for_participant(p_round_id);
  if v_round.status <> 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

  delete from public.submissions
   where round_id = v_round.id and user_id = auth.uid()
  returning image_path into v_path;
  if v_path is null then raise exception 'NO_SUBMISSION'; end if;

  return v_path;
end $$;

-- Agrega un voto. El bloqueo por usuario y competencia evita superar los 3 votos con clics simultáneos.
create function public.cast_vote(p_submission_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_round_id uuid;
  v_round public.rounds;
  v_owner uuid;
  v_used int;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  select round_id into v_round_id from public.submissions where id = p_submission_id;
  if v_round_id is null then raise exception 'NO_SUBMISSION'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || v_round_id::text, 0));

  v_round := public.round_for_participant(v_round_id);
  if v_round.status <> 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

  -- for share: si el autor está reemplazando la imagen, se espera a que termine.
  select user_id into v_owner from public.submissions
   where id = p_submission_id and round_id = v_round.id
   for share;
  if v_owner is null then raise exception 'NO_SUBMISSION'; end if;
  if v_owner = v_uid then raise exception 'OWN_SUBMISSION'; end if;

  select count(*) into v_used from public.votes
   where round_id = v_round.id and voter_id = v_uid;
  if v_used >= 3 then raise exception 'NO_VOTES_LEFT'; end if;

  insert into public.votes (round_id, voter_id, submission_id)
  values (v_round.id, v_uid, p_submission_id);
end $$;

-- Quita uno de los votos del usuario en esa publicación (el más reciente).
create function public.remove_vote(p_submission_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_round_id uuid;
  v_round public.rounds;
  v_vote_id uuid;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  select round_id into v_round_id from public.submissions where id = p_submission_id;
  if v_round_id is null then raise exception 'NO_VOTE_TO_REMOVE'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || v_round_id::text, 0));

  v_round := public.round_for_participant(v_round_id);
  if v_round.status <> 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

  select id into v_vote_id from public.votes
   where round_id = v_round.id and voter_id = v_uid and submission_id = p_submission_id
   order by created_at desc
   limit 1;
  if v_vote_id is null then raise exception 'NO_VOTE_TO_REMOVE'; end if;

  delete from public.votes where id = v_vote_id;
end $$;

-- ===== Competencias =====

-- Lista del hub: todas las competencias con lo que cada persona puede ver de ellas.
-- Es security definer porque cuenta participantes de privadas sin exponer su contenido:
-- ganador y portada solo salen si hay acceso.
create function public.hub_rounds() returns table (
  id uuid,
  name text,
  status public.round_status,
  visibility public.round_visibility,
  owner_id uuid,
  owner_name text,
  owner_avatar text,
  created_at timestamptz,
  opened_at timestamptz,
  finalized_at timestamptz,
  last_activity_at timestamptz,
  cleaned_at timestamptz,
  participant_count int,
  my_access text,
  my_involvement boolean,
  pending_requests int,
  winner_title text,
  winner_author text,
  cover_path text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  v_admin := public.is_admin();

  return query
  with base as (
    select
      r.*,
      r.owner_id = v_uid as is_owner,
      exists (
        select 1 from public.round_members m where m.round_id = r.id and m.user_id = v_uid
      ) as is_member,
      exists (
        select 1 from public.access_requests q
         where q.round_id = r.id and q.user_id = v_uid and q.status = 'pending'
      ) as has_pending
    from public.rounds r
  ),
  acc as (
    select b.*, (b.visibility = 'public' or b.is_owner or b.is_member or v_admin) as can_view
    from base b
  )
  select
    a.id, a.name, a.status, a.visibility,
    a.owner_id, p.full_name, p.avatar_url,
    a.created_at, a.opened_at, a.finalized_at, a.last_activity_at, a.cleaned_at,
    case
      when a.cleaned_at is not null then coalesce((ar.snapshot ->> 'participant_count')::int, 0)
      else (select count(*)::int from public.submissions s where s.round_id = a.id)
    end,
    case
      when a.is_owner then 'owner'
      when a.is_member then 'member'
      when a.visibility = 'public' then 'public'
      when v_admin then 'admin'
      when a.has_pending then 'pending'
      else 'none'
    end,
    a.is_owner or a.is_member
      or exists (select 1 from public.submissions s where s.round_id = a.id and s.user_id = v_uid)
      or exists (select 1 from public.votes v where v.round_id = a.id and v.voter_id = v_uid),
    case
      when a.is_owner then (
        select count(*)::int from public.access_requests q
         where q.round_id = a.id and q.status = 'pending'
      )
      else 0
    end,
    case when a.can_view then coalesce(w.title, ar.snapshot -> 'winner' ->> 'title') end,
    case when a.can_view then coalesce(wp.full_name, ar.snapshot -> 'winner' ->> 'author_name') end,
    case when a.can_view and a.cleaned_at is null then coalesce(w.image_path, top.image_path) end
  from acc a
  join public.profiles p on p.id = a.owner_id
  left join public.submissions w on w.id = a.winner_submission_id
  left join public.profiles wp on wp.id = w.user_id
  left join public.round_archives ar on ar.round_id = a.id
  left join lateral (
    select b.image_path from public.board b
     where b.round_id = a.id
     order by b.vote_count desc, b.created_at
     limit 1
  ) top on true;
end $$;

-- Crea una competencia en 'pending' con el usuario como dueño. Devuelve su id.
-- Máximo 2 activas (pending, open o closed, sin limpiar) por dueño; el superadmin no tiene límite.
create function public.create_round(p_name text, p_visibility public.round_visibility) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_id uuid;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  v_name := public.clean_round_name(p_name);

  -- Dos pedidos simultáneos no pueden saltar el límite.
  perform pg_advisory_xact_lock(hashtextextended('create_round:' || v_uid::text, 0));

  if not public.is_admin() and (
    select count(*) from public.rounds
     where owner_id = v_uid and status <> 'finalized' and cleaned_at is null
  ) >= 2 then
    raise exception 'ROUND_LIMIT';
  end if;

  insert into public.rounds (name, owner_id, visibility)
  values (v_name, v_uid, coalesce(p_visibility, 'public'))
  returning id into v_id;
  insert into public.round_invites (round_id) values (v_id);

  return v_id;
end $$;

-- Renombra la competencia.
create function public.rename_round(p_round_id uuid, p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  perform public.round_for_owner(p_round_id);
  v_name := public.clean_round_name(p_name);

  update public.rounds set name = v_name, last_activity_at = now() where id = p_round_id;
end $$;

-- Cambia la visibilidad. Solo en 'pending', para que nadie que ya votó pierda el acceso.
create function public.set_round_visibility(p_round_id uuid, p_visibility public.round_visibility) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  v_round := public.round_for_owner(p_round_id);
  if v_round.status <> 'pending' then raise exception 'VISIBILITY_LOCKED'; end if;

  update public.rounds
     set visibility = coalesce(p_visibility, v_round.visibility), last_activity_at = now()
   where id = p_round_id;
end $$;

-- Abre, cierra o reabre la competencia y guarda la fecha.
-- Transiciones permitidas: pending → open, open → closed, closed → open.
create function public.set_round_status(p_round_id uuid, p_status public.round_status) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  v_round := public.round_for_owner(p_round_id);

  if v_round.status = 'pending' and p_status = 'open' then
    update public.rounds set status = 'open', opened_at = now(), last_activity_at = now() where id = p_round_id;
  elsif v_round.status = 'open' and p_status = 'closed' then
    update public.rounds set status = 'closed', closed_at = now(), last_activity_at = now() where id = p_round_id;
  elsif v_round.status = 'closed' and p_status = 'open' then
    update public.rounds set status = 'open', opened_at = now(), closed_at = null, last_activity_at = now()
     where id = p_round_id;
  else
    raise exception 'INVALID_TRANSITION';
  end if;
end $$;

-- Fija el ganador (cualquier publicación de esta competencia, aunque haya empate) y finaliza.
create function public.finalize_round(p_round_id uuid, p_winner_submission_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  v_round := public.round_for_owner(p_round_id);
  if v_round.status <> 'closed' then raise exception 'INVALID_TRANSITION'; end if;

  if not exists (
    select 1 from public.submissions
     where id = p_winner_submission_id and round_id = p_round_id
  ) then
    raise exception 'INVALID_WINNER';
  end if;

  update public.rounds
     set status = 'finalized', winner_submission_id = p_winner_submission_id,
         finalized_at = now(), last_activity_at = now()
   where id = p_round_id;
end $$;

-- Borra cualquier publicación, en cualquier estado. Lo hace el dueño de la competencia o el superadmin.
-- Los votos caen en cascada. Si era la ganadora, la competencia vuelve a 'closed'
-- para elegir otro ganador. Devuelve la ruta de la imagen para borrarla de Storage.
create function public.delete_submission(p_submission_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_round_id uuid;
  v_round public.rounds;
  v_path text;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  select round_id into v_round_id from public.submissions where id = p_submission_id;
  if v_round_id is null then raise exception 'NO_SUBMISSION'; end if;

  select * into v_round from public.rounds where id = v_round_id for update;
  if v_round.owner_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'NOT_OWNER';
  end if;

  delete from public.submissions where id = p_submission_id returning image_path into v_path;
  if v_path is null then raise exception 'NO_SUBMISSION'; end if;

  if v_round.status = 'finalized' and v_round.winner_submission_id = p_submission_id then
    update public.rounds
       set status = 'closed', winner_submission_id = null, finalized_at = null, last_activity_at = now()
     where id = v_round.id;
  end if;

  return v_path;
end $$;

-- Borra una competencia con todo su contenido. Lo hace el dueño o el superadmin, en cualquier estado.
-- Anota quién la borró para que pueda limpiar los archivos de Storage, y devuelve su id.
create function public.delete_round(p_round_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null then raise exception 'ROUND_NOT_FOUND'; end if;
  if v_round.owner_id is distinct from auth.uid() and not public.is_admin() then
    raise exception 'NOT_OWNER';
  end if;

  delete from public.rounds where id = p_round_id;
  insert into public.round_deletions (round_id, deleted_by) values (p_round_id, auth.uid())
  on conflict (round_id) do nothing;

  return p_round_id;
end $$;

-- Números de la competencia para su panel: personas que participaron, publicaciones y votos.
create function public.round_stats(p_round_id uuid) returns table (
  participants int, submissions int, votes int
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  if not exists (select 1 from public.rounds where id = p_round_id) then
    raise exception 'ROUND_NOT_FOUND';
  end if;
  if not public.is_round_owner(p_round_id) and not public.is_admin() then
    raise exception 'NOT_OWNER';
  end if;

  return query
  select
    (select count(*)::int from (
       select user_id from public.submissions where round_id = p_round_id
       union
       select voter_id from public.votes where round_id = p_round_id
     ) u),
    (select count(*)::int from public.submissions where round_id = p_round_id),
    (select count(*)::int from public.votes where round_id = p_round_id);
end $$;

-- ===== Miembros =====

-- Devuelve el token del enlace de invitación. Solo para privadas.
create function public.get_invite_link(p_round_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
  v_token uuid;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  v_round := public.round_for_owner(p_round_id);
  if v_round.visibility <> 'private' then raise exception 'NOT_PRIVATE'; end if;

  select token into v_token from public.round_invites where round_id = p_round_id;
  return v_token;
end $$;

-- Cambia el token: el enlace anterior deja de funcionar. Devuelve el nuevo.
create function public.regenerate_invite_link(p_round_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
  v_token uuid;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  v_round := public.round_for_owner(p_round_id);
  if v_round.visibility <> 'private' then raise exception 'NOT_PRIVATE'; end if;

  insert into public.round_invites (round_id) values (p_round_id)
  on conflict (round_id) do update set token = gen_random_uuid(), created_at = now()
  returning token into v_token;
  return v_token;
end $$;

-- Entra a una competencia con el enlace de invitación, sin aprobación. Devuelve el id de la competencia.
-- Si ya tenía acceso, solo devuelve el id. Si tenía una solicitud pendiente, queda aprobada.
create function public.join_with_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_token uuid;
  v_round public.rounds;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  begin
    v_token := p_token::uuid;
  exception when invalid_text_representation then
    raise exception 'INVALID_INVITE';
  end;

  select r.* into v_round
    from public.round_invites i
    join public.rounds r on r.id = i.round_id
   where i.token = v_token
   for share of r;
  if v_round.id is null then raise exception 'INVALID_INVITE'; end if;

  if v_round.visibility = 'private' and v_round.owner_id <> v_uid and v_round.cleaned_at is null then
    insert into public.round_members (round_id, user_id, source)
    values (v_round.id, v_uid, 'invite_link')
    on conflict (round_id, user_id) do nothing;

    update public.access_requests
       set status = 'approved', resolved_at = now()
     where round_id = v_round.id and user_id = v_uid and status = 'pending';
  end if;

  return v_round.id;
end $$;

-- El dueño agrega a una persona que ya inició sesión alguna vez. Si tenía una solicitud pendiente, queda aprobada.
create function public.add_member(p_round_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  v_round := public.round_for_owner(p_round_id);
  if v_round.visibility <> 'private' then raise exception 'NOT_PRIVATE'; end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;
  if p_user_id = v_round.owner_id
     or exists (select 1 from public.round_members where round_id = p_round_id and user_id = p_user_id) then
    raise exception 'ALREADY_HAS_ACCESS';
  end if;

  insert into public.round_members (round_id, user_id, source) values (p_round_id, p_user_id, 'added');
  update public.access_requests
     set status = 'approved', resolved_at = now()
   where round_id = p_round_id and user_id = p_user_id and status = 'pending';
end $$;

-- El dueño quita a un miembro: se borran su publicación y sus votos.
-- Devuelve la ruta de su imagen, si tenía, para borrarla de Storage.
create function public.remove_member(p_round_id uuid, p_user_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  v_round := public.round_for_owner(p_round_id);

  if not exists (select 1 from public.round_members where round_id = p_round_id and user_id = p_user_id) then
    raise exception 'NOT_MEMBER';
  end if;

  return public.purge_participant(v_round, p_user_id);
end $$;

-- Un miembro sale de la competencia: se borran su publicación y sus votos.
-- Devuelve la ruta de su imagen, si tenía, para borrarla de Storage.
create function public.leave_round(p_round_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null then raise exception 'ROUND_NOT_FOUND'; end if;
  if not exists (select 1 from public.round_members where round_id = p_round_id and user_id = auth.uid()) then
    raise exception 'NOT_MEMBER';
  end if;

  return public.purge_participant(v_round, auth.uid());
end $$;

-- Pide acceso a una competencia privada. Devuelve el id de la solicitud.
create function public.request_access(p_round_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
  v_id uuid;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  select * into v_round from public.rounds where id = p_round_id for share;
  if v_round.id is null then raise exception 'ROUND_NOT_FOUND'; end if;
  if v_round.cleaned_at is not null then raise exception 'ROUND_CLEANED'; end if;
  if v_round.visibility <> 'private' then raise exception 'NOT_PRIVATE'; end if;
  if public.can_view_round(p_round_id) then raise exception 'ALREADY_HAS_ACCESS'; end if;

  begin
    insert into public.access_requests (round_id, user_id) values (p_round_id, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'REQUEST_PENDING';
  end;

  return v_id;
end $$;

-- El dueño aprueba o rechaza una solicitud pendiente. Si la aprueba, la persona queda como miembro.
create function public.resolve_access_request(p_request_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_request public.access_requests;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  select * into v_request from public.access_requests where id = p_request_id for update;
  if v_request.id is null or v_request.status <> 'pending' then raise exception 'NO_REQUEST'; end if;
  perform public.round_for_owner(v_request.round_id);

  update public.access_requests
     set status = case when p_approve then 'approved'::public.request_status else 'rejected'::public.request_status end,
         resolved_at = now()
   where id = p_request_id;

  if p_approve then
    insert into public.round_members (round_id, user_id, source)
    values (v_request.round_id, v_request.user_id, 'request')
    on conflict (round_id, user_id) do nothing;
  end if;
end $$;

-- ===== Permisos =====
-- Los auxiliares no se exponen.
revoke execute on function public.round_for_participant(uuid) from public, anon, authenticated;
revoke execute on function public.round_for_owner(uuid) from public, anon, authenticated;
revoke execute on function public.purge_participant(public.rounds, uuid) from public, anon, authenticated;

revoke execute on function public.create_submission(uuid, text, text, int, int) from public, anon;
revoke execute on function public.update_submission_title(uuid, text) from public, anon;
revoke execute on function public.replace_submission_image(uuid, text, int, int) from public, anon;
revoke execute on function public.delete_my_submission(uuid) from public, anon;
revoke execute on function public.cast_vote(uuid) from public, anon;
revoke execute on function public.remove_vote(uuid) from public, anon;
revoke execute on function public.hub_rounds() from public, anon;
revoke execute on function public.create_round(text, public.round_visibility) from public, anon;
revoke execute on function public.rename_round(uuid, text) from public, anon;
revoke execute on function public.set_round_visibility(uuid, public.round_visibility) from public, anon;
revoke execute on function public.set_round_status(uuid, public.round_status) from public, anon;
revoke execute on function public.finalize_round(uuid, uuid) from public, anon;
revoke execute on function public.delete_submission(uuid) from public, anon;
revoke execute on function public.delete_round(uuid) from public, anon;
revoke execute on function public.round_stats(uuid) from public, anon;
revoke execute on function public.get_invite_link(uuid) from public, anon;
revoke execute on function public.regenerate_invite_link(uuid) from public, anon;
revoke execute on function public.join_with_invite(text) from public, anon;
revoke execute on function public.add_member(uuid, uuid) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.leave_round(uuid) from public, anon;
revoke execute on function public.request_access(uuid) from public, anon;
revoke execute on function public.resolve_access_request(uuid, boolean) from public, anon;

grant execute on function public.create_submission(uuid, text, text, int, int) to authenticated;
grant execute on function public.update_submission_title(uuid, text) to authenticated;
grant execute on function public.replace_submission_image(uuid, text, int, int) to authenticated;
grant execute on function public.delete_my_submission(uuid) to authenticated;
grant execute on function public.cast_vote(uuid) to authenticated;
grant execute on function public.remove_vote(uuid) to authenticated;
grant execute on function public.hub_rounds() to authenticated;
grant execute on function public.create_round(text, public.round_visibility) to authenticated;
grant execute on function public.rename_round(uuid, text) to authenticated;
grant execute on function public.set_round_visibility(uuid, public.round_visibility) to authenticated;
grant execute on function public.set_round_status(uuid, public.round_status) to authenticated;
grant execute on function public.finalize_round(uuid, uuid) to authenticated;
grant execute on function public.delete_submission(uuid) to authenticated;
grant execute on function public.delete_round(uuid) to authenticated;
grant execute on function public.round_stats(uuid) to authenticated;
grant execute on function public.get_invite_link(uuid) to authenticated;
grant execute on function public.regenerate_invite_link(uuid) to authenticated;
grant execute on function public.join_with_invite(text) to authenticated;
grant execute on function public.add_member(uuid, uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.leave_round(uuid) to authenticated;
grant execute on function public.request_access(uuid) to authenticated;
grant execute on function public.resolve_access_request(uuid, boolean) to authenticated;
