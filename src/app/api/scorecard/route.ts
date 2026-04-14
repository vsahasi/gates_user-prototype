// src/app/api/scorecard/route.ts
import { NextRequest } from 'next/server'
import { createScorecardService } from '@/lib/services/scorecard'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const state = searchParams.get('state')
  const cipCode = searchParams.get('cipCode')

  try {
    const service = createScorecardService()
    const results = await service.searchInstitutions({
      state: state ?? undefined,
      cipCode: cipCode ?? undefined,
      perPage: 5,
    })
    return Response.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scorecard unavailable'
    return Response.json({ results: [], error: message }, { status: 200 })
  }
}
