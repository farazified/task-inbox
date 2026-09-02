import type { Client, Task } from './types'

export type TaskViewProps = {
  tasks: Task[]
  clients: Client[]
  hideCompleted: boolean
  emptyTitle?: string
  onToggle: (id: string) => void
  onStatusChange?: (taskId: string, done: boolean) => void
  onOpen: (id: string) => void
  onClientChange?: (taskId: string, clientId: string) => void
  onDueChange?: (taskId: string, dueDate: string | null) => void
}
