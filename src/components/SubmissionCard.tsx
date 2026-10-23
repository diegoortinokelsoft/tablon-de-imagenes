import { Minus, Plus } from 'lucide-react'
import type { Voter } from '../hooks/useVoteDetails'
import type { BoardItem } from '../lib/board'
import Avatar from './Avatar'
import VotersPopover from './VotersPopover'

interface SubmissionCardProps {
  item: BoardItem
  imageUrl: string | undefined
  isOwn: boolean
  myVotes: number
  votesLeft: number
  voters: Voter[]
  pending: boolean
  onVote: (delta: 1 | -1) => void
  onOpen: () => void
}

export default function SubmissionCard({
  item,
  imageUrl,
  isOwn,
  myVotes,
  votesLeft,
  voters,
  pending,
  onVote,
  onOpen,
}: SubmissionCardProps) {
  return (
    <article className={`card card-hover flex animate-enter-up flex-col p-3 ${isOwn ? 'card-own' : ''}`}>
      <div className="relative">
        <button
          type="button"
          className="block w-full overflow-hidden rounded-img"
          onClick={onOpen}
          aria-label={`Ver "${item.title}" a tamaño completo`}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" loading="lazy" className="aspect-card w-full object-cover" />
          ) : (
            <span className="block aspect-card w-full bg-surface-alt" />
          )}
        </button>
        {isOwn && <span className="chip chip-own pointer-events-none absolute left-3 top-3">Tu publicación</span>}
      </div>

      <div className="flex flex-1 flex-col gap-3 pt-3">
        <h3 className="truncate text-card-title" title={item.title}>
          {item.title}
        </h3>
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={item.authorName} url={item.authorAvatar} />
          <span className="truncate text-secondary text-ink-muted">{item.authorName}</span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              key={item.voteCount}
              className="vote-pill animate-pop"
              aria-label={item.voteCount === 1 ? '1 voto' : `${item.voteCount} votos`}
            >
              {item.voteCount}
            </span>
            {myVotes > 0 && (
              <span className="flex gap-1" aria-label={myVotes === 1 ? 'Le diste 1 voto' : `Le diste ${myVotes} votos`}>
                {Array.from({ length: myVotes }, (_, i) => (
                  <span key={i} className="h-2 w-2 rounded-full bg-vote" />
                ))}
              </span>
            )}
          </div>
          {!isOwn && (
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-label="Quitar un voto"
                onClick={() => onVote(-1)}
                disabled={pending || myVotes === 0}
              >
                <Minus className="h-5 w-5" strokeWidth={2.5} aria-hidden />1
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                aria-label="Dar un voto"
                onClick={() => onVote(1)}
                disabled={pending || votesLeft === 0}
              >
                <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />1
              </button>
            </div>
          )}
        </div>
        <VotersPopover voters={voters} />
      </div>
    </article>
  )
}
