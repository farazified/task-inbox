#!/usr/bin/env node
/**
 * Read task inbox from Chrome localStorage and write public/data/inbox.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'

const ROOT = new URL('..', import.meta.url).pathname
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const USER_DATA = `${process.env.HOME}/Library/Application Support/Google/Chrome`
const OUT = `${ROOT}public/data/inbox.json`
const APP_URL = 'http://127.0.0.1:5173/'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function ensureServer() {
  try {
    const res = await fetch(APP_URL, { signal: AbortSignal.timeout(1500) })
    if (res.ok) return null
  } catch {
    /* start preview */
  }

  const child = spawn('npm run start', {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
    detached: true,
  })
  child.unref()

  for (let i = 0; i < 30; i += 1) {
    await sleep(500)
    try {
      const res = await fetch(APP_URL, { signal: AbortSignal.timeout(1500) })
      if (res.ok) return child
    } catch {
      /* keep waiting */
    }
  }

  throw new Error('Could not start local task inbox on port 5173')
}

async function readLocalStorage() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: USER_DATA,
    args: ['--profile-directory=Default', '--no-first-run', '--no-default-browser-check'],
  })

  try {
    const page = await browser.newPage()
    await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 20_000 })
    const raw = await page.evaluate(() => localStorage.getItem('task-inbox:v1'))
    if (!raw) return null
    return JSON.parse(raw)
  } finally {
    await browser.close()
  }
}

async function main() {
  console.log('Reading tasks from Chrome localStorage…')
  const server = await ensureServer()
  const state = await readLocalStorage()

  if (!state) {
    console.error('No local tasks found at http://127.0.0.1:5173/')
    process.exit(1)
  }

  state.prefs = { ...state.prefs, updatedAt: Date.now() }
  mkdirSync(`${ROOT}public/data`, { recursive: true })
  writeFileSync(OUT, `${JSON.stringify(state, null, 2)}\n`)
  console.log(`Saved ${state.tasks?.length ?? 0} tasks to public/data/inbox.json`)

  if (server?.pid) {
    try {
      process.kill(-server.pid)
    } catch {
      /* preview may already be owned elsewhere */
    }
  }
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
