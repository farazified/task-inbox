import type { Task, TaskProgress } from './types'

/** Display status — overdue is derived from due date when not done. */
export type TaskStatus = 'open' | 'doing' | 'overdue' | 'done'

export const PROGRESS_OPTIONS: TaskProgress[] = ['open', 'doing', 'done']

export const PROGRESS_LABELS: Record<TaskProgress, string> = {
  open: 'Open',
  doing: 'In progress',
  done: 'Done',
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Open',
  doing: 'In progress',
  overdue: 'Overdue',
  done: 'Done',
}

export function normalizeProgress(
  progress: unknown,
  done: boolean,
): TaskProgress {
  if (progress === 'open' || progress === 'doing' || progress === 'done') return progress
  return done ? 'done' : 'open'
}

export function withProgress(progress: TaskProgress): Pick<Task, 'progress' | 'done'> {
  return {
    progress,
    done: progress === 'done',
  }
}

export function taskProgress(task: Task): TaskProgress {
  return normalizeProgress(task.progress, task.done)
}

export function taskStatus(task: Task, today: string): TaskStatus {
  const progress = taskProgress(task)
  if (progress === 'done') return 'done'
  if (progress === 'doing') return 'doing'
  if (task.dueDate && task.dueDate < today) return 'overdue'
  return 'open'
}
