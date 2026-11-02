-- 0011_v2_admin: RPC del superadmin para archivar y limpiar competencias inactivas.
--
-- Flujo: admin_rounds_to_archive lista las de más de 60 días sin actividad; el navegador del superadmin
-- arma el ZIP y lo sube a Drive; admin_mark_exported lo registra; admin_clean_round guarda la foto del
-- resultado (la lápida) y borra publicaciones, votos, miembros y solicitudes. Los archivos los borra el cliente.

-- Competencias sin limpiar con más de 60 días sin actividad, en cualquier estado.
create function public.admin_rounds_to_archive() returns table (
  id uuid,
  name text,
  status public.round_status,
  visibility public.round_visibility,
  owner_name text,
  last_activity_at timestamptz,
  submission_count int,
  exported_at timestamptz,
  drive_url text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.assert_admin();

  return query
  select
    r.id, r.name, r.status, r.visibility, p.full_name, r.last_activity_at,
    (select count(*)::int from public.submissions s where s.round_id = r.id),
    a.exported_at, a.drive_url
  from public.rounds r
  join public.profiles p on p.id = r.owner_id
  left join public.round_archives a on a.round_id = r.id
  where r.cleaned_at is null
    and r.last_activity_at < now() - interval '60 days'
  order by r.last_activity_at;
end $$;

-- Registra la exportación de una competencia. p_drive_url es null si el ZIP se guardó a mano.
create function public.admin_mark_exported(p_round_id uuid, p_drive_url text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
begin
  perform public.assert_admin();

  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null then raise exception 'ROUND_NOT_FOUND'; end if;
  if v_round.cleaned_at is not null then raise exception 'ROUND_CLEANED'; end if;

  insert into public.round_archives (round_id, drive_url, exported_at)
  values (p_round_id, nullif(btrim(p_drive_url), ''), now())
  on conflict (round_id) do update
    set drive_url = excluded.drive_url, exported_at = excluded.exported_at;
end $$;

-- Limpia una competencia exportada y con más de 60 días sin actividad: guarda la foto del resultado
-- y borra publicaciones, votos, miembros y solicitudes. Devuelve el id para limpiar Storage.
create function public.admin_clean_round(p_round_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_round public.rounds;
  v_snapshot jsonb;
begin
  perform public.assert_admin();

  select * into v_round from public.rounds where id = p_round_id for update;
  if v_round.id is null then raise exception 'ROUND_NOT_FOUND'; end if;
  if v_round.cleaned_at is not null then raise exception 'ROUND_CLEANED'; end if;
  if v_round.last_activity_at >= now() - interval '60 days' then raise exception 'NOT_INACTIVE'; end if;
  if not exists (select 1 from public.round_archives where round_id = p_round_id) then
    raise exception 'NOT_EXPORTED';
  end if;

  -- Foto del resultado: totales, ganador y ranking completo en texto (sin imágenes).
  select jsonb_build_object(
    'participant_count', (select count(*) from public.submissions s where s.round_id = p_round_id),
    'vote_count', (select count(*) from public.votes v where v.round_id = p_round_id),
    'winner', (
      select jsonb_build_object('title', b.title, 'author_name', b.author_name, 'vote_count', b.vote_count)
        from public.board b where b.id = v_round.winner_submission_id
    ),
    'ranking', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'position', b.position, 'title', b.title, 'author_name', b.author_name,
                 'vote_count', b.vote_count, 'is_winner', b.id = v_round.winner_submission_id
               )
               order by b.position, b.created_at
             )
        from public.board b where b.round_id = p_round_id
    ), '[]'::jsonb)
  ) into v_snapshot;

  -- cleaned_at primero: así el trigger de actividad no cuenta la limpieza como actividad.
  update public.rounds set cleaned_at = now() where id = p_round_id;
  update public.round_archives set snapshot = v_snapshot where round_id = p_round_id;

  delete from public.votes where round_id = p_round_id;
  delete from public.submissions where round_id = p_round_id;
  delete from public.round_members where round_id = p_round_id;
  delete from public.access_requests where round_id = p_round_id;

  return p_round_id;
end $$;

-- Competencias limpiadas (lápidas) con su enlace a Drive.
create function public.admin_archives() returns table (
  id uuid,
  name text,
  visibility public.round_visibility,
  owner_name text,
  cleaned_at timestamptz,
  exported_at timestamptz,
  drive_url text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.assert_admin();

  return query
  select r.id, r.name, r.visibility, p.full_name, r.cleaned_at, a.exported_at, a.drive_url
  from public.rounds r
  join public.profiles p on p.id = r.owner_id
  left join public.round_archives a on a.round_id = r.id
  where r.cleaned_at is not null
  order by r.cleaned_at desc;
end $$;

-- Permisos
revoke execute on function public.admin_rounds_to_archive() from public, anon;
revoke execute on function public.admin_mark_exported(uuid, text) from public, anon;
revoke execute on function public.admin_clean_round(uuid) from public, anon;
revoke execute on function public.admin_archives() from public, anon;

grant execute on function public.admin_rounds_to_archive() to authenticated;
grant execute on function public.admin_mark_exported(uuid, text) to authenticated;
grant execute on function public.admin_clean_round(uuid) to authenticated;
grant execute on function public.admin_archives() to authenticated;
