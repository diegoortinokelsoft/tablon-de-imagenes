---

description: "Lista de tareas para implementar la importación de miembros de otra competencia"
---

# Tareas: Importar miembros de otra competencia

**Entrada**: Documentos de diseño en `/specs/001-importar-miembros/`

**Requisitos previos**: plan.md, spec.md, research.md, data-model.md, contracts/import_members.md, quickstart.md

**Tests**: Obligatorios según la constitución:
- lógica pura nueva en `src/lib/labels.ts` → casos en `src/lib/labels.test.ts`;
- sin códigos de error nuevos → sin cambios en `src/lib/errors.test.ts`;
- RPC nueva `import_members` → sección "Importar miembros" en `supabase/tests/rules.sql` (camino feliz, cada error, `NOT_ALLOWED`, `NOT_OWNER`, rol anónimo).
No hay tests de componentes: la UI se verifica a mano con `npm run dev`.

**Organización**: La RPC cubre las reglas de las tres historias y se hace en la Fase 2 (bloquea todo). Después, cada historia agrega la UI o la verificación que le toca.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: Se puede hacer en paralelo (archivos distintos, sin dependencias)
- **[Historia]**: US1 (sumar de una vez), US2 (sin duplicados y con solicitudes resueltas), US3 (solo el dueño de ambas)

---

## Phase 1: Setup (preparación)

**Propósito**: Verificar que el entorno y la base están al día antes de tocar nada

- [ ] T001 Verificar con `npx supabase migration list` que local y remoto coinciden de `0001` a `0013` en supabase/migrations/ y que no existe todavía `0014_*`
- [ ] T002 [P] Confirmar que `npm test`, `npm run lint` y `npm run build` pasan antes de empezar, y que `npx supabase db query --linked -f supabase/tests/rules.sql -o json` da todos los casos `ok = true`

---

## Phase 2: Foundational (RPC `import_members`)

**Propósito**: La RPC y sus pruebas, que sostienen las reglas de las tres historias. Seguir el skill `cambio-base-de-datos`.

**⚠️ CRÍTICO**: Ninguna historia empieza hasta terminar esta fase. La migración solo crea una función (no es destructiva); igual, `db push` va con `--dry-run` primero.

- [ ] T003 Escribir supabase/migrations/0014_import_members.sql, empezando con un comentario inicial en español de qué hace (como `-- 0013_v2_realtime: …`), con `public.import_members(p_round_id uuid, p_source_round_id uuid) returns int`, `language plpgsql security definer set search_path = ''`, nombres totalmente calificados, siguiendo contracts/import_members.md:
  1. `public.is_allowed_user()` → si no, `NOT_ALLOWED`;
  2. destino con `public.round_for_owner(p_round_id)` (da `ROUND_NOT_FOUND`, `NOT_OWNER`, `ROUND_CLEANED` y toma `for update`);
  3. destino `visibility <> 'private'` → `NOT_PRIVATE`;
  4. origen leído de `public.rounds` **sin bloqueo** (sin `for share`/`for update`, research §3): inexistente → `ROUND_NOT_FOUND`; `owner_id <> auth.uid()` → `NOT_OWNER`; `cleaned_at is not null` → `ROUND_CLEANED`; no privado → `NOT_PRIVATE`;
  5. un CTE `insert into public.round_members (round_id, user_id, source) select p_round_id, m.user_id, 'added' from public.round_members m where m.round_id = p_source_round_id and m.user_id <> <owner_id del destino> on conflict (round_id, user_id) do nothing returning user_id`;
  6. un segundo CTE `update public.access_requests set status = 'approved', resolved_at = now() where round_id = p_round_id and status = 'pending' and user_id in (select user_id from los insertados)`;
  7. devolver `count(*)` de los insertados. Origen = destino no tiene verificación propia: devuelve 0.
  Al final: `revoke execute on function public.import_members(uuid, uuid) from public, anon;` y `grant execute … to authenticated;`
