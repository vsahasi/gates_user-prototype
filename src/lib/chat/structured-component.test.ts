import { describe, expect, it } from 'vitest'
import { parseStructuredComponentMessage, stripStructuredComponentForStream } from './structured-component'

describe('structured-component', () => {
  it('parses closed component block and strips from text', () => {
    const text = `Hello\n\n<!-- COMPONENT:pathway_cards -->\n{"pathways":[]}\n<!-- /COMPONENT -->`
    const { cleanText, component } = parseStructuredComponentMessage(text)
    expect(cleanText.trim()).toBe('Hello')
    expect(component?.type).toBe('pathway_cards')
    expect(component?.data).toEqual({ pathways: [] })
  })

  it('parses JSON without closing HTML comment using brace matching', () => {
    const text = `Intro\n\n<!-- COMPONENT:pathway_cards -->\n{"pathways":[{"title":"A","type":"4_year","description":"x","timeToComplete":"1","estimatedCost":"1","earnings":"1","nextStep":"1","fit":"high"}]}`
    const { cleanText, component } = parseStructuredComponentMessage(text)
    expect(cleanText.trim()).toBe('Intro')
    expect(component?.type).toBe('pathway_cards')
  })

  it('strips unclosed invalid tail without leaving raw markers', () => {
    const text = `Hi\n\n<!-- COMPONENT:pathway_cards -->\n{"pathways":[{"title":"x`
    const { cleanText, component } = parseStructuredComponentMessage(text)
    expect(cleanText.trim()).toBe('Hi')
    expect(component).toBeNull()
  })

  it('hides component region while streaming incomplete JSON', () => {
    const partial = `Text before\n\n<!-- COMPONENT:pathway_cards -->\n{"pathways":[`
    expect(stripStructuredComponentForStream(partial).trim()).toBe('Text before')
  })
})
