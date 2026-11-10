# Plan de implementación: Importar miembros de otra competencia

**Rama**: `001-importar-miembros` | **Fecha**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Entrada**: Especificación de la feature en `/specs/001-importar-miembros/spec.md`

## Resumen

Desde la gestión de una competencia privada propia, el dueño elige otra privada suya y suma de una
vez a sus miembros; no hay duplicados, las solicitudes pendientes de quienes se suman quedan
aprobadas y el dueño ve cuántas personas se sumaron.

Enfoque: una RPC nueva `import_members(p_round_id, p_source_round_id) returns int` que, en una sola
sentencia, inserta las membresías que faltan con `on conflict do nothing`, aprueba las solicitudes
de los insertados y devuelve cuántos fueron. Sin cambios de esquema ni errores nuevos. En la UI, un
botón en "Miembros" abre el `ConfirmDialog` existente con la lista de orígenes, que se lee directo
de `rounds` con el conteo de miembros. Detalle en [research.md](research.md).

## Technical Context

**Lenguaje/Versión**: TypeScript ~5.8 (`strict`), SQL (PostgreSQL de Supabase, plpgsql)

**Dependencias principales**: React 18, React Router 6, TanStack Query 5, Tailwind 3, `@supabase/supabase-js` 2, lucide-react. Sin dependencias nuevas

**Almacenamiento**: Supabase Postgres (RLS + RPC `security definer`). Storage no se toca

**Tests**: Vitest 3 (`src/lib/labels.test.ts`) y `supabase/tests/rules.sql`

**Plataforma**: Navegador (SPA en Netlify)

**Tipo de proyecto**: SPA con Supabase como backend (sin servidor propio)

**Secciones de la especificación v2 afectadas**: "Alcance", "Acceso a competencias privadas" → "Formas de entrar a una privada", "Seguridad: funciones y RPC" → "RPC de miembros", "Pantallas" → "Panel de gestión", "Criterios de aceptación"

**Migraciones nuevas**: `0014_import_members.sql`

**RPC nuevas o modificadas**: `import_members(p_round_id, p_source_round_id)` → dueño de ambas competencias. Devuelve la cantidad de personas sumadas

**Códigos de error nuevos**: ninguno (usa `NOT_ALLOWED`, `NOT_OWNER`, `ROUND_NOT_FOUND`, `ROUND_CLEANED`, `NOT_PRIVATE`)

**Tiempo real**: sin cambios. `round_members` y `access_requests` ya están en la publicación; el canal `round:{id}` relee `round_members` y `access_requests` (`ROUND_QUERY_KEYS`) y el canal `hub` relee `hub` (`HUB_QUERY_KEYS`). El selector usa la clave `['hub', 'import_sources', roundId]` para refrescarse con el canal `hub`

**Restricciones**: plan gratuito de Supabase (sin impacto: una sola sentencia por importación); límite de 2 competencias activas por dueño, que condiciona la preparación de `rules.sql`

## Constitution Check

*PUERTA: debe pasar antes de la Fase 0 (investigación). Se vuelve a revisar después de la Fase 1 (diseño).*

Ver [.specify/memory/constitution.md](../../.specify/memory/constitution.md).

- [x] **I. Toda escritura por RPC**: `import_members` es `security definer`, `search_path = ''`, nombres calificados y parámetros `p_`. El frontend la llama con `supabase.rpc` desde `src/lib/members.ts`.
- [x] **II. RLS**: no hay tablas nuevas; las políticas existentes no cambian.
- [x] **III. Dominio y acceso**: la RPC empieza con `is_allowed_user()`; exige ser dueño del destino (`round_for_owner`) y del origen. El selector solo lee lo que RLS ya permite al dueño.
- [x] **IV. Sin `service_role`**: sin cambios en claves.
- [x] **V. Español**: textos nuevos en español (spec, "Textos de la UI"); sin códigos de error nuevos que traducir.
- [x] **VI. Tokens**: se reutilizan `btn`, `btn-secondary`, `ConfirmDialog`, radios y chips existentes; sin colores ni tamaños nuevos.
- [x] **Fuente de verdad**: la spec saca "Invitar a los mismos de otra competencia" de lo que queda fuera de alcance en la v2; la v2 se actualiza al cerrar.
- [x] **Límites**: la RPC se llama en `src/lib/members.ts`; la lectura del selector va en `src/hooks/useMembers.ts`; la UI en `src/pages/ManagePage.tsx` solo llama funciones de `lib` y hooks (no suma llamadas a Supabase en `pages/` ni excepciones nuevas); el cambio de base es una migración nueva.
- [x] **Tests planificados**: `labels.test.ts` para `importedMembersMessage` y `memberCountLabel`; sin casos nuevos en `errors.test.ts` (no hay códigos nuevos); `rules.sql` con camino feliz, cada error de la RPC, `NOT_ALLOWED` y `NOT_OWNER` (ver contrato).
- [x] **Acciones destructivas**: ninguna. La migración solo crea una función; la RPC no borra nada. `db push` se ejecuta en la fase de implementación con `--dry-run` primero.

