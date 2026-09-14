import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchCalendar } from './focusAgent'
import type { CalendarEvent, PomodoroInfo, SessionInfo } from './focusAgent'
import { countdown, formatClock, formatDuration } from './focusTime'
import { PERSONAL_ID, type Client, type Task, type TaskFocus } from './types'

const HOUR_HEIGHT = 56
const SNAP_MIN = 15
const MIN_DURATION = 15

type Props = {
  tasks: Task[]
  clients: Client[]
  session: SessionInfo | null
  pomodoro: PomodoroInfo
  workingHours: { start: string; end: string }
  ghosts?: Array<{ taskId: string; start: string; durationMin: number }>
  onFocusChange: (taskId: string, focus: TaskFocus | null) => void
  onOpen: (taskId: string) => void
}

type DragState =
  | { kind: 'move'; taskId: string; grabOffsetMin: number; durationMin: number }
  | { kind: 'resize'; taskId: string; start: string }
  | { kind: 'new'; taskId: string; durationMin: number }

function startOfDay(date: Date): Date {
  const out = new Date(date)
  out.setHours(0, 0, 0, 0)
  return out
}

function hourOf(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return (hours || 0) + (minutes || 0) / 60
}

/** Midnight as an end time is 24:00, not 00:00. */
function hourOfEnd(hhmm: string): number {
  const value = hourOf(hhmm)
  return value === 0 || value >= 24 ? 24 : value
}

function formatHourLabel(hhmm: string, asEnd = false): string {
  const hoursTotal = asEnd ? hourOfEnd(hhmm) : hourOf(hhmm)
  const minutes = hoursTotal >= 24 ? 0 : Math.round((hoursTotal - Math.floor(hoursTotal)) * 60)
  const date = new Date()
  date.setHours(hoursTotal >= 24 ? 0 : Math.floor(hoursTotal) % 24, minutes, 0, 0)
  return date.toLocaleTimeString(undefined, minutes ? { hour: 'numeric', minute: '2-digit' } : { hour: 'numeric' })
}

function formatHourTick(hour: number): string {
  const date = new Date()
  date.setHours(hour % 24, 0, 0, 0)
  return date.toLocaleTimeString(undefined, { hour: 'numeric' })
}

function clientColor(clients: Client[], clientId: string): string {
  if (clientId === PERSONAL_ID) return '#7c9cff'
  return clients.find((client) => client.id === clientId)?.color ?? '#7c9cff'
}

function spansDay(event: { start: string; end: string }, day: Date): boolean {
  const start = new Date(event.start)
  const end = new Date(event.end)
  return start < new Date(day.getTime() + 86_400_000) && end > day
}

