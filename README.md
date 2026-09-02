# Task Inbox

Dump client and personal tasks from your phone or laptop. Dark, fast, no account.

**Everything stays in sync automatically** — local edits, live site, and your phone all share the same task list.

Seven CLI SEO clients are already loaded: Andor Willow, Wired4Signs USA, Snyder's Furniture, Elizabetta, FibroPool, Electric Ride-On Cars, and Qbounce Sport. Add, rename, or delete others from **Clients**. Personal is always there.

## Daily use

Double-click **`start-task-inbox-dashboard.command`**

That starts the local app and turns on auto-sync:

- **Tasks** — every add/edit syncs to GitHub within a second (header shows **Synced**)
- **App code** — saves auto-push to GitHub; Pages rebuilds in ~1 minute
- **Local URL:** http://127.0.0.1:5173/
- **Live URL:** https://farazified.github.io/task-inbox/

Use the **live URL** on your phone (Add to Home Screen) — same tasks everywhere.

## One-time setup

```bash
npm install
./setup-cloud-sync.sh
```

`setup-cloud-sync.sh` stores your GitHub token so the live site can sync tasks too. You only run this once.

## Use it

Type a task and tap **Add** or press Enter. Client names and due words (`today`, `tomorrow`, `next week`) are detected as you type.

Due dates show as **today**, **tomorrow**, **thursday**, etc.

Phone opens in **List**. Laptop opens in **Table**. Switch anytime: Table, Kanban, Calendar, or List.

Tap a row to edit. The checkbox (or status) marks it done. **Hide done** tucks completed tasks away.

## Manual push (optional)

Usually not needed — auto-sync handles it. If you want to force a push:

```bash
./push-task-inbox-live.sh
```
