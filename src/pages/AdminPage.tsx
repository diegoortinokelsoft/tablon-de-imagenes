import { Link } from 'react-router-dom'
import { Palette } from 'lucide-react'

// Panel del superadmin. Las secciones de moderación, "Para archivar" y "Archivadas" llegan en la Fase 8.
export default function AdminPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="page-title">Administración</h1>
        <Link to="/estilos" className="flex items-center gap-2 text-secondary uppercase text-on-night-muted hover:text-on-night">
          <Palette className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          Guía de estilo
        </Link>
      </div>
    </div>
  )
}
