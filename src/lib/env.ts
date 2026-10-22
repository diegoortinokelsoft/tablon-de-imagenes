export interface AppEnv {
  supabaseUrl: string
  supabaseAnonKey: string
  allowedDomain: string
}

type RawEnv = Partial<Record<keyof ImportMetaEnv, string | undefined>>

/** Lee y valida las variables de entorno; falla al arrancar si falta alguna. */
export function readEnv(raw: RawEnv): AppEnv {
  const missing = (['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_ALLOWED_DOMAIN'] as const).filter(
    (key) => !raw[key]?.trim(),
  )
  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}. Revisa .env.local.`)
  }
  return {
    supabaseUrl: raw.VITE_SUPABASE_URL!.trim(),
    supabaseAnonKey: raw.VITE_SUPABASE_ANON_KEY!.trim(),
    allowedDomain: raw.VITE_ALLOWED_DOMAIN!.trim().toLowerCase(),
  }
}

export const env = readEnv(import.meta.env)
