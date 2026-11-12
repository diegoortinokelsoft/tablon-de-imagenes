# Trabajo final · Developer Boost 2.0

**Integrante:** Diego Martín Ortino · **Modalidad:** brownfield · **Técnica:** Spec Kit con la extensión Brownfield Bootstrap · **Agente:** Claude Code

## Qué construimos

**Importar miembros de otra competencia** en el [Tablón de Imágenes](../README.md), la app interna de competencias de imágenes de Grupo Kelsoft (React + Supabase).

Para armar una competencia privada con el mismo grupo que una anterior, el dueño tenía que agregar a cada persona a mano. La especificación v2 había dejado esta mejora explícitamente para "una versión posterior". Ahora, desde la gestión de una privada propia, el dueño elige otra privada suya y suma a todos sus miembros de una vez:

- Quien ya es miembro no se duplica ni se modifica.
- Las solicitudes de acceso pendientes de los que se suman quedan aprobadas.
- El dueño ve cuántas personas se sumaron ("Se sumaron 3 personas" o "No se sumó nadie nuevo").
- Solo puede hacerlo quien es dueño de las dos competencias, y el superadmin no tiene excepción.

| Capa | Cambio |
| --- | --- |
| Base de datos | Una migración (`0014_import_members.sql`) con una RPC `security definer`. Sin cambios de esquema ni códigos de error nuevos |
| Pruebas de la base | 29 casos nuevos en `rules.sql` (de 217 a 246, todos `ok = true`) |
| Frontend | `importMembers` en `lib/`, `useImportSources` en `hooks/` y el diálogo en `ManagePage`. Tests de Vitest de 83 a 85 |
| Artefactos | `specs/001-importar-miembros/`: spec, plan, research, data-model, contrato, quickstart, tasks y dos checklists |

## Cómo fue el proceso

### 1. Adoptar Spec Kit en un repo existente

