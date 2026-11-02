import type { BoardItem } from './board'

export interface PodiumEntry {
  item: BoardItem
  /** Puesto mostrado: 2 para el primero después del ganador; los empatados comparten puesto. */
  place: number
}

export interface Podium {
  winner: BoardItem
  rest: PodiumEntry[]
  /** Empatados que no entran en la imagen ("y N más"). */
  more: number
}

const MAX_SHOWN = 3

/**
 * Ganador y los dos siguientes del podio para la imagen del resultado. Los siguientes son los dos
 * más votados sin contar al ganador (que puede no ser el más votado). Si hay empate en el último
 * lugar mostrado entran todos los empatados; si son más de tres, se muestran tres y "y N más".
 */
export function buildPodium(items: BoardItem[], winnerId: string | null): Podium | null {
  const winner = items.find((item) => item.id === winnerId)
  if (!winner) return null

  const others = items
    .filter((item) => item.id !== winner.id)
    .sort((a, b) => b.voteCount - a.voteCount || a.createdAt.localeCompare(b.createdAt))
  const cutoff = others[1]?.voteCount
  const chosen = others.filter((item, index) => index < 2 || item.voteCount === cutoff)
  const rest = chosen.map((item) => ({
    item,
    place: 2 + others.filter((other) => other.voteCount > item.voteCount).length,
  }))

  return { winner, rest: rest.slice(0, MAX_SHOWN), more: Math.max(0, rest.length - MAX_SHOWN) }
}

/** "2.º", "3.º"… */
export function ordinal(place: number): string {
  return `${place}.º`
}

export function votesLabel(count: number): string {
  return count === 1 ? '1 voto' : `${count} votos`
}
