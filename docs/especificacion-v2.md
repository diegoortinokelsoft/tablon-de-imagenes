# Tablón de Imágenes v2 — Especificación técnica

Oct 24, 2026 · @diego

## Resumen

La v1 tuvo una sola competencia a la vez, controlada por un administrador. La v2 la convierte en una plataforma donde cualquier persona de Grupo Kelsoft crea sus propias competencias, públicas o privadas, invita gente y comparte el resultado en Slack como imagen.

Este documento parte de [especificacion.md](especificacion.md) (v1) y describe solo lo que cambia. Todo lo que no se menciona acá (reglas de publicación y de votos, compresión de imágenes, guía de estilo, cajón "Mi publicación", accesibilidad) sigue igual. Cuando la v2 se publique, este documento pasa a ser la fuente de verdad.

| Aspecto | v1 | v2 |
| --- | --- | --- |
| Competencias | Una sola actual, más el historial | Muchas a la vez, independientes entre sí |
| Quién crea | El administrador | Cualquier usuario, hasta 2 activas |
| Quién gestiona | El administrador | El dueño de cada competencia |
| Visibilidad | Todo Kelsoft ve todo | Pública (todo Kelsoft) o privada (solo miembros) |
| Pantalla de inicio | El tablón | Hub para explorar competencias |
| Administrador global | Gestiona todo | Superadmin: modera, exporta y limpia |
| Compartir | — | Imagen del resultado para pegar en Slack |
| Espacio | Borrado manual del historial | Exportación a Drive y limpieza a los 60 días sin actividad |

## Alcance

**Entra en la v2**

- Crear competencias públicas o privadas, con límite de 2 activas por dueño.
- Hub de inicio con todas las competencias; las privadas aparecen con candado.
- Acceso a privadas por enlace de invitación, por agregado del dueño o por solicitud aprobada.
- Panel de gestión por competencia para su dueño.
- Imagen del resultado generada en el navegador, para copiar o descargar.
- Panel del superadmin con moderación y la sección "Para archivar" (ZIP a Drive y limpieza).
- Migración de los datos de la v1 sin pérdida.

**Queda afuera**

- Usuarios fuera de `@grupokelsoft.com`. "Público" significa público dentro de Kelsoft.
- Funciones de red social: seguir personas, feed, comentarios, likes, notificaciones por email.
- Reglas configurables por competencia: siempre 1 publicación y 3 votos por persona.
- Apertura o cierre programados por fecha.
- Publicación automática en Slack y cualquier función de servidor (Edge Functions, `pg_cron`).
- Exportación y limpieza automáticas: las dispara el superadmin a mano.
- Transferir la propiedad de una competencia y tener coadministradores.
- "Invitar a los mismos de otra competencia" (queda para una versión posterior).

## Roles

| Rol | Quién | Qué puede hacer |
| --- | --- | --- |
| Usuario | Cualquier cuenta `@grupokelsoft.com` | Explorar el hub, participar en públicas, pedir acceso a privadas, crear hasta 2 competencias activas |
| Miembro | Usuario con acceso a una privada | Participar en esa competencia como en una pública; salir cuando quiera |
| Dueño | Quien creó la competencia | Todo lo que hacía el admin de la v1, pero solo en su competencia; además invita, aprueba solicitudes y quita miembros. Participa con las mismas reglas que el resto |
| Superadmin | Los emails de la tabla `admins` (hoy, `diego.martin.ortino@grupokelsoft.com`) | Ver el contenido de cualquier competencia, borrar publicaciones y competencias, exportar y limpiar. Está exento del límite de 2. No gestiona estados ni miembros de competencias ajenas |

La tabla `admins` y la función `public.is_admin()` se conservan con el significado de superadmin.

## Competencias

**Creación.** Nombre de 1 a 80 caracteres y visibilidad. Nace en `pending` con el creador como dueño. El formulario avisa: "El nombre de la competencia lo ve todo Kelsoft, aunque sea privada".

**Límite.** Un dueño puede tener como máximo 2 competencias **activas**, es decir, en `pending`, `open` o `closed` y sin limpiar. Las finalizadas y las limpiadas no cuentan. Borrar una competencia libera el cupo. El superadmin no tiene límite.

**Estados.** Los mismos de la v1 menos `archived`: una competencia finalizada queda como su propio historial.

| Estado | Etiqueta | Subir y editar | Votar |
| --- | --- | --- | --- |
| `pending` | Preparada | No | No |
| `open` | Abierta | Sí | Sí |
| `closed` | Cerrada | No | No |
| `finalized` | Finalizada | No | No |

