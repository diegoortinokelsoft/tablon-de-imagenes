# Supabase: base de datos, seguridad y operación

Documento técnico del backend del Tablón de Imágenes. Explica cómo está armado Supabase, por qué, y cómo cambiarlo sin romper las reglas del juego. La especificación funcional completa está en [especificacion.md](especificacion.md); el frontend, en [frontend.md](frontend.md).

> **Estado:** en producción desde octubre de 2026 (primera etapa). Proyecto Supabase `yirwqhiposuizeuxpeqw`, plan gratuito.

## 1. Principios

No hay servidor propio ni funciones serverless: la SPA habla directo con Supabase usando la clave pública. Por eso **toda la seguridad vive en Postgres**:

1. **Las tablas solo se leen.** RLS está activo en las cinco tablas y ninguna tiene políticas de `insert`, `update` ni `delete`. Además, los privilegios de escritura de `anon` y `authenticated` están revocados.
2. **Toda escritura pasa por funciones RPC** `security definer`, con `set search_path = ''` y nombres totalmente calificados. Cada RPC valida las reglas del juego por su cuenta: nada de lo que haga el navegador puede saltarlas.
3. **Solo entra el dominio `grupokelsoft.com`**, verificado en cuatro capas (ver sección 4).
4. **La clave `service_role` nunca llega al frontend.**

## 2. Acceso al proyecto

| Qué | Dónde |
| --- | --- |
| Panel | `https://supabase.com/dashboard/project/yirwqhiposuizeuxpeqw` |
| API | `https://yirwqhiposuizeuxpeqw.supabase.co` |
| CLI | `npx supabase` (dependencia de desarrollo del repo). El repo ya está vinculado: si una máquina nueva no lo está, `npx supabase login` y `npx supabase link --project-ref yirwqhiposuizeuxpeqw` (pide la contraseña de la base). |
| MCP de Supabase | Opcional, configurado en `.mcp.json`. Rechaza las migraciones que contienen `delete` (pide una confirmación que algunos clientes no muestran); para migraciones se usa la CLI. |

## 3. Modelo de datos

Cinco tablas y dos vistas en `public`. Definidas en [0001_schema.sql](../supabase/migrations/0001_schema.sql).

```text
auth.users ──1:1── profiles ──1:N── submissions ──1:N── votes
                       │                 │                │
                       └──────1:N────────┼────────────────┘ (voter_id)
                                         │
rounds ──1:N── submissions               │
rounds ──1:N── votes                     │
rounds.winner_submission_id ─────────────┘ (on delete set null)
admins (email)  ← sin relaciones, sin políticas de lectura
```

| Tabla | Propósito | Restricciones clave |
| --- | --- | --- |
| `admins` | Emails con rol de administrador | PK `email`, siempre en minúsculas. Cargada con `diego.martin.ortino@grupokelsoft.com`. |
| `profiles` | Nombre y avatar de Google | PK `id` → `auth.users` (cascade), `email` único |
| `rounds` | Competencias, la actual y las archivadas | Índice único parcial `rounds_one_current`: **una sola fila con `status <> 'archived'`**. Nombre de 1 a 80 caracteres. |
| `submissions` | Publicaciones | Único `(round_id, user_id)`: **una por persona y competencia**. Título de 1 a 80 caracteres. |
| `votes` | **Un voto por fila** | FK a `submissions` con `on delete cascade`: borrar una publicación borra sus votos y así vuelven a sus votantes. El límite de 3 lo controla `cast_vote`. |

Detalles que conviene saber:

- **Ciclo de claves foráneas.** `rounds.winner_submission_id` apunta a `submissions` con `on delete set null`, y `submissions.round_id` apunta a `rounds` con `on delete cascade`. Borrar una competencia con ganador funciona (lo prueba `rules.sql`).
- **Índices extra** sobre todas las claves foráneas (`submissions_user_idx`, `votes_voter_idx`, `rounds_winner_idx`), para borrados en cascada rápidos. Los advisors los marcan como "sin uso" mientras hay pocos datos; es esperable.
- **Votos restantes:** no se guardan. Se calculan como 3 menos las filas del usuario en `votes` para la competencia actual (en el cliente, y en `cast_vote` con bloqueo).

### Vistas

Ambas con `security_invoker = true`, así respetan el RLS de quien consulta.

| Vista | Una fila por | Columnas principales |
| --- | --- | --- |
| `board` | publicación | datos de `submissions` + `author_name`, `author_avatar`, `vote_count`, `position` |
| `vote_details` | publicación y votante | `submission_id`, `round_id`, `voter_id`, `voter_name`, `voter_avatar`, `vote_count` |

`position` sale de `rank() over (partition by round_id order by vote_count desc)`: los empates comparten posición (1, 1, 3). Como las vistas tipan todas sus columnas como opcionales, el frontend las normaliza con `toBoardItem` (`src/lib/board.ts`).

