import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import RoundResults from '../components/RoundResults'
import { useRound } from '../hooks/useHistory'
import { formatDate } from '../lib/labels'

export default function HistoryDetailPage() {
  const { roundId } = useParams()
  const { data: round, isPending } = useRound(roundId)

  if (isPending) {
    return (
      <div className="flex justify-center py-12 text-on-night-muted" role="status">
        <LoaderCircle className="h-6 w-6 animate-spin" strokeWidth={2.5} aria-label="Cargando" />
      </div>
    )
  }

  // La competencia actual no es historial: se ve en el tablón.
  if (round && round.status !== 'archived') return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-8">
      <Link to="/historial" className="flex items-center gap-2 self-start text-secondary uppercase text-on-night-muted hover:text-on-night">
        <ArrowLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden />
        Historial
      </Link>
      {round ? (
        <>
          <div className="flex flex-col gap-1 text-center">
            <h1 className="page-title">{round.name}</h1>
            <p className="text-body text-on-night-muted">Finalizada el {formatDate(round.finalized_at)}</p>
          </div>
          <RoundResults roundId={round.id} winnerId={round.winner_submission_id} celebrate={false} />
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <h1 className="page-title">No encontramos esa competencia</h1>
          <p className="text-body text-on-night-muted">Puede que se haya eliminado del historial.</p>
        </div>
      )}
    </div>
  )
}
