-- Pruebas de las reglas del juego (RLS, RPC y Storage).
--
-- Todo corre dentro de una transacción que termina en ROLLBACK: no deja datos en la base.
-- Simula usuarios con `set local role` y `request.jwt.claims`:
--   - admin:   diego.martin.ortino@grupokelsoft.com
--   - ana, beto, carla: usuarios normales del dominio
--   - intruso: intruso@gmail.com (otro dominio)
--   - anon:    sin sesión
-- Ejecutar con: psql "$DB_URL" -f supabase/tests/rules.sql  (o pegar en el SQL Editor)
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
  c_admin constant uuid := 'aaaaaaaa-0000-4000-8000-000000000000';
  c_ana constant uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  c_beto constant uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  c_carla constant uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  c_intruso constant uuid := 'aaaaaaaa-0000-4000-8000-000000000099';
  v_round uuid;
  v_round2 uuid;
  v_ana_path text;
  v_ana_path2 text;
  v_beto_path text;
  v_beto_path2 text;
  v_carla_path text;
  v_ana_sub uuid;
  v_beto_sub uuid;
  v_out text;
begin
  -- ===== Preparación: usuarios ficticios (el trigger crea sus perfiles) =====
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values
    (c_admin, c_admin_email, 'authenticated', 'authenticated', '{"full_name":"Diego"}'),
    (c_ana, 'ana.prueba@grupokelsoft.com', 'authenticated', 'authenticated', '{"full_name":"Ana","avatar_url":"https://x/a.png"}'),
    (c_beto, 'beto.prueba@grupokelsoft.com', 'authenticated', 'authenticated', '{"name":"Beto"}'),
    (c_carla, 'Carla.Prueba@GrupoKelsoft.com', 'authenticated', 'authenticated', '{"full_name":"Carla"}');

  -- La base arranca con la competencia actual en 'pending'. Si no lo está, se reinicia (dentro de la transacción).
  if (select status from public.rounds where status <> 'archived') <> 'pending' then
    delete from public.rounds where status <> 'archived';
    insert into public.rounds (name) values ('Competencia de prueba');
  end if;
  select id into v_round from public.rounds where status <> 'archived';

  -- ===== Dominio y acceso =====
  perform pg_temp.expect('Perfil creado por trigger (4 usuarios)', '4',
    (select count(*)::text from public.profiles where id in (c_admin, c_ana, c_beto, c_carla)));
  perform pg_temp.expect('Perfil: nombre desde "name" si falta full_name', 'Beto',
    (select full_name from public.profiles where id = c_beto));
  perform pg_temp.expect('Perfil: email en minúsculas', 'carla.prueba@grupokelsoft.com',
    (select email from public.profiles where id = c_carla));

  perform pg_temp.expect('Dominio: trigger impide crear usuario @gmail.com', 'NOT_ALLOWED',
    pg_temp.run_sql(format(
      'insert into auth.users (id, email, aud, role) values (%L, %L, %L, %L)',
      c_intruso, 'intruso@gmail.com', 'authenticated', 'authenticated')));
  perform pg_temp.expect('Dominio: trigger impide dominio parecido (@grupokelsoft.com.ar)', 'NOT_ALLOWED',
    pg_temp.run_sql(format(
      'insert into auth.users (id, email, aud, role) values (%L, %L, %L, %L)',
      c_intruso, 'intruso@grupokelsoft.com.ar', 'authenticated', 'authenticated')));
  perform pg_temp.expect('Dominio: hook rechaza @gmail.com con 403', '403',
    public.hook_before_user_created('{"user":{"email":"intruso@gmail.com"}}') -> 'error' ->> 'http_code');
  perform pg_temp.expect('Dominio: hook acepta @grupokelsoft.com', '{}',
    public.hook_before_user_created('{"user":{"email":"nuevo@grupokelsoft.com"}}')::text);

  perform pg_temp.expect('Dominio: otro dominio no ve competencias (RLS)', 'OK:0',
    pg_temp.run_as('intruso@gmail.com', c_intruso, 'select count(*) from public.rounds'));
  perform pg_temp.expect('Dominio: otro dominio no ve perfiles (RLS)', 'OK:0',
    pg_temp.run_as('intruso@gmail.com', c_intruso, 'select count(*) from public.profiles'));
  perform pg_temp.expect('Dominio: otro dominio no puede sincronizar perfil', 'NOT_ALLOWED',
    pg_temp.run_as('intruso@gmail.com', c_intruso, 'select public.sync_my_profile()'));
  perform pg_temp.expect('Dominio: otro dominio no puede votar', 'NOT_ALLOWED',
    pg_temp.run_as('intruso@gmail.com', c_intruso, format('select public.cast_vote(%L)', gen_random_uuid())));
  perform pg_temp.expect('Dominio: otro dominio no puede publicar', 'NOT_ALLOWED',
    pg_temp.run_as('intruso@gmail.com', c_intruso, 'select public.create_submission(''x'', ''x'', 1, 1)'));
  perform pg_temp.expect('Dominio: otro dominio en una RPC de admin', 'NOT_ALLOWED',
    pg_temp.run_as('intruso@gmail.com', c_intruso, 'select public.admin_set_round_status(''open'')'));

  perform pg_temp.expect('Anon: no puede leer tablas', 'permission denied',
    pg_temp.run_as_anon('select count(*) from public.rounds'));
  perform pg_temp.expect('Anon: no puede leer la vista board', 'permission denied',
    pg_temp.run_as_anon('select count(*) from public.board'));
  perform pg_temp.expect('Anon: no puede ejecutar RPC', 'permission denied',
    pg_temp.run_as_anon(format('select public.cast_vote(%L)', gen_random_uuid())));

  perform pg_temp.expect('Usuario: lee la competencia actual', 'OK:1',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select count(*) from public.rounds where status <> ''archived'''));
  perform pg_temp.expect('Usuario: no lee la tabla admins', 'permission denied',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select count(*) from public.admins'));
  perform pg_temp.expect('Usuario: no puede insertar votos directo', 'permission denied',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'insert into public.votes (round_id, voter_id, submission_id) values (%L, %L, %L)', v_round, c_ana, gen_random_uuid())));
  perform pg_temp.expect('Usuario: no puede cambiar el estado directo', 'permission denied',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'update public.rounds set status = ''open'''));
  perform pg_temp.expect('Usuario: no puede llamar auxiliares internos', 'permission denied',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select (public.current_round()).id'));
  perform pg_temp.expect('Usuario: sync_my_profile funciona', 'OK',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select (public.sync_my_profile()).full_name'));

  -- ===== RPC de admin llamadas por un no admin =====
  perform pg_temp.expect('Admin: is_admin() es falso para un usuario normal', 'OK:false',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select public.is_admin()'));
  perform pg_temp.expect('Admin: is_admin() es verdadero para el admin', 'OK:true',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.is_admin()'));
  perform pg_temp.expect('Admin: no admin no puede abrir', 'NOT_ADMIN',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select public.admin_set_round_status(''open'')'));
  perform pg_temp.expect('Admin: no admin no puede renombrar', 'NOT_ADMIN',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select public.admin_rename_round(''Hackeada'')'));
  perform pg_temp.expect('Admin: no admin no puede borrar publicaciones', 'NOT_ADMIN',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format('select public.admin_delete_submission(%L)', gen_random_uuid())));
  perform pg_temp.expect('Admin: no admin no puede hacer reinicio total', 'NOT_ADMIN',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select public.admin_hard_reset(''X'')'));
  perform pg_temp.expect('Admin: no admin no puede crear nueva competencia', 'NOT_ADMIN',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select public.admin_start_new_round(''X'')'));
  perform pg_temp.expect('Admin: no admin no puede borrar del historial', 'NOT_ADMIN',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format('select public.admin_delete_archived_round(%L)', gen_random_uuid())));
  perform pg_temp.expect('Admin: no admin no puede finalizar', 'NOT_ADMIN',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format('select public.admin_finalize_round(%L)', gen_random_uuid())));

  -- ===== Competencia preparada (pending) =====
  v_ana_path := format('%s/%s/%s.webp', v_round, c_ana, gen_random_uuid());
  perform pg_temp.expect('Preparada: no se puede subir a Storage', 'new row violates row-level security',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'insert into storage.objects (bucket_id, name) values (''submissions'', %L) returning 1', v_ana_path)));
  perform pg_temp.expect('Preparada: no se puede publicar', 'ROUND_NOT_OPEN',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'select public.create_submission(''Hola'', %L, 100, 100)', v_ana_path)));
  perform pg_temp.expect('Transición inválida: finalizar desde preparada', 'INVALID_TRANSITION',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_finalize_round(%L)', gen_random_uuid())));
  perform pg_temp.expect('Transición inválida: cerrar desde preparada', 'INVALID_TRANSITION',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.admin_set_round_status(''closed'')'));
  perform pg_temp.expect('Admin: nombre vacío', 'INVALID_NAME',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.admin_rename_round(''   '')'));
  perform pg_temp.expect('Admin: renombrar', 'OK',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.admin_rename_round(''  Competencia de prueba  '')'));
  perform pg_temp.expect('Admin: el nombre se guarda sin espacios', 'Competencia de prueba',
    (select name from public.rounds where id = v_round));
  perform pg_temp.expect('Admin: abrir (pending → open)', 'OK',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.admin_set_round_status(''open'')'));

  -- ===== Storage con la competencia abierta =====
  perform pg_temp.expect('Storage: subir a la carpeta propia', 'OK',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'insert into storage.objects (bucket_id, name) values (''submissions'', %L) returning 1', v_ana_path)));
  perform pg_temp.expect('Storage: subir a la carpeta de otro usuario', 'new row violates row-level security',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'insert into storage.objects (bucket_id, name) values (''submissions'', %L) returning 1',
      format('%s/%s/%s.webp', v_round, c_beto, gen_random_uuid()))));
  perform pg_temp.expect('Storage: subir a una competencia que no es la actual', 'new row violates row-level security',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'insert into storage.objects (bucket_id, name) values (''submissions'', %L) returning 1',
      format('%s/%s/%s.webp', gen_random_uuid(), c_ana, gen_random_uuid()))));
  perform pg_temp.expect('Storage: otro dominio no puede subir', 'new row violates row-level security',
    pg_temp.run_as('intruso@gmail.com', c_intruso, format(
      'insert into storage.objects (bucket_id, name) values (''submissions'', %L) returning 1',
      format('%s/%s/%s.webp', v_round, c_intruso, gen_random_uuid()))));
  perform pg_temp.expect('Storage: otro dominio no ve archivos', 'OK:0',
    pg_temp.run_as('intruso@gmail.com', c_intruso, 'select count(*) from storage.objects where bucket_id = ''submissions'''));

  v_beto_path := format('%s/%s/%s.webp', v_round, c_beto, gen_random_uuid());
  perform pg_temp.run_as('beto.prueba@grupokelsoft.com', c_beto, format(
    'insert into storage.objects (bucket_id, name) values (''submissions'', %L) returning 1', v_beto_path));

  -- ===== Publicaciones =====
  perform pg_temp.expect('Publicar: título vacío', 'INVALID_TITLE',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'select public.create_submission(''   '', %L, 100, 100)', v_ana_path)));
  perform pg_temp.expect('Publicar: título de 81 caracteres', 'INVALID_TITLE',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'select public.create_submission(%L, %L, 100, 100)', repeat('a', 81), v_ana_path)));
  perform pg_temp.expect('Publicar: ruta en la carpeta de otro usuario', 'INVALID_PATH',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'select public.create_submission(''Hola'', %L, 100, 100)', v_beto_path)));
  perform pg_temp.expect('Publicar: archivo que no existe en Storage', 'INVALID_PATH',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'select public.create_submission(''Hola'', %L, 100, 100)',
      format('%s/%s/%s.webp', v_round, c_ana, gen_random_uuid()))));

  v_out := pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
    'select public.create_submission(%L, %L, 1920, 1200)', repeat('a', 80), v_ana_path));
  perform pg_temp.expect('Publicar: primera publicación (título de 80)', 'OK:', v_out);
  v_ana_sub := (select id from public.submissions where user_id = c_ana and round_id = v_round);

  perform pg_temp.expect('Publicar: segunda publicación', 'ALREADY_SUBMITTED',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'select public.create_submission(''Otra'', %L, 100, 100)', v_ana_path)));

  perform pg_temp.run_as('beto.prueba@grupokelsoft.com', c_beto, format(
    'select public.create_submission(''Foto de Beto'', %L, 800, 500)', v_beto_path));
  v_beto_sub := (select id from public.submissions where user_id = c_beto and round_id = v_round);
  perform pg_temp.expect('Publicar: beto también publica', 'true', (v_beto_sub is not null)::text);

  -- ===== Votos =====
  perform pg_temp.expect('Votar: la propia publicación', 'OWN_SUBMISSION',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Votar: publicación inexistente', 'NO_SUBMISSION',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.cast_vote(%L)', gen_random_uuid())));
  perform pg_temp.expect('Votar: 1.er voto de carla (sin publicación propia) a ana', 'OK',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Votar: 2.º voto de carla a ana', 'OK',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Votar: 3.er voto de carla a ana', 'OK',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Votar: 4.º voto de carla', 'NO_VOTES_LEFT',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.cast_vote(%L)', v_beto_sub)));
  perform pg_temp.expect('Votar: quitar un voto donde no votó', 'NO_VOTE_TO_REMOVE',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.remove_vote(%L)', v_beto_sub)));
  perform pg_temp.expect('Votar: quitar un voto a ana', 'OK',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.remove_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Votar: con el voto devuelto, votar a beto', 'OK',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.cast_vote(%L)', v_beto_sub)));
  perform pg_temp.expect('Votar: el admin participa y vota a beto', 'OK',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.cast_vote(%L)', v_beto_sub)));
  perform pg_temp.expect('Votar: beto vota a ana', 'OK',
    pg_temp.run_as('beto.prueba@grupokelsoft.com', c_beto, format('select public.cast_vote(%L)', v_ana_sub)));

  -- ana: 2 (carla) + 1 (beto) = 3; beto: 1 (carla) + 1 (admin) = 2
  perform pg_temp.expect('Tablón: votos de ana y beto (vista board como usuario)', 'OK:3,2',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'select string_agg(vote_count::text, '','' order by vote_count desc) from public.board where round_id = %L', v_round)));
  perform pg_temp.expect('Ver votantes: carla ×2 en ana (vista vote_details)', 'OK:Carla×2,Beto×1',
    pg_temp.run_as('beto.prueba@grupokelsoft.com', c_beto, format(
      'select string_agg(voter_name || ''×'' || vote_count, '','' order by vote_count desc) from public.vote_details where submission_id = %L',
      v_ana_sub)));

  -- ===== Editar el título conserva los votos =====
  perform pg_temp.expect('Editar título', 'OK',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select public.update_submission_title(''Título nuevo'')'));
  perform pg_temp.expect('Editar título: conserva los 3 votos', '3',
    (select count(*)::text from public.votes where submission_id = v_ana_sub));
  perform pg_temp.expect('Editar título: carla sin publicación', 'NO_SUBMISSION',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, 'select public.update_submission_title(''X'')'));

  -- ===== Reemplazar la imagen devuelve los votos =====
  v_ana_path2 := format('%s/%s/%s.webp', v_round, c_ana, gen_random_uuid());
  perform pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
    'insert into storage.objects (bucket_id, name) values (''submissions'', %L) returning 1', v_ana_path2));
  perform pg_temp.expect('Reemplazar imagen: devuelve la ruta anterior', 'OK:' || v_ana_path,
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'select public.replace_submission_image(%L, 1000, 625)', v_ana_path2)));
  perform pg_temp.expect('Reemplazar imagen: la publicación queda en 0 votos', '0',
    (select count(*)::text from public.votes where submission_id = v_ana_sub));
  perform pg_temp.expect('Reemplazar imagen: carla recupera 2 votos (le queda 1 usado)', '1',
    (select count(*)::text from public.votes where voter_id = c_carla and round_id = v_round));
  perform pg_temp.expect('Reemplazar imagen: beto recupera su voto', '0',
    (select count(*)::text from public.votes where voter_id = c_beto and round_id = v_round));
  perform pg_temp.expect('Reemplazar imagen: el título se conserva', 'Título nuevo',
    (select title from public.submissions where id = v_ana_sub));

  -- ===== Política de borrado en Storage =====
  -- (Supabase bloquea el DELETE directo sobre storage.objects; se habilita solo para probar la política)
  perform set_config('storage.allow_delete_query', 'true', true);
  perform pg_temp.expect('Storage: no puede borrar su archivo en uso', 'OK:0',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'with d as (delete from storage.objects where bucket_id = ''submissions'' and name = %L returning 1) select count(*) from d',
      v_ana_path2)));
  perform pg_temp.expect('Storage: no puede borrar archivos de otro', 'OK:0',
    pg_temp.run_as('beto.prueba@grupokelsoft.com', c_beto, format(
      'with d as (delete from storage.objects where bucket_id = ''submissions'' and name = %L returning 1) select count(*) from d',
      v_ana_path)));
  perform pg_temp.expect('Storage: borra su archivo reemplazado (sin referencia)', 'OK:1',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'with d as (delete from storage.objects where bucket_id = ''submissions'' and name = %L returning 1) select count(*) from d',
      v_ana_path)));

  -- ===== Borrar la propia publicación devuelve los votos =====
  perform pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.cast_vote(%L)', v_beto_sub));
  -- carla: 2 votos en beto
  perform pg_temp.expect('Borrar publicación: devuelve la ruta', 'OK:' || v_beto_path,
    pg_temp.run_as('beto.prueba@grupokelsoft.com', c_beto, 'select public.delete_my_submission()'));
  perform pg_temp.expect('Borrar publicación: carla recupera sus votos', '0',
    (select count(*)::text from public.votes where voter_id = c_carla and round_id = v_round));
  perform pg_temp.expect('Borrar publicación: el admin recupera su voto', '0',
    (select count(*)::text from public.votes where voter_id = c_admin and round_id = v_round));
  perform pg_temp.expect('Borrar publicación: sin publicación', 'NO_SUBMISSION',
    pg_temp.run_as('beto.prueba@grupokelsoft.com', c_beto, 'select public.delete_my_submission()'));

  -- beto vuelve a publicar
  v_beto_path2 := format('%s/%s/%s.webp', v_round, c_beto, gen_random_uuid());
  perform pg_temp.run_as('beto.prueba@grupokelsoft.com', c_beto, format(
    'insert into storage.objects (bucket_id, name) values (''submissions'', %L) returning 1', v_beto_path2));
  perform pg_temp.expect('Publicar de nuevo tras borrar', 'OK:',
    pg_temp.run_as('beto.prueba@grupokelsoft.com', c_beto, format(
      'select public.create_submission(''Beto otra vez'', %L, 800, 500)', v_beto_path2)));
  v_beto_sub := (select id from public.submissions where user_id = c_beto and round_id = v_round);

  -- ===== Empate: 2 votos cada uno =====
  perform pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.cast_vote(%L)', v_ana_sub));
  perform pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.cast_vote(%L)', v_beto_sub));
  perform pg_temp.run_as(c_admin_email, c_admin, format('select public.cast_vote(%L)', v_ana_sub));
  perform pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format('select public.cast_vote(%L)', v_beto_sub));
  perform pg_temp.expect('Ranking: los empates comparten posición', 'OK:1-2,1-2',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format(
      'select string_agg(position || ''-'' || vote_count, '','') from public.board where round_id = %L', v_round)));

  -- ===== Competencia cerrada =====
  perform pg_temp.expect('Admin: cerrar (open → closed)', 'OK',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.admin_set_round_status(''closed'')'));
  perform pg_temp.expect('Cerrada: no se puede votar', 'ROUND_NOT_OPEN',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Cerrada: no se puede quitar un voto', 'ROUND_NOT_OPEN',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format('select public.remove_vote(%L)', v_ana_sub)));
  perform pg_temp.expect('Cerrada: no se puede editar el título', 'ROUND_NOT_OPEN',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select public.update_submission_title(''Otro'')'));
  perform pg_temp.expect('Cerrada: no se puede borrar la publicación', 'ROUND_NOT_OPEN',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select public.delete_my_submission()'));
  perform pg_temp.expect('Cerrada: no se puede reemplazar la imagen', 'ROUND_NOT_OPEN',
    pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
      'select public.replace_submission_image(%L, 1, 1)', v_ana_path2)));
  perform pg_temp.expect('Cerrada: no se puede publicar', 'ROUND_NOT_OPEN',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format(
      'select public.create_submission(''Carla'', %L, 1, 1)', format('%s/%s/%s.webp', v_round, c_carla, gen_random_uuid()))));
  perform pg_temp.expect('Cerrada: no se puede subir a Storage', 'new row violates row-level security',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format(
      'insert into storage.objects (bucket_id, name) values (''submissions'', %L) returning 1',
      format('%s/%s/%s.webp', v_round, c_carla, gen_random_uuid()))));
  perform pg_temp.expect('Transición inválida: nueva competencia sin finalizar', 'INVALID_TRANSITION',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.admin_start_new_round(''Competencia 2'')'));

  -- ===== Reabrir =====
  perform pg_temp.expect('Admin: reabrir (closed → open)', 'OK',
    pg_temp.run_as(c_admin_email, c_admin, 'select public.admin_set_round_status(''open'')'));
  perform pg_temp.expect('Reabierta: se puede volver a votar', 'OK',
    pg_temp.run_as('beto.prueba@grupokelsoft.com', c_beto, format('select public.cast_vote(%L)', v_ana_sub)));
  perform pg_temp.run_as(c_admin_email, c_admin, 'select public.admin_set_round_status(''closed'')');

  -- ===== Finalizar =====
  perform pg_temp.expect('Finalizar: ganador de otra competencia', 'INVALID_WINNER',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_finalize_round(%L)', gen_random_uuid())));
  perform pg_temp.expect('Finalizar: elegir a beto aunque ana tenga más votos', 'OK',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_finalize_round(%L)', v_beto_sub)));
  perform pg_temp.expect('Finalizar: estado y ganador', 'finalized/' || v_beto_sub,
    (select status || '/' || winner_submission_id from public.rounds where id = v_round));

  -- ===== Admin borra la publicación ganadora: vuelve a 'closed' y los votos se devuelven =====
  perform pg_temp.expect('Admin borra la ganadora: devuelve la ruta', 'OK:' || v_beto_path2,
    pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_delete_submission(%L)', v_beto_sub)));
  perform pg_temp.expect('Admin borra la ganadora: la competencia vuelve a closed sin ganador', 'closed/',
    (select status || '/' || coalesce(winner_submission_id::text, '') from public.rounds where id = v_round));
  perform pg_temp.expect('Admin borra la ganadora: ana y carla recuperan sus votos en beto', '0',
    (select count(*)::text from public.votes where submission_id = v_beto_sub));
  perform pg_temp.expect('Storage: el admin puede borrar cualquier archivo', 'OK:1',
    pg_temp.run_as(c_admin_email, c_admin, format(
      'with d as (delete from storage.objects where bucket_id = ''submissions'' and name = %L returning 1) select count(*) from d',
      v_beto_path2)));

  -- ===== Nueva competencia: archiva la finalizada =====
  perform pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_finalize_round(%L)', v_ana_sub));
  v_out := pg_temp.run_as(c_admin_email, c_admin, 'select public.admin_start_new_round(''Competencia 2'')');
  perform pg_temp.expect('Nueva competencia: se crea', 'OK:', v_out);
  v_round2 := (select id from public.rounds where status <> 'archived');
  perform pg_temp.expect('Nueva competencia: la anterior queda archivada con ganador y votos', 'archived/' || v_ana_sub || '/3',
    (select r.status || '/' || r.winner_submission_id || '/' || (select count(*) from public.votes v where v.round_id = r.id)
       from public.rounds r where r.id = v_round));
  perform pg_temp.expect('Nueva competencia: la nueva nace preparada', 'pending',
    (select status::text from public.rounds where id = v_round2));
  perform pg_temp.expect('Historial: un usuario ve la competencia archivada', 'OK:1',
    pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format(
      'select count(*) from public.board where round_id = %L', v_round)));
  perform pg_temp.expect('Historial: el admin no puede borrar publicaciones archivadas', 'NO_SUBMISSION',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_delete_submission(%L)', v_ana_sub)));

  -- ===== Borrar del historial =====
  perform pg_temp.expect('Historial: borrar una competencia no archivada', 'ROUND_NOT_ARCHIVED',
    pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_delete_archived_round(%L)', v_round2)));
  perform pg_temp.expect('Historial: borrar la competencia archivada (con ganador)', 'OK:' || v_round,
    pg_temp.run_as(c_admin_email, c_admin, format('select public.admin_delete_archived_round(%L)', v_round)));
  perform pg_temp.expect('Historial: se borran sus publicaciones y votos', '0/0',
    (select (select count(*) from public.submissions where round_id = v_round) || '/' ||
            (select count(*) from public.votes where round_id = v_round)));

  -- ===== Reinicio total =====
  perform pg_temp.run_as(c_admin_email, c_admin, 'select public.admin_set_round_status(''open'')');
  v_carla_path := format('%s/%s/%s.webp', v_round2, c_carla, gen_random_uuid());
  perform pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format(
    'insert into storage.objects (bucket_id, name) values (''submissions'', %L) returning 1', v_carla_path));
  perform pg_temp.run_as('carla.prueba@grupokelsoft.com', c_carla, format(
    'select public.create_submission(''Carla'', %L, 10, 10)', v_carla_path));
  perform pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, format(
    'select public.cast_vote(%L)', (select id from public.submissions where round_id = v_round2)));
  perform pg_temp.expect('Reinicio total: devuelve el id borrado', 'OK:' || v_round2,
    pg_temp.run_as(c_admin_email, c_admin, 'select public.admin_hard_reset(''Competencia nueva'')'));
  perform pg_temp.expect('Reinicio total: sin publicaciones ni votos, sin historial', '0/0/0',
    (select (select count(*) from public.submissions where round_id = v_round2) || '/' ||
            (select count(*) from public.votes where round_id = v_round2) || '/' ||
            (select count(*) from public.rounds where id = v_round2)));
  perform pg_temp.expect('Reinicio total: hay una competencia nueva en preparada', '1/pending',
    (select count(*) || '/' || min(status::text) from public.rounds where status <> 'archived'));
end $$;

select n, ok, caso, esperado, obtenido from results order by n;

rollback;
