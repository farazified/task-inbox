import { normalizeState } from './storage'
import type { InboxState } from './types'

export const GITHUB_REPO = 'farazified/task-inbox'
export const INBOX_DATA_PATH = 'public/data/inbox.json'
export const RAW_INBOX_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${INBOX_DATA_PATH}`
const BUNDLED_DATA_URL = `${import.meta.env.BASE_URL}data/inbox.json`
const TOKEN_KEY = 'task-inbox:gh-token'

export type CloudStatus = 'off' | 'loading' | 'syncing' | 'synced' | 'offline' | 'error'

export function getGitHubToken(): string | null {
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

  const taskMap = new Map<string, InboxState['tasks'][number]>()
  for (const task of remote.tasks) taskMap.set(task.id, task)
  for (const task of local.tasks) taskMap.set(task.id, task)

  const localAt = local.prefs.updatedAt ?? 0
  const remoteAt = remote.prefs.updatedAt ?? 0
  const prefs = (remoteAt > localAt ? remote.prefs : local.prefs)

  return normalizeState({
    clients: [...clientMap.values()],
    tasks: [...taskMap.values()],
    prefs: {
      ...prefs,
      updatedAt: Math.max(localAt, remoteAt, Date.now()),
    },
  })
}

export function statesDiffer(local: InboxState, merged: InboxState): boolean {
  if (local.tasks.length !== merged.tasks.length) return true
  if (local.clients.length !== merged.clients.length) return true
  const localIds = new Set(local.tasks.map((task) => task.id))
  return merged.tasks.some((task) => !localIds.has(task.id))
}

export async function fetchCloudState(): Promise<InboxState | null> {
  for (const base of [BUNDLED_DATA_URL, RAW_INBOX_URL]) {
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

  if (isCloudEnabled() && (local.prefs.updatedAt ?? 0) > (remote.prefs.updatedAt ?? 0)) {
    onStatus('syncing')
    const pushed = await pushCloudState(merged)
    onStatus(pushed ? 'synced' : navigator.onLine ? 'error' : 'offline')
  } else {
    onStatus('synced')
  }

  return { state: merged, changed }
}