## 4. Autenticación y dominio

Solo hay login con Google. El dominio se controla en cuatro capas, porque las dos primeras solo filtran en la pantalla de Google:

| Capa | Dónde | Qué hace |
| --- | --- | --- |
| 1. Consentimiento "Interno" | Google Cloud | Google solo deja entrar a cuentas de la organización |
| 2. Parámetro `hd` | Frontend (`signInWithGoogle`) | Sugiere la cuenta del dominio; **no es una protección** |
| 3. Alta de usuario | `hook_before_user_created` (Auth Hook) **y** trigger `enforce_allowed_domain` | El hook rechaza con 403 y un mensaje claro. El trigger `before insert or update of email` en `auth.users` lanza `NOT_ALLOWED` aunque el hook esté apagado. |
| 4. RLS y RPC | `is_allowed_user()` | Toda política y toda RPC la exigen |

Funciones de [0002_auth.sql](../supabase/migrations/0002_auth.sql):

| Función | Tipo | Uso |
| --- | --- | --- |
| `is_allowed_email(text)` | `immutable` | Regla única de dominio: `^[^@]+@grupokelsoft\.com$` (una sola `@`, dominio exacto). La usan el hook, el trigger y `is_allowed_user`. El frontend replica el criterio en `isAllowedEmail`. |
| `is_allowed_user()` | `stable` | `is_allowed_email(auth.jwt() ->> 'email')` |
| `is_admin()` | `security definer` | El email del JWT, en minúsculas, está en `admins`. El frontend la llama solo para decidir si muestra el panel. |
| `current_round()` | `security definer` | La competencia no archivada. Uso interno (sin permiso para `authenticated`). |
| `handle_new_user()` | trigger `after insert` | Crea el perfil desde `raw_user_meta_data` (`full_name` o `name`, `avatar_url` o `picture`) |

Configuración del panel que **no está en migraciones** (ver el [README](../README.md) para los pasos):

- Proveedor Google activo con el cliente OAuth.
- **Proveedor Email desactivado**, y Phone y Anonymous apagados. Si Email quedara activo, alguien podría registrarse con un email del dominio que no le pertenece.
- URL Configuration: Site URL de Netlify, y Redirect URLs con Netlify y `http://localhost:5173` (cada una también con `/**`). Si falta o está mal escrita (sin `https://`), el login termina en `{"error":"requested path is invalid"}`.
- Auth Hook "Before User Created" conectado a `public.hook_before_user_created`.

## 5. Funciones RPC

Reglas comunes:
- Son `security definer` con `set search_path = ''`.
- Empiezan verificando `is_allowed_user()`.
- Ante un error lanzan `raise exception '<CÓDIGO>'` (el mensaje es exactamente el código).
- Los parámetros llevan prefijo `p_`.
- `execute` revocado a `public` y `anon`, otorgado a `authenticated`.

### Usuario ([0004_rpc_user.sql](../supabase/migrations/0004_rpc_user.sql))

| RPC | Devuelve | Condiciones y errores |
| --- | --- | --- |
| `sync_my_profile()` | `profiles` | Crea o actualiza el perfil desde `auth.users`. Se llama una vez por inicio de sesión. |
| `create_submission(p_title, p_image_path, p_width, p_height)` | `uuid` | Abierta (`ROUND_NOT_OPEN`); sin publicación previa (`ALREADY_SUBMITTED`); título válido (`INVALID_TITLE`); ruta válida y archivo existente (`INVALID_PATH`) |
| `update_submission_title(p_title)` | — | Abierta; tiene publicación (`NO_SUBMISSION`). Conserva los votos. |
| `replace_submission_image(p_image_path, p_width, p_height)` | ruta anterior | Abierta; borra los votos recibidos y cambia la imagen |
| `delete_my_submission()` | ruta | Abierta; los votos caen en cascada |
| `cast_vote(p_submission_id)` | — | Abierta; publicación de la competencia actual (`NO_SUBMISSION`); no propia (`OWN_SUBMISSION`); menos de 3 usados (`NO_VOTES_LEFT`) |
| `remove_vote(p_submission_id)` | — | Abierta; tiene un voto ahí (`NO_VOTE_TO_REMOVE`). Borra el más reciente. |

Auxiliares internos (sin permiso para `authenticated`):
- `clean_title(text)`: recorta los espacios y valida de 1 a 80 caracteres.
- `check_image_path(round, uid, path)`: la ruta debe ser exactamente `{round_id}/{uid}/{uuid}.webp` **y el objeto tiene que existir en Storage**.

### Administración ([0005_rpc_admin.sql](../supabase/migrations/0005_rpc_admin.sql))

