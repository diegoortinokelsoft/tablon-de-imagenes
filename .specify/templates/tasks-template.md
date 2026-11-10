---

description: "Plantilla de lista de tareas para implementar una feature"
---

# Tareas: [NOMBRE DE LA FEATURE]

**Entrada**: Documentos de diseño en `/specs/[###-nombre-feature]/`

**Requisitos previos**: plan.md (obligatorio), spec.md (obligatorio para las historias), research.md, data-model.md, contracts/

**Tests**: Son obligatorios cuando aplican (ver la constitución, sección "Tests"):
- lógica pura nueva en `src/lib/` → `src/lib/[nombre].test.ts`;
- código de error nuevo → caso en `src/lib/errors.test.ts`;
- RPC nueva o modificada → casos en `supabase/tests/rules.sql`: camino feliz, cada error propio, `NOT_ALLOWED` siempre, y `NOT_OWNER` (RPC del dueño) o `NOT_ADMIN` (RPC del superadmin).
No hay tests de componentes: la UI se verifica a mano con `npm run dev`.

**Organización**: Las tareas se agrupan por historia para que cada una se pueda implementar y probar por separado. Todo en español.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede hacer en paralelo (archivos distintos, sin dependencias)
- **[Historia]**: A qué historia pertenece (US1, US2, US3...)
- Incluir la ruta exacta del archivo en la descripción

## Rutas del proyecto

- Base de datos: `supabase/migrations/000N_nombre.sql`, `supabase/tests/rules.sql`
- Escrituras (RPC que modifican datos) y Storage: solo en `src/lib/`
- Lecturas: en `src/hooks/` (dentro de la consulta de TanStack Query) o en `src/lib/`
- Lógica pura, errores y tipos: `src/lib/` (tests `*.test.ts` al lado)
- Consultas, mutaciones y Realtime en la UI: `src/hooks/`
- UI: `src/components/`, `src/pages/`, `src/router.tsx`, `src/styles/components.css`
- Documentación: `docs/especificacion-v2.md`, `docs/supabase.md`, `docs/frontend.md`

<!--
  ============================================================================
  IMPORTANTE: Las tareas de abajo son EJEMPLOS.

  /speckit-tasks DEBE reemplazarlas por tareas reales según:
  - Las historias de spec.md (con sus prioridades P1, P2, P3...)
  - Los requisitos y fases de plan.md
  - Las entidades de data-model.md
  - Las RPC y errores de contracts/

  NO dejar estas tareas de ejemplo en el tasks.md generado.
  ============================================================================
-->

## Phase 1: Setup (preparación)

**Propósito**: Verificar que el entorno y la base están al día antes de tocar nada

- [ ] T001 Verificar con `npx supabase migration list` que local y remoto coinciden hasta la última migración en supabase/migrations/
- [ ] T002 [P] Confirmar que `npm test`, `npm run lint` y `npm run build` pasan antes de empezar

---

## Phase 2: Foundational (base de datos y cimientos)

**Propósito**: Cambios de base y piezas compartidas que bloquean todas las historias

**⚠️ CRÍTICO**: Ninguna historia empieza hasta terminar esta fase. Antes de cualquier acción destructiva, preguntar.

- [ ] T003 Escribir la migración en supabase/migrations/000N_[nombre].sql (RPC `security definer`, `search_path = ''`, parámetros `p_`, `is_allowed_user()`, revoke/grant)
- [ ] T004 Agregar casos en supabase/tests/rules.sql (camino feliz, errores propios, `NOT_ALLOWED`, `NOT_OWNER` o `NOT_ADMIN` según el rol)
- [ ] T005 Ensayar la migración con `begin;` + migración + cuerpo de rules.sql + `rollback;` (docs/supabase.md, sección 8)
- [ ] T006 Aplicar con `npx supabase db push --dry-run` y `npx supabase db push`
- [ ] T007 Regenerar tipos con `npm run types` en src/lib/database.types.ts
- [ ] T008 [P] Agregar mensajes de error en español en src/lib/errors.ts y sus casos en src/lib/errors.test.ts

**Checkpoint**: Base aplicada, `rules.sql` con todos los casos `ok = true`. Commit de la fase.

---

## Phase 3: Historia 1 - [Título] (Prioridad: P1) 🎯 MVP

**Objetivo**: [Qué entrega esta historia]

**Prueba independiente**: [Cómo se verifica sola]

### Tests de la historia 1

