# Especificación de feature: Importar miembros de otra competencia

**Rama**: `001-importar-miembros`

**Creada**: 2026-11-10

**Estado**: Borrador

**Entrada**: Descripción del usuario: "Importar miembros de otra competencia. Hoy, para armar una competencia privada con el mismo grupo de personas que una anterior, el dueño tiene que agregarlos uno por uno; la especificación v2 dejó "Invitar a los mismos de otra competencia" para una versión posterior. Quiero que, desde la gestión de una competencia privada propia, el dueño pueda elegir otra competencia suya y sumar de una vez a sus miembros. Las personas que ya son miembros no se duplican. Si alguna tenía una solicitud de acceso pendiente, queda aprobada, igual que al agregarla a mano. Al terminar, el dueño ve cuántas personas se sumaron. Solo el dueño de ambas competencias puede hacerlo."

> Esta spec describe **solo el cambio**. La fuente de verdad del sistema es
> [docs/especificacion-v2.md](../../docs/especificacion-v2.md); al cerrar la feature se actualiza.

## Referencia a la especificación v2 *(obligatoria)*

| Sección de la v2 | Qué cambia |
|---|---|
| "Alcance" (lista de lo que no incluye) | Se quita "Invitar a los mismos de otra competencia (queda para una versión posterior)": pasa a estar incluido |
| "Acceso a competencias privadas" → "Formas de entrar a una privada" | Nueva forma: "Importar de otra competencia". El dueño suma de una vez a los miembros de otra privada suya, sin aprobación de ellos |
| "Seguridad: funciones y RPC" → "RPC de miembros" | Nueva acción del dueño para importar miembros de otra competencia; devuelve cuántas personas se sumaron |
| "Seguridad: funciones y RPC" → códigos de error | Un código nuevo para cuando la competencia de origen es la misma que la de destino (ver "Errores nuevos") |
| "Criterios de aceptación" | Se suman los criterios de importación (sin duplicados, solicitudes aprobadas, solo el dueño de ambas) |
| "Pantallas" → "Panel de gestión" → "Miembros" | Nuevo control "Importar de otra competencia" junto al buscador de perfiles |

## Escenarios de usuario y pruebas *(obligatoria)*

### Historia 1 - Sumar de una vez a los miembros de otra competencia (Prioridad: P1)

La dueña de una competencia privada que terminó crea una nueva, también privada, para el mismo
equipo. En el panel de gestión de la nueva, dentro de "Miembros", abre "Importar de otra
competencia", ve la lista de sus otras competencias privadas con la cantidad de miembros de cada
una, elige la anterior y confirma. Todos los miembros de la anterior pasan a ser miembros de la
nueva y la pantalla le avisa cuántas personas se sumaron.

**Por qué esta prioridad**: es todo el valor de la feature: evita agregar a cada persona a mano.

**Prueba independiente**: Se prueba con una competencia privada A con tres miembros y una
competencia privada B nueva del mismo dueño, sin miembros: al importar de A en B, B queda con
los mismos tres miembros y el aviso dice "Se sumaron 3 personas".

**Escenarios de aceptación**:

1. **Dado** que soy dueño de las privadas A (3 miembros) y B (sin miembros), **cuando** importo
   los miembros de A en B, **entonces** B tiene esos 3 miembros, la lista de miembros de B se
   actualiza sin recargar y veo "Se sumaron 3 personas".
2. **Dado** que importé los miembros de A en B, **cuando** uno de ellos entra a B, **entonces**
   ve su contenido y participa como cualquier miembro, sin haber pedido acceso.
3. **Dado** que importé los miembros de A en B, **cuando** miro A, **entonces** A sigue igual
   (sus miembros no cambian).

---

### Historia 2 - Sin duplicados y con las solicitudes resueltas (Prioridad: P1)

La competencia de destino ya tiene algunos miembros y alguna persona pidió acceso. Al importar,
quienes ya eran miembros no se repiten ni pierden nada, y las solicitudes pendientes de quienes
se suman quedan aprobadas, igual que al agregarlos a mano.

