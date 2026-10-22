-- 0005_rpc_admin: RPC de administración. Además de is_allowed_user() verifican is_admin(),
-- y toman un bloqueo exclusivo sobre la competencia actual (for update).

-- Auxiliar: exige un usuario del dominio que además sea administrador.
create function public.assert_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
end $$;

-- Auxiliar: valida y normaliza el nombre de una competencia (1 a 80 caracteres).
create function public.clean_round_name(p_name text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) not between 1 and 80 then
    raise exception 'INVALID_NAME';
  end if;
  return v_name;
end $$;

-- Abre, cierra o reabre la competencia actual y guarda la fecha.
-- Transiciones permitidas: pending → open, open → closed, closed → open.
create function public.admin_set_round_status(p_status public.round_status) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  perform public.assert_admin();

  select * into v_round from public.rounds where status <> 'archived' for update;

  if v_round.status = 'pending' and p_status = 'open' then
    update public.rounds set status = 'open', opened_at = now() where id = v_round.id;
  elsif v_round.status = 'open' and p_status = 'closed' then
    update public.rounds set status = 'closed', closed_at = now() where id = v_round.id;
  elsif v_round.status = 'closed' and p_status = 'open' then
    update public.rounds set status = 'open', opened_at = now(), closed_at = null where id = v_round.id;
  else
    raise exception 'INVALID_TRANSITION';
  end if;
end $$;

-- Renombra la competencia actual.
create function public.admin_rename_round(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  perform public.assert_admin();
  v_name := public.clean_round_name(p_name);

  update public.rounds set name = v_name where status <> 'archived';
end $$;

-- Fija el ganador (cualquier publicación de esta competencia, aunque haya empate) y finaliza.
create function public.admin_finalize_round(p_winner_submission_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  perform public.assert_admin();

  select * into v_round from public.rounds where status <> 'archived' for update;
  if v_round.status is distinct from 'closed' then raise exception 'INVALID_TRANSITION'; end if;

  if not exists (
    select 1 from public.submissions
     where id = p_winner_submission_id and round_id = v_round.id
  ) then
    raise exception 'INVALID_WINNER';
  end if;

  update public.rounds
     set status = 'finalized', winner_submission_id = p_winner_submission_id, finalized_at = now()
   where id = v_round.id;
end $$;

-- Borra cualquier publicación de la competencia actual, en cualquier estado.
-- Los votos caen en cascada. Si era la ganadora, la competencia vuelve a 'closed'
-- para elegir otro ganador. Devuelve la ruta de la imagen para borrarla de Storage.
create function public.admin_delete_submission(p_submission_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
  v_path text;
begin
  perform public.assert_admin();

  select * into v_round from public.rounds where status <> 'archived' for update;

  delete from public.submissions
   where id = p_submission_id and round_id = v_round.id
  returning image_path into v_path;
  if v_path is null then raise exception 'NO_SUBMISSION'; end if;

  if v_round.status = 'finalized' and v_round.winner_submission_id = p_submission_id then
    update public.rounds
       set status = 'closed', winner_submission_id = null, finalized_at = null
     where id = v_round.id;
  end if;

  return v_path;
end $$;

-- Reinicio total: borra la competencia actual (publicaciones y votos en cascada) sin dejar
-- historial y crea una nueva en 'pending'. Devuelve el id borrado para limpiar Storage.
create function public.admin_hard_reset(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
  v_deleted uuid;
begin
  perform public.assert_admin();
  v_name := public.clean_round_name(p_name);

  delete from public.rounds where status <> 'archived' returning id into v_deleted;
  insert into public.rounds (name) values (v_name);

  return v_deleted;
end $$;

-- Archiva la competencia finalizada y crea una nueva en 'pending'. Devuelve el id de la nueva.
create function public.admin_start_new_round(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
  v_name text;
  v_new uuid;
begin
  perform public.assert_admin();
  v_name := public.clean_round_name(p_name);

  select * into v_round from public.rounds where status <> 'archived' for update;
  if v_round.status is distinct from 'finalized' then raise exception 'INVALID_TRANSITION'; end if;

  update public.rounds set status = 'archived', archived_at = now() where id = v_round.id;
  insert into public.rounds (name) values (v_name) returning id into v_new;

  return v_new;
end $$;

-- Borra una competencia del historial con sus publicaciones y votos. Devuelve su id para limpiar Storage.
create function public.admin_delete_archived_round(p_round_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_deleted uuid;
begin
  perform public.assert_admin();

  delete from public.rounds
   where id = p_round_id and status = 'archived'
  returning id into v_deleted;
  if v_deleted is null then raise exception 'ROUND_NOT_ARCHIVED'; end if;

  return v_deleted;
end $$;

-- Permisos
revoke execute on function public.assert_admin() from public, anon, authenticated;
revoke execute on function public.clean_round_name(text) from public, anon, authenticated;
revoke execute on function public.admin_set_round_status(public.round_status) from public, anon;
revoke execute on function public.admin_rename_round(text) from public, anon;
revoke execute on function public.admin_finalize_round(uuid) from public, anon;
revoke execute on function public.admin_delete_submission(uuid) from public, anon;
revoke execute on function public.admin_hard_reset(text) from public, anon;
revoke execute on function public.admin_start_new_round(text) from public, anon;
revoke execute on function public.admin_delete_archived_round(uuid) from public, anon;

grant execute on function public.admin_set_round_status(public.round_status) to authenticated;
grant execute on function public.admin_rename_round(text) to authenticated;
grant execute on function public.admin_finalize_round(uuid) to authenticated;
grant execute on function public.admin_delete_submission(uuid) to authenticated;
grant execute on function public.admin_hard_reset(text) to authenticated;
grant execute on function public.admin_start_new_round(text) to authenticated;
grant execute on function public.admin_delete_archived_round(uuid) to authenticated;
