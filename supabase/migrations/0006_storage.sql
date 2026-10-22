-- 0006_storage: bucket privado 'submissions' y políticas de storage.objects.
-- Ruta de cada archivo: {round_id}/{user_id}/{uuid}.webp

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Leer (y firmar URLs): cualquier usuario del dominio.
create policy "submissions: lectura del dominio" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (select public.is_allowed_user())
  );

-- Subir: solo en su propia carpeta y dentro de la competencia actual abierta.
create policy "submissions: subir en la competencia abierta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (select public.is_allowed_user())
    and (storage.foldername(objects.name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.rounds r
      where r.id::text = (storage.foldername(objects.name))[1]
        and r.status = 'open'
    )
  );

-- Borrar: el admin cualquier archivo; el usuario solo archivos de su carpeta que
-- ninguna publicación referencia (subida fallida, imagen reemplazada o publicación borrada).
create policy "submissions: borrar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (select public.is_allowed_user())
    and (
      (select public.is_admin())
      or (
        (storage.foldername(objects.name))[2] = (select auth.uid())::text
        and not exists (
          select 1 from public.submissions s
          where s.image_path = objects.name
        )
      )
    )
  );

-- Sin política de update: los archivos nunca se sobrescriben.
