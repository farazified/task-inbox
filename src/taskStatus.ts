import type { Task } from './types'

export type TaskStatus = 'open' | 'overdue' | 'done'

export function taskStatus(task: Task, today: string): TaskStatus {
  if (task.done) return 'done'
  if (task.dueDate && task.dueDate < today) return 'overdue'
  return 'open'
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Open',
  overdue: 'Overdue',
  done: 'Done',
}
