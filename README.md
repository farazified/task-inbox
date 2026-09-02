# Task Inbox

Dump client and personal tasks from your phone or laptop. Dark, fast, no account.

Same workflow as your **SEO·IQ dashboard**: run locally, push to GitHub, live on GitHub Pages.

Seven CLI SEO clients are already loaded: Andor Willow, Wired4Signs USA, Snyder's Furniture, Elizabetta, FibroPool, Electric Ride-On Cars, and Qbounce Sport. Add, rename, or delete others from **Clients**. Personal is always there.

## Run locally

Double-click **`start-task-inbox-dashboard.command`** (opens Chrome at the locked local URL).

Or:

```bash
./start-task-inbox-dashboard.sh
npm run serve   # build + preview
npm run dev     # live reload while editing
```

Local URL: **http://127.0.0.1:5173/**

## Go live (like SEO·IQ)

After you change the app:

**Double-click `push-task-inbox-live.command`** — or:

```bash
./push-task-inbox-live.sh
```

That commits and runs `git push origin main`. GitHub Pages rebuilds automatically.

Live URL: **https://farazified.github.io/task-inbox/**

## One-time GitHub setup

If this folder is not on GitHub yet:

```bash
npm install
git init -b main
git add -A && git commit -m "Initial commit"
gh repo create task-inbox --public --source=. --remote=origin
git push -u origin main
```

In the repo on GitHub: **Settings → Pages → Build and deployment → GitHub Actions**.

Use the live URL on your phone (Add to Home Screen) so tasks stay in that browser.

## Use it

Type a task and tap **Add** or press Enter. Client names and due words (`today`, `tomorrow`, `next week`) are detected as you type. You can also set Client and Due by hand.

Phone opens in **List**. Laptop opens in **Table**. Switch anytime: Table, Kanban, Calendar, or List.

Tap a row to edit. The checkbox (or status) marks it done. **Hide done** tucks completed tasks away.

Tasks sync through GitHub (`public/data/inbox.json`). Local and live stay matched automatically.

- **Read:** live app loads tasks from GitHub on open
- **Write:** run `./setup-cloud-sync.sh` once so local edits push back
- **Before push:** `push-task-inbox-live.command` exports your browser tasks into the repo

Use the live URL on your phone (Add to Home Screen) so tasks stay in one place.
