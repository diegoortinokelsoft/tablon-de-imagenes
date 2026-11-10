# Contrato: `import_members`

Migración: `supabase/migrations/0014_import_members.sql`. Sección de la v2: "Seguridad: funciones y
RPC" → "RPC de miembros".

## Firma

```text
public.import_members(p_round_id uuid, p_source_round_id uuid) returns int
```

- `language plpgsql security definer set search_path = ''`, nombres totalmente calificados.
- `revoke execute … from public, anon`; `grant execute … to authenticated`.

| Parámetro | Qué es |
|---|---|
| `p_round_id` | Competencia de destino (la que se está gestionando) |
| `p_source_round_id` | Competencia de origen, de la que se copian los miembros |

**Devuelve**: cantidad de personas sumadas al destino (`0` o más).

## Quién

Dueño de **ambas** competencias. El superadmin no tiene excepción.

## Efectos

1. Agrega como miembros del destino, con `source = 'added'`, a los miembros actuales del origen que
   no lo sean ya.
2. Aprueba (`approved`, `resolved_at = now()`) las solicitudes pendientes en el destino de esas
   personas.
3. No modifica el origen, ni las membresías existentes del destino, ni Storage.

Todo en una sola transacción: si algo falla, no cambia nada.

## Errores (en orden de verificación)

| # | Condición | Código | Mensaje (ya existe en `errors.ts`) |
|---|---|---|---|
| 1 | Cuenta fuera del dominio | `NOT_ALLOWED` | (existente) |
| 2 | El destino no existe | `ROUND_NOT_FOUND` | La competencia no existe |
| 3 | El destino no es mío | `NOT_OWNER` | Solo quien creó la competencia puede hacer esto |
| 4 | El destino está limpiado | `ROUND_CLEANED` | Esta competencia fue archivada |
| 5 | El destino es pública | `NOT_PRIVATE` | Esta competencia es pública: no hace falta pedir acceso |
| 6 | El origen no existe | `ROUND_NOT_FOUND` | La competencia no existe |
| 7 | El origen no es mío | `NOT_OWNER` | Solo quien creó la competencia puede hacer esto |
| 8 | El origen está limpiado | `ROUND_CLEANED` | Esta competencia fue archivada |
| 9 | El origen es pública | `NOT_PRIVATE` | Esta competencia es pública: no hace falta pedir acceso |

Sin códigos nuevos. Origen = destino no es un error: devuelve `0`.

## Llamada desde el frontend

En `src/lib/members.ts`:

```ts
importMembers(roundId: string, sourceRoundId: string): Promise<number>
// supabase.rpc('import_members', { p_round_id: roundId, p_source_round_id: sourceRoundId })
```

Después de la llamada, `useManageAction` invalida `ROUND_QUERY_KEYS` y `HUB_QUERY_KEYS` (incluye la
clave del selector, `['hub', 'import_sources', roundId]`).

## Casos en `supabase/tests/rules.sql`

| Caso | Esperado |
|---|---|
| Rol anónimo ejecuta la RPC | rechazado (sin permiso) |
| Intruso (otro dominio) importa | `NOT_ALLOWED` |
| carla (no dueña) importa en B de beto | `NOT_OWNER` |
| Superadmin importa en B de beto | `NOT_OWNER` |
| beto importa en B desde una privada de ana | `NOT_OWNER` |
| beto importa en un destino inexistente | `ROUND_NOT_FOUND` |
| beto importa en B desde un origen inexistente | `ROUND_NOT_FOUND` |
| beto importa en una pública suya | `NOT_PRIVATE` |
| beto importa en B desde una pública suya | `NOT_PRIVATE` |
| beto importa en una limpiada suya | `ROUND_CLEANED` |
| beto importa en B desde una limpiada suya | `ROUND_CLEANED` |
| Camino feliz: A (carla, dani) → B (carla; dani con solicitud pendiente) | `OK:1` |
| Después: B tiene a carla y dani, una vez cada uno | 2 filas |
| Después: dani quedó con `source = 'added'` | `added` |
| Después: la solicitud de dani en B está aprobada | `approved` |
| Después: `source` y `joined_at` de carla en B sin cambios | iguales a antes |
| Después: la solicitud pendiente de ana en B (ana no está en A) | sigue `pending`; ana no es miembro de B |
| Después: A sigue con sus 2 miembros | 2 filas |
| Repetir A → B | `OK:0` |
| Origen = destino (A → A) | `OK:0` |
| dani quitado de B, solicitud de ana en B rechazada, ana agregada a A; importar A → B | `OK:2` |
| Después: dani y ana son miembros de B con `source = 'added'` | `added` |
| Después: la solicitud de ana en B | sigue `rejected` |

La concurrencia (dos importaciones simultáneas) no se prueba en `rules.sql`: la garantiza la clave
primaria `(round_id, user_id)` con `on conflict do nothing`.
