import { Link } from 'react-router-dom'
import { History, LoaderCircle, Trophy } from 'lucide-react'
import { useArchivedRounds, useWinners } from '../hooks/useHistory'
import { useSignedUrls } from '../hooks/useSignedUrls'
import { formatDate } from '../lib/labels'

export default function HistoryPage() {
  const { data: rounds = [], isPending } = useArchivedRounds()
  const winnerIds = rounds.map((round) => round.winner_submission_id).filter((id): id is string => !!id)
  const { data: winners = {} } = useWinners(winnerIds)
  const { data: urls = {} } = useSignedUrls(Object.values(winners).map((winner) => winner.imagePath))

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <h1 className="page-title">Historial</h1>

      {isPending ? (
        <div className="flex justify-center py-12 text-on-night-muted" role="status">
          <LoaderCircle className="h-6 w-6 animate-spin" strokeWidth={2.5} aria-label="Cargando historial" />
        </div>
      ) : rounds.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border-3 border-dashed border-on-night-muted p-12 text-center text-on-night-muted">
          <History className="h-12 w-12" strokeWidth={2.5} aria-hidden />
          <p className="text-body">Todavía no hay competencias terminadas.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {rounds.map((round) => {
            const winner = round.winner_submission_id ? winners[round.winner_submission_id] : undefined
            const thumb = winner ? urls[winner.imagePath] : undefined
            return (
              <li key={round.id}>
                <Link to={`/historial/${round.id}`} className="card card-hover flex animate-enter-up flex-col p-3">
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" className="aspect-card w-full rounded-img object-cover" />
                  ) : (
                    <span className="block aspect-card w-full rounded-img bg-surface-alt" />
                  )}
                  <div className="flex flex-col gap-1 pt-3">
                    <h2 className="truncate text-card-title">{round.name}</h2>
                    <p className="text-secondary text-ink-muted">Finalizada el {formatDate(round.finalized_at)}</p>
                    <p className="flex items-center gap-2 text-secondary">
                      <Trophy className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} aria-hidden />
                      <span className="truncate">{winner ? winner.authorName : 'Sin ganador'}</span>
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
