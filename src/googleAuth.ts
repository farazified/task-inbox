import { ACCOUNT_KEY, CLIENT_ID, SCOPES, TOKEN_EXPIRY_KEY, TOKEN_KEY } from './focusConfig'
import { AGENT_URL } from './focusAgent'

export type GoogleSession = {
  token: string
  expiresAt: number
  email: string | null
}

/** The exact string sent as redirect_uri, which is what Google must have registered. */
export function redirectUri(): string {
  return location.origin + location.pathname
}

let lastError: string | null = null

export function getAuthError(): string | null {
  return lastError
}

export function clearAuthError(): void {
  lastError = null
}

let current: GoogleSession | null = null
const listeners = new Set<(session: GoogleSession | null) => void>()

function emit(): void {
  for (const listener of listeners) listener(current)
}

export function onSession(listener: (session: GoogleSession | null) => void): () => void {
  listeners.add(listener)
  listener(current)
  return () => listeners.delete(listener)
}

export function getSession(): GoogleSession | null {
  if (current && current.expiresAt > Date.now()) return current
  return null
}

export function isSignedIn(): boolean {
  return getSession() !== null
}

/** Sends the browser to Google's consent screen; it returns to this same page. */
export function doOAuth(): void {
  lastError = null
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'token',
    scope: SCOPES,
    prompt: 'select_account',
    include_granted_scopes: 'true',
  })
  location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

function store(session: GoogleSession): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, session.token)
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(session.expiresAt))
    if (session.email) sessionStorage.setItem(ACCOUNT_KEY, session.email)
  } catch {
    /* private window or blocked storage — the session still works until reload */
  }
}

/** Hands the token to the local agent so it can keep the calendar in sync. */
async function pushToAgent(session: GoogleSession): Promise<void> {
  try {
    await fetch(`${AGENT_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: session.token,
        expires_at: session.expiresAt,
        email: session.email,
      }),
    })
  } catch {
    /* agent offline — the app still works; it will be pushed again on next load */
  }
}

async function fetchEmail(token: string): Promise<string | null> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return null
    const data = (await response.json()) as { email?: string }
    return data.email ?? null
  } catch {
    return null
  }
}

/** Reads the token Google put in the URL fragment. Returns true if one was there. */
export function handleOAuthRedirect(): boolean {
  // Google reports some failures by redirecting back with an error instead of a
  // token (a mismatched redirect URI never gets this far — it stops on Google's
  // own page — but a declined consent or a bad scope does).
  const query = new URLSearchParams(location.search)
  const hash = new URLSearchParams(location.hash.slice(1))
  const failure = hash.get('error') ?? query.get('error')
  if (failure) {
    lastError = failure
    history.replaceState(null, '', location.pathname)
    emit()
    return false
  }

  if (!location.hash) return false
  const params = hash
  const token = params.get('access_token')
  if (!token) return false
  const expiresIn = Number(params.get('expires_in')) || 3600
  const session: GoogleSession = {
    token,
    // Retire the token a minute early so a call never lands on an expired one.
    expiresAt: Date.now() + (expiresIn - 60) * 1000,
    email: null,
  }
  current = session
  store(session)
  history.replaceState(null, '', location.pathname + location.search)
  void fetchEmail(token).then((email) => {
    if (!current || current.token !== token) return
    current = { ...current, email }
    store(current)
    emit()
    void pushToAgent(current)
  })
  emit()
  void pushToAgent(session)
  return true
}

/** Restores a session left in sessionStorage by an earlier page load. */
export function restoreSession(): GoogleSession | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)
    const expiresAt = Number(sessionStorage.getItem(TOKEN_EXPIRY_KEY))
    if (!token || !expiresAt || expiresAt <= Date.now()) {
      if (token) signOut(false)
      return null
    }
    current = { token, expiresAt, email: sessionStorage.getItem(ACCOUNT_KEY) }
    emit()
    void pushToAgent(current)
    return current
  } catch {
    return null
  }
}

export function signOut(tellAgent = true): void {
  current = null
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY)
    sessionStorage.removeItem(ACCOUNT_KEY)
  } catch {
    /* nothing to clear */
  }
  if (tellAgent) {
    void fetch(`${AGENT_URL}/auth/signout`, { method: 'POST' }).catch(() => undefined)
  }
  emit()
}

/**
 * Implicit-flow tokens cannot be refreshed silently, so watch the clock and tell the
 * app when the session lapses; it shows a reconnect banner, as SEO-IQ does.
 *
 * While the token is still good, keep handing it to the agent. The agent can lose its
 * copy — it restarts, or something clears it — and re-sending costs nothing, so the
 * connection repairs itself within a few minutes instead of needing a fresh sign-in.
 */
export function startExpiryWatch(): () => void {
  const expiry = setInterval(() => {
    if (current && current.expiresAt <= Date.now()) signOut()
  }, 30_000)

  const repush = setInterval(() => {
    if (current && current.expiresAt > Date.now()) void pushToAgent(current)
  }, 120_000)

  const onVisible = () => {
    if (document.visibilityState === 'visible' && current && current.expiresAt > Date.now()) {
      void pushToAgent(current)
    }
  }
  document.addEventListener('visibilitychange', onVisible)

  return () => {
    clearInterval(expiry)
    clearInterval(repush)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
