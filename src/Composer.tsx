import { useEffect, useMemo, useRef, useState } from 'react'
import { ClientPicker } from './ClientPicker'
import { DuePicker } from './DuePicker'
import { FocusPicker } from './FocusPicker'
import { formatDue, todayISO } from './dates'
import { parseCapture } from './focusAgent'
import type { ParsedCapture } from './focusAgent'
import { formatDayClock, formatDuration } from './focusTime'
import { parseTaskInput } from './parseTask'
import { PERSONAL_ID, type Client, type TaskFocus } from './types'

type Props = {
  title: string
  onTitle: (value: string) => void
  clientId: string
  onClient: (id: string) => void
  dueDate: string | null
  onDue: (iso: string | null) => void
  clients: Client[]
  onAdd: () => void
  onClose?: () => void
  manualClient: boolean
  manualDue: boolean
  onManualClient: () => void
  onManualDue: () => void
  focus: TaskFocus | null
  onFocus: (focus: TaskFocus | null) => void
  aiEnabled: boolean
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
  onClose,
  manualClient,
  manualDue,
  onManualClient,
  onManualDue,
  focus,
  onFocus,
  aiEnabled,
}: Props) {
  const today = todayISO()
  const inputRef = useRef<HTMLInputElement>(null)
  const [ai, setAi] = useState<ParsedCapture | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const appliedFor = useRef<string | null>(null)

  // Claude reads the line 500ms after typing stops. The local parser still runs
  // underneath, so capture keeps working when the agent or the key is missing.
  useEffect(() => {
    if (!aiEnabled) return
    const text = title.trim()
    if (text.length < 4) {
      setAi(null)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setAiBusy(true)
      setAiError(null)
      parseCapture(
        text,
        clients.map((client) => ({ id: client.id, name: client.name })),
        controller.signal,
      )
        .then((result) => {
          setAi(result.parsed)
        })
        .catch((error) => {
          if ((error as Error).name === 'AbortError') return
          setAi(null)
          setAiError((error as Error).message === 'agent-offline' ? null : 'Claude could not read that line')
        })
        .finally(() => setAiBusy(false))
    }, 500)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [title, aiEnabled, clients])

  function applyAi() {
    if (!ai) return
    appliedFor.current = title
    if (ai.clientId) {
      onManualClient()
      onClient(ai.clientId)
    }
    if (ai.dueDate) {
      onManualDue()
      onDue(ai.dueDate)
    }
    if (ai.start) {
      const start = new Date(ai.start)
      if (!Number.isNaN(start.getTime())) {
        onFocus({ start: start.toISOString(), durationMin: ai.durationMin ?? 60 })
      }
    } else if (ai.durationMin && focus) {
      onFocus({ ...focus, durationMin: ai.durationMin })
    }
    if (ai.title && ai.title !== title) onTitle(ai.title)
  }

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

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
        <div className="composer-head">
          <label className="composer-label" htmlFor="quick-add-input">
            Quick add
          </label>
          {onClose && (
            <button type="button" className="text-btn" onClick={onClose}>
              Close
            </button>
          )}
        </div>
        <div className="composer-main">
          <input
            id="quick-add-input"
            ref={inputRef}
            className="composer-input"
            value={title}
            onChange={(event) => onTitle(event.target.value)}
            placeholder="What needs doing?"
            enterKeyHint="done"
            autoComplete="off"
            autoCapitalize="sentences"
          />
          <button className="add-btn" type="submit" disabled={!title.trim()}>
            Add task
          </button>
        </div>
        {guessLabel && !ai && <p className="composer-hint">Detected: {guessLabel}</p>}
        {aiBusy && !ai && <p className="composer-hint">Reading the line…</p>}
        {aiError && <p className="composer-hint">{aiError}</p>}
        {ai && appliedFor.current !== title && (
          <div className="ai-suggest">
            <div className="ai-chips">
              <span className="ai-chip strong">{ai.title || title}</span>
              {ai.clientId && (
                <span className="ai-chip">
                  {ai.clientId === PERSONAL_ID
                    ? 'Personal'
                    : clients.find((client) => client.id === ai.clientId)?.name ?? ai.clientId}
                </span>
              )}
              {ai.durationMin && <span className="ai-chip">{formatDuration(ai.durationMin)}</span>}
              {ai.start && <span className="ai-chip">{formatDayClock(ai.start)}</span>}
              {ai.dueDate && <span className="ai-chip">due {formatDue(ai.dueDate, today)}</span>}
            </div>
            <button type="button" className="text-btn" onClick={applyAi}>
              Use this
            </button>
          </div>
        )}
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
        <FocusPicker value={focus} onChange={onFocus} compact />
      </div>
    </form>
  )
}
