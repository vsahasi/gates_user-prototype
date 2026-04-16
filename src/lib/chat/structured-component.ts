// src/lib/chat/structured-component.ts
import type { StructuredComponent } from '@/lib/types'

const OPEN_RE = /<!--\s*COMPONENT:?\s*([a-zA-Z0-9_]+)\s*-->/i

/** Brace-aware JSON object slice from first `{` in tail (handles strings/escapes). */
function extractBalancedJson(tail: string): { json: string; endInTail: number } | null {
  const start = tail.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let esc = false
  for (let p = start; p < tail.length; p++) {
    const c = tail[p]
    if (inString) {
      if (esc) {
        esc = false
        continue
      }
      if (c === '\\') {
        esc = true
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        return { json: tail.slice(start, p + 1), endInTail: p + 1 }
      }
    }
  }
  return null
}

function endOfComponentBlock(text: string, openEnd: number): number | null {
  const tail = text.slice(openEnd)
  const closeRe = /<!--\s*\/COMPONENT\s*-->/i
  const closeIdx = tail.search(closeRe)
  if (closeIdx !== -1) {
    const m = tail.slice(closeIdx).match(closeRe)
    return openEnd + closeIdx + (m?.[0].length ?? 0)
  }
  const bal = extractBalancedJson(tail)
  if (!bal) return null
  let end = openEnd + bal.endInTail
  const after = text.slice(end).match(/^\s*<!--\s*\/COMPONENT\s*-->/i)
  if (after) end += after[0].length
  return end
}

/**
 * Removes structured component payloads from streamed text. Hides everything from the
 * opening marker through a complete JSON object (or through EOF if JSON is still incomplete).
 */
export function stripStructuredComponentForStream(text: string): string {
  const openMatch = text.match(OPEN_RE)
  if (!openMatch || openMatch.index === undefined) return text
  const openEnd = openMatch.index + openMatch[0].length
  const end = endOfComponentBlock(text, openEnd)
  if (end === null) {
    return text.slice(0, openMatch.index).trimEnd()
  }
  return `${text.slice(0, openMatch.index)}${text.slice(end)}`.trim()
}

/**
 * Parses optional `<!-- COMPONENT:type --> ... JSON ... <!-- /COMPONENT -->` blocks.
 * Tolerates a missing closing HTML comment if JSON is brace-balanced (model often omits closing tag).
 */
export function parseStructuredComponentMessage(text: string): {
  cleanText: string
  component: StructuredComponent | null
} {
  const openMatch = text.match(OPEN_RE)
  if (!openMatch || openMatch.index === undefined) {
    return { cleanText: text, component: null }
  }

  const type = openMatch[1] as StructuredComponent['type']
  const openEnd = openMatch.index + openMatch[0].length
  const tail = text.slice(openEnd)

  let jsonStr: string
  let blockEnd: number

  const closeRe = /<!--\s*\/COMPONENT\s*-->/i
  const closeIdx = tail.search(closeRe)
  if (closeIdx !== -1) {
    const closeMatch = tail.slice(closeIdx).match(closeRe)
    jsonStr = tail.slice(0, closeIdx).trim()
    blockEnd = openEnd + closeIdx + (closeMatch?.[0].length ?? 0)
  } else {
    const bal = extractBalancedJson(tail)
    if (!bal) {
      const cleanText = text.slice(0, openMatch.index).trimEnd()
      return { cleanText, component: null }
    }
    jsonStr = bal.json
    blockEnd = openEnd + bal.endInTail
    const afterJson = text.slice(blockEnd).match(/^\s*<!--\s*\/COMPONENT\s*-->/i)
    if (afterJson) blockEnd += afterJson[0].length
  }

  let data: unknown
  try {
    data = JSON.parse(jsonStr)
  } catch {
    const cleanText = `${text.slice(0, openMatch.index)}${text.slice(blockEnd)}`.trim()
    return { cleanText, component: null }
  }

  const cleanText = `${text.slice(0, openMatch.index)}${text.slice(blockEnd)}`.trim()
  return {
    cleanText,
    component: { type, data } as StructuredComponent,
  }
}
