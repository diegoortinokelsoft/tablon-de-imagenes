---
name: cambio-base-de-datos
description: Procedimiento para cualquier cambio en la base de Supabase del Tablón de Imágenes (tablas, vistas, RPC, políticas RLS o de Storage, admins, Realtime). Usar siempre que haya que tocar supabase/migrations, agregar o modificar una RPC, un código de error o una regla del juego, o agregar un administrador.
---

# Cambio de base de datos

La seguridad de la app vive en Postgres: un cambio mal hecho puede abrir una puerta que el frontend no ve. Lee primero [docs/supabase.md](../../../docs/supabase.md) (modelo, RPC, Storage, pruebas) y respeta las reglas de [CLAUDE.md](../../../CLAUDE.md).

## Antes de empezar

1. Confirma con la persona qué regla cambia y por qué, si no está en `docs/especificacion-v2.md` (la fuente de verdad; la v1, `docs/especificacion.md`, queda como referencia). Si contradice la especificación, pregunta antes de seguir.
2. Si el cambio es destructivo (borra datos, columnas o tablas, o cambia una regla del juego en una competencia en curso), pide confirmación explícita.
3. Comprueba que la CLI está vinculada y que la base está al día con el repo:
   ```bash
   npx supabase migration list
   ```
   Local y remoto deben coincidir de `0001` a la última. Si no coinciden, frena y averigua por qué antes de tocar nada.

## 1. Escribir la migración

- Archivo nuevo `supabase/migrations/000N_descripcion.sql`, con N siguiente a la última. **Nunca edites una migración ya aplicada.**
- Encabezado con un comentario de qué hace, en español, como las demás.
- Toda función que escriba datos:
  - `language plpgsql security definer set search_path = ''`, con nombres totalmente calificados (`public.tabla`, `auth.uid()`).
  - Empieza con `if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;`. Las de admin, con `perform public.assert_admin();`.
  - Parámetros con prefijo `p_`.
  - Errores como `raise exception 'CODIGO_EN_MAYUSCULAS';`, sin texto adicional.
  - Si depende del estado de la competencia: `select * into v_round from public.rounds where id = p_round_id for share;` (usuario) o `for update` (admin).
  - Al final, `revoke execute on function … from public, anon;` y `grant execute on function … to authenticated;`. Las auxiliares internas también se revocan a `authenticated`.
- Tablas nuevas: `alter table … enable row level security;` y solo políticas de `select` con `(select public.is_allowed_user())`. Revoca los privilegios de escritura a `anon` y `authenticated` como en `0003_rls.sql`.
- Si la tabla debe verse en tiempo real: `alter publication supabase_realtime add table …` y agrega su clave en `REALTIME_QUERY_KEYS` (`src/lib/realtime.ts`).
- No se pueden borrar archivos de Storage desde SQL: si la RPC elimina algo con imagen, debe **devolver la ruta o el id** para que el cliente la borre (ver `src/lib/submissions.ts`, `src/lib/rounds.ts`, `src/lib/members.ts` y `src/lib/admin.ts`).

## 2. Aplicar

```bash
npx supabase db push --dry-run   # debe listar solo la migración nueva
npx supabase db push
npm run types                    # regenera src/lib/database.types.ts
```

No uses `apply_migration` del MCP para migraciones con `delete`: el MCP las rechaza. Si aplicaste alguna con el MCP, alinea el historial:

```bash
npx supabase migration repair --status reverted <versión-del-mcp>
npx supabase migration repair --status applied 000N
```

## 3. Frontend

- Código de error nuevo → mensaje en español en `ERROR_MESSAGES` (`src/lib/errors.ts`) y su caso en `errors.test.ts`.
- RPC nueva → llamarla desde `src/lib/submissions.ts` (participación), `src/lib/rounds.ts` (competencias), `src/lib/members.ts` (miembros e invitaciones) o `src/lib/admin.ts` (superadmin), nunca con `.insert()`, `.update()` o `.delete()` sobre tablas.
- Después de la acción, invalidar las claves de TanStack Query afectadas (ver `docs/frontend.md`, sección 5).

## 4. Probar

1. Agrega casos a `supabase/tests/rules.sql` dentro del bloque `do $$ … $$`: el camino feliz, cada código de error nuevo, un usuario normal llamando a algo de admin (`NOT_ADMIN`) y el dominio ajeno (`NOT_ALLOWED`). Patrón:
   ```sql
   perform pg_temp.expect('Descripción del caso', 'CODIGO_O_OK',
     pg_temp.run_as('ana.prueba@grupokelsoft.com', c_ana, 'select public.mi_rpc(''valor'')'));
   ```
   Dentro de `run_as` un `insert` necesita `returning 1`.
2. Ejecuta y verifica que **todos** los casos den `ok = true`:
   ```bash
   npx supabase db query --linked -f supabase/tests/rules.sql -o json > salida.json
   ```
   La salida puede traer al final un aviso de versión de la CLI: corta en la última `}` antes de parsear.
3. Revisa los advisors (`npx supabase db advisors`): solo deben aparecer los esperados (ver `docs/supabase.md`, sección 10).
4. `npm run build`, `npm run lint` y `npm test` en verde.

## 5. Cerrar

- Actualiza `docs/supabase.md` (tablas de RPC, códigos, Storage) y, si cambia una regla, `docs/especificacion-v2.md`.
- Commit con un mensaje claro en español, en la rama de trabajo (`Develop`), y el pie de atribución que indique la sesión.
- Resume a la persona qué cambió, los resultados de `rules.sql` y lo que tenga que probar en el navegador.
