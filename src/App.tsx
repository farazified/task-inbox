import { useEffect, useMemo, useRef, useState } from 'react'
import { chipVars } from './chipVars'
import { ClientsScreen } from './ClientsScreen'
import { Composer } from './Composer'
import { dueBucket, todayISO } from './dates'
import { EditSheet } from './EditSheet'
import { loadState, nid, nextColor, saveState } from './storage'
import {
  isCloudEnabled,
  scheduleCloudPush,
  setGitHubToken,
  syncWithCloud,
  type CloudStatus,
} from './cloudSync'
import { InlineClientRename } from './InlineClientRename'
import { parseTaskInput } from './parseTask'
import { TaskCalendar } from './TaskCalendar'
import { TaskKanban } from './TaskKanban'
import { TaskList } from './TaskList'
import { TaskTable } from './TaskTable'
import { ViewSwitcher } from './ViewSwitcher'
import { clientNameError, parseDueDate, taskTitleError, trimClientName, trimTitle } from './validate'
import {
  PERSONAL_ID,
  type Filter,
  type InboxState,
  type Task,
  type ViewMode,
} from './types'
import './App.css'

export default function App() {
  const [state, setState] = useState<InboxState>(loadState)
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState(state.prefs.lastClientId)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showClients, setShowClients] = useState(false)
  const [manualClient, setManualClient] = useState(false)
  const [manualDue, setManualDue] = useState(false)
  const [renamingClientId, setRenamingClientId] = useState<string | null>(null)
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('loading')
  const cloudReady = useRef(false)
  const skipCloudPush = useRef(false)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const envToken = import.meta.env.VITE_GITHUB_TOKEN as string | undefined
    if (envToken?.trim() && !localStorage.getItem('task-inbox:gh-token')) {
      setGitHubToken(envToken.trim())
    }
  }, [])

  useEffect(() => {
    saveState(state)
    if (!cloudReady.current || skipCloudPush.current) {
      skipCloudPush.current = false
      return
    }
    if (isCloudEnabled()) scheduleCloudPush(state, setCloudStatus)
  }, [state])

  useEffect(() => {
    let cancelled = false

    syncWithCloud(loadState(), setCloudStatus).then(({ state: merged, changed }) => {
      if (cancelled) return
      if (changed) {
        skipCloudPush.current = true
        setState(merged)
      }
      cloudReady.current = true
    })

    const refresh = () => {
      if (document.hidden || !cloudReady.current) return
      syncWithCloud(stateRef.current, setCloudStatus).then(({ state: merged, changed }) => {
        if (cancelled || !changed) return
        skipCloudPush.current = true
        setState(merged)
      })
    }

    const poll = window.setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      cancelled = true
      clearInterval(poll)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const sync = () => {
      const kb = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      document.documentElement.style.setProperty('--kb', `${kb}px`)
    }
    sync()
    viewport.addEventListener('resize', sync)
    viewport.addEventListener('scroll', sync)
    return () => {
      viewport.removeEventListener('resize', sync)
      viewport.removeEventListener('scroll', sync)
    }
  }, [])

  const knownClient =
    clientId === PERSONAL_ID || state.clients.some((client) => client.id === clientId)

  const activeClient = knownClient ? clientId : PERSONAL_ID

  const visibleTasks = useMemo(() => {
    const today = todayISO()
    return state.tasks.filter((task) => {
      if (filter === 'all') return true
      if (filter === 'personal') return task.clientId === PERSONAL_ID
      if (filter === 'today') {
        if (dueBucket(task.dueDate, today) !== 'today') return false
        if (task.done && state.prefs.hideCompleted) return false
        return true
      }
      if (filter === 'overdue') return !task.done && dueBucket(task.dueDate, today) === 'overdue'
      return task.clientId === filter
    })
  }, [state.tasks, filter, state.prefs.hideCompleted])

  const editing = state.tasks.find((task) => task.id === editingId) ?? null

  function patch(updater: (prev: InboxState) => InboxState) {
    setState((prev) => {
      const next = updater(prev)
      return {
        ...next,
        prefs: { ...next.prefs, updatedAt: Date.now() },
      }
    })
  }

  function addTask() {
    const parsed = parseTaskInput(title, state.clients, activeClient)
    const nextTitle = trimTitle(parsed.title || title)
    if (taskTitleError(nextTitle)) return
    const task: Task = {
      id: nid(),
      title: nextTitle,
      clientId: parsed.clientId ?? activeClient,
      dueDate: parseDueDate(parsed.dueDate ?? dueDate),
      done: false,
      createdAt: Date.now(),
    }
    patch((prev) => ({
      ...prev,
      tasks: [task, ...prev.tasks],
      prefs: { ...prev.prefs, lastClientId: task.clientId },
    }))
    setTitle('')
    setDueDate(null)
    setManualClient(false)
    setManualDue(false)
  }

  function setClient(id: string) {
    setClientId(id)
    patch((prev) => ({
      ...prev,
      prefs: { ...prev.prefs, lastClientId: id },
    }))
  }

  function renameClient(id: string, name: string): boolean {
    const trimmed = trimClientName(name)
    if (clientNameError(trimmed, state.clients, id)) return false
    patch((prev) => ({
      ...prev,
      clients: prev.clients.map((client) =>
        client.id === id ? { ...client, name: trimmed } : client,
      ),
    }))
    return true
  }

  function handleTitleChange(value: string) {
    setTitle(value)
    if (!value.trim()) {
      setManualClient(false)
      setManualDue(false)
    }
  }

  const todayCount = state.tasks.filter(
    (task) => !task.done && dueBucket(task.dueDate) === 'today',
  ).length
  const overdueCount = state.tasks.filter(
    (task) => !task.done && dueBucket(task.dueDate) === 'overdue',
  ).length

  const viewMode = state.prefs.viewMode
  const emptyTitle = filter === 'all' ? 'Nothing in the inbox.' : 'Nothing in this filter.'
  const viewProps = {
    tasks: visibleTasks,
    clients: state.clients,
    hideCompleted: state.prefs.hideCompleted,
    emptyTitle,
    onToggle: (id: string) =>
      patch((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === id ? { ...task, done: !task.done } : task,
        ),
      })),
    onStatusChange: (taskId: string, done: boolean) =>
      patch((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId ? { ...task, done } : task,
        ),
      })),
    onOpen: (id: string) => setEditingId(id),
    onClientChange: (taskId: string, nextClientId: string) =>
      patch((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId ? { ...task, clientId: nextClientId } : task,
        ),
      })),
    onDueChange: (taskId: string, dueDate: string | null) =>
      patch((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId ? { ...task, dueDate: parseDueDate(dueDate) } : task,
        ),
      })),
  }

  const clientFilter = state.clients.some((client) => client.id === filter) ? filter : ''

  function setViewMode(mode: ViewMode) {
    patch((prev) => ({
      ...prev,
      prefs: { ...prev.prefs, viewMode: mode },
    }))
  }

  function renderView() {
    switch (viewMode) {
      case 'kanban':
        return <TaskKanban {...viewProps} />
      case 'calendar':
        return <TaskCalendar {...viewProps} />
      case 'list':
        return <TaskList {...viewProps} />
      default:
        return <TaskTable {...viewProps} />
    }
  }

  return (
    <div className="app">
      {showClients ? (
        <ClientsScreen
          clients={state.clients}
          onClose={() => setShowClients(false)}
          onAdd={(name) => {
            if (clientNameError(name, state.clients)) return false
            const id = nid()
            const color = nextColor(state.clients.map((client) => client.color))
            patch((prev) => ({
              ...prev,
              clients: [...prev.clients, { id, name, color }],
            }))
            return true
          }}
          onRename={(id, name) => renameClient(id, name)}
          onDelete={(id) => {
            patch((prev) => ({
              ...prev,
              clients: prev.clients.filter((client) => client.id !== id),
              tasks: prev.tasks.map((task) =>
                task.clientId === id ? { ...task, clientId: PERSONAL_ID } : task,
              ),
              prefs: {
                ...prev.prefs,
                lastClientId:
                  prev.prefs.lastClientId === id ? PERSONAL_ID : prev.prefs.lastClientId,
              },
            }))
            if (filter === id) setFilter('all')
            if (clientId === id) setClientId(PERSONAL_ID)
          }}
        />
      ) : (
        <>
          <header className="top">
            <div>
              <p className="eyebrow">Inbox</p>
              <h1>Tasks</h1>
            </div>
            <div className="top-actions">
              {cloudStatus !== 'off' && (
                <span className={`sync-dot sync-${cloudStatus}`} title={cloudLabel(cloudStatus)}>
                  {cloudLabel(cloudStatus)}
                </span>
              )}
              <ViewSwitcher value={viewMode} onChange={setViewMode} />
              <button
                type="button"
                className={`text-btn ${state.prefs.hideCompleted ? 'on-text' : ''}`}
                onClick={() =>
                  patch((prev) => ({
                    ...prev,
                    prefs: { ...prev.prefs, hideCompleted: !prev.prefs.hideCompleted },
                  }))
                }
              >
                {state.prefs.hideCompleted ? 'Show done' : 'Hide done'}
              </button>
              <button type="button" className="ghost-btn" onClick={() => setShowClients(true)}>
                Clients
              </button>
            </div>
          </header>

          <div className="workspace">
            <aside className="sidebar" aria-label="Quick add">
              <Composer
                title={title}
                onTitle={handleTitleChange}
                clientId={activeClient}
                onClient={setClient}
                dueDate={dueDate}
                onDue={setDueDate}
                clients={state.clients}
                onAdd={addTask}
                manualClient={manualClient}
                manualDue={manualDue}
                onManualClient={() => setManualClient(true)}
                onManualDue={() => setManualDue(true)}
              />
            </aside>

            <div className="main-pane">
              <div className="filter-bar">
                <nav className="filters filters-quick" aria-label="Quick filters">
                  <FilterChip
                    label="All"
                    active={filter === 'all'}
                    onClick={() => setFilter('all')}
                  />
                  <FilterChip
                    label="Today"
                    count={todayCount}
                    active={filter === 'today'}
                    onClick={() => setFilter('today')}
                  />
                  <FilterChip
                    label="Overdue"
                    count={overdueCount}
                    danger
                    active={filter === 'overdue'}
                    onClick={() => setFilter('overdue')}
                  />
                  <FilterChip
                    label="Personal"
                    active={filter === 'personal'}
                    onClick={() => setFilter('personal')}
                  />
                </nav>
                <label className="filter-client">
                  <span>Client</span>
                  <select
                    className="filter-client-select"
                    value={clientFilter}
                    onChange={(event) => setFilter(event.target.value || 'all')}
                  >
                    <option value="">All clients</option>
                    {state.clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                {clientFilter && renamingClientId === clientFilter ? (
                  <InlineClientRename
                    client={state.clients.find((client) => client.id === clientFilter)!}
                    onSave={(name) => {
                      const ok = renameClient(clientFilter, name)
                      if (ok) setRenamingClientId(null)
                      return ok
                    }}
                    onCancel={() => setRenamingClientId(null)}
                  />
                ) : clientFilter ? (
                  <button
                    type="button"
                    className="text-btn muted rename-link"
                    onClick={() => setRenamingClientId(clientFilter)}
                  >
                    Rename
                  </button>
                ) : null}
              </div>

              {renderView()}
            </div>
          </div>
        </>
      )}

      {editing && (
        <EditSheet
          task={editing}
          clients={state.clients}
          onClose={() => setEditingId(null)}
          onSave={(next) => {
            const patchTask: Partial<Task> = {}
            if (typeof next.title === 'string') {
              const parsed = parseTaskInput(next.title, state.clients, editing.clientId)
              const trimmed = trimTitle(parsed.title || next.title)
              if (taskTitleError(trimmed)) return
              patchTask.title = trimmed
              if (parsed.clientId) patchTask.clientId = parsed.clientId
              if (parsed.dueDate) patchTask.dueDate = parsed.dueDate
            }
            if ('clientId' in next && typeof next.clientId === 'string') {
              patchTask.clientId = next.clientId
            }
            if ('dueDate' in next) {
              patchTask.dueDate =
                next.dueDate === null
                  ? null
                  : parseDueDate(next.dueDate) ?? editing.dueDate
            }
            if ('done' in next) patchTask.done = next.done
            patch((prev) => ({
              ...prev,
              tasks: prev.tasks.map((task) =>
                task.id === editing.id ? { ...task, ...patchTask } : task,
              ),
            }))
          }}
          onDelete={() => {
            patch((prev) => ({
              ...prev,
              tasks: prev.tasks.filter((task) => task.id !== editing.id),
            }))
            setEditingId(null)
          }}
        />
      )}
    </div>
  )
}

function cloudLabel(status: CloudStatus): string {
  switch (status) {
    case 'loading':
      return 'Loading…'
    case 'syncing':
      return 'Syncing…'
    case 'synced':
      return 'Synced'
    case 'offline':
      return 'Offline'
    case 'error':
      return 'Sync error'
    default:
      return 'Cloud'
  }
}

function FilterChip({
  label,
  count,
  active,
  color,
  danger,
  onClick,
  onDoubleClick,
  title,
}: {
  label: string
  count?: number
  active: boolean
  color?: string
  danger?: boolean
  onClick: () => void
  onDoubleClick?: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      className={`chip filter ${active ? 'on' : ''} ${danger ? 'danger-chip' : ''}`}
      style={color ? chipVars(color, active) : undefined}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={title}
    >
      {color && <span className="dot" />}
      {label}
      {typeof count === 'number' && count > 0 && <span className="count">{count}</span>}
    </button>
  )
}
