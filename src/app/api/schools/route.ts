// src/app/api/schools/route.ts
import { NextRequest } from 'next/server'
import { ragService } from '@/lib/services/rag'
import type { RAGQueryParams, SchoolType } from '@/lib/types'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const params: RAGQueryParams = {
    state: searchParams.get('state') ?? undefined,
    query: searchParams.get('q') ?? undefined,
    maxTuition: searchParams.get('maxTuition') ? Number(searchParams.get('maxTuition')) : undefined,
    type: searchParams.get('type')
      ? (searchParams.get('type')!.split(',') as SchoolType[])
      : undefined,
  }

  const results = await ragService.query(params)
  return Response.json({ results })
}
