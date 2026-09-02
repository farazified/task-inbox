import { useMemo, useState } from 'react'
import {
  calendarCells,
  monthLabel,
  monthStart,
  shiftMonthISO,
  todayISO,
  weekdayLabels,
} from './dates'
import type { Task } from './types'
import { clientLabel } from './taskUtils'
import type { TaskViewProps } from './taskViewTypes'

export function TaskCalendar({
  tasks,
  clients,
  hideCompleted,
  emptyTitle = 'Nothing in the inbox.',
  onOpen,
}: TaskViewProps) {
  const today = todayISO()
  const [month, setMonth] = useState(monthStart(today))
  const cells = useMemo(() => calendarCells(month), [month])
  const weekdays = weekdayLabels()

  const visible = tasks.filter((task) => !task.done || !hideCompleted)
  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const task of visible) {
      if (!task.dueDate) continue
      const list = map.get(task.dueDate) ?? []
      list.push(task)
      map.set(task.dueDate, list)
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.title.localeCompare(b.title))
    }
    return map
  }, [visible])

  const unscheduled = visible.filter((task) => !task.dueDate)

  if (visible.length === 0) {
    return (
      <div className="empty">
        <p>{emptyTitle}</p>
        <span>Type below and tap Add. That’s it.</span>
      </div>
    )
  }

  return (
    <div className="view-shell calendar-view">
      <div className="calendar-toolbar">
        <button type="button" className="ghost-btn" onClick={() => setMonth(shiftMonthISO(month, -1))}>
          ‹
        </button>
        <h2>{monthLabel(month)}</h2>
        <button type="button" className="ghost-btn" onClick={() => setMonth(shiftMonthISO(month, 1))}>
          ›
        </button>
        <button type="button" className="text-btn" onClick={() => setMonth(monthStart(today))}>
          Today
        </button>
      </div>

      <div className="calendar-grid">
        {weekdays.map((label) => (
          <div key={label} className="calendar-weekday">
            {label}
          </div>
        ))}
        {cells.map(({ iso, inMonth }) => {
          const dayTasks = byDate.get(iso) ?? []
          return (
            <div
              key={iso}
              className={`calendar-cell ${inMonth ? '' : 'muted'} ${iso === today ? 'today' : ''}`}
            >
              <span className="calendar-day">{Number(iso.slice(-2))}</span>
              <ul>
                {dayTasks.slice(0, 3).map((task) => {
                  const client = clientLabel(task.clientId, clients)
                  return (
                    <li key={task.id}>
                      <button
                        type="button"
                        className={`calendar-task ${task.done ? 'is-done' : ''}`}
                        onClick={() => onOpen(task.id)}
                      >
                        <span className="dot" style={{ background: client.color }} />
                        {task.title}
                      </button>
                    </li>
                  )
                })}
                {dayTasks.length > 3 && <li className="calendar-more">+{dayTasks.length - 3} more</li>}
              </ul>
            </div>
          )
        })}
      </div>

      {unscheduled.length > 0 && (
        <section className="calendar-unscheduled">
          <h3>No due date</h3>
          <ul>
            {unscheduled.map((task) => {
              const client = clientLabel(task.clientId, clients)
              return (
                <li key={task.id}>
                  <button type="button" className="calendar-task" onClick={() => onOpen(task.id)}>
                    <span className="dot" style={{ background: client.color }} />
                    {task.title}
                    <span className="calendar-client">{client.name}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