Transiciones, todas del dueño: `pending → open`, `open → closed`, `closed → open` y `closed → finalized` (eligiendo ganador). Si el dueño o el superadmin borra la publicación ganadora, la competencia vuelve a `closed`, igual que en la v1.

**Visibilidad.** `public` o `private`. Solo se puede cambiar mientras la competencia está en `pending`, para que nadie que ya votó pierda el acceso.

**Borrar.** El dueño o el superadmin pueden borrar una competencia en cualquier estado, escribiendo `BORRAR` para confirmar. Se borran sus publicaciones, votos, miembros, solicitudes y archivos. Reemplaza al "reinicio total" de la v1.

**Limpieza (lápida).** Una competencia limpiada conserva su fila con nombre, dueño, fechas y una foto del resultado (ganador y podio, si estaba finalizada), pero pierde imágenes, publicaciones y votos. En el hub aparece con el chip "Archivada".

## Acceso a competencias privadas

Una persona ve el contenido de una competencia (publicaciones, votos, imágenes) si se cumple alguna de estas condiciones:

1. La competencia es pública.
2. Es el dueño.
3. Es miembro.
4. Es superadmin.

Los datos generales (nombre, dueño, estado, visibilidad, fechas y cantidad de participantes) los ve cualquier usuario autorizado, para poder listarlos en el hub.

**Formas de entrar a una privada**

| Forma | Cómo funciona |
| --- | --- |
| Enlace de invitación | El dueño copia un enlace `/invitacion/{token}`. Quien lo abre queda como miembro sin aprobación. El dueño puede regenerar el token, lo que invalida el enlace anterior |
| Agregar persona | El dueño elige entre los perfiles existentes (quienes ya iniciaron sesión alguna vez) |
| Solicitud de acceso | Desde la competencia con candado, el usuario toca "Solicitar acceso". El dueño la aprueba o la rechaza. Se permite una sola solicitud pendiente por persona y competencia; después de un rechazo se puede volver a pedir |

**Avisos.** No hay emails. El dueño ve la cantidad de solicitudes pendientes en la tarjeta del hub y en su panel, en tiempo real. Quien pidió acceso ve "Solicitud pendiente" en lugar del botón.

**Quitar o salir.** El dueño puede quitar a un miembro, y un miembro puede salir por su cuenta (con confirmación). En ambos casos se borran su publicación (los votos recibidos vuelven a quienes los dieron) y los votos que había dado. El dueño no es miembro: no puede quitarse ni salir.

Las competencias públicas no tienen miembros: cualquiera participa sin unirse.

## Modelo de datos

Diez tablas en `public`, cinco de ellas nuevas. Los nombres de la v1 se conservan: `rounds` sigue siendo la tabla de competencias.

| Tabla | Propósito | Lectura (RLS) |
| --- | --- | --- |
| `admins` | Superadmins | Sin políticas |
| `profiles` | Sin cambios | Usuario autorizado |
| `rounds` | Competencias, con dueño, visibilidad y actividad | Usuario autorizado (solo datos generales) |
| `round_members` | Miembros de competencias privadas | Dueño de la competencia, el propio miembro o superadmin |
| `round_invites` | Token del enlace de invitación, uno por competencia | Dueño o superadmin |
| `access_requests` | Solicitudes de acceso | Quien la pidió, el dueño o superadmin |
| `round_archives` | Exportación a Drive y foto del resultado al limpiar | `can_view_round(round_id)`; `drive_url` solo se expone al superadmin vía RPC |
| `round_deletions` | Quién borró cada competencia, para que pueda limpiar sus archivos de Storage | Sin políticas (la usan las políticas de Storage) |
| `submissions` | Sin cambios de columnas | `can_view_round(round_id)` |
| `votes` | Sin cambios de columnas | `can_view_round(round_id)` |

El token de invitación y el enlace a Drive van en tablas aparte porque `rounds` la lee todo Kelsoft y RLS filtra filas, no columnas. En `round_archives`, además, `authenticated` solo tiene permiso de lectura sobre `round_id`, `exported_at` y `snapshot`.

`round_deletions` existe porque, al borrar una competencia, la fila desaparece y quien la borró deja de ser su dueño: sin esa anotación no podría listar ni borrar los archivos de los demás participantes.

Esquema de referencia de lo nuevo:

