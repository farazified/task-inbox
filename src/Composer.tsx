import { useEffect, useMemo } from 'react'
import { ClientPicker } from './ClientPicker'
import { DuePicker } from './DuePicker'
import { formatDue, todayISO } from './dates'
import { parseTaskInput } from './parseTask'
import { PERSONAL_ID, type Client } from './types'

type Props = {
  title: string
  onTitle: (value: string) => void
  clientId: string
  onClient: (id: string) => void
  dueDate: string | null
  onDue: (iso: string | null) => void
  clients: Client[]
  onAdd: () => void
  manualClient: boolean
  manualDue: boolean
  onManualClient: () => void
  onManualDue: () => void
}

export function Composer({
  title,
  onTitle,
  clientId,
  onClient,
  dueDate,
  onDue,
  clients,
  onAdd,
  manualClient,
  manualDue,
  onManualClient,
  onManualDue,
}: Props) {
  const today = todayISO()

  const guess = useMemo(
    () => (title.trim() ? parseTaskInput(title, clients, clientId, today) : null),
    [title, clients, clientId, today],
  )

  const guessLabel = useMemo(() => {
    if (!guess || (manualClient && manualDue)) return null
    const parts: string[] = []
    if (!manualClient && guess.clientId) {
      const name =
        guess.clientId === PERSONAL_ID
          ? 'Personal'
          : clients.find((client) => client.id === guess.clientId)?.name
      if (name) parts.push(name)
    }
    if (!manualDue && guess.dueDate) parts.push(formatDue(guess.dueDate, today))
    return parts.length ? parts.join(' · ') : null
  }, [guess, manualClient, manualDue, clients, today])

  useEffect(() => {
    if (!title.trim() || !guess) return
    if (!manualClient && guess.clientId && guess.clientId !== clientId) onClient(guess.clientId)
    if (!manualDue && guess.dueDate && guess.dueDate !== dueDate) onDue(guess.dueDate)
  }, [title, guess, manualClient, manualDue, clientId, dueDate, onClient, onDue])

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim()) return
        onAdd()
      }}
    >
      <div className="composer-card">
        <label className="composer-label">Quick add</label>
        <div className="composer-main">
          <input
            className="composer-input"
            value={title}
            onChange={(event) => onTitle(event.target.value)}
            placeholder="What needs doing? Names & dates auto-detect."
            enterKeyHint="done"
            autoComplete="off"
            autoCapitalize="sentences"
          />
          <button className="add-btn" type="submit" disabled={!title.trim()}>
            Add
          </button>
        </div>
        {guessLabel && <p className="composer-hint">Detected: {guessLabel}</p>}
        <div className="composer-meta">
          <label className="field">
            <span>Client</span>
            <ClientPicker
              value={clientId}
              clients={clients}
              onChange={(id) => {
                onManualClient()
                onClient(id)
              }}
            />
          </label>
          <label className="field">
            <span>Due</span>
            <DuePicker
              value={dueDate}
              onChange={(iso) => {
                onManualDue()
                onDue(iso)
              }}
            />
          </label>
        </div>
      </div>
    </form>
  )
}