Instalamos Spec Kit y la extensión Brownfield, y armamos la constitución a partir del código con `scan → bootstrap → validate → constitution`. Lo mergeamos a `Develop` como un PR aparte (#5), antes de empezar la feature.

- **`scan`** detectó bien el stack y las reglas de `CLAUDE.md`. Solo erró el conteo de tests.
- **`bootstrap`** tradujo las 6 reglas de `CLAUDE.md` a principios no negociables y adaptó las plantillas a las capas reales del proyecto. Mantuvo en inglés los marcadores que leen los comandos.
- **`validate`** encontró dos problemas. Uno lo dejamos a propósito para ver si lo detectaba: el borrador decía "solo `lib/` llama a Supabase", pero en el código las lecturas viven en `hooks/` y hay tres llamadas heredadas en páginas y componentes. El otro no lo habíamos visto: el nombre `REALTIME_QUERY_KEYS`, que no existe en el código. Venía de un skill propio del repo que ya estaba desactualizado.
- **`constitution`** reescribió la regla de capas como funciona hoy, con las excepciones heredadas listadas y la prohibición de sumar nuevas. Quedó en la versión 1.0.1.

### 2. La feature: `specify → clarify → plan → checklist → tasks → analyze → implement → converge`

- **`specify`** escribió la spec y tomó 5 decisiones por su cuenta, que dejó en "Supuestos".
- **`clarify`** nos hizo revisarlas. Las cinco respuestas **achicaron** la feature: los importados se registran con el origen existente `added` en lugar de un valor nuevo del enum, se descartó el error nuevo `SAME_ROUND` (importar de la misma competencia devuelve 0), y no hay confirmación extra.
- **`plan`** reutilizó la función interna `round_for_owner` para el destino y leyó el origen sin bloqueo, para evitar un deadlock entre dos importaciones cruzadas. Verificamos sus supuestos contra el código antes de seguir.
- **`checklist` de seguridad** (26 ítems) encontró un caso que nadie había visto: la importación vuelve a sumar a alguien que el dueño había quitado. Comprobamos que `add_member` ya se comporta igual y que el sistema no guarda historial de bajas, así que lo **documentamos como decisión** en vez de agrandar el alcance.
- **`analyze`** corrió dos veces. El primero dio 1 hallazgo alto, 3 medios y 94 % de cobertura. Después de los ajustes, el segundo dio 0 altos y 100 % de cobertura.
- **`implement`** se hizo por fases, con un commit por fase. Antes del `db push` revisamos el `--dry-run` y ensayamos la migración con `rules.sql` dentro de una transacción con `rollback`.
- **`converge`** salió "Converged" en la primera pasada: 0 faltantes, 0 parciales y 0 contradicciones.

El historial de la rama `001-importar-miembros` refleja cada etapa en su propio commit.

## Testing

### Qué aportó la metodología

Spec Kit no trae un framework de tests propio. Lo que aporta es que **en cada etapa el testing queda definido antes de escribir código**, y que después se verifica contra lo definido.

| Etapa | Aporte al testing |
| --- | --- |
| **Constitución** | Fijó qué tests son obligatorios en el proyecto:<br>• Vitest para toda lógica nueva de `src/lib/`.<br>• Un caso en `errors.test.ts` por cada código de error nuevo.<br>• En `rules.sql`, por cada RPC: camino feliz, cada error propio, `NOT_ALLOWED`, y `NOT_OWNER` o `NOT_ADMIN` según el rol.<br>Fijó también **puertas de calidad** al cerrar cada fase: `npm test`, `npm run lint`, `npm run build`, `db push --dry-run` y `rules.sql` con todo en `ok = true`. Como no hay tests de componentes, la UI se verifica a mano |
| **Spec** | Escenarios de aceptación en formato *Dado / Cuando / Entonces*, una "prueba independiente" por historia y criterios de éxito medibles (SC-001 a SC-005) |
| **Clarify** | Cada decisión se convirtió en un caso concreto. Por ejemplo, "origen = destino devuelve 0" pasó a ser un caso de `rules.sql`. Al descartar `SAME_ROUND`, también se descartó su test en `errors.test.ts` |
| **Plan** | El contrato de la RPC trae una **tabla de casos de prueba** con el resultado esperado de cada uno. `quickstart.md` es la guía de prueba: reglas de la base, puertas de calidad y una prueba a mano de 10 pasos |
| **Checklist** | Probó la **calidad de los requisitos**, no la del código: 26 preguntas sobre si la seguridad estaba completa, clara y era verificable. Por ejemplo, si SC-004 se podía comprobar con un caso por rol |
| **Tasks** | Ordenó los tests **antes** del código: los casos de `rules.sql` (T004–T006) antes del `db push`, y los de Vitest (T010) antes de la lógica (T011). Agregó una tarea de verificación manual por historia y una de regresión (T028) |
| **Analyze** | Midió la cobertura requisito → tarea (de 94 % a 100 %). Pidió casos que faltaban: personas quitadas y solicitudes rechazadas que vuelven a sumarse, y que un miembro existente no cambie |
| **Implement** | Tests primero: el agente vio fallar los de Vitest antes de implementar. Además, la migración se ensayó con `rules.sql` dentro de una transacción con `rollback` antes de aplicarla |
| **Converge** | Verificación final: comparó el código contra los 12 requisitos, los 5 criterios, los 12 escenarios y los 16 casos borde, y revisó el código de cada una de las 32 tareas en lugar de confiar en las casillas marcadas |

### Testeos realizados

**1. Línea de base, antes de tocar nada.** Antes de adoptar Spec Kit corrimos 83 tests de Vitest, lint y build, todo en verde. En la fase 1 del implement corrimos `rules.sql` contra la base: 217 casos con `ok = true`. Así cualquier falla posterior se podía atribuir a la feature.

**2. Reglas de la base (`rules.sql`): 29 casos nuevos**

| Grupo | Casos |
| --- | --- |
| Preparación | 1: privada A con carla y dani; privada B con carla; solicitudes pendientes de dani y de ana en B |
| Permisos y errores | 11: rol anónimo (`permission denied`), otro dominio (`NOT_ALLOWED`), miembro no dueño, superadmin en una ajena y origen ajeno (`NOT_OWNER`), destino u origen inexistente (`ROUND_NOT_FOUND`), destino u origen público (`NOT_PRIVATE`), destino u origen limpiado (`ROUND_CLEANED`) |
| Todo o nada | 1: después de todos los errores, B sigue igual |
| Camino feliz | 7: A → B suma solo a dani; B tiene a carla y dani una vez cada uno; carla no cambia; dani queda como `added`; su solicitud queda aprobada; la de ana, que no está en A, sigue pendiente; A no cambia |
| Idempotencia | 2: repetir A → B devuelve 0, y A → A devuelve 0 |
| Quitados y rechazados | 7: se quita a dani de B, se rechaza la solicitud de ana y se suma ana a A. Al importar se suman los dos, quedan como `added`, la solicitud rechazada no cambia y B queda con 3 miembros |

Total: de 217 a **246 casos, todos `ok = true`**. Se corrieron dos veces: en el ensayo con `rollback` y contra la base real después del `db push`.

**3. Vitest: 2 tests nuevos, escritos primero.** `memberCountLabel` (singular y plural) e `importedMembersMessage` (0, 1 y N personas). Total: de 83 a 85.

**4. Puertas de calidad al cerrar cada fase:** tests, lint y build. En las fases con base de datos, también `db push --dry-run` sin pendientes y `rules.sql` completo.

**5. Pruebas manuales en el navegador**, siguiendo `quickstart.md`:

- **Historia 1 (T017):**
  - El selector no ofrece la competencia actual ni las públicas.
  - "Importar" queda deshabilitado hasta elegir un origen.
  - Aparece el aviso "Se sumaron N personas" y los sumados tienen la etiqueta "Agregado por ti".
  - El origen queda intacto.
  - Un origen con 0 miembros aparece deshabilitado, y se ve el estado vacío cuando no hay opciones.
- **Historia 2 (T018–T020):**
  - No hay duplicados.
  - La solicitud del sumado desaparece de "Solicitudes" y del contador sin recargar.
  - Repetir muestra el aviso informativo "No se sumó nadie nuevo".
  - Con dos pestañas abiertas, la segunda se actualiza sola.
  - La solicitud de alguien que no viene del origen sigue pendiente.
- **Historia 3 (T022):** una competencia pública no muestra la sección, y el superadmin en "Moderar" no ve la importación.
- **Regresión (T028):** el cambio en `useManageAction` afectaba a todas las acciones del panel, así que verificamos que agregar y quitar miembros, el enlace de invitación, los cambios de estado, renombrar y resolver solicitudes siguen mostrando sus mensajes de siempre.
- **Recorrido completo (T029):** los 10 pasos de `quickstart.md`, con los criterios de tiempo verificados a simple vista.

**6. Un test corregido durante el implement.** El caso "carla no cambia" pasaba aunque la RPC la sobrescribiera, porque carla ya tenía `source = 'added'` y, dentro de la transacción del test, `now()` siempre devuelve lo mismo. Se cambió la preparación (`source = 'invite_link'` y `joined_at` de hace un día) para que el test pudiera fallar.

### Lo que no se probó, y por qué

- **Concurrencia:** `rules.sql` corre en una sola sesión, así que no puede simular dos importaciones a la vez. La garantía viene del diseño: la clave primaria de `round_members` con `on conflict do nothing`, más el bloqueo `for update` sobre el destino. Quedó documentado en la spec, el contrato y como comentario en `rules.sql`.
- **Tests de componentes:** el proyecto no los tiene, y la constitución no los exige. La UI se verificó a mano.
- **El aviso `FILES_WARNING`** en la regresión: es difícil provocar a mano una falla de Storage. Se verificó que el camino normal siga funcionando.
- **Tiempos (SC-001 y SC-005):** se verificaron a simple vista, sin medición.
- **CI:** no hay. Todas las puertas se corrieron a mano.

## Qué aprendimos

### Qué funcionó

- **En brownfield, el `validate` es el paso más valioso.** Encontró una regla de la constitución que contradecía el código y un error heredado de la documentación existente. La regla de la clase se cumplió: la constitución describe lo que el repo ya cumple, no lo que nos gustaría.
- **El `clarify` sirve para recortar, no solo para aclarar.** Cada pregunta tenía una opción más chica, y elegirla dejó la feature en una migración con una sola función, sin tocar `errors.ts`.
- **El checklist encuentra huecos de requisitos, no de código.** El caso de "quitado que vuelve" no era un bug: era una decisión que nadie había tomado.
- **Los tests estaban definidos antes de que existiera el código.** El contrato del plan ya tenía la tabla de casos, el analyze agregó los que faltaban y el implement solo tuvo que escribirlos. Por eso el `db push` se hizo con 246 casos en verde ya ensayados.
- **Durante `implement`, el agente detectó un test que no podía fallar.** La prueba "el miembro existente no cambia" daba verde aunque la RPC lo sobrescribiera, porque los datos de partida ya coincidían con lo esperado. Cambió la preparación para que el test pudiera detectar el error y anotó el desvío en las tareas y el contrato.
- **Tener ya un `CLAUDE.md`, un skill de base de datos y `rules.sql` hizo que Spec Kit rindiera mucho más.** La constitución salió de reglas reales y cada fase tenía una puerta de calidad concreta.

### Qué no funcionó tan bien

- **Ediciones en Windows:** el agente editaba con `sed` y una inserción cayó en el medio de una tabla de la spec. Hubo que revisar los diffs de los artefactos, no solo los de código.
- **El hook de rama no corrió:** `/speckit-specify` dejó todo en `Develop` y hubo que crear la rama a mano.
- **Pasos superpuestos:** respondimos al `validate` y además corrimos `/speckit-constitution` con el mismo pedido, así que los cambios se aplicaron dos veces. El agente lo reconcilió, pero conviene seguir un solo camino.
- **Overhead:** para una feature de unas 330 líneas de código se generaron unas 1.100 líneas de artefactos. Para algo tan chico es mucho, pero el costo se pagó en revisión y no en retrabajo: no hubo que rehacer nada después de implementar.
- **Los commits del agente no siempre siguieron la convención** de la constitución. Uno quedó como `/speckit-implement fase 3`.

### Qué haríamos distinto

- Correr `clarify` siempre, aunque `specify` diga que no hay dudas abiertas: las decisiones tomadas en silencio son las que más conviene revisar.
- Implementar por fases y no de una vez, con una pausa obligatoria antes de cualquier cambio en la base.
- Agregar un CI mínimo (build, lint y test) para que las puertas de calidad no dependan de correrlas a mano.
