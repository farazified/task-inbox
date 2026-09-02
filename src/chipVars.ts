import type { CSSProperties } from 'react'

export function chipVars(color: string, active = false): CSSProperties {
  const style: Record<string, string> = { '--chip-dot': color }
  if (active) style['--chip'] = color
  return style as CSSProperties
}
