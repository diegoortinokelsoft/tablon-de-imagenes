import { zipSync, type Zippable } from 'fflate'
import { rankItems, toBoardItem, type BoardItem } from './board'
import { STATUS_LABELS, slugify, type RoundStatus } from './labels'
import { buildPodium } from './podium'
import { renderResultImage } from './resultImage'
import { createSignedUrls } from './storage'
import { supabase } from './supabase'

// Exportación de una competencia para el archivo del superadmin: un ZIP con resumen.png,
// las imágenes originales y resultados.csv. Se arma en el navegador (ver especificacion-v2.md → "Archivo y limpieza").

export interface ExportRound {
  id: string
  name: string
  status: RoundStatus
  winner_submission_id: string | null
  finalized_at: string | null
}

/** Campo CSV: entre comillas si tiene comas, comillas o saltos de línea (las comillas se duplican). */
export function csvField(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const CSV_HEADER = ['Posición', 'Título', 'Autor', 'Email', 'Votos', 'Ganadora', 'Publicada']

/** resultados.csv con BOM, para que Excel lea bien las tildes. */
export function buildResultsCsv(items: BoardItem[], winnerId: string | null, emails: Record<string, string>): string {
  const rows = rankItems(items).map((item) => [
    item.position,
    item.title,
    item.authorName,
    emails[item.userId] ?? '',
    item.voteCount,
    item.id === winnerId ? 'Sí' : 'No',
    item.createdAt,
  ])
  return '﻿' + [CSV_HEADER, ...rows].map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n'
}

/** Nombre de cada imagen dentro del ZIP: imagenes/{posición}-{autor}-{título}.webp. */
export function imageEntryName(item: BoardItem, used: Set<string>): string {
  const base = `imagenes/${String(item.position).padStart(2, '0')}-${slugify(item.authorName) || 'autor'}-${slugify(item.title).slice(0, 40) || 'imagen'}`
  let name = `${base}.webp`
  for (let n = 2; used.has(name); n++) name = `${base}-${n}.webp`
  used.add(name)
  return name
}

/** Nombre del ZIP: {nombre-de-la-competencia}-{aaaa-mm-dd}.zip */
export function exportFilename(roundName: string, date: Date = new Date()): string {
  return `${slugify(roundName) || 'competencia'}-${date.toISOString().slice(0, 10)}.zip`
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`No se pudo descargar una imagen (${response.status})`)
  return new Uint8Array(await response.arrayBuffer())
}

/** Arma el ZIP de una competencia. Falla si no puede bajar alguna imagen: así nunca se limpia algo incompleto. */
export async function buildRoundExport(round: ExportRound): Promise<Blob> {
  const { data: rows, error } = await supabase.from('board').select('*').eq('round_id', round.id)
  if (error) throw error
  const items = rows.map(toBoardItem)

  const userIds = [...new Set(items.map((item) => item.userId))]
  const emails: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, email').in('id', userIds)
    if (profilesError) throw profilesError
    for (const profile of profiles) emails[profile.id] = profile.email
  }

  const urls = await createSignedUrls(items.map((item) => item.imagePath))
  const files: Zippable = {}
  const used = new Set<string>()
  for (const item of rankItems(items)) {
    const url = urls[item.imagePath]
    if (!url) throw new Error(`Falta la imagen de "${item.title}"`)
    // Las imágenes WEBP ya vienen comprimidas: se guardan sin volver a comprimir.
    files[imageEntryName(item, used)] = [await fetchBytes(url), { level: 0 }]
  }

  const winnerId = round.status === 'finalized' ? round.winner_submission_id : null
  const top = rankItems(items)[0]
  const podium = buildPodium(items, winnerId ?? top?.id ?? null)
  if (podium) {
    const summary = await renderResultImage({
      roundName: round.name,
      finalizedAt: winnerId ? round.finalized_at : null,
      podium,
      winnerImageUrl: urls[podium.winner.imagePath],
      headline: winnerId ? '¡GANADOR!' : 'MÁS VOTADA',
      note: winnerId ? undefined : `Estado: ${STATUS_LABELS[round.status]}, sin ganador`,
    })
    files['resumen.png'] = [new Uint8Array(await summary.arrayBuffer()), { level: 0 }]
  }

  files['resultados.csv'] = new TextEncoder().encode(buildResultsCsv(items, winnerId, emails))
  return new Blob([zipSync(files)], { type: 'application/zip' })
}
