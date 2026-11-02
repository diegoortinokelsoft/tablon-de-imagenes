# Frontend: arquitectura y experiencia de uso

Documento técnico de la SPA del Tablón de Imágenes: cómo está organizada, cómo fluyen los datos y cómo está pensada la experiencia en cada pantalla. El backend está en [supabase.md](supabase.md) y la especificación funcional en [especificacion-v2.md](especificacion-v2.md).

> **Estado:** v2 (competencias múltiples) en la rama `v2`, octubre de 2026. La v1 estuvo en producción en Netlify desde octubre de 2026.

## 1. Stack y principios

| Capa | Tecnología |
| --- | --- |
| Base | React 18, Vite 6, TypeScript estricto (`noUncheckedIndexedAccess` incluido) |
| Rutas | React Router 6 (`createBrowserRouter`) |
| Datos | `@supabase/supabase-js` v2 tipado con `Database`, TanStack Query 5 |
| Estilos | Tailwind CSS 3 con tokens propios; íconos `lucide-react` con trazo 2.5 |
| Imágenes | `browser-image-compression` |
| Tests | Vitest (lógica pura en `src/lib/*.test.ts`) |

Principios que guían el código:

1. **El frontend nunca escribe en tablas.** Solo lee tablas y vistas, y llama RPC. Las reglas del juego viven en Postgres; la UI solo las hace cómodas (deshabilitar "+1" sin votos, etc.).
2. **No hay estado optimista.** Después de cada acción se invalidan las consultas y se vuelve a leer. Con menos de 100 personas es más simple y nunca se desincroniza.
3. **Todo el texto visible está en español.** Los errores se traducen en un solo lugar (`src/lib/errors.ts`).
4. **Solo tokens de la guía de estilo.** Nada de colores o tamaños sueltos (ver la sección 9).

## 2. Estructura

```text
src/
├─ main.tsx              Providers: QueryClient → SessionProvider → ToastProvider → RouterProvider
├─ router.tsx            Rutas, guardas y página de error
├─ App.tsx               Layout autenticado: RequireAuth → SubmissionDrawerProvider → Header + <Outlet/>
├─ lib/                  Lógica sin React (testeable) y acceso a Supabase
│  ├─ supabase.ts        Cliente tipado (PKCE, sesión persistente)
│  ├─ env.ts             Valida las variables VITE_* al arrancar
│  ├─ database.types.ts  Generado con `npm run types` (no editar a mano)
│  ├─ auth.ts            Login con Google, regla de dominio, avisos de login
│  ├─ errors.ts          Código de RPC → mensaje en español
│  ├─ board.ts           BoardItem, orden, ranking, empates, votos restantes, título
│  ├─ image.ts           Validación y compresión
│  ├─ storage.ts         Rutas, subida, borrado, URLs firmadas, limpieza por carpeta
│  ├─ submissions.ts     Flujos de publicar, reemplazar, borrar y editar título
│  ├─ rounds.ts          Acciones del dueño (crear, estados, visibilidad, ganador, borrar) + limpieza de Storage
│  ├─ members.ts         Invitaciones, miembros, salir y solicitudes de acceso
│  ├─ hub.ts             Pestañas, búsqueda sin tildes, orden y cupo de competencias activas
│  ├─ podium.ts          Ganador y los siguientes del podio (con empates) para la imagen del resultado
│  ├─ resultImage.ts     Imagen del resultado en canvas (1200 × 630), copiar al portapapeles y descargar
│  ├─ exportZip.ts       ZIP de exportación: resumen.png, imágenes y resultados.csv
│  ├─ drive.ts           Permiso drive.file con Google Identity Services y subida reanudable
│  ├─ admin.ts           Archivo y limpieza (superadmin)
│  ├─ realtime.ts        Claves a invalidar, debounce, avisos de cambio de estado
│  ├─ drawer.ts          Constantes y decisiones del arrastre del cajón
│  └─ labels.ts          Etiquetas de estado y visibilidad, iniciales, fechas, slugify
├─ hooks/                Consultas (TanStack Query) y contextos
├─ components/           Piezas de UI reutilizables
├─ pages/                Una por ruta
└─ styles/               index.css (base, fondo, foco, movimiento reducido) y components.css (clases de la guía)
```

