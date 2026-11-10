<!--
Informe de sincronización
- Versión: plantilla → 1.0.0 (primera ratificación, generada con /speckit-brownfield-bootstrap)
- Principios: I–VI tomados de "Reglas que nunca se rompen" de CLAUDE.md
- Secciones agregadas: Fuente de verdad, Arquitectura y límites del código, Convenciones,
  Tests, Puertas de calidad, Flujo de trabajo, Gobernanza
- Plantillas alineadas: spec-template.md, plan-template.md, tasks-template.md
-->

# Constitución del Tablón de Imágenes

Competencias internas de imágenes de Grupo Kelsoft. SPA en React + Vite + TypeScript, servida por
Netlify, que habla directo con Supabase (Postgres, Auth, Storage y Realtime). No hay servidor propio:
la lógica de negocio y la seguridad viven en Postgres (RLS y funciones RPC).

## Principios fundamentales (no negociables)

### I. Toda escritura por RPC

Las tablas solo admiten `select`. Insertar, actualizar o borrar datos se hace siempre con funciones
RPC `security definer`, `set search_path = ''`, nombres totalmente calificados (`public.tabla`,
`auth.uid()`) y parámetros con prefijo `p_`. El frontend MUST NOT usar `.insert()`, `.update()`,
`.upsert()` ni `.delete()` sobre tablas.

### II. RLS en todas las tablas

Toda tabla MUST tener RLS activo, sin políticas de `insert`, `update` ni `delete`. `admins` y
`round_deletions` no tienen políticas. Una tabla nueva revoca los privilegios de escritura a `anon` y
`authenticated`, como en `0003_rls.sql`.

### III. Restricción de dominio y acceso

Solo cuentas `@grupokelsoft.com` (bloqueado con el Auth Hook "Before User Created" y con el trigger
`before insert` en `auth.users`). Toda política y toda RPC MUST exigir `public.is_allowed_user()`. El
contenido de una competencia (publicaciones, votos, imágenes) exige `public.can_view_round(id)`;
gestionarla exige ser su dueño; las RPC del superadmin exigen `public.is_admin()`.

### IV. Nada de `service_role` en el frontend

El frontend solo usa claves públicas: `VITE_SUPABASE_ANON_KEY` y `VITE_GOOGLE_CLIENT_ID` (esta última
opcional).

### V. Textos de la UI en español

Toda la UI está en español. Cada código de error de RPC (`raise exception 'CODIGO'`) MUST tener su
mensaje en español en `ERROR_MESSAGES` (`src/lib/errors.ts`).

### VI. Solo tokens de la guía de estilo

Colores, fuentes, radios y sombras salen de `tailwind.config.ts`; las clases reutilizables, de
`src/styles/components.css`. No se inventan colores ni tamaños. El canvas de `src/lib/resultImage.ts`
replica los colores y un test verifica que coincidan.

## Fuente de verdad

- `docs/especificacion-v2.md` es la fuente de verdad del sistema; `docs/especificacion.md` (v1) queda
  como referencia de lo que no cambió.
- Las specs de `specs/NNN-nombre/` **complementan** a la especificación v2, no la reemplazan: cada spec
  describe solo su cambio y cita las secciones de la v2 que toca.
- Al cerrar una feature MUST actualizarse `docs/especificacion-v2.md`, y también `docs/supabase.md`,
  `docs/frontend.md`, `README.md` o `CLAUDE.md` si el cambio los afecta.
- Si algo no está definido o hay una contradicción entre la spec, la especificación v2 o el código, se
  pregunta antes de suponer.

## Arquitectura y límites del código

| Capa | Ruta | Responsabilidad |
|---|---|---|
| Páginas | `src/pages/` | Una pantalla por ruta (`src/router.tsx`) |
| Componentes | `src/components/` | UI; diálogos y lightbox montados con portal en `<body>` |
| Hooks | `src/hooks/` | Consultas y mutaciones de TanStack Query, suscripciones de Realtime |
| Lógica y servicios | `src/lib/` | Llamadas a `supabase.rpc` y Storage, lógica pura, errores, tipos generados |
| Estilos | `tailwind.config.ts`, `src/styles/` | Tokens y clases reutilizables |
| Base de datos | `supabase/migrations/000N_*.sql` | Esquema, RLS, RPC, Storage, Realtime |
| Pruebas de la base | `supabase/tests/rules.sql` | Reglas de RLS y RPC |

