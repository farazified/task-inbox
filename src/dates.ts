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

function dayDiff(fromIso: string, toIso: string): number {
  return Math.round((parseISO(toIso).getTime() - parseISO(fromIso).getTime()) / 86_400_000)
}

function weekdayLabel(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase()
}

export function formatDue(iso: string | null, today = todayISO()): string {
  if (!iso) return 'no date'

  const diff = dayDiff(today, iso)

  if (diff < 0) {
    const ago = -diff
    if (ago === 1) return 'yesterday'
    if (ago <= 6) return weekdayLabel(iso)
    return `${ago} days ago`
  }
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff <= 6) return weekdayLabel(iso)
  if (diff === 7) return 'next week'

  return parseISO(iso)
    .toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    })
    .toLowerCase()
}
