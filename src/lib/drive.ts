// Subida de exportaciones al Drive del superadmin. Usa Google Identity Services con el permiso
// drive.file (solo da acceso a los archivos que crea la app): el token vive en el navegador y no hay secretos.

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const ARCHIVE_FOLDER = 'Tablón de Imágenes — Archivo'

interface TokenResponse {
  access_token?: string
  error?: string
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
            error_callback?: (error: { type: string }) => void
          }) => TokenClient
        }
      }
    }
  }
}

let scriptPromise: Promise<void> | null = null

/**
 * Carga el script de Google Identity Services una sola vez (solo se usa en el panel del superadmin).
 * Conviene precargarlo al abrir el panel: así el permiso se pide enseguida dentro del clic y el
 * navegador no bloquea la ventana de Google.
 */
export function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      reject(new Error('No se pudo cargar el inicio de sesión de Google'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

let cachedToken: { value: string; expiresAt: number } | null = null

/** Pide (o reutiliza) un token de acceso a Drive. Debe llamarse desde un clic: abre una ventana de Google. */
export async function getDriveToken(clientId: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value
  await loadGis()
  const oauth2 = window.google?.accounts.oauth2
  if (!oauth2) throw new Error('No se pudo cargar el inicio de sesión de Google')
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error('Google no dio permiso para usar Drive'))
          return
        }
        // Los tokens duran una hora; se renuevan un poco antes.
        cachedToken = { value: response.access_token, expiresAt: Date.now() + 50 * 60 * 1000 }
        resolve(response.access_token)
      },
      error_callback: () => reject(new Error('Se canceló el permiso de Google Drive')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

async function driveFetch(token: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Google Drive respondió ${response.status}`)
  return response
}

/** Busca la carpeta de archivo creada por la app; si no existe, la crea. Devuelve su id. */
async function ensureArchiveFolder(token: string): Promise<string> {
  const query = `name = '${ARCHIVE_FOLDER}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  const list = await driveFetch(
    token,
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`,
  )
  const { files } = (await list.json()) as { files: { id: string }[] }
  if (files[0]) return files[0].id

  const created = await driveFetch(token, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: ARCHIVE_FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
  })
  return ((await created.json()) as { id: string }).id
}

/** Sube el ZIP a la carpeta de archivo con subida reanudable. Devuelve el enlace para abrirlo en Drive. */
export async function uploadToDrive(token: string, blob: Blob, filename: string): Promise<string> {
  const folderId = await ensureArchiveFolder(token)
  const session = await driveFetch(
    token,
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': blob.type || 'application/zip',
        'X-Upload-Content-Length': String(blob.size),
      },
      body: JSON.stringify({ name: filename, parents: [folderId] }),
    },
  )
  const uploadUrl = session.headers.get('Location')
  if (!uploadUrl) throw new Error('Google Drive no devolvió la dirección de subida')

  const uploaded = await fetch(uploadUrl, { method: 'PUT', body: blob })
  if (!uploaded.ok) throw new Error(`Google Drive respondió ${uploaded.status}`)
  const file = (await uploaded.json()) as { id: string; webViewLink?: string }
  return file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`
}
