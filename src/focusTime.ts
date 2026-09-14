import type { Task } from './types'


export const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240] as const

/** The length to use for a task: its own estimate, else its block, else an hour. */
export function taskDuration(task: { durationMin?: number; focus?: { durationMin: number } }): number {
  return task.durationMin ?? task.focus?.durationMin ?? 60
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** ISO instant → the `YYYY-MM-DDTHH:MM` string an `<input type="datetime-local">` wants. */
export function toLocalInput(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/** `YYYY-MM-DDTHH:MM` from the picker → ISO instant, or null when unparseable. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function nextQuarterHour(from = new Date()): string {
  const ms = 15 * 60_000
  return new Date(Math.ceil((from.getTime() + 60_000) / ms) * ms).toISOString()
}

export function focusEnd(task: Task): number | null {
  if (!task.focus) return null
  return Date.parse(task.focus.start) + task.focus.durationMin * 60_000
}

export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function formatDayClock(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  const isTomorrow = date.toDateString() === tomorrow.toDateString()
  const time = formatClock(iso)
  if (sameDay) return `Today ${time}`
  if (isTomorrow) return `Tomorrow ${time}`
  return `${date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

export function countdown(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  if (minutes >= 60) {
    return `${Math.floor(minutes / 60)}:${pad(minutes % 60)}:${pad(rest)}`
  }
  return `${minutes}:${pad(rest)}`
}

export function focusesOverlap(a: Task, b: Task): boolean {
  if (!a.focus || !b.focus) return false
  const aStart = Date.parse(a.focus.start)
  const bStart = Date.parse(b.focus.start)
  return (
    aStart < bStart + b.focus.durationMin * 60_000 &&
    bStart < aStart + a.focus.durationMin * 60_000
  )
}