- [ ] T009 [P] [US1] Tests de la lógica pura en src/lib/[nombre].test.ts

### Implementación de la historia 1

- [ ] T010 [P] [US1] Función que llama a la RPC en src/lib/[rounds|submissions|members|admin].ts
- [ ] T011 [P] [US1] Lógica pura en src/lib/[nombre].ts
- [ ] T012 [US1] Hook de consulta/mutación con invalidación de claves en src/hooks/use[Nombre].ts
- [ ] T013 [US1] Componente en src/components/[Nombre].tsx (textos en español, solo tokens de la guía)
- [ ] T014 [US1] Integrar en src/pages/[Nombre]Page.tsx (y src/router.tsx si hay ruta nueva)

**Checkpoint**: La historia 1 funciona y se prueba por separado. Puertas de calidad y commit.

---

## Phase 4: Historia 2 - [Título] (Prioridad: P2)

**Objetivo**: [Qué entrega esta historia]

**Prueba independiente**: [Cómo se verifica sola]

### Implementación de la historia 2

- [ ] T015 [P] [US2] [Tarea] en src/lib/[archivo].ts
- [ ] T016 [US2] [Tarea] en src/hooks/use[Nombre].ts
- [ ] T017 [US2] [Tarea] en src/components/[Nombre].tsx

**Checkpoint**: Las historias 1 y 2 funcionan por separado. Puertas de calidad y commit.

---

[Agregar más fases de historias si hace falta, con el mismo patrón]

---

## Phase N: Cierre (documentación y puertas de calidad)

**Propósito**: Dejar la fuente de verdad al día y verificar todo

- [ ] TXXX Actualizar docs/especificacion-v2.md con el cambio de la feature
- [ ] TXXX [P] Actualizar docs/supabase.md (si cambian modelo, RPC, Storage o Realtime)
- [ ] TXXX [P] Actualizar docs/frontend.md (si cambian rutas, pantallas o datos)
- [ ] TXXX [P] Actualizar CLAUDE.md y .specify/memory/constitution.md (si cambia alguna regla o decisión)
- [ ] TXXX Verificar a mano con `npm run dev` según quickstart.md
- [ ] TXXX Puertas de calidad: `npm test`, `npm run lint`, `npm run build`
- [ ] TXXX Puertas de base (si hubo migraciones): `npx supabase db push --dry-run` sin pendientes y `npx supabase db query --linked -f supabase/tests/rules.sql -o json` con todos los casos `ok = true`

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Setup (Fase 1)**: sin dependencias.
- **Foundational (Fase 2)**: depende del Setup y BLOQUEA todas las historias. Si la feature no toca la base, queda solo con lo compartido (p. ej. errores o tipos).
- **Historias (Fase 3+)**: dependen de la Fase 2; se hacen en orden de prioridad (P1 → P2 → P3).
- **Cierre (fase final)**: depende de las historias que se quieran entregar.

### Dentro de cada historia

- `src/lib/` → `src/hooks/` → `src/components/` → `src/pages/` (las dependencias van en un solo sentido)
- Tests de `src/lib/` junto con la lógica que prueban
- Historia completa antes de pasar a la siguiente

### Oportunidades de paralelismo

- Tareas [P] dentro de una misma fase (archivos distintos)
- Funciones de `src/lib/` independientes entre sí
- Las actualizaciones de docs del cierre

---

## Estrategia de implementación

### MVP primero (solo la historia 1)

1. Fase 1: Setup
2. Fase 2: Foundational (CRÍTICO, bloquea todas las historias)
3. Fase 3: Historia 1
4. **FRENAR Y VALIDAR**: probar la historia 1 por separado
5. Puertas de calidad y commit

### Entrega incremental

1. Setup + Foundational → base lista
2. Historia 1 → probar → commit
3. Historia 2 → probar → commit
4. Cada historia agrega valor sin romper las anteriores

---

## Notas

- [P] = archivos distintos, sin dependencias
- La etiqueta de historia vincula la tarea con la spec
- **Un commit por fase**, después de las puertas de calidad, en español y con el estilo del repo (p. ej. "Fase N: …", "Arreglo: …"); no Conventional Commits
- Marcar cada tarea como `[x]` en tasks.md al terminarla
- Nunca editar una migración ya aplicada; nunca modificar la base fuera de migraciones
- Evitar: tareas vagas, dos tareas sobre el mismo archivo en paralelo, dependencias entre historias que rompan su independencia
