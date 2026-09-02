import { DUE_GROUP_LABELS, DUE_GROUP_ORDER, dueGroup, type DueGroup } from './dates'
import { sortTasks } from './taskUtils'
import type { Task } from './types'

export type TaskDueGroup = {
  group: DueGroup
  label: string
  items: Task[]
}

export function groupOpenTasksByDue(tasks: Task[], today: string): TaskDueGroup[] {
  const open = tasks.filter((task) => !task.done)

  return DUE_GROUP_ORDER.map((group) => ({
    group,
    label: DUE_GROUP_LABELS[group],
    items: open.filter((task) => dueGroup(task.dueDate, today) === group).sort(sortTasks),
  })).filter((section) => section.items.length > 0)
}
