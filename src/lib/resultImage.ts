import { initials, formatDate } from './labels'
import { ordinal, votesLabel, type Podium } from './podium'

// Imagen del resultado para pegar en Slack (1200 × 630, PNG), dibujada en el navegador con canvas.
// La reutiliza la exportación del superadmin como resumen.png.

export const RESULT_WIDTH = 1200
export const RESULT_HEIGHT = 630

/** Tokens de la guía (los mismos de tailwind.config.ts; resultImage.test.ts verifica que coincidan). */
export const RESULT_COLORS = {
  night900: '#1D1133',
  night800: '#2A1A4A',
  brand600: '#6520A0',
  brand400: '#9B5CF0',
  onNight: '#FFFFFF',
  onNightMuted: '#C9BEE6',
  sun: '#FFD23F',
  vote: '#FF4F8B',
} as const

// Extremo medio del degradado de fondo de la guía: linear-gradient(160deg, #1D1133 0%, #3A1670 55%, #6520A0 100%).
const GRADIENT_MID = '#3A1670'

const FONT_DISPLAY = '"Lilita One", system-ui, sans-serif'
const FONT_BODY = 'Nunito, system-ui, sans-serif'

type Measure = (text: string) => number

/** Recorta el texto con "…" para que entre en maxWidth. */
export function fitText(text: string, maxWidth: number, measure: Measure): string {
  if (measure(text) <= maxWidth) return text
  let end = text.length
  while (end > 0 && measure(`${text.slice(0, end).trimEnd()}…`) > maxWidth) end--
  return `${text.slice(0, end).trimEnd()}…`
}

/** Parte el texto en líneas de hasta maxWidth; si no entra en maxLines, la última termina en "…". */
export function wrapText(text: string, maxWidth: number, measure: Measure, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!
    const candidate = current ? `${current} ${word}` : word
    if (measure(candidate) <= maxWidth || !current) {
      current = candidate
      continue
    }
    lines.push(current)
    current = word
    if (lines.length === maxLines - 1) {
      current = words.slice(i).join(' ')
      break
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, maxLines).map((line) => fitText(line, maxWidth, measure))
}

/** Rectángulo de esquinas redondeadas como trazado actual. */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Baja una imagen como blob y la decodifica. Con un blob el canvas no queda "contaminado" por CORS,
 * así que después se puede exportar. Devuelve null si falla (por ejemplo, un avatar sin CORS).
 */
export async function loadBitmap(url: string | null | undefined): Promise<ImageBitmap | null> {
  if (!url) return null
  try {
    const response = await fetch(url, { referrerPolicy: 'no-referrer' })
    if (!response.ok) return null
    return await createImageBitmap(await response.blob())
  } catch {
    return null
  }
}

async function loadPattern(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = '/doodles.svg'
  })
}

async function loadFonts() {
  if (!('fonts' in document)) return
  await Promise.all(
    [`56px ${FONT_DISPLAY}`, `800 36px ${FONT_BODY}`, `600 24px ${FONT_BODY}`].map((font) =>
      document.fonts.load(font).catch(() => undefined),
    ),
  )
}

function drawBackground(ctx: CanvasRenderingContext2D, pattern: HTMLImageElement | null) {
  // 160deg en CSS: de arriba a la izquierda hacia abajo a la derecha, casi vertical.
  const gradient = ctx.createLinearGradient(RESULT_WIDTH * 0.33, 0, RESULT_WIDTH * 0.67, RESULT_HEIGHT)
  gradient.addColorStop(0, RESULT_COLORS.night900)
  gradient.addColorStop(0.55, GRADIENT_MID)
  gradient.addColorStop(1, RESULT_COLORS.brand600)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, RESULT_WIDTH, RESULT_HEIGHT)
  if (pattern) {
    const fill = ctx.createPattern(pattern, 'repeat')
    if (fill) {
      ctx.save()
      ctx.globalAlpha = 0.06
      ctx.fillStyle = fill
      ctx.fillRect(0, 0, RESULT_WIDTH, RESULT_HEIGHT)
      ctx.restore()
    }
  }
}

/** Imagen ajustada a su caja sin recortar (contain), sobre night-800, con el borde de 6 px en sun. */
function drawWinnerImage(ctx: CanvasRenderingContext2D, image: ImageBitmap | null, x: number, y: number, w: number, h: number) {
  ctx.save()
  roundedRect(ctx, x, y, w, h, 20)
  ctx.fillStyle = RESULT_COLORS.night800
  ctx.fill()
  ctx.clip()
  if (image) {
    const scale = Math.min(w / image.width, h / image.height)
    const dw = image.width * scale
    const dh = image.height * scale
    ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
  }
  ctx.restore()
  roundedRect(ctx, x, y, w, h, 20)
  ctx.lineWidth = 6
  ctx.strokeStyle = RESULT_COLORS.sun
  ctx.stroke()
}

