import { useEffect, useRef } from 'react'

/**
 * Llama a onEscape al pulsar Escape mientras active sea verdadero. Siempre usa la última versión
 * de onEscape sin volver a registrar el listener: así los diálogos pueden recibir funciones nuevas
 * en cada render sin que se repitan efectos (como mover el foco) con cada tecla.
 */
export function useEscapeKey(onEscape: () => void, active = true) {
  const handler = useRef(onEscape)
  useEffect(() => {
    handler.current = onEscape
  })

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handler.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [active])
}
