// Códigos que lanzan las RPC (raise exception '<CÓDIGO>') y los que genera el cliente.
export const ERROR_MESSAGES = {
  NOT_ALLOWED: 'Solo pueden ingresar cuentas @grupokelsoft.com',
  NOT_ADMIN: 'Solo el administrador puede hacer esto',
  ROUND_NOT_OPEN: 'La competencia no está abierta',
  ALREADY_SUBMITTED: 'Ya tienes una publicación',
  NO_SUBMISSION: 'La publicación ya no existe',
  INVALID_PATH: 'La ruta de la imagen no es válida',
  INVALID_TITLE: 'El título debe tener entre 1 y 80 caracteres',
  OWN_SUBMISSION: 'No puedes votar tu propia publicación',
  NO_VOTES_LEFT: 'Ya usaste tus 3 votos',
  NO_VOTE_TO_REMOVE: 'No tienes votos en esta publicación',
  INVALID_TRANSITION: 'Ese cambio de estado no está permitido',
  INVALID_WINNER: 'El ganador tiene que ser una publicación de esta competencia',
  INVALID_NAME: 'El nombre debe tener entre 1 y 80 caracteres',
  NO_ACCESS: 'No tienes acceso a esta competencia',
  NOT_OWNER: 'Solo quien creó la competencia puede hacer esto',
  ROUND_NOT_FOUND: 'La competencia no existe',
  ROUND_LIMIT: 'Ya tienes 2 competencias activas. Finaliza o borra una para crear otra',
  ROUND_CLEANED: 'Esta competencia fue archivada',
  VISIBILITY_LOCKED: 'La visibilidad solo se cambia antes de abrir la competencia',
  NOT_PRIVATE: 'Esta competencia es pública: no hace falta pedir acceso',
  INVALID_INVITE: 'El enlace de invitación no es válido o fue reemplazado',
  ALREADY_HAS_ACCESS: 'Ya tiene acceso a esta competencia',
  REQUEST_PENDING: 'Ya pediste acceso: espera la respuesta',
  NO_REQUEST: 'La solicitud ya no está pendiente',
  NOT_MEMBER: 'Esa persona no es miembro',
  USER_NOT_FOUND: 'Esa persona todavía no inició sesión en el Tablón',
  NOT_INACTIVE: 'La competencia tuvo actividad en los últimos 60 días',
  NOT_EXPORTED: 'Exporta la competencia antes de limpiarla',
  FILE_TOO_LARGE: 'La imagen supera los 5 MB',
  INVALID_FORMAT: 'Formato no admitido: usa JPG, PNG o WEBP',
} as const

export type ErrorCode = keyof typeof ERROR_MESSAGES

export const GENERIC_ERROR_MESSAGE = 'Algo salió mal. Intenta de nuevo.'

const CODES = Object.keys(ERROR_MESSAGES) as ErrorCode[]

function rawMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return ''
}

/** Extrae el código fijo de un error de RPC (el mensaje es exactamente el código). */
export function errorCode(error: unknown): ErrorCode | null {
  const message = rawMessage(error).trim()
  return CODES.find((code) => message === code) ?? null
}

/** Traduce cualquier error a un mensaje en español para mostrar en un toast. */
export function errorMessage(error: unknown): string {
  const code = errorCode(error)
  return code ? ERROR_MESSAGES[code] : GENERIC_ERROR_MESSAGE
}
