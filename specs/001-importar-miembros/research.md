# Investigación: Importar miembros de otra competencia

No quedaron `NEEDS CLARIFICATION` en el Technical Context: la spec quedó cerrada en `/speckit-clarify`
y el resto se resolvió leyendo el código. Cada decisión cita lo que la sostiene.

## 1. Una RPC nueva, sin cambios de esquema

- **Decisión**: `public.import_members(p_round_id uuid, p_source_round_id uuid) returns int` en la
  migración `0014_import_members.sql`. No hay tablas, columnas, enums, políticas ni publicaciones de
  Realtime nuevas.
- **Por qué**: la importación es una escritura (principio I) y tiene que ser todo o nada (FR-010).
  Una sola RPC lo da gratis: todo corre en la transacción de la llamada. El origen `added` ya existe
  en `member_source` (clarificación 1).
- **Alternativas descartadas**:
  - Llamar `add_member` una vez por persona desde el cliente: no es atómico, falla con
    `ALREADY_HAS_ACCESS` en los que ya son miembros y hace N viajes.
  - Generalizar `add_member` para aceptar varios ids: cambia una firma ya usada y mezcla dos reglas
    distintas (`add_member` falla si ya tiene acceso; la importación lo ignora).

## 2. Orden de las verificaciones y errores

- **Decisión**:
  1. `is_allowed_user()` → `NOT_ALLOWED`.
  2. Destino con `public.round_for_owner(p_round_id)`: `ROUND_NOT_FOUND`, `NOT_OWNER`,
     `ROUND_CLEANED`, y toma `for update` sobre el destino, como el resto de las RPC del dueño.
  3. Destino privado → si no, `NOT_PRIVATE` (igual que `add_member`).
  4. Origen leído **sin bloqueo**: inexistente → `ROUND_NOT_FOUND`; de otro dueño → `NOT_OWNER`;
     limpiado → `ROUND_CLEANED`; público → `NOT_PRIVATE`.
- **Por qué**: reutiliza el auxiliar existente y los mismos códigos que el resto de las RPC del
  dueño, así que no hay errores nuevos (clarificación 2) ni mensajes nuevos en `errors.ts`. Que el
  destino se verifique primero hace que un no-dueño reciba `NOT_OWNER` sin enterarse de nada del
  origen.
- **Origen = destino**: no tiene verificación propia. Pasa todos los chequeos, el insert no encuentra
  a nadie nuevo y devuelve 0 (clarificación 2).

## 3. Sin bloqueo sobre el origen

- **Decisión**: el origen se lee con un `select` simple, sin `for share` ni `for update`.
- **Por qué**: el origen no se modifica (FR-011). Bloquearlo abre la puerta a un deadlock entre dos
  importaciones cruzadas simultáneas (A→B y B→A: cada una tiene `for update` sobre su destino y
  espera la otra). Leer el origen sin bloqueo toma los miembros que había al empezar la sentencia;
  si el origen cambia al mismo tiempo, la importación usa la foto de ese instante, lo cual es
  correcto para "los miembros actuales".
- **Alternativa descartada**: bloquear las dos filas en orden de id. Funciona, pero agrega
  complejidad para proteger algo que no hace falta proteger.

## 4. Sin duplicados y conteo exacto

- **Decisión**: un solo `insert … select … on conflict (round_id, user_id) do nothing returning
  user_id` dentro de un CTE; un segundo CTE (`update`) aprueba las solicitudes pendientes de los ids
  devueltos; la RPC devuelve `count(*)` de los insertados.
- **Por qué**:
  - La clave primaria `(round_id, user_id)` de `round_members` garantiza que no haya duplicados aun
    con dos importaciones o un `join_with_invite` simultáneos (SC-002).
  - `returning` solo devuelve las filas realmente insertadas, así que el número informado es
    exactamente el de membresías nuevas (SC-003), y solo esas personas tienen su solicitud aprobada
    (FR-005). Quien ya era miembro no se toca (FR-004).
  - Los CTE que modifican datos se ejecutan siempre, aunque la consulta final no los lea.
- Se excluye por las dudas al dueño del destino (`user_id <> owner_id`), aunque por construcción no
  puede ser miembro de una competencia propia.

## 5. Selector de orígenes: lectura directa, sin RPC

