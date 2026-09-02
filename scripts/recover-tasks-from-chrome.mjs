#!/usr/bin/env node
/**
 * Recover task inbox data from Chrome/Cursor LevelDB storage.
 * Scans all origins and keeps the richest task set found.
 */
import { cpSync, mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Level } from 'level'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public/data/inbox.json')

const SOURCES = [
  `${process.env.HOME}/Library/Application Support/Google/Chrome/Profile 17/Local Storage/leveldb`,
  `${process.env.HOME}/Library/Application Support/Cursor/Partitions/cursor-browser/Local Storage/leveldb`,
]

function parseValue(raw) {
  const text = raw.toString().replace(/^\u0001/, '')
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function score(state) {
  if (!state?.tasks) return 0
  return state.tasks.length * 1000 + (state.clients?.length ?? 0)
}

function mergeStates(states) {
  const sorted = [...states].sort((a, b) => score(b) - score(a))
  const base = structuredClone(sorted[0])
  const taskIds = new Set(base.tasks.map((task) => task.id))
  const clientIds = new Set(base.clients.map((client) => client.id))

  for (const state of sorted.slice(1)) {
    for (const client of state.clients ?? []) {
      if (!clientIds.has(client.id)) {
        base.clients.push(client)
        clientIds.add(client.id)
      }
    }
    for (const task of state.tasks ?? []) {
      if (!taskIds.has(task.id)) {
        base.tasks.push(task)
        taskIds.add(task.id)
      }
    }
  }

  base.prefs = {
    ...base.prefs,
    updatedAt: Date.now(),
  }
  return base
}

async function readSource(src) {
  const tmp = mkdtempSync(join(tmpdir(), 'inbox-recover-'))
  const found = []
  try {
    cpSync(src, tmp, { recursive: true })
    const db = new Level(tmp, { createIfMissing: false })
    for await (const [key, value] of db.iterator()) {
      const k = key.toString()
      if (!k.includes('task-inbox:v1')) continue
      const state = parseValue(value)
      if (state) found.push({ origin: k.split('\u0000')[0], state })
    }
    await db.close()
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
  return found
}

async function main() {
  const all = []
  for (const src of SOURCES) {
    try {
      const items = await readSource(src)
      all.push(...items)
      for (const item of items) {
        console.log(`${src} → ${item.origin}: ${item.state.tasks?.length ?? 0} tasks`)
      }
    } catch (error) {
      console.warn(`Skip ${src}: ${error.message}`)
    }
  }

  const states = all.map((item) => item.state)
  if (states.length === 0) {
    console.error('No task inbox data found in browser storage.')
    process.exit(1)
  }

  const merged = mergeStates(states)
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, `${JSON.stringify(merged, null, 2)}\n`)
  console.log(`Recovered ${merged.tasks.length} tasks → ${OUT}`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
