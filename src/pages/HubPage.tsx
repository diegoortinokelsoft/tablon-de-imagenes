import { useState } from 'react'
import { LayoutGrid, Plus, Search } from 'lucide-react'
import CreateRoundDialog from '../components/CreateRoundDialog'
import HubCard from '../components/HubCard'
import { ErrorState, Loading } from '../components/StateMessages'
import { useHub } from '../hooks/useHub'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { useSession } from '../hooks/useSession'
import { useSignedUrls } from '../hooks/useSignedUrls'
import { HUB_TABS, MAX_ACTIVE_ROUNDS, activeOwnedCount, filterHub, type HubTab } from '../lib/hub'

export default function HubPage() {
  const { session } = useSession()
  const { isAdmin } = useIsAdmin()
  const { data: rounds = [], isPending, isError, refetch } = useHub()
  const { data: urls = {} } = useSignedUrls(rounds.map((round) => round.cover_path ?? ''))
  const [chosenTab, setChosenTab] = useState<HubTab | null>(null)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  // Sin elección, arranca en "Mis competencias" si participa en alguna; si no, en "Todas".
  const tab = chosenTab ?? (rounds.some((round) => round.my_involvement) ? 'mine' : 'all')
  const visible = filterHub(rounds, tab, search)
  const slotsLeft = isAdmin ? null : Math.max(0, MAX_ACTIVE_ROUNDS - activeOwnedCount(rounds, session?.user.id))
  const canCreate = !isPending && slotsLeft !== 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="page-title">Competencias</h1>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canCreate}
          title={slotsLeft === 0 ? 'Ya tienes 2 competencias activas. Finaliza o borra una para crear otra.' : undefined}
          onClick={() => setCreating(true)}
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          Crear competencia
        </button>
      </div>
      {slotsLeft === 0 && (
        <p className="-mt-3 text-secondary text-on-night-muted">
          Ya tienes 2 competencias activas. Finaliza o borra una para crear otra.
        </p>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Filtrar competencias" className="flex flex-wrap gap-2">
          {(Object.keys(HUB_TABS) as HubTab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`btn btn-sm ${tab === key ? 'btn-secondary' : 'border-on-night-muted bg-transparent text-on-night shadow-none'}`}
              onClick={() => setChosenTab(key)}
            >
              {HUB_TABS[key]}
            </button>
          ))}
        </div>
        <label className="relative md:w-72">
          <span className="sr-only">Buscar por nombre</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-muted"
            strokeWidth={2.5}
            aria-hidden
          />
          <input
            className="input pl-12"
            type="search"
            placeholder="Buscar por nombre"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      {isPending ? (
        <Loading label="Cargando competencias…" />
      ) : isError ? (
        <ErrorState message="No se pudieron cargar las competencias." onRetry={() => void refetch()} />
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border-3 border-dashed border-on-night-muted p-12 text-center text-on-night-muted">
          <LayoutGrid className="h-12 w-12" strokeWidth={2.5} aria-hidden />
          <p className="text-body">
            {rounds.length === 0
              ? 'Todavía no hay competencias. ¡Crea la primera!'
              : search.trim()
                ? 'Ninguna competencia coincide con la búsqueda.'
                : 'No hay competencias en esta pestaña.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((round) => (
            <li key={round.id}>
              <HubCard round={round} coverUrl={round.cover_path ? urls[round.cover_path] : undefined} />
            </li>
          ))}
        </ul>
      )}

      <CreateRoundDialog open={creating} slotsLeft={slotsLeft} onClose={() => setCreating(false)} />
    </div>
  )
}