```sql
create type public.round_visibility as enum ('public','private');
create type public.request_status as enum ('pending','approved','rejected');
create type public.member_source as enum ('invite_link','added','request');

-- round_status pierde 'archived': se crea un tipo nuevo y la columna se convierte
-- con 'archived' -> 'finalized'. Las vistas que dependen de rounds se recrean.
create type public.round_status as enum ('pending','open','closed','finalized');

alter table public.rounds
  add column owner_id uuid not null references public.profiles(id) on delete restrict,
  add column visibility public.round_visibility not null default 'public',
  add column last_activity_at timestamptz not null default now(),
  add column cleaned_at timestamptz;
drop index public.rounds_one_current;
create index rounds_owner_active_idx on public.rounds (owner_id)
  where status <> 'finalized' and cleaned_at is null;
create index rounds_last_activity_idx on public.rounds (last_activity_at)
  where cleaned_at is null;

create table public.round_members (
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  source public.member_source not null,
  joined_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

create table public.round_invites (
  round_id uuid primary key references public.rounds(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index access_requests_one_pending
  on public.access_requests (round_id, user_id) where status = 'pending';

create table public.round_archives (
  round_id uuid primary key references public.rounds(id) on delete cascade,
  drive_url text,                 -- null si se descargó y se guardó a mano
  exported_at timestamptz not null default now(),
  snapshot jsonb                  -- se completa al limpiar: ganador, podio, participantes
);
```

`owner_id` usa `on delete restrict`: para borrar una cuenta, antes hay que borrar sus competencias. Es un caso raro y así no se pierde nada sin querer.

**Actividad.** Un trigger `after insert or update or delete` en `submissions` y `votes`, y las RPC que cambian estado, nombre o visibilidad, actualizan `rounds.last_activity_at`. Para no generar un evento de Realtime por cada voto, el trigger solo escribe si el valor guardado tiene más de una hora.

**Vistas.** `board` y `vote_details` se mantienen con `security_invoker = true`, así respetan el RLS nuevo de `submissions` y `votes`.

**Hub.** Como para las privadas sin acceso hay que mostrar datos que RLS esconde (cantidad de participantes), el hub se lee con la RPC `hub_rounds()`, que devuelve por competencia:

| Campo | Contenido |
| --- | --- |
| `id`, `name`, `status`, `visibility` | Datos generales |
| `owner_id`, `owner_name`, `owner_avatar` | Dueño |
| `created_at`, `opened_at`, `finalized_at`, `last_activity_at`, `cleaned_at` | Fechas |
| `participant_count` | Cantidad de publicaciones |
| `my_access` | `owner`, `member`, `public`, `admin`, `pending` (solicitud pendiente) o `none` |
| `my_involvement` | Verdadero si soy dueño, miembro, o publiqué o voté ahí |
| `pending_requests` | Cantidad de solicitudes pendientes; solo para el dueño, si no `0` |
| `winner_title`, `winner_author`, `cover_path` | Solo si tengo acceso; si no, `null` |

`cover_path` es la imagen ganadora o, si no hay ganador, la más votada.

## Seguridad: funciones y RPC

Siguen vigentes las reglas de la v1: toda escritura por RPC `security definer` con `set search_path = ''`, nombres totalmente calificados, `is_allowed_user()` al comienzo, `execute` solo para `authenticated`, parámetros con prefijo `p_` y errores con código fijo.

**Funciones base nuevas** (`stable security definer`):

- `can_view_round(p_round_id)`: aplica las cuatro condiciones de acceso.
- `is_round_owner(p_round_id)`: el usuario es el dueño.

`current_round()` se elimina: toda RPC recibe la competencia, o la deduce de la publicación.

**RPC de participación**

| RPC | Condiciones |
| --- | --- |
| `sync_my_profile()` | Sin cambios |
| `create_submission(p_round_id, p_title, p_image_path, p_width, p_height)` | Acceso; abierta; sin publicación previa; ruta con prefijo `{round_id}/{uid}/` |
| `update_submission_title(p_round_id, p_title)` | Acceso; abierta |
| `replace_submission_image(p_round_id, p_image_path, p_width, p_height)` | Acceso; abierta; devuelve la ruta anterior |
| `delete_my_submission(p_round_id)` | Acceso; abierta; devuelve la ruta |
| `cast_vote(p_submission_id)` | La competencia sale de la publicación; acceso; abierta; no propia; menos de 3 votos en esa competencia. El `pg_advisory_xact_lock` pasa a ser sobre usuario y competencia |
| `remove_vote(p_submission_id)` | Acceso; abierta; tiene un voto ahí |

**RPC de competencias**

