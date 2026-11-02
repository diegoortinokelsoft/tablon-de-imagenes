import { Trophy } from 'lucide-react'
import { STATUS_LABELS, type RoundStatus } from '../lib/labels'

const STATUS_CLASSES: Record<RoundStatus, string> = {
  pending: 'chip-pending',
  open: 'chip-open',
  closed: 'chip-closed',
  finalized: 'chip-finalized',
}

export default function StatusChip({ status }: { status: RoundStatus }) {
  return (
    <span className={`chip ${STATUS_CLASSES[status]}`}>
      {status === 'open' && <span className="motion-beat h-2 w-2 animate-beat rounded-full bg-ink" aria-hidden />}
      {status === 'finalized' && <Trophy className="h-3 w-3" strokeWidth={2.5} aria-hidden />}
      {STATUS_LABELS[status]}
    </span>
  )
}
