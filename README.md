# Tablón de Imágenes

Competencias internas de imágenes de Grupo Kelsoft. Cualquier persona del dominio crea su competencia, pública o privada; en cada una, cada participante sube una imagen y reparte 3 votos entre las de los demás, y quien la creó la abre, la cierra y elige al ganador. El resultado se comparte en Slack como imagen.

- **Especificación completa:** [docs/especificacion-v2.md](docs/especificacion-v2.md) (fuente de verdad; la v1 está en [docs/especificacion.md](docs/especificacion.md)).
- **Backend:** [docs/supabase.md](docs/supabase.md). **Frontend:** [docs/frontend.md](docs/frontend.md).
- **Reglas para quien desarrolle:** [CLAUDE.md](CLAUDE.md).

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 18, Vite, TypeScript estricto, React Router, TanStack Query |
| Estilos | Tailwind CSS 3 con los tokens de la guía de estilo (`tailwind.config.ts`, `src/styles/components.css`) |
| Backend | Supabase: Auth (Google), Postgres con RLS y RPC, Storage privado, Realtime |
| Hosting | Netlify (SPA estática, sin servidor propio) |

Toda escritura en la base pasa por funciones RPC `security definer`; las tablas solo se leen. El frontend usa únicamente la clave pública.

## Desarrollo local

Requisitos: Node 20 o superior.

```bash
npm install
cp .env.example .env.local   # y completar los valores (ver abajo)
npm run dev                  # http://localhost:5173
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto 5173 |
| `npm run build` | Chequeo de tipos y build de producción en `dist/` |
| `npm run lint` | ESLint |
| `npm test` | Tests de Vitest (lógica del frontend) |
| `npm run types` | Regenera `src/lib/database.types.ts` desde la base vinculada |

### Variables de entorno

En `.env.local` para desarrollo y en Netlify para producción.

| Variable | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | URL del proyecto: `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Clave **pública** (anon o publishable). Nunca la `service_role`. |
| `VITE_ALLOWED_DOMAIN` | `grupokelsoft.com` (solo para el parámetro `hd` y los textos) |
| `VITE_GOOGLE_CLIENT_ID` | Opcional. Client ID del cliente OAuth de Google (es público), para subir exportaciones a Drive desde el panel del superadmin. Sin ella, solo se puede descargar el ZIP. |

## Configuración inicial (una sola vez)

Estos pasos son manuales. Proyecto actual: `yirwqhiposuizeuxpeqw`.

### 1. Google Cloud

