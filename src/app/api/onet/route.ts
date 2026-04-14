// src/app/api/onet/route.ts
import { NextRequest } from 'next/server'
import { createONETService } from '@/lib/services/onet'

export async function GET(request: NextRequest) {
  const keyword = request.nextUrl.searchParams.get('keyword')
  if (!keyword) return Response.json({ results: [] })

  try {
    const service = createONETService()
    const results = await service.searchOccupations(keyword)
    return Response.json({ results })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'O*NET unavailable'
    return Response.json({ results: [], error: message }, { status: 200 })
  }
}