Todas empiezan con `assert_admin()`, que lanza `NOT_ALLOWED` o `NOT_ADMIN`.

| RPC | Devuelve | Condiciones |
| --- | --- | --- |
| `admin_set_round_status(p_status)` | — | Solo `pending→open`, `open→closed`, `closed→open`; si no, `INVALID_TRANSITION`. Guarda `opened_at` y `closed_at`. |
| `admin_rename_round(p_name)` | — | `INVALID_NAME` si queda vacío o pasa de 80 |
| `admin_finalize_round(p_winner_submission_id)` | — | Estado `closed` (`INVALID_TRANSITION`); ganador de esta competencia (`INVALID_WINNER`). Cualquiera, aunque haya empate. |
| `admin_delete_submission(p_submission_id)` | ruta | Solo de la competencia actual (`NO_SUBMISSION`). **Si borra al ganador de una finalizada, la competencia vuelve a `closed`** sin ganador. |
| `admin_hard_reset(p_name)` | id borrado | Borra la competencia actual (cascada) y crea una nueva en `pending` |
| `admin_start_new_round(p_name)` | id nuevo | Estado `finalized`; archiva la actual y crea una nueva en `pending` |
| `admin_delete_archived_round(p_round_id)` | id borrado | Solo archivadas (`ROUND_NOT_ARCHIVED`) |

Transiciones de estado:

```text
pending ──abrir──▶ open ──cerrar──▶ closed ──finalizar──▶ finalized ──nueva competencia──▶ archived
                    ▲                  │
                    └─────reabrir──────┘
Reinicio total (desde cualquier estado): borra la actual y crea una nueva en pending.
Borrar al ganador de una finalizada: vuelve a closed.
```

### Códigos de error

`NOT_ALLOWED`, `NOT_ADMIN`, `ROUND_NOT_OPEN`, `ALREADY_SUBMITTED`, `NO_SUBMISSION`, `INVALID_PATH`, `INVALID_TITLE`, `OWN_SUBMISSION`, `NO_VOTES_LEFT`, `NO_VOTE_TO_REMOVE`, `INVALID_TRANSITION`, `INVALID_WINNER`, más dos agregados fuera de la especificación original: `INVALID_NAME` y `ROUND_NOT_ARCHIVED`.

Cada código tiene su mensaje en español en `src/lib/errors.ts`. **Un código nuevo en SQL requiere su mensaje ahí** (si no, se muestra el genérico "Algo salió mal").

### Concurrencia

- `cast_vote` y `remove_vote` toman `pg_advisory_xact_lock(hashtextextended(uid, 0))` antes de contar: diez clics simultáneos nunca superan 3 votos.
- Las RPC de usuario leen la competencia actual con `for share` y las de admin con `for update`. Así, cerrar la competencia espera a que terminen los votos en curso, y nadie publica ni vota "justo" mientras se cierra.
- `cast_vote` toma `for share` sobre la publicación y `replace_submission_image` toma `for update`. Así, un voto no sobrevive a un reemplazo de imagen que ocurre al mismo tiempo.

## 6. Storage

Definido en [0006_storage.sql](../supabase/migrations/0006_storage.sql).

- **Bucket `submissions`:** privado, 5 MB, solo `image/webp`, `image/jpeg` e `image/png`. Las imágenes se muestran con URLs firmadas de 1 hora.
- **Ruta:** `{round_id}/{user_id}/{uuid}.webp`. Cada subida usa un nombre nuevo; los archivos nunca se sobrescriben (no hay política de `update`).

| Política | Regla |
| --- | --- |
| `select` | `is_allowed_user()` |
| `insert` | Usuario del dominio, segunda carpeta = `auth.uid()`, primera carpeta = una competencia en estado `open` |
| `delete` | El admin cualquier archivo. El usuario solo de su carpeta **y que ninguna publicación referencia** (subida fallida, imagen reemplazada o publicación borrada). Así no puede romper el historial borrando su imagen después de cerrar. |

Supabase bloquea el `DELETE` directo sobre `storage.objects` desde SQL: **los archivos se borran siempre desde el cliente con la API de Storage**. Por eso las RPC devuelven rutas o ids:

| Flujo | Orden |
| --- | --- |
| Publicar | subir → `create_submission`; si falla, el cliente borra lo subido |
| Reemplazar | subir el nuevo → `replace_submission_image` → borrar la ruta anterior que devuelve |
| Borrar (usuario o admin) | RPC → borrar la ruta devuelta |
| Reinicio total o eliminar del historial | RPC → el cliente admin lista las carpetas `{round_id}/*/` y borra en lotes de 100 (`removeRoundFolder`) |

Si la limpieza de Storage falla, la base ya quedó bien y solo queda un archivo huérfano. La sección 10 tiene una consulta para encontrarlos.

## 7. Realtime