- [ ] T004 Agregar en supabase/tests/rules.sql la sección `-- ===== Importar miembros =====` antes de `-- ===== Archivo y limpieza =====` (línea ~700), con la preparación: beto crea las privadas A y B (beto no tiene competencias, así no choca con el límite de 2 de ana); A con miembros carla y dani; B con carla como miembro; dani con solicitud pendiente en B; **ana con solicitud pendiente en B** (ana no es miembro de A). Usar las RPC existentes (como en las secciones de miembros y solicitudes del mismo archivo) y `pg_temp.run_sql` solo donde haga falta saltar el límite de 2
- [ ] T005 Agregar en la sección "Importar miembros" de supabase/tests/rules.sql los casos de error del contrato: intruso → `NOT_ALLOWED`; carla importa en B → `NOT_OWNER`; superadmin importa en B → `NOT_OWNER`; beto importa en B desde una privada de ana → `NOT_OWNER`; destino inexistente → `ROUND_NOT_FOUND`; origen inexistente → `ROUND_NOT_FOUND`; destino público de beto → `NOT_PRIVATE`; origen público de beto → `NOT_PRIVATE`; destino limpiado de beto → `ROUND_CLEANED`; origen limpiado de beto → `ROUND_CLEANED` (las públicas y limpiadas de beto se preparan con `pg_temp.run_sql`, como postgres); rol anónimo ejecuta la RPC con `pg_temp.run_as_anon` → `permission denied` (mismo patrón que los casos "Anon: …" del inicio del archivo). Después de los errores, verificar que B sigue con un solo miembro (carla) y la solicitud de dani sigue `pending` (todo o nada, FR-010)
- [ ] T006 Agregar en la sección "Importar miembros" de supabase/tests/rules.sql el camino feliz y sus comprobaciones. Antes de importar, guardar en variables el `source` y el `joined_at` de carla en B (leídos con `pg_temp.run_sql`).
  1. **Primera importación**: A → B devuelve `OK:1`; B tiene a carla y dani una vez cada uno (2 filas); **el `source` y el `joined_at` de carla en B no cambiaron** (FR-004); dani quedó con `source = 'added'`; la solicitud de dani en B está `approved` con `resolved_at` no nulo; **la solicitud de ana en B sigue `pending` y ana no es miembro de B** (quien no viene del origen no se toca); A sigue con sus 2 miembros.
  2. **Repetición**: A → B devuelve `OK:0`; origen = destino (A → A) devuelve `OK:0`.
  3. **Quitados y rechazados** (FR-003): beto quita a dani de B (`remove_member`); beto rechaza la solicitud pendiente de ana en B (`resolve_access_request` con `p_approve = false`, id leído con `pg_temp.run_sql`); beto agrega a ana como miembro de A (`add_member`). Luego A → B devuelve `OK:2`; dani vuelve a ser miembro de B con `source = 'added'`; ana es miembro de B con `source = 'added'` y **su solicitud en B sigue `rejected`**; B tiene 3 filas (carla, dani, ana).
  - **Concurrencia (SC-002)**: no se prueba en `rules.sql`, que corre en una sola sesión. La garantiza la clave primaria `(round_id, user_id)` de `round_members` junto con `on conflict do nothing` (research §4); dejarlo como comentario en la sección.
- [ ] T007 Ensayar sin aplicar: `begin;` + supabase/migrations/0014_import_members.sql + cuerpo de supabase/tests/rules.sql + `rollback;` (docs/supabase.md, sección 8); todos los casos `ok = true`
- [ ] T008 Aplicar con `npx supabase db push --dry-run` (debe listar solo `0014_import_members.sql`) y luego `npx supabase db push`; correr `npx supabase db query --linked -f supabase/tests/rules.sql -o json` y confirmar todos los casos `ok = true`
- [ ] T009 Regenerar tipos con `npm run types` y confirmar que src/lib/database.types.ts incluye `import_members` con `Args: { p_round_id: string; p_source_round_id: string }` y `Returns: number`

**Checkpoint**: RPC aplicada, `rules.sql` con todos los casos `ok = true`. Puertas de calidad y commit ("Spec 001 – Fase 2: RPC import_members").

---

## Phase 3: Historia 1 - Sumar de una vez a los miembros de otra competencia (Prioridad: P1) 🎯 MVP

**Objetivo**: El dueño abre "Importar de otra competencia" en "Miembros", elige una privada suya y ve "Se sumaron N personas".

**Prueba independiente**: A privada con 3 miembros, B privada nueva sin miembros, mismo dueño: al importar de A en B, B queda con los 3 y el toast dice "Se sumaron 3 personas"; A no cambia.

### Tests de la historia 1

- [ ] T010 [P] [US1] Agregar en src/lib/labels.test.ts casos para `memberCountLabel` (0 → "0 miembros", 1 → "1 miembro", 3 → "3 miembros") y para `importedMembersMessage` (0 → "No se sumó nadie nuevo", 1 → "Se sumó 1 persona", 3 → "Se sumaron 3 personas")

