import { useEffect, useMemo, useRef, useState } from 'react'
import { chipVars } from './chipVars'
import { ClientsScreen } from './ClientsScreen'
import { Composer } from './Composer'
import { dueBucket, dueDateForGroup, todayISO, type DueGroup } from './dates'
import { EditSheet } from './EditSheet'
import { loadState, nid, nextColor, saveState } from './storage'
import { withProgress } from './taskStatus'
import { clientLabel } from './taskUtils'
import {
  isCloudEnabled,
  mergeStates,
  scheduleCloudPush,
  setGitHubToken,
  statesDiffer,
  syncWithCloud,
  type CloudStatus,
} from './cloudSync'
import { InlineClientRename } from './InlineClientRename'
import { parseTaskInput } from './parseTask'
import { TaskCalendar } from './TaskCalendar'
import { TaskKanban } from './TaskKanban'
import { TaskList } from './TaskList'
import { TaskTable } from './TaskTable'
import { TaskTimeline } from './TaskTimeline'
import { PlannerPanel } from './PlannerPanel'
import { InsightsView } from './InsightsView'
import { FocusStatus } from './FocusStatus'
import { SettingsView } from './SettingsView'
import { AutoSchedule } from './AutoSchedule'
import { MeetingsStrip } from './MeetingsStrip'
import {
  handleOAuthRedirect,
  onSession,
  restoreSession,
  startExpiryWatch,
  doOAuth,
} from './googleAuth'
import type { GoogleSession } from './googleAuth'
import * as focusAgent from './focusAgent'
import type { AgentState, PlanResult } from './focusAgent'
import { ViewSwitcher } from './ViewSwitcher'
import { clientNameError, parseDueDate, taskTitleError, trimClientName, trimTitle } from './validate'
import {
  PERSONAL_ID,
  type Filter,
  type InboxState,
  type Task,
  type TaskFocus,
  type TaskProgress,
  type ViewMode,
} from './types'
import './App.css'

