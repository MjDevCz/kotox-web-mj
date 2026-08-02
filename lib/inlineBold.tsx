import type { ReactNode } from 'react'

// The `excerpt` frontmatter supports a single inline format: `**bold**`. These
// helpers render it for display and strip it for plain-text contexts (social
// meta tags, RSS descriptions) where markdown would leak as literal asterisks.

// Render `**bold**` spans as <strong>, everything else as plain text.
export function renderInlineBold(text: string): ReactNode[] {
  return text.split(/\*\*/).map((chunk, i) =>
    i % 2 === 1 ? <strong key={i}>{chunk}</strong> : chunk
  )
}

// Drop the `**` markers, leaving plain text.
export function stripInlineBold(text: string): string {
  return text.replace(/\*\*/g, '')
}