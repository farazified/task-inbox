import { chipVars } from './chipVars'
import { PERSONAL_ID, type Client } from './types'

const PERSONAL_COLOR = '#a78bfa'

type Props = {
  value: string
  clients: Client[]
  onChange: (clientId: string) => void
  compact?: boolean
}

export function ClientPicker({ value, clients, onChange, compact }: Props) {
  const color =
    value === PERSONAL_ID
      ? PERSONAL_COLOR
      : clients.find((client) => client.id === value)?.color ?? PERSONAL_COLOR

  return (
    <div className={`client-picker ${compact ? 'compact' : ''}`}>
      <select
        className="client-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Client"
        style={chipVars(color, true)}
      >
        <option value={PERSONAL_ID}>Personal</option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>
    </div>
  )
}
