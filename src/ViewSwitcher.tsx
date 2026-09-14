import { useEffect, useRef, useState } from 'react'
import type { ViewMode } from './types'

const PRIMARY: { id: ViewMode; label: string }[] = [
  { id: 'table', label: 'Table' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'calendar', label: 'Month' },
]

const MORE: { id: ViewMode; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'kanban', label: 'By due' },
  { id: 'insights', label: 'Insights' },
]

type Props = {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewSwitcher({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const moreActive = MORE.some((view) => view.id === value)
  const moreLabel = MORE.find((view) => view.id === value)?.label ?? 'More'

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <nav className="view-switcher" aria-label="View">
      {PRIMARY.map((view) => (
        <button
          key={view.id}
          type="button"
          className={`view-tab ${value === view.id ? 'on' : ''}`}
          aria-current={value === view.id ? 'page' : undefined}
          onClick={() => onChange(view.id)}
        >
          {view.label}
        </button>
      ))}
      <div className="view-more" ref={menuRef}>
        <button
          type="button"
          className={`view-tab ${moreActive ? 'on' : ''}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          {moreLabel}
        </button>
        {open && (
          <div className="view-more-menu" role="menu">
            {MORE.map((view) => (
              <button
                key={view.id}
                type="button"
                role="menuitem"
                className={value === view.id ? 'on' : ''}
                onClick={() => {
                  onChange(view.id)
                  setOpen(false)
                }}
              >
                {view.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