export default function App() {
  const [state, setState] = useState<InboxState>(loadState)
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState(state.prefs.lastClientId)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [showComposer, setShowComposer] = useState(false)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showClients, setShowClients] = useState(false)
  const [manualClient, setManualClient] = useState(false)
  const [manualDue, setManualDue] = useState(false)
  const [renamingClientId, setRenamingClientId] = useState<string | null>(null)
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>('loading')
  const [focusState, setFocusState] = useState<AgentState | null>(null)
  const [agentStatus, setAgentStatus] = useState<focusAgent.AgentStatus>('offline')
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [showPlanner, setShowPlanner] = useState(false)
  const [showAutoSchedule, setShowAutoSchedule] = useState(false)
  const [googleSession, setGoogleSession] = useState<GoogleSession | null>(null)
  const [sessionLapsed, setSessionLapsed] = useState(false)
  const [focusDraft, setFocusDraft] = useState<TaskFocus | null>(null)
  const prevTasks = useRef<Map<string, Task>>(new Map())
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
    // Local save always happens above. Cloud upload is best-effort and can lag.
    if (isCloudEnabled()) scheduleCloudPush(state, setCloudStatus)
  }, [state])

  useEffect(() => {
    let cancelled = false

    const applyPull = (merged: InboxState, changed: boolean) => {
      if (cancelled || !changed) return
      // Re-merge against whatever the user did during the network round-trip.
      setState((prev) => {
        const latest = mergeStates(prev, merged)
        if (!statesDiffer(prev, latest)) return prev
        skipCloudPush.current = true
        // Queue upload of the reconciled state without blocking the UI.
        if (isCloudEnabled()) scheduleCloudPush(latest, setCloudStatus, 0)
        return latest
      })
    }

    syncWithCloud(() => stateRef.current, setCloudStatus, { initial: true }).then(
      ({ state: merged, changed }) => {
        if (cancelled) return
        applyPull(merged, changed)
        cloudReady.current = true
      },
    )

    const refresh = () => {
      if (document.hidden || !cloudReady.current) return
      syncWithCloud(() => stateRef.current, setCloudStatus).then(({ state: merged, changed }) => {
        applyPull(merged, changed)
      })
    }

    const poll = window.setInterval(refresh, 30_000)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('online', refresh)
    return () => {
      cancelled = true
      clearInterval(poll)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [])

  useEffect(() => {
    if (!showComposer) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowComposer(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showComposer])

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
    const query = search.trim().toLowerCase()
    return state.tasks.filter((task) => {
      if (filter === 'personal') {
        if (task.clientId !== PERSONAL_ID) return false
      } else if (filter === 'today') {
        if (dueBucket(task.dueDate, today) !== 'today') return false
        if (task.done && state.prefs.hideCompleted) return false
      } else if (filter === 'overdue') {
        if (task.done || dueBucket(task.dueDate, today) !== 'overdue') return false
      } else if (filter !== 'all') {
        if (task.clientId !== filter) return false
      }

      if (!query) return true
      const clientName =
        task.clientId === PERSONAL_ID
          ? 'personal'
          : state.clients.find((client) => client.id === task.clientId)?.name ?? ''
      return (
        task.title.toLowerCase().includes(query) ||
        (task.notes ?? '').toLowerCase().includes(query) ||
        clientName.toLowerCase().includes(query)
      )
    })
  }, [state.tasks, state.clients, filter, search, state.prefs.hideCompleted])

  function touchTask(task: Task, patch: Partial<Task>): Task {
    const next = { ...task, ...patch, updatedAt: Date.now() }
    // An explicit `focus: undefined` in the patch means "clear the block", so drop the key.
    if ('focus' in patch && !patch.focus) delete next.focus
    return next
  }

  const editing = state.tasks.find((task) => task.id === editingId) ?? null

  /** Sets how long tasks take. A scheduled block is resized to match. */
  function setDurations(updates: Array<{ taskId: string; durationMin: number }>) {
    const byId = new Map(updates.map((item) => [item.taskId, item.durationMin]))
    patch((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        const durationMin = byId.get(task.id)
        if (!durationMin) return task
        return {
          ...task,
          durationMin,
          ...(task.focus ? { focus: { ...task.focus, durationMin } } : {}),
          updatedAt: Date.now(),
        }
      }),
    }))
  }

  /** Applies a focus block to one task without disturbing anything else about it. */
  function setTaskFocus(taskId: string, focus: TaskFocus | null) {
    patch((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) => {
        if (task.id !== taskId) return task
        if (!focus) {
          const { focus: _dropped, ...rest } = task
          return { ...rest, updatedAt: Date.now() }
        }
        return { ...task, focus, updatedAt: Date.now() }
      }),
    }))
  }

  // The agent owns Google Calendar, so every local focus change is pushed to it.
  // Diffing here catches every mutation path (compose, edit sheet, timeline drag, planner).
  useEffect(() => {
    const previous = prevTasks.current
    const current = new Map(state.tasks.map((task) => [task.id, task]))
    const first = previous.size === 0

    for (const task of state.tasks) {
      const before = previous.get(task.id)
      // Skip the first pass after load — otherwise every already-done task with a
      // leftover focus block would be re-completed against Google Calendar.
      if (!first && task.progress === 'done' && before?.progress !== 'done' && task.focus) {
        focusAgent.completeTask(task.id)
        continue
      }
      if (!task.focus) {
        if (!first && before?.focus) focusAgent.unscheduleTask(task.id)
        continue
      }
      if (first) continue
      const changed =
        !before?.focus ||
        before.focus.start !== task.focus.start ||
        before.focus.durationMin !== task.focus.durationMin ||
        before.title !== task.title ||
        before.clientId !== task.clientId
      if (changed) focusAgent.scheduleTask(task, clientLabel(task.clientId, state.clients).name)
    }

    if (!first) {
      for (const [id, before] of previous) {
        if (!current.has(id) && before.focus) focusAgent.unscheduleTask(id)
      }
    }
    prevTasks.current = current
  }, [state.tasks])

  // Google sign-in, run in the browser exactly as the SEO-IQ dashboard does it.
  useEffect(() => {
    // The banner is only honest if a session actually existed and then lapsed;
    // never having signed in is not an expiry.
    let everSignedIn = false
    const off = onSession((session) => {
      setGoogleSession(session)
      if (session) {
        everSignedIn = true
        setSessionLapsed(false)
      } else if (everSignedIn) {
        setSessionLapsed(true)
      }
    })
    if (!handleOAuthRedirect()) restoreSession()
    const stopWatch = startExpiryWatch()
    return () => {
      off()
      stopWatch()
    }
  }, [])

  // Live agent link: state pushes, calendar-side edits, and the evening plan nudge.
  useEffect(() => {
    const offStatus = focusAgent.onStatus(setAgentStatus)
    focusAgent
      .fetchState()
      .then(setFocusState)
      .catch(() => undefined)
    void focusAgent.flushQueue()

    // Pull agent schedules into local tasks so the timeline shows blocks created
    // outside this tab (API, another device, or a prior session).
    void focusAgent.fetchSchedules().then(({ schedules }) => {
      const byId = new Map(
        schedules
          .filter((row) => row.status === 'scheduled')
          .map((row) => [row.taskId, row]),
      )
      if (!byId.size) return
      const stamp = Date.now()
      const withAgentFocus = (tasks: Task[]) =>
        tasks.map((task) => {
          const row = byId.get(task.id)
          if (!row) return task
          const durationMin = Math.max(
            5,
            Math.round((Date.parse(row.end) - Date.parse(row.start)) / 60_000),
          )
          const focus: TaskFocus = {
            start: row.start,
            durationMin,
            ...(row.eventId ? { eventId: row.eventId } : {}),
          }
          if (
            task.focus?.start === focus.start &&
            task.focus.durationMin === focus.durationMin &&
            (task.focus.eventId ?? '') === (focus.eventId ?? '')
          ) {
            return task
          }
          return { ...task, focus, durationMin, updatedAt: stamp }
        })
      prevTasks.current = new Map(
        withAgentFocus(stateRef.current.tasks).map((task) => [task.id, task]),
      )
      patch((prev) => ({ ...prev, tasks: withAgentFocus(prev.tasks) }))
    }).catch(() => undefined)

    const unsubscribe = focusAgent.subscribe({
      onState: setFocusState,
      onScheduleChanged: (payload) => {
        patch((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => {
            if (task.id !== payload.taskId) return task
            const next: TaskFocus = {
              start: payload.start,
              durationMin: payload.durationMin,
              ...(payload.eventId ? { eventId: payload.eventId } : {}),
            }
            if (
              task.focus?.start === next.start &&
              task.focus.durationMin === next.durationMin &&
              task.focus.eventId === next.eventId
            ) {
              return task
            }
            return { ...task, focus: next, durationMin: next.durationMin, updatedAt: Date.now() }
          }),
        }))
      },
      onScheduleRemoved: (payload) => {
        patch((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => {
            if (task.id !== payload.taskId || !task.focus) return task
            const { focus: _dropped, ...rest } = task
            return { ...rest, updatedAt: Date.now() }
          }),
        }))
      },
      onPlanDue: () => {
        setShowPlanner(true)
      },
    })

    const flusher = setInterval(() => {
      void focusAgent.flushQueue()
    }, 15_000)
    const onFocusWindow = () => void focusAgent.flushQueue()
    window.addEventListener('focus', onFocusWindow)

    return () => {
      offStatus()
      unsubscribe()
      clearInterval(flusher)
      window.removeEventListener('focus', onFocusWindow)
    }
  }, [])

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
    const now = Date.now()
    const task: Task = {
      id: nid(),
      title: nextTitle,
      clientId: parsed.clientId ?? activeClient,
      dueDate: parseDueDate(parsed.dueDate ?? dueDate),
      done: false,
      progress: 'open',
      ...(focusDraft ? { focus: focusDraft } : {}),
      createdAt: now,
      updatedAt: now,
    }
    // Let the sync effect push the schedule once — do not call the agent here too.
    patch((prev) => ({
      ...prev,
      tasks: [task, ...prev.tasks],
      prefs: { ...prev.prefs, lastClientId: task.clientId },
    }))
    setTitle('')
    setDueDate(null)
    setFocusDraft(null)
    setManualClient(false)
    setManualDue(false)
    setShowComposer(false)
  }

  function deleteTask(id: string) {
    const task = state.tasks.find((item) => item.id === id)
    if (!task) return
    if (!window.confirm(`Delete “${task.title}” permanently?`)) return
    const deletedAt = Date.now()
    patch((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((item) => item.id !== id),
      deletedTaskIds: [
        ...prev.deletedTaskIds.filter((item) => item.id !== id),
        { id, deletedAt },
      ],
    }))
    if (editingId === id) setEditingId(null)
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
  const emptyTitle =
    search.trim()
      ? 'No matches.'
      : filter === 'all'
        ? 'Nothing in the inbox.'
        : 'Nothing in this filter.'
  const viewProps = {
    tasks: visibleTasks,
    clients: state.clients,
    hideCompleted: state.prefs.hideCompleted,
    emptyTitle,
    onToggle: (id: string) =>
      patch((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) => {
          if (task.id !== id) return task
          const next: TaskProgress = task.progress === 'done' || task.done ? 'open' : 'done'
          return touchTask(task, withProgress(next))
        }),
      })),
    onStatusChange: (taskId: string, progress: TaskProgress) =>
      patch((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId ? touchTask(task, withProgress(progress)) : task,
        ),
      })),
    onOpen: (id: string) => setEditingId(id),
    onClientChange: (taskId: string, nextClientId: string) =>
      patch((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId ? touchTask(task, { clientId: nextClientId }) : task,
        ),
      })),
    onDueChange: (taskId: string, dueDate: string | null) =>
      patch((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) =>
          task.id === taskId ? touchTask(task, { dueDate: parseDueDate(dueDate) }) : task,
        ),
      })),
    onDurationChange: (taskId: string, durationMin: number) =>
      setDurations([{ taskId, durationMin }]),
    onMoveToGroup: (taskId: string, group: DueGroup | 'done') =>
      patch((prev) => ({
        ...prev,
        tasks: prev.tasks.map((task) => {
          if (task.id !== taskId) return task
          if (group === 'done') return touchTask(task, withProgress('done'))
          return touchTask(task, {
            ...withProgress(task.progress === 'done' ? 'open' : task.progress),
            dueDate: dueDateForGroup(group),
          })
        }),
      })),
    onDelete: deleteTask,
  }

  const clientFilter = state.clients.some((client) => client.id === filter) ? filter : ''
  const taskChrome = viewMode !== 'settings' && viewMode !== 'insights'
  const showMeetings = taskChrome
  const heading =
    viewMode === 'timeline'
      ? { eyebrow: 'Focus blocks', title: 'Timeline' }
      : viewMode === 'calendar'
        ? { eyebrow: 'By due date', title: 'Month' }
        : viewMode === 'settings'
          ? { eyebrow: 'Focus', title: 'Settings' }
          : viewMode === 'insights'
            ? { eyebrow: 'Focus', title: 'Insights' }
            : { eyebrow: 'Focus', title: 'Tasks' }

  function setViewMode(mode: ViewMode) {
    patch((prev) => ({
      ...prev,
      prefs: { ...prev.prefs, viewMode: mode },
    }))
    if (mode === 'settings' || mode === 'insights') {
      setShowComposer(false)
      setShowAutoSchedule(false)
      setShowPlanner(false)
    } else if (mode !== 'timeline') {
      setShowAutoSchedule(false)
      setShowPlanner(false)
    }
  }

  function renderView() {
    switch (viewMode) {
      case 'kanban':
        return <TaskKanban {...viewProps} />
      case 'calendar':
        return <TaskCalendar {...viewProps} />
      case 'timeline':
        return (
          <TaskTimeline
            tasks={visibleTasks}
            clients={state.clients}
            session={focusState?.session ?? null}
            pomodoro={focusState?.pomodoro ?? { phase: 'idle', cycle: 0, secondsLeft: 0, anchor: null }}
            workingHours={focusState?.settings.workingHours ?? { start: '12:00', end: '24:00' }}
            ghosts={plan?.items.map((item) => ({
              taskId: item.taskId,
              start: item.start,
              durationMin: item.durationMin,
            }))}
            onFocusChange={setTaskFocus}
            onOpen={setEditingId}
          />
        )
      case 'settings':
        return (
          <SettingsView
            settings={
              focusState?.settings
                ? {
                    ...focusState.settings,
                    aiKeySet: focusState.aiKeySet ?? focusState.settings.aiKeySet,
                    aiKeyHint: focusState.aiKeyHint ?? focusState.settings.aiKeyHint,
                  }
                : null
            }
            agentOnline={agentStatus !== 'offline' && focusState !== null}
            aiEnabled={focusState?.ai === 'on'}
            extension={focusState?.extension}
            onSettingsChange={(patch) =>
              setFocusState((prev) =>
                prev
                  ? {
                      ...prev,
                      ai: patch.aiKeySet === false ? 'off' : patch.aiKeySet ? 'on' : prev.ai,
                      aiProvider: patch.aiProvider ?? prev.aiProvider,
                      aiKeySet: patch.aiKeySet ?? prev.aiKeySet,
                      aiKeyHint: patch.aiKeyHint ?? prev.aiKeyHint,
                      settings: { ...prev.settings, ...patch },
                    }
                  : prev,
              )
            }
          />
        )
      case 'insights':
        return (
          <InsightsView
            clients={state.clients}
            aiEnabled={focusState?.ai === 'on'}
            blockedSites={focusState?.settings.blockedSites ?? []}
            onSettingsChange={(blockedSites) =>
              setFocusState((prev) =>
                prev ? { ...prev, settings: { ...prev.settings, blockedSites } } : prev,
              )
            }
          />
        )
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
              <p className="eyebrow">{heading.eyebrow}</p>
              <h1>{heading.title}</h1>
            </div>
            <div className="top-actions">
              {cloudStatus !== 'off' && (
                <span
                  className={`sync-dot sync-${cloudStatus}`}
                  title={cloudExplain(cloudStatus)}
                >
                  {cloudLabel(cloudStatus)}
                </span>
              )}
              <FocusStatus
                status={agentStatus}
                state={focusState}
                onStateChange={setFocusState}
                onOpenSetup={() => setViewMode('settings')}
              />
              <ViewSwitcher value={viewMode} onChange={setViewMode} />
              {taskChrome && (
                <button
                  type="button"
                  className={`text-btn ${showAutoSchedule ? 'on-text' : ''}`}
                  onClick={() => {
                    const next = !showAutoSchedule
                    setShowAutoSchedule(next)
                    setShowPlanner(false)
                    if (next) setViewMode('timeline')
                  }}
                >
                  Auto-schedule
                </button>
              )}
              <MoreActions
                hideCompleted={state.prefs.hideCompleted}
                planOpen={showPlanner}
                settingsOn={viewMode === 'settings'}
                onTogglePlan={() => {
                  const next = !showPlanner
                  setShowPlanner(next)
                  setShowAutoSchedule(false)
                  if (next) setViewMode('timeline')
                }}
                onToggleDone={() =>
                  patch((prev) => ({
                    ...prev,
                    prefs: { ...prev.prefs, hideCompleted: !prev.prefs.hideCompleted },
                  }))
                }
                onClients={() => setShowClients(true)}
                onSettings={() => setViewMode('settings')}
              />
            </div>
          </header>

          <div className="main-pane">
              {taskChrome && (
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
                <label className="filter-search">
                  <span>Search</span>
                  <input
                    className="filter-search-input"
                    type="search"
                    value={search}
                    placeholder="Find task, note, client…"
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <label className="filter-client">
                  <span>Client</span>
                  <select
                    className="filter-client-select"
                    value={clientFilter}
                    onChange={(event) => setFilter(event.target.value || 'all')}
                    style={
                      clientFilter
                        ? {
                            color:
                              state.clients.find((client) => client.id === clientFilter)?.color,
                            borderColor: state.clients.find((client) => client.id === clientFilter)
                              ?.color,
                          }
                        : undefined
                    }
                  >
                    <option value="">All clients</option>
                    {state.clients.map((client) => (
                      <option key={client.id} value={client.id} style={{ color: client.color }}>
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
              )}

              {sessionLapsed && !googleSession && (
                <div className="session-banner">
                  <span>Your Google session expired. Calendar sync is paused.</span>
                  <button type="button" className="session-reconnect" onClick={() => doOAuth()}>
                    Reconnect →
                  </button>
                </div>
              )}

              {showMeetings && <MeetingsStrip signedIn={focusState?.auth === 'ok'} />}

              {showAutoSchedule && (
                <AutoSchedule
                  tasks={state.tasks}
                  clients={state.clients}
                  onDurationsChange={setDurations}
                  onApply={(updates) => {
                    const byId = new Map(updates.map((item) => [item.taskId, item.focus]))
                    const stamp = Date.now()
                    const withFocus = (tasks: Task[]) =>
                      tasks.map((task) => {
                        const focus = byId.get(task.id)
                        return focus
                          ? {
                              ...task,
                              focus,
                              durationMin: focus.durationMin,
                              updatedAt: stamp,
                            }
                          : task
                      })
                    // Build the map the sync effect will see next, from the same apply.
                    prevTasks.current = new Map(
                      withFocus(stateRef.current.tasks).map((task) => [task.id, task]),
                    )
                    patch((prev) => ({ ...prev, tasks: withFocus(prev.tasks) }))
                    setViewMode('timeline')
                  }}
                  onClose={() => setShowAutoSchedule(false)}
                />
              )}

              {showPlanner && (
                <PlannerPanel
                  tasks={state.tasks}
                  clients={state.clients}
                  aiEnabled={focusState?.ai === 'on'}
                  plan={plan}
                  onPlan={setPlan}
                  onApply={(updates) => {
                    const byId = new Map(updates.map((item) => [item.taskId, item.focus]))
                    const stamp = Date.now()
                    const withFocus = (tasks: Task[]) =>
                      tasks.map((task) => {
                        const focus = byId.get(task.id)
                        return focus ? { ...task, focus, durationMin: focus.durationMin, updatedAt: stamp } : task
                      })
                    prevTasks.current = new Map(
                      withFocus(stateRef.current.tasks).map((task) => [task.id, task]),
                    )
                    patch((prev) => ({ ...prev, tasks: withFocus(prev.tasks) }))
                    setViewMode('timeline')
                  }}
                  onClose={() => setShowPlanner(false)}
                />
              )}

              {renderView()}
          </div>

          {taskChrome && !showComposer && (
            <button
              type="button"
              className="add-btn quick-add-fab"
              onClick={() => setShowComposer(true)}
            >
              Quick add
            </button>
          )}

          {showComposer && (
            <div className="composer-overlay" role="presentation">
              <button
                type="button"
                className="backdrop"
                aria-label="Close quick add"
                onClick={() => setShowComposer(false)}
              />
              <div className="composer-widget" role="dialog" aria-label="Quick add">
                <Composer
                  title={title}
                  onTitle={handleTitleChange}
                  clientId={activeClient}
                  onClient={setClient}
                  dueDate={dueDate}
                  onDue={setDueDate}
                  clients={state.clients}
                  onAdd={addTask}
                  onClose={() => setShowComposer(false)}
                  manualClient={manualClient}
                  manualDue={manualDue}
                  onManualClient={() => setManualClient(true)}
                  onManualDue={() => setManualDue(true)}
                  focus={focusDraft}
                  onFocus={setFocusDraft}
                  aiEnabled={focusState?.ai === 'on'}
                />
              </div>
            </div>
          )}
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
            if ('done' in next || 'progress' in next) {
              if (next.progress) {
                Object.assign(patchTask, withProgress(next.progress))
              } else if (typeof next.done === 'boolean') {
                Object.assign(patchTask, withProgress(next.done ? 'done' : 'open'))
              }
            }
            if ('focus' in next) {
              patchTask.focus = next.focus ?? undefined
            }
            if (typeof next.durationMin === 'number' && next.durationMin >= 5) {
              patchTask.durationMin = next.durationMin
              if (next.focus) patchTask.focus = next.focus
              else if (editing.focus) {
                patchTask.focus = { ...editing.focus, durationMin: next.durationMin }
              }
            }
            if ('notes' in next) {
              patchTask.notes =
                typeof next.notes === 'string' && next.notes.trim()
                  ? next.notes.trim()
                  : undefined
            }
            patch((prev) => ({
              ...prev,
              tasks: prev.tasks.map((task) =>
                task.id === editing.id ? touchTask(task, patchTask) : task,
              ),
            }))
          }}
          onDelete={() => deleteTask(editing.id)}
        />
      )}
    </div>
  )
}

