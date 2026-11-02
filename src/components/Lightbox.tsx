import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface LightboxProps {
  src: string
  title: string
  author: string
  onClose: () => void
}

/** Imagen a tamaño completo; se cierra con Escape o con un clic fuera. */
export default function Lightbox({ src, title, author, onClose }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  // Solo al abrir y al cerrar: foco, scroll del fondo y devolución del foco. Escape usa el último onClose.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      previous?.focus()
    }
  }, [])
  useEscapeKey(onClose)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex animate-fade-in flex-col items-center justify-center gap-4 bg-night-900/92 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <button
        ref={closeRef}
        type="button"
        className="btn btn-icon btn-secondary absolute right-4 top-4"
        aria-label="Cerrar"
        onClick={onClose}
      >
        <X strokeWidth={2.5} aria-hidden />
      </button>
      <img src={src} alt={title} className="max-h-[90vh] max-w-[90vw] rounded-img object-contain" />
      <div className="text-center">
        <p className="text-card-title">{title}</p>
        <p className="text-secondary text-on-night-muted">{author}</p>
      </div>
    </div>,
    document.body,
  )
}
