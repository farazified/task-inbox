import { useCallback, useEffect, useState } from 'react'
import { fetchCalendars, saveSettings } from './focusAgent'
import type { AgentSettings, CalendarSummary, GoogleError } from './focusAgent'
import { doOAuth, getAuthError, getSession, redirectUri, signOut } from './googleAuth'
import { CLIENT_ID } from './focusConfig'

type Props = {
  settings: AgentSettings | null
  agentOnline: boolean
  aiEnabled: boolean
  extension?: { lastSeen: string | null; connected: boolean }
  onSettingsChange: (patch: Partial<AgentSettings>) => void
}

function List({
  label,
  hint,
  value,
  onCommit,
}: {
  label: string
  hint: string
  value: string[]
  onCommit: (next: string[]) => void
}) {
  const [text, setText] = useState(value.join('\n'))
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!dirty) setText(value.join('\n'))
  }, [value, dirty])

  return (
    <label className="field settings-field">
      <span>{label}</span>
      <textarea
        className="focus-input settings-textarea"
        rows={6}
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setDirty(true)
        }}
        onBlur={() => {
          setDirty(false)
          onCommit(
            text
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
          )
        }}
      />
      <small className="muted">{hint}</small>
    </label>
  )
}

export function SettingsView({
  settings,
  agentOnline,
  aiEnabled,
  extension,
  onSettingsChange,
}: Props) {
  const [calendars, setCalendars] = useState<CalendarSummary[]>([])
  const [account, setAccount] = useState<string | null>(null)
  const [calAuth, setCalAuth] = useState<'ok' | 'needed' | 'unconfigured' | 'loading'>('loading')
  const [googleError, setGoogleError] = useState<GoogleError | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const session = getSession()
  const authError = getAuthError()

  function copy(value: string, label: string) {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(label)
        setTimeout(() => setCopied(null), 1500)
      })
      .catch(() => undefined)
  }

  const loadCalendars = useCallback(async () => {
    try {
      const result = await fetchCalendars()
      setCalAuth(result.auth)
      setAccount(result.account)
      setCalendars(result.calendars)
      setGoogleError(result.googleError ?? null)
    } catch (caught) {
      const message = (caught as Error).message
      setCalAuth(message === 'google-auth-needed' ? 'needed' : 'loading')
      if (message !== 'google-auth-needed' && message !== 'agent-offline') setError(message)
    }
  }, [])

  useEffect(() => {
    void loadCalendars()
  }, [loadCalendars, session?.token])

  async function persist(patch: Partial<AgentSettings> & { aiApiKey?: string }) {
    setError(null)
    try {
      const saved = await saveSettings(patch)
      onSettingsChange({
        ...patch,
        aiProvider: saved.aiProvider,
        aiKeySet: saved.aiKeySet,
        aiKeyHint: saved.aiKeyHint,
      })
    } catch (caught) {
      setError(describe((caught as Error).message))
    }
  }

  if (!agentOnline || !settings) {
    return (
      <section className="settings">
        <p className="planner-note">
          The focus agent is not running, so there is nothing to configure yet. Start it with{' '}
          <code>npm start</code> in <code>agent/</code>.
        </p>
      </section>
    )
  }

  const target = settings.targetCalendarId || 'primary'
  const busySources = settings.calendarIds?.length ? settings.calendarIds : [target]
  const writable = calendars.filter((calendar) => calendar.canWrite)

  function chooseTarget(id: string) {
    // 'primary' and the account's own address are the same calendar; keeping both
    // would query it twice and show every event twice.
    const aliases = new Set([id, id === account ? 'primary' : '', account && id === 'primary' ? account : ''])
    const nextSources = busySources.some((source) => aliases.has(source))
      ? busySources
      : [...busySources, id]
    void persist({ targetCalendarId: id, calendarIds: nextSources })
  }

  function toggleBusy(id: string) {
    if (id === target) return
    void persist({
      calendarIds: busySources.includes(id)
        ? busySources.filter((item) => item !== id)
        : [...busySources, id],
    })
  }

  return (
    <section className="settings">
      {error && <p className="planner-error">{error}</p>}

      <div className="insight-card">
        <h3>Google account</h3>
        {session ? (
          <>
            <p className="muted">
              Signed in{session.email ? ` as ${session.email}` : account ? ` as ${account}` : ''}. The
              token lives in this browser session only and is never written to disk.
            </p>
            <div className="planner-actions">
              <button type="button" className="ghost-btn" onClick={() => signOut()}>
                Sign out
              </button>
              <button type="button" className="text-btn" onClick={() => doOAuth()}>
                Switch account
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">
              Sign in with the Google account whose calendar you want to use. Focus blocks are
              written there, and free slots are read from it.
            </p>
            <button type="button" className="add-btn google-btn" onClick={() => doOAuth()}>
              Sign in with Google →
            </button>
            {authError && <p className="planner-error">Google returned “{authError}”.</p>}
          </>
        )}

        {googleError && <p className="planner-error">{explainGoogle(googleError)}</p>}

        <details className="oauth-details">
          <summary>Sign-in not working? Register these in Google Cloud Console</summary>
          <p className="muted">
            Google only accepts a sign-in whose redirect URI is registered on the OAuth client,
            character for character. Open the client below under APIs &amp; Services →
            Credentials, and add this app's address to both <strong>Authorized JavaScript
            origins</strong> and <strong>Authorized redirect URIs</strong>.
          </p>
          <div className="oauth-field">
            <span className="oauth-label">Authorized JavaScript origin</span>
            <code>{location.origin}</code>
            <button type="button" className="text-btn" onClick={() => copy(location.origin, 'origin')}>
              {copied === 'origin' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="oauth-field">
            <span className="oauth-label">Authorized redirect URI</span>
            <code>{redirectUri()}</code>
            <button type="button" className="text-btn" onClick={() => copy(redirectUri(), 'redirect')}>
              {copied === 'redirect' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="oauth-field">
            <span className="oauth-label">OAuth client ID</span>
            <code className="oauth-clientid">{CLIENT_ID}</code>
            <button type="button" className="text-btn" onClick={() => copy(CLIENT_ID, 'client')}>
              {copied === 'client' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="muted">
            The client also needs the Google Calendar API enabled and the two calendar scopes
            listed on its consent screen. To use a different client instead, change CLIENT_ID in
            app/src/focusConfig.ts.
          </p>
          <p className="muted">
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
            >
              Open Google Cloud credentials →
            </a>
          </p>
        </details>
      </div>

      {session && (
        <div className="insight-card">
          <h3>Calendars</h3>
          {calAuth === 'loading' && <p className="muted">Loading calendars…</p>}
          {calAuth === 'ok' && (
            <>
              <h4 className="setup-label">Put focus blocks on</h4>
              <div className="calendar-list">
                {writable.map((calendar) => (
                  <label
                    key={calendar.id}
                    className={`calendar-row ${target === calendar.id ? 'on' : ''}`}
                  >
                    <input
                      type="radio"
                      name="target-calendar"
                      checked={target === calendar.id}
                      onChange={() => chooseTarget(calendar.id)}
                    />
                    <span
                      className="calendar-dot"
                      style={{ background: calendar.color ?? '#7c9cff' }}
                    />
                    <span className="calendar-name">{calendar.name}</span>
                    {calendar.primary && <span className="muted">default</span>}
                  </label>
                ))}
                {writable.length === 0 && (
                  <p className="muted">This account has no calendar you can write to.</p>
                )}
              </div>

              <h4 className="setup-label">Count as busy when finding free slots</h4>
              <div className="calendar-list">
                {calendars.map((calendar) => (
                  <label key={calendar.id} className="calendar-row">
                    <input
                      type="checkbox"
                      checked={busySources.includes(calendar.id)}
                      disabled={calendar.id === target}
                      onChange={() => toggleBusy(calendar.id)}
                    />
                    <span
                      className="calendar-dot"
                      style={{ background: calendar.color ?? '#7c9cff' }}
                    />
                    <span className="calendar-name">{calendar.name}</span>
                    {calendar.id === target && <span className="muted">always</span>}
                    {!calendar.canWrite && <span className="muted">read only</span>}
                  </label>
                ))}
              </div>
              <p className="muted">
                Blocks already on another calendar stay where they are. Only new ones move.
              </p>
            </>
          )}
        </div>
      )}

      <div className="insight-card">
        <h3>Chrome extension</h3>
        {extension?.connected ? (
          <p className="muted">
            Connected and reporting in. Website blocking is armed whenever a focus block is
            running.
          </p>
        ) : (
          <>
            <p className="planner-note">
              Not installed, or not reporting. Website blocking will not work until it is.
              Blocked apps and reminders are unaffected.
            </p>
            <ol className="install-steps">
              <li>
                Open <code>chrome://extensions</code> in Chrome and turn on{' '}
                <strong>Developer mode</strong>, top right.
              </li>
              <li>
                Click <strong>Load unpacked</strong>.
              </li>
              <li>
                Choose the folder <code>extension</code> (next to <code>app/</code> in
                this project), not a folder inside the app.
              </li>
            </ol>
            <p className="muted">
              This panel turns green on its own within a minute of the extension starting.
            </p>
          </>
        )}
      </div>

      <div className="insight-card">
        <h3>Blocking</h3>
        <div className="settings-grid">
          <List
            label="Websites"
            hint="One domain per line. Blocked for the whole focus block — no early exit in the browser."
            value={settings.blockedSites}
            onCommit={(blockedSites) => persist({ blockedSites })}
          />
          <List
            label="macOS apps"
            hint="Exact app names, one per line, e.g. Slack."
            value={settings.blockedApps}
            onCommit={(blockedApps) => persist({ blockedApps })}
          />
        </div>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={settings.hostsBlocking}
            onChange={(event) => persist({ hostsBlocking: event.target.checked })}
          />
          <span>
            Block sites system-wide, not just in Chrome
            <small className="muted">
              Needs the helper from install.sh. Chrome’s “Use secure DNS” bypasses it, so turn that
              off.
            </small>
          </span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={settings.strictChrome}
            onChange={(event) => persist({ strictChrome: event.target.checked })}
          />
          <span>
            Quit Chrome if the extension stops reporting during a block
            <small className="muted">Closes the loophole of disabling the extension mid-session.</small>
          </span>
        </label>
      </div>

      <div className="insight-card">
        <h3>Schedule</h3>
        <div className="focus-row">
          <label className="field">
            <span>Active hours start</span>
            <input
              type="time"
              className="focus-input"
              value={settings.workingHours.start}
              onChange={(event) =>
                persist({ workingHours: { ...settings.workingHours, start: event.target.value } })
              }
            />
          </label>
          <label className="field">
            <span>end</span>
            <input
              type="time"
              className="focus-input"
              value={settings.workingHours.end === '24:00' ? '00:00' : settings.workingHours.end}
              onChange={(event) =>
                persist({
                  workingHours: {
                    ...settings.workingHours,
                    end: event.target.value === '00:00' ? '24:00' : event.target.value,
                  },
                })
              }
            />
          </label>
          <label className="field">
            <span>Plan-tomorrow nudge</span>
            <input
              type="time"
              className="focus-input"
              value={settings.eveningPlanTime}
              onChange={(event) => persist({ eveningPlanTime: event.target.value })}
            />
          </label>
        </div>
        <label className="field settings-field">
          <span>Remind me this many minutes before a block</span>
          <input
            type="text"
            className="focus-input"
            defaultValue={settings.reminderOffsetsMin.join(', ')}
            onBlur={(event) => {
              const offsets = event.target.value
                .split(',')
                .map((part) => Number(part.trim()))
                .filter((value) => Number.isFinite(value) && value >= 0)
              if (offsets.length) persist({ reminderOffsetsMin: offsets })
            }}
          />
          <small className="muted">Comma separated. 0 means at the moment it starts.</small>
        </label>
      </div>

      <div className="insight-card">
        <h3>Pomodoro</h3>
        <div className="focus-row">
          <label className="field">
            <span>Work minutes</span>
            <input
              type="number"
              min={5}
              max={120}
              className="focus-input"
              value={settings.pomodoroWorkMin}
              onChange={(event) => persist({ pomodoroWorkMin: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>Break minutes</span>
            <input
              type="number"
              min={1}
              max={60}
              className="focus-input"
              value={settings.pomodoroBreakMin}
              onChange={(event) => persist({ pomodoroBreakMin: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>Gap between suggested slots</span>
            <input
              type="number"
              min={0}
              max={60}
              className="focus-input"
              value={settings.slotBufferMin}
              onChange={(event) => persist({ slotBufferMin: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>Daily free buffer (min)</span>
            <input
              type="number"
              min={0}
              max={480}
              step={15}
              className="focus-input"
              value={settings.dailyBufferMin ?? 90}
              onChange={(event) => persist({ dailyBufferMin: Number(event.target.value) })}
            />
          </label>
        </div>
        <p className="muted">
          Auto-schedule leaves this many minutes free each day for unfocused or random work, so
          client blocks do not fill the whole active window. Default is 90 minutes (1.5 hours).
        </p>
      </div>

      <div className="insight-card">
        <h3>Smart features</h3>
        <p className="muted">
          Pick a provider and paste an API key. Keys stay on this machine (the local agent) and are
          never synced to GitHub. Groq has a free tier at console.groq.com.
        </p>
        <div className="settings-grid">
          <label className="field settings-field">
            <span>Provider</span>
            <select
              className="focus-input"
              value={settings.aiProvider ?? 'off'}
              onChange={(event) => {
                const aiProvider = event.target.value as
                  | 'off'
                  | 'groq'
                  | 'anthropic'
                  | 'openai'
                void persist({ aiProvider })
              }}
            >
              <option value="off">Off</option>
              <option value="groq">Groq (free)</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
          </label>
          <label className="field settings-field">
            <span>API key</span>
            <input
              type="password"
              className="focus-input"
              autoComplete="off"
              disabled={(settings.aiProvider ?? 'off') === 'off'}
              placeholder={
                settings.aiKeySet
                  ? `Saved ${settings.aiKeyHint ?? ''} — paste to replace`
                  : (settings.aiProvider ?? 'off') === 'groq'
                    ? 'gsk_… from console.groq.com'
                    : (settings.aiProvider ?? 'off') === 'anthropic'
                      ? 'sk-ant-…'
                      : (settings.aiProvider ?? 'off') === 'openai'
                        ? 'sk-…'
                        : 'Select a provider first'
              }
              defaultValue=""
              key={`${settings.aiProvider}-${settings.aiKeyHint ?? 'none'}`}
              onBlur={(event) => {
                const value = event.target.value.trim()
                if (!value) return
                void persist({ aiApiKey: value })
                event.target.value = ''
              }}
            />
            <small className="muted">
              {aiEnabled
                ? `Connected via ${(settings.aiProvider ?? 'groq')}. Capture, Plan, and Insights are on.`
                : (settings.aiProvider ?? 'off') === 'off'
                  ? 'Smart features are off.'
                  : 'Provider selected — paste a key to turn smart features on.'}
            </small>
          </label>
        </div>
        {(settings.aiProvider ?? 'off') !== 'off' && settings.aiKeySet && (
          <button
            type="button"
            className="text-btn"
            onClick={() => void persist({ aiApiKey: '' })}
          >
            Clear saved key
          </button>
        )}
      </div>
    </section>
  )
}

/** Turns Google's machine reason into the one sentence that says what to change. */
function explainGoogle(error: GoogleError): string {
  const reason = error.reason.toLowerCase()
  if (reason.includes('scope')) {
    return 'Signed in, but this token has no calendar permission. Add the two calendar scopes to the OAuth consent screen, then sign out and back in.'
  }
  if (reason.includes('accessnotconfigured') || reason.includes('serviceusage')) {
    return 'The Google Calendar API is not enabled on that Cloud project. Enable it, wait a minute, then reload.'
  }
  if (reason.includes('permission') || reason.includes('forbidden')) {
    return `Google refused the request: ${error.reason}. Check that this account can see the calendar you picked.`
  }
  return `Google returned ${error.status}: ${error.reason}`
}

function describe(message: string): string {
  if (message === 'agent-offline') return 'The focus agent is not running.'
  if (message === 'google-auth-needed') return 'Sign in with Google first.'
  return message
}
