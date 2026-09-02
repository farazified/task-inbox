import {
  PROGRESS_LABELS,
  PROGRESS_OPTIONS,
  taskProgress,
  taskStatus,
} from './taskStatus'
import type { Task, TaskProgress } from './types'

type Props = {
  task: Task
  today: string
  onChange: (progress: TaskProgress) => void
}

export function StatusPicker({ task, today, onChange }: Props) {
  const display = taskStatus(task, today)
  const progress = taskProgress(task)

  return (
    <select
      className={`status-select status-${display}`}
      value={progress}
      onChange={(event) => onChange(event.target.value as TaskProgress)}
      aria-label="Status"
    >
      {PROGRESS_OPTIONS.map((key) => (
        <option key={key} value={key}>
          {PROGRESS_LABELS[key]}
          {key === 'open' && display === 'overdue' ? ' (overdue)' : ''}
        </option>
      ))}
    </select>
  )
}
