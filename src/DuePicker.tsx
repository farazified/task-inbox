import { addDaysISO, formatDue, todayISO } from './dates'

type Props = {
  value: string | null
  onChange: (iso: string | null) => void
  compact?: boolean
}

export function DuePicker({ value, onChange, compact = false }: Props) {
  const today = todayISO()
  const tomorrow = addDaysISO(1)
  const nextWeek = addDaysISO(7)

  const preset =
    value === null
      ? 'none'
      : value === today
        ? 'today'
        : value === tomorrow
          ? 'tomorrow'
          : value === nextWeek
            ? 'next-week'
            : 'custom'

  return (
    <div className={`due-picker ${compact ? 'compact' : ''}`}>
      <select
        className="due-select"
        value={preset}
        onChange={(event) => {
          const next = event.target.value
          if (next === 'none') onChange(null)
          else if (next === 'today') onChange(today)
          else if (next === 'tomorrow') onChange(tomorrow)
          else if (next === 'next-week') onChange(nextWeek)
          else if (next === 'custom' && !value) onChange(today)
        }}
        aria-label="Due date"
      >
        <option value="none">no date</option>
        <option value="today">today</option>
        <option value="tomorrow">tomorrow</option>
        <option value="next-week">next week</option>
        <option value="custom">
          {preset === 'custom' && value ? formatDue(value, today) : 'pick date…'}
        </option>
      </select>
      {preset === 'custom' && !compact && (
        <input
          type="date"
          className="due-date-input"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
          aria-label="Pick due date"
        />
      )}
    </div>
  )
}
