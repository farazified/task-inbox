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
  const selected =
    value === PERSONAL_ID
      ? { name: 'Personal', color: PERSONAL_COLOR }
      : clients.find((client) => client.id === value) ?? {
          name: 'Personal',
          color: PERSONAL_COLOR,
        }

  return (
    <div className={`client-picker ${compact ? 'compact' : ''}`}>
      <select
        className="client-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label="Client"
        style={{
          ...chipVars(selected.color, true),
          color: selected.color,
        }}
      >
        <option value={PERSONAL_ID} style={{ color: PERSONAL_COLOR }}>
          Personal
        </option>
        {clients.map((client) => (
          <option key={client.id} value={client.id} style={{ color: client.color }}>
            {client.name}
          </option>
        ))}
      </select>
    </div>
  )
}
