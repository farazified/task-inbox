import {
  buildDefaultClients,
  clientNameKey,
  DEFAULTS_VERSION,
  DEFAULT_CLIENTS,
} from './defaults'
import { parseDueDate, trimClientName, trimNotes, trimTitle } from './validate'
import { normalizeProgress } from './taskStatus'
import {
  CLIENT_COLORS,
  PERSONAL_ID,
  type Client,
  type DeletedTask,
  type InboxState,
  type Task,
  type ViewMode,
} from './types'

const KEY = 'task-inbox:v1'
const VIEW_MODES = new Set<ViewMode>(['table', 'kanban', 'calendar', 'list'])

function defaultViewMode(): ViewMode {
  if (typeof window !== 'undefined' && window.innerWidth < 768) return 'list'
  return 'table'
}

function emptyState(): InboxState {
  return normalizeState({
    clients: buildDefaultClients(),
    tasks: [],
    deletedTaskIds: [],
    prefs: {
      lastClientId: PERSONAL_ID,
      hideCompleted: false,
      viewMode: defaultViewMode(),
      defaultsVersion: DEFAULTS_VERSION,
    },
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseClients(raw: unknown): Client[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const clients: Client[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    if (typeof item.id !== 'string' || typeof item.name !== 'string') continue
    const id = item.id.trim()
    const name = trimClientName(item.name)
    if (!id || !name || seen.has(id)) continue
    seen.add(id)
    clients.push({
      id,
      name,
      color: typeof item.color === 'string' ? item.color : CLIENT_COLORS[clients.length % CLIENT_COLORS.length],
    })
  }
  return clients
}

function parseTasks(raw: unknown, clientIds: Set<string>): Task[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const tasks: Task[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    if (typeof item.id !== 'string' || typeof item.title !== 'string') continue
    const id = item.id.trim()
    const title = trimTitle(item.title)
    if (!id || !title || seen.has(id)) continue
    seen.add(id)
    const clientId =
      typeof item.clientId === 'string' && clientIds.has(item.clientId)
        ? item.clientId
        : PERSONAL_ID
    const createdAt =
      typeof item.createdAt === 'number' && Number.isFinite(item.createdAt)
        ? item.createdAt
        : Date.now()
    const updatedAt =
      typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
        ? item.updatedAt
        : createdAt
    const notes =
      typeof item.notes === 'string' ? trimNotes(item.notes) : ''
    const done = Boolean(item.done)
    const progress = normalizeProgress(item.progress, done)
    tasks.push({
      id,
      title,
      clientId,
      dueDate: parseDueDate(item.dueDate),
      done: progress === 'done',
      progress,
      ...(notes ? { notes } : {}),
      createdAt,
      updatedAt,
    })
  }
  return tasks
}

function mergeDefaultClients(clients: Client[]): Client[] {
  const byId = new Map(clients.map((client) => [client.id, client]))
  const byName = new Map(clients.map((client) => [clientNameKey(client.name), client]))
  const merged = [...clients]

  for (const seed of DEFAULT_CLIENTS) {
    if (byId.has(seed.id)) continue
    if (byName.has(clientNameKey(seed.name))) continue
    const color = CLIENT_COLORS[merged.length % CLIENT_COLORS.length]
    const client = { id: seed.id, name: seed.name, color }
    merged.push(client)
    byId.set(client.id, client)
    byName.set(clientNameKey(client.name), client)
  }

  return merged
}

function parseDeletedTaskIds(raw: unknown): DeletedTask[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const deleted: DeletedTask[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    if (typeof item.id !== 'string' || !item.id.trim()) continue
    const id = item.id.trim()
    if (seen.has(id)) continue
    const deletedAt =
      typeof item.deletedAt === 'number' && Number.isFinite(item.deletedAt)
        ? item.deletedAt
        : Date.now()
    seen.add(id)
    deleted.push({ id, deletedAt })
  }
  return deleted
}

const TOMBSTONE_TTL_MS = 1000 * 60 * 60 * 24 * 90

export function normalizeState(state: InboxState): InboxState {
  let clients = parseClients(state.clients)
  const defaultsVersion =
    typeof state.prefs.defaultsVersion === 'number' ? state.prefs.defaultsVersion : 0

  if (clients.length === 0 || defaultsVersion < DEFAULTS_VERSION) {
    clients = mergeDefaultClients(clients)
  }

  const clientIds = new Set([PERSONAL_ID, ...clients.map((client) => client.id)])
  const cutoff = Date.now() - TOMBSTONE_TTL_MS
  const deletedTaskIds = parseDeletedTaskIds(state.deletedTaskIds).filter(
    (item) => item.deletedAt >= cutoff,
  )
  const deletedAt = new Map(deletedTaskIds.map((item) => [item.id, item.deletedAt]))
  const tasks = parseTasks(state.tasks, clientIds).filter((task) => {
    const removedAt = deletedAt.get(task.id)
    if (removedAt == null) return true
    return (task.updatedAt ?? task.createdAt) > removedAt
  })
  const activeIds = new Set(tasks.map((task) => task.id))
  const prunedDeletes = deletedTaskIds.filter((item) => !activeIds.has(item.id))

  const prefs = state.prefs
  const lastClientId =
    typeof prefs.lastClientId === 'string' && clientIds.has(prefs.lastClientId)
      ? prefs.lastClientId
      : PERSONAL_ID

  return {
    clients,
    tasks,
    deletedTaskIds: prunedDeletes,
    prefs: {
      lastClientId,
      hideCompleted: Boolean(prefs.hideCompleted),
      viewMode:
        typeof prefs.viewMode === 'string' && VIEW_MODES.has(prefs.viewMode)
          ? prefs.viewMode
          : defaultViewMode(),
      defaultsVersion: DEFAULTS_VERSION,
      updatedAt:
        typeof prefs.updatedAt === 'number' && Number.isFinite(prefs.updatedAt)
          ? prefs.updatedAt
          : undefined,
    },
  }
}

function parseState(raw: unknown): InboxState {
  if (!isRecord(raw)) return emptyState()
  const clients = parseClients(raw.clients)
  const clientIds = new Set([PERSONAL_ID, ...clients.map((client) => client.id)])
  const tasks = parseTasks(raw.tasks, clientIds)
  const prefs = isRecord(raw.prefs) ? raw.prefs : {}
  return normalizeState({
    clients,
    tasks,
    deletedTaskIds: parseDeletedTaskIds(raw.deletedTaskIds),
    prefs: {
      lastClientId:
        typeof prefs.lastClientId === 'string' ? prefs.lastClientId : PERSONAL_ID,
      hideCompleted: Boolean(prefs.hideCompleted),
      viewMode:
        typeof prefs.viewMode === 'string' && VIEW_MODES.has(prefs.viewMode as ViewMode)
          ? (prefs.viewMode as ViewMode)
          : defaultViewMode(),
      defaultsVersion:
        typeof prefs.defaultsVersion === 'number' ? prefs.defaultsVersion : 0,
      updatedAt:
        typeof prefs.updatedAt === 'number' && Number.isFinite(prefs.updatedAt)
          ? prefs.updatedAt
          : undefined,
    },
  })
}

export function loadState(): InboxState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    return parseState(JSON.parse(raw) as unknown)
  } catch {
    return emptyState()
  }
}

export function saveState(state: InboxState): void {
  try {
    const normalized = normalizeState(state)
    localStorage.setItem(KEY, JSON.stringify(normalized))
  } catch (error) {
    console.error('Failed to save task inbox', error)
  }
}

export function nextColor(used: string[]): string {
  const taken = new Set(used)
  const fresh = CLIENT_COLORS.find((color) => !taken.has(color))
  return fresh ?? CLIENT_COLORS[used.length % CLIENT_COLORS.length]
}

export function nid(): string {
  return crypto.randomUUID()
}
