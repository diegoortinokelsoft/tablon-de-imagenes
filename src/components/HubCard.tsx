import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Archive, ImageOff, Lock, Trophy, Users } from 'lucide-react'
import type { HubRound } from '../hooks/useHub'
import { useToast } from '../hooks/useToast'
import { errorMessage } from '../lib/errors'
import { requestAccess } from '../lib/members'
import Avatar from './Avatar'
import PrivateCover from './PrivateCover'
import StatusChip from './StatusChip'

interface HubCardProps {
  round: HubRound
  coverUrl: string | undefined
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

function RequestAccessButton({ roundId }: { roundId: string }) {
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [sending, setSending] = useState(false)

  const ask = async () => {
    setSending(true)
    try {
      await requestAccess(roundId)
      notify('Solicitud enviada', 'success')
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['hub'] })
      setSending(false)
    }
  }

  return (
    <button type="button" className="btn btn-primary btn-sm mt-3 w-full" disabled={sending} onClick={() => void ask()}>
      {sending ? 'Enviando…' : 'Solicitar acceso'}
    </button>
  )
}

/**
 * Tarjeta de una competencia en el hub. Las privadas nunca muestran una imagen como portada (llevan
 * PrivateCover); las privadas sin acceso tampoco muestran ganador.
 */
export default function HubCard({ round, coverUrl }: HubCardProps) {
  const isPrivate = round.visibility === 'private'
  const archived = !!round.cleaned_at
  const CoverIcon = archived ? Archive : ImageOff

  return (
    <div className="card card-hover flex h-full animate-enter-up flex-col p-3">
      <Link to={`/c/${round.id}`} className="flex flex-1 flex-col rounded-img">
        {isPrivate ? (
          <PrivateCover />
        ) : coverUrl ? (
          <img src={coverUrl} alt="" loading="lazy" className="aspect-card w-full rounded-img object-cover" />
        ) : (
          <span className="flex aspect-card w-full items-center justify-center rounded-img bg-surface-alt text-ink-muted">
            <CoverIcon className="h-12 w-12" strokeWidth={2.5} aria-hidden />
          </span>
        )}
        <div className="flex flex-1 flex-col gap-2 pt-3">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-card-title">{round.name}</h2>
            {round.visibility === 'private' && (
              <Lock className="h-5 w-5 shrink-0 text-brand-600" strokeWidth={2.5} aria-label="Privada" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {archived ? <span className="chip chip-pending">Archivada</span> : <StatusChip status={round.status} />}
            {round.my_access === 'owner' && <span className="chip chip-own">Tuya</span>}
            {round.pending_requests > 0 && (
              <span className="chip bg-vote text-ink">{plural(round.pending_requests, 'solicitud', 'solicitudes')}</span>
            )}
            {round.my_access === 'pending' && <span className="chip chip-closed">Solicitud pendiente</span>}
          </div>
          <p className="flex items-center gap-2 text-secondary">
            <Avatar name={round.owner_name} url={round.owner_avatar} />
            <span className="truncate">{round.owner_name}</span>
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-secondary text-ink-muted">
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              {plural(round.participant_count, 'participante', 'participantes')}
            </span>
            {round.winner_author && (
              <span className="flex min-w-0 items-center gap-1">
                <Trophy className="h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.5} aria-hidden />
                <span className="truncate">{round.winner_author}</span>
              </span>
            )}
          </div>
        </div>
      </Link>
      {round.my_access === 'none' && !archived && <RequestAccessButton roundId={round.id} />}
    </div>
  )
}
