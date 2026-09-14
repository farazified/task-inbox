import type { Task } from './types'

export const AGENT_URL = 'http://127.0.0.1:4545'
const QUEUE_KEY = 'focus-agent:queue'

export type AgentStatus = 'offline' | 'auth-needed' | 'unconfigured' | 'online'

export type SessionInfo = {
  taskId: string
  title: string
  clientId: string | null
  start: string
  end: string
  secondsLeft: number
  secondsTotal: number
}

export type PomodoroInfo = {
  phase: 'work' | 'break' | 'idle'
  cycle: number
  secondsLeft: number
  anchor: string | null
}

export type AgentSettings = {
  targetCalendarId: string
  blockedSites: string[]
  blockedApps: string[]
  workingHours: { start: string; end: string }
  reminderOffsetsMin: number[]
  eveningPlanTime: string
  hostsBlocking: boolean
  extension?: { lastSeen: string | null; connected: boolean }
  strictChrome: boolean
  slotBufferMin: number
  dailyBufferMin: number
  pomodoroWorkMin: number
  pomodoroBreakMin: number
  calendarIds: string[]
  aiProvider?: 'groq' | 'anthropic' | 'openai' | 'off'
  aiKeySet?: boolean
  aiKeyHint?: string | null
}

export type GoogleError = { status: number; reason: string; message: string }

export type AgentState = {
  now: string
  timezone: string
  auth: 'ok' | 'needed' | 'unconfigured'
  account?: string | null
  googleError?: GoogleError | null
  ai: 'on' | 'off'
  aiProvider?: 'groq' | 'anthropic' | 'openai' | 'off'
  aiPreference?: 'groq' | 'anthropic' | 'openai' | 'off'
  aiKeySet?: boolean
  aiKeyHint?: string | null
  hostsBlocking: boolean
  extension?: { lastSeen: string | null; connected: boolean }
  session: SessionInfo | null
  also: SessionInfo[]
  upcoming: SessionInfo[]
  pomodoro: PomodoroInfo
  settings: AgentSettings
}

export type ScheduleRow = {
  taskId: string
  eventId: string | null
  title: string
  clientId: string | null
  start: string
  end: string
  status: string
}

export type Slot = { start: string; end: string }

export type CalendarSummary = {
  id: string
  name: string
  primary: boolean
  accessRole: string
  canWrite: boolean
  color: string | null
  timeZone: string | null
}

export type CalendarsResponse = {
  auth: 'ok' | 'needed' | 'unconfigured'
  account: string | null
  calendars: CalendarSummary[]
  settings: AgentSettings
  googleError?: GoogleError | null
}

export type CalendarEvent = {
  eventId: string
  title: string
  start: string
  end: string
  focus: boolean
  allDay: boolean
}

export type ParsedCapture = {
  title: string
  clientId: string | null
  durationMin: number | null
  start: string | null
  dueDate: string | null
  notes: string | null
  confidence: number
}

export type PlanItem = {
  taskId: string
  start: string
  durationMin: number
  reason: string
}

export type Placement = {
  taskId: string
  title: string
  clientId: string | null
  start: string
  end: string
  durationMin: number
  dueDate: string | null
  placement: 'on-due-date' | 'moved-earlier' | 'moved-later' | 'overdue-catch-up'
  note: string
}

export type AutofillResult = {
  placements: Placement[]
  skipped: Array<{ taskId: string; title: string; reason: string }>
  busyWindowsConsidered: number
}

export type PlanResult = {
  date: string
  mode: 'today' | 'tomorrow'
  rationale: string
  items: PlanItem[]
  unscheduled: Array<{ taskId: string; reason: string }>
}

export type InsightsData = {
  rangeDays: number
  totalFocusMin: number
  completedSessions: number
  totalSessions: number
  perDay: Array<{ date: string; minutes: number }>
  perClient: Array<{ clientId: string; minutes: number; sessions: number }>
  topAttempts: Array<{ kind: string; target: string; count: number }>
  proposedBlocks: string[]
}

export type InsightsSummary = {
  headline: string
  observations: string[]
  suggestions: string[]
}

