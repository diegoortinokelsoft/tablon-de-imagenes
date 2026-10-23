# Tablón de Imágenes — Especificación técnica

Oct 21, 2026 · @diego

## Resumen

Web interna de Grupo Kelsoft para una competencia lúdica de imágenes. Cada persona sube una imagen y reparte 3 votos entre las imágenes de los demás. El administrador controla la competencia y elige al ganador.

Este documento es la especificación completa para que Claude Code construya la plataforma desde un repositorio vacío. Todo lo marcado como regla es obligatorio y debe validarse en la base de datos, no solo en la interfaz.

| Aspecto | Definición |
| --- | --- |
| Usuarios | Menos de 100, solo cuentas Google `@grupokelsoft.com` |
| Administrador | `diego.martin.ortino@grupokelsoft.com`, que también participa como usuario |
| Hosting | Netlify, plan gratuito |
| Backend | Supabase (Auth, Postgres, Storage, Realtime), plan gratuito |
| Idioma | Español |
| Uso principal | Navegador de escritorio, con diseño responsive para móvil |

## Reglas del juego

Las reglas se aplican siempre a la competencia actual. Todas se validan en Postgres mediante RLS y funciones RPC.

**Publicaciones**

1. Cada usuario puede tener como máximo 1 publicación por competencia.
2. Una publicación tiene una imagen y un título obligatorio de hasta 80 caracteres. No lleva descripción.
3. Se muestran el nombre y el avatar de Google del autor.
4. Mientras la competencia está abierta, el autor puede editar el título, reemplazar la imagen o borrar la publicación.
5. Editar solo el título conserva los votos. Reemplazar la imagen o borrar la publicación elimina todos los votos recibidos, y esos votos vuelven a estar disponibles para quienes los dieron.
6. Formatos aceptados: JPG, PNG y WEBP, hasta 5 MB. El navegador comprime la imagen a WEBP antes de subirla.

**Votos**

1. Cada usuario tiene 3 votos por competencia. No necesita haber publicado para votar.
2. Puede repartirlos como quiera, incluso los 3 en la misma imagen.
3. No puede votar su propia publicación.
4. Puede quitar y volver a dar votos libremente mientras la competencia está abierta.
5. Los conteos son visibles para todos en tiempo real.
6. Los votos son públicos: cualquier usuario puede ver quién votó a cada imagen y cuántas veces.

**Administración**

1. Solo el administrador cambia el estado de la competencia: abrir, cerrar y finalizar.
2. Con la competencia cerrada se muestra el ranking ordenado por votos. El administrador elige al ganador al finalizar; en caso de empate también decide él.
3. El administrador puede borrar cualquier publicación en cualquier momento. Sus votos se devuelven igual que en la regla 5 de publicaciones.
4. Hay dos tipos de reinicio: un **reinicio total**, que borra definitivamente la competencia actual sin dejar historial, y una **nueva competencia**, que archiva la competencia finalizada en el historial y crea una nueva.

## Stack y arquitectura

La aplicación es una SPA estática servida por Netlify que habla directamente con Supabase. No hay servidor propio ni funciones serverless, y la clave `service_role` nunca llega al frontend.

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18, Vite, TypeScript (modo estricto) |
| Estilos | Tailwind CSS |
| Rutas | React Router |
| Datos del servidor | `@supabase/supabase-js` v2 y TanStack Query |
| Compresión de imágenes | `browser-image-compression` |
| Base de datos | Supabase Postgres con RLS y funciones RPC |
| Archivos | Supabase Storage, bucket privado `submissions` |
| Tiempo real | Supabase Realtime (`postgres_changes`) |
| Migraciones | Supabase CLI, carpeta `supabase/migrations` |
| Tests | Vitest para la lógica del frontend; SQL de prueba para las reglas |

Toda escritura en la base pasa por funciones RPC con `security definer`. Las tablas solo permiten `select` directo a usuarios autorizados. Así las reglas no se pueden saltar desde la consola del navegador.

## Roles y autenticación

Solo entran cuentas Google del dominio `grupokelsoft.com`. La restricción se aplica en cuatro capas, porque las primeras dos solo filtran en la pantalla de Google.

1. **Pantalla de consentimiento de Google como "Interna".** Si `grupokelsoft.com` es una organización de Google Workspace, Google solo deja iniciar sesión a cuentas de la organización.
2. **Parámetro `hd`.** El login llama a `signInWithOAuth({ provider: 'google', options: { queryParams: { hd: 'grupokelsoft.com', prompt: 'select_account' }, redirectTo: window.location.origin } })`. Esto solo sugiere la cuenta; no es una protección.
3. **Bloqueo al crear el usuario.** Un Auth Hook "Before User Created" de Supabase rechaza cualquier email que no termine en `@grupokelsoft.com`. Si el hook no está disponible en el proyecto, se usa un trigger `before insert` sobre `auth.users` que lanza una excepción.
4. **RLS.** La función `public.is_allowed_user()` devuelve verdadero solo si el email del JWT termina en `@grupokelsoft.com`. Todas las políticas y RPC la exigen.

