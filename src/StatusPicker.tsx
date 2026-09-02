import { STATUS_LABELS, taskStatus, type TaskStatus } from './taskStatus'
import type { Task } from './types'

type Props = {
  task: Task
  today: string
  onChange: (done: boolean) => void
}

export function StatusPicker({ task, today, onChange }: Props) {
  const status = taskStatus(task, today)

  function handleChange(next: TaskStatus) {
    onChange(next === 'done')
  }

  return (
    <select
      className={`status-select status-${status}`}
      value={status}
      onChange={(event) => handleChange(event.target.value as TaskStatus)}
      aria-label="Status"
    >
      {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((key) => (
        <option key={key} value={key} disabled={key === 'overdue' && status !== 'overdue'}>
          {STATUS_LABELS[key]}
        </option>
      ))}
    </select>
  )
}
