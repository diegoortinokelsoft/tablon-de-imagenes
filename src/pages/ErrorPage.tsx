import { useEffect } from 'react'
import { useRouteError } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

/** Reemplaza la pantalla de error por defecto de React Router (en inglés). */
export default function ErrorPage() {
  const error = useRouteError()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <AlertTriangle className="h-12 w-12 text-sun" strokeWidth={2.5} aria-hidden />
      <h1 className="page-title">Algo salió mal</h1>
      <p className="max-w-modal text-body text-on-night-muted">
        Ocurrió un error inesperado. Vuelve a cargar la página; si sigue pasando, avísale al administrador.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Recargar
        </button>
        <a href="/" className="btn btn-secondary">
          Ir al tablón
        </a>
      </div>
    </main>
  )
}