- **Decisión**: un hook `useImportSources(round, enabled)` en `src/hooks/useMembers.ts` que lee
  `rounds` con el conteo embebido `round_members(count)`, filtrando `owner_id = auth.uid()`, `visibility = 'private'`,
  `cleaned_at is null`, `id <> destino`, ordenado por `created_at` descendente.
- **Por qué**: el dueño ya puede leer todas las filas de `rounds` y todas las membresías de sus
  competencias (política "Lectura del miembro, el dueño o el superadmin"), así que el conteo es
  exacto sin abrir nada nuevo. Las lecturas van en `src/hooks/` (constitución, "Límites"), como
  `useRound`.
- **Alternativa descartada**: una RPC de lectura `import_sources()`. Más código y más tests para
  datos que RLS ya expone correctamente.
- **Sin buscador ni paginación**: un dueño tiene como mucho 2 activas y sus finalizadas. Si la lista
  creciera mucho, se revisa en otra feature (queda en "Supuestos" de la spec).

## 6. Tiempo real y claves de consulta

- **Decisión**: sin cambios en `src/lib/realtime.ts`. La clave del selector es
  `['hub', 'import_sources', roundId]`.
- **Por qué**:
  - `round_members` y `access_requests` ya están en la publicación (`0013_v2_realtime.sql`) y el
    canal `round:{id}` ya relee `round_members` y `access_requests` del destino; el canal `hub`
    (montado en `App.tsx`) relee `hub` ante cualquier cambio en `round_members` o `rounds`. Eso
    cubre FR-008 y SC-005 sin tocar nada.
  - Con el prefijo `hub`, el selector se actualiza cuando cambian los miembros de cualquier
    competencia (por ejemplo, alguien entra al origen por enlace) sin una suscripción nueva.
  - `useManageAction` ya invalida `ROUND_QUERY_KEYS` y `HUB_QUERY_KEYS` después de cada acción.

## 7. Interfaz

- **Decisión**: un componente `ImportMembers` dentro de `MembersPanel` en `src/pages/ManagePage.tsx`,
  entre "Agregar persona" y la lista de miembros. El botón (`btn btn-secondary`) abre el
  `ConfirmDialog` existente con una lista de radios como contenido; "Importar" queda deshabilitado
  (`confirmDisabled`) hasta elegir un origen. Las opciones con 0 miembros van deshabilitadas.
- **Por qué**: `ConfirmDialog` ya se monta con portal, maneja foco, Escape, estado `pending` y botón
  deshabilitado; los radios siguen el patrón de visibilidad en el mismo archivo y en
  `CreateRoundDialog`. Las demás secciones del panel viven en `ManagePage.tsx`; un componente aparte
  en `src/components/` no aporta reutilización.
- **Resultado**: toast `success` con "Se sumaron N personas" / "Se sumó 1 persona" y toast `info`
  con "No se sumó nadie nuevo" (clarificación 3; `ToastType` ya tiene `info`). Para eso
  `useManageAction.run` acepta que el mensaje de éxito sea una función del resultado, además de un
  texto fijo.

## 8. Lógica pura y tests

- **Decisión**: `importedMembersMessage(count)` y `memberCountLabel(count)` en `src/lib/labels.ts`,
  con casos en `labels.test.ts` (0, 1, varios). `importMembers(roundId, sourceRoundId)` en
  `src/lib/members.ts` (llamada directa a Supabase, sin test de Vitest).
- **Por qué**: la constitución exige Vitest para la lógica pura de `src/lib/`; `labels.ts` ya tiene
  textos y su test, y no importa el cliente de Supabase. `memberCountLabel` también reemplaza el
  plural en línea del contador "N miembros" de `MembersPanel`.
- **Sin cambios** en `errors.ts` ni `errors.test.ts`: no hay códigos nuevos.

## 9. Pruebas de la base

- **Decisión**: una sección nueva "Importar miembros" en `supabase/tests/rules.sql`, antes de
  "Archivo y limpieza", con competencias de **beto** (que no tiene ninguna, así no choca con el
  límite de 2 de ana). Los casos que necesitan una competencia pública o limpiada de beto la
  preparan con `pg_temp.run_sql` (como postgres), porque el límite de 2 activas no deja crear una
  tercera.
- Casos: ver [quickstart.md](quickstart.md#1-reglas-de-la-base) y el contrato.
