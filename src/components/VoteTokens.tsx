import { VOTES_PER_ROUND } from '../lib/board'

/** Tres fichas: rellenas en vote las disponibles, vacías con borde las usadas. */
export default function VoteTokens({ left }: { left: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`Te quedan ${left} de ${VOTES_PER_ROUND} votos`}>
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: VOTES_PER_ROUND }, (_, i) => {
          const available = i < left
          return (
            <span
              key={`${i}-${available}`}
              className={`h-5 w-5 animate-pop rounded-full border-3 ${
                available ? 'border-vote bg-vote' : 'border-on-night-muted'
              }`}
            />
          )
        })}
      </span>
      <span className="hidden text-label uppercase sm:inline" aria-hidden>
        Te quedan {left} de {VOTES_PER_ROUND} votos
      </span>
    </div>
  )
}
