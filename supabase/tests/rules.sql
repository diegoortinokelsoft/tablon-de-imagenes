-- Pruebas de las reglas (RLS, RPC y Storage) de la v2: competencias múltiples, privadas y archivo.
--
-- Todo corre dentro de una transacción que termina en ROLLBACK: no deja datos en la base.
-- Simula usuarios con `set local role` y `request.jwt.claims`:
--   - admin:   diego.martin.ortino@grupokelsoft.com (superadmin)
--   - ana:     dueña de las competencias de prueba
--   - beto, carla, dani: usuarios normales del dominio
--   - intruso: intruso@gmail.com (otro dominio)
--   - anon:    sin sesión
-- Ejecutar con: npx supabase db query --linked -f supabase/tests/rules.sql -o json
-- Resultado: una fila por caso con `ok = true` si se obtuvo lo esperado.

begin;

create temp table results (
  n serial,
  caso text,
  esperado text,
  obtenido text,
  ok boolean
);

-- Ejecuta p_sql como un usuario autenticado con ese email y devuelve 'OK[:valor]' o el mensaje de error.
create function pg_temp.run_as(p_email text, p_uid uuid, p_sql text) returns text
language plpgsql as $$
declare
  v_out text;
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid, 'email', p_email, 'role', 'authenticated', 'aud', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
  begin
    execute p_sql into v_out;
    v_out := rtrim('OK:' || coalesce(v_out, ''), ':');
  exception when others then
    v_out := sqlerrm;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return v_out;
end $$;

-- Igual, pero sin sesión (rol anon).
create function pg_temp.run_as_anon(p_sql text) returns text
language plpgsql as $$
declare
  v_out text;
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  execute 'set local role anon';
  begin
    execute p_sql into v_out;
    v_out := rtrim('OK:' || coalesce(v_out, ''), ':');
  exception when others then
    v_out := sqlerrm;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return v_out;
end $$;

-- Ejecuta p_sql como postgres (sin RLS) capturando el error.
create function pg_temp.run_sql(p_sql text) returns text
language plpgsql as $$
declare
  v_out text;
begin
  begin
    execute p_sql into v_out;
    v_out := rtrim('OK:' || coalesce(v_out, ''), ':');
  exception when others then
    v_out := sqlerrm;
  end;
  return v_out;
end $$;

-- Sube un archivo a Storage como ese usuario (inserta la fila en storage.objects).
create function pg_temp.upload(p_email text, p_uid uuid, p_path text) returns text
language sql as $$
  select pg_temp.run_as(p_email, p_uid, format(
    'insert into storage.objects (bucket_id, name) values (''submissions'', %L) returning 1', p_path))
$$;

-- Borra un archivo de Storage como ese usuario; devuelve 'OK:1' si lo borró y 'OK:0' si la política lo impidió.
create function pg_temp.remove(p_email text, p_uid uuid, p_path text) returns text
language sql as $$
  select pg_temp.run_as(p_email, p_uid, format(
    'with d as (delete from storage.objects where bucket_id = ''submissions'' and name = %L returning 1) select count(*) from d',
    p_path))
$$;

-- Registra un caso. Coincide si es igual o si `obtenido` empieza con `esperado`.
create function pg_temp.expect(p_caso text, p_esperado text, p_obtenido text) returns void
language sql as $$
  insert into pg_temp.results (caso, esperado, obtenido, ok)
  values (p_caso, p_esperado, p_obtenido,
          coalesce(p_obtenido = p_esperado or p_obtenido like p_esperado || '%', false))
$$;

do $$
declare
  c_admin_email constant text := 'diego.martin.ortino@grupokelsoft.com';
  -- Si el admin real ya inició sesión, se usa su usuario (el email es único en auth.users).
  c_admin uuid := coalesce(
    (select id from auth.users where lower(email) = 'diego.martin.ortino@grupokelsoft.com'),
    'aaaaaaaa-0000-4000-8000-000000000000'
  );
  c_ana constant uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  c_beto constant uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  c_carla constant uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  c_dani constant uuid := 'aaaaaaaa-0000-4000-8000-000000000004';
  c_intruso constant uuid := 'aaaaaaaa-0000-4000-8000-000000000099';
  e_ana constant text := 'ana.prueba@grupokelsoft.com';
  e_beto constant text := 'beto.prueba@grupokelsoft.com';
  e_carla constant text := 'carla.prueba@grupokelsoft.com';
  e_dani constant text := 'dani.prueba@grupokelsoft.com';
  e_intruso constant text := 'intruso@gmail.com';
  v_pub uuid;        -- competencia pública de ana
  v_priv uuid;       -- competencia privada de ana
  v_extra uuid;      -- tercera competencia de ana (después de finalizar una)
  v_token text;
  v_token2 text;
  v_req uuid;
  v_ana_path text;
  v_ana_path2 text;
  v_beto_path text;
  v_beto_path2 text;
  v_ana_priv_path text;
  v_beto_priv_path text;
  v_extra_ana_path text;
  v_extra_carla_path text;
  v_ana_sub uuid;
  v_beto_sub uuid;
  v_ana_priv_sub uuid;
  v_beto_priv_sub uuid;
  v_out text;
  v_imp_a uuid;      -- privada de beto (origen): carla y dani
  v_imp_b uuid;      -- privada de beto (destino): carla; dani y ana con solicitud pendiente
  v_imp_pub uuid;    -- pública de beto (como postgres, para saltar el límite de 2)
  v_imp_clean uuid;  -- privada limpiada de beto (como postgres)
  v_imp_carla text;  -- source y joined_at de carla en B antes de importar
  v_imp_dani_req uuid;
  v_imp_ana_req uuid;
