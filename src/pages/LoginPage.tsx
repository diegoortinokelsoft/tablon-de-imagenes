import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import FullScreenLoader from '../components/FullScreenLoader'
import { useSession } from '../hooks/useSession'
import { signInWithGoogle, takeLoginFlash } from '../lib/auth'
import { env } from '../lib/env'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  )
}

export default function LoginPage() {
  const { session, loading } = useSession()
  const [flash] = useState(takeLoginFlash)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (loading) return <FullScreenLoader />
  if (session) return <Navigate to="/" replace />

  const message = error ?? flash

  const handleLogin = async () => {
    setPending(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch {
      setError('No se pudo iniciar sesión. Intenta de nuevo.')
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <h1 className="page-title text-center">Tablón de Imágenes</h1>
      <div className="card flex w-full max-w-modal animate-bounce-in flex-col items-center gap-6 p-8 text-center">
        <p className="section-title">¡A jugar!</p>
        <p className="text-body text-ink-muted">Sube tu imagen y reparte 3 votos entre las de tus compañeros.</p>
        {message && (
          <p
            role="alert"
            className="flex w-full items-center gap-2 rounded-btn border-3 border-danger bg-surface-alt p-3 text-left text-secondary text-ink"
          >
            <AlertTriangle className="h-5 w-5 shrink-0 text-danger" strokeWidth={2.5} aria-hidden />
            {message}
          </p>
        )}
        <button type="button" className="btn btn-google w-full" onClick={() => void handleLogin()} disabled={pending}>
          <GoogleIcon />
          Ingresar con Google
        </button>
        <p className="text-secondary text-ink-muted">Solo cuentas @{env.allowedDomain}</p>
      </div>
    </main>
  )
}