| RPC | Quién | Qué hace / condiciones |
| --- | --- | --- |
| `hub_rounds()` | Usuario | Lista del hub (ver arriba) |
| `create_round(p_name, p_visibility)` | Usuario | Crea en `pending` y su `round_invites`; devuelve el id. Toma un lock sobre el usuario y verifica el límite de 2 salvo para el superadmin |
| `rename_round(p_round_id, p_name)` | Dueño | Cualquier estado |
| `set_round_visibility(p_round_id, p_visibility)` | Dueño | Solo en `pending` |
| `set_round_status(p_round_id, p_status)` | Dueño | Solo transiciones permitidas |
| `finalize_round(p_round_id, p_winner_submission_id)` | Dueño | Estado `closed`; el ganador es de esa competencia |
| `delete_submission(p_submission_id)` | Dueño o superadmin | Cualquier estado; si era la ganadora, vuelve a `closed`; devuelve la ruta |
| `delete_round(p_round_id)` | Dueño o superadmin | Borra todo y anota quién la borró en `round_deletions`; devuelve el id para limpiar Storage |
| `round_stats(p_round_id)` | Dueño o superadmin | Participantes, publicaciones y votos emitidos |

**RPC de miembros**

| RPC | Quién | Qué hace / condiciones |
| --- | --- | --- |
| `get_invite_link(p_round_id)` | Dueño | Devuelve el token. Solo en privadas |
| `regenerate_invite_link(p_round_id)` | Dueño | Cambia el token; devuelve el nuevo |
| `join_with_invite(p_token)` | Usuario | El token llega como texto desde la URL; si no es un uuid válido, `INVALID_INVITE`. Lo agrega como miembro (`invite_link`); devuelve el id de la competencia. Si ya era miembro o dueño, solo devuelve el id. Si tenía una solicitud pendiente, la marca aprobada |
| `add_member(p_round_id, p_user_id)` | Dueño | Agrega (`added`); si había solicitud pendiente, la aprueba |
| `remove_member(p_round_id, p_user_id)` | Dueño | Borra su publicación y sus votos en esa competencia; devuelve la ruta de la imagen, si había |
| `leave_round(p_round_id)` | Miembro | Igual que `remove_member` sobre sí mismo |
| `request_access(p_round_id)` | Usuario | Solo privadas; sin acceso; sin solicitud pendiente |
| `resolve_access_request(p_request_id, p_approve)` | Dueño | La solicitud está pendiente; si aprueba, agrega como miembro (`request`) |

**RPC del superadmin**

| RPC | Qué hace / condiciones |
| --- | --- |
| `admin_rounds_to_archive()` | Competencias sin limpiar con `last_activity_at` de hace más de 60 días, con tamaño estimado (cantidad de publicaciones) |
| `admin_mark_exported(p_round_id, p_drive_url)` | Registra la exportación en `round_archives`. `p_drive_url` es `null` si el ZIP se descargó y se guardó a mano |
| `admin_clean_round(p_round_id)` | Exige más de 60 días sin actividad y la exportación registrada. Guarda la foto del resultado en `round_archives.snapshot`, borra publicaciones, votos, miembros y solicitudes, y marca `cleaned_at`. Devuelve el id para limpiar Storage |
| `admin_archives()` | Lápidas con su `drive_url`, para el panel |

**Códigos de error nuevos:** `NO_ACCESS`, `NOT_OWNER`, `ROUND_NOT_FOUND`, `ROUND_LIMIT`, `ROUND_CLEANED`, `VISIBILITY_LOCKED`, `NOT_PRIVATE`, `INVALID_INVITE`, `ALREADY_HAS_ACCESS`, `REQUEST_PENDING`, `NO_REQUEST`, `NOT_MEMBER`, `USER_NOT_FOUND`, `NOT_INACTIVE`, `NOT_EXPORTED`. Se elimina `ROUND_NOT_ARCHIVED`. `NOT_ADMIN` se mantiene para las RPC del superadmin.

| Código | Mensaje |
| --- | --- |
| `NO_ACCESS` | No tienes acceso a esta competencia |
| `NOT_OWNER` | Solo quien creó la competencia puede hacer esto |
| `ROUND_NOT_FOUND` | La competencia no existe |
| `ROUND_LIMIT` | Ya tienes 2 competencias activas. Finaliza o borra una para crear otra |
| `ROUND_CLEANED` | Esta competencia fue archivada |
| `VISIBILITY_LOCKED` | La visibilidad solo se cambia antes de abrir la competencia |
| `NOT_PRIVATE` | Esta competencia es pública: no hace falta pedir acceso |
| `INVALID_INVITE` | El enlace de invitación no es válido o fue reemplazado |
| `ALREADY_HAS_ACCESS` | Ya tiene acceso a esta competencia (sirve para uno mismo y para la persona que el dueño quiere agregar) |
| `REQUEST_PENDING` | Ya pediste acceso: espera la respuesta |
| `NO_REQUEST` | La solicitud ya no está pendiente |
| `NOT_MEMBER` | Esa persona no es miembro |
| `USER_NOT_FOUND` | Esa persona todavía no inició sesión en el Tablón |
| `NOT_INACTIVE` | La competencia tuvo actividad en los últimos 60 días |
| `NOT_EXPORTED` | Exporta la competencia antes de limpiarla |

