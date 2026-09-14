import { useEffect, useState } from 'react'
import { fetchCalendar } from './focusAgent'
import type { CalendarEvent } from './focusAgent'

type Props = {
  days?: number
  signedIn: boolean
}

type Group = { date: string; events: CalendarEvent[] }

/**
 * Meetings already on Google Calendar, shown alongside the tasks so the day reads as
 * one list. They are deliberately read-only: nothing here can change your calendar.
 */
export function MeetingsStrip({ days = 7, signedIn }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [collapsed, setCollapsed] = useState(true)

  useEffect(() => {
    if (!signedIn) {
      setGroups([])
      return
    }
    let cancelled = false

    const load = () => {
      const from = new Date()
      const to = new Date(from.getTime() + days * 86_400_000)
      fetchCalendar(from, to)
        .then((result) => {
          if (cancelled) return
          const meetings = result.events
            .filter((event) => !event.focus)
            .filter((event) => Date.parse(event.end) > Date.now())
            .sort((a, b) => a.start.localeCompare(b.start))
          const map = new Map<string, CalendarEvent[]>()
          for (const event of meetings) {
            const key = new Date(event.start).toLocaleDateString('en-CA')
            map.set(key, [...(map.get(key) ?? []), event])
          }
          setGroups([...map.entries()].map(([date, events]) => ({ date, events })))
        })
        .catch(() => {
          if (!cancelled) setGroups([])
        })
    }

    load()
    const poll = window.setInterval(load, 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [days, signedIn])

  if (!signedIn || groups.length === 0) return null
  const total = groups.reduce((sum, group) => sum + group.events.length, 0)

  return (
    <section className="meetings-strip">
      <header>
        <h3>
          From your calendar
          <span className="muted">
            {' '}
            {total} meeting{total === 1 ? '' : 's'} in the next {days} days
          </span>
        </h3>
        <button type="button" className="text-btn" onClick={() => setCollapsed((prev) => !prev)}>
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </header>
      {!collapsed && (
        <div className="meetings-days">
          {groups.map((group) => (
            <div key={group.date} className="meetings-day">
              <span className="meetings-date">
                {new Date(`${group.date}T12:00`).toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
              <ul>
                {group.events.map((event) => (
                  <li key={event.eventId}>
                    <span className="meeting-time">
                      {event.allDay
                        ? 'all day'
                        : new Date(event.start).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                    </span>
                    <span className="meeting-title">{event.title}</span>
                    <span className="meeting-tag">meeting</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
