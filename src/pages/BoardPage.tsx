import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'
import MySubmissionPanel from '../components/MySubmissionPanel'
import { useBoard } from '../hooks/useBoard'
import { useCurrentRound } from '../hooks/useCurrentRound'
import { useSession } from '../hooks/useSession'
import { useSignedUrls } from '../hooks/useSignedUrls'

function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-modal flex-col items-center gap-3 py-12 text-center">
      <h1 className="page-title">{title}</h1>
      {children && <p className="text-body text-on-night-muted">{children}</p>}
    </div>
  )
}

export default function BoardPage() {
  const { session } = useSession()
  const { data: round, isPending: roundPending } = useCurrentRound()
  const { data: items = [] } = useBoard(round?.id)
  const mine = items.find((item) => item.userId === session?.user.id)
  const { data: urls = {} } = useSignedUrls(mine ? [mine.imagePath] : [])

  if (roundPending) {
    return (
      <div className="flex justify-center py-12 text-on-night-muted" role="status">
        <LoaderCircle className="h-6 w-6 animate-spin" strokeWidth={2.5} aria-label="Cargando" />
      </div>
    )
  }

  if (!round || round.status === 'pending') {
    return <Notice title="La competencia todavía no abrió">Vuelve cuando el administrador la abra.</Notice>
  }

  if (round.status !== 'open') {
    return <Notice title="La votación está cerrada" />
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-96">
        <MySubmissionPanel roundId={round.id} mine={mine} imageUrl={mine ? urls[mine.imagePath] : undefined} />
      </aside>
      <section className="flex min-w-0 flex-1 flex-col gap-4" aria-labelledby="titulo-tablon">
        <h1 id="titulo-tablon" className="page-title">
          ¡A votar!
        </h1>
        <p className="text-body text-on-night-muted">
          {items.length === 1 ? 'Hay 1 publicación.' : `Hay ${items.length} publicaciones.`}
        </p>
      </section>
    </div>
  )
}