## Storage

El bucket y la ruta `{round_id}/{user_id}/{uuid}.webp` no cambian, así que la migración no mueve archivos.

**Políticas sobre `storage.objects`** (bucket `submissions`). La primera carpeta se convierte a `uuid` con una función segura que devuelve `null` si no es válida.

`can_manage_round_files(round_id)` es verdadera para el superadmin, el dueño y quien borró la competencia (según `round_deletions`).

- `select`: `can_view_round(primera carpeta)` o `can_manage_round_files(primera carpeta)`.
- `insert`: `is_allowed_user()`, segunda carpeta igual a `auth.uid()`, competencia `open` y sin limpiar, y `can_view_round`.
- `delete`: el superadmin, cualquier archivo. Los demás, solo archivos que **ninguna publicación referencia**: el usuario en su carpeta (como en la v1), y el dueño o quien borró la competencia en toda la carpeta de ella. Así nadie rompe una imagen en uso, y alcanza para limpiar, porque las RPC sacan la referencia antes de que el cliente borre el archivo.

**Flujos que borran archivos:** `delete_round` y `admin_clean_round` borran todo bajo `{round_id}/` en lotes de 100, como la v1. `remove_member`, `leave_round` y `delete_submission` borran la ruta devuelta.

## Tiempo real

- Se agregan `round_members` y `access_requests` a la publicación `supabase_realtime`. Realtime aplica el RLS de cada suscriptor, así que nadie recibe eventos de lo que no puede leer.
- **En una competencia:** un canal `round:{id}` con `postgres_changes` filtrado por `round_id=eq.{id}` en `submissions` y `votes`, por `id=eq.{id}` en `rounds` y por `round_id=eq.{id}` en `round_members` y `access_requests`. Como en la v1, cada evento invalida las consultas con un debounce de 300 ms.
- **En el hub:** un canal `hub` sobre `rounds`, `round_members` y `access_requests`, que invalida `hub_rounds`.
- Si a alguien lo quitan de una privada mientras la mira, al refrescar recibe `NO_ACCESS` y la vista pasa a la pantalla con candado, con el aviso "Ya no tienes acceso a esta competencia".

## Imagen del resultado

Una imagen generada en el navegador para pegar en Slack. Está disponible en toda competencia finalizada y no limpiada, para cualquier persona con acceso.

**Contenido** (1200 × 630 px, PNG):

- Fondo con el degradado y el patrón de la guía de estilo.
- Arriba: nombre de la competencia y "¡GANADOR!" en Lilita One.
- Imagen ganadora sin recortar (ajustada a su caja sobre `night-800`), con el borde de 6 px en `sun`.
- Junto a la imagen: título, avatar y nombre del autor, y la píldora de votos.
- Debajo: el 2.º y el 3.º puesto, solo con nombre del autor, título y votos, sin imágenes.
- Pie: "Tablón de Imágenes · Grupo Kelsoft" y la fecha de finalización.

**Podio.** El 2.º y el 3.º son los dos primeros del ranking por votos **sin contar al ganador** (que puede no ser el más votado). Si hay empate en el último lugar mostrado, se incluyen todos los empatados; si son más de tres, se muestran tres y "y N más". Si hay menos de tres publicaciones, se muestran las que haya.

**Cómo se genera.** Con `<canvas>`:

1. Se espera a que carguen las fuentes (`document.fonts.load`).
2. La imagen ganadora se baja con su URL firmada como `blob` y se dibuja con `createImageBitmap`, así el canvas no queda bloqueado por CORS.
3. Si el avatar de Google no se puede cargar sin bloquear el canvas, se usan las iniciales sobre `brand-400`, como en el componente `Avatar`.

El mismo generador produce la imagen resumen del ZIP de exportación.

**UI.** Botón "Compartir resultado" en el ganador destacado. Abre un modal con la vista previa y dos botones:

