import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import StatusChip from '../components/StatusChip'
import { useCurrentRound, type RoundStatus } from '../hooks/useCurrentRound'
import { useToast } from '../hooks/useToast'
import { errorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

// Botones válidos para cada estado (Abrir, Cerrar, Reabrir).
const ACTIONS: Partial<Record<RoundStatus, { label: string; target: RoundStatus }>> = {
  pending: { label: 'Abrir', target: 'open' },
  open: { label: 'Cerrar', target: 'closed' },
  closed: { label: 'Reabrir', target: 'open' },
}

export default function AdminPage() {
  const { data: round } = useCurrentRound()
  const { notify } = useToast()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const action = round ? ACTIONS[round.status] : undefined

  const changeStatus = async (target: RoundStatus) => {
    setBusy(true)
    const { error } = await supabase.rpc('admin_set_round_status', { p_status: target })
    setBusy(false)
    if (error) return notify(errorMessage(error), 'error')
    await queryClient.invalidateQueries({ queryKey: ['current_round'] })
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Administración</h1>
      {round && (
        <section className="card flex flex-col gap-4 p-6" aria-labelledby="competencia-actual">
          <h2 id="competencia-actual" className="section-title">
            Competencia actual
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-card-title">{round.name}</span>
            <StatusChip status={round.status} />
          </div>
          {action && (
            <button
              type="button"
              className="btn btn-primary self-start"
              onClick={() => void changeStatus(action.target)}
              disabled={busy}
            >
              {action.label}
            </button>
          )}
        </section>
      )}
    </div>
  )
}
