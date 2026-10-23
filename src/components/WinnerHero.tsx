import { useMemo } from 'react'
import { Trophy } from 'lucide-react'
import type { BoardItem } from '../lib/board'
import Avatar from './Avatar'

const CONFETTI_COLORS = ['bg-sun', 'bg-vote', 'bg-sky', 'bg-success', 'bg-brand-400']
const CONFETTI_PIECES = 48

/** Ráfaga de confeti CSS que se reproduce una sola vez (se oculta con prefers-reduced-motion). */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_PIECES }, (_, i) => ({
        left: `${(i * 37) % 100}%`,
        delay: `${(i % 12) * 60}ms`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        shape: i % 3 === 0 ? 'rounded-full' : '',
      })),
    [],
  )
  return (
    <div className="motion-confetti pointer-events-none fixed inset-0 z-30 overflow-hidden" aria-hidden>
      {pieces.map((piece, i) => (
        <span
          key={i}
          className={`absolute -top-4 h-3 w-2 animate-confetti opacity-0 ${piece.color} ${piece.shape}`}
          style={{ left: piece.left, animationDelay: piece.delay }}
        />
      ))}
    </div>
  )
}

interface WinnerHeroProps {
  item: BoardItem
  imageUrl: string | undefined
  onOpen: () => void
  /** El confeti solo se muestra en la competencia actual, no en el historial. */
  celebrate?: boolean
}

export default function WinnerHero({ item, imageUrl, onOpen, celebrate = true }: WinnerHeroProps) {
  return (
    <section className="flex animate-bounce-in flex-col items-center gap-6 text-center" aria-labelledby="titulo-ganador">
      {celebrate && <Confetti />}
      <h2 id="titulo-ganador" className="flex items-center gap-3 font-display text-winner-title uppercase">
        <Trophy className="h-12 w-12 text-sun" strokeWidth={2.5} aria-hidden />
        ¡Ganador!
      </h2>
      <button
        type="button"
        className="w-full max-w-3xl overflow-hidden rounded-card border-6 border-sun shadow-card"
        onClick={onOpen}
        aria-label={`Ver "${item.title}" a tamaño completo`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="aspect-card w-full object-cover" />
        ) : (
          <span className="block aspect-card w-full bg-surface-alt" />
        )}
      </button>
      <div className="flex flex-col items-center gap-3">
        <p className="section-title normal-case">{item.title}</p>
        <div className="flex items-center gap-2">
          <Avatar name={item.authorName} url={item.authorAvatar} on="night" />
          <span className="text-body">{item.authorName}</span>
        </div>
        <span
          className="inline-flex items-center rounded-full bg-vote px-6 py-2 font-display text-vote-winner tabular-nums text-on-night"
          aria-label={item.voteCount === 1 ? '1 voto' : `${item.voteCount} votos`}
        >
          {item.voteCount}
        </span>
      </div>
    </section>
  )
}
