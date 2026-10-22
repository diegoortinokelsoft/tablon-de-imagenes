# Tablón de Imágenes

Competencia interna de imágenes de Grupo Kelsoft. SPA (React + Vite + TS) servida por Netlify que habla directo con Supabase.

**Fuente de verdad:** [docs/especificacion.md](docs/especificacion.md). Si algo no está definido o hay una contradicción, se pregunta antes de suponer.

## Reglas que nunca se rompen

1. **Toda escritura por RPC.** Las tablas solo admiten `select`; insertar, actualizar o borrar datos se hace siempre con funciones RPC `security definer`, `set search_path = ''` y nombres totalmente calificados. El frontend nunca usa `.insert()`, `.update()`, `.upsert()` ni `.delete()` sobre tablas.
2. **RLS en todas las tablas.** RLS activo en las cinco tablas, sin políticas de `insert`/`update`/`delete`. `admins` no tiene políticas.
3. **Restricción de dominio.** Solo cuentas `@grupokelsoft.com`. Toda política y toda RPC exige `public.is_allowed_user()`; las de administración además `public.is_admin()`.
4. **Nada de `service_role` en el frontend.** Solo la clave pública (`VITE_SUPABASE_ANON_KEY`).
5. **Textos de la UI en español.** Los errores de RPC se traducen en `src/lib/errors.ts`.
6. **Solo tokens de la guía de estilo.** Colores, fuentes, radios y sombras salen de `tailwind.config.ts`; clases reutilizables en `src/styles/components.css`. No se inventan colores ni tamaños.

## Base de datos

- Cada cambio es una migración en `supabase/migrations/000N_nombre.sql`, aplicada con el MCP de Supabase (`apply_migration`). Nunca se modifica la base fuera de migraciones.
- Los archivos del repo son la fuente de verdad. Las versiones registradas por el MCP no coinciden con los nombres `000N`, así que no se usa `supabase db push` sin antes `supabase migration repair`.
- Las reglas se prueban con `supabase/tests/rules.sql` (transacción con `rollback`).
- Antes de cualquier acción destructiva, preguntar.

## Decisiones tomadas (además de la especificación)

- Dominio bloqueado con **ambos**: Auth Hook "Before User Created" y trigger `before insert` en `auth.users`.
- Storage: un usuario solo puede borrar archivos de su carpeta que **ninguna publicación referencia**; el admin puede borrar cualquiera.
- Si el admin borra la publicación ganadora de una competencia finalizada, la competencia vuelve a `closed` para elegir otro ganador.
- Los parámetros de las RPC llevan prefijo `p_` (por ejemplo `cast_vote({ p_submission_id })`).
- Encabezado: fichas de voto + "Te quedan N de 3 votos". "Participantes con sesión" = cantidad de perfiles. Ruta `/estilos` solo para el admin.

## Comandos

- `npm run dev`, `npm run build`, `npm run lint`, `npm test`
- Al terminar cada fase: build + lint + tests, commit y marcar la fase en la especificación.
