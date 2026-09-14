import { useEffect, useState } from 'react'
import { fetchInsights, saveSettings, summarizeInsights } from './focusAgent'
import type { InsightsData, InsightsSummary } from './focusAgent'
import { formatDuration } from './focusTime'
import { PERSONAL_ID, type Client } from './types'

type Props = {
  clients: Client[]
  aiEnabled: boolean
  blockedSites: string[]
  onSettingsChange: (blockedSites: string[]) => void
}

function clientName(clients: Client[], clientId: string): string {
  if (clientId === PERSONAL_ID || clientId === '') return 'Personal'
  return clients.find((client) => client.id === clientId)?.name ?? clientId
}

export function InsightsView({ clients, aiEnabled, blockedSites, onSettingsChange }: Props) {
  const [range, setRange] = useState(7)
  const [data, setData] = useState<InsightsData | null>(null)
  const [summary, setSummary] = useState<InsightsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchInsights(range)
      .then((result) => {
        if (!cancelled) {
          setData(result)
          setError(null)
        }
      })
      .catch((caught) => {
        if (!cancelled) setError(describe((caught as Error).message))
      })
    return () => {
      cancelled = true
    }
  }, [range])

  async function addBlock(domain: string) {
    const next = [...blockedSites, domain]
    try {
      await saveSettings({ blockedSites: next })
      onSettingsChange(next)
      setData((prev) =>
        prev ? { ...prev, proposedBlocks: prev.proposedBlocks.filter((item) => item !== domain) } : prev,
      )
    } catch (caught) {
      setError(describe((caught as Error).message))
    }
  }

  async function loadSummary() {
    setBusy(true)
    setError(null)
    try {
      const result = await summarizeInsights(range)
      setSummary(result.summary)
    } catch (caught) {
      setError(describe((caught as Error).message))
    } finally {
      setBusy(false)
    }
  }

  const maxMinutes = Math.max(1, ...(data?.perDay.map((row) => row.minutes) ?? [1]))

  return (
    <section className="insights">
      <header className="insights-head">
        <div className="insights-range">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              className={`view-tab ${range === days ? 'on' : ''}`}
              onClick={() => setRange(days)}
            >
              {days}d
            </button>
          ))}
        </div>
      </header>

      {error && <p className="planner-error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}

      {data && (
        <>
          <div className="insight-tiles">
            <div className="insight-tile">
              <span className="insight-label">Focus time</span>
              <strong>{formatDuration(data.totalFocusMin)}</strong>
            </div>
            <div className="insight-tile">
              <span className="insight-label">Blocks run</span>
              <strong>{data.totalSessions}</strong>
            </div>
            <div className="insight-tile">
              <span className="insight-label">Completed</span>
              <strong>
                {data.totalSessions
                  ? `${Math.round((data.completedSessions / data.totalSessions) * 100)}%`
                  : '—'}
              </strong>
            </div>
          </div>

          <div className="insight-card">
            <h3>Focus per day</h3>
            {data.perDay.length === 0 ? (
              <p className="muted">No focus blocks recorded yet.</p>
            ) : (
              <div className="bar-chart">
                {data.perDay.map((row) => (
                  <div key={row.date} className="bar-col">
                    <div
                      className="bar"
                      style={{ height: `${(row.minutes / maxMinutes) * 100}%` }}
                      title={`${row.minutes} min`}
                    />
                    <span className="bar-label">
                      {new Date(`${row.date}T00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="insight-card">
            <h3>By client</h3>
            {data.perClient.length === 0 ? (
              <p className="muted">Nothing yet.</p>
            ) : (
              <ul className="insight-list">
                {data.perClient.map((row) => (
                  <li key={row.clientId}>
                    <span>{clientName(clients, row.clientId)}</span>
                    <span>{formatDuration(row.minutes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="insight-card">
            <h3>Blocked attempts</h3>
            {data.topAttempts.length === 0 ? (
              <p className="muted">No distraction attempts logged.</p>
            ) : (
              <ul className="insight-list">
                {data.topAttempts.map((row) => (
                  <li key={`${row.kind}:${row.target}`}>
                    <span>
                      {row.target} <em className="muted">{row.kind}</em>
                    </span>
                    <span>{row.count}×</span>
                  </li>
                ))}
              </ul>
            )}
            {data.proposedBlocks.length > 0 && (
              <div className="insight-proposals">
                <h4>Worth blocking</h4>
                {data.proposedBlocks.map((domain) => (
                  <button key={domain} type="button" className="slot-chip" onClick={() => addBlock(domain)}>
                    Block {domain}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="insight-card">
            <h3>What the week says</h3>
            {!aiEnabled ? (
              <p className="muted">Add an Anthropic API key to the agent to get a written read-out.</p>
            ) : (
              <>
                <button type="button" className="add-btn" onClick={loadSummary} disabled={busy}>
                  {busy ? 'Reading…' : summary ? 'Refresh' : 'Summarize'}
                </button>
                {summary && (
                  <div className="summary">
                    <p className="summary-headline">{summary.headline}</p>
                    <ul>
                      {summary.observations.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <h4>Try next week</h4>
                    <ol>
                      {summary.suggestions.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  )
}

function describe(message: string): string {
  if (message === 'agent-offline') return 'The focus agent is not running.'
  if (message === 'google-auth-needed') return 'Connect Google Calendar first.'
  return message
}
