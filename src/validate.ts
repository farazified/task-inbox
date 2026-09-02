const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const MAX_TASK_TITLE = 500
export const MAX_CLIENT_NAME = 80
export const MAX_TASK_NOTES = 2000

export function trimNotes(notes: string): string {
  return notes.trim().slice(0, MAX_TASK_NOTES)
}

export function trimTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').slice(0, MAX_TASK_TITLE)
}

export function trimClientName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_CLIENT_NAME)
}

export function isValidDueDate(value: string | null | undefined): value is string {
  if (!value) return false
  if (!ISO_DATE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(y, (m ?? 1) - 1, d ?? 1)
  return (
    date.getFullYear() === y &&
    date.getMonth() === (m ?? 1) - 1 &&
    date.getDate() === (d ?? 1)
  )
}

export function parseDueDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return isValidDueDate(trimmed) ? trimmed : null
}

export function clientNameError(
  name: string,
  clients: { id: string; name: string }[],
  ignoreId?: string,
): string | null {
  const trimmed = trimClientName(name)
  if (!trimmed) return 'Name cannot be empty.'
  if (trimmed.length < 2) return 'Name is too short.'
  const key = trimmed.toLowerCase()
  if (key === 'personal') return 'Personal is reserved.'
  const duplicate = clients.find(
    (client) =>
      client.id !== ignoreId && client.name.trim().toLowerCase() === key,
  )
  if (duplicate) return 'A client with this name already exists.'
  return null
}

export function taskTitleError(title: string): string | null {
  const trimmed = trimTitle(title)
  if (!trimmed) return 'Task cannot be empty.'
  return null
}
