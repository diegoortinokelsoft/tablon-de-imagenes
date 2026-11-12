# Especificación de feature: [NOMBRE DE LA FEATURE]

**Rama**: `[###-nombre-feature]`

**Creada**: [FECHA]

**Estado**: Borrador

**Entrada**: Descripción del usuario: "$ARGUMENTS"

> Esta spec describe **solo el cambio**. La fuente de verdad del sistema es
> [docs/especificacion-v2.md](../../docs/especificacion-v2.md); al cerrar la feature se actualiza.

## Referencia a la especificación v2 *(obligatoria)*

<!--
  Qué secciones de docs/especificacion-v2.md toca esta feature y qué cambia en cada una.
  Si no toca ninguna sección existente, decir qué sección nueva habrá que agregar.
-->

| Sección de la v2 | Qué cambia |
|---|---|
| [p. ej. "Competencias"] | [Descripción breve del cambio] |

## Escenarios de usuario y pruebas *(obligatoria)*

<!--
  Las historias van PRIORIZADAS (P1, P2, P3...) y cada una se puede probar por separado:
  si se implementa solo una, igual entrega valor.
  Roles posibles: usuario, dueño de la competencia, miembro de una privada, superadmin,
  alguien sin acceso a una privada.
-->

### Historia 1 - [Título breve] (Prioridad: P1)

[Recorrido del usuario en lenguaje simple]

**Por qué esta prioridad**: [Valor que aporta]

**Prueba independiente**: [Cómo se prueba sola, p. ej. "Se prueba creando una competencia y ..."]

**Escenarios de aceptación**:

1. **Dado** [estado inicial], **cuando** [acción], **entonces** [resultado esperado]
2. **Dado** [estado inicial], **cuando** [acción], **entonces** [resultado esperado]

---

### Historia 2 - [Título breve] (Prioridad: P2)

[Recorrido del usuario en lenguaje simple]

**Por qué esta prioridad**: [Valor que aporta]

**Prueba independiente**: [Cómo se prueba sola]

**Escenarios de aceptación**:

1. **Dado** [estado inicial], **cuando** [acción], **entonces** [resultado esperado]

---

[Agregar más historias si hace falta, cada una con su prioridad]

### Casos borde

<!-- Pensar especialmente en: competencia privada sin acceso, cada estado de la competencia,
     superadmin vs. dueño, concurrencia (dos personas a la vez) y tiempo real. -->

- ¿Qué pasa cuando [condición límite]?
- ¿Cómo responde el sistema ante [escenario de error]?

## Requisitos *(obligatoria)*

### Requisitos funcionales

- **FR-001**: El sistema MUST [capacidad concreta]
- **FR-002**: Los usuarios MUST poder [interacción clave]
- **FR-003**: El sistema MUST [regla de datos o de comportamiento]

*Ejemplo de requisito sin definir:*

- **FR-004**: El sistema MUST [NEEDS CLARIFICATION: pregunta concreta]

### Roles y acceso

<!-- Quién puede ver y hacer qué. Eliminar filas que no apliquen. -->

| Rol | Puede | No puede (error esperado) |
|---|---|---|
| Usuario del dominio | [ ] | [ ] |
| Dueño de la competencia | [ ] | [ ] |
| Miembro de una privada | [ ] | [ ] |
| Sin acceso a la privada | [ ] | [p. ej. `NO_ACCESS`] |
| Superadmin | [ ] | [ ] |
| Cuenta de otro dominio | Nada | `NOT_ALLOWED` |

### Estados de la competencia afectados

<!-- Qué cambia en cada estado (pending, open, closed, finalized).
     Eliminar la sección si la feature no depende del estado. -->

- **[estado]**: [Qué se permite o cambia]

### Reglas de datos y seguridad *(si la feature toca la base)*

<!-- Solo el QUÉ, sin SQL. El cómo va en plan.md. Eliminar la sección si no aplica. -->

- **Datos nuevos o modificados**: [Qué información se guarda y de quién es]
- **Acciones nuevas o modificadas**: [Qué se puede hacer y quién; toda escritura es por RPC]
- **Visibilidad**: [Quién ve qué; contenido de privadas solo con acceso]
- **Imágenes (Storage)**: [Si se suben o borran archivos]
- **Tiempo real**: [Qué debe actualizarse sin recargar]
- **Errores nuevos**: [`CODIGO` → cuándo ocurre]

### Entidades clave *(si la feature maneja datos)*

- **[Entidad]**: [Qué representa, atributos clave sin detalles de implementación]

### Textos de la UI

<!-- Textos en español que aparecen en pantalla: botones, títulos, mensajes vacíos y de error.
     Eliminar la sección si no hay textos nuevos. -->

- [Lugar]: "[texto]"

## Criterios de éxito *(obligatoria)*

<!-- Medibles y sin detalles de tecnología. -->

### Resultados medibles

- **SC-001**: [Métrica medible, p. ej. "Una solicitud aparece al dueño en menos de 2 segundos"]
- **SC-002**: [Métrica medible]

## Supuestos

- [Supuesto sobre usuarios, alcance o datos]

## Fuera de alcance

- [Lo que esta feature explícitamente no hace]