Si alguien con otro dominio llega a la app, se cierra su sesión y se muestra: "Solo pueden ingresar cuentas @grupokelsoft.com".

**Administrador.** La tabla `admins(email)` se carga en la migración con `diego.martin.ortino@grupokelsoft.com`. La función `public.is_admin()` compara el email del JWT, en minúsculas, contra esa tabla. El frontend llama a `rpc('is_admin')` solo para decidir si muestra el panel; la seguridad real está en las RPC de administración, que verifican `is_admin()` por su cuenta.

El administrador participa como cualquier usuario: tiene su publicación y sus 3 votos, con las mismas restricciones.

**Perfiles.** Un trigger sobre `auth.users` crea la fila en `profiles` con nombre y avatar tomados de `raw_user_meta_data` (`full_name`, `avatar_url`). En cada inicio de sesión el frontend actualiza nombre y avatar por si cambiaron en Google.

## Estados de la competencia

Siempre hay exactamente una competencia actual, y solo el administrador cambia su estado. Las competencias anteriores quedan archivadas como historial de solo lectura.

| Estado | Etiqueta en la UI | Subir y editar | Votar | Qué se ve |
| --- | --- | --- | --- | --- |
| `pending` | Preparada | No | No | Aviso de que la competencia todavía no abrió |
| `open` | Abierta | Sí | Sí | Tablón con conteos en vivo |
| `closed` | Cerrada | No | No | Ranking ordenado por votos, sin ganador |
| `finalized` | Finalizada | No | No | Ganador destacado y ranking completo |
| `archived` | (historial) | No | No | Solo en la página de historial |

&#91;embedded content: ciclo de vida de una competencia · 5 estados\]

El administrador mueve la competencia de izquierda a derecha; solo puede volver atrás reabriendo una competencia cerrada.

Transiciones permitidas, todas ejecutadas por el administrador:

- `pending` → `open`: abrir la competencia.
- `open` → `closed`: cerrar la participación.
- `closed` → `open`: reabrir, por si se cerró antes de tiempo.
- `closed` → `finalized`: finalizar eligiendo una publicación ganadora.
- `finalized` → `archived`: ocurre solo al crear una nueva competencia, que nace en `pending`.
- Reinicio total desde cualquier estado: borra la competencia actual y crea una nueva en `pending`, sin pasar por el historial.

## Modelo de datos

Cinco tablas y dos vistas en el esquema `public`. Las competencias archivadas conservan sus publicaciones, votos e imágenes para el historial.

| Tabla | Propósito | Claves y restricciones |
| --- | --- | --- |
| `admins` | Emails con rol de administrador | PK `email`, siempre en minúsculas |
| `profiles` | Nombre y avatar de cada usuario | PK `id` → `auth.users.id`, `email` único |
| `rounds` | Competencias, actual e históricas | Índice único parcial: una sola fila con `status <> 'archived'` |
| `submissions` | Publicaciones | Único `(round_id, user_id)`; título de 1 a 80 caracteres |
| `votes` | Un voto por fila; hasta 3 filas por votante y competencia | FK a `submissions` con `on delete cascade`, así borrar una publicación devuelve los votos |

Esquema de referencia para la primera migración:

```sql
create extension if not exists pgcrypto;

create type public.round_status as enum ('pending','open','closed','finalized','archived');

create table public.admins (
  email text primary key check (email = lower(email))
);
insert into public.admins (email) values ('diego.martin.ortino@grupokelsoft.com');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  status public.round_status not null default 'pending',
  winner_submission_id uuid,
  created_at timestamptz not null default now(),
  opened_at timestamptz,
  closed_at timestamptz,
  finalized_at timestamptz,
  archived_at timestamptz
);
create unique index rounds_one_current on public.rounds ((true)) where status <> 'archived';

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  image_path text not null,
  width int,
  height int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (round_id, user_id)
);

alter table public.rounds
  add constraint rounds_winner_fk foreign key (winner_submission_id)
  references public.submissions(id) on delete set null;

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index votes_round_voter_idx on public.votes (round_id, voter_id);
create index votes_submission_idx on public.votes (submission_id);

-- Primera competencia
insert into public.rounds (name) values ('Competencia 1');
```

**Vistas** (ambas con `security_invoker = true`, para que respeten RLS):

- `board`: una fila por publicación con título, imagen, autor (`author_name`, `author_avatar`), `vote_count` y `position` calculado con `rank() over (partition by round_id order by vote_count desc)`. `rank()` da la misma posición a los empates.
- `vote_details`: por publicación y votante, el nombre, el avatar y la cantidad de votos dados (`count(*)` agrupado por `submission_id, voter_id`). Alimenta el "ver quién votó".

Los votos que le quedan a un usuario se calculan en el cliente: 3 menos sus filas en `votes` para la competencia actual.

## Seguridad: RLS y funciones RPC

Las tablas solo se leen; toda escritura pasa por RPC. RLS está activo en las cinco tablas, y ninguna tiene políticas de `insert`, `update` o `delete`.