- "Copiar imagen": `navigator.clipboard.write` con un `ClipboardItem` de `image/png`, al que se le pasa la promesa del blob para que funcione en Safari. Toast: "Imagen copiada: pégala en Slack".
- "Descargar": siempre disponible, y como única opción si el navegador no permite copiar imágenes.

## Archivo y limpieza

Proceso manual del superadmin para liberar espacio sin perder nada.

1. **Detectar.** En `/admin`, la sección "Para archivar" lista las competencias sin limpiar con más de 60 días sin actividad, en cualquier estado.
2. **Exportar.** Por cada una, "Exportar a Drive" arma un ZIP en el navegador (con `fflate`) que contiene:
   - `resumen.png`: si está finalizada, la imagen del resultado; si no, el mismo formato con los tres más votados y el estado.
   - `imagenes/`: los archivos originales, nombrados `{posición}-{autor}-{título}.webp`.
   - `resultados.csv`: posición, título, autor, email, votos, si es ganadora y fecha de publicación.

   Después lo sube a la carpeta "Tablón de Imágenes — Archivo" del Drive del superadmin:
   - Usa Google Identity Services con el permiso `drive.file`, que solo da acceso a los archivos que crea la app. El token vive en el navegador y no hay secretos.
   - La subida es reanudable (`uploadType=resumable`), para que un ZIP grande no falle.
   - Al terminar llama a `admin_mark_exported` con el enlace del archivo.

   El botón "Descargar ZIP" es la alternativa: después de guardarlo a mano, el superadmin confirma "Ya lo guardé" y se registra la exportación sin enlace.
3. **Limpiar.** Con la exportación registrada se habilita "Limpiar", con confirmación. Llama a `admin_clean_round` y luego borra los archivos de Storage.
4. **Consultar.** La sección "Archivadas" del panel lista las lápidas con su enlace a Drive.

La sección "Para archivar" muestra cuántas competencias esperan y su tamaño aproximado.

## Pantallas

| Ruta | Pantalla | Acceso |
| --- | --- | --- |
| `/login` | Inicio de sesión (sin cambios) | Público |
| `/` | Hub | Usuario autorizado |
| `/c/:roundId` | Competencia: tablón, ranking o ganador según el estado; pantalla con candado si no hay acceso; lápida si fue limpiada | Usuario autorizado |
| `/c/:roundId/gestion` | Panel de gestión de la competencia | Dueño; los demás vuelven a `/c/:roundId` |
| `/invitacion/:token` | Une a la competencia y redirige a `/c/:roundId`; si el token no vale, muestra el error y un enlace al hub | Usuario autorizado |
| `/admin` | Panel del superadmin | Superadmin |
| `/estilos` | Guía de estilo (sin cambios) | Superadmin |

`/historial` y `/historial/:roundId` desaparecen; redirigen a `/` y a `/c/:roundId`.

**Encabezado.** Siempre: enlace "Competencias" (al hub), enlace a Admin (solo superadmin) y menú de avatar. Fuera de una competencia, el título de la app. Dentro de una competencia: nombre y chip de estado, fichas de voto y "Te quedan N de 3 votos" (solo con la competencia abierta y con acceso), botón "Gestionar" para el dueño, con el contador de solicitudes pendientes.

**Hub.**

- Título "Competencias" con el botón "Crear competencia" a su lado.
- Buscador por nombre (sin distinguir tildes ni mayúsculas) y cuatro pestañas. Arranca en "Mis competencias" si la persona participa en alguna; si no, en "Todas":
  - **Mis competencias:** las que tienen `my_involvement`.
  - **Abiertas.**
  - **Finalizadas.**
  - **Todas:** incluye preparadas, cerradas y archivadas.
- Grilla de tarjetas con las mismas columnas que el tablón. Cada tarjeta lleva:
  - la portada (`cover_path`), o el patrón de fondo si no hay;
  - el nombre, el chip de estado, el avatar y el nombre del dueño, y la cantidad de participantes;
  - el chip "TUYA" si soy el dueño, y el contador de solicitudes pendientes.
- Las privadas sin acceso muestran el ícono de candado, sin portada ni ganador. Llevan "Solicitar acceso" o "Solicitud pendiente".
- Las archivadas muestran el chip "Archivada" y, si la persona tiene acceso, el ganador guardado en la lápida.
- Orden: abiertas primero; dentro de cada grupo, por actividad más reciente.
- Estado vacío: "Todavía no hay competencias. ¡Crea la primera!".

