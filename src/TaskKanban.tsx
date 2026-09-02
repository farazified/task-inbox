import { dueBucket, todayISO, type DueBucket } from './dates'
import type { Client, Task } from './types'
import { clientLabel, sortTasks } from './taskUtils'
import type { TaskViewProps } from './taskViewTypes'

const COLUMNS: { id: DueBucket | 'done'; label: string; className?: string }[] = [
  { id: 'overdue', label: 'Overdue', className: 'overdue-col' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'nodate', label: 'No date' },
  { id: 'done', label: 'Done' },
]

export function TaskKanban({
  tasks,
  clients,
  hideCompleted,
  emptyTitle = 'Nothing in the inbox.',
  onToggle,
  onOpen,
}: TaskViewProps) {
  const today = todayISO()
  const columns = COLUMNS.filter((column) => column.id !== 'done' || !hideCompleted)

  const grouped = columns.map((column) => ({
    ...column,
    items:
      column.id === 'done'
        ? tasks.filter((task) => task.done).sort((a, b) => b.createdAt - a.createdAt)
        : tasks
            .filter((task) => !task.done && dueBucket(task.dueDate, today) === column.id)
            .sort(sortTasks),
  }))

  if (tasks.length === 0 || grouped.every((column) => column.items.length === 0)) {
    return (
      <div className="empty">
        <p>{emptyTitle}</p>
        <span>Type below and tap Add. That’s it.</span>
      </div>
    )
  }

  return (
    <div className="view-shell kanban-view">
      <div className="kanban-board">
        {grouped.map((column) => (
          <section key={column.id} className={`kanban-col ${column.className ?? ''}`}>
            <header className="kanban-head">
              <h2>{column.label}</h2>
              <span>{column.items.length}</span>
            </header>
            <ul>
              {column.items.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  clients={clients}
                  onToggle={onToggle}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function KanbanCard({
  task,
  clients,
  onToggle,
  onOpen,
}: {
  task: Task
  clients: Client[]
  onToggle: (id: string) => void
  onOpen: (id: string) => void
}) {
  const client = clientLabel(task.clientId, clients)

  return (
    <li className={`kanban-card ${task.done ? 'is-done' : ''}`}>
      <button type="button" className="kanban-check" aria-label="Toggle done" onClick={() => onToggle(task.id)}>
        <span className="check-mark" />
      </button>
      <button type="button" className="kanban-body" onClick={() => onOpen(task.id)}>
        <span className="kanban-title">{task.title}</span>
        <span className="kanban-meta">
          <span className="dot" style={{ background: client.color }} />
          {client.name}
        </span>
      </button>
    </li>
  )
}