type QueuedOp =
  | {
      kind: 'schedule'
      taskId: string
      title: string
      clientId: string
      clientName: string
      start: string
      durationMin: number
    }
  | { kind: 'unschedule'; taskId: string }
  | { kind: 'complete'; taskId: string }

let status: AgentStatus = 'offline'
const statusListeners = new Set<(value: AgentStatus) => void>()

function setStatus(next: AgentStatus): void {
  if (next === status) return
  status = next
  for (const listener of statusListeners) listener(next)
}

export function getStatus(): AgentStatus {
  return status
}

export function onStatus(listener: (value: AgentStatus) => void): () => void {
  statusListeners.add(listener)
  listener(status)
  return () => statusListeners.delete(listener)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${AGENT_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    setStatus('offline')
    throw new Error('agent-offline')
  }
  if (response.status === 401) {
    setStatus('auth-needed')
    throw new Error('google-auth-needed')
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(detail || `agent error ${response.status}`)
  }
  if (status === 'offline') setStatus('online')
  return (await response.json()) as T
}

/* ---------- offline queue ---------- */

function readQueue(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueuedOp[]) : []
  } catch {
    return []
  }
}

function writeQueue(queue: QueuedOp[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-200)))
  } catch {
    /* storage full or blocked — the op is lost, which beats throwing mid-render */
  }
}

/** Queued ops are idempotent per task, so a newer op for the same task replaces the old one. */
function enqueue(op: QueuedOp): void {
  const queue = readQueue().filter((item) => item.taskId !== op.taskId)
  queue.push(op)
  writeQueue(queue)
}

async function runOp(op: QueuedOp): Promise<void> {
  if (op.kind === 'schedule') {
    await request(`/tasks/${encodeURIComponent(op.taskId)}/schedule`, {
      method: 'POST',
      body: JSON.stringify({
        title: op.title,
        clientId: op.clientId,
        clientName: op.clientName,
        start: op.start,
        durationMin: op.durationMin,
      }),
    })
    return
  }
  if (op.kind === 'unschedule') {
    await request(`/tasks/${encodeURIComponent(op.taskId)}/schedule`, { method: 'DELETE' })
    return
  }
  await request(`/tasks/${encodeURIComponent(op.taskId)}/complete`, { method: 'POST' })
}

export async function flushQueue(): Promise<void> {
  const queue = readQueue()
  if (!queue.length) return
  const remaining: QueuedOp[] = []
  for (let index = 0; index < queue.length; index += 1) {
    const op = queue[index]
    try {
      await runOp(op)
    } catch (error) {
      const message = (error as Error).message
      if (message === 'agent-offline' || message === 'google-auth-needed') {
        remaining.push(...queue.slice(index))
        break
      }
      // A permanent failure (bad payload) is dropped rather than blocking the queue.
      console.warn('[focus] dropping op', op, message)
    }
  }
  writeQueue(remaining)
}

/* ---------- task operations (queued) ---------- */

export function scheduleTask(task: Task, clientName?: string): void {
  if (!task.focus) return
  const name =
    clientName?.trim() ||
    (task.clientId === 'personal' ? 'Personal' : '')
  enqueue({
    kind: 'schedule',
    taskId: task.id,
    title: task.title,
    clientId: task.clientId,
    clientName: name,
    start: task.focus.start,
    durationMin: task.focus.durationMin,
  })
  void flushQueue()
}

export function unscheduleTask(taskId: string): void {
  enqueue({ kind: 'unschedule', taskId })
  void flushQueue()
}

export function completeTask(taskId: string): void {
  enqueue({ kind: 'complete', taskId })
  void flushQueue()
}

/* ---------- direct reads ---------- */

export function fetchState(): Promise<AgentState> {
  return request<AgentState>('/state')
}

export function fetchSchedules(): Promise<{ schedules: ScheduleRow[] }> {
  return request('/schedules')
}

export function fetchCalendar(from: Date, to: Date): Promise<{ events: CalendarEvent[]; auth: string }> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() })
  return request(`/calendar?${params.toString()}`)
}

