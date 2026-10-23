import { AlertTriangle, LoaderCircle } from 'lucide-react'

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-on-night-muted" role="status">
      <LoaderCircle className="h-6 w-6 animate-spin" strokeWidth={2.5} aria-hidden />
      <span className="text-body">{label}</span>
    </div>
  )
}

export function ErrorState({
  message = 'No se pudieron cargar los datos.',
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-12 text-center">
      <AlertTriangle className="h-12 w-12 text-danger" strokeWidth={2.5} aria-hidden />
      <p className="text-body text-on-night">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}