**Por qué esta prioridad**: sin esta regla la importación rompería datos existentes o dejaría
solicitudes colgadas; es parte del mínimo para que la feature sea correcta.

**Prueba independiente**: Se prueba con A (miembros X, Y, Z) y B (miembro X; Y con solicitud
pendiente): al importar de A en B, B queda con X, Y y Z, la solicitud de Y queda aprobada y el
aviso dice "Se sumaron 2 personas".

**Escenarios de aceptación**:

1. **Dado** que X ya es miembro de B y también de A, **cuando** importo de A en B, **entonces** X
   sigue siendo miembro de B una sola vez, con su publicación y sus votos intactos, y no cuenta
   entre las personas sumadas.
2. **Dado** que Y tiene una solicitud pendiente en B y es miembro de A, **cuando** importo de A en
   B, **entonces** Y queda como miembro de B, su solicitud aparece como aprobada y desaparece de
   la lista de solicitudes pendientes (y del contador) sin recargar.
3. **Dado** que todos los miembros de A ya son miembros de B, **cuando** importo de A en B,
   **entonces** nada cambia y veo "No se sumó nadie: todos ya eran miembros".

---

### Historia 3 - Solo el dueño de ambas competencias (Prioridad: P2)

Nadie puede usar la importación para colarse en una competencia ajena ni para copiar los
miembros de una competencia que no es suya.

**Por qué esta prioridad**: es una regla de seguridad; la interfaz ya solo muestra competencias
propias, pero la regla debe valer aunque alguien intente la acción por fuera de la pantalla.

**Prueba independiente**: Se prueba intentando la importación con un destino ajeno, con un
origen ajeno y desde una cuenta de otro dominio; las tres fallan y no se agrega a nadie.

**Escenarios de aceptación**:

1. **Dado** que B no es mía, **cuando** intento importar en B, **entonces** falla con "Solo quien
   creó la competencia puede hacer esto" y B no cambia.
2. **Dado** que B es mía pero A no, **cuando** intento importar de A en B, **entonces** falla con
   el mismo mensaje y B no cambia.
3. **Dado** que soy superadmin y B no es mía, **cuando** intento importar en B, **entonces** falla
   igual: el superadmin no gestiona miembros de competencias ajenas.

### Casos borde

- **Destino público**: las públicas no tienen miembros; el control no aparece y la acción falla
  con "Esta competencia es pública: no hace falta pedir acceso" (`NOT_PRIVATE`, el mismo error que
  agregar un miembro a mano en una pública).
- **Origen público**: las públicas no tienen miembros, así que no se ofrecen como origen. Si se
  intenta igual, falla con `NOT_PRIVATE` (ver Supuestos).
- **Origen igual al destino**: no se ofrece; si se intenta, falla con `SAME_ROUND`.
- **Origen sin miembros**: aparece en la lista con "0 miembros" y deshabilitado (no se puede
  elegir).
- **Origen o destino archivado (limpiado)**: un destino limpiado no tiene panel de gestión y la
  acción falla con `ROUND_CLEANED`. Un origen limpiado no tiene miembros, así que no se ofrece; si
  se intenta, falla con `ROUND_CLEANED`.
- **Origen o destino inexistente** (por ejemplo, borrado mientras el diálogo estaba abierto):
  falla con `ROUND_NOT_FOUND` y no se agrega a nadie.
- **No tengo otras privadas**: el control muestra "No tienes otras competencias privadas con
  miembros" en lugar de la lista.
- **Estados**: el origen puede estar en cualquier estado (lo habitual es que esté finalizada). El
  destino, en cualquier estado sin limpiar, igual que al agregar a mano.
- **Concurrencia**: si mientras importo alguien entra a B por enlace, o el dueño lo agrega a mano,
  esa persona queda una sola vez y no cuenta como sumada por la importación. Dos importaciones
  simultáneas en B no generan duplicados.
- **Quien sale después**: un miembro importado puede salir o ser quitado como cualquier otro; la
  importación no se "recuerda".
