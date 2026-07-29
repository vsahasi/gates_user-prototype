// src/app/adult/[adultId]/page.tsx
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { getAdult, listLinksForAdult, getStudent } from '@/lib/db/queries'
import { runMigrations } from '@/lib/db'

export default async function AdultHome({
  params,
}: {
  params: Promise<{ adultId: string }>
}) {
  await runMigrations()
  const { adultId } = await params
  const a = await getAdult(adultId)
  if (!a) redirect('/')
  const links = await listLinksForAdult(adultId)
  const linkRows = await Promise.all(
    links.map(async (l) => ({ link: l, student: await getStudent(l.studentId) })),
  )
  return (
    <div className="min-h-screen bg-paper">
      <Header personaName={a.displayName} />
      <main className="px-6 sm:px-10 py-14 max-w-[820px] mx-auto space-y-10">
        <header>
          <div className="eyebrow-accent">A briefing room</div>
          <h1 className="font-display text-[44px] leading-[1.05] tracking-tight text-ink mt-1.5">
            Hello, <span className="italic font-light text-forest">{a.displayName}</span>.
          </h1>
          <p className="text-[15px] text-ink-mid mt-3 font-display italic leading-relaxed">
            Students who&apos;ve shared their context with you. Open a name to read their notes
            and ask questions on their behalf.
          </p>
        </header>

        <hr className="rule-h" />

        {links.length === 0 ? (
          <div className="text-center py-12">
            <span className="ornament">·  ·  ·</span>
            <p className="mt-4 font-display italic text-[16px] text-ink-soft">
              No active shares yet.
            </p>
            <p className="text-[13px] text-ink-faint mt-2">
              When a student sends you a link, the conversation will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {linkRows.map(({ link: l, student: s }) => {
              if (!s) return null
              return (
                <li key={l.id}>
                  <Link
                    href={`/adult/${adultId}/student/${s.id}`}
                    className="block almanac-card px-5 py-4 hover:border-forest hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(13,74,61,0.08)] transition-all group"
                  >
                    <div className="flex items-baseline justify-between">
                      <div>
                        <div className="font-display text-[22px] text-ink leading-tight">
                          {s.displayName}
                        </div>
                        <div className="eyebrow mt-1">
                          linked as <span className="text-forest">{l.role}</span>
                        </div>
                      </div>
                      <span
                        aria-hidden
                        className="font-display text-[20px] text-ink-faint group-hover:text-forest group-hover:translate-x-1 transition-all"
                      >
                        →
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
