import type { CSSProperties } from 'react'
import { formatDueDate, todayISO } from './dates'
import { ClientPicker } from './ClientPicker'
import { DuePicker } from './DuePicker'
import { StatusPicker } from './StatusPicker'
import { STATUS_LABELS, taskStatus } from './taskStatus'
import { clientLabel, sortTasks } from './taskUtils'
import type { TaskViewProps } from './taskViewTypes'

export function TaskTable({
  tasks,
  clients,
  hideCompleted,
  emptyTitle = 'Nothing in the inbox.',
  onToggle,
  onStatusChange,
  onOpen,
  onClientChange,
  onDueChange,
}: TaskViewProps) {
  const today = todayISO()
  const open = tasks.filter((task) => !task.done).sort(sortTasks)
  const done = hideCompleted ? [] : tasks.filter((task) => task.done).sort((a, b) => b.createdAt - a.createdAt)
  const rows = [...open, ...done]

  if (rows.length === 0) {
    return (
      <div className="empty">
        <p>{emptyTitle}</p>
        <span>Type above and tap Add.</span>
      </div>
    )
  }

  return (
    <div className="view-shell table-view">
      <div className="table-wrap">
        <table className="task-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Client</th>
              <th>Status</th>
              <th>Due date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
              const client = clientLabel(task.clientId, clients)
              const status = taskStatus(task, today)
              const rowStyle = { '--row-accent': client.color } as CSSProperties

              return (
                <tr
                  key={task.id}
                  className={`task-row status-row-${status} ${task.done ? 'is-done' : ''}`}
                  style={rowStyle}
                >
                  <td>
                    <button type="button" className="table-task" onClick={() => onOpen(task.id)}>
                      <span className="row-accent" aria-hidden />
                      {task.title}
                    </button>
                  </td>
                  <td className="cell-edit" onClick={(event) => event.stopPropagation()}>
                    {onClientChange ? (
                      <ClientPicker
                        compact
                        value={task.clientId}
                        clients={clients}
                        onChange={(next) => onClientChange(task.id, next)}
                      />
                    ) : (
                      <span className="client-pill">
                        <span className="dot" style={{ background: client.color }} />
                        {client.name}
                      </span>
                    )}
                  </td>
                  <td className="cell-status" onClick={(event) => event.stopPropagation()}>
                    {onStatusChange ? (
                      <StatusPicker
                        task={task}
                        today={today}
                        onChange={(nextDone) => onStatusChange(task.id, nextDone)}
                      />
                    ) : (
                      <button type="button" className="status-pill" onClick={() => onToggle(task.id)}>
                        {STATUS_LABELS[status]}
                      </button>
                    )}
                  </td>
                  <td
                    className={`cell-edit cell-due ${status === 'overdue' ? 'is-overdue' : ''}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {onDueChange ? (
                      <DuePicker
                        mode="date"
                        value={task.dueDate}
                        onChange={(next) => onDueChange(task.id, next)}
                      />
                    ) : (
                      formatDueDate(task.dueDate, today)
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