**Políticas de lectura**

- `profiles`, `rounds`, `submissions`, `votes`: `select` permitido si `public.is_allowed_user()`.
- `admins`: sin políticas, es decir, nadie la lee directamente.

**Funciones base**

```sql
create function public.is_allowed_user() returns boolean
language sql stable as $$
  select coalesce(lower(auth.jwt() ->> 'email') like '%@grupokelsoft.com', false)
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower(auth.jwt() ->> 'email')
  )
$$;

create function public.current_round() returns public.rounds
language sql stable security definer set search_path = '' as $$
  select * from public.rounds where status <> 'archived' limit 1
$$;
```

**Reglas comunes a todas las RPC.** Son `security definer` con `set search_path = ''` y nombres totalmente calificados. Empiezan verificando `is_allowed_user()`, y las de administración también `is_admin()`. Ante un error lanzan `raise exception` con un código fijo, que el frontend traduce a un mensaje en español. Se revoca `execute` a `anon` y se otorga solo a `authenticated`.

| RPC | Quién | Qué hace | Condiciones |
| --- | --- | --- | --- |
| `sync_my_profile()` | Usuario | Crea o actualiza su perfil desde `auth.users` | — |
| `create_submission(title, image_path, width, height)` | Usuario | Crea su publicación; devuelve el id | Competencia abierta; sin publicación previa; la ruta empieza con `{round_id}/{uid}/` |
| `update_submission_title(title)` | Usuario | Cambia el título y conserva los votos | Competencia abierta |
| `replace_submission_image(image_path, width, height)` | Usuario | Borra los votos recibidos y cambia la imagen; devuelve la ruta anterior | Competencia abierta |
| `delete_my_submission()` | Usuario | Borra su publicación (los votos caen en cascada); devuelve la ruta | Competencia abierta |
| `cast_vote(submission_id)` | Usuario | Agrega un voto | Abierta; publicación de la competencia actual; no propia; menos de 3 votos usados |
| `remove_vote(submission_id)` | Usuario | Quita uno de sus votos en esa publicación | Abierta; tiene al menos un voto ahí |
| `admin_set_round_status(status)` | Admin | Abre, cierra o reabre y guarda la fecha | Solo transiciones permitidas |
| `admin_rename_round(name)` | Admin | Renombra la competencia actual | — |
| `admin_finalize_round(winner_submission_id)` | Admin | Fija el ganador y pasa a `finalized` | Estado `closed`; el ganador es de esta competencia |
| `admin_delete_submission(submission_id)` | Admin | Borra una publicación; devuelve la ruta | Cualquier estado salvo `archived` |
| `admin_hard_reset(name)` | Admin | Borra la competencia actual y crea una nueva en `pending`; devuelve el id borrado | — |
| `admin_start_new_round(name)` | Admin | Archiva la actual y crea una nueva en `pending` | Estado `finalized` |
| `admin_delete_archived_round(round_id)` | Admin | Borra una competencia del historial; devuelve su id | Estado `archived` |

Las RPC que devuelven una ruta o un id de competencia lo hacen para que el cliente borre luego los archivos de Storage, como se explica en la sección siguiente.

**Códigos de error:** `NOT_ALLOWED`, `NOT_ADMIN`, `ROUND_NOT_OPEN`, `ALREADY_SUBMITTED`, `NO_SUBMISSION`, `INVALID_PATH`, `INVALID_TITLE`, `OWN_SUBMISSION`, `NO_VOTES_LEFT`, `NO_VOTE_TO_REMOVE`, `INVALID_TRANSITION`, `INVALID_WINNER`.

**Concurrencia en los votos.** `cast_vote` toma `pg_advisory_xact_lock` sobre el id del usuario antes de contar sus votos. Así, dos clics rápidos no pueden superar el límite de 3.

```sql
create function public.cast_vote(p_submission_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_round public.rounds;
  v_owner uuid;
  v_used int;
begin
  if not public.is_allowed_user() then raise exception 'NOT_ALLOWED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text, 0));
  v_round := public.current_round();
  if v_round.status <> 'open' then raise exception 'ROUND_NOT_OPEN'; end if;
  select user_id into v_owner from public.submissions
    where id = p_submission_id and round_id = v_round.id;
  if v_owner is null then raise exception 'NO_SUBMISSION'; end if;
  if v_owner = v_uid then raise exception 'OWN_SUBMISSION'; end if;
  select count(*) into v_used from public.votes
    where round_id = v_round.id and voter_id = v_uid;
  if v_used >= 3 then raise exception 'NO_VOTES_LEFT'; end if;
  insert into public.votes (round_id, voter_id, submission_id)
    values (v_round.id, v_uid, p_submission_id);
end $$;
```

## Storage de imágenes

Las imágenes van a un bucket privado, `submissions`, y se muestran con URLs firmadas. Así, una captura interna no queda accesible para quien no haya iniciado sesión.

**Bucket** (creado por migración): `public = false`, `file_size_limit = 5242880` (5 MB), `allowed_mime_types = {image/webp, image/jpeg, image/png}`.

