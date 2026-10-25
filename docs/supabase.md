# Supabase: base de datos, seguridad y operación

Documento técnico del backend del Tablón de Imágenes. Explica cómo está armado Supabase, por qué, y cómo cambiarlo sin romper las reglas del juego. La especificación funcional está en [especificacion-v2.md](especificacion-v2.md) (la v1, en [especificacion.md](especificacion.md)); el frontend, en [frontend.md](frontend.md).

> **Estado:** base de la v2 aplicada el 24/10/2026 (migraciones `0008` a `0013`), con el frontend v2 en desarrollo en la rama `v2`. Proyecto Supabase `yirwqhiposuizeuxpeqw`, plan gratuito.

## 1. Principios

No hay servidor propio ni funciones serverless: la SPA habla directo con Supabase usando la clave pública. Por eso **toda la seguridad vive en Postgres**:

1. **Las tablas solo se leen.** RLS está activo en todas las tablas y ninguna tiene políticas de `insert`, `update` ni `delete`. Además, los privilegios de escritura de `anon` y `authenticated` están revocados.
2. **Toda escritura pasa por funciones RPC** `security definer`, con `set search_path = ''` y nombres totalmente calificados. Cada RPC valida las reglas del juego y el acceso por su cuenta: nada de lo que haga el navegador puede saltarlas.
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

Diez tablas y dos vistas en `public`. Hay muchas competencias a la vez, cada una con dueño y visibilidad.

```text
auth.users ──1:1── profiles ──1:N── rounds (owner_id, on delete restrict)
                       │
                       ├──1:N── submissions ──1:N── votes
                       ├──1:N── votes (voter_id)
                       ├──1:N── round_members
                       └──1:N── access_requests

rounds ──1:N── submissions, votes, round_members, access_requests  (on delete cascade)
rounds ──1:1── round_invites, round_archives                        (on delete cascade)
rounds.winner_submission_id ──▶ submissions (on delete set null)
round_deletions (round_id sin FK: la competencia ya no existe)
admins (email)  ← sin relaciones, sin políticas de lectura
```

| Tabla | Propósito | Restricciones clave |
| --- | --- | --- |
| `admins` | Superadmins | PK `email`, siempre en minúsculas. Cargada con `diego.martin.ortino@grupokelsoft.com`. |
| `profiles` | Nombre y avatar de Google | PK `id` → `auth.users` (cascade), `email` único |
| `rounds` | Competencias | `owner_id` → `profiles` (`restrict`), `visibility` (`public`/`private`), `last_activity_at`, `cleaned_at`. Nombre de 1 a 80 caracteres. |
| `round_members` | Miembros de las privadas | PK `(round_id, user_id)`; `source`: `invite_link`, `added` o `request` |
| `round_invites` | Token del enlace de invitación | PK `round_id`, `token` único. Se crea junto con la competencia. |
| `access_requests` | Solicitudes de acceso | Índice único parcial `access_requests_one_pending`: **una pendiente por persona y competencia** |
| `round_archives` | Exportación a Drive y foto del resultado | PK `round_id`; `drive_url`, `exported_at`, `snapshot` (jsonb) |
| `round_deletions` | Quién borró cada competencia | PK `round_id` (sin FK), `deleted_by`. Permite limpiar sus archivos (sección 6). |
| `submissions` | Publicaciones | Único `(round_id, user_id)`: **una por persona y competencia**. Título de 1 a 80 caracteres. |
| `votes` | **Un voto por fila** | FK a `submissions` con `on delete cascade`: borrar una publicación borra sus votos y así vuelven a sus votantes. El límite de 3 por competencia lo controla `cast_vote`. |

Detalles que conviene saber:

