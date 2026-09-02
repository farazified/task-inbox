import { addDaysISO, parseISO, shiftISO, toISO, todayISO } from './dates'
import { clientNameKey } from './defaults'
import { PERSONAL_ID, type Client } from './types'

export type ParsedTask = {
  title: string
  clientId: string | null
  dueDate: string | null
}

const PERSONAL_PREFIX = /^\s*personal\s*[:\-–]\s*/i
const PERSONAL_HINT = /\b(personal|my task|for me)\b/i

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

type Match = { start: number; end: number; clientId: string; label: string }

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function clientAliases(client: Client): string[] {
  const names = new Set<string>()
  names.add(client.name)
  names.add(client.name.replace(/['']/g, ''))
  const compact = client.name.replace(/[^a-zA-Z0-9]/g, '')
  if (compact.length >= 4) names.add(compact)
  for (const word of client.name.split(/[\s\-–]+/)) {
    if (word.length >= 4) names.add(word)
  }
  for (const part of client.id.split('-')) {
    if (part.length >= 4) names.add(part)
  }
  return [...names]
}

function findClient(text: string, clients: Client[]): Match | null {
  const lower = text.toLowerCase()
  const matches: Match[] = []

  for (const client of clients) {
    for (const alias of clientAliases(client)) {
      const key = alias.trim()
      if (key.length < 3) continue
      const pattern = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'i')
      const hit = pattern.exec(text)
      if (hit) {
        matches.push({
          start: hit.index,
          end: hit.index + hit[0].length,
          clientId: client.id,
          label: hit[0],
        })
      }
      const compactKey = key.replace(/\s+/g, '')
      if (compactKey.length >= 4 && lower.includes(compactKey.toLowerCase())) {
        const idx = lower.indexOf(compactKey.toLowerCase())
        matches.push({
          start: idx,
          end: idx + compactKey.length,
          clientId: client.id,
          label: text.slice(idx, idx + compactKey.length),
        })
      }
    }
  }

  if (matches.length === 0) return null
  return matches.sort((a, b) => b.label.length - a.label.length || a.start - b.start)[0]
}

function nextWeekday(dayIndex: number, today = todayISO()): string {
  const base = parseISO(today)
  let delta = (dayIndex - base.getDay() + 7) % 7
  if (delta === 0) delta = 7
  return shiftISO(today, delta)
}

type DueMatch = { start: number; end: number; iso: string }

function findDueDate(text: string, today = todayISO()): DueMatch | null {
  const rules: { re: RegExp; iso: (match: RegExpMatchArray) => string | null }[] = [
    { re: /\b(today|tonight|eod|asap|urgent)\b/i, iso: () => today },
    { re: /\btomorrow\b/i, iso: () => addDaysISO(1) },
    { re: /\bnext week\b/i, iso: () => addDaysISO(7) },
    { re: /\bend of week\b/i, iso: () => nextWeekday(5, today) },
    {
      re: /\b(?:by|due|for)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i,
      iso: (m) => nextWeekday(WEEKDAYS[m[1].toLowerCase()], today),
    },
    {
      re: /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/i,
      iso: (m) => nextWeekday(WEEKDAYS[m[1].toLowerCase()], today),
    },
    {
      re: /\bin\s+(\d+)\s+days?\b/i,
      iso: (m) => addDaysISO(Number(m[1])),
    },
    {
      re: /\bin\s+(\d+)\s+weeks?\b/i,
      iso: (m) => addDaysISO(Number(m[1]) * 7),
    },
    {
      re: /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i,
      iso: (m) => monthDayISO(m[1], Number(m[2]), today),
    },
    {
      re: /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/,
      iso: (m) => slashDateISO(Number(m[1]), Number(m[2]), m[3], today),
    },
  ]

  for (const rule of rules) {
    const hit = rule.re.exec(text)
    if (!hit) continue
    const iso = rule.iso(hit)
    if (!iso) continue
    return { start: hit.index, end: hit.index + hit[0].length, iso }
  }
  return null
}

function monthDayISO(rawMonth: string, day: number, today: string): string | null {
  const month = MONTHS[rawMonth.toLowerCase()]
  if (month === undefined || day < 1 || day > 31) return null
  const base = parseISO(today)
  let year = base.getFullYear()
  const candidate = new Date(year, month, day)
  if (candidate < base) candidate.setFullYear(year + 1)
  return toISO(candidate)
}

function slashDateISO(month: number, day: number, yearRaw: string | undefined, today: string): string | null {
  const base = parseISO(today)
  let year = base.getFullYear()
  if (yearRaw) {
    year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw)
  }
  const candidate = new Date(year, month - 1, day)
  if (Number.isNaN(candidate.getTime())) return null
  if (!yearRaw && candidate < base) candidate.setFullYear(year + 1)
  return toISO(candidate)
}

function stripRanges(text: string, ranges: { start: number; end: number }[]): string {
  const sorted = [...ranges].sort((a, b) => b.start - a.start)
  let next = text
  for (const range of sorted) {
    next = `${next.slice(0, range.start)} ${next.slice(range.end)}`
  }
  return next
    .replace(/\s*[:\-–|]\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*[:\-–|]\s*|\s*[:\-–|]\s*$/g, '')
    .trim()
}

export function parseTaskInput(
  raw: string,
  clients: Client[],
  _fallbackClientId: string,
  today = todayISO(),
): ParsedTask {
  let text = raw.trim()
  if (!text) return { title: '', clientId: null, dueDate: null }

  const ranges: { start: number; end: number }[] = []
  let clientId: string | null = null

  if (PERSONAL_PREFIX.test(text)) {
    clientId = PERSONAL_ID
    text = text.replace(PERSONAL_PREFIX, '')
  } else {
    const clientHit = findClient(text, clients)
    if (clientHit) {
      clientId = clientHit.clientId
      ranges.push({ start: clientHit.start, end: clientHit.end })
    } else if (PERSONAL_HINT.test(text)) {
      clientId = PERSONAL_ID
      const hit = PERSONAL_HINT.exec(text)
      if (hit) ranges.push({ start: hit.index, end: hit.index + hit[0].length })
    }
  }

  const dueHit = findDueDate(text, today)
  if (dueHit) ranges.push({ start: dueHit.start, end: dueHit.end })

  const title = stripRanges(text, ranges)
  return {
    title,
    clientId,
    dueDate: dueHit?.iso ?? null,
  }
}

export function clientMatchesName(client: Client, name: string): boolean {
  return clientNameKey(client.name) === clientNameKey(name)
}
