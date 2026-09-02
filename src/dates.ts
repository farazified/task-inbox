function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function shiftISO(iso: string, days: number): string {
  const date = parseISO(iso)
  date.setDate(date.getDate() + days)
  return toISO(date)
}

export function addDaysISO(days: number): string {
  return shiftISO(todayISO(), days)
}

export type DueBucket = 'overdue' | 'today' | 'upcoming' | 'nodate'

export function dueBucket(dueDate: string | null, today = todayISO()): DueBucket {
  if (!dueDate) return 'nodate'
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  return 'upcoming'
}

export function formatDueDate(iso: string | null, today = todayISO()): string {
  if (!iso) return '—'
  return formatDue(iso, today)
}

export function monthLabel(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function monthStart(iso: string): string {
  const date = parseISO(iso)
  return toISO(new Date(date.getFullYear(), date.getMonth(), 1))
}

export function shiftMonthISO(iso: string, months: number): string {
  const date = parseISO(monthStart(iso))
  date.setMonth(date.getMonth() + months)
  return toISO(date)
}

export function weekdayLabels(): string[] {
  const base = new Date(2024, 0, 7) // Sunday
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(base)
    day.setDate(base.getDate() + index)
    return day.toLocaleDateString(undefined, { weekday: 'short' })
  })
}

export function calendarCells(monthIso: string): { iso: string; inMonth: boolean }[] {
  const first = parseISO(monthStart(monthIso))
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return { iso: toISO(day), inMonth: day.getMonth() === first.getMonth() }
  })
}

export function formatDue(iso: string | null, today = todayISO()): string {
  if (!iso) return 'No date'
  if (iso < today) {
    const days = Math.round(
      (parseISO(today).getTime() - parseISO(iso).getTime()) / 86_400_000,
    )
    if (days === 1) return 'Yesterday'
    return `${days}d overdue`
  }
  if (iso === today) return 'Today'
  if (iso === shiftISO(today, 1)) return 'Tomorrow'
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}