[0007_realtime.sql](../supabase/migrations/0007_realtime.sql) agrega `rounds`, `submissions` y `votes` a la publicación `supabase_realtime`. El cliente abre un canal `board` con `postgres_changes`; los eventos respetan RLS. `profiles` no está publicada (el número de participantes del panel se actualiza al volver a la ventana).

## 8. Migraciones

| Archivo | Contenido |
| --- | --- |
| `0001_schema.sql` | Tipo `round_status`, tablas, índices, vistas, admin y "Competencia 1" |
| `0002_auth.sql` | Funciones de dominio y admin, hook, trigger de dominio, trigger de perfiles |
| `0003_rls.sql` | RLS, políticas de lectura, revocación de escrituras |
| `0004_rpc_user.sql` | RPC de usuario |
| `0005_rpc_admin.sql` | RPC de administración |
| `0006_storage.sql` | Bucket y políticas |
| `0007_realtime.sql` | Publicación de Realtime |

**Reglas:**
- Nunca se cambia la base fuera de una migración.
- No se editan migraciones ya aplicadas: se agrega `0008_...`, `0009_...`.
- El historial remoto (`supabase_migrations.schema_migrations`) usa las mismas versiones que los archivos (`0001` a `0007`).

```bash
npx supabase db push --dry-run    # debe listar solo las migraciones nuevas
npx supabase db push
npm run types                     # regenera src/lib/database.types.ts
```

Si alguna vez se aplica con el MCP (`apply_migration`), el MCP registra una versión con marca de tiempo. Para alinear:

```bash
npx supabase migration repair --status reverted <versión-del-mcp>
npx supabase migration repair --status applied 000N
```

El procedimiento completo para un cambio de base está en la skill [`.claude/skills/cambio-base-de-datos`](../.claude/skills/cambio-base-de-datos/SKILL.md).

## 9. Pruebas de reglas

[supabase/tests/rules.sql](../supabase/tests/rules.sql) tiene **110 casos** que corren contra la base real dentro de una transacción con `rollback` (no deja datos).

```bash
npx supabase db query --linked -f supabase/tests/rules.sql -o json
```

Cómo está armado:
- Crea usuarios ficticios en `auth.users` (ana, beto, carla). Para el admin reutiliza el usuario real si ya existe, porque el email es único.
- `pg_temp.run_as(email, uid, sql)` simula a un usuario con `set local role authenticated` y `request.jwt.claims`, ejecuta el SQL y devuelve `OK[:valor]` o el mensaje de error. `pg_temp.run_as_anon` hace lo mismo para `anon`.
- `pg_temp.expect(caso, esperado, obtenido)` registra cada caso; coincide si es igual o si `obtenido` empieza con `esperado`.
- Para probar las políticas de borrado de Storage habilita `storage.allow_delete_query` solo dentro de la transacción.
- Termina con `select … from results` y `rollback`.

**Cuidados al agregar casos:**
- Dentro de `run_as`, el SQL va en `execute … into`. Un `insert` necesita `returning` (por ejemplo `returning 1`); si no, falla con "INTO used with a command that cannot return data".
- La salida de la CLI puede traer al final un aviso de versión nueva, después del JSON: al procesarla, cortar en la última `}`.

Lo que **no** cubre SQL: la concurrencia real de `cast_vote` (dos sesiones a la vez). Se probó a mano con diez clics rápidos.

## 10. Operación

**Advisors esperados** (`npx supabase db advisors` o el panel):
- *Signed-in users can execute SECURITY DEFINER function* en las RPC: es el diseño; cada una valida por dentro.
- *RLS enabled no policy* en `admins`: a propósito.
- *Unused index* con pocos datos.

**Plan gratuito:**
- El proyecto se pausa tras una semana sin actividad: entrar a la app o al panel antes de cada competencia.
- Cada competencia ocupa unos 100 MB de Storage. Si el espacio se acerca al límite, eliminar competencias viejas del historial.

**Consultas útiles** (solo lectura, con `npx supabase db query --linked "<sql>"`):

```sql
-- Archivos huérfanos (sin publicación que los use)
select o.name from storage.objects o
where o.bucket_id = 'submissions'
  and not exists (select 1 from public.submissions s where s.image_path = o.name);

-- Estado general
select name, status, opened_at, closed_at, finalized_at, archived_at from public.rounds order by created_at;

-- Votos por persona en la competencia actual
select p.full_name, count(*) from public.votes v join public.profiles p on p.id = v.voter_id
where v.round_id = (select id from public.rounds where status <> 'archived') group by 1 order by 2 desc;
```

**Cambiar o agregar un administrador** requiere una migración nueva (por ejemplo `insert into public.admins (email) values ('alguien@grupokelsoft.com');`). El email va en minúsculas; la tabla lo exige con un `check`.