**Dónde poner cada cosa:** lógica pura en `lib/` con su test; acceso a datos en un hook de `hooks/`; UI en `components/` o `pages/`. Los contextos separan el `createContext` (en `hooks/`) del Provider (en `components/`), para que Fast Refresh funcione.

## 3. Rutas y acceso

| Ruta | Página | Acceso |
| --- | --- | --- |
| `/login` | `LoginPage` | Pública; con sesión redirige a `/` |
| `/` | `HubPage` | Con sesión |
| `/c/:roundId` | `RoundPage` | Con sesión; sin acceso muestra el candado, y limpiada, la lápida |
| `/c/:roundId/gestion` | `ManagePage` | Dueño ("Gestionar") o superadmin ("Moderar"); los demás vuelven a `/c/:roundId` |
| `/invitacion/:token` | `JoinPage` | Con sesión; entra a la privada y redirige a `/c/:roundId` |
| `/historial`, `/historial/:roundId` | — | Redirigen a `/` y a `/c/:roundId` (rutas de la v1) |
| `/admin` | `AdminPage` | Solo superadmin (`RequireAdmin`); los demás van a `/` |
| `/estilos` | `StylesPage` | Solo superadmin: muestra de la guía de estilo |
| cualquier otra | — | Redirige a `/` |

`RequireAuth`, `RequireAdmin` y `LegacyHistoryRedirect` están en `components/RouteGuards.tsx`. Sin sesión, `RequireAuth` recuerda la ruta pedida en `sessionStorage` (solo rutas internas, `isSafeRedirect`) y la retoma al volver de Google, que siempre vuelve al inicio: así funciona un enlace de invitación abierto sin sesión. `RequireAdmin` usa `useIsAdmin` (`rpc('is_admin')`) solo para mostrar u ocultar: la seguridad real está en las RPC. Los errores inesperados de render muestran `ErrorPage`, en español.

## 4. Sesión y login

`components/SessionProvider.tsx` escucha `onAuthStateChange`:

1. **Login:** `signInWithGoogle()` pide `hd=grupokelsoft.com` y `prompt=select_account`, y vuelve a `window.location.origin` (flujo PKCE).
2. **Dominio inválido:** si la sesión trae un email que no cumple `isAllowedEmail`, cierra la sesión y guarda un aviso en `sessionStorage`. `/login` lo muestra: "Solo pueden ingresar cuentas @grupokelsoft.com".
3. **Rechazo del hook:** si Supabase vuelve con `?error=…` en la URL, el provider lo traduce con `authErrorMessage` y limpia la URL.
4. **Perfil:** llama `sync_my_profile` una vez por inicio de sesión (fuera del callback de Auth, con `setTimeout`, para no bloquear al cliente). Si devuelve `NOT_ALLOWED`, cierra la sesión.
5. **Cierre de sesión:** limpia toda la caché de TanStack Query.

## 5. Datos

### Consultas

| Clave | Hook | Fuente |
| --- | --- | --- |
| `['hub']` | `useHub` | `rpc('hub_rounds')`: todas las competencias con lo que cada uno puede ver |
| `['round', roundId]` | `useRound` | fila de `rounds` (datos generales; null si no existe) |
| `['round_access', roundId]` | `useRoundAccess` | `rpc('can_view_round')` |
| `['round_stats', roundId]` | `useRoundStats` | `rpc('round_stats')`: participantes, publicaciones y votos |
| `['board', roundId]` | `useBoard` | vista `board`, normalizada con `toBoardItem` |
| `['my_votes', roundId, userId]` | `useMyVotes` | `votes` propios en esa competencia → `{ bySubmission, used, left }` |
| `['vote_details', roundId]` | `useVoteDetails` | vista `vote_details`, agrupada por publicación |
| `['round_members', roundId, …]` | `useMembers`, `useIsMember` | `round_members` con el perfil embebido |
| `['access_requests', roundId, …]` | `usePendingRequests`, `useMyPendingRequest` | `access_requests` pendientes |
| `['invite_token', roundId]` | `useInviteToken` | `rpc('get_invite_link')` (solo el dueño de una privada) |
| `['profile', id]`, `['profile_search', término]` | `useProfile`, `useProfileSearch` | `profiles` (dueño de una competencia; agregar miembros) |
| `['signed_urls', paths]` | `useSignedUrls` | `createSignedUrls` en lote, 1 h; se renuevan a los 50 min |
| `['is_admin', userId]` | `useIsAdmin` | `rpc('is_admin')`, sin vencimiento |
| `['admin_to_archive']`, `['admin_archives']` | `AdminPage` | `rpc('admin_rounds_to_archive')` y `rpc('admin_archives')` |

