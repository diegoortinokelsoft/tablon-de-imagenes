-- 0014_import_members: el dueño suma de una vez a los miembros de otra competencia privada suya.
-- Los que ya son miembros no se repiten ni se modifican; las solicitudes pendientes de los sumados
-- quedan aprobadas. Devuelve cuántas personas se sumaron. Todo o nada (una sola transacción).
-- El origen se lee sin bloqueo: no se modifica, y bloquearlo podría trabar dos importaciones
-- cruzadas simultáneas (A→B y B→A).
create function public.import_members(p_round_id uuid, p_source_round_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
  v_source public.rounds;
  v_count int;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;

  -- Destino: existe, es mío, no está limpiado (con for update) y es privado.
  v_round := public.round_for_owner(p_round_id);
  if v_round.visibility <> 'private' then raise exception 'NOT_PRIVATE'; end if;

  -- Origen: mismas reglas, sin bloqueo.
  select * into v_source from public.rounds where id = p_source_round_id;
  if v_source.id is null then raise exception 'ROUND_NOT_FOUND'; end if;
  if v_source.owner_id is distinct from auth.uid() then raise exception 'NOT_OWNER'; end if;
  if v_source.cleaned_at is not null then raise exception 'ROUND_CLEANED'; end if;
  if v_source.visibility <> 'private' then raise exception 'NOT_PRIVATE'; end if;

  -- Origen = destino no es un error: el insert no encuentra a nadie nuevo y devuelve 0.
  with inserted as (
    insert into public.round_members (round_id, user_id, source)
    select p_round_id, m.user_id, 'added'
      from public.round_members m
     where m.round_id = p_source_round_id
       and m.user_id <> v_round.owner_id
    on conflict (round_id, user_id) do nothing
    returning user_id
  ), approved as (
    update public.access_requests
       set status = 'approved', resolved_at = now()
     where round_id = p_round_id
       and status = 'pending'
       and user_id in (select user_id from inserted)
    returning 1
  )
  select count(*) into v_count from inserted;

  return v_count;
end $$;

revoke execute on function public.import_members(uuid, uuid) from public, anon;
grant execute on function public.import_members(uuid, uuid) to authenticated;
