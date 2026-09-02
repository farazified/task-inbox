import { normalizeState } from './storage'
import type { InboxState } from './types'

export const GITHUB_REPO = 'farazified/task-inbox'
export const INBOX_DATA_PATH = 'public/data/inbox.json'
export const RAW_INBOX_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${INBOX_DATA_PATH}`
const BUNDLED_DATA_URL = `${import.meta.env.BASE_URL}data/inbox.json`
const ENV_TOKEN = (import.meta.env.VITE_GITHUB_TOKEN as string | undefined)?.trim() || ''
const TOKEN_KEY = 'task-inbox:gh-token'

export type CloudStatus = 'off' | 'loading' | 'syncing' | 'synced' | 'offline' | 'error'

export function getGitHubToken(): string | null {
  if (ENV_TOKEN) return ENV_TOKEN
  try {
    return localStorage.getItem(TOKEN_KEY)?.trim() || null
  } catch {
    return null
  }
}

export function setGitHubToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token.trim())
}

export function isCloudEnabled(): boolean {
  return Boolean(getGitHubToken())
}

function withUpdatedAt(state: InboxState): InboxState {
  return {
    ...state,
    prefs: { ...state.prefs, updatedAt: Date.now() },
  }
}

export function mergeStates(local: InboxState, remote: InboxState): InboxState {
  const clientMap = new Map<string, InboxState['clients'][number]>()
  for (const client of remote.clients) clientMap.set(client.id, client)
  for (const client of local.clients) clientMap.set(client.id, client)

  const deletedMap = new Map<string, number>()
  for (const item of [...remote.deletedTaskIds, ...local.deletedTaskIds]) {
    const prev = deletedMap.get(item.id) ?? 0
    if (item.deletedAt >= prev) deletedMap.set(item.id, item.deletedAt)
  }

  const taskMap = new Map<string, InboxState['tasks'][number]>()
  for (const task of remote.tasks) taskMap.set(task.id, task)
  for (const task of local.tasks) {
    const existing = taskMap.get(task.id)
    if (!existing) {
      taskMap.set(task.id, task)
      continue
    }
    taskMap.set(task.id, preferTask(existing, task))
  }

  for (const [id, deletedAt] of deletedMap) {
    const task = taskMap.get(id)
    if (!task) continue
    if ((task.updatedAt ?? task.createdAt) <= deletedAt) {
      taskMap.delete(id)
    } else {
      deletedMap.delete(id)
    }
  }

  const localAt = local.prefs.updatedAt ?? 0
  const remoteAt = remote.prefs.updatedAt ?? 0
  const prefs = remoteAt > localAt ? remote.prefs : local.prefs

  return normalizeState({
    clients: [...clientMap.values()],
    tasks: [...taskMap.values()],
    deletedTaskIds: [...deletedMap.entries()].map(([id, deletedAt]) => ({ id, deletedAt })),
    prefs: {
      ...prefs,
      updatedAt: Math.max(localAt, remoteAt, Date.now()),
    },
  })
}

function taskStamp(task: InboxState['tasks'][number]): number {
  return task.updatedAt ?? task.createdAt ?? 0
}

function preferTask(
  a: InboxState['tasks'][number],
  b: InboxState['tasks'][number],
): InboxState['tasks'][number] {
  return taskStamp(b) >= taskStamp(a) ? b : a
}

export function statesDiffer(local: InboxState, merged: InboxState): boolean {
  if (local.tasks.length !== merged.tasks.length) return true
  if (local.clients.length !== merged.clients.length) return true
  if (local.deletedTaskIds.length !== merged.deletedTaskIds.length) return true

  const localTasks = new Map(local.tasks.map((task) => [task.id, task]))
  for (const task of merged.tasks) {
    const current = localTasks.get(task.id)
    if (!current) return true
    if (
      current.title !== task.title ||
      current.clientId !== task.clientId ||
      current.dueDate !== task.dueDate ||
      current.done !== task.done ||
      (current.notes ?? '') !== (task.notes ?? '') ||
      taskStamp(current) !== taskStamp(task)
    ) {
      return true
    }
  }

  const localDeletes = new Map(local.deletedTaskIds.map((item) => [item.id, item.deletedAt]))
  for (const item of merged.deletedTaskIds) {
    if (localDeletes.get(item.id) !== item.deletedAt) return true
  }

  const localClients = new Map(local.clients.map((client) => [client.id, client]))
  for (const client of merged.clients) {
    const current = localClients.get(client.id)
    if (!current) return true
    if (current.name !== client.name || current.color !== client.color) return true
  }

  return false
}

export async function fetchCloudState(): Promise<InboxState | null> {
  for (const base of [RAW_INBOX_URL, BUNDLED_DATA_URL]) {
    try {
      const res = await fetch(`${base}?t=${Date.now()}`, { cache: 'no-store' })
      if (res.status === 404) continue
      if (!res.ok) throw new Error(`fetch failed (${res.status})`)
      const data = (await res.json()) as unknown
      if (!data || typeof data !== 'object') continue
      return normalizeState(data as InboxState)
    } catch {
      /* try next source */
    }
  }
  return null
}

type GitHubContent = {
  sha: string
  content: string
}

async function readRemoteMeta(token: string): Promise<GitHubContent | null> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/${INBOX_DATA_PATH}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  )
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`read meta failed (${res.status})`)
  const data = (await res.json()) as GitHubContent
  return data
}

export async function pushCloudState(state: InboxState): Promise<boolean> {
  const token = getGitHubToken()
  if (!token) return false

  const payload = withUpdatedAt(normalizeState(state))
  const body = JSON.stringify(payload, null, 2) + '\n'
  const encoded = btoa(unescape(encodeURIComponent(body)))

  try {
    const existing = await readRemoteMeta(token)
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${INBOX_DATA_PATH}`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          message: 'Update task inbox data',
          content: encoded,
          sha: existing?.sha,
        }),
      },
    )
    return res.ok
  } catch {
    return false
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null
let pending: InboxState | null = null
let pushing = false

export function scheduleCloudPush(state: InboxState, onStatus: (status: CloudStatus) => void): void {
  if (!isCloudEnabled()) return
  pending = state
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(async () => {
    pushTimer = null
    if (!pending || pushing) return
    const next = pending
    pending = null
    pushing = true
    onStatus('syncing')
    const ok = await pushCloudState(next)
    onStatus(ok ? 'synced' : navigator.onLine ? 'error' : 'offline')
    pushing = false
    if (pending) scheduleCloudPush(pending, onStatus)
  }, 800)
}

export async function syncWithCloud(
  local: InboxState,
  onStatus: (status: CloudStatus) => void,
): Promise<{ state: InboxState; changed: boolean }> {
  onStatus('loading')
  const remote = await fetchCloudState()

  if (!remote) {
    if (isCloudEnabled() && local.tasks.length > 0) {
      onStatus('syncing')
      const pushed = await pushCloudState(local)
      onStatus(pushed ? 'synced' : navigator.onLine ? 'error' : 'offline')
    } else {
      onStatus(isCloudEnabled() ? 'synced' : 'off')
    }
    return { state: local, changed: false }
  }

  const merged = mergeStates(local, remote)
  const changed = statesDiffer(local, merged)

  if (isCloudEnabled() && changed) {
    onStatus('syncing')
    const pushed = await pushCloudState(merged)
    onStatus(pushed ? 'synced' : navigator.onLine ? 'error' : 'offline')
  } else {
    onStatus(isCloudEnabled() ? 'synced' : 'off')
  }

  return { state: merged, changed }
}
