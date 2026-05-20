// src/lib/orchestration/citation-extractor.ts
export interface Citation {
  index: number
  source: string
  offset: number
}

const RE = /\[cite:\s*([^\]]+?)\s*\]/g

export function extractCitations(text: string): Citation[] {
  const out: Citation[] = []
  let m: RegExpExecArray | null
  let i = 0
  RE.lastIndex = 0
  while ((m = RE.exec(text)) !== null) {
    out.push({ index: i++, source: m[1], offset: m.index })
  }
  return out
}

export function stripCitations(text: string): string {
  return text
    .replace(RE, '')
    .replace(/  +/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1')
    .trim()
}