- **Solicitudes rechazadas**: una solicitud rechazada de alguien que se suma no cambia; la persona
  igual queda como miembro.
- **Todo o nada**: si la acción falla, no se agrega a nadie ni se aprueba ninguna solicitud.

## Requisitos *(obligatoria)*

### Requisitos funcionales

- **FR-001**: En el panel de gestión de una competencia privada propia, sección "Miembros", el
  dueño MUST poder abrir "Importar de otra competencia".
- **FR-002**: El sistema MUST ofrecer como origen solo las otras competencias privadas del mismo
  dueño, sin limpiar, en cualquier estado, mostrando para cada una su nombre, su estado y su
  cantidad de miembros. Las que tienen 0 miembros aparecen deshabilitadas.
- **FR-003**: Al confirmar, el sistema MUST agregar como miembros del destino, en una sola
  operación, a todos los miembros del origen que no sean ya miembros del destino.
- **FR-004**: El sistema MUST NOT duplicar a quien ya es miembro del destino, ni modificar su
  membresía, su publicación o sus votos.
- **FR-005**: Para cada persona sumada que tenga una solicitud de acceso pendiente en el destino,
  el sistema MUST marcar esa solicitud como aprobada, igual que al agregarla a mano.
- **FR-006**: El sistema MUST registrar a las personas sumadas como agregadas por el dueño (el
  mismo origen de membresía que "Agregar persona").
- **FR-007**: Al terminar, el sistema MUST informar al dueño cuántas personas se sumaron (0 o más)
  con el texto correspondiente de "Textos de la UI".
- **FR-008**: La lista de miembros y la de solicitudes del destino MUST actualizarse sin recargar,
  tanto para el dueño como para cualquier otra pantalla abierta que las muestre (contador de
  solicitudes en el hub y en el encabezado).
- **FR-009**: Solo quien es dueño de ambas competencias MUST poder importar; cualquier otro caso
  falla sin cambios con `NOT_OWNER`. El superadmin no tiene excepción.
- **FR-010**: La importación MUST ser todo o nada: si falla, no se agrega a nadie ni se aprueba
  ninguna solicitud.
- **FR-011**: El origen MUST quedar sin cambios.
- **FR-012**: La importación MUST NOT notificar a las personas sumadas (no hay emails en el
  sistema); simplemente ven la competencia en el hub como miembros.

### Roles y acceso

| Rol | Puede | No puede (error esperado) |
|---|---|---|
| Usuario del dominio | Nada nuevo | Importar en una competencia ajena (`NOT_OWNER`) |
| Dueño de la competencia | Importar en su privada los miembros de otra privada suya | Importar desde una competencia ajena (`NOT_OWNER`); importar en o desde una pública (`NOT_PRIVATE`); importar de la misma competencia (`SAME_ROUND`); importar en o desde una limpiada (`ROUND_CLEANED`) |
| Miembro de una privada | Nada nuevo (puede ser sumado por la importación) | Importar (`NOT_OWNER`) |
| Superadmin | Importar solo entre competencias propias, como cualquier dueño | Importar en o desde competencias ajenas (`NOT_OWNER`) |
| Cuenta de otro dominio | Nada | `NOT_ALLOWED` |

### Estados de la competencia afectados

- **Destino** (`pending`, `open`, `closed`, `finalized`): se puede importar en cualquiera, igual
  que agregar a mano. No en una limpiada.
- **Origen** (`pending`, `open`, `closed`, `finalized`): cualquiera sirve como origen. No una
  limpiada.

### Reglas de datos y seguridad

- **Datos nuevos o modificados**: no hay datos nuevos. Se crean membresías en el destino (con
  origen "agregado por el dueño") y se aprueban solicitudes pendientes, igual que con "Agregar
  persona".
- **Acciones nuevas o modificadas**: una acción nueva del dueño, "importar miembros", que recibe
  la competencia de destino y la de origen y devuelve la cantidad de personas sumadas. Es una
  escritura, así que va por RPC.
