import { PERSONAL_ID, type Client, type Task } from './types'
import { dueBucket, formatDue, todayISO, type DueBucket } from './dates'

type Props = {
  tasks: Task[]
  clients: Client[]
  hideCompleted: boolean
  emptyTitle?: string
  onToggle: (id: string) => void
  onOpen: (id: string) => void
}

const LABELS: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  upcoming: 'Upcoming',
  nodate: 'No date',
}

const ORDER: DueBucket[] = ['overdue', 'today', 'upcoming', 'nodate']

export function TaskList({
  tasks,
  clients,
  hideCompleted,
  emptyTitle = 'Nothing in the inbox.',
  onToggle,
  onOpen,
}: Props) {
  const today = todayISO()
  const open = tasks.filter((task) => !task.done)
  const done = tasks.filter((task) => task.done)

  const groups = ORDER.map((bucket) => ({
    bucket,
    items: open
      .filter((task) => dueBucket(task.dueDate, today) === bucket)
      .sort(sortOpen),
  })).filter((group) => group.items.length > 0)

  if (open.length === 0 && (hideCompleted || done.length === 0)) {
    return (
      <div className="empty">
        <p>{emptyTitle}</p>
        <span>Type below and tap Add. That’s it.</span>
      </div>
    )
  }

  return (
    <div className="list">
      {groups.map((group) => (
        <section key={group.bucket} className="group">
          <h2 className={`group-title ${group.bucket}`}>{LABELS[group.bucket]}</h2>
          <ul>
            {group.items.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                clients={clients}
                today={today}
                onToggle={onToggle}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </section>
      ))}

      {!hideCompleted && done.length > 0 && (
        <section className="group done-group">
          <h2 className="group-title">Done</h2>
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
}: {
  task: Task
  clients: Client[]
  today: string
  onToggle: (id: string) => void
  onOpen: (id: string) => void
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
      </button>
    </li>
  )
}

function sortOpen(a: Task, b: Task): number {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate)
  }
  if (a.dueDate && !b.dueDate) return -1
  if (!a.dueDate && b.dueDate) return 1
  return b.createdAt - a.createdAt
}