### Escrituras

Las acciones viven en `lib/submissions.ts` (participar), `lib/rounds.ts` (dueño y borrar como superadmin), `lib/members.ts` (miembros y solicitudes) y `lib/admin.ts` (archivo). Cada una llama una RPC y hace la limpieza de Storage que corresponde (ver [supabase.md §6](supabase.md#6-storage)). Los componentes:

1. deshabilitan el botón mientras la acción responde,
2. muestran el error traducido en un toast si falla,
3. invalidan las claves afectadas (y Realtime refresca a los demás navegadores).

### Tiempo real

Dos canales con `postgres_changes` (`hooks/useRealtime.ts`). Ante cualquier evento no se aplica el cambio a mano: se invalidan claves con un debounce de 300 ms, y también al reconectar.
- **`hub`** (`useHubRealtime`, montado en el layout autenticado): `rounds`, `round_members` y `access_requests`; invalida `HUB_QUERY_KEYS`.
- **`round:{id}`** (`useRoundRealtime`, en `RoundPage` y `ManagePage`): la fila de la competencia y sus `submissions`, `votes`, `round_members` y `access_requests`, filtrados por `round_id`; invalida `ROUND_QUERY_KEYS`.
- Realtime aplica el RLS de cada suscriptor. Las consultas además se vuelven a leer al volver a la ventana.

`useRoundStatusNotice` compara el estado anterior de la competencia que se mira con el nuevo y muestra un toast con `statusChangeMessage`: "La votación se cerró", "La votación se reabrió", "¡Ya hay ganador!", etc. `RoundPage` también avisa "Ya no tienes acceso a esta competencia" si a alguien lo quitan mientras mira.

## 6. Imágenes

1. **Validación** (`validateImageFile`): JPG, PNG o WEBP, hasta 5 MB, **antes** de comprimir.
2. **Compresión** (`compressImage`): WEBP, lado máximo 2560 px (mantiene legible el texto de las capturas), `maxSizeMB: 1`, calidad inicial 0,85. Lee ancho y alto del resultado.
3. **Subida** con nombre nuevo (`buildImagePath`) y `upsert: false`.
4. **Muestra** con URLs firmadas en lote. Las tarjetas usan proporción 16:10 recortada (`object-cover`); el lightbox muestra la imagen completa.

## 7. Experiencia por pantalla

### Login
Título del juego, una tarjeta con "¡A jugar!", el botón "Ingresar con Google" y la aclaración "Solo cuentas @grupokelsoft.com". Si hubo un rechazo, un aviso rojo arriba del botón explica por qué.

### Encabezado (todas las páginas con sesión)
- Botón del cajón "Mi publicación" (solo en el tablón abierto).
- Dentro de una competencia (`useMatch('/c/:roundId/*')`): su nombre y chip de estado. Fuera, "Tablón de Imágenes".
- Fichas de voto (solo con la competencia abierta y con acceso): tres círculos rosas que se vacían al votar, con "Te quedan N de 3 votos". En móvil solo las fichas; el texto queda como `aria-label`.
- Enlaces a Competencias (hub), Gestionar (dueño, con el contador de solicitudes pendientes) o Moderar (superadmin), y Admin (superadmin). En móvil, solo íconos.
- Avatar con el menú "Cerrar sesión".
- El encabezado publica su altura en la variable CSS `--header-h`, que usa el cajón para posicionarse.

### Hub (`/`)

- Título "Competencias" con "Crear competencia". Sin cupo (2 activas), el botón queda deshabilitado y el motivo se muestra debajo.
- Pestañas Mis competencias, Abiertas, Finalizadas y Todas (arranca en "Mis competencias" si la persona participa en alguna) y buscador sin tildes ni mayúsculas.
- Tarjetas (`HubCard`) con portada (ganadora o más votada, solo en las públicas), nombre, candado si es privada, chip de estado o "Archivada", "Tuya", solicitudes pendientes, dueño, participantes y ganador. Las privadas llevan siempre `PrivateCover` (garabatos SVG con los tokens de la guía y un candado), aunque quien mira tenga acceso, y `HubPage` no pide sus URLs firmadas. Las privadas sin acceso tampoco muestran ganador y llevan "Solicitar acceso" o "Solicitud pendiente".
- **Crear competencia** (`CreateRoundDialog`): nombre con contador, visibilidad con su explicación, el aviso "El nombre lo ve todo Kelsoft" y el cupo restante. Al crear lleva a `/c/:roundId/gestion`.

### Competencia (`/c/:roundId`) según el estado

| Caso | Qué se ve |
| --- | --- |
| No existe | "No encontramos esa competencia" y el enlace al hub |
| Archivada (limpiada) | Su nombre y "Esta competencia se archivó por inactividad" |
| Privada sin acceso | Candado, dueño, estado y "Solicitar acceso" (o "Solicitud pendiente"); se actualiza sola al aprobarse |
| Preparada | "La competencia todavía no abrió" |
| Abierta | Cajón "Mi publicación" + "¡A VOTAR!", selector de orden y grilla de tarjetas |
| Cerrada | "La votación está cerrada" + ranking |
| Finalizada | Ganador destacado con confeti (una vez), "Compartir resultado" y ranking |

Los miembros de una privada ven al pie "Salir de la competencia", con confirmación (se borran su publicación y sus votos).

**Compartir resultado** (`ShareResultDialog`): vista previa de la imagen de 1200 × 630 que dibuja `renderResultImage` con los tokens de la guía (ganadora sin recortar, título, autor y votos; debajo el 2.º y el 3.º según `buildPodium`). "Copiar imagen" usa `ClipboardItem` con la promesa del blob (Safari exige crearlo dentro del clic) y "Descargar" queda siempre, como única opción si el navegador no deja copiar imágenes. Las imágenes se bajan como blob para que el canvas no quede bloqueado por CORS; si el avatar de Google no carga, se dibujan las iniciales.

**Grilla:** 1 columna en móvil, 2 desde 640 px, 3 desde 1024 px y 4 desde 1280 px. Orden "Más recientes" (por defecto) o "Más votadas".

**Tarjeta** (`SubmissionCard`):
- Imagen (clic → lightbox), título con elipsis, autor.
- Píldora de votos que rebota al cambiar, un punto rosa por cada voto propio.
- "−1" y "+1": se deshabilitan sin votos disponibles, sin votos propios en esa imagen o mientras la RPC responde.
- La tarjeta propia lleva el chip "TU PUBLICACIÓN", borde punteado y no tiene botones de voto.
- "Ver votantes" abre un popover con avatar, nombre y "×N".

**Ranking** (`RankingList`): medallas oro, plata y bronce, miniatura de 96 px (oculta en móvil), chip "EMPATE" en posiciones compartidas. Lo reutilizan el tablón cerrado o finalizado, el historial y el panel de admin (con controles extra por fila vía `renderExtra`).

### Cajón "Mi publicación"

Es la pieza de UX más particular de la app (`SubmissionDrawer` + `MySubmissionPanel`).

**Comportamiento:**
- **Posición inicial**, decidida una sola vez por visita al tablón: **desplegado si la persona todavía no publicó, oculto si ya publicó**. Después solo lo mueve la persona; publicar o borrar no lo abre ni lo cierra.
- **Oculto:** asoma una franja de 24 px por el borde izquierdo con una flecha. Al pasar el mouse asoma 36 px y la flecha se mueve (`animate-nudge`), para sugerir el clic.
- **Abrir y cerrar:**
  - con el botón del encabezado;
  - con un clic en la franja;
  - arrastrando la franja (mouse o dedo): hacia la derecha abre, hacia la izquierda cierra, hace falta mover 60 px y si se suelta antes vuelve a su lugar;
  - con teclado, Enter o Espacio sobre la franja.
- **Escritorio (≥ 1024 px):** abierto **empuja la grilla** con la clase `.drawer-push`, que calcula el espacio aunque el contenido esté centrado en pantallas anchas. Oculto, `.drawer-peek-clearance` deja libre la franja.
- **Móvil:** se **superpone** con un velo `night-900` al 70 %; se cierra con un clic en el velo o con Escape.
- **Pegar (Ctrl+V) o soltar una imagen** con el cajón oculto lo despliega solo.
- **Oculto, su contenido es `inert`:** no recibe foco ni clics.

**Contenido:**
- **Sin publicación:** zona de subida (arrastrar, elegir o pegar), vista previa, título con contador "0/80" y "Publicar".
- **Con publicación:** miniatura con sus votos, título editable ("Guardar título" aparece al cambiarlo), "Reemplazar" y "Borrar". Si hay votos, ambas piden confirmar con "Vas a perder los N votos recibidos". Borrar pide confirmación siempre.

**Detalle técnico importante:** el cajón se desliza con `transform`, y eso convierte a cualquier `position: fixed` interno en relativo al cajón. Por eso `ConfirmDialog` y `Lightbox` se renderizan con `createPortal` en `document.body`. **Cualquier overlay nuevo que pueda abrirse desde el cajón debe usar portal.**

### Gestionar (`/c/:roundId/gestion`)
Para el dueño, paneles de arriba abajo:
1. **Competencia:** nombre editable, chip de estado y solo el botón válido (Abrir, Cerrar o Reabrir), visibilidad (editable solo en preparada, con el motivo cuando está bloqueada) y números: participantes (publicaron o votaron), publicaciones y votos emitidos.
2. **Solicitudes** (solo privadas): pendientes con "Aprobar" y "Rechazar".
3. **Miembros** (solo privadas): enlace de invitación con "Copiar" y "Generar nuevo enlace" (con confirmación), buscador de perfiles por nombre o email para agregar, y la lista con el origen de cada miembro y "Quitar".
4. **Publicaciones** ordenadas por votos con "Borrar". Con la competencia cerrada, un selector de ganador por fila, el aviso de empate en el primer puesto y "Finalizar competencia".
5. **Zona de peligro:** "Borrar competencia", que exige escribir `BORRAR` y vuelve al hub.

Para el superadmin en una competencia ajena es **Moderar**: solo los paneles 4 (sin elegir ganador) y 5.

### Administración (`/admin`, superadmin)
1. **Para archivar:** competencias con más de 60 días sin actividad. Por cada una, "Exportar a Drive" (pide el permiso `drive.file` primero, dentro del clic, y después arma el ZIP y lo sube), "Descargar ZIP" (y luego "Ya lo guardé") y "Limpiar", que se habilita recién con la exportación registrada. Sin `VITE_GOOGLE_CLIENT_ID`, solo descarga. El script de Google se precarga al abrir el panel.
2. **Archivadas:** competencias limpiadas con su enlace a Drive.
3. **Todas las competencias:** con enlace y "Borrar" (exige `BORRAR`).

Todas las acciones destructivas pasan por `ConfirmDialog`. Si la limpieza de Storage falla después de una RPC exitosa, se avisa "Se borraron los datos, pero no se pudieron borrar algunos archivos de Storage".

## 8. Mensajes, carga y errores

- **Toasts** (`useToast().notify(mensaje, tipo)`): arriba al centro, píldora `night-800` con borde `success`, `danger` o `sky`, que se cierra a los 4 s.
- **Errores de RPC:** `errorMessage(error)` busca el código exacto en `ERROR_MESSAGES`; si no lo encuentra, usa "Algo salió mal. Intenta de nuevo."
- **Carga y error de consultas:** `Loading` y `ErrorState` (con "Reintentar") en `components/StateMessages.tsx`. Una consulta fallida nunca se muestra como un estado vacío.
- **Estados vacíos** con texto propio: sin publicaciones, sin historial, ranking vacío.

## 9. Sistema de diseño

Estética de juego de fiesta: fondo violeta profundo con un patrón de garabatos al 6 %, tarjetas blancas con borde grueso, botones "de juguete" con sombra sólida que se hunden al presionar, y títulos en Lilita One en mayúsculas.

- **Tokens** en `tailwind.config.ts` (`theme.extend`):
  - Colores: `night-900`, `night-800`, `brand-600`, `brand-400`, `surface`, `surface-alt`, `ink`, `ink-muted`, `on-night`, `on-night-muted`, `sun`, `vote`, `sky`, `success`, `danger`, `medal-*`.
  - Fuentes `display` (Lilita One) y `body` (Nunito).
  - Tamaños de texto con nombre (`page-title`, `section-title`, `card-title`, `body`, `secondary`, `label`, `vote-card`, `vote-winner`, `rank-position`, `winner-title`).
  - Bordes de 3 y 6 px, radios `card` 20 px, `btn` 14 px e `img` 12 px, y sombras `btn`, `btn-sm`, `btn-pressed` y `card`.
- **Clases de componentes** en `src/styles/components.css`: `btn` (+ `btn-primary`, `btn-secondary`, `btn-danger`, `btn-google`, `btn-sm`, `btn-icon`), `card`, `card-own`, `card-hover`, `chip` y variantes, `input`, `avatar`, `vote-pill`, `page-title`, `section-title`, `drawer-push`, `drawer-peek-clearance`.
- **Un color por intención:** amarillo (`sun`) la acción principal, rosa (`vote`) los votos, cian (`sky`) lo secundario, rojo (`danger`) lo destructivo. Sobre `sun`, `sky`, `success` y `danger` el texto va en `ink` (contraste AA).
- **Movimiento:**
  - rebote `cubic-bezier(0.34, 1.56, 0.64, 1)` y duraciones de 150 a 250 ms;
  - `pop` en contadores y fichas, `enter-up` en tarjetas nuevas, `bounce-in` en modales y toasts, `nudge` en la franja del cajón, `beat` en el chip "Abierta" y confeti para el ganador;
  - con `prefers-reduced-motion`, todas las animaciones pasan a un fundido y se ocultan el confeti y el punto que late.
- **`/estilos`** (solo admin) muestra todos los componentes en sus estados para revisar la guía de un vistazo.

## 10. Accesibilidad

- Foco visible global: anillo de 3 px `brand-400`.
- Botones con texto o `aria-label`.
- Diálogos con `role="dialog"`, foco inicial en "Cancelar" y cierre con Escape.
- El lightbox se cierra con Escape o con un clic fuera, y devuelve el foco al elemento anterior.
- Los toasts se anuncian con `aria-live`.
- El cajón oculto queda `inert`, y su franja es un botón con `aria-expanded` y `aria-controls`.

## 11. Tests y verificación

```bash
npm run build   # tsc -b + vite build
npm run lint
npm test        # Vitest
```

Los tests cubren la lógica pura de `src/lib`: errores, dominio, avisos de login y redirecciones seguras, validación de imágenes, rutas y lotes de Storage, orden, ranking y empates, votos restantes, realtime (debounce y avisos), arrastre del cajón, etiquetas y fechas, filtros y cupo del hub, podio, recorte de texto y colores de la imagen del resultado, y CSV y nombres del ZIP. No hay tests de componentes ni end-to-end: los flujos se verifican a mano en el navegador.

La imagen del resultado se puede revisar sin sesión con Chrome sin interfaz: una página temporal en la raíz que importe `renderResultImage` con datos de ejemplo, servida por `npx vite`, y `chrome --headless=new --screenshot`.

## 12. Limitaciones conocidas e ideas

- Los diálogos no atrapan el foco (focus trap); el foco inicial y Escape sí funcionan.
- Las iniciales del avatar (blanco sobre `brand-400`) tienen un contraste de alrededor de 3,9:1; acompañan siempre al nombre escrito.
- Sin publicación, el cajón arranca oculto un instante y se desliza abierto cuando cargan los datos.
- `profiles` no está en Realtime: un cambio de nombre o avatar se ve al volver a la ventana.
- La concurrencia de votos (clics simultáneos) solo se probó a mano.
- Los eventos de borrado de Realtime no se filtran por competencia: cuando alguien pierde el acceso, el candado aparece con el siguiente evento de la competencia o al volver a la ventana.
- El ZIP se arma entero en memoria (fflate `zipSync`): con unos 100 MB por competencia alcanza, pero no escalaría a competencias mucho más grandes.
- "Invitar a los mismos de otra competencia" quedó para una versión posterior.
