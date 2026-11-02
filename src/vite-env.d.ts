/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_ALLOWED_DOMAIN: string
  // Opcional: sin ella, el panel del superadmin solo ofrece descargar el ZIP (no subirlo a Drive).
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
