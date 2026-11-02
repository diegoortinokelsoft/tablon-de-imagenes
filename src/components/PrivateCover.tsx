import { Lock } from 'lucide-react'

/**
 * Portada de una competencia privada en el hub: garabatos de colores de la guía y un candado,
 * en lugar de la imagen ganadora o la más votada. Así ninguna imagen de una privada se ve en el hub,
 * ni siquiera para quien tiene acceso (alguien puede estar mirando la pantalla).
 */
export default function PrivateCover() {
  return (
    <span className="relative block aspect-card w-full overflow-hidden rounded-img bg-brand-600" aria-hidden>
      <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <circle cx="132" cy="18" r="34" className="fill-brand-400" opacity="0.55" />
        <circle cx="22" cy="92" r="30" className="fill-night-800" opacity="0.5" />
        {/* Estrellas */}
        <path d="M24 14l2.6 6 6.4.6-4.8 4.2 1.4 6.4-5.6-3.4-5.6 3.4 1.4-6.4-4.8-4.2 6.4-.6z" className="fill-sun" />
        <path d="M134 70l1.8 4.2 4.4.4-3.4 2.9 1 4.4-3.8-2.3-3.8 2.3 1-4.4-3.4-2.9 4.4-.4z" className="fill-vote" />
        {/* Círculos y rayitas */}
        <circle cx="52" cy="72" r="6" className="fill-none stroke-sky" strokeWidth="3" />
        <circle cx="112" cy="40" r="3.5" className="fill-success" />
        <circle cx="146" cy="52" r="2.5" className="fill-on-night" />
        <path d="M96 84c5-6 11 6 16 0" className="fill-none stroke-sun" strokeWidth="3" strokeLinecap="round" />
        <path d="M40 34c5-6 11 6 16 0" className="fill-none stroke-vote" strokeWidth="3" strokeLinecap="round" />
        <path d="M70 12l8 4M66 20l8 4" className="stroke-sky" strokeWidth="3" strokeLinecap="round" />
        <path d="M8 50l7-4M11 58l7-4" className="stroke-on-night-muted" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-3 border-ink bg-surface shadow-btn-sm">
        <Lock className="h-8 w-8 text-ink" strokeWidth={2.5} />
      </span>
    </span>
  )
}