begin
  -- ===== Preparación: usuarios ficticios (el trigger crea sus perfiles) =====
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  select c_admin, c_admin_email, 'authenticated', 'authenticated', '{"full_name":"Diego"}'::jsonb
  where not exists (select 1 from auth.users where id = c_admin);

  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values
    (c_ana, e_ana, 'authenticated', 'authenticated', '{"full_name":"Ana","avatar_url":"https://x/a.png"}'),
    (c_beto, e_beto, 'authenticated', 'authenticated', '{"name":"Beto"}'),
    (c_carla, 'Carla.Prueba@GrupoKelsoft.com', 'authenticated', 'authenticated', '{"full_name":"Carla"}'),
    (c_dani, e_dani, 'authenticated', 'authenticated', '{"full_name":"Dani"}');

  -- ===== Migración de la v1 =====
  perform pg_temp.expect('Migración: toda competencia tiene dueño', '0',
    (select count(*)::text from public.rounds where owner_id is null));
  perform pg_temp.expect('Migración: toda competencia tiene token de invitación', '0',
    (select count(*)::text from public.rounds r
      where not exists (select 1 from public.round_invites i where i.round_id = r.id)));
  perform pg_temp.expect('Migración: ya no existe el estado archived', 'invalid input value',
    pg_temp.run_sql('select count(*) from public.rounds where status = ''archived'''));

  -- ===== Dominio y acceso =====
  perform pg_temp.expect('Perfil creado por trigger (5 usuarios)', '5',
    (select count(*)::text from public.profiles where id in (c_admin, c_ana, c_beto, c_carla, c_dani)));
  perform pg_temp.expect('Perfil: nombre desde "name" si falta full_name', 'Beto',
    (select full_name from public.profiles where id = c_beto));
  perform pg_temp.expect('Perfil: email en minúsculas', e_carla,
    (select email from public.profiles where id = c_carla));

  perform pg_temp.expect('Dominio: trigger impide crear usuario @gmail.com', 'NOT_ALLOWED',
    pg_temp.run_sql(format(
      'insert into auth.users (id, email, aud, role) values (%L, %L, %L, %L)',
      c_intruso, e_intruso, 'authenticated', 'authenticated')));
  perform pg_temp.expect('Dominio: trigger impide dominio parecido (@grupokelsoft.com.ar)', 'NOT_ALLOWED',
    pg_temp.run_sql(format(
      'insert into auth.users (id, email, aud, role) values (%L, %L, %L, %L)',
      c_intruso, 'intruso@grupokelsoft.com.ar', 'authenticated', 'authenticated')));
  perform pg_temp.expect('Dominio: hook rechaza @gmail.com con 403', '403',
    public.hook_before_user_created('{"user":{"email":"intruso@gmail.com"}}') -> 'error' ->> 'http_code');
  perform pg_temp.expect('Dominio: hook acepta @grupokelsoft.com', '{}',
    public.hook_before_user_created('{"user":{"email":"nuevo@grupokelsoft.com"}}')::text);

  perform pg_temp.expect('Dominio: otro dominio no ve competencias (RLS)', 'OK:0',
    pg_temp.run_as(e_intruso, c_intruso, 'select count(*) from public.rounds'));
  perform pg_temp.expect('Dominio: otro dominio no ve perfiles (RLS)', 'OK:0',
    pg_temp.run_as(e_intruso, c_intruso, 'select count(*) from public.profiles'));
  perform pg_temp.expect('Dominio: otro dominio no puede sincronizar perfil', 'NOT_ALLOWED',
    pg_temp.run_as(e_intruso, c_intruso, 'select public.sync_my_profile()'));
  perform pg_temp.expect('Dominio: otro dominio no puede votar', 'NOT_ALLOWED',
    pg_temp.run_as(e_intruso, c_intruso, format('select public.cast_vote(%L)', gen_random_uuid())));
  perform pg_temp.expect('Dominio: otro dominio no puede publicar', 'NOT_ALLOWED',
    pg_temp.run_as(e_intruso, c_intruso, format(
      'select public.create_submission(%L, ''x'', ''x'', 1, 1)', gen_random_uuid())));
  perform pg_temp.expect('Dominio: otro dominio no puede crear competencias', 'NOT_ALLOWED',
    pg_temp.run_as(e_intruso, c_intruso, 'select public.create_round(''X'', ''public'')'));
  perform pg_temp.expect('Dominio: otro dominio no puede leer el hub', 'NOT_ALLOWED',
    pg_temp.run_as(e_intruso, c_intruso, 'select count(*) from public.hub_rounds()'));
  perform pg_temp.expect('Dominio: otro dominio en una RPC de superadmin', 'NOT_ALLOWED',
    pg_temp.run_as(e_intruso, c_intruso, format('select public.admin_clean_round(%L)', gen_random_uuid())));

  perform pg_temp.expect('Anon: no puede leer tablas', 'permission denied',
    pg_temp.run_as_anon('select count(*) from public.rounds'));
  perform pg_temp.expect('Anon: no puede leer miembros', 'permission denied',
    pg_temp.run_as_anon('select count(*) from public.round_members'));
  perform pg_temp.expect('Anon: no puede leer la vista board', 'permission denied',
    pg_temp.run_as_anon('select count(*) from public.board'));
  perform pg_temp.expect('Anon: no puede ejecutar RPC', 'permission denied',
    pg_temp.run_as_anon(format('select public.cast_vote(%L)', gen_random_uuid())));
  perform pg_temp.expect('Anon: no puede leer el hub', 'permission denied',
    pg_temp.run_as_anon('select count(*) from public.hub_rounds()'));

  perform pg_temp.expect('Usuario: no lee la tabla admins', 'permission denied',
    pg_temp.run_as(e_ana, c_ana, 'select count(*) from public.admins'));
  perform pg_temp.expect('Usuario: no lee round_deletions', 'permission denied',
    pg_temp.run_as(e_ana, c_ana, 'select count(*) from public.round_deletions'));
  perform pg_temp.expect('Usuario: no puede insertar votos directo', 'permission denied',
    pg_temp.run_as(e_ana, c_ana, format(
      'insert into public.votes (round_id, voter_id, submission_id) values (%L, %L, %L) returning 1',
      gen_random_uuid(), c_ana, gen_random_uuid())));
  perform pg_temp.expect('Usuario: no puede crear competencias directo', 'permission denied',
    pg_temp.run_as(e_ana, c_ana, format(
      'insert into public.rounds (name, owner_id) values (''X'', %L) returning 1', c_ana)));
  perform pg_temp.expect('Usuario: no puede hacerse miembro directo', 'permission denied',
    pg_temp.run_as(e_ana, c_ana, format(
      'insert into public.round_members (round_id, user_id, source) values (%L, %L, ''added'') returning 1',
      gen_random_uuid(), c_ana)));
  perform pg_temp.expect('Usuario: no puede llamar auxiliares internos', 'permission denied',
    pg_temp.run_as(e_ana, c_ana, format('select (public.round_for_participant(%L)).id', gen_random_uuid())));
  perform pg_temp.expect('Usuario: sync_my_profile funciona', 'OK',
    pg_temp.run_as(e_ana, c_ana, 'select (public.sync_my_profile()).full_name'));
  perform pg_temp.expect('Superadmin: is_admin() es falso para un usuario normal', 'OK:false',
    pg_temp.run_as(e_ana, c_ana, 'select public.is_admin()'));
  perform pg_temp.expect('Superadmin: is_admin() es verdadero para el admin', 'OK:true',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.is_admin()'));

  -- ===== Crear competencias y límite de 2 activas =====
  perform pg_temp.expect('Crear: nombre vacío', 'INVALID_NAME',
    pg_temp.run_as(e_ana, c_ana, 'select public.create_round(''   '', ''public'')'));
  v_pub := substr(pg_temp.run_as(e_ana, c_ana,
    'select public.create_round(''  Pública de prueba  '', ''public'')'), 4)::uuid;
  perform pg_temp.expect('Crear: el nombre se guarda sin espacios', 'Pública de prueba',
    (select name from public.rounds where id = v_pub));
  perform pg_temp.expect('Crear: nace preparada, pública y con ana como dueña', 'pending/public/' || c_ana,
    (select status || '/' || visibility || '/' || owner_id from public.rounds where id = v_pub));
  perform pg_temp.expect('Crear: nace con token de invitación', '1',
    (select count(*)::text from public.round_invites where round_id = v_pub));
  v_priv := substr(pg_temp.run_as(e_ana, c_ana,
    'select public.create_round(''Privada de prueba'', ''private'')'), 4)::uuid;
  perform pg_temp.expect('Crear: la segunda (privada)', 'private',
    (select visibility::text from public.rounds where id = v_priv));
  perform pg_temp.expect('Crear: la tercera activa', 'ROUND_LIMIT',
    pg_temp.run_as(e_ana, c_ana, 'select public.create_round(''Tercera'', ''public'')'));
  perform pg_temp.expect('Crear: el superadmin no tiene límite (1)', 'OK:',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.create_round(''Admin 1'', ''public'')'));
  perform pg_temp.expect('Crear: el superadmin no tiene límite (2)', 'OK:',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.create_round(''Admin 2'', ''public'')'));
  perform pg_temp.expect('Crear: el superadmin no tiene límite (3)', 'OK:',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.create_round(''Admin 3'', ''public'')'));

  -- ===== Solo el dueño gestiona =====
  perform pg_temp.expect('Dueño: otro no puede renombrar', 'NOT_OWNER',
    pg_temp.run_as(e_beto, c_beto, format('select public.rename_round(%L, ''Hackeada'')', v_pub)));
  perform pg_temp.expect('Dueño: otro no puede abrir', 'NOT_OWNER',
    pg_temp.run_as(e_beto, c_beto, format('select public.set_round_status(%L, ''open'')', v_pub)));
  perform pg_temp.expect('Dueño: otro no puede cambiar la visibilidad', 'NOT_OWNER',
    pg_temp.run_as(e_beto, c_beto, format('select public.set_round_visibility(%L, ''private'')', v_pub)));
  perform pg_temp.expect('Dueño: otro no puede finalizar', 'NOT_OWNER',
    pg_temp.run_as(e_beto, c_beto, format('select public.finalize_round(%L, %L)', v_pub, gen_random_uuid())));
  perform pg_temp.expect('Dueño: otro no puede borrar la competencia', 'NOT_OWNER',
    pg_temp.run_as(e_beto, c_beto, format('select public.delete_round(%L)', v_pub)));
  perform pg_temp.expect('Dueño: otro no puede ver los números', 'NOT_OWNER',
    pg_temp.run_as(e_beto, c_beto, format('select participants from public.round_stats(%L)', v_pub)));
  perform pg_temp.expect('Dueño: el superadmin tampoco cambia estados ajenos', 'NOT_OWNER',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.set_round_status(%L, ''open'')', v_pub)));
  perform pg_temp.expect('Dueño: competencia inexistente', 'ROUND_NOT_FOUND',
    pg_temp.run_as(e_ana, c_ana, format('select public.rename_round(%L, ''X'')', gen_random_uuid())));
  perform pg_temp.expect('Dueño: renombrar', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.rename_round(%L, ''Pública'')', v_pub)));

  -- ===== Visibilidad (solo en preparada) =====
  perform pg_temp.expect('Visibilidad: pasar a privada en preparada', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.set_round_visibility(%L, ''private'')', v_pub)));
  perform pg_temp.expect('Visibilidad: volver a pública en preparada', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.set_round_visibility(%L, ''public'')', v_pub)));

  -- ===== Competencia preparada =====
  v_ana_path := format('%s/%s/%s.webp', v_pub, c_ana, gen_random_uuid());
  perform pg_temp.expect('Preparada: no se puede subir a Storage', 'new row violates row-level security',
    pg_temp.upload(e_ana, c_ana, v_ana_path));
  perform pg_temp.expect('Preparada: no se puede publicar', 'ROUND_NOT_OPEN',
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.create_submission(%L, ''Hola'', %L, 100, 100)', v_pub, v_ana_path)));
  perform pg_temp.expect('Transición inválida: finalizar desde preparada', 'INVALID_TRANSITION',
    pg_temp.run_as(e_ana, c_ana, format('select public.finalize_round(%L, %L)', v_pub, gen_random_uuid())));
  perform pg_temp.expect('Transición inválida: cerrar desde preparada', 'INVALID_TRANSITION',
    pg_temp.run_as(e_ana, c_ana, format('select public.set_round_status(%L, ''closed'')', v_pub)));
  perform pg_temp.expect('Abrir la pública (pending → open)', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.set_round_status(%L, ''open'')', v_pub)));
  perform pg_temp.expect('Abrir la privada (pending → open)', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.set_round_status(%L, ''open'')', v_priv)));
  perform pg_temp.expect('Visibilidad: bloqueada con la competencia abierta', 'VISIBILITY_LOCKED',
    pg_temp.run_as(e_ana, c_ana, format('select public.set_round_visibility(%L, ''private'')', v_pub)));

  -- ===== Storage en la pública abierta =====
  perform pg_temp.expect('Storage: subir a la carpeta propia', 'OK',
    pg_temp.upload(e_ana, c_ana, v_ana_path));
  perform pg_temp.expect('Storage: subir a la carpeta de otro usuario', 'new row violates row-level security',
    pg_temp.upload(e_ana, c_ana, format('%s/%s/%s.webp', v_pub, c_beto, gen_random_uuid())));
  perform pg_temp.expect('Storage: subir a una competencia inexistente', 'new row violates row-level security',
    pg_temp.upload(e_ana, c_ana, format('%s/%s/%s.webp', gen_random_uuid(), c_ana, gen_random_uuid())));
  perform pg_temp.expect('Storage: subir con una carpeta que no es uuid', 'new row violates row-level security',
    pg_temp.upload(e_ana, c_ana, format('basura/%s/%s.webp', c_ana, gen_random_uuid())));
  perform pg_temp.expect('Storage: otro dominio no puede subir', 'new row violates row-level security',
    pg_temp.upload(e_intruso, c_intruso, format('%s/%s/%s.webp', v_pub, c_intruso, gen_random_uuid())));
  perform pg_temp.expect('Storage: otro dominio no ve archivos', 'OK:0',
    pg_temp.run_as(e_intruso, c_intruso, 'select count(*) from storage.objects where bucket_id = ''submissions'''));

  v_beto_path := format('%s/%s/%s.webp', v_pub, c_beto, gen_random_uuid());
  perform pg_temp.upload(e_beto, c_beto, v_beto_path);

  -- ===== Publicaciones =====
  perform pg_temp.expect('Publicar: título vacío', 'INVALID_TITLE',
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.create_submission(%L, ''   '', %L, 100, 100)', v_pub, v_ana_path)));
  perform pg_temp.expect('Publicar: título de 81 caracteres', 'INVALID_TITLE',
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.create_submission(%L, %L, %L, 100, 100)', v_pub, repeat('a', 81), v_ana_path)));
  perform pg_temp.expect('Publicar: ruta en la carpeta de otro usuario', 'INVALID_PATH',
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.create_submission(%L, ''Hola'', %L, 100, 100)', v_pub, v_beto_path)));
  perform pg_temp.expect('Publicar: archivo que no existe en Storage', 'INVALID_PATH',
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.create_submission(%L, ''Hola'', %L, 100, 100)',
      v_pub, format('%s/%s/%s.webp', v_pub, c_ana, gen_random_uuid()))));
  perform pg_temp.expect('Publicar: ruta de otra competencia', 'INVALID_PATH',
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.create_submission(%L, ''Hola'', %L, 100, 100)', v_priv, v_ana_path)));
  perform pg_temp.expect('Publicar: competencia inexistente', 'ROUND_NOT_FOUND',
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.create_submission(%L, ''Hola'', %L, 100, 100)', gen_random_uuid(), v_ana_path)));

  perform pg_temp.expect('Publicar: la dueña participa (título de 80)', 'OK:',
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.create_submission(%L, %L, %L, 1920, 1200)', v_pub, repeat('a', 80), v_ana_path)));
  v_ana_sub := (select id from public.submissions where user_id = c_ana and round_id = v_pub);
  perform pg_temp.expect('Publicar: segunda publicación', 'ALREADY_SUBMITTED',
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.create_submission(%L, ''Otra'', %L, 100, 100)', v_pub, v_ana_path)));

  perform pg_temp.run_as(e_beto, c_beto, format(
    'select public.create_submission(%L, ''Foto de Beto'', %L, 800, 500)', v_pub, v_beto_path));
  v_beto_sub := (select id from public.submissions where user_id = c_beto and round_id = v_pub);
  perform pg_temp.expect('Publicar: beto publica en la pública sin unirse', 'true', (v_beto_sub is not null)::text);

  -- ===== Votos =====
  perform pg_temp.expect('Votar: la propia publicación', 'OWN_SUBMISSION',
    pg_temp.run_as(e_ana, c_ana, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Votar: publicación inexistente', 'NO_SUBMISSION',
    pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', gen_random_uuid())));
  perform pg_temp.expect('Votar: 1.er voto de carla (sin publicación propia) a ana', 'OK',
    pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Votar: 2.º voto de carla a ana', 'OK',
    pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Votar: 3.er voto de carla a ana', 'OK',
    pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Votar: 4.º voto de carla', 'NO_VOTES_LEFT',
    pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_beto_sub)));
  perform pg_temp.expect('Votar: quitar un voto donde no votó', 'NO_VOTE_TO_REMOVE',
    pg_temp.run_as(e_carla, c_carla, format('select public.remove_vote(%L)', v_beto_sub)));
  perform pg_temp.expect('Votar: quitar un voto a ana', 'OK',
    pg_temp.run_as(e_carla, c_carla, format('select public.remove_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Votar: con el voto devuelto, votar a beto', 'OK',
    pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_beto_sub)));
  perform pg_temp.expect('Votar: el superadmin participa y vota a beto', 'OK',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.cast_vote(%L)', v_beto_sub)));
  perform pg_temp.expect('Votar: beto vota a ana', 'OK',
    pg_temp.run_as(e_beto, c_beto, format('select public.cast_vote(%L)', v_ana_sub)));

  -- ana: 2 (carla) + 1 (beto) = 3; beto: 1 (carla) + 1 (admin) = 2
  perform pg_temp.expect('Tablón: votos de ana y beto (vista board)', 'OK:3,2',
    pg_temp.run_as(e_dani, c_dani, format(
      'select string_agg(vote_count::text, '','' order by vote_count desc) from public.board where round_id = %L', v_pub)));
  perform pg_temp.expect('Ver votantes: carla ×2 en ana (vista vote_details)', 'OK:Carla×2,Beto×1',
    pg_temp.run_as(e_dani, c_dani, format(
      'select string_agg(voter_name || ''×'' || vote_count, '','' order by vote_count desc) from public.vote_details where submission_id = %L',
      v_ana_sub)));

  -- ===== Editar el título conserva los votos =====
  perform pg_temp.expect('Editar título', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.update_submission_title(%L, ''Título nuevo'')', v_pub)));
  perform pg_temp.expect('Editar título: conserva los 3 votos', '3',
    (select count(*)::text from public.votes where submission_id = v_ana_sub));
  perform pg_temp.expect('Editar título: carla sin publicación', 'NO_SUBMISSION',
    pg_temp.run_as(e_carla, c_carla, format('select public.update_submission_title(%L, ''X'')', v_pub)));

  -- ===== Reemplazar la imagen devuelve los votos =====
  v_ana_path2 := format('%s/%s/%s.webp', v_pub, c_ana, gen_random_uuid());
  perform pg_temp.upload(e_ana, c_ana, v_ana_path2);
  perform pg_temp.expect('Reemplazar imagen: devuelve la ruta anterior', 'OK:' || v_ana_path,
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.replace_submission_image(%L, %L, 1000, 625)', v_pub, v_ana_path2)));
  perform pg_temp.expect('Reemplazar imagen: la publicación queda en 0 votos', '0',
    (select count(*)::text from public.votes where submission_id = v_ana_sub));
  perform pg_temp.expect('Reemplazar imagen: carla recupera 2 votos (le queda 1 usado)', '1',
    (select count(*)::text from public.votes where voter_id = c_carla and round_id = v_pub));
  perform pg_temp.expect('Reemplazar imagen: el título se conserva', 'Título nuevo',
    (select title from public.submissions where id = v_ana_sub));

  -- ===== Política de borrado en Storage =====
  -- (Supabase bloquea el DELETE directo sobre storage.objects; se habilita solo para probar la política)
  perform set_config('storage.allow_delete_query', 'true', true);
  perform pg_temp.expect('Storage: ni siendo la dueña puede borrar un archivo en uso', 'OK:0',
    pg_temp.remove(e_ana, c_ana, v_ana_path2));
  perform pg_temp.expect('Storage: otro usuario no puede borrar archivos ajenos', 'OK:0',
    pg_temp.remove(e_beto, c_beto, v_ana_path));
  perform pg_temp.expect('Storage: borra su archivo reemplazado (sin referencia)', 'OK:1',
    pg_temp.remove(e_ana, c_ana, v_ana_path));

  -- ===== Borrar la propia publicación devuelve los votos =====
  perform pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_beto_sub));
  perform pg_temp.expect('Borrar publicación: devuelve la ruta', 'OK:' || v_beto_path,
    pg_temp.run_as(e_beto, c_beto, format('select public.delete_my_submission(%L)', v_pub)));
  perform pg_temp.expect('Borrar publicación: carla recupera sus votos', '0',
    (select count(*)::text from public.votes where voter_id = c_carla and round_id = v_pub));
  perform pg_temp.expect('Borrar publicación: sin publicación', 'NO_SUBMISSION',
    pg_temp.run_as(e_beto, c_beto, format('select public.delete_my_submission(%L)', v_pub)));

  v_beto_path2 := format('%s/%s/%s.webp', v_pub, c_beto, gen_random_uuid());
  perform pg_temp.upload(e_beto, c_beto, v_beto_path2);
  perform pg_temp.expect('Publicar de nuevo tras borrar', 'OK:',
    pg_temp.run_as(e_beto, c_beto, format(
      'select public.create_submission(%L, ''Beto otra vez'', %L, 800, 500)', v_pub, v_beto_path2)));
  v_beto_sub := (select id from public.submissions where user_id = c_beto and round_id = v_pub);

  -- ===== Privada: sin acceso =====
  v_ana_priv_path := format('%s/%s/%s.webp', v_priv, c_ana, gen_random_uuid());
  perform pg_temp.upload(e_ana, c_ana, v_ana_priv_path);
  perform pg_temp.expect('Privada: la dueña publica', 'OK:',
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.create_submission(%L, ''Privada de Ana'', %L, 100, 100)', v_priv, v_ana_priv_path)));
  v_ana_priv_sub := (select id from public.submissions where user_id = c_ana and round_id = v_priv);

  perform pg_temp.expect('Privada: sin acceso ve la competencia en rounds', 'OK:1',
    pg_temp.run_as(e_beto, c_beto, format('select count(*) from public.rounds where id = %L', v_priv)));
  perform pg_temp.expect('Privada: sin acceso no ve publicaciones', 'OK:0',
    pg_temp.run_as(e_beto, c_beto, format('select count(*) from public.submissions where round_id = %L', v_priv)));
  perform pg_temp.expect('Privada: sin acceso no ve el tablón', 'OK:0',
    pg_temp.run_as(e_beto, c_beto, format('select count(*) from public.board where round_id = %L', v_priv)));
  perform pg_temp.expect('Privada: sin acceso no ve imágenes', 'OK:0',
    pg_temp.run_as(e_beto, c_beto, format(
      'select count(*) from storage.objects where bucket_id = ''submissions'' and name like %L', v_priv || '/%')));
  perform pg_temp.expect('Privada: sin acceso no puede votar', 'NO_ACCESS',
    pg_temp.run_as(e_beto, c_beto, format('select public.cast_vote(%L)', v_ana_priv_sub)));
  perform pg_temp.expect('Privada: sin acceso no puede subir', 'new row violates row-level security',
    pg_temp.upload(e_beto, c_beto, format('%s/%s/%s.webp', v_priv, c_beto, gen_random_uuid())));
  perform pg_temp.expect('Privada: sin acceso no puede publicar', 'NO_ACCESS',
    pg_temp.run_as(e_beto, c_beto, format(
      'select public.create_submission(%L, ''X'', ''x'', 1, 1)', v_priv)));
  perform pg_temp.expect('Privada: el superadmin ve el contenido', 'OK:1',
    pg_temp.run_as(c_admin_email, c_admin, format('select count(*) from public.board where round_id = %L', v_priv)));

  perform pg_temp.expect('Hub: privada sin acceso (sin ganador ni portada, con participantes)', 'OK:none/1/true',
    pg_temp.run_as(e_beto, c_beto, format(
      'select my_access || ''/'' || participant_count || ''/'' || (cover_path is null) from public.hub_rounds() where id = %L',
      v_priv)));
  perform pg_temp.expect('Hub: la dueña ve su privada con portada', 'OK:owner/false',
    pg_temp.run_as(e_ana, c_ana, format(
      'select my_access || ''/'' || (cover_path is null) from public.hub_rounds() where id = %L', v_priv)));
  perform pg_temp.expect('Hub: el superadmin ve la privada como admin', 'OK:admin',
    pg_temp.run_as(c_admin_email, c_admin, format('select my_access from public.hub_rounds() where id = %L', v_priv)));

  -- ===== Enlace de invitación =====
  perform pg_temp.expect('Invitación: otro no ve el enlace', 'NOT_OWNER',
    pg_temp.run_as(e_beto, c_beto, format('select public.get_invite_link(%L)', v_priv)));
  perform pg_temp.expect('Invitación: una pública no tiene enlace', 'NOT_PRIVATE',
    pg_temp.run_as(e_ana, c_ana, format('select public.get_invite_link(%L)', v_pub)));
  perform pg_temp.expect('Invitación: otro no lee la tabla de tokens', 'OK:0',
    pg_temp.run_as(e_beto, c_beto, 'select count(*) from public.round_invites'));
  v_token := substr(pg_temp.run_as(e_ana, c_ana, format('select public.get_invite_link(%L)', v_priv)), 4);
  perform pg_temp.expect('Invitación: token que no es uuid', 'INVALID_INVITE',
    pg_temp.run_as(e_beto, c_beto, 'select public.join_with_invite(''basura'')'));
  perform pg_temp.expect('Invitación: token inexistente', 'INVALID_INVITE',
    pg_temp.run_as(e_beto, c_beto, format('select public.join_with_invite(%L)', gen_random_uuid())));
  perform pg_temp.expect('Invitación: beto entra con el enlace', 'OK:' || v_priv,
    pg_temp.run_as(e_beto, c_beto, format('select public.join_with_invite(%L)', v_token)));
  perform pg_temp.expect('Invitación: beto queda como miembro (invite_link)', 'invite_link',
    (select source::text from public.round_members where round_id = v_priv and user_id = c_beto));
  perform pg_temp.expect('Invitación: beto ya ve las publicaciones', 'OK:1',
    pg_temp.run_as(e_beto, c_beto, format('select count(*) from public.submissions where round_id = %L', v_priv)));
  perform pg_temp.expect('Invitación: entrar de nuevo no falla', 'OK:' || v_priv,
    pg_temp.run_as(e_beto, c_beto, format('select public.join_with_invite(%L)', v_token)));
  v_token2 := substr(pg_temp.run_as(e_ana, c_ana, format('select public.regenerate_invite_link(%L)', v_priv)), 4);
  perform pg_temp.expect('Invitación: el token regenerado es distinto', 'true', (v_token2 <> v_token)::text);
  perform pg_temp.expect('Invitación: el enlace viejo deja de funcionar', 'INVALID_INVITE',
    pg_temp.run_as(e_carla, c_carla, format('select public.join_with_invite(%L)', v_token)));

  -- ===== Solicitudes de acceso =====
  perform pg_temp.expect('Solicitud: a una pública', 'NOT_PRIVATE',
    pg_temp.run_as(e_carla, c_carla, format('select public.request_access(%L)', v_pub)));
  perform pg_temp.expect('Solicitud: un miembro ya tiene acceso', 'ALREADY_HAS_ACCESS',
    pg_temp.run_as(e_beto, c_beto, format('select public.request_access(%L)', v_priv)));
  perform pg_temp.expect('Solicitud: el superadmin ya tiene acceso', 'ALREADY_HAS_ACCESS',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.request_access(%L)', v_priv)));
  v_req := substr(pg_temp.run_as(e_carla, c_carla, format('select public.request_access(%L)', v_priv)), 4)::uuid;
  perform pg_temp.expect('Solicitud: carla pide acceso', 'pending',
    (select status::text from public.access_requests where id = v_req));
  perform pg_temp.expect('Solicitud: una segunda pendiente', 'REQUEST_PENDING',
    pg_temp.run_as(e_carla, c_carla, format('select public.request_access(%L)', v_priv)));
  perform pg_temp.expect('Hub: carla ve su solicitud pendiente', 'OK:pending',
    pg_temp.run_as(e_carla, c_carla, format('select my_access from public.hub_rounds() where id = %L', v_priv)));
  perform pg_temp.expect('Hub: la dueña ve 1 solicitud pendiente', 'OK:1',
    pg_temp.run_as(e_ana, c_ana, format('select pending_requests from public.hub_rounds() where id = %L', v_priv)));
  perform pg_temp.expect('Solicitud: carla ve su solicitud', 'OK:1',
    pg_temp.run_as(e_carla, c_carla, 'select count(*) from public.access_requests where user_id = auth.uid()'));
  perform pg_temp.expect('Solicitud: beto no ve solicitudes ajenas', 'OK:0',
    pg_temp.run_as(e_beto, c_beto, 'select count(*) from public.access_requests'));
  perform pg_temp.expect('Solicitud: otro no puede resolverla', 'NOT_OWNER',
    pg_temp.run_as(e_beto, c_beto, format('select public.resolve_access_request(%L, true)', v_req)));
  perform pg_temp.expect('Solicitud: la dueña la rechaza', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.resolve_access_request(%L, false)', v_req)));
  perform pg_temp.expect('Solicitud: rechazada, carla sigue sin acceso', 'OK:0',
    pg_temp.run_as(e_carla, c_carla, format('select count(*) from public.submissions where round_id = %L', v_priv)));
  perform pg_temp.expect('Solicitud: resolver una ya resuelta', 'NO_REQUEST',
    pg_temp.run_as(e_ana, c_ana, format('select public.resolve_access_request(%L, true)', v_req)));
  v_req := substr(pg_temp.run_as(e_carla, c_carla, format('select public.request_access(%L)', v_priv)), 4)::uuid;
  perform pg_temp.expect('Solicitud: después del rechazo puede volver a pedir', 'pending',
    (select status::text from public.access_requests where id = v_req));
  perform pg_temp.expect('Solicitud: la dueña la aprueba', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.resolve_access_request(%L, true)', v_req)));
  perform pg_temp.expect('Solicitud: aprobada, carla es miembro (request)', 'request',
    (select source::text from public.round_members where round_id = v_priv and user_id = c_carla));

  -- ===== Agregar persona =====
  v_req := substr(pg_temp.run_as(e_dani, c_dani, format('select public.request_access(%L)', v_priv)), 4)::uuid;
  perform pg_temp.expect('Agregar: otro no puede', 'NOT_OWNER',
    pg_temp.run_as(e_beto, c_beto, format('select public.add_member(%L, %L)', v_priv, c_dani)));
  perform pg_temp.expect('Agregar: perfil inexistente', 'USER_NOT_FOUND',
    pg_temp.run_as(e_ana, c_ana, format('select public.add_member(%L, %L)', v_priv, gen_random_uuid())));
  perform pg_temp.expect('Agregar: a una pública', 'NOT_PRIVATE',
    pg_temp.run_as(e_ana, c_ana, format('select public.add_member(%L, %L)', v_pub, c_dani)));
  perform pg_temp.expect('Agregar: a la dueña', 'ALREADY_HAS_ACCESS',
    pg_temp.run_as(e_ana, c_ana, format('select public.add_member(%L, %L)', v_priv, c_ana)));
  perform pg_temp.expect('Agregar: la dueña agrega a dani', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.add_member(%L, %L)', v_priv, c_dani)));
  perform pg_temp.expect('Agregar: la solicitud pendiente de dani queda aprobada', 'approved',
    (select status::text from public.access_requests where id = v_req));
  perform pg_temp.expect('Agregar: dos veces', 'ALREADY_HAS_ACCESS',
    pg_temp.run_as(e_ana, c_ana, format('select public.add_member(%L, %L)', v_priv, c_dani)));
  perform pg_temp.expect('Miembros: la dueña ve a los 3', 'OK:3',
    pg_temp.run_as(e_ana, c_ana, format('select count(*) from public.round_members where round_id = %L', v_priv)));
  perform pg_temp.expect('Miembros: un miembro solo ve su membresía', 'OK:1',
    pg_temp.run_as(e_beto, c_beto, format('select count(*) from public.round_members where round_id = %L', v_priv)));

  -- ===== Participar en la privada =====
  v_beto_priv_path := format('%s/%s/%s.webp', v_priv, c_beto, gen_random_uuid());
  perform pg_temp.expect('Privada: un miembro sube a Storage', 'OK',
    pg_temp.upload(e_beto, c_beto, v_beto_priv_path));
  perform pg_temp.expect('Privada: un miembro publica', 'OK:',
    pg_temp.run_as(e_beto, c_beto, format(
      'select public.create_submission(%L, ''Privada de Beto'', %L, 100, 100)', v_priv, v_beto_priv_path)));
  v_beto_priv_sub := (select id from public.submissions where user_id = c_beto and round_id = v_priv);
  -- Los votos son por competencia: carla tiene otros 3 en la privada.
  perform pg_temp.expect('Votos por competencia: carla vota en la privada (1)', 'OK',
    pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_beto_priv_sub)));
  perform pg_temp.expect('Votos por competencia: carla vota en la privada (2)', 'OK',
    pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_beto_priv_sub)));
  perform pg_temp.expect('Votos por competencia: carla vota en la privada (3)', 'OK',
    pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_ana_priv_sub)));
  perform pg_temp.run_as(e_dani, c_dani, format('select public.cast_vote(%L)', v_beto_priv_sub));
  perform pg_temp.run_as(e_beto, c_beto, format('select public.cast_vote(%L)', v_ana_priv_sub));

  -- ===== Actividad =====
  perform pg_temp.run_sql(format(
    'update public.rounds set last_activity_at = now() - interval ''2 hours'' where id = %L returning 1', v_priv));
  perform pg_temp.run_as(e_dani, c_dani, format('select public.cast_vote(%L)', v_ana_priv_sub));
  perform pg_temp.expect('Actividad: un voto actualiza last_activity_at', 'true',
    (select (last_activity_at > now() - interval '1 minute')::text from public.rounds where id = v_priv));

  -- ===== Quitar miembro y salir =====
  perform pg_temp.expect('Quitar: la dueña no es miembro', 'NOT_MEMBER',
    pg_temp.run_as(e_ana, c_ana, format('select public.remove_member(%L, %L)', v_priv, c_ana)));
  perform pg_temp.expect('Quitar: otro no puede', 'NOT_OWNER',
    pg_temp.run_as(e_carla, c_carla, format('select public.remove_member(%L, %L)', v_priv, c_beto)));
  perform pg_temp.expect('Quitar: devuelve la ruta de su imagen', 'OK:' || v_beto_priv_path,
    pg_temp.run_as(e_ana, c_ana, format('select public.remove_member(%L, %L)', v_priv, c_beto)));
  perform pg_temp.expect('Quitar: se borra su publicación', '0',
    (select count(*)::text from public.submissions where round_id = v_priv and user_id = c_beto));
  perform pg_temp.expect('Quitar: carla recupera los 2 votos que le había dado', '1',
    (select count(*)::text from public.votes where round_id = v_priv and voter_id = c_carla));
  perform pg_temp.expect('Quitar: se borran los votos que había dado', '0',
    (select count(*)::text from public.votes where round_id = v_priv and voter_id = c_beto));
  perform pg_temp.expect('Quitar: beto pierde el acceso', 'OK:0',
    pg_temp.run_as(e_beto, c_beto, format('select count(*) from public.submissions where round_id = %L', v_priv)));
  perform pg_temp.expect('Storage: la dueña borra la imagen de un miembro quitado', 'OK:1',
    pg_temp.remove(e_ana, c_ana, v_beto_priv_path));
  perform pg_temp.expect('Storage: un miembro no borra la imagen de la dueña', 'OK:0',
    pg_temp.remove(e_carla, c_carla, v_ana_priv_path));
  perform pg_temp.expect('Salir: dani sale (sin publicación)', 'OK',
    pg_temp.run_as(e_dani, c_dani, format('select public.leave_round(%L)', v_priv)));
  perform pg_temp.expect('Salir: se borran los votos de dani', '0',
    (select count(*)::text from public.votes where round_id = v_priv and voter_id = c_dani));
  perform pg_temp.expect('Salir: quien no es miembro', 'NOT_MEMBER',
    pg_temp.run_as(e_beto, c_beto, format('select public.leave_round(%L)', v_priv)));
  perform pg_temp.expect('Salir: la dueña no puede salir', 'NOT_MEMBER',
    pg_temp.run_as(e_ana, c_ana, format('select public.leave_round(%L)', v_priv)));

  -- ===== Empate en la pública: 2 votos cada una =====
  perform pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_ana_sub));
  perform pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_beto_sub));
  perform pg_temp.run_as(c_admin_email, c_admin, format('select public.cast_vote(%L)', v_ana_sub));
  perform pg_temp.run_as(e_ana, c_ana, format('select public.cast_vote(%L)', v_beto_sub));
  perform pg_temp.expect('Ranking: los empates comparten posición', 'OK:1-2,1-2',
    pg_temp.run_as(e_carla, c_carla, format(
      'select string_agg(position || ''-'' || vote_count, '','') from public.board where round_id = %L', v_pub)));
  perform pg_temp.expect('Hub: carla participó en la pública', 'OK:true',
    pg_temp.run_as(e_carla, c_carla, format('select my_involvement from public.hub_rounds() where id = %L', v_pub)));
  perform pg_temp.expect('Hub: dani no participó en la pública', 'OK:false',
    pg_temp.run_as(e_dani, c_dani, format('select my_involvement from public.hub_rounds() where id = %L', v_pub)));
  perform pg_temp.expect('Números: participantes, publicaciones y votos', 'OK:4/2/4',
    pg_temp.run_as(e_ana, c_ana, format(
      'select participants || ''/'' || submissions || ''/'' || votes from public.round_stats(%L)', v_pub)));

  -- ===== Competencia cerrada =====
  perform pg_temp.expect('Cerrar (open → closed)', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.set_round_status(%L, ''closed'')', v_pub)));
  perform pg_temp.expect('Cerrada: no se puede votar', 'ROUND_NOT_OPEN',
    pg_temp.run_as(e_carla, c_carla, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Cerrada: no se puede quitar un voto', 'ROUND_NOT_OPEN',
    pg_temp.run_as(e_carla, c_carla, format('select public.remove_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Cerrada: no se puede editar el título', 'ROUND_NOT_OPEN',
    pg_temp.run_as(e_ana, c_ana, format('select public.update_submission_title(%L, ''Otro'')', v_pub)));
  perform pg_temp.expect('Cerrada: no se puede borrar la publicación', 'ROUND_NOT_OPEN',
    pg_temp.run_as(e_ana, c_ana, format('select public.delete_my_submission(%L)', v_pub)));
  perform pg_temp.expect('Cerrada: no se puede reemplazar la imagen', 'ROUND_NOT_OPEN',
    pg_temp.run_as(e_ana, c_ana, format(
      'select public.replace_submission_image(%L, %L, 1, 1)', v_pub, v_ana_path2)));
  perform pg_temp.expect('Cerrada: no se puede subir a Storage', 'new row violates row-level security',
    pg_temp.upload(e_carla, c_carla, format('%s/%s/%s.webp', v_pub, c_carla, gen_random_uuid())));

  -- ===== Reabrir =====
  perform pg_temp.expect('Reabrir (closed → open)', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.set_round_status(%L, ''open'')', v_pub)));
  perform pg_temp.expect('Reabierta: se puede volver a votar', 'OK',
    pg_temp.run_as(e_beto, c_beto, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.run_as(e_ana, c_ana, format('select public.set_round_status(%L, ''closed'')', v_pub));

  -- ===== Finalizar =====
  perform pg_temp.expect('Finalizar: ganador de otra competencia', 'INVALID_WINNER',
    pg_temp.run_as(e_ana, c_ana, format('select public.finalize_round(%L, %L)', v_pub, v_ana_priv_sub)));
  perform pg_temp.expect('Finalizar: elegir a beto aunque ana tenga más votos', 'OK',
    pg_temp.run_as(e_ana, c_ana, format('select public.finalize_round(%L, %L)', v_pub, v_beto_sub)));
  perform pg_temp.expect('Finalizar: estado y ganador', 'finalized/' || v_beto_sub,
    (select status || '/' || winner_submission_id from public.rounds where id = v_pub));

  -- ===== Moderación: borrar publicaciones =====
  perform pg_temp.expect('Moderar: otro no puede borrar publicaciones', 'NOT_OWNER',
    pg_temp.run_as(e_carla, c_carla, format('select public.delete_submission(%L)', v_beto_sub)));
  perform pg_temp.expect('Moderar: borrar la ganadora devuelve la ruta', 'OK:' || v_beto_path2,
    pg_temp.run_as(e_ana, c_ana, format('select public.delete_submission(%L)', v_beto_sub)));
  perform pg_temp.expect('Moderar: la competencia vuelve a closed sin ganador', 'closed/',
    (select status || '/' || coalesce(winner_submission_id::text, '') from public.rounds where id = v_pub));
  perform pg_temp.expect('Moderar: los votos a la ganadora se devuelven', '0',
    (select count(*)::text from public.votes where submission_id = v_beto_sub));
  perform pg_temp.expect('Storage: la dueña borra un archivo ajeno sin referencia en su competencia', 'OK:1',
    pg_temp.remove(e_ana, c_ana, v_beto_path2));
  perform pg_temp.expect('Storage: el superadmin borra incluso un archivo en uso', 'OK:1',
    pg_temp.remove(c_admin_email, c_admin, v_ana_path2));
  perform pg_temp.expect('Moderar: el superadmin borra en una competencia ajena', 'OK:' || v_ana_priv_path,
    pg_temp.run_as(c_admin_email, c_admin, format('select public.delete_submission(%L)', v_ana_priv_sub)));
  perform pg_temp.run_as(e_ana, c_ana, format('select public.finalize_round(%L, %L)', v_pub, v_ana_sub));

  -- ===== Límite: finalizar libera el cupo; borrar una competencia =====
  v_out := pg_temp.run_as(e_ana, c_ana, 'select public.create_round(''Extra'', ''public'')');
  perform pg_temp.expect('Límite: con una finalizada puede crear otra', 'OK:', v_out);
  v_extra := substr(v_out, 4)::uuid;
  perform pg_temp.run_as(e_ana, c_ana, format('select public.set_round_status(%L, ''open'')', v_extra));
  v_extra_ana_path := format('%s/%s/%s.webp', v_extra, c_ana, gen_random_uuid());
  v_extra_carla_path := format('%s/%s/%s.webp', v_extra, c_carla, gen_random_uuid());
  perform pg_temp.upload(e_ana, c_ana, v_extra_ana_path);
  perform pg_temp.upload(e_carla, c_carla, v_extra_carla_path);
  perform pg_temp.run_as(e_carla, c_carla, format(
    'select public.create_submission(%L, ''Carla extra'', %L, 10, 10)', v_extra, v_extra_carla_path));
  perform pg_temp.expect('Borrar competencia: devuelve el id', 'OK:' || v_extra,
    pg_temp.run_as(e_ana, c_ana, format('select public.delete_round(%L)', v_extra)));
  perform pg_temp.expect('Borrar competencia: sin publicaciones ni votos', '0/0/0',
    (select (select count(*) from public.submissions where round_id = v_extra) || '/' ||
            (select count(*) from public.votes where round_id = v_extra) || '/' ||
            (select count(*) from public.rounds where id = v_extra)));
  perform pg_temp.expect('Borrar competencia: quien la borró lista los archivos que quedaron', 'OK:2',
    pg_temp.run_as(e_ana, c_ana, format(
      'select count(*) from storage.objects where bucket_id = ''submissions'' and name like %L', v_extra || '/%')));
  perform pg_temp.expect('Borrar competencia: otro no ve esos archivos', 'OK:0',
    pg_temp.run_as(e_beto, c_beto, format(
      'select count(*) from storage.objects where bucket_id = ''submissions'' and name like %L', v_extra || '/%')));
  perform pg_temp.expect('Borrar competencia: quien la borró borra archivos ajenos', 'OK:1',
    pg_temp.remove(e_ana, c_ana, v_extra_carla_path));
  perform pg_temp.expect('Borrar competencia: libera el cupo', 'OK:',
    pg_temp.run_as(e_ana, c_ana, 'select public.create_round(''Otra extra'', ''public'')'));

  -- ===== Importar miembros =====
  -- Competencias de beto (no tiene ninguna, así no choca con el límite de 2 de ana).
  -- La concurrencia (dos importaciones simultáneas) no se prueba acá, que corre en una sola sesión:
  -- la garantiza la clave primaria (round_id, user_id) de round_members con `on conflict do nothing`.
  v_imp_a := substr(pg_temp.run_as(e_beto, c_beto,
    'select public.create_round(''Importar A'', ''private'')'), 4)::uuid;
  v_imp_b := substr(pg_temp.run_as(e_beto, c_beto,
    'select public.create_round(''Importar B'', ''private'')'), 4)::uuid;
  perform pg_temp.run_as(e_beto, c_beto, format('select public.add_member(%L, %L)', v_imp_a, c_carla));
  perform pg_temp.run_as(e_beto, c_beto, format('select public.add_member(%L, %L)', v_imp_a, c_dani));
  perform pg_temp.run_as(e_beto, c_beto, format('select public.add_member(%L, %L)', v_imp_b, c_carla));
  v_imp_dani_req := substr(pg_temp.run_as(e_dani, c_dani, format('select public.request_access(%L)', v_imp_b)), 4)::uuid;
  v_imp_ana_req := substr(pg_temp.run_as(e_ana, c_ana, format('select public.request_access(%L)', v_imp_b)), 4)::uuid;
  v_imp_pub := substr(pg_temp.run_sql(format(
    'insert into public.rounds (name, owner_id, visibility) values (''Importar pública'', %L, ''public'') returning id',
    c_beto)), 4)::uuid;
  v_imp_clean := substr(pg_temp.run_sql(format(
    'insert into public.rounds (name, owner_id, visibility, status, cleaned_at) values (''Importar limpiada'', %L, ''private'', ''finalized'', now()) returning id',
    c_beto)), 4)::uuid;
  perform pg_temp.expect('Importar: preparación (A con 2, B con 1, 2 solicitudes pendientes en B)', '2/1/2',
    (select (select count(*) from public.round_members where round_id = v_imp_a) || '/' ||
            (select count(*) from public.round_members where round_id = v_imp_b) || '/' ||
            (select count(*) from public.access_requests where round_id = v_imp_b and status = 'pending')));

  -- Errores
  perform pg_temp.expect('Importar: anon no puede', 'permission denied',
    pg_temp.run_as_anon(format('select public.import_members(%L, %L)', v_imp_b, v_imp_a)));
  perform pg_temp.expect('Importar: otro dominio', 'NOT_ALLOWED',
    pg_temp.run_as(e_intruso, c_intruso, format('select public.import_members(%L, %L)', v_imp_b, v_imp_a)));
  perform pg_temp.expect('Importar: un miembro no dueño', 'NOT_OWNER',
    pg_temp.run_as(e_carla, c_carla, format('select public.import_members(%L, %L)', v_imp_b, v_imp_a)));
  perform pg_temp.expect('Importar: el superadmin en una ajena', 'NOT_OWNER',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.import_members(%L, %L)', v_imp_b, v_imp_a)));
  perform pg_temp.expect('Importar: desde una privada ajena', 'NOT_OWNER',
    pg_temp.run_as(e_beto, c_beto, format('select public.import_members(%L, %L)', v_imp_b, v_priv)));
  perform pg_temp.expect('Importar: destino inexistente', 'ROUND_NOT_FOUND',
    pg_temp.run_as(e_beto, c_beto, format('select public.import_members(%L, %L)', gen_random_uuid(), v_imp_a)));
  perform pg_temp.expect('Importar: origen inexistente', 'ROUND_NOT_FOUND',
    pg_temp.run_as(e_beto, c_beto, format('select public.import_members(%L, %L)', v_imp_b, gen_random_uuid())));
  perform pg_temp.expect('Importar: destino público', 'NOT_PRIVATE',
    pg_temp.run_as(e_beto, c_beto, format('select public.import_members(%L, %L)', v_imp_pub, v_imp_a)));
  perform pg_temp.expect('Importar: origen público', 'NOT_PRIVATE',
    pg_temp.run_as(e_beto, c_beto, format('select public.import_members(%L, %L)', v_imp_b, v_imp_pub)));
  perform pg_temp.expect('Importar: destino limpiado', 'ROUND_CLEANED',
    pg_temp.run_as(e_beto, c_beto, format('select public.import_members(%L, %L)', v_imp_clean, v_imp_a)));
  perform pg_temp.expect('Importar: origen limpiado', 'ROUND_CLEANED',
    pg_temp.run_as(e_beto, c_beto, format('select public.import_members(%L, %L)', v_imp_b, v_imp_clean)));
  perform pg_temp.expect('Importar: los errores no cambian nada (B solo con carla, dani pendiente)', 'Carla/pending',
    (select string_agg(p.full_name, ',') from public.round_members m join public.profiles p on p.id = m.user_id
      where m.round_id = v_imp_b) || '/' ||
    (select status::text from public.access_requests where id = v_imp_dani_req));

  -- Camino feliz. Carla entra a B "por enlace" y hace un día: si la RPC la sobrescribiera
  -- (source = 'added', joined_at = now()), el caso de abajo lo detecta.
  perform pg_temp.run_sql(format(
    'update public.round_members set source = ''invite_link'', joined_at = now() - interval ''1 day'' where round_id = %L and user_id = %L returning 1',
    v_imp_b, c_carla));
  v_imp_carla :=(select source || '/' || joined_at from public.round_members
                   where round_id = v_imp_b and user_id = c_carla);
  perform pg_temp.expect('Importar: A → B suma a dani', 'OK:1',
    pg_temp.run_as(e_beto, c_beto, format('select public.import_members(%L, %L)', v_imp_b, v_imp_a)));
  perform pg_temp.expect('Importar: B tiene a carla y dani, una vez cada uno', '2/2',
    (select count(*) || '/' || count(distinct user_id) from public.round_members
      where round_id = v_imp_b and user_id in (c_carla, c_dani)));
  perform pg_temp.expect('Importar: carla (ya miembro) no cambia', v_imp_carla,
    (select source || '/' || joined_at from public.round_members where round_id = v_imp_b and user_id = c_carla));
  perform pg_temp.expect('Importar: dani queda como agregado', 'added',
    (select source::text from public.round_members where round_id = v_imp_b and user_id = c_dani));
  perform pg_temp.expect('Importar: la solicitud de dani queda aprobada', 'approved/true',
    (select status || '/' || (resolved_at is not null) from public.access_requests where id = v_imp_dani_req));
  perform pg_temp.expect('Importar: quien no está en el origen sigue pendiente y sin acceso', 'pending/0',
    (select status::text from public.access_requests where id = v_imp_ana_req) || '/' ||
    (select count(*) from public.round_members where round_id = v_imp_b and user_id = c_ana));
  perform pg_temp.expect('Importar: el origen no cambia', '2',
    (select count(*)::text from public.round_members where round_id = v_imp_a));
  perform pg_temp.expect('Importar: repetir no suma a nadie', 'OK:0',
    pg_temp.run_as(e_beto, c_beto, format('select public.import_members(%L, %L)', v_imp_b, v_imp_a)));
  perform pg_temp.expect('Importar: origen = destino no suma a nadie', 'OK:0',
    pg_temp.run_as(e_beto, c_beto, format('select public.import_members(%L, %L)', v_imp_a, v_imp_a)));

  -- Quitados y rechazados vuelven a sumarse si están en el origen.
  perform pg_temp.expect('Importar: beto quita a dani de B', 'OK',
    pg_temp.run_as(e_beto, c_beto, format('select public.remove_member(%L, %L)', v_imp_b, c_dani)));
  perform pg_temp.expect('Importar: beto rechaza la solicitud de ana en B', 'OK',
    pg_temp.run_as(e_beto, c_beto, format('select public.resolve_access_request(%L, false)', v_imp_ana_req)));
  perform pg_temp.expect('Importar: beto agrega a ana en A', 'OK',
    pg_temp.run_as(e_beto, c_beto, format('select public.add_member(%L, %L)', v_imp_a, c_ana)));
  perform pg_temp.expect('Importar: A → B suma a dani (quitado) y ana (rechazada)', 'OK:2',
    pg_temp.run_as(e_beto, c_beto, format('select public.import_members(%L, %L)', v_imp_b, v_imp_a)));
  perform pg_temp.expect('Importar: dani y ana son miembros agregados de B', 'added,added',
    (select string_agg(source::text, ',') from public.round_members
      where round_id = v_imp_b and user_id in (c_dani, c_ana)));
  perform pg_temp.expect('Importar: la solicitud rechazada de ana no cambia', 'rejected',
    (select status::text from public.access_requests where id = v_imp_ana_req));
  perform pg_temp.expect('Importar: B queda con 3 miembros', '3',
    (select count(*)::text from public.round_members where round_id = v_imp_b));

  -- ===== Archivo y limpieza =====
  perform pg_temp.expect('Archivo: un usuario no lista para archivar', 'NOT_ADMIN',
    pg_temp.run_as(e_ana, c_ana, 'select count(*) from public.admin_rounds_to_archive()'));
  perform pg_temp.expect('Archivo: un usuario no registra exportaciones', 'NOT_ADMIN',
    pg_temp.run_as(e_ana, c_ana, format('select public.admin_mark_exported(%L, null)', v_pub)));
  perform pg_temp.expect('Archivo: un usuario no limpia', 'NOT_ADMIN',
    pg_temp.run_as(e_ana, c_ana, format('select public.admin_clean_round(%L)', v_pub)));
  perform pg_temp.expect('Archivo: un usuario no lista archivadas', 'NOT_ADMIN',
    pg_temp.run_as(e_ana, c_ana, 'select count(*) from public.admin_archives()'));
  perform pg_temp.expect('Archivo: no limpia con actividad reciente', 'NOT_INACTIVE',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_clean_round(%L)', v_pub)));
  perform pg_temp.expect('Archivo: una competencia reciente no está para archivar', 'OK:0',
    pg_temp.run_as(c_admin_email, c_admin, format('select count(*) from public.admin_rounds_to_archive() where id = %L', v_pub)));

  -- Se simulan 61 días sin actividad.
  perform pg_temp.run_sql(format(
    'update public.rounds set last_activity_at = now() - interval ''61 days'' where id = %L returning 1', v_pub));
  perform pg_temp.expect('Archivo: con 61 días sin actividad aparece para archivar', 'OK:1',
    pg_temp.run_as(c_admin_email, c_admin, format('select count(*) from public.admin_rounds_to_archive() where id = %L', v_pub)));
  perform pg_temp.expect('Archivo: no limpia sin exportar', 'NOT_EXPORTED',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_clean_round(%L)', v_pub)));
  perform pg_temp.expect('Archivo: registrar la exportación', 'OK',
    pg_temp.run_as(c_admin_email, c_admin, format(
      'select public.admin_mark_exported(%L, ''https://drive.google.com/file/d/prueba'')', v_pub)));
  perform pg_temp.expect('Archivo: un usuario no lee el enlace a Drive', 'permission denied',
    pg_temp.run_as(e_carla, c_carla, 'select count(drive_url) from public.round_archives'));
  perform pg_temp.expect('Archivo: limpiar', 'OK:' || v_pub,
    pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_clean_round(%L)', v_pub)));
  perform pg_temp.expect('Archivo: se borran publicaciones y votos', '0/0',
    (select (select count(*) from public.submissions where round_id = v_pub) || '/' ||
            (select count(*) from public.votes where round_id = v_pub)));
  perform pg_temp.expect('Archivo: la limpieza no cuenta como actividad', 'true',
    (select (last_activity_at < now() - interval '60 days')::text from public.rounds where id = v_pub));
  perform pg_temp.expect('Archivo: la lápida guarda ganador y ranking', 'Título nuevo/Ana/1',
    (select (snapshot -> 'winner' ->> 'title') || '/' || (snapshot -> 'winner' ->> 'author_name') || '/' ||
            jsonb_array_length(snapshot -> 'ranking')
       from public.round_archives where round_id = v_pub));
  perform pg_temp.expect('Archivo: un usuario con acceso lee la lápida', 'OK:Título nuevo',
    pg_temp.run_as(e_carla, c_carla, format(
      'select snapshot -> ''winner'' ->> ''title'' from public.round_archives where round_id = %L', v_pub)));
  perform pg_temp.expect('Hub: la archivada muestra el ganador guardado, sin portada', 'OK:Título nuevo/true/1',
    pg_temp.run_as(e_dani, c_dani, format(
      'select winner_title || ''/'' || (cover_path is null) || ''/'' || participant_count from public.hub_rounds() where id = %L',
      v_pub)));
  perform pg_temp.expect('Archivo: no se puede publicar en una archivada', 'ROUND_CLEANED',
    pg_temp.run_as(e_carla, c_carla, format(
      'select public.create_submission(%L, ''X'', ''x'', 1, 1)', v_pub)));
  perform pg_temp.expect('Archivo: limpiar dos veces', 'ROUND_CLEANED',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_clean_round(%L)', v_pub)));
  perform pg_temp.expect('Archivo: aparece en archivadas con su enlace', 'OK:https://drive.google.com/file/d/prueba',
    pg_temp.run_as(c_admin_email, c_admin, format('select drive_url from public.admin_archives() where id = %L', v_pub)));
end $$;

select n, ok, caso, esperado, obtenido from results order by n;

rollback;
