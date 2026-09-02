export const PERSONAL_ID = 'personal'

export type Client = {
  id: string
  name: string
  color: string
}

export type Task = {
  id: string
  title: string
  clientId: string
  dueDate: string | null
  done: boolean
  notes?: string
  createdAt: number
  updatedAt?: number
}

export type ViewMode = 'table' | 'kanban' | 'calendar' | 'list'

export type Prefs = {
  lastClientId: string
  hideCompleted: boolean
  viewMode: ViewMode
  defaultsVersion: number
  updatedAt?: number
}

export type DeletedTask = {
  id: string
  deletedAt: number
}

export type InboxState = {
  clients: Client[]
  tasks: Task[]
  deletedTaskIds: DeletedTask[]
  prefs: Prefs
}

export type Filter = 'all' | 'today' | 'overdue' | 'personal' | string

export const CLIENT_COLORS = [
  '#7c9cff',
  '#5eead4',
  '#f5c563',
  '#f472b6',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#38bdf8',
  '#fb7185',
  '#c084fc',
] as const
