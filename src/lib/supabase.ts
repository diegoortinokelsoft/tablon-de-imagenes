import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { env } from './env'

// Solo la clave pública: la service_role nunca llega al frontend.
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
