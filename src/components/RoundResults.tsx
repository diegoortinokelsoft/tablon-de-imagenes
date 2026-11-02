import { useCallback, useMemo, useState } from 'react'
import { useBoard } from '../hooks/useBoard'
import { useSignedUrls } from '../hooks/useSignedUrls'
import type { BoardItem } from '../lib/board'
import { buildPodium } from '../lib/podium'
import Lightbox from './Lightbox'
import RankingList from './RankingList'
import ShareResultDialog from './ShareResultDialog'
import { ErrorState, Loading } from './StateMessages'
import WinnerHero from './WinnerHero'

interface RoundResultsProps {
  roundId: string
  winnerId: string | null
  /** Con nombre, el ganador ofrece "Compartir resultado". */
  roundName?: string
  finalizedAt?: string | null
  celebrate?: boolean
}

/** Ganador destacado (si lo hay) y ranking completo de una competencia. */
export default function RoundResults({ roundId, winnerId, roundName, finalizedAt = null, celebrate = true }: RoundResultsProps) {
  const { data: items = [], isPending, isError, refetch } = useBoard(roundId)
  const { data: urls = {} } = useSignedUrls(items.map((item) => item.imagePath))
  const [lightbox, setLightbox] = useState<BoardItem | null>(null)
  const [sharing, setSharing] = useState(false)
  const closeLightbox = useCallback(() => setLightbox(null), [])
  const closeShare = useCallback(() => setSharing(false), [])
  const podium = useMemo(() => buildPodium(items, winnerId), [items, winnerId])
  const winner = podium?.winner

  if (isPending) return <Loading label="Cargando ranking…" />
  if (isError) return <ErrorState message="No se pudo cargar el ranking." onRetry={() => void refetch()} />

  return (
    <div className="flex flex-col gap-12">
      {winner && (
        <WinnerHero
          item={winner}
          imageUrl={urls[winner.imagePath]}
          onOpen={() => setLightbox(winner)}
          celebrate={celebrate}
          onShare={roundName ? () => setSharing(true) : undefined}
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
      {sharing && podium && roundName && (
        <ShareResultDialog
          roundName={roundName}
          finalizedAt={finalizedAt}
          podium={podium}
          winnerImageUrl={urls[podium.winner.imagePath]}
          onClose={closeShare}
        />
      )}
    </div>
  )
}
