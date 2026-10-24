# Tablón de Imágenes

Competencia interna de imágenes de Grupo Kelsoft. SPA (React + Vite + TS) servida por Netlify que habla directo con Supabase. Cada persona sube una imagen y reparte 3 votos; el admin controla la competencia y elige al ganador.

## Estado actual

- **En producción** (Netlify + Supabase `yirwqhiposuizeuxpeqw`) desde octubre de 2026. Las 10 fases del plan de la especificación están completas, más el cajón desplegable "Mi publicación".
- **Ramas:** `main` = producción (Netlify despliega desde ahí). Se trabaja en `Develop` y se integra a `main` con un PR.
- El primer administrador es `diego.martin.ortino@grupokelsoft.com`, que también participa como usuario.

## Documentación (leer antes de cambiar algo)

| Documento | Para qué |
| --- | --- |
| [docs/especificacion.md](docs/especificacion.md) | **Fuente de verdad** funcional. Si algo no está definido o hay una contradicción, se pregunta antes de suponer. |
| [docs/supabase.md](docs/supabase.md) | Modelo de datos, RPC, RLS, Storage, Realtime, migraciones, `rules.sql`, operación |
| [docs/frontend.md](docs/frontend.md) | Arquitectura, datos, tiempo real, UX por pantalla, cajón, sistema de diseño |
| [README.md](README.md) | Puesta en marcha y configuración manual (Google Cloud, Supabase, Netlify) |

Skill del proyecto: **`cambio-base-de-datos`** ([.claude/skills/cambio-base-de-datos/SKILL.md](.claude/skills/cambio-base-de-datos/SKILL.md)). Úsala para cualquier cambio en `supabase/` (migraciones, RPC, políticas, códigos de error, admins).

## Reglas que nunca se rompen

1. **Toda escritura por RPC.** Las tablas solo admiten `select`; insertar, actualizar o borrar datos se hace siempre con funciones RPC `security definer`, `set search_path = ''` y nombres totalmente calificados. El frontend nunca usa `.insert()`, `.update()`, `.upsert()` ni `.delete()` sobre tablas.
2. **RLS en todas las tablas.** RLS activo en las cinco tablas, sin políticas de `insert`/`update`/`delete`. `admins` no tiene políticas.
3. **Restricción de dominio.** Solo cuentas `@grupokelsoft.com`. Toda política y toda RPC exige `public.is_allowed_user()`; las de administración además `public.is_admin()`.
4. **Nada de `service_role` en el frontend.** Solo la clave pública (`VITE_SUPABASE_ANON_KEY`).
5. **Textos de la UI en español.** Los errores de RPC se traducen en `src/lib/errors.ts`.
6. **Solo tokens de la guía de estilo.** Colores, fuentes, radios y sombras salen de `tailwind.config.ts`; clases reutilizables en `src/styles/components.css`. No se inventan colores ni tamaños.

## Base de datos

- Cada cambio es una migración nueva `supabase/migrations/000N_nombre.sql` (hoy van de `0001` a `0007`). Nunca se modifica la base fuera de migraciones ni se editan migraciones aplicadas.
- El repo está vinculado y el historial remoto usa las mismas versiones `000N` que los archivos. Para aplicar: `npx supabase db push --dry-run`, `npx supabase db push` y después `npm run types`.
- No usar `apply_migration` del MCP para migraciones con `delete`: las rechaza. Si se usa el MCP, alinear con `npx supabase migration repair` (ver [docs/supabase.md §8](docs/supabase.md#8-migraciones)).
- Las reglas se prueban con `npx supabase db query --linked -f supabase/tests/rules.sql -o json` (110 casos, transacción con `rollback`; todos deben dar `ok = true`).
- Antes de cualquier acción destructiva (sobre datos o en producción), preguntar.

## Decisiones tomadas (además de la especificación)

- Dominio bloqueado con **ambos**: Auth Hook "Before User Created" y trigger `before insert` en `auth.users`. En el panel, el proveedor Email está **desactivado**.
- Storage: un usuario solo puede borrar archivos de su carpeta que **ninguna publicación referencia**; el admin puede borrar cualquiera.
- Si el admin borra la publicación ganadora de una competencia finalizada, la competencia vuelve a `closed` para elegir otro ganador.
- Los parámetros de las RPC llevan prefijo `p_` (por ejemplo `cast_vote({ p_submission_id })`).
- Códigos de error agregados a la especificación: `INVALID_NAME` y `ROUND_NOT_ARCHIVED`.
- Botón de peligro con texto en `ink` (no blanco): blanco sobre `danger` no cumple AA.
- "Mi publicación" es un cajón lateral: al entrar arranca desplegado sin publicación y oculto con publicación. Los diálogos y el lightbox se montan con portal en `<body>`, porque dentro del cajón (con `transform`) un `position: fixed` queda atrapado; **cualquier overlay nuevo que pueda abrirse desde el cajón debe usar portal**.
- Encabezado: fichas de voto + "Te quedan N de 3 votos" (en móvil solo las fichas). "Participantes con sesión" = cantidad de perfiles. Ruta `/estilos` solo para el admin.

## Cómo retomar una sesión

1. `git status` y `git log --oneline -5` en `Develop`; confirmar que esté al día con `main`.
2. Leer el documento que corresponda al cambio (`docs/supabase.md` o `docs/frontend.md`).
3. Trabajar en `Develop`. Al terminar: `npm run build`, `npm run lint`, `npm test` (y `rules.sql` si se tocó la base), commit en español y avisar para el PR a `main`.
4. Si cambia una regla o un comportamiento visible, actualizar la especificación y el doc técnico correspondiente.

## Trampas conocidas del entorno

- **Windows + Git Bash.** Un heredoc de bash con apóstrofos dentro de comillas puede romper el comando entero y dejar archivos a medio escribir; para archivos de código usar la herramienta Write o Edit. Git avisa de LF→CRLF: es normal.
- **Salida de la CLI de Supabase:** puede agregar al final un aviso de versión nueva, después del JSON. Al parsear, cortar en la última `}`.
- **`npm run dev`:** si el puerto 5173 está ocupado, casi siempre es el servidor que ya dejó abierto la persona; no hace falta levantar uno nuevo (comparte la carpeta y tiene recarga en caliente).
- **Login en producción:** si falla con `{"error":"requested path is invalid"}`, revisar Site URL y Redirect URLs en Supabase (con `https://`).
- El MCP de Supabase puede estar desconectado; la CLI (`npx supabase`) alcanza para todo.

## Comandos

- `npm run dev` · `npm run build` · `npm run lint` · `npm test` · `npm run types`
- `npx supabase migration list` · `npx supabase db push` · `npx supabase db query --linked "<sql>"` · `npx supabase db advisors`
