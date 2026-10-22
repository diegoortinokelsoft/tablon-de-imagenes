import { createClient } from '@supabase/supabase-js'
import { env } from './env'

// Solo la clave pública: la service_role nunca llega al frontend.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
