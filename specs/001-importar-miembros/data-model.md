# Modelo de datos: Importar miembros de otra competencia

**Sin cambios de esquema.** No hay tablas, columnas, enums, índices, vistas, políticas de RLS ni
cambios en la publicación de Realtime. La feature solo agrega una RPC
([contracts/import_members.md](contracts/import_members.md)) que escribe en tablas existentes.

## Tablas que se leen o escriben

### `public.rounds` (solo lectura)

| Columna | Uso |
|---|---|
| `id` | Destino (`p_round_id`) y origen (`p_source_round_id`) |
| `owner_id` | Ambos deben ser de `auth.uid()` |
| `visibility` | Ambos deben ser `private` |
| `cleaned_at` | Ambos deben ser `null` |
| `status` | No se verifica: cualquier estado sirve en los dos lados |

El destino se bloquea con `for update` (vía `round_for_owner`); el origen se lee sin bloqueo
(ver [research.md](research.md#3-sin-bloqueo-sobre-el-origen)).

### `public.round_members` (lectura del origen, inserción en el destino)

| Columna | Valor en las filas nuevas |
|---|---|
| `round_id` | `p_round_id` (destino) |
| `user_id` | Cada miembro del origen que no sea ya miembro del destino |
| `source` | `added` (clarificación 1) |
| `joined_at` | `now()` (por defecto) |

- La clave primaria `(round_id, user_id)` impide duplicados; las filas existentes del destino no se
  modifican (`on conflict do nothing`).
- Las filas del origen no se modifican.

### `public.access_requests` (actualización en el destino)

| Condición | Cambio |
|---|---|
| `round_id = p_round_id`, `status = 'pending'` y `user_id` entre los recién insertados | `status = 'approved'`, `resolved_at = now()` |

Las solicitudes rechazadas o ya aprobadas no cambian, ni las de personas que ya eran miembros, ni
las del origen.

## Reglas de validación (de la spec)

| Regla | Requisito | Error |
|---|---|---|
| Quien llama es del dominio | III | `NOT_ALLOWED` |
| Destino existe / es mío / no está limpiado | FR-009 | `ROUND_NOT_FOUND` / `NOT_OWNER` / `ROUND_CLEANED` |
| Destino privado | Casos borde | `NOT_PRIVATE` |
| Origen existe / es mío / no está limpiado | FR-009 | `ROUND_NOT_FOUND` / `NOT_OWNER` / `ROUND_CLEANED` |
| Origen privado | Clarificación 4 | `NOT_PRIVATE` |
| Origen = destino | Clarificación 2 | Sin error: devuelve 0 |
| Todo o nada | FR-010 | Cualquier error revierte la llamada |

## Estados

La importación no cambia el estado de ninguna competencia ni dispara el trigger de actividad
(`touch_round_activity` solo mira `submissions` y `votes`).

## Lectura para el selector (frontend)

`rounds` con conteo embebido de `round_members`, filtrado por dueño, privada, sin limpiar y distinta
del destino. Lo permiten las políticas actuales: `rounds` se lee en todo el dominio y el dueño ve
todas las membresías de sus competencias.