- Las dependencias van en un solo sentido: `pages` → `components` → `hooks` → `lib` → Supabase.
  Solo `src/lib/` llama a `supabase.rpc` y a Storage.
- `src/lib/database.types.ts` se genera con `npm run types`; no se edita a mano.
- Cada cambio de base es una migración nueva. Nunca se edita una migración ya aplicada ni se modifica la
  base fuera de migraciones. El procedimiento está en el skill `cambio-base-de-datos` y en
  `docs/supabase.md` (sección 8).
- Storage no se borra desde SQL: una RPC que elimina algo con imagen devuelve la ruta o el id para que
  el cliente borre el archivo.
- Antes de cualquier acción destructiva (sobre datos, migraciones o Storage), se pregunta.

## Convenciones

- Componentes y páginas: PascalCase `.tsx` (`HubCard.tsx`, `RoundPage.tsx`).
- Hooks: `useNombre.ts`. Lógica en `src/lib/`: camelCase `.ts` (`resultImage.ts`).
- Tests: `*.test.ts` junto al archivo que prueban, en `src/lib/`.
- Migraciones: `000N_snake_case.sql`, con un comentario inicial en español de qué hace.
- Errores de RPC: `raise exception 'CODIGO_EN_MAYUSCULAS';`, sin texto adicional.
- Specs, planes, tareas, comentarios y documentación en español.

## Tests

- **Vitest** (`npm test`, entorno node, `src/**/*.test.ts`) para la lógica pura de `src/lib/`. Toda
  lógica nueva en `src/lib/` que no sea una llamada directa a Supabase MUST tener tests.
- Cada código de error nuevo MUST tener su caso en `src/lib/errors.test.ts`.
- Cada RPC nueva o modificada MUST tener casos en `supabase/tests/rules.sql`, según su rol:
  - el camino feliz;
  - cada error propio de la RPC;
  - `NOT_ALLOWED` (dominio ajeno), siempre;
  - además, `NOT_OWNER` si es una RPC del dueño, o `NOT_ADMIN` si es una RPC del superadmin.
- Un cambio en una política de RLS o de Storage MUST tener casos que prueben que quien no tiene acceso
  no ve ni escribe nada.
- No hay tests de componentes; la UI se verifica a mano en `npm run dev`.

## Puertas de calidad

No hay CI. Antes de cerrar cada fase se corren a mano, y todas MUST pasar:

1. `npm test`
2. `npm run lint`
3. `npm run build`
4. Si la fase tiene migraciones: `npx supabase db push --dry-run` (debe listar solo las migraciones
   nuevas) y `npx supabase db query --linked -f supabase/tests/rules.sql -o json` con todos los casos en
   `ok = true`. Una migración se puede ensayar antes de aplicarla con `begin;` + la migración + el
   cuerpo de `rules.sql` + `rollback;`.

## Flujo de trabajo

- Se trabaja por fases. Al cerrar cada fase: puertas de calidad, commit y marcar la fase como hecha
  (en `tasks.md` y, al cerrar la feature, en `docs/especificacion-v2.md`).
- Commits en español con el estilo actual del repo (por ejemplo "Fase N: …", "Arreglo: …"). No se usa
  Conventional Commits.
- Las ramas de feature las crea spec-kit con el formato `NNN-nombre`.

## Gobernanza

- Esta constitución y `CLAUDE.md` deben decir lo mismo. Si cambia una regla en uno, se actualiza el
  otro en el mismo commit.
- `/speckit-plan` verifica la constitución en "Constitution Check"; una violación se justifica en
  "Seguimiento de complejidad" o se corrige.
- Enmiendas: versión semántica. MAJOR si se quita o redefine un principio; MINOR si se agrega un
  principio o sección; PATCH para aclaraciones.

**Versión**: 1.0.0 | **Ratificada**: 2026-11-10 | **Última enmienda**: 2026-11-10
