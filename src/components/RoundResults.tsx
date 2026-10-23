import { useCallback, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useBoard } from '../hooks/useBoard'
import { useSignedUrls } from '../hooks/useSignedUrls'
import type { BoardItem } from '../lib/board'
import Lightbox from './Lightbox'
import RankingList from './RankingList'
import WinnerHero from './WinnerHero'

interface RoundResultsProps {
  roundId: string
  winnerId: string | null
  celebrate?: boolean
}

/** Ganador destacado (si lo hay) y ranking completo de una competencia. */
export default function RoundResults({ roundId, winnerId, celebrate = true }: RoundResultsProps) {
  const { data: items = [], isPending } = useBoard(roundId)
  const { data: urls = {} } = useSignedUrls(items.map((item) => item.imagePath))
  const [lightbox, setLightbox] = useState<BoardItem | null>(null)
  const closeLightbox = useCallback(() => setLightbox(null), [])
  const winner = winnerId ? items.find((item) => item.id === winnerId) : undefined

  if (isPending) {
    return (
      <div className="flex justify-center py-12 text-on-night-muted" role="status">
        <LoaderCircle className="h-6 w-6 animate-spin" strokeWidth={2.5} aria-label="Cargando ranking" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-12">
      {winner && (
        <WinnerHero
          item={winner}
          imageUrl={urls[winner.imagePath]}
          onOpen={() => setLightbox(winner)}
          celebrate={celebrate}
        />
      )}
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-4" aria-labelledby="titulo-ranking">
        <h2 id="titulo-ranking" className="section-title">
          Ranking
        </h2>
        {items.length === 0 ? (
          <p className="text-body text-on-night-muted">No hubo publicaciones en esta competencia.</p>
        ) : (
          <RankingList items={items} urls={urls} onOpen={setLightbox} />
        )}
      </section>
      {lightbox && urls[lightbox.imagePath] && (
        <Lightbox
          src={urls[lightbox.imagePath]!}
          title={lightbox.title}
          author={lightbox.authorName}
          onClose={closeLightbox}
        />
      )}
    </div>
  )
}