**Ruta de cada archivo:** `{round_id}/{user_id}/{uuid}.webp`. Cada reemplazo genera un nombre nuevo, lo que evita problemas de caché.

**Políticas sobre `storage.objects`** (todas con `bucket_id = 'submissions'`):

- `select`: `is_allowed_user()`.
- `insert`: `is_allowed_user()`, la segunda carpeta igual a `auth.uid()` y la primera igual al id de la competencia actual en estado `open`.
- `delete`: la segunda carpeta igual a `auth.uid()`, o `is_admin()`.
- Sin `update`: los archivos nunca se sobrescriben.

**Compresión en el navegador.** Primero se valida el archivo original (JPG, PNG o WEBP, hasta 5 MB). Después se comprime con `browser-image-compression`: `fileType: 'image/webp'`, `maxWidthOrHeight: 2560`, `maxSizeMB: 1`, `initialQuality: 0.85`. El lado máximo de 2560 px conserva legible el texto de las capturas. Se leen ancho y alto del resultado para guardarlos.

**Flujos de archivo**

1. Publicar: subir el archivo → `create_submission`. Si la RPC falla, el cliente borra el archivo recién subido.
2. Reemplazar: subir el nuevo → `replace_submission_image` → borrar la ruta anterior que devuelve la RPC.
3. Borrar (usuario o admin): RPC → borrar la ruta devuelta.
4. Reinicio total o borrar competencia archivada: RPC → el cliente admin lista las carpetas bajo `{round_id}/` y borra todos los objetos en lotes de hasta 100.

**Mostrar imágenes.** Se usa `createSignedUrls` en lote para todas las publicaciones visibles, con 1 hora de validez. TanStack Query cachea el resultado y lo renueva a los 50 minutos.

Con menos de 100 personas y archivos de alrededor de 1 MB, cada competencia ocupa unos 100 MB. Conviene borrar competencias viejas del historial si el espacio se acerca al límite del plan gratuito.

## Tiempo real

Cualquier cambio en publicaciones, votos o estado de la competencia se ve en todos los navegadores en menos de un segundo, sin recargar.

- Una migración agrega `rounds`, `submissions` y `votes` a la publicación `supabase_realtime`.
- El cliente abre un solo canal, `board`, con `postgres_changes` (evento `*`) sobre las tres tablas.
- Ante cualquier evento, el cliente no aplica el cambio a mano: invalida las consultas de TanStack Query (`board`, `vote_details`, `current_round`, `my_votes`) con un debounce de 300 ms y vuelve a leer. Con menos de 100 usuarios es más simple y no se desincroniza.
- También se vuelve a leer al recuperar el foco de la ventana y al reconectar el canal.
- Cuando el estado cambia (por ejemplo, el admin cierra la competencia), la interfaz cambia de vista sola y muestra un aviso: "La votación se cerró".
- Los votos optimistas no son necesarios: el botón se deshabilita mientras la RPC responde y luego se refresca.

## Pantallas y UX

La interfaz está pensada primero para escritorio, con columnas que se reducen en pantallas chicas. Todos los textos están en español.

| Ruta | Pantalla | Acceso |
| --- | --- | --- |
| `/login` | Inicio de sesión | Público |
| `/` | Tablón (cambia según el estado) | Usuario autorizado |
| `/historial` | Lista de competencias archivadas | Usuario autorizado |
| `/historial/:roundId` | Ranking y ganador de una competencia pasada | Usuario autorizado |
| `/admin` | Panel de administración | Solo admin; los demás son redirigidos a `/` |

**Login.** Título de la app, un botón "Ingresar con Google" y la aclaración "Solo cuentas @grupokelsoft.com".

**Encabezado (todas las páginas).** Nombre de la competencia, una etiqueta con el estado, el contador "Te quedan N de 3 votos", enlaces a Historial y a Admin (solo para el admin), y un menú con avatar y "Cerrar sesión".

**Tablón, estado abierto.**

- "Mi publicación" es un cajón lateral izquierdo que **arranca siempre oculto**. Oculto, asoma una franja de 24 px por el borde izquierdo; al pasar el mouse asoma un poco más y su flecha se mueve, para sugerir que se despliega con un clic.
- Se despliega u oculta con el botón de ícono a la izquierda del encabezado (solo visible en el tablón abierto), con un clic en la franja o arrastrándola: hacia la derecha abre y hacia la izquierda cierra, con mouse o con dedo.
- En escritorio (desde 1024 px), abierto empuja la grilla hacia la derecha. En móvil se superpone a la grilla con un velo `night-900` al 70 %, y se cierra con un clic en el velo o con Escape.
- Pegar o soltar una imagen con el cajón oculto lo despliega.
- Sin publicación: zona para subir que acepta arrastrar y soltar, elegir un archivo o pegar con Ctrl+V (útil para capturas), más el campo de título y una vista previa antes de confirmar.
- Con publicación: miniatura, título editable y los botones "Reemplazar imagen" y "Borrar". Si la publicación tiene votos, ambos piden confirmación: "Vas a perder los N votos recibidos".
- Grilla de tarjetas: 4 columnas desde 1280 px, 3 desde 1024 px, 2 desde 640 px y 1 en móvil.
- Cada tarjeta muestra la imagen (proporción 16:10, recortada), el título, avatar y nombre del autor, el total de votos y los votos propios en ella.
- Botones "+1" y "−1": "+1" se deshabilita sin votos disponibles; "−1", si el usuario no votó esa imagen.
- La propia tarjeta lleva la marca "Tu publicación" y no tiene botones de voto.
- "Ver votantes" abre un popover con avatar, nombre y cantidad (por ejemplo, "Ana ×2").
- Un clic en la imagen la abre a tamaño completo en un lightbox.
- Selector de orden: "Más recientes" (por defecto) o "Más votadas".

