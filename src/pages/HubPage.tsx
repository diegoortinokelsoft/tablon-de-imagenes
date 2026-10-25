import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { ErrorState, Loading } from '../components/StateMessages'
import StatusChip from '../components/StatusChip'
import { useHub } from '../hooks/useHub'

// Lista provisoria: el hub completo (pestañas, buscador, tarjetas y crear competencia) llega en la Fase 4.
export default function HubPage() {
  const { data: rounds = [], isPending, isError, refetch } = useHub()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <h1 className="page-title">Competencias</h1>
      {isPending ? (
        <Loading label="Cargando competencias…" />
      ) : isError ? (
        <ErrorState message="No se pudieron cargar las competencias." onRetry={() => void refetch()} />
      ) : (
        <ul className="flex flex-col gap-3">
          {rounds.map((round) => (
            <li key={round.id}>
              <Link to={`/c/${round.id}`} className="card card-hover flex items-center gap-3 p-4">
                {round.visibility === 'private' && <Lock className="h-5 w-5" strokeWidth={2.5} aria-label="Privada" />}
                <span className="min-w-0 flex-1 truncate text-card-title">{round.name}</span>
                <StatusChip status={round.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
