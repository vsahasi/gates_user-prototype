// src/components/chat/AssistantMarkdown.tsx
import { Fragment, type ReactNode } from 'react'

const URL_ONCE = /https?:\/\/[^\s<>"')\]]+/

function formatInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let remaining = text
  let k = 0

  while (remaining.length > 0) {
    const bold = remaining.match(/\*\*([\s\S]*?)\*\*/)
    const url = remaining.match(URL_ONCE)

    const boldIdx = bold?.index !== undefined ? bold.index : -1
    const urlIdx = url?.index !== undefined ? url.index : -1

    if (boldIdx === -1 && urlIdx === -1) {
      nodes.push(<Fragment key={`${keyPrefix}-t${k++}`}>{remaining}</Fragment>)
      break
    }

    const useBold = boldIdx !== -1 && (urlIdx === -1 || boldIdx <= urlIdx)
    if (useBold && bold) {
      if (boldIdx > 0) {
        nodes.push(<Fragment key={`${keyPrefix}-t${k++}`}>{remaining.slice(0, boldIdx)}</Fragment>)
      }
      nodes.push(
        <strong key={`${keyPrefix}-b${k++}`} className="font-semibold text-foreground">
          {bold[1]}
        </strong>
      )
      remaining = remaining.slice(boldIdx + bold[0].length)
      continue
    }

    if (url && urlIdx !== -1 && url[0]) {
      if (urlIdx > 0) {
        nodes.push(<Fragment key={`${keyPrefix}-t${k++}`}>{remaining.slice(0, urlIdx)}</Fragment>)
      }
      const href = url[0]
      nodes.push(
        <a
          key={`${keyPrefix}-a${k++}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#1a6b5a] underline decoration-[#1a6b5a]/30 underline-offset-[3px] hover:decoration-[#1a6b5a]/60 transition-colors"
        >
          {href}
        </a>
      )
      remaining = remaining.slice(urlIdx + href.length)
      continue
    }

    nodes.push(<Fragment key={`${keyPrefix}-t${k++}`}>{remaining}</Fragment>)
    break
  }

  return nodes
}

interface AssistantMarkdownProps {
  content: string
}

export function AssistantMarkdown({ content }: AssistantMarkdownProps) {
  const lines = content.split('\n')
  const elements: ReactNode[] = []
  let key = 0

  let listType: 'ol' | 'ul' | null = null
  const listItems: string[] = []
  const paraBuf: string[] = []

  const flushPara = () => {
    if (paraBuf.length === 0) return
    const text = paraBuf.join('\n')
    paraBuf.length = 0
    elements.push(
      <p key={`p${key++}`} className="mb-3 text-[15px] leading-[1.7] text-foreground/90 last:mb-0">
        {formatInline(text, `p${key}`)}
      </p>
    )
  }

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      listItems.length = 0
      listType = null
      return
    }
    const Tag = listType
    const listKey = key++
    elements.push(
      <Tag
        key={`list${listKey}`}
        className={
          listType === 'ol'
            ? 'my-3 list-decimal space-y-2 pl-5 text-[15px] leading-[1.7] marker:text-[#1a6b5a]/50 marker:font-semibold'
            : 'my-3 list-disc space-y-2 pl-5 text-[15px] leading-[1.7] marker:text-[#1a6b5a]/40'
        }
      >
        {listItems.map((item, j) => (
          <li key={j} className="pl-1 text-foreground/90">
            {formatInline(item, `li${listKey}-${j}`)}
          </li>
        ))}
      </Tag>
    )
    listItems.length = 0
    listType = null
  }

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimEnd()
    const t = trimmed.trim()

    if (t === '') {
      flushList()
      flushPara()
      continue
    }

    if (t === '---' || t === '***') {
      flushList()
      flushPara()
      elements.push(<hr key={`hr${key++}`} className="my-4 border-border/50" />)
      continue
    }

    if (t.startsWith('### ')) {
      flushList()
      flushPara()
      elements.push(
        <h4 key={`h${key++}`} className="mb-2 mt-4 text-sm font-semibold tracking-tight text-foreground first:mt-0">
          {formatInline(t.slice(4), `h4${key}`)}
        </h4>
      )
      continue
    }

    if (t.startsWith('## ')) {
      flushList()
      flushPara()
      elements.push(
        <h3 key={`h${key++}`} className="mb-2 mt-5 text-base font-semibold tracking-tight text-foreground first:mt-0">
          {formatInline(t.slice(3), `h3${key}`)}
        </h3>
      )
      continue
    }

    const olMatch = t.match(/^(\d+)\.\s+(.*)$/)
    const ulMatch = t.match(/^[-*]\s+(.*)$/)

    if (olMatch) {
      if (listType !== 'ol') {
        flushList()
        flushPara()
      }
      listType = 'ol'
      listItems.push(olMatch[2] ?? '')
      continue
    }

    if (ulMatch) {
      if (listType !== 'ul') {
        flushList()
        flushPara()
      }
      listType = 'ul'
      listItems.push(ulMatch[1] ?? '')
      continue
    }

    flushList()
    paraBuf.push(trimmed)
  }

  flushList()
  flushPara()

  return <div className="assistant-markdown space-y-0.5">{elements}</div>
}
