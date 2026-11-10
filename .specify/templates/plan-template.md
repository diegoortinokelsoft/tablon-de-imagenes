# Plan de implementación: [FEATURE]

**Rama**: `[###-nombre-feature]` | **Fecha**: [FECHA] | **Spec**: [enlace]

**Entrada**: Especificación de la feature en `/specs/[###-nombre-feature]/spec.md`

**Nota**: Esta plantilla la completa el comando `/speckit-plan`. Todo el plan va en español.

## Resumen

[Requisito principal de la spec + enfoque técnico surgido de la investigación]

## Technical Context

<!-- El stack es fijo; completar solo los campos propios de la feature.
     Lo que no se sepa se marca como NEEDS CLARIFICATION. -->

**Lenguaje/Versión**: TypeScript ~5.8 (`strict`), SQL (PostgreSQL de Supabase, plpgsql)

**Dependencias principales**: React 18, React Router 6, TanStack Query 5, Tailwind 3, `@supabase/supabase-js` 2, lucide-react [+ dependencias nuevas, justificadas]

**Almacenamiento**: Supabase Postgres (RLS + RPC `security definer`) y Supabase Storage

**Tests**: Vitest 3 (`src/lib/*.test.ts`) y `supabase/tests/rules.sql`

**Plataforma**: Navegador (SPA en Netlify)

**Tipo de proyecto**: SPA con Supabase como backend (sin servidor propio)

**Secciones de la especificación v2 afectadas**: [de la spec]

**Migraciones nuevas**: [`000N_nombre.sql` o "ninguna"]

**RPC nuevas o modificadas**: [nombre(p_...) → rol: usuario / dueño / superadmin, o "ninguna"]

**Códigos de error nuevos**: [CODIGO o "ninguno"]

**Tiempo real**: [tablas, y claves de `ROUND_QUERY_KEYS` / `HUB_QUERY_KEYS` (`src/lib/realtime.ts`) afectadas, o "sin cambios"]

**Restricciones**: [p. ej. plan gratuito de Supabase, límites de Storage, NEEDS CLARIFICATION]

## Constitution Check

*PUERTA: debe pasar antes de la Fase 0 (investigación). Se vuelve a revisar después de la Fase 1 (diseño).*

Ver [.specify/memory/constitution.md](../../.specify/memory/constitution.md).

- [ ] **I. Toda escritura por RPC**: las escrituras nuevas son RPC `security definer`, `search_path = ''`, nombres calificados y parámetros `p_`; nada de `.insert/.update/.upsert/.delete` en el frontend.
- [ ] **II. RLS**: toda tabla nueva tiene RLS y solo políticas de `select`.
- [ ] **III. Dominio y acceso**: todo exige `is_allowed_user()`; el contenido de una competencia, `can_view_round(id)`; la gestión, ser dueño; lo del superadmin, `is_admin()`.
- [ ] **IV. Sin `service_role`**: solo claves públicas en el frontend.
- [ ] **V. Español**: textos de la UI en español; cada error nuevo traducido en `src/lib/errors.ts`.
- [ ] **VI. Tokens**: solo tokens de `tailwind.config.ts` y clases de `src/styles/components.css`.
- [ ] **Fuente de verdad**: la spec no contradice `docs/especificacion-v2.md`, o la contradicción está resuelta con la persona.
- [ ] **Límites**: las escrituras por RPC y Storage van en `src/lib/`; las lecturas, en `src/hooks/` o `src/lib/`; ninguna capa importa de una superior; no se suman llamadas en `pages/` ni `components/`; los cambios de base van en migraciones nuevas.
- [ ] **Tests planificados**: Vitest para la lógica nueva de `src/lib/`; `errors.test.ts` por cada error; `rules.sql` por cada RPC (camino feliz, errores propios, `NOT_ALLOWED`, y `NOT_OWNER` o `NOT_ADMIN` según el rol).
- [ ] **Acciones destructivas**: identificadas y confirmadas con la persona antes de ejecutarlas.

## Estructura del proyecto

### Documentación (esta feature)

```text
specs/[###-feature]/
├── plan.md              # Este archivo (salida de /speckit-plan)
├── research.md          # Fase 0 (/speckit-plan)
├── data-model.md        # Fase 1 (/speckit-plan): tablas, columnas, vistas, políticas
├── quickstart.md        # Fase 1 (/speckit-plan): cómo probar la feature a mano
├── contracts/           # Fase 1 (/speckit-plan): firmas de RPC, permisos y códigos de error
└── tasks.md             # Fase 2 (/speckit-tasks, NO lo crea /speckit-plan)
```

### Código fuente (raíz del repo)

<!-- Dejar solo los archivos que la feature crea (NUEVO) o modifica (MOD). -->

```text
supabase/
├── migrations/000N_[nombre].sql      # NUEVO: migración de la feature
└── tests/rules.sql                    # MOD: casos de las reglas nuevas

src/
├── lib/
│   ├── database.types.ts              # MOD: regenerado con npm run types
│   ├── errors.ts / errors.test.ts     # MOD: códigos de error nuevos
│   ├── [rounds|submissions|members|admin].ts   # MOD: llamadas a las RPC
│   └── [nuevo].ts / [nuevo].test.ts   # lógica pura nueva
├── hooks/use[Nombre].ts               # consultas/mutaciones de TanStack Query
├── components/[Nombre].tsx
├── pages/[Nombre]Page.tsx
├── router.tsx                         # si hay rutas nuevas
└── styles/components.css              # si hay clases reutilizables nuevas

docs/
├── especificacion-v2.md               # MOD al cerrar la feature
├── supabase.md                        # MOD si cambian modelo, RPC, Storage o Realtime
└── frontend.md                        # MOD si cambian rutas, pantallas o datos
```

**Decisión de estructura**: [Archivos concretos que se tocan y por qué]

## Fases de implementación

1. **Base de datos** (si aplica): migración `000N`, casos en `rules.sql`, ensayo con `begin; … rollback;`, `db push --dry-run`, `db push`, `npm run types`. Seguir el skill `cambio-base-de-datos`.
2. **Lógica (`src/lib/`)**: llamadas a RPC, lógica pura con tests, mensajes de error.
3. **Datos en la UI (`src/hooks/`)**: consultas, mutaciones e invalidación de claves; tiempo real.
4. **UI (`src/components/`, `src/pages/`)**: pantallas y textos en español con tokens de la guía.
5. **Cierre**: actualizar `docs/especificacion-v2.md` (y los otros docs si corresponde) y correr las puertas de calidad.

## Puertas de calidad (manuales, sin CI)

- [ ] `npm test`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npx supabase db push --dry-run` (si hay migraciones)
- [ ] `npx supabase db query --linked -f supabase/tests/rules.sql -o json` con todos los casos `ok = true` (si hay migraciones)

## Seguimiento de complejidad

> **Completar SOLO si el Constitution Check tiene violaciones que haya que justificar**

| Violación | Por qué hace falta | Alternativa más simple descartada porque |
|-----------|--------------------|------------------------------------------|
| [p. ej. dependencia nueva] | [necesidad concreta] | [por qué no alcanza lo existente] |
