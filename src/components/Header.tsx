import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { History, LogOut, PanelLeftClose, PanelLeftOpen, Shield } from 'lucide-react'
import { useCurrentRound } from '../hooks/useCurrentRound'
import { useIsAdmin } from '../hooks/useIsAdmin'
import { useMyVotes } from '../hooks/useMyVotes'
import { useSession } from '../hooks/useSession'
import { useSubmissionDrawer } from '../hooks/useSubmissionDrawer'
import { signOut } from '../lib/auth'
import Avatar from './Avatar'
import StatusChip from './StatusChip'
import { DRAWER_ID } from './SubmissionDrawer'
import VoteTokens from './VoteTokens'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-btn px-3 py-2 text-secondary uppercase transition duration-150 hover:text-on-night ${
    isActive ? 'text-on-night' : 'text-on-night-muted'
  }`

function UserMenu() {
  const { session } = useSession()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const meta = session?.user.user_metadata ?? {}
  const name: string = meta.full_name ?? meta.name ?? session?.user.email ?? ''
  const avatarUrl: string | undefined = meta.avatar_url ?? meta.picture

  useEffect(() => {
    if (!open) return
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="rounded-full"
        aria-label="Menú de usuario"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Avatar name={name} url={avatarUrl} size="md" on="night" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-20 flex w-64 animate-bounce-in flex-col gap-3 rounded-card border-3 border-ink bg-night-800 p-4 shadow-card"
        >
          <div className="min-w-0">
            <p className="truncate text-body">{name}</p>
            <p className="truncate text-secondary text-on-night-muted">{session?.user.email}</p>
          </div>
          <button
            type="button"
            role="menuitem"
            className="btn btn-secondary btn-sm w-full"
            onClick={() => void signOut()}
          >
            <LogOut className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  )
}

/** Botón que despliega u oculta el cajón "Mi publicación" (solo en el tablón abierto). */
function DrawerToggle() {
  const { available, open, toggle } = useSubmissionDrawer()
  if (!available) return null
  const Icon = open ? PanelLeftClose : PanelLeftOpen
  return (
    <button
      type="button"
      className="btn btn-icon btn-secondary shrink-0"
      aria-label={open ? 'Ocultar mi publicación' : 'Mostrar mi publicación'}
      aria-expanded={open}
      aria-controls={DRAWER_ID}
      onClick={toggle}
    >
      <Icon strokeWidth={2.5} aria-hidden />
    </button>
  )
}

export default function Header() {
  const { data: round } = useCurrentRound()
  const { data: myVotes } = useMyVotes()
  const { isAdmin } = useIsAdmin()
  const ref = useRef<HTMLElement>(null)

  // Altura del encabezado en --header-h: el cajón se posiciona debajo (en móvil el encabezado ocupa dos filas).
  useLayoutEffect(() => {
    const header = ref.current
    if (!header) return
    const update = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  return (
    <header ref={ref} className="sticky top-0 z-20 border-b-3 border-ink bg-night-800">
      <div className="mx-auto flex w-full max-w-screen-2xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1">
          <DrawerToggle />
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="min-w-0 truncate font-display text-section-title uppercase">
              {round?.name ?? 'Tablón de Imágenes'}
            </span>
            {round && <StatusChip status={round.status} />}
          </Link>
        </div>
        {myVotes && <VoteTokens left={myVotes.left} />}
        <nav className="ml-auto flex items-center gap-1 sm:ml-0" aria-label="Principal">
          <NavLink to="/historial" className={navClass} aria-label="Historial">
            <History className="h-5 w-5" strokeWidth={2.5} aria-hidden />
            <span className="hidden sm:inline">Historial</span>
          </NavLink>
          {isAdmin && (
            <NavLink to="/admin" className={navClass} aria-label="Administración">
              <Shield className="h-5 w-5" strokeWidth={2.5} aria-hidden />
              <span className="hidden sm:inline">Admin</span>
            </NavLink>
          )}
        </nav>
        <UserMenu />
      </div>
    </header>
  )
}
