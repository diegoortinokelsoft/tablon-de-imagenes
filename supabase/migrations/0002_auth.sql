-- 0002_auth: dominio permitido, administrador, competencia actual, hook de dominio y trigger de perfiles.

-- Un email es válido si termina en @grupokelsoft.com (con una sola @).
create function public.is_allowed_email(p_email text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(lower(p_email) ~ '^[^@]+@grupokelsoft\.com$', false)
$$;

-- Verdadero solo si el email del JWT es del dominio permitido. Todas las políticas y RPC lo exigen.
create function public.is_allowed_user() returns boolean
language sql stable set search_path = '' as $$
  select public.is_allowed_email(auth.jwt() ->> 'email')
$$;

-- Verdadero si el email del JWT está en public.admins.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(auth.jwt() ->> 'email')
  )
$$;

-- La competencia actual (la única no archivada). Solo para uso interno de las RPC.
create function public.current_round() returns public.rounds
language sql stable security definer set search_path = '' as $$
  select * from public.rounds where status <> 'archived' limit 1
$$;

revoke execute on function public.is_allowed_email(text) from public, anon;
revoke execute on function public.is_allowed_user() from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.current_round() from public, anon, authenticated;
grant execute on function public.is_allowed_email(text) to authenticated;
grant execute on function public.is_allowed_user() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Auth Hook "Before User Created": rechaza emails de otros dominios.
-- Se conecta en el panel: Authentication → Hooks → Before User Created.
create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
begin
  if public.is_allowed_email(event -> 'user' ->> 'email') then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Solo pueden ingresar cuentas @grupokelsoft.com'
    )
  );
end $$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
grant execute on function public.is_allowed_email(text) to supabase_auth_admin;
grant usage on schema public to supabase_auth_admin;

-- Respaldo del hook: aunque el hook no esté activado, nunca se crea un usuario de otro dominio.
create function public.enforce_allowed_domain() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_allowed_email(new.email) then
    raise exception 'NOT_ALLOWED';
  end if;
  return new;
end $$;

create trigger enforce_allowed_domain
  before insert or update of email on auth.users
  for each row execute function public.enforce_allowed_domain();

-- Crea o actualiza el perfil con el nombre y el avatar de Google.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.enforce_allowed_domain() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