- **Estados.** `round_status` es `pending`, `open`, `closed` o `finalized`. El `archived` de la v1 desapareció en `0008`: una finalizada queda como su propio historial. Una competencia limpiada (`cleaned_at` no nulo) conserva su estado.
- **Competencias activas:** `status <> 'finalized'` y `cleaned_at is null`. Un dueño puede tener 2 (índice parcial `rounds_owner_active_idx`); el superadmin no tiene límite.
- **Ciclo de claves foráneas.** `rounds.winner_submission_id` apunta a `submissions` con `on delete set null`, y `submissions.round_id` apunta a `rounds` con `on delete cascade`. Borrar una competencia con ganador funciona (lo prueba `rules.sql`).
- **Actividad.** El trigger `touch_round_activity` (en `submissions` y `votes`) actualiza `rounds.last_activity_at` como mucho una vez por hora, con `for update skip locked` para no esperar a otros votos en curso. No toca competencias limpiadas. Las RPC que cambian estado, nombre o visibilidad también la actualizan.
- **Votos restantes:** no se guardan. Son 3 menos las filas del usuario en `votes` para esa competencia.

### Vistas

Ambas con `security_invoker = true`, así respetan el RLS de quien consulta (y por lo tanto, el acceso a las privadas).

| Vista | Una fila por | Columnas principales |
| --- | --- | --- |
| `board` | publicación | datos de `submissions` + `author_name`, `author_avatar`, `vote_count`, `position` |
| `vote_details` | publicación y votante | `submission_id`, `round_id`, `voter_id`, `voter_name`, `voter_avatar`, `vote_count` |

`position` sale de `rank() over (partition by round_id order by vote_count desc)`: los empates comparten posición (1, 1, 3). Como las vistas tipan todas sus columnas como opcionales, el frontend las normaliza con `toBoardItem` (`src/lib/board.ts`).

## 4. Autenticación, dominio y acceso

Solo hay login con Google. El dominio se controla en cuatro capas, porque las dos primeras solo filtran en la pantalla de Google:

| Capa | Dónde | Qué hace |
| --- | --- | --- |
| 1. Consentimiento "Interno" | Google Cloud | Google solo deja entrar a cuentas de la organización |
| 2. Parámetro `hd` | Frontend (`signInWithGoogle`) | Sugiere la cuenta del dominio; **no es una protección** |
| 3. Alta de usuario | `hook_before_user_created` (Auth Hook) **y** trigger `enforce_allowed_domain` | El hook rechaza con 403 y un mensaje claro. El trigger `before insert or update of email` en `auth.users` lanza `NOT_ALLOWED` aunque el hook esté apagado. |
| 4. RLS y RPC | `is_allowed_user()` | Toda política y toda RPC la exigen |

Funciones base:

| Función | Tipo | Uso |
| --- | --- | --- |
| `is_allowed_email(text)` | `immutable` | Regla única de dominio: `^[^@]+@grupokelsoft\.com$` (una sola `@`, dominio exacto). La usan el hook, el trigger y `is_allowed_user`. El frontend replica el criterio en `isAllowedEmail`. |
| `is_allowed_user()` | `stable` | `is_allowed_email(auth.jwt() ->> 'email')` |
| `is_admin()` | `security definer` | El email del JWT, en minúsculas, está en `admins` (superadmin). |
| `can_view_round(id)` | `security definer` | **Acceso al contenido** de una competencia: es pública, o el usuario es el dueño, miembro o superadmin. La usan las políticas de `submissions`, `votes`, `round_archives` y Storage, y las RPC. |
| `is_round_owner(id)` | `security definer` | El usuario es el dueño |
| `handle_new_user()` | trigger `after insert` | Crea el perfil desde `raw_user_meta_data` (`full_name` o `name`, `avatar_url` o `picture`) |

**Políticas de lectura** (todas exigen además `is_allowed_user()`):

