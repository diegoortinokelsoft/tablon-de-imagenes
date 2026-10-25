import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Globe, Lock } from 'lucide-react'
import { useToast } from '../hooks/useToast'
import { errorMessage } from '../lib/errors'
import { MAX_ACTIVE_ROUNDS } from '../lib/hub'
import { VISIBILITY_LABELS, type RoundVisibility } from '../lib/labels'
import { createRound } from '../lib/rounds'
import ConfirmDialog from './ConfirmDialog'

const NAME_MAX = 80

const VISIBILITY_HINTS: Record<RoundVisibility, string> = {
  public: 'Cualquier persona de Kelsoft la ve y participa.',
  private: 'Solo entran quienes invites o quienes pidan acceso y apruebes.',
}

interface CreateRoundDialogProps {
  open: boolean
  /** Competencias activas que todavía puede crear; null para el superadmin (sin límite). */
  slotsLeft: number | null
  onClose: () => void
}

/** Modal para crear una competencia. Nace preparada y lleva a su panel de gestión. */
export default function CreateRoundDialog({ open, slotsLeft, onClose }: CreateRoundDialogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [name, setName] = useState('')
  const [visibility, setVisibility] = useState<RoundVisibility>('public')
  const [pending, setPending] = useState(false)
  const valid = name.trim().length >= 1 && name.trim().length <= NAME_MAX

  const close = () => {
    setName('')
    setVisibility('public')
    onClose()
  }

  const create = async () => {
    setPending(true)
    try {
      const id = await createRound(name, visibility)
      await queryClient.invalidateQueries({ queryKey: ['hub'] })
      notify('Competencia creada', 'success')
      close()
      navigate(`/c/${id}/gestion`)
    } catch (error) {
      notify(errorMessage(error), 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title="Crear competencia"
      confirmLabel={pending ? 'Creando…' : 'Crear'}
      pending={pending}
      confirmDisabled={!valid}
      onCancel={close}
      onConfirm={() => void create()}
    >
      <div className="flex flex-col gap-4 text-ink">
        <label className="flex flex-col gap-2">
          <span className="text-label uppercase">Nombre</span>
          <span className="relative">
            <input
              className="input pr-20"
              value={name}
              maxLength={NAME_MAX}
              placeholder="Por ejemplo: Mejor fondo de pantalla"
              onChange={(event) => setName(event.target.value)}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-secondary tabular-nums text-ink-muted">
              {name.length}/{NAME_MAX}
            </span>
          </span>
          <span className="text-secondary text-ink-muted">El nombre lo ve todo Kelsoft, aunque la competencia sea privada.</span>
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="pb-2 text-label uppercase">Visibilidad</legend>
          {(['public', 'private'] as const).map((option) => {
            const Icon = option === 'public' ? Globe : Lock
            const checked = visibility === option
            return (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-3 rounded-btn border-3 p-3 ${
                  checked ? 'border-brand-600 bg-surface-alt' : 'border-ink'
                }`}
              >
                <input
                  type="radio"
                  name="visibilidad-nueva"
                  className="mt-1 h-5 w-5 accent-brand-600"
                  checked={checked}
                  onChange={() => setVisibility(option)}
                />
                <span className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 text-body">
                    <Icon className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                    {VISIBILITY_LABELS[option]}
                  </span>
                  <span className="text-secondary text-ink-muted">{VISIBILITY_HINTS[option]}</span>
                </span>
              </label>
            )
          })}
          <span className="text-secondary text-ink-muted">Puedes cambiarla hasta que abras la competencia.</span>
        </fieldset>
        {slotsLeft !== null && (
          <p className="text-secondary text-ink-muted">
            Te quedan {slotsLeft} de {MAX_ACTIVE_ROUNDS} competencias activas.
          </p>
        )}
      </div>
    </ConfirmDialog>
  )
}
