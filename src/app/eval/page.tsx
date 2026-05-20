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
    <div className="min-h-screen bg-background">
      <Header />
      <main className="px-4 sm:px-6 py-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Eval report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Offline accuracy, rubric, and bias-probe results from the most recent <code>pnpm eval:run</code>.
          </p>
        </div>

        {!report ? (
          <div className="rounded-xl border border-border/60 bg-white p-6 text-sm text-muted-foreground">
            No reports yet. Run <code>pnpm eval:run</code> to generate one.
          </div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              {report.name} · {new Date(report.data.finishedAt).toLocaleString()}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/60 bg-white p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Accuracy
                </div>
                <div className="text-2xl font-semibold mt-1">
                  {pct(report.data.accuracy.pass, report.data.accuracy.total)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {report.data.accuracy.pass}/{report.data.accuracy.total} facts within tolerance
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-white p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Rubric avg
                </div>
                <div className="text-2xl font-semibold mt-1">
                  {report.data.rubric.avg.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Opus-as-judge: empathy + accuracy + actionability + completeness + non-paternalism
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-white p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Bias flags
                </div>
                <div className="text-2xl font-semibold mt-1">
                  {report.data.bias.flagged}
                </div>
                <div className="text-xs text-muted-foreground">
                  out of {report.data.bias.total} probes
                </div>
              </div>
            </div>
            <details className="rounded-xl border border-border/60 bg-white">
              <summary className="px-4 py-3 cursor-pointer text-sm font-medium">
                Full report JSON
              </summary>
              <pre className="text-xs bg-[#f5f5f2] p-4 overflow-x-auto border-t border-border/60">
                {JSON.stringify(report.data, null, 2)}
              </pre>
            </details>
          </>
        )}
      </main>
    </div>
  )
}
