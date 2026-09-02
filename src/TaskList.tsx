import { PERSONAL_ID, type Client, type Task } from './types'
import { formatDue, todayISO } from './dates'
import { groupOpenTasksByDue } from './taskGroups'
import { TrashIcon } from './TrashIcon'

type Props = {
  tasks: Task[]
  clients: Client[]
  hideCompleted: boolean
  emptyTitle?: string
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onDelete?: (id: string) => void
}

export function TaskList({
  tasks,
  clients,
  hideCompleted,
  emptyTitle = 'Nothing in the inbox.',
  onToggle,
  onOpen,
  onDelete,
}: Props) {
  const today = todayISO()
  const open = tasks.filter((task) => !task.done)
  const done = tasks.filter((task) => task.done)
  const groups = groupOpenTasksByDue(tasks, today)

  if (open.length === 0 && (hideCompleted || done.length === 0)) {
    return (
      <div className="empty">
        <p>{emptyTitle}</p>
        <span>Tap Quick add to create a task.</span>
      </div>
    )
  }

  return (
    <div className="list">
      {groups.map((group) => (
        <section key={group.group} className="group">
          <div className="group-head">
            <h2 className={`group-title ${group.group}`}>{group.label}</h2>
            <span className="group-count">{group.items.length}</span>
          </div>
          <ul>
            {group.items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                clients={clients}
                today={today}
                onToggle={onToggle}
                onOpen={onOpen}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}

      {!hideCompleted && done.length > 0 && (
        <section className="group done-group">
          <div className="group-head">
            <h2 className="group-title">Done</h2>
            <span className="group-count">{done.length}</span>
          </div>
          <ul>
            {done
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  clients={clients}
                  today={today}
                  onToggle={onToggle}
                  onOpen={onOpen}
                  onDelete={onDelete}
                />
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function TaskRow({
  task,
  clients,
  today,
  onToggle,
  onOpen,
  onDelete,
}: {
  task: Task
  clients: Client[]
  today: string
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onDelete?: (id: string) => void
}) {
  const client =
    task.clientId === PERSONAL_ID
      ? null
      : clients.find((item) => item.id === task.clientId)
  const label = client?.name ?? 'Personal'
  const overdue = Boolean(task.dueDate && task.dueDate < today && !task.done)

  return (
    <li className={`task ${task.done ? 'is-done' : ''}`}>
      <button
        type="button"
        className="check"
        aria-label={task.done ? 'Mark open' : 'Mark done'}
        onClick={() => onToggle(task.id)}
      >
        <span className="check-mark" />
      </button>
      <button type="button" className="task-body" onClick={() => onOpen(task.id)}>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          <span className="dot" style={{ background: client?.color ?? '#a78bfa' }} />
          {label}
          {task.dueDate && (
            <>
              <span className="sep">·</span>
              <span className={overdue ? 'overdue-text' : ''}>
                {formatDue(task.dueDate, today)}
              </span>
            </>
          )}
        </span>
        {task.notes && <span className="task-notes">{task.notes}</span>}
      </button>
      {onDelete && (
        <button
          type="button"
          className="icon-btn danger row-delete"
          aria-label={`Delete ${task.title}`}
          title="Delete permanently"
          onClick={() => onDelete(task.id)}
        >
          <TrashIcon />
        </button>
      )}
    </li>
  )
}
