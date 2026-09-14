import { useMemo, useState } from 'react'
import { applyPlan, autofill } from './focusAgent'
import type { AutofillResult, Placement } from './focusAgent'
import { DURATION_CHOICES, formatDuration, taskDuration } from './focusTime'
import { PERSONAL_ID, type Client, type Task, type TaskFocus } from './types'

type Props = {
  tasks: Task[]
  clients: Client[]
  onDurationsChange: (updates: Array<{ taskId: string; durationMin: number }>) => void
  onApply: (updates: Array<{ taskId: string; focus: TaskFocus }>) => void
  onClose: () => void
}

const PLACEMENT_LABEL: Record<Placement['placement'], string> = {
  'on-due-date': 'on its due date',
  'moved-earlier': 'moved earlier',
  'moved-later': 'moved later',
  'overdue-catch-up': 'overdue catch-up',
}

function clientName(clients: Client[], clientId: string): string {
  if (clientId === PERSONAL_ID) return 'Personal'
  return clients.find((client) => client.id === clientId)?.name ?? 'Personal'
}

export function AutoSchedule({ tasks, clients, onDurationsChange, onApply, onClose }: Props) {
  const [result, setResult] = useState<AutofillResult | null>(null)
  const [busy, setBusy] = useState<'planning' | 'applying' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cap, setCap] = useState<number>(0)
  const [horizonDays, setHorizonDays] = useState<number>(7)
  const [confirmApply, setConfirmApply] = useState(false)

  const candidates = useMemo(
    () => tasks.filter((task) => task.progress !== 'done' && !task.focus),
    [tasks],
  )

  // Most of the backlog repeats, so durations are set per kind rather than per task.
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; tasks: Task[]; durations: Set<number> }>()
    for (const task of candidates) {
      const entry = map.get(task.title) ?? { title: task.title, tasks: [], durations: new Set() }
      entry.tasks.push(task)
      entry.durations.add(taskDuration(task))
      map.set(task.title, entry)
    }
    return [...map.values()].sort((a, b) => b.tasks.length - a.tasks.length)
  }, [candidates])

  const missingDuration = candidates.filter((task) => !task.durationMin).length
  const totalMinutes = candidates.reduce((sum, task) => sum + taskDuration(task), 0)

  function setGroupDuration(title: string, durationMin: number) {
    onDurationsChange(
      candidates
        .filter((task) => task.title === title)
        .map((task) => ({ taskId: task.id, durationMin })),
    )
  }

  async function plan() {
    setBusy('planning')
    setError(null)
    try {
      setResult(
        await autofill(
          candidates.map((task) => ({
            id: task.id,
            title: task.title,
            clientId: task.clientId,
            dueDate: task.dueDate,
            durationMin: taskDuration(task),
          })),
          cap > 0 ? cap * 60 : undefined,
          horizonDays,
        ),
      )
      setConfirmApply(false)
    } catch (caught) {
      setError(describe((caught as Error).message))
      setResult(null)
    } finally {
      setBusy(null)
    }
  }

  async function apply() {
    if (!result) return
    if (result.placements.length >= 5 && !confirmApply) {
      setConfirmApply(true)
      return
    }
    setBusy('applying')
    setError(null)
    try {
      const items = result.placements.map((placement) => ({
        taskId: placement.taskId,
        title: placement.title,
        clientId: placement.clientId ?? PERSONAL_ID,
        clientName: clientName(clients, placement.clientId ?? PERSONAL_ID),
        start: placement.start,
        durationMin: placement.durationMin,
      }))
      const written = await applyPlan(items)
      const failed = new Set(written.results.filter((row) => row.error).map((row) => row.taskId))
      onApply(
        items
          .filter((item) => !failed.has(item.taskId))
          .map((item) => ({
            taskId: item.taskId,
            focus: { start: item.start, durationMin: item.durationMin },
          })),
      )
      if (failed.size) {
        setError(`${failed.size} block${failed.size === 1 ? '' : 's'} could not be written to Google Calendar.`)
      } else {
        setResult(null)
        onClose()
      }
    } catch (caught) {
      setError(describe((caught as Error).message))
    } finally {
      setBusy(null)
    }
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Placement[]>()
    for (const placement of result?.placements ?? []) {
      const key = new Date(placement.start).toLocaleDateString('en-CA')
      map.set(key, [...(map.get(key) ?? []), placement])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [result])

  return (
    <section className="planner auto-schedule">
      <header className="planner-head">
        <h2>Fill the calendar</h2>
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
      </header>

      <p className="muted">
        Packing order: SEO sprints (4h) first each day, then monthly reports (1.5h), then audits
        and other work in the leftovers. Calendar meetings stay where they are. Each day keeps a
        1.5-hour buffer for unfocused work by default.
      </p>

      <h3 className="setup-label">How long each kind of task takes</h3>
      <div className="duration-groups">
        {groups.map((group) => {
          const durations = [...group.durations]
          const mixed = durations.length > 1
          const value = mixed ? 0 : durations[0]
          return (
            <div key={group.title} className="duration-row">
              <span className="duration-title">{group.title}</span>
              <span className="muted duration-count">
                {group.tasks.length} task{group.tasks.length === 1 ? '' : 's'}
              </span>
              <select
                className="focus-input duration-select"
                value={value}
                onChange={(event) => setGroupDuration(group.title, Number(event.target.value))}
              >
                {mixed && <option value={0}>mixed</option>}
                {DURATION_CHOICES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDuration(minutes)}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      <div className="planner-actions">
        <label className="field cap-field">
          <span>Horizon</span>
          <select
            className="focus-input"
            value={horizonDays}
            onChange={(event) => setHorizonDays(Number(event.target.value))}
          >
            <option value={7}>next 7 days</option>
            <option value={14}>next 14 days</option>
            <option value={30}>next 30 days</option>
            <option value={200}>full backlog</option>
          </select>
        </label>
        <label className="field cap-field">
          <span>Cap per day</span>
          <select
            className="focus-input"
            value={cap}
            onChange={(event) => setCap(Number(event.target.value))}
          >
            <option value={0}>default (leave 1.5h free)</option>
            {[3, 4, 5, 6, 8, 10].map((hours) => (
              <option key={hours} value={hours}>
                {hours} hours hard cap
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="add-btn" onClick={plan} disabled={busy !== null || !candidates.length}>
          {busy === 'planning' ? 'Working out the schedule…' : `Schedule ${candidates.length} tasks`}
        </button>
        <span className="muted">
          {formatDuration(totalMinutes)} of work
          {missingDuration > 0 && ` · ${missingDuration} using the default hour`}
        </span>
      </div>

      {error && <p className="planner-error">{error}</p>}

      {result && (
        <div className="planner-result">
          <div className="autofill-summary">
            <strong>{result.placements.length}</strong> blocks across{' '}
            <strong>{byDay.length}</strong> days, fitted around{' '}
            <strong>{result.busyWindowsConsidered}</strong> existing calendar commitments.
            {result.skipped.length > 0 && ` ${result.skipped.length} could not be placed.`}
          </div>

          <div className="autofill-days">
            {byDay.map(([day, placements]) => (
              <div key={day} className="autofill-day">
                <h4>
                  {new Date(`${day}T12:00`).toLocaleDateString(undefined, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'short',
                  })}
                  <span className="muted">
                    {' '}
                    {formatDuration(placements.reduce((sum, p) => sum + p.durationMin, 0))}
                  </span>
                </h4>
                <ul>
                  {placements.map((placement) => (
                    <li key={placement.taskId}>
                      <span className="autofill-time">
                        {new Date(placement.start).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="autofill-title">
                        {placement.title}
                        <em className="muted"> · {clientName(clients, placement.clientId ?? PERSONAL_ID)}</em>
                      </span>
                      <span className="autofill-len muted">{formatDuration(placement.durationMin)}</span>
                      {placement.placement !== 'on-due-date' && (
                        <span className={`autofill-tag ${placement.placement}`} title={placement.note}>
                          {PLACEMENT_LABEL[placement.placement]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {result.skipped.length > 0 && (
            <div className="planner-left-out">
              <h3>Could not place</h3>
              <ul>
                {result.skipped.map((item) => (
                  <li key={item.taskId}>
                    <strong>{item.title}</strong> — {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="planner-actions">
            {confirmApply ? (
              <>
                <p className="planner-confirm">
                  Write {result.placements.length} events to Google Calendar? They can only be
                  undone from Calendar.
                </p>
                <button type="button" className="add-btn" onClick={apply} disabled={busy !== null}>
                  {busy === 'applying'
                    ? 'Writing to Google Calendar…'
                    : `Write ${result.placements.length} events`}
                </button>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => setConfirmApply(false)}
                  disabled={busy !== null}
                >
                  Back
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="add-btn"
                  onClick={apply}
                  disabled={busy !== null || result.placements.length === 0}
                >
                  {busy === 'applying'
                    ? 'Writing to Google Calendar…'
                    : `Put ${result.placements.length} blocks on the calendar`}
                </button>
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => {
                    setResult(null)
                    setConfirmApply(false)
                  }}
                >
                  Discard
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function describe(message: string): string {
  if (message === 'agent-offline') return 'The focus agent is not running.'
  if (message === 'google-auth-needed') return 'Sign in with Google first.'
  return message
}
