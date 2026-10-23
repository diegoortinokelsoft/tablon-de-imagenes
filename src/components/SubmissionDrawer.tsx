import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { ChevronRight, GripVertical } from 'lucide-react'
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery'
import { useSubmissionDrawer } from '../hooks/useSubmissionDrawer'
import type { BoardItem } from '../lib/board'
import {
  DRAG_THRESHOLD_PX,
  DRAWER_HOVER_PEEK_PX,
  DRAWER_PEEK_PX,
  clampDrag,
  resolveDrag,
} from '../lib/drawer'
import MySubmissionPanel from './MySubmissionPanel'

export const DRAWER_ID = 'cajon-mi-publicacion'

interface SubmissionDrawerProps {
  roundId: string
  mine: BoardItem | undefined
  imageUrl: string | undefined
}

/**
 * Panel "Mi publicación" como cajón lateral. Oculto, asoma una franja por la izquierda;
 * se abre o se cierra con el botón del encabezado, con un clic en la franja o arrastrándola.
 * En escritorio empuja la grilla (ver .drawer-push); en móvil se superpone con un velo.
 */
export default function SubmissionDrawer({ roundId, mine, imageUrl }: SubmissionDrawerProps) {
  const { open, setOpen } = useSubmissionDrawer()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [hover, setHover] = useState(false)
  const [dragX, setDragX] = useState<number | null>(null)
  const drag = useRef<{ startX: number; moved: boolean } | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Oculto, su contenido no recibe foco ni clics.
  useEffect(() => {
    contentRef.current?.toggleAttribute('inert', !open)
  }, [open])

  // En móvil (superpuesto) se cierra con Escape, salvo que haya un diálogo abierto.
  useEffect(() => {
    if (!open || isDesktop) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, isDesktop, setOpen])

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { startX: event.clientX, moved: false }
  }

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return
    const dx = event.clientX - drag.current.startX
    if (!drag.current.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return
    drag.current.moved = true
    setDragX(clampDrag(open, dx))
  }

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!drag.current) return
    const dx = drag.current.moved ? event.clientX - drag.current.startX : 0
    drag.current = null
    setDragX(null)
    const result = resolveDrag(open, dx)
    if (result !== 'stay') setOpen(result === 'open')
  }

  const onPointerCancel = () => {
    drag.current = null
    setDragX(null)
  }

  const peek = hover && !open ? DRAWER_HOVER_PEEK_PX : DRAWER_PEEK_PX
  const base = open ? 'var(--drawer-open-x)' : `calc(-100% + ${peek}px)`
  const dragging = dragX !== null

  const grip = (
    <button
      type="button"
      className="absolute inset-y-0 right-0 flex w-6 cursor-grab touch-none select-none items-center justify-center rounded-r-card text-ink-muted hover:text-ink active:cursor-grabbing"
      aria-label={open ? 'Ocultar mi publicación' : 'Mostrar mi publicación'}
      aria-expanded={open}
      aria-controls={DRAWER_ID}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={(event) => {
        // Con teclado (Enter o Espacio) no hay eventos de puntero: el clic alterna.
        if (event.detail === 0) setOpen(!open)
      }}
    >
      {open ? (
        <GripVertical className="h-4 w-4" strokeWidth={2.5} aria-hidden />
      ) : (
        <ChevronRight className={`h-4 w-4 ${hover ? 'animate-nudge' : ''}`} strokeWidth={2.5} aria-hidden />
      )}
    </button>
  )

  return (
    <>
      {open && !isDesktop && (
        <div
          className="fixed inset-x-0 bottom-0 top-[var(--header-h)] z-10 animate-fade-in bg-night-900/70"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
      <div
        id={DRAWER_ID}
        className={`fixed left-0 top-[calc(var(--header-h)+16px)] z-10 w-96 max-w-[calc(100vw-32px)] [--drawer-open-x:16px] sm:[--drawer-open-x:24px] lg:top-[calc(var(--header-h)+24px)] lg:[--drawer-open-x:32px] ${
          dragging ? '' : 'transition-transform duration-200 ease-bounce'
        }`}
        style={{ transform: `translateX(calc(${base} + ${dragX ?? 0}px))` }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <MySubmissionPanel
          roundId={roundId}
          mine={mine}
          imageUrl={imageUrl}
          className="max-h-[calc(100dvh-var(--header-h)-32px)] lg:max-h-[calc(100dvh-var(--header-h)-48px)]"
          contentRef={contentRef}
          grip={grip}
        />
      </div>
    </>
  )
}
