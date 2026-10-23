import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface LightboxProps {
  src: string
  title: string
  author: string
  onClose: () => void
}

/** Imagen a tamaño completo; se cierra con Escape o con un clic fuera. */
export default function Lightbox({ src, title, author, onClose }: LightboxProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previous?.focus()
    }
  }, [onClose])

  return (
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
    </div>
  )
}