### Implementación de la historia 1

- [ ] T011 [P] [US1] Agregar en src/lib/labels.ts `memberCountLabel(count: number): string` y `importedMembersMessage(count: number): string` con los textos exactos de la spec ("Textos de la UI"); sin importar el cliente de Supabase
- [ ] T012 [P] [US1] Agregar en src/lib/members.ts `importMembers(roundId: string, sourceRoundId: string): Promise<number>` que llama `supabase.rpc('import_members', { p_round_id: roundId, p_source_round_id: sourceRoundId })`, lanza el error si lo hay (como las demás funciones del archivo) y devuelve el número
- [ ] T013 [US1] Agregar en src/hooks/useMembers.ts `useImportSources(round, enabled)` con TanStack Query, clave `['hub', 'import_sources', round.id]` y `enabled` solo con el diálogo abierto; lee `rounds` con `select('id, name, status, created_at, round_members(count)')` filtrando `owner_id = auth.uid()` (el id del usuario de la sesión, como en los otros hooks de `useMembers.ts`), `visibility = 'private'`, `cleaned_at is null`, `id <> round.id`, orden `created_at` descendente; devuelve `{ id, name, status, memberCount }[]`
- [ ] T014 [US1] Cambiar `useManageAction` en src/pages/ManagePage.tsx: `run(key, action, success?)` acepta `success` como `string` (igual que hoy, toast `success`) o como función `(result) => { message: string; type: 'success' | 'info' }`; se conserva el aviso `FILES_WARNING` cuando `result.filesOk === false` y el comportamiento sin `success` (sin toast). Ningún llamador existente cambia
- [ ] T015 [US1] Agregar el componente `ImportMembers({ round })` en src/pages/ManagePage.tsx, dentro de `MembersPanel` entre `AddMember` y la lista: botón `btn btn-secondary` "Importar de otra competencia" que abre `ConfirmDialog` con título "Importar miembros", la explicación "Elige una de tus competencias privadas. Sus miembros se sumarán a esta; quienes ya son miembros no se repiten.", radios "[nombre] · [estado] · [memberCountLabel(n)]" (estado con la etiqueta existente de `labels.ts`; opciones con 0 miembros deshabilitadas), estado vacío "No tienes otras competencias privadas con miembros" **en lugar de la lista** cuando ninguna otra privada tiene miembros (no hay otras privadas, o todas tienen 0); si al menos una tiene miembros, se muestra la lista completa con las de 0 deshabilitadas; botón "Importar" con `confirmDisabled` hasta elegir y "Cancelar"; al confirmar, `run('import', () => importMembers(round.id, sourceId), (n) => ({ message: importedMembersMessage(n), type: n > 0 ? 'success' : 'info' }))`; cerrar el diálogo solo si `run` devuelve `true` (si falla, el diálogo queda abierto con el toast de error). Si la opción elegida desaparece de la lista o queda deshabilitada (0 miembros) al releerse con el canal `hub`, descartar la elección para que "Importar" vuelva a quedar deshabilitado. Solo tokens y clases existentes (patrón de radios de visibilidad del mismo archivo)
- [ ] T016 [US1] Reemplazar en `MembersPanel` de src/pages/ManagePage.tsx el plural en línea (`members.length === 1 ? '1 miembro' : …`, línea ~462) por `memberCountLabel(members.length)`
- [ ] T017 [US1] Verificar a mano con `npm run dev` los pasos 1, 2, 3, 5, 6, 7 y 9 de specs/001-importar-miembros/quickstart.md (selector sin la competencia actual ni públicas, "Importar" deshabilitado sin elección, toast "Se sumaron N personas", "Agregado por ti", A sin cambios, origen con 0 miembros deshabilitado, estado vacío también cuando todas las otras privadas tienen 0 miembros)

**Checkpoint**: La historia 1 funciona sola. `npm test`, `npm run lint`, `npm run build` y commit ("Spec 001 – Fase 3: importar miembros en la gestión").

---

## Phase 4: Historia 2 - Sin duplicados y con las solicitudes resueltas (Prioridad: P1)

**Objetivo**: Quienes ya eran miembros no se repiten, las solicitudes pendientes de los sumados quedan aprobadas y un resultado de 0 se muestra como aviso informativo.