| Tabla | Quién lee |
| --- | --- |
| `profiles`, `rounds` | Todo el dominio. `rounds` solo tiene datos generales, por eso las privadas se listan en el hub. |
| `submissions`, `votes` | `can_view_round(round_id)` |
| `round_members`, `access_requests` | El propio usuario, el dueño de la competencia o el superadmin |
| `round_invites` | El dueño o el superadmin |
| `round_archives` | `can_view_round(round_id)`, y solo las columnas `round_id`, `exported_at` y `snapshot` (permiso por columna): `drive_url` sale solo por `admin_archives()` |
| `admins`, `round_deletions` | Nadie (sin políticas) |

Configuración del panel que **no está en migraciones** (ver el [README](../README.md) para los pasos):

- Proveedor Google activo con el cliente OAuth.
- **Proveedor Email desactivado**, y Phone y Anonymous apagados. Si Email quedara activo, alguien podría registrarse con un email del dominio que no le pertenece.
- URL Configuration: Site URL de Netlify, y Redirect URLs con Netlify y `http://localhost:5173` (cada una también con `/**`). Si falta o está mal escrita (sin `https://`), el login termina en `{"error":"requested path is invalid"}`.
- Auth Hook "Before User Created" conectado a `public.hook_before_user_created`.

## 5. Funciones RPC

Reglas comunes:
- Son `security definer` con `set search_path = ''`.
- Empiezan verificando `is_allowed_user()`; las del superadmin, con `assert_admin()`.
- Ante un error lanzan `raise exception '<CÓDIGO>'` (el mensaje es exactamente el código).
- Los parámetros llevan prefijo `p_`.
- `execute` revocado a `public` y `anon`, otorgado a `authenticated`. Los auxiliares internos también se revocan a `authenticated`.

Auxiliares internos:
- `clean_title(text)` y `clean_round_name(text)`: recortan los espacios y validan de 1 a 80 caracteres.
- `check_image_path(round, uid, path)`: la ruta debe ser exactamente `{round_id}/{uid}/{uuid}.webp` **y el objeto tiene que existir en Storage**.
- `round_for_participant(id)`: toma la competencia con `for share` y verifica que exista (`ROUND_NOT_FOUND`), el acceso (`NO_ACCESS`) y que no esté limpiada (`ROUND_CLEANED`).
- `round_for_owner(id)`: igual, con `for update`, y exige ser el dueño (`NOT_OWNER`).
- `purge_participant(round, user)`: borra los votos, la publicación y la membresía de una persona; si era la ganadora, la competencia vuelve a `closed`.
- `assert_admin()`: lanza `NOT_ALLOWED` o `NOT_ADMIN`.

### Participación ([0010_v2_rpc.sql](../supabase/migrations/0010_v2_rpc.sql))

| RPC | Devuelve | Condiciones y errores |
| --- | --- | --- |
| `sync_my_profile()` | `profiles` | Crea o actualiza el perfil desde `auth.users`. Se llama una vez por inicio de sesión. |
| `create_submission(p_round_id, p_title, p_image_path, p_width, p_height)` | `uuid` | Acceso; abierta (`ROUND_NOT_OPEN`); sin publicación previa (`ALREADY_SUBMITTED`); título válido (`INVALID_TITLE`); ruta válida y archivo existente (`INVALID_PATH`) |
| `update_submission_title(p_round_id, p_title)` | — | Acceso; abierta; tiene publicación (`NO_SUBMISSION`). Conserva los votos. |
| `replace_submission_image(p_round_id, p_image_path, p_width, p_height)` | ruta anterior | Acceso; abierta; borra los votos recibidos y cambia la imagen |
| `delete_my_submission(p_round_id)` | ruta | Acceso; abierta; los votos caen en cascada |
| `cast_vote(p_submission_id)` | — | La competencia sale de la publicación (`NO_SUBMISSION`); acceso; abierta; no propia (`OWN_SUBMISSION`); menos de 3 usados en esa competencia (`NO_VOTES_LEFT`) |
| `remove_vote(p_submission_id)` | — | Acceso; abierta; tiene un voto ahí (`NO_VOTE_TO_REMOVE`). Borra el más reciente. |

