import { env } from './env'
import { supabase } from './supabase'

export const DOMAIN_ERROR_MESSAGE = `Solo pueden ingresar cuentas @${env.allowedDomain}`

/** Mismo criterio que public.is_allowed_email(): una sola @ y el dominio exacto. */
export function isAllowedEmail(email: string | null | undefined, domain: string): boolean {
  if (!email) return false
  const [local, host, ...rest] = email.trim().toLowerCase().split('@')
  return rest.length === 0 && !!local && host === domain.toLowerCase()
}

/** Lee el error que deja Supabase en la URL al volver de Google (por ejemplo, el rechazo del hook). */
export function readAuthErrorFromUrl(url: URL): string | null {
  const params = new URLSearchParams(url.search)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  const error = params.get('error') ?? hash.get('error')
  if (!error) return null
  return params.get('error_description') ?? hash.get('error_description') ?? error
}

/** Traduce el error de vuelta de Google o Supabase a un mensaje en español. */
export function authErrorMessage(description: string): string {
  const text = description.toLowerCase()
  if (
    text.includes('solo pueden ingresar') ||
    text.includes('database error saving new user') ||
    text.includes('not_allowed') ||
    text.includes('hook')
  ) {
    return DOMAIN_ERROR_MESSAGE
  }
  return 'No se pudo iniciar sesión. Intenta de nuevo.'
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: { hd: env.allowedDomain, prompt: 'select_account' },
      redirectTo: window.location.origin,
    },
  })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

// Mensaje para mostrar en /login después de cerrar una sesión de otro dominio.
const FLASH_KEY = 'tablon:login-flash'

export function setLoginFlash(message: string) {
  try {
    sessionStorage.setItem(FLASH_KEY, message)
  } catch {
    // Sin sessionStorage el aviso simplemente no se muestra.
  }
}

export function takeLoginFlash(): string | null {
  try {
    const message = sessionStorage.getItem(FLASH_KEY)
    sessionStorage.removeItem(FLASH_KEY)
    return message
  } catch {
    return null
  }
}

// Ruta a la que volver después del login (por ejemplo, un enlace de invitación abierto sin sesión).
// Google siempre vuelve al origen, así que la ruta se guarda antes de ir a /login.
const REDIRECT_KEY = 'tablon:after-login'

/** Solo rutas internas (empiezan con una sola /): nunca se redirige a otro sitio. */
export function isSafeRedirect(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//') && path !== '/' && !path.startsWith('/login')
}

export function rememberRedirect(path: string) {
  if (!isSafeRedirect(path)) return
  try {
    sessionStorage.setItem(REDIRECT_KEY, path)
  } catch {
    // Sin sessionStorage, después del login se cae en el hub.
  }
}

export function peekRedirect(): string | null {
  try {
    const path = sessionStorage.getItem(REDIRECT_KEY)
    return isSafeRedirect(path) ? path : null
  } catch {
    return null
  }
}

export function clearRedirect() {
  try {
    sessionStorage.removeItem(REDIRECT_KEY)
  } catch {
    // Nada que limpiar.
  }
}