**Resultado**: pasa, sin violaciones. Revisado de nuevo después del diseño: sigue pasando.

## Estructura del proyecto

### Documentación (esta feature)

```text
specs/001-importar-miembros/
├── plan.md              # Este archivo
├── research.md          # Fase 0
├── data-model.md        # Fase 1 (sin cambios de esquema)
├── quickstart.md        # Fase 1
├── contracts/
│   └── import_members.md
└── tasks.md             # Fase 2 (/speckit-tasks)
```

### Código fuente (raíz del repo)

```text
supabase/
├── migrations/0014_import_members.sql   # NUEVO: RPC import_members y sus permisos
└── tests/rules.sql                       # MOD: sección "Importar miembros"

src/
├── lib/
│   ├── database.types.ts                 # MOD: regenerado con npm run types
│   ├── members.ts                        # MOD: importMembers()
│   ├── labels.ts                         # MOD: importedMembersMessage(), memberCountLabel()
│   └── labels.test.ts                    # MOD: casos de los dos textos
├── hooks/useMembers.ts                   # MOD: useImportSources()
└── pages/ManagePage.tsx                  # MOD: ImportMembers en MembersPanel; run() acepta mensaje según resultado

docs/
├── especificacion-v2.md                  # MOD al cerrar
├── supabase.md                           # MOD: import_members en "5. Funciones RPC → Miembros"
└── frontend.md                           # MOD: "Gestionar"
```

**Decisión de estructura**: todo cabe en archivos existentes salvo la migración. `ImportMembers` vive
en `ManagePage.tsx` junto a `AddMember` e `InviteLink`, que son sus pares; los textos van en
`labels.ts` porque es lógica pura con test y no importa el cliente de Supabase.

## Fases de implementación

1. **Base de datos**: `0014_import_members.sql` (contrato en
   [contracts/import_members.md](contracts/import_members.md)); sección "Importar miembros" en
   `rules.sql` con competencias de beto (las públicas o limpiadas de prueba se preparan con
   `pg_temp.run_sql` por el límite de 2); ensayo con `begin;` + migración + `rules.sql` +
   `rollback;`; `db push --dry-run`; `db push`; `npm run types`. Seguir el skill
   `cambio-base-de-datos`.
2. **Lógica (`src/lib/`)**: `importMembers` en `members.ts`; `importedMembersMessage` y
   `memberCountLabel` en `labels.ts` con sus tests.
3. **Datos en la UI (`src/hooks/`)**: `useImportSources(round)` en `useMembers.ts`, con la clave
   `['hub', 'import_sources', roundId]` y `enabled` solo con el diálogo abierto.
4. **UI (`src/pages/ManagePage.tsx`)**:
   - `useManageAction.run` acepta `success` como texto o como función del resultado, y el tipo de
     toast (`success` o `info`) según el mensaje.
   - `ImportMembers`: botón "Importar de otra competencia", diálogo "Importar miembros" con radios
     ("[nombre] · [estado] · N miembros"; 0 miembros deshabilitado), estado vacío, "Importar"
     deshabilitado sin elección, toast con el resultado.
   - El contador "N miembros" de `MembersPanel` pasa a usar `memberCountLabel`.
5. **Cierre**: actualizar `docs/especificacion-v2.md`, `docs/supabase.md` y `docs/frontend.md`;
   puertas de calidad; prueba a mano según [quickstart.md](quickstart.md).

## Puertas de calidad (manuales, sin CI)

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npx supabase db push --dry-run` (lista solo `0014_import_members.sql`)
- [ ] `npx supabase db query --linked -f supabase/tests/rules.sql -o json` con todos los casos `ok = true`