### Competencias

| RPC | Quién | Devuelve | Condiciones |
| --- | --- | --- | --- |
| `hub_rounds()` | Usuario | tabla | Todas las competencias con `my_access` (`owner`, `member`, `public`, `admin`, `pending`, `none`), `my_involvement`, `pending_requests` (solo para el dueño), `participant_count`, y `winner_title`, `winner_author` y `cover_path` solo con acceso. En las limpiadas, el ganador y los participantes salen de la lápida. |
| `create_round(p_name, p_visibility)` | Usuario | `uuid` | Nace en `pending` con su `round_invites`. Límite de 2 activas (`ROUND_LIMIT`), salvo el superadmin; un lock por usuario evita saltarlo con pedidos simultáneos. `INVALID_NAME`. |
| `rename_round(p_round_id, p_name)` | Dueño | — | `INVALID_NAME` |
| `set_round_visibility(p_round_id, p_visibility)` | Dueño | — | Solo en `pending` (`VISIBILITY_LOCKED`) |
| `set_round_status(p_round_id, p_status)` | Dueño | — | Solo `pending→open`, `open→closed`, `closed→open`; si no, `INVALID_TRANSITION`. Guarda `opened_at` y `closed_at`. |
| `finalize_round(p_round_id, p_winner_submission_id)` | Dueño | — | Estado `closed` (`INVALID_TRANSITION`); ganador de esa competencia (`INVALID_WINNER`). Cualquiera, aunque haya empate. |
| `delete_submission(p_submission_id)` | Dueño o superadmin | ruta | Cualquier estado. **Si borra la ganadora de una finalizada, la competencia vuelve a `closed`** sin ganador. |
| `delete_round(p_round_id)` | Dueño o superadmin | id | Borra todo (cascada) y anota quién la borró en `round_deletions` |
| `round_stats(p_round_id)` | Dueño o superadmin | tabla | `participants` (publicaron o votaron), `submissions`, `votes` |

El superadmin **no** gestiona estados ni miembros de competencias ajenas (`NOT_OWNER`): solo modera borrando.

### Miembros

| RPC | Quién | Devuelve | Condiciones |
| --- | --- | --- | --- |
| `get_invite_link(p_round_id)` | Dueño | token | Solo privadas (`NOT_PRIVATE`) |
| `regenerate_invite_link(p_round_id)` | Dueño | token nuevo | Solo privadas. El anterior deja de funcionar. |
| `join_with_invite(p_token)` | Usuario | id de la competencia | `p_token` es texto (viene de la URL); si no es un uuid o no existe, `INVALID_INVITE`. Si ya tenía acceso, solo devuelve el id. Aprueba su solicitud pendiente, si la había. |
| `add_member(p_round_id, p_user_id)` | Dueño | — | Solo privadas; perfil existente (`USER_NOT_FOUND`); sin acceso previo (`ALREADY_HAS_ACCESS`). Aprueba su solicitud pendiente. |
| `remove_member(p_round_id, p_user_id)` | Dueño | ruta o null | Es miembro (`NOT_MEMBER`). Borra su publicación (los votos recibidos vuelven) y sus votos. |
| `leave_round(p_round_id)` | Miembro | ruta o null | Igual, sobre sí mismo. El dueño no es miembro. |
| `request_access(p_round_id)` | Usuario | id | Solo privadas (`NOT_PRIVATE`), sin limpiar, sin acceso (`ALREADY_HAS_ACCESS`), sin otra pendiente (`REQUEST_PENDING`) |
| `resolve_access_request(p_request_id, p_approve)` | Dueño | — | Pendiente (`NO_REQUEST`). Si aprueba, queda como miembro (`request`). |

### Superadmin ([0011_v2_admin.sql](../supabase/migrations/0011_v2_admin.sql))

