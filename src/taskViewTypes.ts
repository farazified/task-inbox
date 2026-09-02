import type { DueGroup } from './dates'
import type { Client, Task, TaskProgress } from './types'

export type TaskViewProps = {
  tasks: Task[]
  clients: Client[]
  hideCompleted: boolean
  emptyTitle?: string
  onToggle: (id: string) => void
  onStatusChange?: (taskId: string, progress: TaskProgress) => void
  onOpen: (id: string) => void
  onClientChange?: (taskId: string, clientId: string) => void
  onDueChange?: (taskId: string, dueDate: string | null) => void
  onMoveToGroup?: (taskId: string, group: DueGroup | 'done') => void
  onDelete?: (taskId: string) => void
}
