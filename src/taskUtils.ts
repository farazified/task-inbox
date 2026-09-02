import { PERSONAL_ID } from './types'

export function clientLabel(
  clientId: string,
  clients: { id: string; name: string; color: string }[],
): { name: string; color: string } {
  if (clientId === PERSONAL_ID) return { name: 'Personal', color: '#a78bfa' }
  const client = clients.find((item) => item.id === clientId)
  return { name: client?.name ?? 'Personal', color: client?.color ?? '#a78bfa' }
}

export function sortTasks(a: { dueDate: string | null; createdAt: number }, b: { dueDate: string | null; createdAt: number }): number {
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate)
  }
  if (a.dueDate && !b.dueDate) return -1
  if (!a.dueDate && b.dueDate) return 1
  return b.createdAt - a.createdAt
}