**Tablón, estado preparada.** Mensaje "La competencia todavía no abrió". Si hay una competencia archivada, se muestra un enlace a su resultado.

**Tablón, estado cerrado.** Aviso "La votación está cerrada" y la vista de ranking en lugar de la grilla: posición, miniatura, título, autor y votos. Los empates comparten posición y llevan la etiqueta "Empate".

**Tablón, estado finalizado.** Arriba, el ganador destacado con imagen grande, título, autor y votos; debajo, el ranking completo.

**Historial.** Lista de competencias archivadas con nombre, fecha de finalización, miniatura y nombre del ganador. El detalle muestra el mismo ranking que el estado finalizado.

**Panel de administración.**

- Competencia actual: nombre editable, estado y solo los botones válidos para ese estado (Abrir, Cerrar, Reabrir).
- Números: participantes con sesión, publicaciones y votos emitidos.
- Tabla de publicaciones ordenada por votos, con un botón "Borrar" por fila (pide confirmación).
- En estado cerrado: una opción para elegir el ganador en cada fila y el botón "Finalizar competencia". Si hay empate en el primer puesto se avisa, pero la elección queda libre.
- En estado finalizado: botón "Nueva competencia" con campo de nombre.
- Zona de peligro: "Reinicio total", que exige escribir `BORRAR` para confirmar.
- Historial: botón "Eliminar del historial" por competencia archivada, con confirmación.

**Mensajes de error** (por código de RPC): "La competencia no está abierta", "Ya tienes una publicación", "No puedes votar tu propia publicación", "Ya usaste tus 3 votos", "La imagen supera los 5 MB", "Formato no admitido: usa JPG, PNG o WEBP". Se muestran como toasts.

**Accesibilidad.** Botones con texto o `aria-label`, foco visible, contraste AA y el lightbox se cierra con Escape.

## Guía de estilo

La interfaz tiene estética de juego de fiesta online: fondo violeta profundo, tarjetas claras con borde grueso, botones "de juguete" con sombra sólida y títulos en una tipografía gruesa en mayúsculas. Se implementa en la Fase 1 como tokens de Tailwind y clases de componentes, y todas las pantallas los usan.

