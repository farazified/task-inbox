# Task Inbox (app)

The browser UI for Focus System. Path: `focus-system/app` (this folder).

There is no separate `task-inbox` project under Claude Playground anymore.

**Everything stays in sync automatically** — local edits, live site, and your phone can
still share the same task list via GitHub when cloud sync is configured. Focus calendar
features need the local agent on this machine.

## Daily use (from the monorepo root)

```bash
npm run start:agent   # terminal 1
npm run dev           # terminal 2 → http://127.0.0.1:5173/
```

Or from this folder: `npm run dev`, and double-click
`start-task-inbox-dashboard.command` still works for the Vite app + GitHub auto-push.

- **Local URL:** http://127.0.0.1:5173/
- **Live URL (tasks only):** https://farazified.github.io/task-inbox/

## Views

Table, Kanban, Month, Timeline, List, Insights, Settings — plus Auto-schedule and Plan
in the header. Timeline is where focus blocks are scheduled by drag.

## One-time cloud sync (optional)

```bash
npm install
./setup-cloud-sync.sh
```
