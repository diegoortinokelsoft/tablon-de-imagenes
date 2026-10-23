import { useEffect, useId, useRef, useState } from 'react'
import { Users } from 'lucide-react'
import type { Voter } from '../hooks/useVoteDetails'
import Avatar from './Avatar'

/** Botón "Ver votantes" con la lista de avatar, nombre y ×N. */
export default function VotersPopover({ voters }: { voters: Voter[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex items-center gap-1 rounded-btn text-label uppercase text-brand-600 hover:underline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <Users className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        Ver votantes
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute bottom-8 left-0 z-20 w-64 animate-bounce-in rounded-card border-3 border-ink bg-night-800 p-4 text-on-night shadow-card"
        >
          {voters.length === 0 ? (
            <p className="text-secondary text-on-night-muted">Todavía no tiene votos.</p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-3 overflow-y-auto">
              {voters.map((voter) => (
                <li key={voter.voterId} className="flex items-center gap-3">
                  <Avatar name={voter.name} url={voter.avatar} on="night" />
                  <span className="min-w-0 flex-1 truncate text-secondary">{voter.name}</span>
                  <span className="font-display text-section-title tabular-nums text-vote">×{voter.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