export function suggestSlots(durationMin: number, from?: Date, to?: Date): Promise<{ slots: Slot[] }> {
  return request('/schedule/suggest', {
    method: 'POST',
    body: JSON.stringify({
      durationMin,
      from: from?.toISOString(),
      to: to?.toISOString(),
    }),
  })
}

export function parseCapture(
  text: string,
  clients: Array<{ id: string; name: string }>,
  signal?: AbortSignal,
): Promise<{ parsed: ParsedCapture }> {
  return request('/ai/parse', {
    method: 'POST',
    body: JSON.stringify({ text, clients }),
    signal,
  })
}

export function autofill(
  tasks: Array<{
    id: string
    title: string
    clientId: string
    dueDate: string | null
    durationMin: number
  }>,
  maxMinutesPerDay?: number,
  horizonDays?: number,
): Promise<AutofillResult> {
  return request('/schedule/autofill', {
    method: 'POST',
    body: JSON.stringify({ tasks, maxMinutesPerDay, horizonDays }),
  })
}

export function requestPlan(
  mode: 'today' | 'tomorrow',
  tasks: Array<Record<string, unknown>>,
): Promise<PlanResult> {
  return request('/ai/plan', { method: 'POST', body: JSON.stringify({ mode, tasks }) })
}

export function applyPlan(
  items: Array<{
    taskId: string
    title: string
    clientId: string
    clientName?: string
    start: string
    durationMin: number
  }>,
): Promise<{ results: Array<{ taskId: string; eventId?: string; error?: string }> }> {
  return request('/schedule/bulk', { method: 'POST', body: JSON.stringify({ items }) })
}

export function fetchCalendars(): Promise<CalendarsResponse> {
  return request('/calendars')
}

export function fetchInsights(rangeDays = 7): Promise<InsightsData> {
  return request(`/insights?range=${rangeDays}d`)
}

export function summarizeInsights(rangeDays = 7): Promise<{ summary: InsightsSummary }> {
  return request('/ai/insights', { method: 'POST', body: JSON.stringify({ rangeDays }) })
}

export function saveSettings(
  patch: Partial<AgentSettings> & { aiApiKey?: string },
): Promise<AgentSettings> {
  return request('/settings', { method: 'PUT', body: JSON.stringify(patch) })
}

export function resetPomodoro(): Promise<AgentState> {
  return request('/pomodoro/reset', { method: 'POST' })
}

/* ---------- live updates ---------- */

export type AgentEvents = {
  onState?: (state: AgentState) => void
  onScheduleChanged?: (payload: {
    taskId: string
    eventId: string | null
    start: string
    end: string
    durationMin: number
    status: string
  }) => void
  onScheduleRemoved?: (payload: { taskId: string }) => void
  onPlanDue?: (payload: { mode: 'tomorrow'; date: string }) => void
}

/** Opens the SSE stream and keeps it alive; returns an unsubscribe function. */
export function subscribe(handlers: AgentEvents): () => void {
  let source: EventSource | null = null
  let retry: ReturnType<typeof setTimeout> | null = null
  let closed = false

  const open = () => {
    if (closed) return
    source = new EventSource(`${AGENT_URL}/events`)
    source.addEventListener('open', () => setStatus('online'))
    source.addEventListener('state', (event) => {
      const state = JSON.parse((event as MessageEvent).data) as AgentState
      setStatus(state.auth === 'ok' ? 'online' : state.auth === 'needed' ? 'auth-needed' : 'unconfigured')
      handlers.onState?.(state)
    })
    source.addEventListener('schedule.changed', (event) => {
      handlers.onScheduleChanged?.(JSON.parse((event as MessageEvent).data))
    })
    source.addEventListener('schedule.removed', (event) => {
      handlers.onScheduleRemoved?.(JSON.parse((event as MessageEvent).data))
    })
    source.addEventListener('plan.due', (event) => {
      handlers.onPlanDue?.(JSON.parse((event as MessageEvent).data))
    })
    source.addEventListener('error', () => {
      setStatus('offline')
      source?.close()
      source = null
      if (!closed) retry = setTimeout(open, 5000)
    })
  }

  open()
  return () => {
    closed = true
    if (retry) clearTimeout(retry)
    source?.close()
  }
}
