import type { ReactNode } from 'react'
import { rankItems, tiedPositions, type BoardItem } from '../lib/board'

const MEDALS: Record<number, { className: string; label: string }> = {
  1: { className: 'bg-medal-gold', label: 'Oro' },
  2: { className: 'bg-medal-silver', label: 'Plata' },
  3: { className: 'bg-medal-bronze', label: 'Bronce' },
}

interface RankingListProps {
  items: BoardItem[]
  urls: Record<string, string>
  onOpen: (item: BoardItem) => void
  /** Contenido extra al final de cada fila (por ejemplo, la elección del ganador en el panel de admin). */
  renderExtra?: (item: BoardItem) => ReactNode
}

export default function RankingList({ items, urls, onOpen, renderExtra }: RankingListProps) {
  const ties = tiedPositions(items)

  return (
    <ol className="flex flex-col gap-4">
      {rankItems(items).map((item) => {
        const medal = MEDALS[item.position]
        const tie = ties.has(item.position)
        return (
          <li key={item.id} className="card flex animate-enter-up items-center gap-3 p-3 sm:gap-4">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-3 border-ink font-display text-rank-position tabular-nums ${
                medal ? medal.className : 'bg-surface-alt'
              }`}
              aria-label={`Puesto ${item.position}${medal ? ` (${medal.label})` : ''}`}
            >
              {item.position}
            </span>
            <button
              type="button"
              className="hidden shrink-0 overflow-hidden rounded-img sm:block"
              onClick={() => onOpen(item)}
              aria-label={`Ver "${item.title}" a tamaño completo`}
            >
              {urls[item.imagePath] ? (
                <img src={urls[item.imagePath]} alt="" loading="lazy" className="aspect-card w-24 object-cover" />
              ) : (
                <span className="block aspect-card w-24 bg-surface-alt" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-card-title" title={item.title}>
                {item.title}
              </p>
              <p className="truncate text-secondary text-ink-muted">{item.authorName}</p>
            </div>
            {tie && <span className="chip chip-tie">Empate</span>}
            <span className="vote-pill" aria-label={item.voteCount === 1 ? '1 voto' : `${item.voteCount} votos`}>
              {item.voteCount}
            </span>
            {renderExtra?.(item)}
          </li>
        )
      })}
    </ol>
  )
}
