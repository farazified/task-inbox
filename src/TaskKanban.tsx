import { useState } from 'react'
import {
  DUE_GROUP_LABELS,
  DUE_GROUP_ORDER,
  dueGroup,
  formatDue,
  todayISO,
  type DueGroup,
} from './dates'
import type { Client, Task } from './types'
import { clientLabel, sortTasks } from './taskUtils'
import type { TaskViewProps } from './taskViewTypes'

type ColumnId = DueGroup | 'done'

const COLUMNS: { id: ColumnId; label: string; className?: string }[] = [
  ...DUE_GROUP_ORDER.map((id) => ({
    id,
    label: DUE_GROUP_LABELS[id],
    className: id === 'overdue' ? 'overdue-col' : undefined,
  })),
  { id: 'done', label: 'Done' },
]

export function TaskKanban({
  tasks,
  clients,
  hideCompleted,
  emptyTitle = 'Nothing in the inbox.',
  onToggle,
  onOpen,
  onMoveToGroup,
}: TaskViewProps) {
  const today = todayISO()
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<ColumnId | null>(null)
  const columns = COLUMNS.filter((column) => column.id !== 'done' || !hideCompleted)

  const grouped = columns.map((column) => ({
    ...column,
    items:
      column.id === 'done'
        ? tasks.filter((task) => task.done).sort((a, b) => b.createdAt - a.createdAt)
        : tasks
            .filter((task) => !task.done && dueGroup(task.dueDate, today) === column.id)
            .sort(sortTasks),
  }))

  const visible = draggingId ? grouped : grouped.filter((column) => column.items.length > 0)

  if (tasks.length === 0 || (visible.length === 0 && !draggingId)) {
    return (
      <div className="empty">
        <p>{emptyTitle}</p>
        <span>Drag cards between columns to reschedule.</span>
      </div>
    )
  }

  function handleDrop(columnId: ColumnId) {
    if (!draggingId || !onMoveToGroup) return
    onMoveToGroup(draggingId, columnId)
    setDraggingId(null)
    setDropTarget(null)
  }

  return (
    <div className="view-shell kanban-view">
      <p className="kanban-hint">Drag a card onto a column to change its due date.</p>
      <div className="kanban-board">
        {visible.map((column) => (
          <section
            key={column.id}
            className={`kanban-col ${column.className ?? ''} ${dropTarget === column.id ? 'is-drop-target' : ''}`}
            onDragOver={(event) => {
              if (!onMoveToGroup) return
              event.preventDefault()
              setDropTarget(column.id)
            }}
            onDragLeave={() => {
              setDropTarget((current) => (current === column.id ? null : current))
            }}
            onDrop={(event) => {
              event.preventDefault()
              handleDrop(column.id)
            }}
          >
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
                  draggable={Boolean(onMoveToGroup)}
                  dragging={draggingId === task.id}
                  onToggle={onToggle}
                  onOpen={onOpen}
                  onDragStart={() => setDraggingId(task.id)}
                  onDragEnd={() => {
                    setDraggingId(null)
                    setDropTarget(null)
                  }}
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
  draggable,
  dragging,
  onToggle,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  task: Task
  clients: Client[]
  draggable: boolean
  dragging: boolean
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const client = clientLabel(task.clientId, clients)

  return (
    <li
      className={`kanban-card ${task.done ? 'is-done' : ''} ${dragging ? 'is-dragging' : ''}`}
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', task.id)
        event.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={onDragEnd}
    >
      <button type="button" className="kanban-check" aria-label="Toggle done" onClick={() => onToggle(task.id)}>
        <span className="check-mark" />
      </button>
      <button type="button" className="kanban-body" onClick={() => onOpen(task.id)}>
        <span className="kanban-title">{task.title}</span>
        <span className="kanban-meta">
          <span className="dot" style={{ background: client.color }} />
          <span className="client-name" style={{ color: client.color }}>
            {client.name}
          </span>
          {task.dueDate && (
            <>
              <span className="sep">·</span>
              {formatDue(task.dueDate, todayISO())}
            </>
          )}
        </span>
        {task.notes && <span className="kanban-notes">{task.notes}</span>}
      </button>
    </li>
  )
}
