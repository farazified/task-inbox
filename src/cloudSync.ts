import { normalizeState } from './storage'
import type { InboxState } from './types'

export const GITHUB_REPO = 'farazified/task-inbox'
export const INBOX_DATA_PATH = 'public/data/inbox.json'
export const RAW_INBOX_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${INBOX_DATA_PATH}`
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
  const localAt = local.prefs.updatedAt ?? 0
  const remoteAt = remote.prefs.updatedAt ?? 0
  if (remoteAt > localAt) return normalizeState(remote)
  return normalizeState(local)
}

export async function fetchCloudState(): Promise<InboxState | null> {
  try {
    const res = await fetch(`${RAW_INBOX_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`fetch failed (${res.status})`)
    const data = (await res.json()) as unknown
    if (!data || typeof data !== 'object') return null
    return normalizeState(data as InboxState)
  } catch {
    return null
  }
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
  const localAt = local.prefs.updatedAt ?? 0
  const remoteAt = remote.prefs.updatedAt ?? 0
  const changed = (merged.prefs.updatedAt ?? 0) !== localAt || remoteAt > localAt

  if (isCloudEnabled() && localAt > remoteAt) {
    onStatus('syncing')
    const pushed = await pushCloudState(merged)
    onStatus(pushed ? 'synced' : navigator.onLine ? 'error' : 'offline')
  } else {
    onStatus('synced')
  }

  return { state: merged, changed }
}