function drawAvatar(ctx: CanvasRenderingContext2D, image: ImageBitmap | null, name: string, x: number, y: number, size: number) {
  const r = size / 2
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + r, y + r, r, 0, Math.PI * 2)
  ctx.fillStyle = RESULT_COLORS.brand400
  ctx.fill()
  ctx.clip()
  if (image) {
    const scale = Math.max(size / image.width, size / image.height)
    ctx.drawImage(image, x + (size - image.width * scale) / 2, y + (size - image.height * scale) / 2, image.width * scale, image.height * scale)
  } else {
    ctx.fillStyle = RESULT_COLORS.onNight
    ctx.font = `800 ${Math.round(size * 0.38)}px ${FONT_BODY}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials(name), x + r, y + r + 1)
  }
  ctx.restore()
  ctx.beginPath()
  ctx.arc(x + r, y + r, r - 1.5, 0, Math.PI * 2)
  ctx.lineWidth = 3
  ctx.strokeStyle = RESULT_COLORS.onNight
  ctx.stroke()
}

export interface ResultImageData {
  roundName: string
  finalizedAt: string | null
  podium: Podium
  winnerImageUrl: string | undefined
}

/** Dibuja la imagen del resultado y la devuelve como PNG. */
export async function renderResultImage({ roundName, finalizedAt, podium, winnerImageUrl }: ResultImageData): Promise<Blob> {
  const { winner, rest, more } = podium
  const [, image, avatar, pattern] = await Promise.all([
    loadFonts(),
    loadBitmap(winnerImageUrl),
    loadBitmap(winner.authorAvatar),
    loadPattern(),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = RESULT_WIDTH
  canvas.height = RESULT_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  const measure: Measure = (text) => ctx.measureText(text).width
  const margin = 48
  const contentWidth = RESULT_WIDTH - margin * 2

  drawBackground(ctx, pattern)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'

  // Encabezado: nombre de la competencia y "¡GANADOR!".
  ctx.fillStyle = RESULT_COLORS.onNightMuted
  ctx.font = `800 22px ${FONT_BODY}`
  ctx.fillText(fitText(roundName.toUpperCase(), contentWidth, measure), margin, 56)
  ctx.fillStyle = RESULT_COLORS.sun
  ctx.font = `56px ${FONT_DISPLAY}`
  ctx.fillText('¡GANADOR!', margin, 114)

  // Imagen ganadora (16:10).
  const box = { x: margin, y: 136, w: 528, h: 330 }
  drawWinnerImage(ctx, image, box.x, box.y, box.w, box.h)

  // Columna derecha: título, autor y votos.
  const colX = box.x + box.w + 40
  const colWidth = RESULT_WIDTH - margin - colX
  ctx.fillStyle = RESULT_COLORS.onNight
  ctx.font = `800 36px ${FONT_BODY}`
  const titleLines = wrapText(winner.title, colWidth, measure, 3)
  titleLines.forEach((line, i) => ctx.fillText(line, colX, 176 + i * 44))

  const authorY = 176 + titleLines.length * 44 + 8
  drawAvatar(ctx, avatar, winner.authorName, colX, authorY, 56)
  ctx.fillStyle = RESULT_COLORS.onNight
  ctx.font = `600 26px ${FONT_BODY}`
  ctx.fillText(fitText(winner.authorName, colWidth - 72, measure), colX + 72, authorY + 37)

  ctx.font = `36px ${FONT_DISPLAY}`
  const votes = votesLabel(winner.voteCount)
  const pillY = authorY + 80
  roundedRect(ctx, colX, pillY, measure(votes) + 48, 60, 30)
  ctx.fillStyle = RESULT_COLORS.vote
  ctx.fill()
  ctx.fillStyle = RESULT_COLORS.onNight
  ctx.fillText(votes, colX + 24, pillY + 43)

  // Podio: los siguientes, solo con nombre, título y votos.
  if (rest.length > 0) {
    const stripY = 486
    const stripH = 84
    roundedRect(ctx, margin, stripY, contentWidth, stripH, 20)
    ctx.fillStyle = RESULT_COLORS.night800
    ctx.fill()
    const columns = rest.length + (more > 0 ? 1 : 0)
    const colW = contentWidth / columns
    rest.forEach((entry, i) => {
      const x = margin + 24 + i * colW
      const innerW = colW - 40
      ctx.fillStyle = RESULT_COLORS.sun
      ctx.font = `28px ${FONT_DISPLAY}`
      const place = ordinal(entry.place)
      ctx.fillText(place, x, stripY + 38)
      const placeW = measure(place) + 12
      ctx.fillStyle = RESULT_COLORS.onNight
      ctx.font = `800 22px ${FONT_BODY}`
      ctx.fillText(fitText(entry.item.authorName, innerW - placeW, measure), x + placeW, stripY + 37)
      ctx.fillStyle = RESULT_COLORS.onNightMuted
      ctx.font = `600 18px ${FONT_BODY}`
      ctx.fillText(fitText(`${entry.item.title} · ${votesLabel(entry.item.voteCount)}`, innerW, measure), x, stripY + 66)
    })
    if (more > 0) {
      ctx.fillStyle = RESULT_COLORS.onNightMuted
      ctx.font = `800 22px ${FONT_BODY}`
      ctx.fillText(`y ${more} más`, margin + 24 + rest.length * colW, stripY + 50)
    }
  }

  // Pie.
  ctx.fillStyle = RESULT_COLORS.onNightMuted
  ctx.font = `800 16px ${FONT_BODY}`
  ctx.fillText('TABLÓN DE IMÁGENES · GRUPO KELSOFT', margin, 608)
  if (finalizedAt) {
    ctx.textAlign = 'right'
    ctx.font = `600 16px ${FONT_BODY}`
    ctx.fillText(`Finalizada el ${formatDate(finalizedAt)}`, RESULT_WIDTH - margin, 608)
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))), 'image/png'),
  )
}

/** Si el navegador permite copiar imágenes al portapapeles. */
export function canCopyImages(): boolean {
  return typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'
}

/**
 * Copia la imagen al portapapeles. Recibe la promesa del blob (no el blob ya resuelto) porque Safari
 * exige crear el ClipboardItem dentro del clic, antes de esperar nada.
 */
export async function copyImage(blob: Promise<Blob>) {
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Nombre de archivo a partir del nombre de la competencia: "Mejor fondo!" → "resultado-mejor-fondo.png". */
export function resultFilename(roundName: string): string {
  const slug = roundName
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `resultado-${slug || 'competencia'}.png`
}
