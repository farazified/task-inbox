import { useState } from 'react'
import { isDefaultClient } from './defaults'
import { clientNameError, trimClientName } from './validate'
import type { Client } from './types'

type Props = {
  clients: Client[]
  onAdd: (name: string) => boolean
  onRename: (id: string, name: string) => boolean
  onDelete: (id: string) => void
  onClose: () => void
}

export function ClientsScreen({
  clients,
  onAdd,
  onRename,
  onDelete,
  onClose,
}: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  function add() {
    const next = trimClientName(name)
    const message = clientNameError(next, clients)
    if (message) {
      setError(message)
      return
    }
    if (onAdd(next)) {
      setName('')
      setError(null)
    }
  }

  return (
    <div className="panel">
      <header className="panel-head">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Back">
          ‹
        </button>
        <h1>Clients</h1>
        <span className="head-spacer" />
      </header>

      <ul className="client-list">
        <li className="client-row locked">
          <span className="dot" style={{ background: '#a78bfa' }} />
          <div>
            <strong>Personal</strong>
            <span>Always available</span>
          </div>
        </li>
        {clients.map((client) => (
          <li key={client.id} className="client-row">
            <span className="dot" style={{ background: client.color }} />
            <input
              className="rename"
              defaultValue={client.name}
              aria-label={`Rename ${client.name}`}
              onBlur={(event) => {
                const next = trimClientName(event.target.value)
                const message = clientNameError(next, clients, client.id)
                if (message) {
                  event.target.value = client.name
                  setError(message)
                  return
                }
                if (next !== client.name) {
                  if (!onRename(client.id, next)) event.target.value = client.name
                  else setError(null)
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
            {isDefaultClient(client.id) ? (
              <span className="text-btn muted built-in">Built-in</span>
            ) : pendingDelete === client.id ? (
              <div className="confirm">
                <button type="button" className="text-btn danger" onClick={() => onDelete(client.id)}>
                  Remove
                </button>
                <button type="button" className="text-btn" onClick={() => setPendingDelete(null)}>
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="text-btn muted"
                onClick={() => setPendingDelete(client.id)}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      <form
        className="add-client"
        onSubmit={(event) => {
          event.preventDefault()
          add()
        }}
      >
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            if (error) setError(null)
          }}
          placeholder="New client name"
          autoComplete="off"
        />
        <button type="submit" className="add-btn" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {error && <p className="hint error">{error}</p>}
      <p className="hint tight">Deleting a client moves its tasks to Personal.</p>
    </div>
  )
}
