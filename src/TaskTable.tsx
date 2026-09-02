import { type CSSProperties } from 'react'
import { formatDueDate, todayISO } from './dates'
import { ClientPicker } from './ClientPicker'
import { DuePicker } from './DuePicker'
import { StatusPicker } from './StatusPicker'
import { STATUS_LABELS, taskStatus } from './taskStatus'
import { groupOpenTasksByDue } from './taskGroups'
import { clientLabel } from './taskUtils'
import { TrashIcon } from './TrashIcon'
import type { Task } from './types'
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
  onDelete,
}: TaskViewProps) {
  const today = todayISO()
  const groups = groupOpenTasksByDue(tasks, today)
  const done = hideCompleted ? [] : tasks.filter((task) => task.done).sort((a, b) => b.createdAt - a.createdAt)
  const sections: { id: string; groupClass: string; label: string; items: Task[] }[] = [
    ...groups.map((group) => ({
      id: group.group,
      groupClass: group.group,
      label: group.label,
      items: group.items,
    })),
    ...(done.length > 0
      ? [{ id: 'done', groupClass: 'done', label: 'Done', items: done }]
      : []),
  ]

  if (sections.length === 0) {
    return (
      <div className="empty">
        <p>{emptyTitle}</p>
        <span>Tap Quick add to create a task.</span>
      </div>
    )
  }

  return (
    <div className="view-shell table-view">
      <div className="table-sections">
        {sections.map((section) => (
          <section
            key={section.id}
            className={`table-section section-${section.groupClass}`}
          >
            <header className="table-section-head">
              <h2 className={`group-title ${section.groupClass}`}>{section.label}</h2>
              <span className="group-count">{section.items.length}</span>
            </header>
            <div className="table-wrap">
              <table className="task-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Client</th>
                    <th>Status</th>
                    <th>Due date</th>
                    {onDelete && <th className="col-actions"> </th>}
                  </tr>
                </thead>
                <tbody>
                  {section.items.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      clients={clients}
                      today={today}
                      onToggle={onToggle}
                      onStatusChange={onStatusChange}
                      onOpen={onOpen}
                      onClientChange={onClientChange}
                      onDueChange={onDueChange}
                      onDelete={onDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function TaskRow({
  task,
  clients,
  today,
  onToggle,
  onStatusChange,
  onOpen,
  onClientChange,
  onDueChange,
  onDelete,
}: {
  task: TaskViewProps['tasks'][number]
  clients: TaskViewProps['clients']
  today: string
  onToggle: TaskViewProps['onToggle']
  onStatusChange?: TaskViewProps['onStatusChange']
  onOpen: TaskViewProps['onOpen']
  onClientChange?: TaskViewProps['onClientChange']
  onDueChange?: TaskViewProps['onDueChange']
  onDelete?: TaskViewProps['onDelete']
}) {
  const client = clientLabel(task.clientId, clients)
  const status = taskStatus(task, today)
  const rowStyle = { '--row-accent': client.color } as CSSProperties

  return (
    <tr
      className={`task-row status-row-${status} ${task.done ? 'is-done' : ''}`}
      style={rowStyle}
    >
      <td>
        <button type="button" className="table-task" onClick={() => onOpen(task.id)}>
          <span className="row-accent" aria-hidden />
          <span className="table-task-copy">
            <span className="table-task-title">{task.title}</span>
            {task.notes && <span className="table-task-notes">{task.notes}</span>}
          </span>
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
            <span className="client-name" style={{ color: client.color }}>
              {client.name}
            </span>
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
            compact
            value={task.dueDate}
            onChange={(next) => onDueChange(task.id, next)}
          />
        ) : (
          formatDueDate(task.dueDate, today)
        )}
      </td>
      {onDelete && (
        <td className="cell-actions" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            className="icon-btn danger row-delete"
            aria-label={`Delete ${task.title}`}
            title="Delete permanently"
            onClick={() => onDelete(task.id)}
          >
            <TrashIcon />
          </button>
        </td>
      )}
    </tr>
  )
}
