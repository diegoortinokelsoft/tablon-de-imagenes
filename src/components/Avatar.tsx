import { useState } from 'react'
import { initials } from '../lib/labels'

interface AvatarProps {
  name: string
  url?: string | null
  /** 32 px en tarjetas, 40 px en el encabezado. */
  size?: 'sm' | 'md'
  /** Borde blanco sobre fondo oscuro, ink sobre fondo claro. */
  on?: 'light' | 'night'
}

export default function Avatar({ name, url, size = 'sm', on = 'light' }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const sizeClass = size === 'md' ? 'h-10 w-10' : 'h-8 w-8'
  const borderClass = on === 'night' ? 'avatar-on-night' : 'avatar-on-light'

  return (
    <span className={`avatar ${sizeClass} ${borderClass}`} aria-hidden>
      {url && !failed ? (
        // no-referrer: las fotos de Google devuelven 403 con referrer de otro dominio.
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name)
      )}
    </span>
  )
}