| RPC | Devuelve | Condiciones |
| --- | --- | --- |
| `admin_rounds_to_archive()` | tabla | Sin limpiar y con más de 60 días sin actividad, con cantidad de publicaciones y exportación (si hubo) |
| `admin_mark_exported(p_round_id, p_drive_url)` | — | Registra la exportación; `p_drive_url` null si el ZIP se guardó a mano |
| `admin_clean_round(p_round_id)` | id | Más de 60 días sin actividad (`NOT_INACTIVE`) y exportada (`NOT_EXPORTED`). Guarda en `round_archives.snapshot` los totales, el ganador y el ranking en texto; marca `cleaned_at` **antes** de borrar (así no cuenta como actividad) y borra votos, publicaciones, miembros y solicitudes. |
| `admin_archives()` | tabla | Lápidas con su `drive_url` |

Transiciones de estado:

```text
pending ──abrir──▶ open ──cerrar──▶ closed ──finalizar──▶ finalized
                    ▲                  │                      │
                    └─────reabrir──────┘◀── borrar ganadora ──┘
Borrar la competencia (dueño o superadmin): desde cualquier estado.
Limpiar (superadmin, 60 días sin actividad y exportada): desde cualquier estado; queda la lápida.
```

### Códigos de error

`NOT_ALLOWED`, `NOT_ADMIN`, `ROUND_NOT_OPEN`, `ALREADY_SUBMITTED`, `NO_SUBMISSION`, `INVALID_PATH`, `INVALID_TITLE`, `OWN_SUBMISSION`, `NO_VOTES_LEFT`, `NO_VOTE_TO_REMOVE`, `INVALID_TRANSITION`, `INVALID_WINNER`, `INVALID_NAME`, y los de la v2: `NO_ACCESS`, `NOT_OWNER`, `ROUND_NOT_FOUND`, `ROUND_LIMIT`, `ROUND_CLEANED`, `VISIBILITY_LOCKED`, `NOT_PRIVATE`, `INVALID_INVITE`, `ALREADY_HAS_ACCESS`, `REQUEST_PENDING`, `NO_REQUEST`, `NOT_MEMBER`, `USER_NOT_FOUND`, `NOT_INACTIVE`, `NOT_EXPORTED`.

Cada código tiene su mensaje en español en `src/lib/errors.ts`. **Un código nuevo en SQL requiere su mensaje ahí** (si no, se muestra el genérico "Algo salió mal").

### Concurrencia

- `cast_vote` y `remove_vote` toman `pg_advisory_xact_lock` sobre usuario y competencia antes de contar: diez clics simultáneos nunca superan 3 votos.
- Las RPC de participación leen la competencia con `for share` y las del dueño con `for update`. Así, cerrar la competencia espera a que terminen los votos en curso, y nadie publica ni vota "justo" mientras se cierra.
- `cast_vote` toma `for share` sobre la publicación y `replace_submission_image` toma `for update`. Así, un voto no sobrevive a un reemplazo de imagen que ocurre al mismo tiempo.
- `create_round` toma un lock por usuario para que dos pedidos simultáneos no salten el límite de 2.

## 6. Storage

Definido en [0006_storage.sql](../supabase/migrations/0006_storage.sql) y reemplazado en [0012_v2_storage.sql](../supabase/migrations/0012_v2_storage.sql).

- **Bucket `submissions`:** privado, 5 MB, solo `image/webp`, `image/jpeg` e `image/png`. Las imágenes se muestran con URLs firmadas de 1 hora.
- **Ruta:** `{round_id}/{user_id}/{uuid}.webp`. Cada subida usa un nombre nuevo; los archivos nunca se sobrescriben (no hay política de `update`).
- La primera carpeta se convierte con `try_uuid(text)`, que devuelve `null` si no es un uuid.
- `can_manage_round_files(id)`: superadmin, dueño, o quien borró la competencia (`round_deletions`).

