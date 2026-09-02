import { useEffect, useState } from 'react'
import { chipVars } from './chipVars'
import { addDaysISO, formatDue, todayISO } from './dates'
import { PROGRESS_LABELS, PROGRESS_OPTIONS, taskProgress } from './taskStatus'
import { trimNotes, trimTitle } from './validate'
import { TrashIcon } from './TrashIcon'
import { PERSONAL_ID, type Client, type Task, type TaskProgress } from './types'

type Props = {
  task: Task
  clients: Client[]
  onSave: (patch: Partial<Task>) => void
  onDelete: () => void
  onClose: () => void
}

export function EditSheet({ task, clients, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes ?? '')
  const today = todayISO()
  const tomorrow = addDaysISO(1)
  const nextWeek = addDaysISO(7)
  const customDate =
    task.dueDate &&
    task.dueDate !== today &&
    task.dueDate !== tomorrow &&
    task.dueDate !== nextWeek

  useEffect(() => {
    setTitle(task.title)
    setNotes(task.notes ?? '')
  }, [task.id, task.title, task.notes])

  function commitTitle() {
    const next = trimTitle(title)
    if (!next) {
      setTitle(task.title)
      return
    }
    if (next !== task.title) onSave({ title: next })
    else setTitle(task.title)
  }

  function commitNotes() {
    const next = trimNotes(notes)
    if (next !== (task.notes ?? '')) onSave({ notes: next || undefined })
  }

  return (
    <div className="sheet-root">
      <button type="button" className="backdrop" aria-label="Close" onClick={onClose} />
      <div className="sheet" role="dialog" aria-labelledby="edit-title">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h2 id="edit-title">Edit task</h2>
          <button type="button" className="text-btn" onClick={onClose}>
            Done
          </button>
        </div>
        <input
          className="sheet-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
        />
        <p className="sheet-label">Notes / link</p>
        <textarea
          className="sheet-notes"
          value={notes}
          placeholder="GSC, Sheet, Drive link, or a short note…"
          rows={3}
          onChange={(event) => setNotes(event.target.value)}
          onBlur={commitNotes}
        />
        <p className="sheet-label">Status</p>
        <div className="chip-row wrap">
          {PROGRESS_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              className={`chip ${taskProgress(task) === value ? 'on' : ''}`}
              onClick={() => onSave({ progress: value as TaskProgress })}
            >
              {PROGRESS_LABELS[value]}
            </button>
          ))}
        </div>
        <p className="sheet-label">Client</p>
        <div className="chip-row wrap">
          <button
            type="button"
            className={`chip ${task.clientId === PERSONAL_ID ? 'on' : ''}`}
            onClick={() => onSave({ clientId: PERSONAL_ID })}
          >
            Personal
          </button>
          {clients.map((client) => (
            <button
              key={client.id}
              type="button"
              className={`chip ${task.clientId === client.id ? 'on' : ''}`}
              style={chipVars(client.color, task.clientId === client.id)}
              onClick={() => onSave({ clientId: client.id })}
            >
              <span className="dot" />
              {client.name}
            </button>
          ))}
        </div>
        <p className="sheet-label">Due</p>
        <div className="chip-row wrap">
          <button
            type="button"
            className={`chip ${task.dueDate === null ? 'on' : ''}`}
            onClick={() => onSave({ dueDate: null })}
          >
            no date
          </button>
          <button
            type="button"
            className={`chip ${task.dueDate === today ? 'on' : ''}`}
            onClick={() => onSave({ dueDate: today })}
          >
            today
          </button>
          <button
            type="button"
            className={`chip ${task.dueDate === tomorrow ? 'on' : ''}`}
            onClick={() => onSave({ dueDate: tomorrow })}
          >
            tomorrow
          </button>
          <button
            type="button"
            className={`chip ${task.dueDate === nextWeek ? 'on' : ''}`}
            onClick={() => onSave({ dueDate: nextWeek })}
          >
            next week
          </button>
          <label className={`chip date-chip ${customDate ? 'on' : ''}`}>
            {customDate && task.dueDate ? formatDue(task.dueDate, today) : 'pick date…'}
            <input
              type="date"
              value={task.dueDate ?? ''}
              onChange={(event) => onSave({ dueDate: event.target.value || null })}
            />
          </label>
        </div>
        <button type="button" className="danger-btn delete-permanent" onClick={onDelete}>
          <TrashIcon />
          Delete permanently
        </button>
      </div>
    </div>
  )
}
