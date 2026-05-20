// scripts/eval-run.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Anthropic from '@anthropic-ai/sdk'
import { checkFact, type FactCheck } from '../src/lib/eval/accuracy'
import { judgePair } from '../src/lib/eval/bias'
import { scoreAgainstRubric } from '../src/lib/orchestration/rubric'

interface Fixture {
  id: string
  studentMessage: string
  expectedFact?: FactCheck
}

interface BiasProbe {
  id: string
  axis: string
  variants: Array<{ label: string; profile: Record<string, unknown>; message: string }>
  ruleOut: string[]
}

async function callAgent(
  message: string,
  _profile: Record<string, unknown> = {},
): Promise<string> {
  const client = new Anthropic()
  const res = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system:
      'You are a college and career advisor. Be concrete and warm. Cite Scorecard, IPEDS, or O*NET inline for facts in this format: [cite: source-and-year].',
    messages: [{ role: 'user', content: message }],
  })
  return (res.content[0] as { text?: string })?.text ?? ''
}

async function main() {
  const root = process.cwd()
  const fixtures = JSON.parse(
    readFileSync(join(root, 'eval/fixtures/sample.json'), 'utf8'),
  ) as Fixture[]
  const probes = JSON.parse(
    readFileSync(join(root, 'eval/bias-probes.json'), 'utf8'),
  ) as BiasProbe[]

  const accuracy: Array<{ id: string; ok: boolean; response: string }> = []
  const rubric: Array<{ id: string; overall: number | null; response: string }> = []
  for (const f of fixtures) {
    console.log(`[accuracy] ${f.id}`)
    const response = await callAgent(f.studentMessage)
    let ok = true
    if (f.expectedFact) ok = checkFact(response, f.expectedFact).ok
    accuracy.push({ id: f.id, ok, response })
    const r = await scoreAgainstRubric({
      userMessage: f.studentMessage,
      assistantResponse: response,
    })
    rubric.push({ id: f.id, overall: r?.overall ?? null, response })
  }

  const bias: Array<{ id: string; flagged: boolean; rationale: string }> = []
  for (const p of probes) {
    console.log(`[bias] ${p.id}`)
    const [a, b] = p.variants
    const respA = await callAgent(a.message, a.profile)
    const respB = await callAgent(b.message, b.profile)
    const j = await judgePair({ ruleOut: p.ruleOut, responseA: respA, responseB: respB })
    bias.push({ id: p.id, ...j })
  }

  const summary = {
    finishedAt: Date.now(),
    accuracy: { pass: accuracy.filter((a) => a.ok).length, total: accuracy.length },
    rubric: {
      avg:
        rubric.reduce((s, r) => s + (r.overall ?? 0), 0) / Math.max(1, rubric.length),
    },
    bias: { flagged: bias.filter((b) => b.flagged).length, total: bias.length },
    detail: { accuracy, rubric, bias },
  }

  const outDir = join(root, 'eval/reports')
  mkdirSync(outDir, { recursive: true })
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16)
  const path = join(outDir, `${ts}.json`)
  writeFileSync(path, JSON.stringify(summary, null, 2))
  console.log(`Wrote ${path}`)
  console.log(
    `Accuracy ${summary.accuracy.pass}/${summary.accuracy.total} | Rubric avg ${summary.rubric.avg.toFixed(2)} | Bias ${summary.bias.flagged}/${summary.bias.total} flagged`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
