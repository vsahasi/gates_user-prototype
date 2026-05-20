// src/lib/adaptive/tone.ts
import Anthropic from '@anthropic-ai/sdk'

export type Tone = 'calm' | 'anxious' | 'overwhelmed' | 'excited' | 'confused'

const VALID: Tone[] = ['calm', 'anxious', 'overwhelmed', 'excited', 'confused']

export async function classifyTone(message: string): Promise<Tone> {
  if (!message.trim()) return 'calm'
  try {
    const client = new Anthropic()
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8,
      system:
        'Classify the emotional tone of the user message. Reply with one word only, from: calm, anxious, overwhelmed, excited, confused.',
      messages: [{ role: 'user', content: message }],
    })
    const text = (res.content[0] as { text?: string })?.text?.toLowerCase().trim() ?? ''
    const cleaned = text.replace(/[^a-z]/g, '')
    return (VALID as string[]).includes(cleaned) ? (cleaned as Tone) : 'calm'
  } catch {
    return 'calm'
  }
}