**Crear competencia.** Modal con nombre (contador 0/80), visibilidad (Pública / Privada, con una línea que explica cada una) y el aviso sobre el nombre. Muestra "Te quedan N de 2 competencias activas". Sin cupo, el botón queda deshabilitado y el motivo se muestra debajo del título (y en un tooltip). Al crear, navega a `/c/:roundId/gestion`.

**Competencia sin acceso.** Tarjeta centrada con candado, nombre, dueño y estado, y el botón "Solicitar acceso" (o "Solicitud pendiente"). Si la competencia es privada y se llegó con un enlace válido, este paso no aparece.

**Lápida.** Nombre, dueño, fechas, chip "Archivada" y, para quien tenía acceso, el ganador y el podio en texto. Aviso: "Esta competencia se archivó por inactividad".

**Tablón, ranking y ganador.** Iguales a la v1, más:

- "Compartir resultado" en el ganador.
- "Salir de la competencia" en el menú, para miembros de una privada.

**Panel de gestión** (`/c/:roundId/gestion`). Es el panel de administración de la v1 acotado a una competencia, más:

- Visibilidad editable solo en preparada, con la explicación del motivo cuando está bloqueada.
- **Miembros** (solo privadas):
  - enlace de invitación con "Copiar" y "Generar nuevo enlace" (con confirmación);
  - buscador de perfiles para agregar;
  - lista de miembros con "Quitar", que confirma: "Se borrarán su publicación y sus votos".
- **Solicitudes:** lista de pendientes con "Aprobar" y "Rechazar".
- **Zona de peligro:** "Borrar competencia", que exige escribir `BORRAR`.

**Panel del superadmin** (`/admin`).

- Todas las competencias en una tabla con dueño, visibilidad, estado y última actividad, con enlace y "Borrar".
- Sección "Para archivar" y sección "Archivadas", como se describe en "Archivo y limpieza".
- El superadmin modera publicaciones entrando a cada competencia: el encabezado le muestra "Moderar", que abre `/c/:roundId/gestion` en modo moderación (solo las publicaciones con "Borrar" y la zona de peligro; sin estados, visibilidad, miembros ni elección de ganador).

## Migración desde la v1

Una migración de datos, sin mover archivos:

1. La competencia actual y todas las archivadas pasan a ser competencias **públicas** con `owner_id` igual al perfil de `diego.martin.ortino@grupokelsoft.com`.
2. `archived` pasa a `finalized`; se conserva el ganador.
3. `last_activity_at` toma la fecha más reciente entre `created_at`, `opened_at`, `closed_at`, `finalized_at`, `archived_at` y las de sus publicaciones y votos.
4. Se elimina el índice `rounds_one_current`, la columna `archived_at`, la función `current_round()` y las RPC `admin_*` de la v1, reemplazadas por las nuevas.

**Entorno.** La v2 se desarrolla sobre el **mismo proyecto de Supabase** de la v1. Las migraciones de la v2 cambian las firmas de las RPC, así que desde que se aplica la primera, el frontend v1 publicado en Netlify deja de funcionar hasta la entrega. Por eso:

1. Antes de la Fase 2 se avisa a los usuarios que la app queda fuera de uso hasta la v2.
2. Antes de aplicar `0008_v2_schema.sql` se hace un respaldo de los datos, guardado fuera del repo: cada tabla de `public` exportada a JSON con `npx supabase db query --linked "select * from public.<tabla>" -o json` (`db dump` necesita Docker). Hecho el 24/10/2026 en `Documents/tablon-respaldos/backup-v1-2026-10-24/`. Esa migración convierte datos reales (estados, dueños) y es la única difícil de deshacer.
3. Las imágenes de Storage no se tocan, así que no necesitan respaldo.

## Configuración

- **Google Cloud:** habilitar la Google Drive API y agregar el permiso `https://www.googleapis.com/auth/drive.file` a la pantalla de consentimiento. Con la pantalla "Interna" no hace falta verificación.
- **Nueva variable de entorno, opcional:** `VITE_GOOGLE_CLIENT_ID`, el Client ID del cliente OAuth (es público). Se usa solo en el panel del superadmin. Sin ella, "Para archivar" solo ofrece "Descargar ZIP" y avisa que falta configurarla.
- **Origen autorizado de JavaScript** en el cliente OAuth: la URL de Netlify y `http://localhost:5173`.
- **Dependencias nuevas:** `fflate` (ZIP). Google Identity Services se carga con `<script src="https://accounts.google.com/gsi/client">` solo al abrir el panel del superadmin.

## Plan de implementación

Se trabaja en una rama `v2` y se verifica cada fase con build, lint y tests antes de seguir.

