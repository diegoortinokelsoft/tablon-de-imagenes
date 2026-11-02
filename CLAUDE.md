# Tablón de Imágenes

Competencias internas de imágenes de Grupo Kelsoft. SPA (React + Vite + TS) servida por Netlify que habla directo con Supabase. Desde la v2 hay muchas competencias a la vez, cada una con dueño y visibilidad (pública para el dominio o privada).

**Fuente de verdad:** [docs/especificacion-v2.md](docs/especificacion-v2.md) (la v1, [docs/especificacion.md](docs/especificacion.md), queda como referencia de lo que no cambió). Si algo no está definido o hay una contradicción, se pregunta antes de suponer.

## Reglas que nunca se rompen

1. **Toda escritura por RPC.** Las tablas solo admiten `select`; insertar, actualizar o borrar datos se hace siempre con funciones RPC `security definer`, `set search_path = ''` y nombres totalmente calificados. El frontend nunca usa `.insert()`, `.update()`, `.upsert()` ni `.delete()` sobre tablas.
2. **RLS en todas las tablas.** RLS activo en las diez tablas, sin políticas de `insert`/`update`/`delete`. `admins` y `round_deletions` no tienen políticas.
3. **Restricción de dominio y acceso.** Solo cuentas `@grupokelsoft.com`. Toda política y toda RPC exige `public.is_allowed_user()`. El contenido de una competencia (publicaciones, votos, imágenes) exige `public.can_view_round(id)`; gestionarla, ser su dueño; las RPC del superadmin, `public.is_admin()`.
4. **Nada de `service_role` en el frontend.** Solo la clave pública (`VITE_SUPABASE_ANON_KEY`). `VITE_GOOGLE_CLIENT_ID` también es pública.
5. **Textos de la UI en español.** Los errores de RPC se traducen en `src/lib/errors.ts`.
6. **Solo tokens de la guía de estilo.** Colores, fuentes, radios y sombras salen de `tailwind.config.ts`; clases reutilizables en `src/styles/components.css`. No se inventan colores ni tamaños. El canvas de la imagen del resultado replica los colores en `src/lib/resultImage.ts`, y un test verifica que coincidan.

## Base de datos

- Cada cambio es una migración en `supabase/migrations/000N_nombre.sql`. Nunca se modifica la base fuera de migraciones.
- El repo está vinculado (`supabase link`) y el historial remoto usa las mismas versiones `000N` que los archivos. Para aplicar: `npx supabase db push --dry-run` y luego `npx supabase db push`.
- Si se aplica con el MCP (`apply_migration`), el MCP registra otra versión: hay que alinear después con `npx supabase migration repair` (revertir la versión del MCP y marcar `000N` como aplicada). El MCP rechaza solo las migraciones que contienen `delete`.
- Las reglas se prueban con `npx supabase db query --linked -f supabase/tests/rules.sql -o json` (transacción con `rollback`; todos los casos deben dar `ok = true`). Una migración nueva se puede ensayar antes de aplicarla: `begin;` + la migración + el cuerpo de `rules.sql` + `rollback;` (ver `docs/supabase.md`, sección 8).
- No hay Docker: `db dump` no funciona. Los respaldos se hacen exportando cada tabla a JSON con `db query`.
- Antes de cualquier acción destructiva, preguntar.

## Decisiones tomadas (además de la especificación)

- Dominio bloqueado con **ambos**: Auth Hook "Before User Created" y trigger `before insert` en `auth.users`.
- Storage: el superadmin puede borrar cualquier archivo. Los demás solo archivos que **ninguna publicación referencia**: el usuario en su carpeta, y el dueño (o quien borró la competencia, según `round_deletions`) en toda la carpeta de ella.
- Si el dueño o el superadmin borra la publicación ganadora de una competencia finalizada, la competencia vuelve a `closed` para elegir otro ganador.
- El superadmin modera pero no gestiona competencias ajenas: en `/c/:id/gestion` ve el modo "Moderar" (borrar publicaciones o la competencia), sin estados, visibilidad ni miembros.
- Los parámetros de las RPC llevan prefijo `p_` (por ejemplo `cast_vote({ p_submission_id })`).
- Botón de peligro con texto en `ink` (no blanco): blanco sobre `danger` no cumple AA.
- "Mi publicación" es un cajón lateral: al entrar arranca desplegado sin publicación y oculto con publicación (ver la especificación v1). Los diálogos y el lightbox se montan con portal en `<body>`, porque dentro del cajón (con `transform`) un `position: fixed` queda atrapado.
- Encabezado: dentro de una competencia, fichas de voto + "Te quedan N de 3 votos" y "Gestionar" (con el contador de solicitudes) o "Moderar". "Participantes" en el panel = quienes publicaron o votaron. Ruta `/estilos` solo para el superadmin.
- La ruta pedida sin sesión se recuerda en `sessionStorage` y se retoma al volver de Google (así funciona un enlace de invitación sin sesión). Solo rutas internas.
- `VITE_GOOGLE_CLIENT_ID` es opcional: sin ella, el panel del superadmin solo ofrece descargar el ZIP.

## Comandos

- `npm run dev`, `npm run build`, `npm run lint`, `npm test`, `npm run types`
- Al terminar cada fase: build + lint + tests, commit y marcar la fase en la especificación.