**Inspiración.** [Make it Meme](https://makeitmeme.com/es/play) usa un esquema oscuro sobre violeta muy oscuro (`#1D1133`). [Gartic Phone](https://garticphone.com/es) usa un violeta saturado (`#6520A0`), títulos en mayúsculas y pasos numerados de "cómo jugar". De ambas se toma el tono, la paleta y la sensación táctil. Nunca se copian logos, personajes, ilustraciones ni nombres de esos juegos.

**Principios**

1. Lúdico, pero legible: lo divertido está en el color y el movimiento, nunca a costa de leer bien un título o un número.
2. Las imágenes son protagonistas: los marcos son blancos y simples, y el color fuerte queda alrededor.
3. Un color por intención: amarillo para la acción principal, rosa para los votos, cian para lo secundario y rojo para lo destructivo.
4. Todo responde al tocarlo: los botones se "hunden" al hacer clic y los contadores rebotan al cambiar.

**Colores**

| Token | Hex | Uso |
| --- | --- | --- |
| `night-900` | `#1D1133` | Fondo base de la app |
| `night-800` | `#2A1A4A` | Encabezado, paneles oscuros, popovers |
| `brand-600` | `#6520A0` | Extremo del degradado de fondo, foco, enlaces sobre claro |
| `brand-400` | `#9B5CF0` | Hover y bordes activos sobre oscuro |
| `surface` | `#FFFFFF` | Tarjetas, modales, panel "Mi publicación" |
| `surface-alt` | `#F3EEFB` | Inputs y zonas internas de las tarjetas |
| `ink` | `#1A1030` | Texto sobre claro, bordes gruesos, sombras sólidas |
| `ink-muted` | `#6B6283` | Texto secundario sobre claro |
| `on-night` | `#FFFFFF` | Texto sobre fondo oscuro |
| `on-night-muted` | `#C9BEE6` | Texto secundario sobre oscuro |
| `sun` | `#FFD23F` | Botón primario (Publicar, +1, Finalizar), texto en `ink` |
| `vote` | `#FF4F8B` | Contador de votos, fichas de voto, ganador |
| `sky` | `#2EC4E6` | Botones secundarios, información, estado Abierta |
| `success` | `#3DDC84` | Confirmaciones |
| `danger` | `#FF5A5F` | Borrar, reinicio total, errores |

La app tiene un solo tema, oscuro, sin modo claro. Todo texto debe cumplir contraste AA: sobre `sun`, `sky` y `success` siempre va `ink`, nunca blanco.

**Fondo.** El degradado es `linear-gradient(160deg, #1D1133 0%, #3A1670 55%, #6520A0 100%)`, fijo al viewport. Encima lleva un patrón propio de garabatos simples (estrellas, círculos, rayitas) en SVG, en blanco al 6 % de opacidad.

**Tipografía** (Google Fonts, con respaldo `system-ui, sans-serif`)

| Rol | Fuente | Tamaño / peso | Notas |
| --- | --- | --- | --- |
| Título de página | Lilita One | 40 px (28 px en móvil) | Mayúsculas, `letter-spacing: 0.02em` |
| Título de sección | Lilita One | 24 px | Mayúsculas |
| Título de tarjeta | Nunito | 18 px / 800 | Una línea, con elipsis |
| Texto | Nunito | 16 px / 600 | — |
| Secundario | Nunito | 14 px / 600 | — |
| Etiquetas y chips | Nunito | 12 px / 800 | Mayúsculas |
| Números de votos | Lilita One | 28 px en tarjeta, 48 px en el ganador | Cifras tabulares |

**Forma y profundidad**

- Bordes de 3 px en `ink` para tarjetas, botones, inputs y avatares sobre claro.
- Radios: tarjetas y modales de 20 px, botones e inputs de 14 px, chips y contadores completamente redondeados.
- Sombra sólida, sin desenfoque: botones `0 6px 0 #1A1030` (4 px en los chicos), tarjetas `0 8px 0 rgba(0,0,0,0.35)`.
- Botón presionado: `translateY(4px)` y la sombra baja a 2 px. Deshabilitado: 45 % de opacidad, sin sombra.
- Espaciado en múltiplos de 4: 4, 8, 12, 16, 24, 32, 48. La grilla del tablón usa 24 px de separación en escritorio y 16 px en móvil.
- Foco visible: anillo de 3 px en `brand-400` con 2 px de separación.

**Componentes**

| Componente | Especificación |
| --- | --- |
| Botón primario | Fondo `sun`, texto `ink` en Nunito 800 y mayúsculas, borde y sombra sólida; alto de 48 px (40 px el chico) |
| Botón secundario | Igual que el primario, con fondo `sky` |
| Botón de peligro | Fondo `danger`, texto `ink` (blanco no cumple AA); siempre abre una confirmación |
| Botón de ícono | Cuadrado de 40 px con el mismo borde y sombra; ícono de 20 px |
| Tarjeta de publicación | Fondo `surface`, borde, radio y sombra de tarjeta. Imagen 16:10 con radio de 12 px y 12 px de margen interno. Debajo: título, avatar y nombre, y una fila con el contador y los botones −1 / +1. Al pasar el mouse sube 4 px |
| Tarjeta propia | Igual, con el chip "TU PUBLICACIÓN" en `brand-600` sobre la imagen y borde punteado en `brand-400` |
| Contador de votos | Píldora `vote` con el número en Lilita One blanco; a la derecha, tantos puntos chicos como votos propios en esa imagen |
| Fichas de voto (encabezado) | Tres círculos de 20 px: rellenos en `vote` los disponibles y vacíos con borde los usados, junto al texto "TE QUEDAN N" |
| Avatar | Círculo con borde blanco de 3 px sobre oscuro (`ink` sobre claro); 32 px en tarjetas y 40 px en el encabezado; iniciales sobre `brand-400` si no hay foto |
| Chip de estado | Preparada en gris `on-night-muted`; Abierta en `sky` con un punto que late; Cerrada en `sun`; Finalizada en `vote` con trofeo |
| Cajón "Mi publicación" | Tarjeta `surface` de 384 px, fija bajo el encabezado, que se desliza en 200 ms con el rebote de la guía. En su borde derecho, una franja de arrastre de 24 px: flecha a la derecha oculto, ícono de agarre abierto |
| Zona de subida | Panel `surface-alt`, borde discontinuo de 3 px en `brand-400`, ícono de imagen de 48 px y el texto "Arrastra, elige o pega (Ctrl+V) tu captura"; al arrastrar encima, el borde pasa a `sun` |
| Inputs | Fondo `surface-alt`, borde de 3 px, radio de 14 px; contador de caracteres "0/80" a la derecha |
| Modal | Tarjeta `surface` de máximo 480 px, centrada, sobre un velo `night-900` al 70 %; título en Lilita One; botones abajo a la derecha (de ancho completo en móvil) |
| Toast | Arriba al centro, píldora `night-800` con borde de 3 px del color del tipo (`success`, `danger`, `sky`); se cierra sola a los 4 s |
| Popover de votantes | Panel `night-800`, lista de avatar, nombre y "×N" en `vote` |
| Lightbox | Fondo `night-900` al 92 %, imagen a máximo 90 vw por 90 vh, título y autor abajo, cierre con Escape o clic fuera |
| Fila de ranking | Tarjeta horizontal: posición en Lilita One de 32 px, miniatura de 96 px, título, autor y contador. Los puestos 1, 2 y 3 llevan una medalla dorada (`#FFC233`), plateada (`#C7CEDB`) o de bronce (`#D98A4E`); los empates muestran el chip "EMPATE" |
| Ganador destacado | Imagen grande con borde de 6 px en `sun`, el título "¡GANADOR!" en Lilita One de 48 px, trofeo y una ráfaga de confeti CSS que se reproduce una sola vez |
| Página de login | Logo o título del juego centrado en Lilita One, una tarjeta `surface` con el botón de Google (blanco, borde y sombra sólida) y el aviso de dominio |

**Movimiento**

- Duraciones de 150 a 250 ms. Rebote breve con `cubic-bezier(0.34, 1.56, 0.64, 1)` para entradas de tarjetas, modales y toasts.
- Al cambiar un voto, el número del contador hace `scale 1 → 1.25 → 1` en 200 ms, y la ficha del encabezado se vacía o rellena con el mismo rebote.
- Las tarjetas nuevas que llegan por tiempo real entran con un fundido y una subida de 8 px.
- Con `prefers-reduced-motion` se quitan rebotes, confeti y el punto que late, y se dejan solo fundidos.

**Íconos y textos**

- Íconos de `lucide-react` con trazo 2.5, para acompañar los bordes gruesos.
- Títulos, chips y botones en mayúsculas; el texto corrido en minúsculas normales. Frases cortas y con energía ("¡A VOTAR!", "Te quedan 2 votos") y signos de exclamación con moderación.

**Implementación**

- Los colores, fuentes, radios y sombras se definen en `tailwind.config.ts` dentro de `theme.extend`, con los nombres de token de esta sección.
- Las clases reutilizables (`btn`, `btn-primary`, `btn-secondary`, `btn-danger`, `card`, `chip`, `input`) van en `src/styles/components.css` con `@apply`.
- Las fuentes se cargan con `<link>` a Google Fonts en `index.html`, con `display=swap`.
- Se agrega una página `/estilos`, solo visible para el admin, que muestra todos los componentes en sus estados normal, hover, presionado y deshabilitado, para revisar la guía de un vistazo.

## Configuración y despliegue

Estos pasos son manuales y los hace Diego, una sola vez. Claude Code debe dejar un `README.md` que los repita.

**Variables de entorno** (`.env.local` en desarrollo y Netlify en producción):

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública (anon o publishable) |
| `VITE_ALLOWED_DOMAIN` | `grupokelsoft.com`, usado solo para el parámetro `hd` y los textos |

**Google Cloud**

1. Crear un proyecto y configurar la pantalla de consentimiento OAuth como "Interna", si la cuenta de Google Workspace lo permite.
2. Crear un cliente OAuth de tipo "Aplicación web".
3. En "URI de redirección autorizados", agregar `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Copiar el Client ID y el Client Secret.

**Supabase**

1. Crear el proyecto en el plan gratuito, en la región más cercana a los usuarios.
2. En Authentication → Providers → Google, activar el proveedor y pegar el Client ID y el Secret.
3. En Authentication → URL Configuration, poner como Site URL la URL de Netlify y agregar como Redirect URLs `http://localhost:5173` y la URL de Netlify.
4. Aplicar las migraciones con `supabase link` y `supabase db push`.
5. En Authentication → Hooks, conectar el hook "Before User Created" a la función de la migración.

**Netlify**

1. Conectar el repositorio de Git.
2. Comando de build: `npm run build`. Carpeta de publicación: `dist`.
3. Cargar las tres variables de entorno.
4. Agregar `netlify.toml` en la raíz del repo:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Plan gratuito de Supabase.** Los proyectos gratuitos se pausan tras una semana sin actividad. Conviene entrar a la app o al panel de Supabase antes de cada competencia. Revisar los límites vigentes de base, Storage y Realtime en la página de precios de Supabase.

## Estructura del proyecto y plan de implementación

Claude Code debe construir en el orden de las fases y verificar cada una antes de seguir.

```text
/
├─ netlify.toml
├─ README.md
├─ .env.example
├─ index.html
├─ package.json
├─ vite.config.ts
├─ tailwind.config.ts
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/
│  │  ├─ 0001_schema.sql        tipos, tablas, índices, vistas, competencia inicial
│  │  ├─ 0002_auth.sql          is_allowed_user, is_admin, hook de dominio, trigger de perfiles
│  │  ├─ 0003_rls.sql           RLS y políticas de lectura
│  │  ├─ 0004_rpc_user.sql      RPC de usuario
│  │  ├─ 0005_rpc_admin.sql     RPC de administración
│  │  ├─ 0006_storage.sql       bucket y políticas de storage.objects
│  │  └─ 0007_realtime.sql      publicación supabase_realtime
│  └─ tests/rules.sql           casos de prueba de las reglas
└─ src/
   ├─ main.tsx, App.tsx, router.tsx
   ├─ lib/        supabase.ts, errors.ts (código → mensaje), image.ts (validar y comprimir), storage.ts
   ├─ hooks/      useSession, useIsAdmin, useCurrentRound, useBoard, useMyVotes, useRealtime
   ├─ components/ Header, SubmissionCard, MySubmissionPanel, UploadDropzone, VotersPopover,
   │              Lightbox, RankingList, WinnerHero, ConfirmDialog, Toasts
   └─ pages/      LoginPage, BoardPage, HistoryPage, HistoryDetailPage, AdminPage
```

- [x] **Fase 1. Base del proyecto:** Vite, React, TypeScript, Tailwind, React Router, cliente Supabase, `.env.example` y `netlify.toml`.
- [x] **Fase 2. Base de datos:** migraciones 0001 a 0007 y `supabase/tests/rules.sql`. Este archivo prueba cada regla: votar lo propio, un cuarto voto, votar con la competencia cerrada, segunda publicación, devolución de votos al reemplazar, RPC de admin llamada por un no admin y dominio no permitido.
- [x] **Fase 3. Autenticación:** login con Google, sesión persistente, cierre de sesión ante un dominio inválido, `sync_my_profile`, guardas de ruta y `useIsAdmin`.
- [x] **Fase 4. Publicar:** zona de subida con arrastrar, elegir archivo y pegar; validación; compresión; flujos de publicar, editar título, reemplazar y borrar.
- [x] **Fase 5. Tablón y votos:** grilla, conteos, +1 y −1, votos restantes, ver votantes, lightbox y orden.
- [x] **Fase 6. Tiempo real:** canal `board`, invalidación con debounce y cambio de vista según el estado.
- [x] **Fase 7. Estados y ranking:** vistas preparada, cerrada (ranking con empates) y finalizada (ganador).
- [x] **Fase 8. Administración:** cambios de estado, renombrar, borrar publicación, finalizar con ganador, nueva competencia, reinicio total y limpieza de Storage.
- [x] **Fase 9. Historial:** lista y detalle de competencias archivadas, y eliminar del historial.
- [x] **Fase 10. Pulido y entrega:** responsive, accesibilidad, mensajes de error, estados vacíos y de carga, y `README.md` con los pasos de configuración.

## Criterios de aceptación

La plataforma está lista cuando todos estos casos pasan en el entorno publicado en Netlify.

**Acceso**

- [ ] Una cuenta `@grupokelsoft.com` inicia sesión y ve el tablón.
- [ ] Una cuenta de otro dominio no puede entrar y ve el mensaje correspondiente.
- [ ] Solo `diego.martin.ortino@grupokelsoft.com` ve y usa `/admin`; llamar a una RPC de admin desde otra cuenta devuelve `NOT_ADMIN`.

**Publicaciones**

- [ ] Con la competencia abierta, un usuario publica una imagen con título; un segundo intento devuelve `ALREADY_SUBMITTED`.
- [ ] Un archivo de más de 5 MB o en otro formato se rechaza antes de subirse.
- [ ] Pegar una captura con Ctrl+V la carga en la zona de subida.
- [ ] Editar el título conserva los votos.
- [ ] Reemplazar la imagen deja la publicación en 0 votos, y los votantes recuperan esos votos.
- [ ] Borrar la publicación también devuelve los votos y elimina el archivo de Storage.

**Votos**

- [ ] Un usuario da sus 3 votos a la misma imagen; el cuarto devuelve `NO_VOTES_LEFT`.
- [ ] Votar la propia publicación es imposible desde la UI y por RPC (`OWN_SUBMISSION`).
- [ ] Un voto aparece en otro navegador abierto en menos de 2 segundos sin recargar.
- [ ] "Ver votantes" muestra quién votó y cuántas veces.
- [ ] Diez clics muy rápidos en "+1" nunca registran más de 3 votos.

**Estados y administración**

- [ ] Al cerrar, nadie puede subir, editar ni votar, y todos ven el ranking sin recargar.
- [ ] Los empates comparten posición en el ranking.
- [ ] El admin reabre una competencia cerrada y se puede volver a votar.
- [ ] El admin finaliza eligiendo cualquier publicación, incluso con empate, y el ganador queda destacado para todos.
- [ ] El admin borra una publicación inapropiada y sus votos vuelven a los votantes.
- [ ] "Nueva competencia" archiva la finalizada, que aparece en el historial con ganador y ranking, y crea una nueva en estado preparada.
- [ ] "Reinicio total" borra publicaciones, votos y archivos de la competencia actual sin dejar historial.
- [ ] Eliminar una competencia del historial borra sus datos y archivos.

**Interfaz**

- [ ] Se ve correctamente a 1440 px, 1024 px y 390 px de ancho.
- [ ] Todos los textos visibles están en español.