**Prueba independiente**: A (X, Y, Z) y B (X; Y con solicitud pendiente): al importar, B queda con X, Y y Z, la solicitud de Y sale de "Solicitudes" y del contador sin recargar, y el toast dice "Se sumaron 2 personas". Repetir → "No se sumó nadie nuevo" (toast `info`).

La regla vive en la RPC (T003) y está probada en `rules.sql` (T006); esta fase verifica que la UI la refleja.

- [ ] T018 [US2] Verificar a mano con `npm run dev` el paso 3 de specs/001-importar-miembros/quickstart.md con un miembro previo en el destino: no aparece duplicado en la lista de src/pages/ManagePage.tsx, conserva su etiqueta de origen, y la solicitud pendiente del sumado desaparece de `RequestsPanel` y del contador de "Gestionar" en el encabezado y en el hub sin recargar (FR-008), en menos de 2 segundos a simple vista (SC-005; sin cronómetro). Si no se actualiza, revisar que la clave invalidada por `useManageAction` y el canal `round:{id}` de src/lib/realtime.ts cubran `access_requests`
- [ ] T019 [US2] Verificar a mano el paso 4 de specs/001-importar-miembros/quickstart.md: repetir la importación muestra el toast informativo (no de error ni de éxito) "No se sumó nadie nuevo" y la lista no cambia
- [ ] T020 [US2] Verificar a mano con una segunda pestaña abierta en la gestión del destino que, al importar desde la primera, la segunda muestra los miembros nuevos sin recargar (canal `round:{id}`) en menos de 2 segundos a simple vista (SC-005), y que una solicitud pendiente de alguien que **no** está en el origen sigue en "Solicitudes"

**Checkpoint**: Historias 1 y 2 funcionan. Puertas de calidad y commit si hubo cambios ("Spec 001 – Fase 4: …").

---

## Phase 5: Historia 3 - Solo el dueño de ambas competencias (Prioridad: P2)

**Objetivo**: Nadie usa la importación para entrar a una competencia ajena ni para copiar miembros de una ajena; tampoco el superadmin.

**Prueba independiente**: Los casos de error de T005 dan `ok = true`, y en la UI el control solo aparece al dueño de una privada.

- [ ] T021 [US3] Revisar en src/pages/ManagePage.tsx que `ImportMembers` solo se monta dentro de `MembersPanel`, que a su vez solo se muestra en el modo del dueño de una privada (no en "Moderar" ni en públicas); revisar en src/hooks/useMembers.ts que `useImportSources` filtra por `owner_id` y `visibility = 'private'`
- [ ] T022 [US3] Verificar a mano con `npm run dev` los pasos 8 y 10 de specs/001-importar-miembros/quickstart.md (pública propia sin sección "Miembros"; superadmin en "Moderar" de una ajena sin importación)
- [ ] T023 [US3] Confirmar en la salida de `npx supabase db query --linked -f supabase/tests/rules.sql -o json` que todos los casos de error de la sección "Importar miembros" (T005) dan `ok = true`, y marcar los ítems resueltos de specs/001-importar-miembros/checklists/seguridad.md que esta implementación deja verificados (sin tocar los que siguen pendientes)

**Checkpoint**: Las tres historias funcionan. Puertas de calidad y commit si hubo cambios.

---

## Phase 6: Cierre (documentación y puertas de calidad)

**Propósito**: Dejar la fuente de verdad al día, comprobar que nada existente se rompió y verificar todo

