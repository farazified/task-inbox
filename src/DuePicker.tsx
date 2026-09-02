import { addDaysISO, todayISO } from './dates'

type Props = {
  value: string | null
  onChange: (iso: string | null) => void
  mode?: 'full' | 'date'
}

export function DuePicker({ value, onChange, mode = 'full' }: Props) {
  const today = todayISO()
  const tomorrow = addDaysISO(1)
  const nextWeek = addDaysISO(7)

  if (mode === 'date') {
    return (
      <input
        type="date"
        className="due-date-input"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        aria-label="Due date"
      />
    )
  }

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
    <div className="due-picker">
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
        <option value="none">No date</option>
        <option value="today">Today</option>
        <option value="tomorrow">Tomorrow</option>
        <option value="next-week">Next week</option>
        <option value="custom">Pick date…</option>
      </select>
      {preset === 'custom' && (
        <input
          type="date"
          className="due-date-input"
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value || null)}
        />
      )}
    </div>
  )
}
