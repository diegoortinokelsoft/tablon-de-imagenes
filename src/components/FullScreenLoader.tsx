import { LoaderCircle } from 'lucide-react'

export default function FullScreenLoader({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-on-night-muted" role="status">
      <LoaderCircle className="h-6 w-6 animate-spin" strokeWidth={2.5} aria-hidden />
      <span className="text-body">{label}</span>
    </div>
  )
}
