// src/app/eval/page.tsx
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Header } from '@/components/layout/Header'

interface Report {
  finishedAt: number
  accuracy: { pass: number; total: number }
  rubric: { avg: number }
  bias: { flagged: number; total: number }
  detail: unknown
}

function latestReport(): { name: string; data: Report } | null {
  try {
    const dir = join(process.cwd(), 'eval', 'reports')
    const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    if (files.length === 0) return null
    const name = files[files.length - 1]
    const data = JSON.parse(readFileSync(join(dir, name), 'utf8')) as Report
    return { name, data }
  } catch {
    return null
  }
}

function pct(n: number, d: number): string {
  if (d === 0) return '—'
  return `${Math.round((n / d) * 100)}%`
}

export default function EvalPage() {
  const report = latestReport()
  return (
    <div className="min-h-screen bg-paper">
      <Header />
      <main className="px-6 sm:px-10 py-14 max-w-[920px] mx-auto space-y-8">
        <header>
          <div className="eyebrow-accent">Audit · Trust dashboard</div>
          <h1 className="font-display text-[44px] leading-[1.05] tracking-tight text-ink mt-1.5">
            How the <span className="italic font-light text-forest">advisor</span> is doing.
          </h1>
          <p className="text-[14px] text-ink-mid mt-3 font-display italic leading-relaxed">
            Offline accuracy, rubric, and bias-probe results from the most recent{' '}
            <code className="font-mono text-[12px] not-italic bg-paper-deep px-1 py-0.5 rounded-sm">pnpm eval:run</code>.
          </p>
        </header>

        <hr className="rule-h" />

        {!report ? (
          <div className="almanac-card px-6 py-10 text-center">
            <span className="ornament">·  ·  ·</span>
            <p className="font-display italic text-[16px] text-ink-soft mt-4">
              No reports yet.
            </p>
            <p className="text-[12.5px] text-ink-faint mt-2">
              Run{' '}
              <code className="font-mono bg-paper-deep px-1 py-0.5 rounded-sm">pnpm eval:run</code>{' '}
              to generate one.
            </p>
          </div>
        ) : (
          <>
            <div className="eyebrow">
              {report.name} ·{' '}
              <span className="text-ink-mid">{new Date(report.data.finishedAt).toLocaleString()}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card
                label="Accuracy"
                value={pct(report.data.accuracy.pass, report.data.accuracy.total)}
                detail={`${report.data.accuracy.pass}/${report.data.accuracy.total} facts within tolerance`}
              />
              <Card
                label="Rubric avg"
                value={report.data.rubric.avg.toFixed(2)}
                detail="Opus judge — empathy + accuracy + actionability + completeness + non-paternalism"
              />
              <Card
                label="Bias flags"
                value={String(report.data.bias.flagged)}
                detail={`out of ${report.data.bias.total} probes`}
              />
            </div>

            <details className="almanac-card overflow-hidden">
              <summary className="px-5 py-3 cursor-pointer font-display text-[15px] text-ink hover:bg-paper-warm/40 list-none flex items-center justify-between">
                <span>Full report JSON</span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink-soft">expand</span>
              </summary>
              <pre className="font-mono text-[11px] bg-paper-warm p-4 overflow-x-auto border-t border-rule leading-relaxed text-ink-mid">
                {JSON.stringify(report.data, null, 2)}
              </pre>
            </details>
          </>
        )}
      </main>
    </div>
  )
}

function Card({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="almanac-card px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div className="serif-numeral text-[40px] leading-none text-forest-deep mt-2">{value}</div>
      <div className="text-[11.5px] text-ink-soft mt-2 leading-relaxed">{detail}</div>
    </div>
  )
}
