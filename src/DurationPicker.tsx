import { DURATION_CHOICES, formatDuration, taskDuration } from './focusTime'

type Props = {
  value?: number
  compact?: boolean
  onChange: (durationMin: number) => void
}

/** How long the task takes — independent of whether it has a calendar slot yet. */
export function DurationPicker({ value, compact, onChange }: Props) {
  const current = value && value >= 5 ? value : undefined
  const choices = current && !DURATION_CHOICES.includes(current as (typeof DURATION_CHOICES)[number])
    ? [...DURATION_CHOICES, current].sort((a, b) => a - b)
    : [...DURATION_CHOICES]

  return (
    <label className={`duration-picker ${compact ? 'compact' : ''}`}>
      {!compact && <span className="field-label">Duration</span>}
      <select
        className={compact ? 'inline-select' : 'focus-input'}
        aria-label="Task duration"
        value={current ?? 0}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (next > 0) onChange(next)
        }}
      >
        <option value={0} disabled>
          {compact ? 'length…' : 'Set how long this takes'}
        </option>
        {choices.map((minutes) => (
          <option key={minutes} value={minutes}>
            {formatDuration(minutes)}
          </option>
        ))}
      </select>
    </label>
  )
}

export function durationLabel(task: { durationMin?: number; focus?: { durationMin: number } }): string {
  if (!task.durationMin && !task.focus?.durationMin) return '—'
  return formatDuration(taskDuration(task))
}