- [x] **Fase 1. Preparación:** rama `v2`, aviso a los usuarios y respaldo de datos (ver "Entorno").
- [x] **Fase 2. Base de datos:** migraciones `0008_v2_schema.sql` (tipos, columnas, tablas, migración de datos), `0009_v2_access.sql` (`can_view_round`, `is_round_owner`, RLS, trigger de actividad), `0010_v2_rpc.sql` (RPC de participación, competencias y miembros; baja de las de la v1), `0011_v2_admin.sql` (RPC del superadmin), `0012_v2_storage.sql` y `0013_v2_realtime.sql`. `supabase/tests/rules.sql` suma casos para: privada sin acceso (leer, votar, subir), límite de 2 y exención del superadmin, visibilidad bloqueada fuera de `pending`, enlace regenerado, solicitudes duplicadas, quitar miembro devuelve votos, limpiar sin exportar o con actividad reciente, y `hub_rounds` sin filtrar datos de privadas.
- [x] **Fase 3. Rutas y competencia por id:** `/c/:roundId`, hooks parametrizados por competencia, canal Realtime `round:{id}` y redirecciones de `/historial`.
- [x] **Fase 4. Hub y creación:** `hub_rounds`, pestañas, buscador, tarjetas, modal de creación y límite.
- [x] **Fase 5. Gestión del dueño:** panel `/c/:roundId/gestion` con estados, ganador, borrar publicaciones y borrar competencia.
- [x] **Fase 6. Privadas y miembros:** pantalla con candado, solicitudes, enlace de invitación, `/invitacion/:token`, agregar, quitar y salir.
- [x] **Fase 7. Imagen del resultado:** generador en canvas, modal de vista previa, copiar y descargar.
- [x] **Fase 8. Superadmin y archivo:** tabla de competencias, "Para archivar", ZIP, subida a Drive, limpieza y lápidas.
- [ ] **Fase 9. Entrega:** pulido, estados vacíos, README, desplegar el frontend v2 en Netlify y actualizar `CLAUDE.md` y `docs/especificacion.md`.

## Criterios de aceptación

**Competencias**

- [ ] Un usuario crea dos competencias; la tercera devuelve `ROUND_LIMIT`. Al finalizar o borrar una, puede crear otra.
- [ ] El superadmin crea más de dos sin error.
- [ ] Cambiar la visibilidad fuera de `pending` devuelve `VISIBILITY_LOCKED`.
- [ ] Un usuario que no es dueño no puede cambiar estados, finalizar ni borrar (`NOT_OWNER`), ni desde la UI ni por RPC.
- [ ] Borrar una competencia elimina sus datos y archivos y libera el cupo.

**Privadas**

- [ ] Una privada aparece en el hub con candado, sin portada ni ganador, para quien no tiene acceso.
- [ ] Sin acceso, leer `submissions`, `votes` o las imágenes de una privada no devuelve nada, y votar o publicar devuelve `NO_ACCESS`.
- [ ] Abrir el enlace de invitación da acceso inmediato; después de regenerarlo, el enlace viejo devuelve `INVALID_INVITE`.
- [ ] Una solicitud aparece al dueño en menos de 2 segundos; al aprobarla, el solicitante ve la competencia sin recargar.
- [ ] Una segunda solicitud pendiente devuelve `REQUEST_PENDING`; después de un rechazo se puede volver a pedir.
- [ ] Quitar a un miembro borra su publicación y sus votos, y quienes lo habían votado recuperan esos votos.

**Resultado**

- [ ] En una competencia finalizada, "Compartir resultado" genera la imagen con el ganador y los dos siguientes del podio, y se puede pegar en Slack.
- [ ] Si el ganador elegido no es el más votado, el podio muestra a los dos más votados restantes.
- [ ] En un navegador que no permite copiar imágenes, la descarga funciona.

**Archivo**

- [ ] Una competencia con más de 60 días sin actividad aparece en "Para archivar"; una con actividad reciente no se puede limpiar (`NOT_INACTIVE`).
- [ ] "Exportar a Drive" sube un ZIP con `resumen.png`, las imágenes y `resultados.csv`, y el enlace queda en "Archivadas".
- [ ] Limpiar sin exportar devuelve `NOT_EXPORTED`. Después de limpiar, Storage no tiene archivos bajo esa competencia y el hub la muestra como "Archivada".

**Migración**

- [ ] Después de migrar, la competencia actual y todo el historial de la v1 aparecen en el hub como públicas, con sus ganadores, rankings e imágenes intactos.
