// Cajón lateral "Mi publicación": oculto asoma por la izquierda y se abre con clic o arrastre.

/** Ancho de la franja que asoma cuando está oculto. */
export const DRAWER_PEEK_PX = 24
/** Cuánto más asoma al pasar el mouse, para sugerir que se puede desplegar. */
export const DRAWER_HOVER_PEEK_PX = 36
/** Movimiento mínimo para considerar que es un arrastre y no un clic. */
export const DRAG_THRESHOLD_PX = 5
/** Distancia de arrastre necesaria para abrir o cerrar. */
export const DRAG_COMMIT_PX = 60

/** Desplazamiento visible durante el arrastre: abierto solo hacia la izquierda, oculto solo hacia la derecha. */
export function clampDrag(open: boolean, dx: number): number {
  return open ? Math.min(0, dx) : Math.max(0, dx)
}

/**
 * Qué hacer al soltar. Un movimiento menor al umbral es un clic y alterna el estado;
 * un arrastre abre o cierra solo si supera la distancia necesaria en la dirección correcta.
 */
export function resolveDrag(open: boolean, dx: number): 'open' | 'close' | 'stay' {
  if (Math.abs(dx) < DRAG_THRESHOLD_PX) return open ? 'close' : 'open'
  if (!open && dx >= DRAG_COMMIT_PX) return 'open'
  if (open && dx <= -DRAG_COMMIT_PX) return 'close'
  return 'stay'
}
