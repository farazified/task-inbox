import { useEffect, useRef } from 'react'
import type { Client } from './types'

type Props = {
  client: Client
  onSave: (name: string) => boolean
  onCancel: () => void
}

export function InlineClientRename({ client, onSave, onCancel }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  return (
    <input
      ref={inputRef}
      className="inline-client-rename"
      defaultValue={client.name}
      aria-label={`Rename ${client.name}`}
      onBlur={(event) => {
        const ok = onSave(event.target.value)
        if (!ok) onCancel()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
        if (event.key === 'Escape') onCancel()
      }}
    />
  )
}