| Política | Regla |
| --- | --- |
| `select` | `can_view_round` o `can_manage_round_files` de la primera carpeta |
| `insert` | Usuario del dominio, segunda carpeta = `auth.uid()`, competencia `open` y sin limpiar, y `can_view_round` |
| `delete` | El superadmin, cualquier archivo. Los demás, solo archivos que **ninguna publicación referencia**: el usuario en su carpeta, y el dueño o quien borró la competencia en toda la carpeta. Así nadie rompe una imagen en uso. |

Supabase bloquea el `DELETE` directo sobre `storage.objects` desde SQL: **los archivos se borran siempre desde el cliente con la API de Storage**. Por eso las RPC devuelven rutas o ids, y siempre sacan la referencia antes de que el cliente borre:

| Flujo | Orden |
| --- | --- |
| Publicar | subir → `create_submission`; si falla, el cliente borra lo subido |
| Reemplazar | subir el nuevo → `replace_submission_image` → borrar la ruta anterior que devuelve |
| Borrar publicación, quitar miembro o salir | RPC → borrar la ruta devuelta |
| Borrar competencia o limpiarla | RPC → el cliente lista las carpetas `{round_id}/*/` y borra en lotes de 100 (`removeRoundFolder`) |

Si la limpieza de Storage falla, la base ya quedó bien y solo queda un archivo huérfano. La sección 10 tiene una consulta para encontrarlos.

## 7. Realtime

[0007_realtime.sql](../supabase/migrations/0007_realtime.sql) publica `rounds`, `submissions` y `votes`, y [0013_v2_realtime.sql](../supabase/migrations/0013_v2_realtime.sql) suma `round_members` y `access_requests`. Los eventos respetan RLS: nadie recibe cambios de una privada sin acceso. `profiles` no está publicada.

## 8. Migraciones

| Archivo | Contenido |
| --- | --- |
| `0001_schema.sql` | Tipo `round_status`, tablas, índices, vistas, admin y "Competencia 1" |
| `0002_auth.sql` | Funciones de dominio y admin, hook, trigger de dominio, trigger de perfiles |
| `0003_rls.sql` | RLS, políticas de lectura, revocación de escrituras |
| `0004_rpc_user.sql` | RPC de usuario de la v1 (reemplazadas en `0010`) |
| `0005_rpc_admin.sql` | RPC de administración de la v1 (dadas de baja en `0010`; quedan `assert_admin` y `clean_round_name`) |
| `0006_storage.sql` | Bucket y políticas de la v1 (reemplazadas en `0012`) |
| `0007_realtime.sql` | Publicación de Realtime |
| `0008_v2_schema.sql` | `round_status` sin `archived`, columnas de `rounds`, tablas nuevas y migración de los datos de la v1 |
| `0009_v2_access.sql` | `can_view_round`, `is_round_owner`, RLS de la v2 y trigger de actividad |
| `0010_v2_rpc.sql` | RPC de participación, competencias y miembros |
| `0011_v2_admin.sql` | RPC del superadmin (archivo y limpieza) |
| `0012_v2_storage.sql` | Políticas de Storage por competencia |
| `0013_v2_realtime.sql` | `round_members` y `access_requests` en Realtime |

**Reglas:**
- Nunca se cambia la base fuera de una migración.
- No se editan migraciones ya aplicadas: se agrega la siguiente.
- El historial remoto (`supabase_migrations.schema_migrations`) usa las mismas versiones que los archivos.

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

**Ensayar antes de aplicar.** Una migración se puede probar contra la base real sin aplicarla: un archivo con `begin;`, las migraciones nuevas, el cuerpo de `rules.sql` (sin su `begin;`) y `rollback;`, ejecutado con `npx supabase db query --linked -f`. Así se probó la v2 antes del push.

El procedimiento completo para un cambio de base está en la skill [`.claude/skills/cambio-base-de-datos`](../.claude/skills/cambio-base-de-datos/SKILL.md).

