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

- Cada cambio es una migración en `supabase/migrations/000N_nombre.sql`. Nunca se modifica la base fuera de migraciones.
- El repo está vinculado (`supabase link`) y el historial remoto usa las mismas versiones `000N` que los archivos. Para aplicar: `npx supabase db push --dry-run` y luego `npx supabase db push`.
- Si se aplica con el MCP (`apply_migration`), el MCP registra otra versión: hay que alinear después con `npx supabase migration repair` (revertir la versión del MCP y marcar `000N` como aplicada). El MCP rechaza solo las migraciones que contienen `delete`.
- Las reglas se prueban con `npx supabase db query --linked -f supabase/tests/rules.sql -o json` (transacción con `rollback`; todos los casos deben dar `ok = true`).
- Antes de cualquier acción destructiva, preguntar.

## Decisiones tomadas (además de la especificación)

- Dominio bloqueado con **ambos**: Auth Hook "Before User Created" y trigger `before insert` en `auth.users`.
- Storage: un usuario solo puede borrar archivos de su carpeta que **ninguna publicación referencia**; el admin puede borrar cualquiera.
- Si el admin borra la publicación ganadora de una competencia finalizada, la competencia vuelve a `closed` para elegir otro ganador.
- Los parámetros de las RPC llevan prefijo `p_` (por ejemplo `cast_vote({ p_submission_id })`).
- Botón de peligro con texto en `ink` (no blanco): blanco sobre `danger` no cumple AA.
- "Mi publicación" es un cajón lateral que arranca oculto (ver la especificación). Los diálogos y el lightbox se montan con portal en `<body>`, porque dentro del cajón (con `transform`) un `position: fixed` queda atrapado.
- Encabezado: fichas de voto + "Te quedan N de 3 votos". "Participantes con sesión" = cantidad de perfiles. Ruta `/estilos` solo para el admin.

## Comandos

- `npm run dev`, `npm run build`, `npm run lint`, `npm test`
- Al terminar cada fase: build + lint + tests, commit y marcar la fase en la especificación.