1. Crear un proyecto en [console.cloud.google.com](https://console.cloud.google.com) con una cuenta `@grupokelsoft.com`.
2. **Pantalla de consentimiento OAuth** (Google Auth Platform): público **Interno**. Así Google solo deja entrar a cuentas de la organización. Alcances por defecto (`openid`, `email`, `profile`).
3. **Crear cliente OAuth** de tipo **Aplicación web**:
   - Orígenes de JavaScript autorizados: `http://localhost:5173` y la URL de Netlify.
   - URI de redireccionamiento autorizados: `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Copiar el Client ID y el Client Secret (van directo a Supabase, no al repo).
5. **Para exportar a Drive** (panel del superadmin, opcional):
   - En **APIs y servicios → Biblioteca**, habilitar la **Google Drive API**.
   - En la pantalla de consentimiento (**Acceso a los datos**), agregar el alcance `https://www.googleapis.com/auth/drive.file`. Con público "Interno" no hace falta verificación.
   - El mismo Client ID va en `VITE_GOOGLE_CLIENT_ID` (es público; el Secret no se usa en el navegador).

### 2. Supabase

1. **Authentication → Sign In / Providers → Google:** activar y pegar el Client ID y el Secret.
2. **Authentication → Sign In / Providers → Email:** **desactivar**. También dejar apagados Phone y Anonymous sign-ins. Si el proveedor de email queda activo, alguien podría registrarse con un email `@grupokelsoft.com` que no le pertenece.
3. **Authentication → URL Configuration:**
   - Site URL: la URL de Netlify.
   - Redirect URLs: `http://localhost:5173`, `http://localhost:5173/**`, la URL de Netlify y `<URL de Netlify>/**`.
4. **Base de datos:** aplicar las migraciones (ver la sección siguiente).
5. **Authentication → Hooks → Before User Created:** tipo Postgres, esquema `public`, función `hook_before_user_created`. Activar.

El dominio se bloquea en cuatro capas: consentimiento "Interno", parámetro `hd`, el hook (más un trigger de respaldo en `auth.users`, que funciona aunque el hook esté apagado) y RLS con `is_allowed_user()` en todas las políticas y RPC.

### 3. Netlify

1. Conectar el repositorio de Git.
2. Comando de build: `npm run build`. Carpeta de publicación: `dist` (ya configurado en `netlify.toml`, que también redirige todas las rutas a `index.html`).
3. Cargar las variables de entorno (las tres de Supabase y, si se usa Drive, `VITE_GOOGLE_CLIENT_ID`).
4. Con la URL de Netlify ya creada, agregarla en Google Cloud (paso 1.3) y en Supabase (paso 2.3).

## Base de datos

Las migraciones están en `supabase/migrations/` y son la única forma de cambiar la base:

| Archivo | Contenido |
| --- | --- |
| `0001_schema.sql` | Tipos, tablas, índices, vistas `board` y `vote_details`, competencia inicial |
| `0002_auth.sql` | `is_allowed_user`, `is_admin`, hook de dominio, trigger de respaldo y trigger de perfiles |
| `0003_rls.sql` | RLS en las cinco tablas, solo políticas de lectura |
| `0004_rpc_user.sql` | RPC de usuario (publicar, editar, reemplazar, borrar, votar) |
| `0005_rpc_admin.sql` | RPC de administración |
| `0006_storage.sql` | Bucket privado `submissions` y sus políticas |
| `0007_realtime.sql` | Tablas en la publicación `supabase_realtime` |
| `0008_v2_schema.sql` a `0013_v2_realtime.sql` | v2: competencias múltiples con dueño y visibilidad, miembros, invitaciones, solicitudes, archivo, políticas por competencia y Realtime (detalle en [docs/supabase.md](docs/supabase.md)) |
| `0014_import_members.sql` | Importar los miembros de otra competencia privada propia |

Para aplicar migraciones nuevas, con la CLI vinculada:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --dry-run   # revisar qué se va a aplicar
npx supabase db push
```

El historial remoto usa las mismas versiones que los archivos (`0001` a `0014`). Si alguna vez se aplica una migración con el MCP de Supabase, el MCP la registra con otra versión: hay que alinearla con `npx supabase migration repair`.

### Pruebas de las reglas

`supabase/tests/rules.sql` prueba las reglas (246 casos) simulando al superadmin, dueños, miembros, usuarios sin acceso, un email de otro dominio y `anon`. Corre dentro de una transacción con `rollback`, así que no deja datos:

```bash
npx supabase db query --linked -f supabase/tests/rules.sql -o json
```

Todos los casos deben dar `ok = true`.

## Cómo se usa

1. En el hub (`/`), **Crear competencia**: nombre y visibilidad (pública para todo Kelsoft, o privada). Cada persona puede tener hasta 2 activas.
2. En **Gestionar**, quien la creó la **Abre**. En una privada, comparte el enlace de invitación, agrega personas, importa los miembros de otra privada suya o aprueba solicitudes de acceso.
3. Cada participante publica una imagen (arrastrar, elegir o pegar con Ctrl+V) y reparte sus 3 votos.
4. Quien la creó la **Cierra** (todos ven el ranking; si fue antes de tiempo, **Reabrir**), elige al ganador (aunque haya empate) y pulsa **Finalizar competencia**.
5. Con el ganador a la vista, **Compartir resultado** copia una imagen para pegar en Slack.

**Borrar competencia** la elimina con sus imágenes (exige escribir `BORRAR`). El superadmin (`diego.martin.ortino@grupokelsoft.com`) puede **Moderar** cualquier competencia y, en **Admin**, exportar y limpiar las que llevan 60 días sin actividad. La guía de estilo se puede revisar en `/estilos` (solo superadmin).

## Plan gratuito de Supabase

- Los proyectos gratuitos se **pausan tras una semana sin actividad**. Conviene entrar a la app o al panel de Supabase de vez en cuando.
- Cada competencia ocupa hasta unos 100 MB de Storage (alrededor de 1 MB por imagen). Lo controlan el límite de 2 activas por persona y la sección **Para archivar** del panel del superadmin, que exporta a Drive y limpia las competencias inactivas.
- Revisar los límites vigentes de base, Storage y Realtime en la página de precios de Supabase.
