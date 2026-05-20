// src/lib/orchestration/rubric.ts
import Anthropic from '@anthropic-ai/sdk'

export interface RubricScore {
  empathy: number
  accuracy: number
  actionability: number
  completeness: number
  nonPaternalism: number
  overall: number
}

const RUBRIC = `You are an experienced college and career advisor. Score the assistant response on five dimensions, each 0.0 to 1.0:
- empathy: warmth and attunement to the student's emotional state
- accuracy: factual correctness; penalize unsupported numbers
- actionability: clarity of next steps the student could actually take
- completeness: covers what the student actually needs (not more, not less)
- nonPaternalism: respects student agency; avoids preachy or condescending language

Respond ONLY with JSON: {"empathy":0.85,"accuracy":0.9,"actionability":0.8,"completeness":0.7,"nonPaternalism":0.95}`

export async function scoreAgainstRubric(input: {
  userMessage: string
  assistantResponse: string
  advisorReference?: string
}): Promise<RubricScore | null> {
  try {
    const client = new Anthropic()
    const userContent = input.advisorReference
      ? `STUDENT: ${input.userMessage}\n\nASSISTANT (under test): ${input.assistantResponse}\n\nADVISOR REFERENCE: ${input.advisorReference}\n\nScore the assistant. Penalize where it falls short of the advisor reference on any rubric dimension.`
      : `STUDENT: ${input.userMessage}\n\nASSISTANT: ${input.assistantResponse}`
    const res = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 200,
      system: RUBRIC,
      messages: [{ role: 'user', content: userContent }],
    })
    const text = (res.content[0] as { text?: string })?.text ?? ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return null
    const parsed = JSON.parse(m[0]) as Record<string, unknown>
    const scores = ['empathy', 'accuracy', 'actionability', 'completeness', 'nonPaternalism'].map(
      (k) => Number(parsed[k]) || 0,
    )
    const overall = scores.reduce((a, b) => a + b, 0) / scores.length
    return {
      empathy: scores[0],
      accuracy: scores[1],
      actionability: scores[2],
      completeness: scores[3],
      nonPaternalism: scores[4],
      overall,
    }
  } catch {
    return null
  }
}
