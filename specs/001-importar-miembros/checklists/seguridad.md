# Checklist de seguridad y permisos: Importar miembros de otra competencia

**Propósito**: Revisar la calidad de los requisitos de seguridad y permisos (quién puede importar, qué se expone, qué se le hace a quién) antes de implementar
**Creado**: 2026-11-10
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [contrato](../contracts/import_members.md)

**Nota**: Checklist generado por `/speckit-checklist` a partir de la spec, el plan y el contrato.
**Responsable**: Es un artefacto de revisión de la calidad de los requisitos y lo marca quien revisa. Un ítem se marca `[x]` solo cuando quien revisa decide que el criterio se cumple.
**Significado de la marca**: `[x]` quiere decir que el requisito está bien escrito, no que la implementación esté terminada.

## Completitud de los requisitos

- [ ] CHK001 - ¿Están definidos los permisos para todos los roles que pueden intentar la acción (usuario del dominio, miembro, dueño de solo una de las dos, superadmin, otro dominio, sin sesión)? [Completeness, Spec §Roles y acceso]
- [x] CHK002 - ¿La spec define qué pasa al importar a alguien que el dueño **quitó** antes del destino? La importación lo volvería a sumar sin aviso. [Gap, Spec §FR-003]
- [x] CHK003 - ¿La spec define qué pasa al importar a alguien que **salió por su cuenta** del destino? Quedaría como miembro otra vez sin haberlo pedido. [Gap, Spec §FR-003]
- [x] CHK004 - ¿Está justificado como decisión que una solicitud **rechazada** en el destino no impida sumar a esa persona con la importación? [Clarity, Spec §Casos borde "Solicitudes rechazadas"]
- [ ] CHK005 - ¿Está documentado que sumar personas sin su consentimiento es aceptable porque ya pasa con "Agregar persona", o falta una decisión explícita? [Assumption, Spec §FR-012]
- [ ] CHK006 - ¿Está especificado qué datos del origen ve el dueño en el selector (nombre, estado, cantidad de miembros) y que no se muestra la lista de nombres de los miembros? [Completeness, Spec §FR-002]
- [x] CHK007 - ¿Se dice si hace falta dejar registro de quién importó, cuándo y desde qué competencia, o se excluye a propósito la auditoría? [Gap, Spec §Clarifications Q1]

## Claridad de los requisitos

- [ ] CHK008 - ¿Está definido "dueño de ambas competencias" sin ambigüedad: el dueño del destino es quien llama y el del origen es la misma persona? [Clarity, Spec §FR-009]
- [ ] CHK009 - ¿Está claro que el superadmin no tiene excepción ni siquiera en modo "Moderar", y que ese modo no muestra la importación? [Clarity, Spec §Historia 3, escenario 3]
- [ ] CHK010 - ¿Está especificado el orden de las verificaciones para que alguien que no es dueño del destino no pueda enterarse de nada del origen (si existe, si es privada, si está limpiada)? [Clarity, Contrato §Errores]
- [ ] CHK011 - ¿Está claro que "miembros actuales del origen" se calcula en el momento de la importación y no al abrir el diálogo? [Clarity, Spec §Supuestos]

## Consistencia de los requisitos

- [x] CHK012 - ¿FR-009 ("cualquier otro caso falla con `NOT_OWNER`") es consistente con los otros errores de la tabla de roles (`NOT_PRIVATE`, `ROUND_CLEANED`, `ROUND_NOT_FOUND`)? [Conflict, Spec §FR-009 vs §Roles y acceso]
- [x] CHK013 - ¿El mensaje de `NOT_PRIVATE` ("no hace falta pedir acceso") encaja con el contexto de importar, o hace falta aclarar que es aceptable reutilizarlo? [Consistency, Spec §Errores nuevos]
- [ ] CHK014 - ¿Las reglas de acceso de la importación coinciden con las de `add_member` en la v2 (solo privadas, solo el dueño, aprueba la solicitud pendiente)? [Consistency, Spec §FR-005, §FR-006]
- [ ] CHK015 - ¿La lista de errores del contrato coincide en códigos y orden con la tabla "Roles y acceso" de la spec y con las reglas de validación de data-model.md? [Consistency, Contrato §Errores]

## Calidad de los criterios de aceptación

- [ ] CHK016 - ¿SC-004 ("ninguna persona que no sea dueña de ambas logra sumar miembros") se puede verificar de forma objetiva, con un caso por cada rol de la tabla de roles? [Measurability, Spec §SC-004]
- [ ] CHK017 - ¿Los escenarios de aceptación de la Historia 3 cubren también el otro dominio, la sesión anónima y un miembro del destino, o solo el destino ajeno, el origen ajeno y el superadmin? [Coverage, Spec §Historia 3]
- [ ] CHK018 - ¿Está definido como criterio verificable que una importación fallida no deja membresías ni solicitudes aprobadas? [Acceptance Criteria, Spec §FR-010]

## Cobertura de escenarios y casos borde

- [ ] CHK019 - ¿Está definido qué pasa si el destino cambia de visibilidad, se borra o se limpia mientras la importación está en curso? [Edge Case, Spec §Casos borde]
- [ ] CHK020 - ¿Está definido qué pasa si el origen se borra o se limpia mientras la importación está en curso (se usa la foto del instante, falla, o devuelve 0)? [Edge Case, Plan research §3]
- [ ] CHK021 - ¿La spec dice quién recibe los avisos en tiempo real de las membresías nuevas y que nadie sin acceso recibe datos del destino por ese canal? [Gap, Spec §FR-008]
- [ ] CHK022 - ¿Está cubierto que un origen privado con personas cuya cuenta ya no existe no suma perfiles inexistentes? [Edge Case, Gap]

## Requisitos no funcionales

- [x] CHK023 - ¿Hay un límite de cantidad de personas por importación, o un motivo explícito para no tenerlo? [Gap, Spec §SC-001]
- [ ] CHK024 - ¿Está documentado que la lectura de los orígenes (competencias propias con su cantidad de miembros) solo usa datos que RLS ya expone al dueño, sin abrir lecturas nuevas? [Completeness, Spec §Visibilidad, Plan research §5]

## Dependencias y supuestos

- [ ] CHK025 - ¿Está validado el supuesto de que el dueño nunca es miembro de sus competencias, del que depende que la importación no lo agregue a sí mismo? [Assumption, Spec §Supuestos]
- [ ] CHK026 - ¿Está documentada la dependencia del límite de 2 competencias activas y que no se puede saltar con la importación (solo crea membresías, no competencias)? [Dependency, Spec §Supuestos]

## Notas

- Marcar un ítem `[x]` solo después de que la revisión confirme que el requisito está bien escrito
- Dejar sin marcar los ítems que todavía necesitan aclaración, corrección o revisión
- `/speckit-implement` lee el estado de las casillas como puerta y no modifica las marcas
- `checklists/requirements.md` tiene su propio ciclo, que mantienen `/speckit-specify` y `/speckit-clarify`
- Agregar comentarios o hallazgos debajo de cada ítem
- Los ítems se numeran en orden para poder citarlos
