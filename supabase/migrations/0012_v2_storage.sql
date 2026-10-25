-- 0012_v2_storage: políticas de storage.objects para competencias múltiples.
-- La ruta no cambia: {round_id}/{user_id}/{uuid}.webp. La política de subida se borró en 0008.

-- Auxiliar: convierte la primera carpeta en uuid, o null si no es válida.
create function public.try_uuid(p_text text) returns uuid
language sql immutable set search_path = '' as $$
  select case
    when p_text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    then p_text::uuid
  end
$$;

-- Verdadero si el usuario puede listar y limpiar la carpeta de una competencia:
-- el superadmin, el dueño, o quien la borró (para limpiar lo que quedó).
create function public.can_manage_round_files(p_round_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_allowed_user() and (
    public.is_admin()
    or exists (select 1 from public.rounds r where r.id = p_round_id and r.owner_id = auth.uid())
    or exists (select 1 from public.round_deletions d where d.round_id = p_round_id and d.deleted_by = auth.uid())
  )
$$;

revoke execute on function public.try_uuid(text) from public, anon;
revoke execute on function public.can_manage_round_files(uuid) from public, anon;
grant execute on function public.try_uuid(text) to authenticated;
grant execute on function public.can_manage_round_files(uuid) to authenticated;

drop policy "submissions: lectura del dominio" on storage.objects;
drop policy "submissions: borrar" on storage.objects;

-- Leer (y firmar URLs): quien tiene acceso a la competencia, o quien puede limpiar sus archivos.
create policy "submissions: lectura con acceso" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'submissions'
    and (select public.is_allowed_user())
    and (
      public.can_view_round(public.try_uuid((storage.foldername(objects.name))[1]))
      or public.can_manage_round_files(public.try_uuid((storage.foldername(objects.name))[1]))
    )
  );

-- Subir: solo en su propia carpeta, en una competencia abierta, sin limpiar y con acceso.
create policy "submissions: subir en una competencia abierta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'submissions'
    and (select public.is_allowed_user())
    and (storage.foldername(objects.name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.rounds r
      where r.id = public.try_uuid((storage.foldername(objects.name))[1])
        and r.status = 'open'
        and r.cleaned_at is null
    )
    and public.can_view_round(public.try_uuid((storage.foldername(objects.name))[1]))
  );

-- Borrar: el superadmin, cualquier archivo. Los demás, solo archivos que ninguna publicación referencia
-- (subida fallida, imagen reemplazada, publicación o competencia borrada): el usuario en su carpeta,
-- y el dueño o quien borró la competencia en toda la carpeta de ella. Así nadie rompe una imagen en uso.
create policy "submissions: borrar" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (select public.is_allowed_user())
    and (
      (select public.is_admin())
      or (
        not exists (
          select 1 from public.submissions s
          where s.image_path = objects.name
        )
        and (
          (storage.foldername(objects.name))[2] = (select auth.uid())::text
          or public.can_manage_round_files(public.try_uuid((storage.foldername(objects.name))[1]))
        )
      )
    )
  );

-- Sin política de update: los archivos nunca se sobrescriben.
