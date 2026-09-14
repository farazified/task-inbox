import { useState } from 'react'
import { applyPlan, requestPlan } from './focusAgent'
import type { PlanResult } from './focusAgent'
import { formatDayClock, formatDuration } from './focusTime'
import { PERSONAL_ID, type Client, type Task, type TaskFocus } from './types'

type Props = {
  tasks: Task[]
  clients: Client[]
  aiEnabled: boolean
  plan: PlanResult | null
  onPlan: (plan: PlanResult | null) => void
  onApply: (updates: Array<{ taskId: string; focus: TaskFocus }>) => void
  onClose: () => void
}

function clientName(clients: Client[], clientId: string): string {
  if (clientId === PERSONAL_ID) return 'Personal'
  return clients.find((client) => client.id === clientId)?.name ?? 'Personal'
}

export function PlannerPanel({ tasks, clients, aiEnabled, plan, onPlan, onApply, onClose }: Props) {
  const [busy, setBusy] = useState<'today' | 'tomorrow' | 'apply' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const candidates = tasks.filter((task) => task.progress !== 'done' && !task.focus)

  async function build(mode: 'today' | 'tomorrow') {
    setBusy(mode)
    setError(null)
    try {
      const payload = candidates.map((task) => ({
        id: task.id,
        title: task.title,
        clientName: clientName(clients, task.clientId),
        dueDate: task.dueDate,
        durationMin: task.focus?.durationMin ?? null,
        notes: task.notes ?? null,
        progress: task.progress,
      }))
      onPlan(await requestPlan(mode, payload))
    } catch (caught) {
      setError(describe((caught as Error).message))
      onPlan(null)
    } finally {
      setBusy(null)
    }
  }

  async function apply() {
    if (!plan) return
    setBusy('apply')
    setError(null)
    try {
      const items = plan.items
        .map((item) => {
          const task = tasks.find((candidate) => candidate.id === item.taskId)
          if (!task) return null
          return {
            taskId: task.id,
            title: task.title,
            clientId: task.clientId,
            clientName: clientName(clients, task.clientId),
            start: new Date(item.start).toISOString(),
            durationMin: item.durationMin,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
      const result = await applyPlan(items)
      const failed = result.results.filter((row) => row.error)
      onApply(
        items
          .filter((item) => !failed.some((row) => row.taskId === item.taskId))
          .map((item) => ({
            taskId: item.taskId,
            focus: { start: item.start, durationMin: item.durationMin },
          })),
      )
      if (failed.length) {
        setError(`${failed.length} block${failed.length === 1 ? '' : 's'} could not be written to Google Calendar.`)
      } else {
        onPlan(null)
        onClose()
      }
    } catch (caught) {
      setError(describe((caught as Error).message))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="planner">
      <header className="planner-head">
        <h2>Plan the day</h2>
        <button type="button" className="text-btn" onClick={onClose}>
          Close
        </button>
      </header>

      {!aiEnabled && (
        <p className="planner-note">
          The planner needs an Anthropic API key in the agent’s .env file. Everything else works without it.
        </p>
      )}

      <div className="planner-actions">
        <button
          type="button"
          className="add-btn"
          disabled={!aiEnabled || busy !== null || candidates.length === 0}
          onClick={() => build('today')}
        >
          {busy === 'today' ? 'Planning…' : 'Plan today'}
        </button>
        <button
          type="button"
          className="add-btn"
          disabled={!aiEnabled || busy !== null || candidates.length === 0}
          onClick={() => build('tomorrow')}
        >
          {busy === 'tomorrow' ? 'Planning…' : 'Plan tomorrow'}
        </button>
        <span className="muted">{candidates.length} unscheduled task{candidates.length === 1 ? '' : 's'}</span>
      </div>

      {error && <p className="planner-error">{error}</p>}

      {plan && (
        <div className="planner-result">
          <p className="planner-rationale">{plan.rationale}</p>
          <ol className="planner-list">
            {plan.items.map((item) => {
              const task = tasks.find((candidate) => candidate.id === item.taskId)
              return (
                <li key={item.taskId}>
                  <div className="planner-item-head">
                    <strong>{task?.title ?? item.taskId}</strong>
                    <span>
                      {formatDayClock(item.start)} · {formatDuration(item.durationMin)}
                    </span>
                  </div>
                  <p className="muted">{item.reason}</p>
                </li>
              )
            })}
          </ol>
          {plan.unscheduled.length > 0 && (
            <div className="planner-left-out">
              <h3>Left out</h3>
              <ul>
                {plan.unscheduled.map((item) => {
                  const task = tasks.find((candidate) => candidate.id === item.taskId)
                  return (
                    <li key={item.taskId}>
                      <strong>{task?.title ?? item.taskId}</strong> — {item.reason}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          <div className="planner-actions">
            <button type="button" className="add-btn" disabled={busy !== null} onClick={apply}>
              {busy === 'apply' ? 'Writing to calendar…' : `Apply ${plan.items.length} block${plan.items.length === 1 ? '' : 's'}`}
            </button>
            <button type="button" className="text-btn" onClick={() => onPlan(null)}>
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function describe(message: string): string {
  if (message === 'agent-offline') return 'The focus agent is not running.'
  if (message === 'google-auth-needed') return 'Connect Google Calendar first.'
  return message
}