function cloudExplain(status: CloudStatus): string {
  switch (status) {
    case 'loading':
      return 'Checking GitHub for updates… Edits still work offline.'
    case 'syncing':
      return 'Uploading local changes to GitHub in the background…'
    case 'synced':
      return 'Local changes are saved here and on GitHub.'
    case 'offline':
      return 'Offline — edits stay on this device and will sync when you reconnect.'
    case 'error':
      return 'Cloud upload failed — edits are safe on this device and will retry.'
    default:
      return 'Cloud sync is off. Everything still works on this device.'
  }
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

function MoreActions({
  hideCompleted,
  planOpen,
  settingsOn,
  onTogglePlan,
  onToggleDone,
  onClients,
  onSettings,
}: {
  hideCompleted: boolean
  planOpen: boolean
  settingsOn: boolean
  onTogglePlan: () => void
  onToggleDone: () => void
  onClients: () => void
  onSettings: () => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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
    <div className="header-more" ref={menuRef}>
      <button
        type="button"
        className={`text-btn header-more-btn ${open || settingsOn || planOpen ? 'on-text' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        onClick={() => setOpen((prev) => !prev)}
      >
        Menu
      </button>
      {open && (
        <div className="view-more-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className={planOpen ? 'on' : ''}
            onClick={() => {
              onTogglePlan()
              setOpen(false)
            }}
          >
            Plan
          </button>
          <button
            type="button"
            role="menuitem"
            className={hideCompleted ? 'on' : ''}
            onClick={() => {
              onToggleDone()
              setOpen(false)
            }}
          >
            {hideCompleted ? 'Show done' : 'Hide done'}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClients()
              setOpen(false)
            }}
          >
            Clients
          </button>
          <button
            type="button"
            role="menuitem"
            className={settingsOn ? 'on' : ''}
            onClick={() => {
              onSettings()
              setOpen(false)
            }}
          >
            Settings
          </button>
        </div>
      )}
    </div>
  )
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
