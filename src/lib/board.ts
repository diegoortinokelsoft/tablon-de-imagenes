import type { Tables } from './database.types'

/** Fila de la vista board con los campos garantizados (la vista los tipa como opcionales). */
export interface BoardItem {
  id: string
  roundId: string
  userId: string
  title: string
  imagePath: string
  width: number | null
  height: number | null
  createdAt: string
  updatedAt: string
  authorName: string
  authorAvatar: string | null
  voteCount: number
  position: number
}

export function toBoardItem(row: Tables<'board'>): BoardItem {
  return {
    id: row.id ?? '',
    roundId: row.round_id ?? '',
    userId: row.user_id ?? '',
    title: row.title ?? '',
    imagePath: row.image_path ?? '',
    width: row.width,
    height: row.height,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
    authorName: row.author_name ?? '',
    authorAvatar: row.author_avatar,
    voteCount: row.vote_count ?? 0,
    position: row.position ?? 0,
  }
}

export const TITLE_MAX = 80

/** Mismo criterio que public.clean_title(): de 1 a 80 caracteres sin espacios en los extremos. */
export function isValidTitle(title: string): boolean {
  const trimmed = title.trim()
  return trimmed.length >= 1 && trimmed.length <= TITLE_MAX
}