export function TaskTimeline({
  tasks,
  clients,
  session,
  pomodoro,
  workingHours,
  ghosts = [],
  onFocusChange,
  onOpen,
}: Props) {
  // A seven-column grid is unusable on a phone, so narrow screens start on the day view.
  const [mode, setMode] = useState<'week' | 'day'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'day' : 'week',
  )
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [calAuth, setCalAuth] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  // A press that never moves is a click, so it opens the task instead of rescheduling it.
  const dragMoved = useRef(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const gridRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  const days = useMemo(() => {
    if (mode === 'day') return [anchor]
    const monday = new Date(anchor)
    const weekday = monday.getDay()
    monday.setDate(monday.getDate() + (weekday === 0 ? -6 : 1 - weekday))
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday)
      day.setDate(monday.getDate() + index)
      return startOfDay(day)
    })
  }, [anchor, mode])

  const rangeStartMs = days[0].getTime()
  const rangeEndMs = days[days.length - 1].getTime() + 86_400_000

  useEffect(() => {
    let cancelled = false
    const load = () => {
      fetchCalendar(new Date(rangeStartMs), new Date(rangeEndMs))
        .then((result) => {
          if (!cancelled) {
            setEvents(result.events.filter((event) => !event.focus))
            setCalAuth(result.auth)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setEvents([])
            setCalAuth(null)
          }
        })
    }
    load()
    const poll = window.setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(poll)
    }
  }, [rangeStartMs, rangeEndMs])

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 15_000)
    return () => clearInterval(timer)
  }, [])

  const timedEvents = events.filter((event) => !event.allDay)
  const allDayEvents = events.filter((event) => event.allDay)

  // Karachi/US split: show the 12-hour active window (noon–midnight), not calendar midnight.
  const { dayStartHour, dayEndHour } = useMemo(() => {
    const workStart = hourOf(workingHours.start)
    const workEnd = hourOfEnd(workingHours.end)
    const startHour = Math.max(0, Math.floor(workStart))
    let endHour = Math.min(24, Math.max(startHour + 1, Math.ceil(workEnd)))

    const expandEnd = (startIso: string, endIso: string, ignoreLong: boolean) => {
      const start = Date.parse(startIso)
      const end = Date.parse(endIso)
      if (!(end > start) || start >= rangeEndMs || end <= rangeStartMs) return
      if (ignoreLong && end - start >= 6 * 60 * 60 * 1000) return
      for (const day of days) {
        const dayBegin = day.getTime()
        const dayFinish = dayBegin + 86_400_000
        const clipStart = Math.max(start, dayBegin)
        const clipEnd = Math.min(end, dayFinish)
        if (!(clipEnd > clipStart)) continue
        const clipEndHour = (clipEnd - dayBegin) / 3_600_000
        if (clipEndHour <= startHour) continue
        endHour = Math.max(endHour, Math.min(24, Math.ceil(clipEndHour)))
      }
    }
    for (const event of timedEvents) expandEnd(event.start, event.end, true)
    for (const task of tasks) {
      if (!task.focus) continue
      expandEnd(
        task.focus.start,
        new Date(Date.parse(task.focus.start) + task.focus.durationMin * 60_000).toISOString(),
        false,
      )
    }
    return { dayStartHour: startHour, dayEndHour: endHour }
  }, [timedEvents, tasks, workingHours, rangeStartMs, rangeEndMs, days])

  const hours = Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i)
  const gridHeight = hours.length * HOUR_HEIGHT

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [dayStartHour, dayEndHour, rangeStartMs, mode])

  function layoutInDay(startIso: string, endIso: string, day: Date): { top: number; height: number } | null {
    const dayBegin = day.getTime()
    const dayFinish = dayBegin + 86_400_000
    const visBegin = dayBegin + dayStartHour * 3_600_000
    const visFinish = dayBegin + dayEndHour * 3_600_000
    const start = Math.max(Date.parse(startIso), dayBegin, visBegin)
    const end = Math.min(Date.parse(endIso), dayFinish, visFinish)
    if (!(end > start)) return null
    return {
      top: ((start - visBegin) / 3_600_000) * HOUR_HEIGHT,
      height: Math.max(14, ((end - start) / 3_600_000) * HOUR_HEIGHT),
    }
  }

  /** Converts a pointer position inside a day column into a snapped Date. */
  function dateFromPointer(clientY: number, column: HTMLElement, day: Date): Date {
    const rect = column.getBoundingClientRect()
    const ratio = (clientY - rect.top) / rect.height
    const totalMinutes = dayStartHour * 60 + ratio * hours.length * 60
    const snapped = Math.round(totalMinutes / SNAP_MIN) * SNAP_MIN
    const out = new Date(day)
    out.setMinutes(Math.max(0, Math.min(24 * 60 - SNAP_MIN, snapped)))
    return out
  }

  function handleColumnPointerMove(event: React.PointerEvent<HTMLDivElement>, day: Date) {
    if (!drag) return
    dragMoved.current = true
    const target = event.currentTarget
    const point = dateFromPointer(event.clientY, target, day)
    if (drag.kind === 'resize') {
      const start = Date.parse(drag.start)
      const minutes = Math.max(MIN_DURATION, Math.round((point.getTime() - start) / 60_000 / SNAP_MIN) * SNAP_MIN)
      onFocusChange(drag.taskId, { start: drag.start, durationMin: minutes })
      return
    }
    const grab = drag.kind === 'move' ? drag.grabOffsetMin : 0
    const start = new Date(point.getTime() - grab * 60_000)
    onFocusChange(drag.taskId, { start: start.toISOString(), durationMin: drag.durationMin })
  }

  // Side effects must stay out of the state updater: React invokes updaters twice in
  // development, which would open the task on every drag.
  const endDrag = useCallback(() => {
    if (drag && !dragMoved.current && drag.kind !== 'new') onOpen(drag.taskId)
    dragMoved.current = false
    setDrag(null)
  }, [drag, onOpen])

  // A pointer released outside the grid must still end the drag.
  useEffect(() => {
    if (!drag) return
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    return () => {
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
    }
  }, [drag, endDrag])

  const unscheduled = tasks.filter((task) => !task.focus && task.progress !== 'done')
  const scheduledInView = tasks.filter((task) => {
    if (!task.focus) return false
    const start = Date.parse(task.focus.start)
    return start >= rangeStartMs && start < rangeEndMs
  })

  // Collapse repeats (SEO sprint × N) so the tray stays scannable.
  const trayGroups = useMemo(() => {
    const map = new Map<string, { title: string; tasks: Task[]; color: string }>()
    for (const task of unscheduled) {
      const key = `${task.title}::${task.clientId}`
      const entry = map.get(key) ?? {
        title: task.title,
        tasks: [],
        color: clientColor(clients, task.clientId),
      }
      entry.tasks.push(task)
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => b.tasks.length - a.tasks.length || a.title.localeCompare(b.title))
  }, [unscheduled, clients])

  function shift(days: number) {
    setAnchor((prev) => startOfDay(new Date(prev.getTime() + days * 86_400_000)))
  }

  return (
    <div className="timeline">
      <div className="timeline-bar">
        <div className="timeline-nav">
          <button type="button" className="text-btn" onClick={() => shift(mode === 'day' ? -1 : -7)}>
            ←
          </button>
          <button type="button" className="text-btn" onClick={() => setAnchor(startOfDay(new Date()))}>
            Today
          </button>
          <button type="button" className="text-btn" onClick={() => shift(mode === 'day' ? 1 : 7)}>
            →
          </button>
          <span className="timeline-range">
            {days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            {days.length > 1 &&
              ` – ${days[days.length - 1].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
            <span className="timeline-active-hours">
              {' '}
              · Active {formatHourLabel(workingHours.start)} – {formatHourLabel(workingHours.end, true)}
            </span>
          </span>
        </div>
        <div className="timeline-modes">
          <button
            type="button"
            className={`view-tab ${mode === 'day' ? 'on' : ''}`}
            onClick={() => setMode('day')}
          >
            Day
          </button>
          <button
            type="button"
            className={`view-tab ${mode === 'week' ? 'on' : ''}`}
            onClick={() => setMode('week')}
          >
            Week
          </button>
        </div>
      </div>

      <div className="timeline-body">
        <aside className="timeline-tray">
          <h3>Unscheduled</h3>
          <p className="muted tray-hint">
            {calAuth && calAuth !== 'ok'
              ? 'Connect Google in the top bar to show calendar meetings here in grey.'
              : 'Drag one onto the grid to plot it. Meetings are grey on the left; focus blocks are coloured.'}
          </p>
          {trayGroups.length === 0 && <p className="muted">Everything has a slot.</p>}
          <ul>
            {trayGroups.map((group) => {
              const task = group.tasks[0]
              return (
                <li key={`${group.title}-${task.clientId}`}>
                  <button
                    type="button"
                    className="tray-item"
                    style={{ borderLeftColor: group.color }}
                    onPointerDown={() => {
                      dragMoved.current = false
                      setDrag({ kind: 'new', taskId: task.id, durationMin: 60 })
                    }}
                    onClick={() => {
                      if (!dragMoved.current) onOpen(task.id)
                    }}
                  >
                    <span className="tray-item-title">{group.title}</span>
                    {group.tasks.length > 1 && (
                      <span className="tray-count">{group.tasks.length}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        <div className="timeline-grid" ref={gridRef}>
          {scheduledInView.length === 0 && timedEvents.length === 0 && allDayEvents.length === 0 && (
            <div className="timeline-empty" role="status">
              <strong>No focus blocks on this {mode}.</strong>
              <span>
                Meetings from Google show in grey. Drag a task from the left, or use Auto-schedule,
                to plot work here.
              </span>
            </div>
          )}
          <div className="timeline-heads">
            <div className="timeline-gutter" />
            {days.map((day) => (
              <div key={day.toISOString()} className="timeline-head">
                <span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                <strong className={day.toDateString() === new Date().toDateString() ? 'is-today' : ''}>
                  {day.getDate()}
                </strong>
              </div>
            ))}
          </div>
          {allDayEvents.some((event) => days.some((day) => spansDay(event, day))) && (
            <div className="timeline-all-day">
              <div className="timeline-gutter" />
              {days.map((day) => (
                <div key={day.toISOString()} className="timeline-all-day-col">
                  {allDayEvents
                    .filter((event) => spansDay(event, day))
                    .map((event) => (
                      <span key={event.eventId} className="cal-all-day" title={event.title}>
                        {event.title}
                      </span>
                    ))}
                </div>
              ))}
            </div>
          )}

          <div className="timeline-scroll" ref={scrollRef}>
            <div className="timeline-gutter" style={{ height: gridHeight }}>
              {hours.map((hour) => (
                <div key={hour} className="timeline-hour-label" style={{ height: HOUR_HEIGHT }}>
                  {formatHourTick(hour)}
                </div>
              ))}
            </div>

            {days.map((day) => {
              const workTop = Math.max(
                0,
                ((hourOf(workingHours.start) - dayStartHour) / hours.length) * gridHeight,
              )
              const workHeight = Math.max(
                0,
                ((Math.min(hourOfEnd(workingHours.end), dayEndHour) -
                  Math.max(hourOf(workingHours.start), dayStartHour)) /
                  hours.length) *
                  gridHeight,
              )
              const nowAt = new Date(nowMs).toISOString()
              const nowLine = layoutInDay(nowAt, new Date(nowMs + 1000).toISOString(), day)
              return (
                <div
                  key={day.toISOString()}
                  className="timeline-col"
                  style={{ height: gridHeight }}
                  onPointerMove={(event) => handleColumnPointerMove(event, day)}
                  onPointerUp={endDrag}
                >
                  <div className="work-shade" style={{ top: workTop, height: workHeight }}>
                    {day.getTime() === days[0].getTime() && (
                      <span className="work-shade-label">Active hours</span>
                    )}
                  </div>
                  {hours.map((hour) => (
                    <div key={hour} className="timeline-slot" style={{ height: HOUR_HEIGHT }} />
                  ))}

                  {timedEvents.map((event) => {
                    const box = layoutInDay(event.start, event.end, day)
                    if (!box) return null
                    return (
                      <div
                        key={event.eventId}
                        className="cal-event"
                        style={{ top: box.top, height: box.height }}
                        title={`${event.title} · ${formatClock(event.start)}`}
                      >
                        {event.title}
                      </div>
                    )
                  })}

                  {ghosts.map((ghost) => {
                    const end = new Date(
                      Date.parse(ghost.start) + ghost.durationMin * 60_000,
                    ).toISOString()
                    const box = layoutInDay(ghost.start, end, day)
                    if (!box) return null
                    const task = tasks.find((item) => item.id === ghost.taskId)
                    return (
                      <div
                        key={`ghost-${ghost.taskId}`}
                        className="focus-block ghost"
                        style={{ top: box.top, height: box.height }}
                      >
                        <span>{task?.title ?? 'Proposed'}</span>
                      </div>
                    )
                  })}

                  {tasks.map((task) => {
                    if (!task.focus) return null
                    const end = new Date(
                      Date.parse(task.focus.start) + task.focus.durationMin * 60_000,
                    ).toISOString()
                    const box = layoutInDay(task.focus.start, end, day)
                    if (!box) return null
                    const isActive = session?.taskId === task.id
                    const color = clientColor(clients, task.clientId)
                    return (
                      <div
                        key={task.id}
                        className={`focus-block ${isActive ? 'active' : ''} ${
                          task.progress === 'done' ? 'done' : ''
                        }`}
                        style={{
                          top: box.top,
                          height: box.height,
                          borderLeftColor: color,
                          background: `${color}22`,
                        }}
                        onPointerDown={(event) => {
                          if ((event.target as HTMLElement).dataset.handle) return
                          const grabOffsetMin =
                            (event.clientY -
                              (event.currentTarget.getBoundingClientRect().top)) /
                            HOUR_HEIGHT *
                            60
                          dragMoved.current = false
                          setDrag({
                            kind: 'move',
                            taskId: task.id,
                            grabOffsetMin,
                            durationMin: task.focus!.durationMin,
                          })
                        }}
                      >
                        <span className="focus-block-title">{task.title}</span>
                        <span className="focus-block-meta">
                          {formatClock(task.focus.start)} · {formatDuration(task.focus.durationMin)}
                        </span>
                        {isActive && (
                          <span className="focus-block-live">
                            {pomodoro.phase === 'break' ? 'Break' : 'Focus'} {countdown(pomodoro.secondsLeft)}
                          </span>
                        )}
                        <span
                          className="focus-handle"
                          data-handle="resize"
                          onPointerDown={(event) => {
                            event.stopPropagation()
                            dragMoved.current = false
                            setDrag({ kind: 'resize', taskId: task.id, start: task.focus!.start })
                          }}
                        />
                      </div>
                    )
                  })}

                  {nowLine && <div className="now-line" style={{ top: nowLine.top }} />}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
