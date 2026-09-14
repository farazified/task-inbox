import { useEffect, useRef, useState } from 'react'
import {
  DURATION_CHOICES,
  formatDayClock,
  formatDuration,
  fromLocalInput,
  nextQuarterHour,
  toLocalInput,
} from './focusTime'
import { suggestSlots } from './focusAgent'
import type { TaskFocus } from './types'

type Props = {
  value: TaskFocus | null
  onChange: (focus: TaskFocus | null) => void
  compact?: boolean
}

export function FocusPicker({ value, onChange, compact }: Props) {
  const [duration, setDuration] = useState(value?.durationMin ?? 60)
  const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([])
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // Duration is mirrored locally so the select still works before a start time is set.
  const externalDuration = value?.durationMin
  useEffect(() => {
    if (externalDuration) setDuration(externalDuration)
  }, [externalDuration])

  async function loadSlots(minutes: number) {
    setLoading(true)
    try {
      const result = await suggestSlots(minutes)
      if (mounted.current) setSlots(result.slots.slice(0, 4))
    } catch {
      if (mounted.current) setSlots([])
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  // Dragging a block on the timeline can produce any 15-minute length, so the current
  // value has to appear in the list or the select would silently show the wrong one.
  const choices = DURATION_CHOICES.includes(duration as (typeof DURATION_CHOICES)[number])
    ? [...DURATION_CHOICES]
    : [...DURATION_CHOICES, duration].sort((a, b) => a - b)

  function setStart(start: string | null) {
    if (!start) {
      onChange(null)
      return
    }
    onChange({ start, durationMin: duration, ...(value?.eventId ? { eventId: value.eventId } : {}) })
  }

  function setDurationMin(minutes: number) {
    setDuration(minutes)
    if (value) {
      onChange({ ...value, durationMin: minutes })
    }
    if (slots.length) void loadSlots(minutes)
  }

  return (
    <div className={`focus-picker ${compact ? 'compact' : ''}`}>
      <div className="focus-row">
        <label className="field">
          <span>Focus start</span>
          <input
            type="datetime-local"
            className="focus-input"
            value={value ? toLocalInput(value.start) : ''}
            onChange={(event) => setStart(fromLocalInput(event.target.value))}
          />
        </label>
        <label className="field">
          <span>For</span>
          <select
            className="focus-input"
            value={duration}
            onChange={(event) => setDurationMin(Number(event.target.value))}
          >
            {choices.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="focus-actions">
        <button
          type="button"
          className="text-btn"
          onClick={() => {
            if (!slots.length) void loadSlots(duration)
            else setSlots([])
          }}
        >
          {loading ? 'Finding slots…' : slots.length ? 'Hide slots' : 'Find a free slot'}
        </button>
        {!value && (
          <button type="button" className="text-btn" onClick={() => setStart(nextQuarterHour())}>
            Start next quarter hour
          </button>
        )}
        {value && (
          <button type="button" className="text-btn danger" onClick={() => onChange(null)}>
            Clear focus
          </button>
        )}
      </div>
      {slots.length > 0 && (
        <div className="focus-slots">
          {slots.map((slot) => (
            <button
              key={slot.start}
              type="button"
              className="slot-chip"
              onClick={() => {
                setStart(slot.start)
                setSlots([])
              }}
            >
              {formatDayClock(slot.start)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
