-- 0004_rpc_user: RPC de usuario. Todas son security definer, con search_path vacío,
-- verifican is_allowed_user() y lanzan un código fijo ante un error.
--
-- Las RPC que dependen del estado toman un bloqueo compartido sobre la competencia actual
-- (for share), así un cambio de estado del admin espera a que terminen y viceversa.

-- Auxiliar: valida y normaliza un título (1 a 80 caracteres).
create function public.clean_title(p_title text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
begin
  if char_length(v_title) not between 1 and 80 then
    raise exception 'INVALID_TITLE';
  end if;
  return v_title;
end $$;

-- Auxiliar: la ruta debe ser {round_id}/{uid}/{uuid}.webp y el archivo ya tiene que estar subido.
create function public.check_image_path(p_round_id uuid, p_uid uuid, p_image_path text) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_image_path is null
     or p_image_path !~ ('^' || p_round_id::text || '/' || p_uid::text || '/[0-9a-f-]{36}\.webp$')
     or not exists (
       select 1 from storage.objects o
       where o.bucket_id = 'submissions' and o.name = p_image_path
     )
  then
    raise exception 'INVALID_PATH';
  end if;
end $$;

-- Crea o actualiza el perfil del usuario desde auth.users (nombre y avatar de Google).
create function public.sync_my_profile() returns public.profiles
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  insert into public.profiles (id, email, full_name, avatar_url)
  select
    u.id,
    lower(u.email),
    coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
    coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
  from auth.users u
  where u.id = auth.uid()
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        updated_at = now()
  returning * into v_profile;

  if v_profile.id is null then raise exception 'NOT_ALLOWED'; end if;
  return v_profile;
end $$;

-- Crea la publicación del usuario en la competencia abierta. Devuelve su id.
create function public.create_submission(
  p_title text, p_image_path text, p_width int, p_height int
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_round public.rounds;
  v_title text;
  v_id uuid;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  select * into v_round from public.rounds where status <> 'archived' for share;
  if v_round.status is distinct from 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

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
create function public.update_submission_title(p_title text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_round public.rounds;
  v_title text;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  select * into v_round from public.rounds where status <> 'archived' for share;
  if v_round.status is distinct from 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

  v_title := public.clean_title(p_title);

  update public.submissions
     set title = v_title, updated_at = now()
   where round_id = v_round.id and user_id = v_uid;
  if not found then raise exception 'NO_SUBMISSION'; end if;
end $$;

-- Reemplaza la imagen de la propia publicación: borra los votos recibidos
-- (vuelven a sus votantes) y devuelve la ruta anterior para borrarla de Storage.
create function public.replace_submission_image(
  p_image_path text, p_width int, p_height int
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_round public.rounds;
  v_submission public.submissions;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  select * into v_round from public.rounds where status <> 'archived' for share;
  if v_round.status is distinct from 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

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
create function public.delete_my_submission() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_round public.rounds;
  v_path text;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  select * into v_round from public.rounds where status <> 'archived' for share;
  if v_round.status is distinct from 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

  delete from public.submissions
   where round_id = v_round.id and user_id = v_uid
  returning image_path into v_path;
  if v_path is null then raise exception 'NO_SUBMISSION'; end if;

  return v_path;
end $$;

-- Agrega un voto. El bloqueo por usuario evita superar los 3 votos con clics simultáneos.
create function public.cast_vote(p_submission_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_round public.rounds;
  v_owner uuid;
  v_used int;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_round from public.rounds where status <> 'archived' for share;
  if v_round.status is distinct from 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

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

-- Quita uno de los votos del usuario en esa publicación.
create function public.remove_vote(p_submission_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_round public.rounds;
  v_vote_id uuid;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));

  select * into v_round from public.rounds where status <> 'archived' for share;
  if v_round.status is distinct from 'open' then raise exception 'ROUND_NOT_OPEN'; end if;

  select id into v_vote_id from public.votes
   where round_id = v_round.id and voter_id = v_uid and submission_id = p_submission_id
   order by created_at desc
   limit 1;
  if v_vote_id is null then raise exception 'NO_VOTE_TO_REMOVE'; end if;

  delete from public.votes where id = v_vote_id;
end $$;

-- Permisos: solo usuarios autenticados ejecutan las RPC; los auxiliares no se exponen.
revoke execute on function public.clean_title(text) from public, anon, authenticated;
revoke execute on function public.check_image_path(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.sync_my_profile() from public, anon;
revoke execute on function public.create_submission(text, text, int, int) from public, anon;
revoke execute on function public.update_submission_title(text) from public, anon;
revoke execute on function public.replace_submission_image(text, int, int) from public, anon;
revoke execute on function public.delete_my_submission() from public, anon;
revoke execute on function public.cast_vote(uuid) from public, anon;
revoke execute on function public.remove_vote(uuid) from public, anon;

grant execute on function public.sync_my_profile() to authenticated;
grant execute on function public.create_submission(text, text, int, int) to authenticated;
grant execute on function public.update_submission_title(text) to authenticated;
grant execute on function public.replace_submission_image(text, int, int) to authenticated;
grant execute on function public.delete_my_submission() to authenticated;
grant execute on function public.cast_vote(uuid) to authenticated;
grant execute on function public.remove_vote(uuid) to authenticated;