- [ ] T024 Actualizar docs/especificacion-v2.md según la tabla "Referencia a la especificación v2" de la spec: quitar "Invitar a los mismos de otra competencia" de lo que no incluye "Alcance"; agregar "Importar de otra competencia" en "Formas de entrar a una privada"; agregar `import_members` en "RPC de miembros"; sumar los criterios de aceptación de importación; agregar el control en "Pantallas" → "Panel de gestión" → "Miembros"
- [ ] T025 [P] Actualizar docs/supabase.md: fila de `import_members` en "5. Funciones RPC" → "Miembros" (parámetros, quién, devuelve, errores) y la migración `0014_import_members.sql` en la lista de migraciones
- [ ] T026 [P] Actualizar docs/frontend.md, sección "Gestionar": control "Importar de otra competencia", clave `['hub', 'import_sources', roundId]` y que `useManageAction` acepta un mensaje en función del resultado
- [ ] T027 [P] Revisar si CLAUDE.md o README.md necesitan cambios (por ejemplo, la línea de "RPC de miembros" o las decisiones tomadas); si cambia alguna regla, actualizar también .specify/memory/constitution.md en el mismo commit
- [ ] T028 Verificar a mano con `npm run dev` que las acciones existentes del panel en src/pages/ManagePage.tsx siguen mostrando sus mensajes después del cambio en `useManageAction` (T014): agregar persona → "[nombre] ya es miembro"; quitar miembro → "Miembro quitado"; enlace de invitación → "Enlace copiado" al copiar y "Enlace nuevo generado" al regenerar; cambios de estado (abrir, cerrar, etc.) → sin toast de éxito y con toast de error si fallan; además "Nombre guardado", "Visibilidad guardada", "Solicitud aprobada"/"Solicitud rechazada", y que borrar publicación o competencia sigue mostrando `FILES_WARNING` cuando `filesOk` es falso
- [ ] T029 Verificar a mano el recorrido completo de specs/001-importar-miembros/quickstart.md, sección 3 (pasos 1 a 10); los criterios de tiempo (SC-001: armar el grupo en menos de 30 s; SC-005: cambios visibles en menos de 2 s) se verifican a simple vista, sin cronómetro
- [ ] T030 Puertas de calidad: `npm test`, `npm run lint`, `npm run build`
- [ ] T031 Puertas de base: `npx supabase db push --dry-run` sin pendientes y `npx supabase db query --linked -f supabase/tests/rules.sql -o json` con todos los casos `ok = true`
- [ ] T032 Marcar la feature como cerrada en docs/especificacion-v2.md (y las tareas `[x]` en specs/001-importar-miembros/tasks.md); commit ("Spec 001 – Cierre: documentación")

---

## Dependencias y orden de ejecución

### Dependencias entre fases

- **Setup (Fase 1)**: sin dependencias.
- **Foundational (Fase 2)**: depende del Setup y BLOQUEA todas las historias. Orden interno: T003 → T004 → T005 → T006 → T007 → T008 → T009 (T004–T006 tocan el mismo archivo, no van en paralelo).
- **Historia 1 (Fase 3)**: depende de T009 (tipos con `import_members`).
- **Historia 2 (Fase 4)**: depende de la Historia 1 (verifica la misma UI).
- **Historia 3 (Fase 5)**: T023 depende solo de la Fase 2; T021–T022 dependen de la Historia 1.
- **Cierre (Fase 6)**: depende de las tres historias. T028 depende de T014.

### Dentro de la historia 1

- T010 y T011 juntos (test y lógica de `labels.ts`); T012 en paralelo.
- T013 (`hooks/`) después de T012 no es obligatorio, pero sí antes de T015.
- T014 → T015 → T016 (mismo archivo, `src/pages/ManagePage.tsx`) → T017.

### Oportunidades de paralelismo

- T001 y T002.
- T010, T011 y T012 (archivos distintos: `labels.test.ts`, `labels.ts`, `members.ts`).
- T023 se puede adelantar apenas termina la Fase 2.
- T025, T026 y T027 (docs distintas).

### Ejemplo de paralelismo (historia 1)

```text
En paralelo:
  T010 casos de labels.test.ts
  T011 memberCountLabel e importedMembersMessage en labels.ts
  T012 importMembers en members.ts
Después, en orden:
  T013 useImportSources → T014 useManageAction → T015 ImportMembers → T016 contador → T017 prueba a mano
```

---

## Estrategia de implementación

### MVP primero (Fase 2 + historia 1)

1. Fase 1: Setup
2. Fase 2: RPC con todas sus reglas y pruebas (ya cubre las reglas de las historias 2 y 3)
3. Fase 3: Historia 1
4. **FRENAR Y VALIDAR**: importar de A en B y ver "Se sumaron N personas"
5. Puertas de calidad y commit

### Entrega incremental

1. Setup + Foundational → RPC aplicada y probada
2. Historia 1 → UI de importación → commit
3. Historia 2 → verificación de duplicados, solicitudes y aviso de 0
4. Historia 3 → verificación de acceso
5. Cierre → docs, acciones existentes del panel, puertas

---

## Notas

- [P] = archivos distintos, sin dependencias
- **Un commit por fase**, después de las puertas de calidad, en español y con el estilo del repo; no Conventional Commits
- Marcar cada tarea como `[x]` en este archivo al terminarla
- Nunca editar una migración ya aplicada: si `0014` necesita un cambio después del `db push`, va en `0015`
- Si se aplica con el MCP en vez de `db push`, alinear después con `npx supabase migration repair` (CLAUDE.md)
