import { ImagePlus, Minus, Plus, Trash2, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'

// Muestra de la guía de estilo para revisarla de un vistazo (solo admin).

const COLORS = [
  ['night-900', 'bg-night-900'],
  ['night-800', 'bg-night-800'],
  ['brand-600', 'bg-brand-600'],
  ['brand-400', 'bg-brand-400'],
  ['surface', 'bg-surface'],
  ['surface-alt', 'bg-surface-alt'],
  ['ink', 'bg-ink'],
  ['ink-muted', 'bg-ink-muted'],
  ['on-night-muted', 'bg-on-night-muted'],
  ['sun', 'bg-sun'],
  ['vote', 'bg-vote'],
  ['sky', 'bg-sky'],
  ['success', 'bg-success'],
  ['danger', 'bg-danger'],
] as const

const BUTTON_STATES = [
  ['Normal', ''],
  ['Hover', 'brightness-105'],
  ['Presionado', 'translate-y-1 shadow-btn-pressed'],
] as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  )
}

function ButtonRow({ variant, label }: { variant: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {BUTTON_STATES.map(([state, extra]) => (
        <button key={state} type="button" className={`btn ${variant} ${extra}`}>
          {label} · {state}
        </button>
      ))}
      <button type="button" className={`btn ${variant}`} disabled>
        {label} · Deshabilitado
      </button>
    </div>
  )
}

export default function StylesPage() {
  return (
    <main className="flex flex-col gap-12 pb-12">
      <h1 className="page-title">Guía de estilo</h1>

      <Section title="Colores">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {COLORS.map(([name, bg]) => (
            <div key={name} className="flex flex-col gap-2">
              <div className={`h-16 rounded-btn border-3 border-ink ${bg}`} />
              <span className="text-secondary text-on-night-muted">{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía">
        <div className="card flex flex-col gap-3 p-6">
          <p className="page-title">Título de página</p>
          <p className="section-title">Título de sección</p>
          <p className="truncate text-card-title">Título de tarjeta con elipsis cuando no entra en una línea</p>
          <p className="text-body">Texto corrido en Nunito 16 px.</p>
          <p className="text-secondary text-ink-muted">Texto secundario en Nunito 14 px.</p>
          <span className="text-label uppercase">Etiqueta</span>
          <div className="flex items-end gap-4 font-display tabular-nums text-vote">
            <span className="text-vote-card">28</span>
            <span className="text-vote-winner">48</span>
          </div>
        </div>
      </Section>

      <Section title="Botones">
        <ButtonRow variant="btn-primary" label="Publicar" />
        <ButtonRow variant="btn-secondary" label="Ver votantes" />
        <ButtonRow variant="btn-danger" label="Borrar" />
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className="btn btn-primary btn-sm">
            <Plus strokeWidth={2.5} aria-hidden /> 1
          </button>
          <button type="button" className="btn btn-secondary btn-sm">
            <Minus strokeWidth={2.5} aria-hidden /> 1
          </button>
          <button type="button" className="btn btn-primary btn-sm" disabled>
            <Plus strokeWidth={2.5} aria-hidden /> 1
          </button>
          <button type="button" className="btn btn-icon btn-danger" aria-label="Borrar">
            <Trash2 strokeWidth={2.5} aria-hidden />
          </button>
          <button type="button" className="btn btn-google">
            Ingresar con Google
          </button>
        </div>
      </Section>

      <Section title="Chips y fichas">
        <div className="flex flex-wrap items-center gap-4">
          <span className="chip chip-pending">Preparada</span>
          <span className="chip chip-open">
            <span className="motion-beat h-2 w-2 animate-beat rounded-full bg-ink" aria-hidden />
            Abierta
          </span>
          <span className="chip chip-closed">Cerrada</span>
          <span className="chip chip-finalized">
            <Trophy className="h-3 w-3" strokeWidth={2.5} aria-hidden /> Finalizada
          </span>
          <span className="chip chip-own">Tu publicación</span>
          <span className="chip chip-tie">Empate</span>
          <span className="flex items-center gap-2">
            <span className="h-5 w-5 rounded-full border-3 border-vote bg-vote" />
            <span className="h-5 w-5 rounded-full border-3 border-vote bg-vote" />
            <span className="h-5 w-5 rounded-full border-3 border-on-night-muted" />
            <span className="text-label uppercase">Te quedan 2</span>
          </span>
        </div>
      </Section>

      <Section title="Tarjetas">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {[false, true].map((own) => (
            <article key={String(own)} className={`card card-hover p-3 ${own ? 'card-own' : ''}`}>
              <div className="relative aspect-card rounded-img bg-surface-alt">
                {own && <span className="chip chip-own absolute left-3 top-3">Tu publicación</span>}
              </div>
              <div className="flex flex-col gap-3 pt-3">
                <h3 className="truncate text-card-title">Mi captura favorita</h3>
                <div className="flex items-center gap-2">
                  <span className="avatar avatar-on-light h-8 w-8">AN</span>
                  <span className="text-secondary text-ink-muted">Ana Núñez</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="vote-pill">7</span>
                    <span className="h-2 w-2 rounded-full bg-vote" />
                    <span className="h-2 w-2 rounded-full bg-vote" />
                  </div>
                  {!own && (
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-secondary btn-sm" aria-label="Quitar un voto">
                        <Minus strokeWidth={2.5} aria-hidden /> 1
                      </button>
                      <button type="button" className="btn btn-primary btn-sm" aria-label="Dar un voto">
                        <Plus strokeWidth={2.5} aria-hidden /> 1
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Formularios">
        <div className="card flex max-w-modal flex-col gap-4 p-6">
          <label className="flex flex-col gap-2">
            <span className="text-label uppercase">Título</span>
            <div className="relative">
              <input className="input pr-16" placeholder="Ponle un título" maxLength={80} />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary text-ink-muted">0/80</span>
            </div>
          </label>
          <div className="flex flex-col items-center gap-3 rounded-card border-3 border-dashed border-brand-400 bg-surface-alt p-8 text-center">
            <ImagePlus className="h-12 w-12 text-brand-600" strokeWidth={2.5} aria-hidden />
            <p className="text-secondary text-ink-muted">Arrastra, elige o pega (Ctrl+V) tu captura</p>
          </div>
        </div>
      </Section>

      <Section title="Ranking">
        <div className="flex flex-col gap-4">
          {(
            [
              [1, 'bg-medal-gold', false],
              [1, 'bg-medal-gold', true],
              [3, 'bg-medal-bronze', false],
            ] as const
          ).map(([position, medal, tie], i) => (
            <div key={i} className="card flex items-center gap-4 p-3">
              <span className={`flex h-12 w-12 items-center justify-center rounded-full border-3 border-ink font-display text-rank-position ${medal}`}>
                {position}
              </span>
              <div className="h-16 w-24 shrink-0 rounded-img bg-surface-alt" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-card-title">Publicación {i + 1}</p>
                <p className="text-secondary text-ink-muted">Autor</p>
              </div>
              {tie && <span className="chip chip-tie">Empate</span>}
              <span className="vote-pill">5</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Avisos">
        <div className="flex flex-wrap gap-4">
          {(['border-success', 'border-danger', 'border-sky'] as const).map((border) => (
            <div key={border} className={`rounded-full border-3 bg-night-800 px-6 py-3 text-secondary ${border}`}>
              {border === 'border-danger' ? 'Ya usaste tus 3 votos' : border === 'border-sky' ? 'La votación se cerró' : '¡Publicado!'}
            </div>
          ))}
        </div>
      </Section>
    </main>
  )
}