- **Visibilidad**: el dueño ya ve los miembros de sus competencias; para la lista de orígenes solo
  hace falta la cantidad de miembros de cada privada propia, que ya puede ver. Nadie más ve datos
  nuevos.
- **Imágenes (Storage)**: no se suben ni se borran archivos.
- **Tiempo real**: los cambios en miembros y solicitudes del destino se reflejan como hoy, sin
  recargar.
- **Errores nuevos**: `SAME_ROUND` → la competencia de origen es la misma que la de destino.
  Mensaje: "Elige otra competencia distinta de esta". Los demás errores (`NOT_ALLOWED`,
  `NOT_OWNER`, `NOT_PRIVATE`, `ROUND_NOT_FOUND`, `ROUND_CLEANED`) ya existen.

### Entidades clave

- **Competencia de origen**: otra competencia privada del mismo dueño, de la que se toman los
  miembros. No cambia.
- **Competencia de destino**: la competencia privada cuyo panel se está gestionando, que recibe
  los miembros.
- **Membresía**: relación persona–competencia privada; la importación crea las que falten en el
  destino, marcadas como agregadas por el dueño.
- **Solicitud de acceso**: si una persona sumada tenía una pendiente en el destino, pasa a
  aprobada.

### Textos de la UI

- Botón en "Miembros": "Importar de otra competencia"
- Título del diálogo: "Importar miembros"
- Explicación del diálogo: "Elige una de tus competencias privadas. Sus miembros se sumarán a esta;
  quienes ya son miembros no se repiten."
- Cada opción: "[nombre] · [estado] · N miembros" ("1 miembro" en singular)
- Sin opciones: "No tienes otras competencias privadas con miembros"
- Botón de confirmación: "Importar"; botón secundario: "Cancelar"
- Resultado: "Se sumaron N personas" ("Se sumó 1 persona" en singular)
- Resultado vacío: "No se sumó nadie: todos ya eran miembros"
- Error `SAME_ROUND`: "Elige otra competencia distinta de esta"

## Criterios de éxito *(obligatoria)*

### Resultados medibles

- **SC-001**: El dueño arma el grupo de miembros de una nueva privada a partir de otra en una sola
  acción y en menos de 30 segundos, sin importar cuántos miembros tenga el origen.
- **SC-002**: Después de importar, el destino tiene exactamente la unión de sus miembros previos y
  los del origen, sin duplicados, en el 100 % de los casos (incluidas dos importaciones
  simultáneas).
- **SC-003**: La cantidad informada al dueño coincide siempre con la cantidad de membresías nuevas
  del destino.
- **SC-004**: Ninguna persona que no sea dueña de ambas competencias logra sumar miembros: todos
  los intentos fallan sin cambios.
- **SC-005**: Las personas sumadas y las solicitudes aprobadas se ven en la gestión del destino en
  menos de 2 segundos, sin recargar.

## Supuestos

- Solo las competencias privadas tienen miembros, así que solo ellas sirven como origen. No se
  importan "participantes" (quienes publicaron o votaron) de una competencia pública.
- El dueño no es miembro de sus competencias, así que la importación nunca lo agrega a sí mismo.
- Se importan los miembros actuales del origen: quienes salieron o fueron quitados antes no se
  suman, y las solicitudes pendientes o rechazadas del origen se ignoran.
- No hace falta pedir confirmación aparte de elegir el origen y tocar "Importar": la acción no
  borra nada y cualquier miembro sumado se puede quitar después.
- Las personas sumadas no cuentan para el límite de 2 competencias activas (ese límite es solo de
  dueños), igual que hoy.
- Un dueño tiene pocas competencias privadas (el límite de activas es 2, más las finalizadas), así
  que la lista de orígenes no necesita buscador ni paginación.

## Fuera de alcance

- Elegir a mano qué miembros del origen importar (se importan todos).
- Importar desde varias competencias a la vez.
- Importar participantes de competencias públicas o miembros de competencias ajenas.
- Sincronizar: si después el origen cambia sus miembros, el destino no se entera.
- Avisar a las personas sumadas.
- Importar solicitudes pendientes del origen o el enlace de invitación.
