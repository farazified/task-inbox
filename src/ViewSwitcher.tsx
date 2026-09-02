import type { ViewMode } from './types'

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'table', label: 'Table' },
  { id: 'kanban', label: 'Kanban' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'list', label: 'List' },
]

type Props = {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function ViewSwitcher({ value, onChange }: Props) {
  return (
    <nav className="view-switcher" aria-label="View">
      {VIEWS.map((view) => (
        <button
          key={view.id}
          type="button"
          className={`view-tab ${value === view.id ? 'on' : ''}`}
          onClick={() => onChange(view.id)}
        >
          {view.label}
        </button>
      ))}
    </nav>
  )
}