## 9. Pruebas de reglas

[supabase/tests/rules.sql](../supabase/tests/rules.sql) tiene **217 casos** que corren contra la base real dentro de una transacción con `rollback` (no deja datos).

```bash
npx supabase db query --linked -f supabase/tests/rules.sql -o json
```

Cómo está armado:
- Crea usuarios ficticios en `auth.users` (ana, beto, carla, dani). Para el superadmin reutiliza el usuario real si ya existe, porque el email es único.
- Ana crea sus propias competencias (una pública y una privada), así las pruebas no dependen de los datos reales.
- `pg_temp.run_as(email, uid, sql)` simula a un usuario con `set local role authenticated` y `request.jwt.claims`, ejecuta el SQL y devuelve `OK[:valor]` o el mensaje de error. `pg_temp.run_as_anon` hace lo mismo para `anon`.
- `pg_temp.upload` y `pg_temp.remove` suben y borran en Storage como un usuario (`remove` devuelve `OK:1` o `OK:0`).
- `pg_temp.expect(caso, esperado, obtenido)` registra cada caso; coincide si es igual o si `obtenido` empieza con `esperado`.
- Para probar las políticas de borrado de Storage habilita `storage.allow_delete_query` solo dentro de la transacción.
- La inactividad se simula moviendo `last_activity_at` 61 días atrás.
- Termina con `select … from results` y `rollback`.

**Cuidados al agregar casos:**
- Dentro de `run_as`, el SQL va en `execute … into`. Un `insert` necesita `returning` (por ejemplo `returning 1`); si no, falla con "INTO used with a command that cannot return data".
- La salida de la CLI puede traer al final un aviso de versión nueva, después del JSON: al procesarla, cortar en la última `}`.

Lo que **no** cubre SQL: la concurrencia real de `cast_vote` y `create_round` (dos sesiones a la vez).

## 10. Operación

**Advisors esperados** (`npx supabase db advisors --linked` o el panel):
- *Signed-in users can execute SECURITY DEFINER function* en las RPC y en las funciones de acceso: es el diseño; cada una valida por dentro.
- *Leaked password protection disabled*: no aplica, el proveedor Email está apagado.
- *RLS enabled no policy* en `admins` y `round_deletions`: a propósito.
- *Unused index* con pocos datos.

**Plan gratuito:**
- El proyecto se pausa tras una semana sin actividad: entrar a la app o al panel de vez en cuando.
- Cada competencia ocupa hasta unos 100 MB de Storage. Lo controlan el límite de 2 activas por persona y la limpieza de las inactivas (sección "Para archivar" del panel del superadmin).

**Respaldo.** `db dump` necesita Docker. Sin Docker, cada tabla se exporta a JSON con `npx supabase db query --linked "select * from public.<tabla>" -o json`. El respaldo previo a la v2 está en `Documents/tablon-respaldos/backup-v1-2026-10-24/` (fuera del repo).

**Consultas útiles** (solo lectura, con `npx supabase db query --linked "<sql>"`):

```sql
-- Archivos huérfanos (sin publicación que los use)
select o.name from storage.objects o
where o.bucket_id = 'submissions'
  and not exists (select 1 from public.submissions s where s.image_path = o.name);

-- Estado general
select r.name, r.status, r.visibility, p.email as dueño, r.last_activity_at, r.cleaned_at
from public.rounds r join public.profiles p on p.id = r.owner_id order by r.created_at;

-- Competencias activas por dueño
select p.email, count(*) from public.rounds r join public.profiles p on p.id = r.owner_id
where r.status <> 'finalized' and r.cleaned_at is null group by 1 order by 2 desc;
```

**Cambiar o agregar un superadmin** requiere una migración nueva (por ejemplo `insert into public.admins (email) values ('alguien@grupokelsoft.com');`). El email va en minúsculas; la tabla lo exige con un `check`.
