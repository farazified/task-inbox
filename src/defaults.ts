import { CLIENT_COLORS, type Client } from './types'

export const DEFAULT_CLIENTS: readonly { id: string; name: string }[] = [
  { id: 'andor-willow', name: 'Andor Willow' },
  { id: 'wired4signs-usa', name: 'Wired4Signs USA' },
  { id: 'snyders-furniture', name: "Snyder's Furniture" },
  { id: 'elizabetta', name: 'Elizabetta' },
  { id: 'fibropool', name: 'FibroPool' },
  { id: 'electric-ride-on-cars', name: 'Electric Ride-On Cars' },
  { id: 'qbounce-sport', name: 'Qbounce Sport' },
] as const

export const DEFAULTS_VERSION = 1

export function buildDefaultClients(): Client[] {
  return DEFAULT_CLIENTS.map((client, index) => ({
    id: client.id,
    name: client.name,
    color: CLIENT_COLORS[index % CLIENT_COLORS.length],
  }))
}

export function normalizeClientName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function clientNameKey(name: string): string {
  return normalizeClientName(name).toLowerCase()
}

export function isDefaultClient(id: string): boolean {
  return DEFAULT_CLIENTS.some((client) => client.id === id)
}
