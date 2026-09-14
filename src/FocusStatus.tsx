import { useEffect, useState } from 'react'
import { resetPomodoro } from './focusAgent'
import type { AgentState, AgentStatus } from './focusAgent'
import { countdown, formatDayClock } from './focusTime'

type Props = {
  status: AgentStatus
  state: AgentState | null
  onStateChange: (state: AgentState) => void
  onOpenSetup: () => void
}

/** Ticks the countdown locally between agent pushes so the numbers move every second. */
function useLocalTick(seconds: number | undefined): number {
  const [value, setValue] = useState(seconds ?? 0)
  useEffect(() => {
    setValue(seconds ?? 0)
    if (seconds === undefined) return
    const timer = setInterval(() => setValue((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(timer)
  }, [seconds])
  return value
}

export function FocusStatus({ status, state, onStateChange, onOpenSetup }: Props) {
  const session = state?.session ?? null
  const sessionLeft = useLocalTick(session?.secondsLeft)
  const pomoLeft = useLocalTick(state?.pomodoro.secondsLeft)

  if (status === 'offline') {
    return (
      <button
        type="button"
        className="focus-pill offline"
        onClick={onOpenSetup}
        title="Start the agent: npm start in agent/"
      >
        Agent offline
      </button>
    )
  }

  const needsGoogle = state?.auth === 'needed' || status === 'auth-needed'
  const unconfigured = state?.auth === 'unconfigured'
  const warning = needsGoogle ? (
    <button key="warn" type="button" className="focus-pill warn" onClick={onOpenSetup}>
      Connect Google
    </button>
  ) : unconfigured ? (
    <button
      key="warn"
      className="focus-pill warn"
      type="button"
      onClick={onOpenSetup}
      title="Needs a Google OAuth client in the agent .env"
    >
      Google not configured
    </button>
  ) : session ? null : (
    <button
      key="cal"
      type="button"
      className="focus-pill subtle"
      onClick={onOpenSetup}
      title="Choose which calendar focus blocks go on"
    >
      Calendar
    </button>
  )

  if (session) {
    const phase = state?.pomodoro.phase === 'break' ? 'Break' : 'Focus'
    const blocking =
      state?.extension?.connected === true
        ? 'Social sites blocked in Chrome'
        : 'Load the Chrome extension to block social sites'
    return (
      <div className="focus-status">
        {warning}
        <span
          className={`focus-pill live ${state?.pomodoro.phase === 'break' ? 'break' : ''}`}
          role="status"
          title={`${session.title} — block ends ${formatDayClock(session.end)}. ${blocking}. The only way out is Google Calendar.`}
        >
          <strong>
            {phase} {countdown(pomoLeft)}
          </strong>
          <span className="focus-pill-sub">
            {session.title} · {countdown(sessionLeft)} left
          </span>
        </span>
        <span
          className={`focus-pill ${state?.extension?.connected ? 'blocking-on' : 'warn'}`}
          title={blocking}
        >
          {state?.extension?.connected ? 'Sites blocked' : 'Extension needed'}
        </span>
        <button
          type="button"
          className="text-btn"
          title="Restart this pomodoro cycle. The focus block itself keeps running."
          onClick={() => {
            resetPomodoro().then(onStateChange).catch(() => undefined)
          }}
        >
          Reset cycle
        </button>
      </div>
    )
  }

  const next = state?.upcoming[0]
  return (
    <div className="focus-status">
      {warning}
      {next ? (
        <span className="focus-pill" title={next.title}>
          Next: {next.title} · {formatDayClock(next.start)}
        </span>
      ) : (
        <span className="focus-pill idle">No focus block scheduled</span>
      )}
    </div>
  )
}
