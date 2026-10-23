import { useSession } from '../hooks/useSession'

export default function BoardPage() {
  const { session } = useSession()
  const name = session?.user.user_metadata.full_name ?? session?.user.email
  return (
    <div className="flex flex-col gap-2">
      <h1 className="page-title">Tablón</h1>
      <p className="text-body text-on-night-muted">Hola, {name}. El tablón llega en las próximas fases.</p>
    </div>
  )
}
