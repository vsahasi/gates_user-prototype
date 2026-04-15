# RAG Pipeline Design
**Date:** 2026-04-14
**Status:** Approved
**Deadline:** 2026-05-08

## Overview

Replace the in-memory `InMemoryRAGService` with a real vector-search-backed `PineconeRAGService`, fed by two ingest scripts that process IPEDS bulk CSV data and curated CDS JSON. The `IRAGService` interface is unchanged so the rest of the app requires no modifications.

---

## Architecture

### Two phases

**Ingest (run once before demo):**
```
IPEDS CSVs         → scripts/ingest-ipeds.ts → clean + chunk → OpenAI embeddings → Pinecone
src/lib/data/cds.ts → scripts/ingest-cds.ts  → clean + chunk → OpenAI embeddings → Pinecone
```

**Query (every chat request):**
```
intent classifier → PineconeRAGService.query() → metadata filter + vector search → top-5 chunks → prompt builder
```

### Pinecone index

- **Index name:** `pathwayai-schools`
- **Dimensions:** `1536` (OpenAI `text-embedding-3-small`)
- **Metric:** `cosine`
- **Region:** `us-east-1` (AWS serverless, free tier)
- **Namespace:** `schools`
- **Metadata fields:** `state`, `type`, `unitId`, `cipCodes`, `dataSource`, `dataYear`

### Service switch

```ts
// src/lib/services/rag.ts
export const ragService = process.env.PINECONE_API_KEY
  ? new PineconeRAGService()
  : new InMemoryRAGService() // fallback for local dev without keys
```

---

## Data Sources

### IPEDS

**Access:** Bulk CSV download from NCES data portal (most recent year available)

**Survey components to download:**

| Survey | File | Fields |
|--------|------|--------|
| IC (Institutional Characteristics) | `ic{year}.csv` | UNITID, INSTNM, CITY, STABBR, CONTROL, ICLEVEL, in/out-state tuition |
| ADM (Admissions) | `adm{year}.csv` | UNITID, SAT/ACT 25th/75th percentile, test score required flag |
| GR (Graduation Rates) | `gr{year}.csv` | UNITID, 150% completion rate |

**Filters:**
- `CONTROL = 1` (public institutions only)
- `ICLEVEL = 1` (4-year) or `ICLEVEL = 2` (2-year / community college)
- Tribal colleges included by UNITID allowlist (AIHEC member list)

**All 50 states** included.

**Chunk format (natural language, one per institution):**
```
{name} is a {type} in {city}, {state}. In-state tuition: ${X}/year.
Graduation rate: {Y}%. Test scores: {required/recommended/not required}.
SAT range: {25th}–{75th}. Programs offered in: {CIP code categories}.
Data year: {year}.
```

Natural language format is used (vs raw JSON) for better semantic retrieval quality.

### CDS (Common Data Set)

**Access:** Manually curated as `src/lib/data/cds.ts` — structured JSON with broad coverage across institution types and states.

**Fields per institution:**
- Regular decision and early decision deadlines
- Required application materials (test scores, letters of rec, essays)
- Types of financial aid offered
- Average aid package and % of students receiving aid
- Typical academic profile of admitted students

**Chunk format:** Same natural-language style as IPEDS, one chunk per institution. CDS chunks include deadline and aid data that IPEDS lacks.

---

## Ingest Scripts

### `scripts/ingest-ipeds.ts`

1. Read + parse IPEDS CSV files with `papaparse`
2. Join IC + ADM + GR on `UNITID`
3. Filter to public community colleges, 4-year publics, tribal colleges
4. Convert each institution to natural-language text chunk
5. Batch embed via OpenAI `text-embedding-3-small` (100 records/batch)
6. Upsert to Pinecone with metadata
7. Log progress and final record count

### `scripts/ingest-cds.ts`

1. Import `CDS_DATA` from `src/lib/data/cds.ts`
2. Convert each entry to natural-language text chunk
3. Embed + upsert to Pinecone (same pipeline as IPEDS)

Both scripts are run manually via:
```bash
npx ts-node scripts/ingest-ipeds.ts
npx ts-node scripts/ingest-cds.ts
```

---

## PineconeRAGService

**Location:** `src/lib/services/rag.ts` (new class alongside existing `InMemoryRAGService`)

**`query(params: RAGQueryParams)` flow:**
1. Embed the rewritten query using OpenAI `text-embedding-3-small`
2. Build Pinecone metadata filter from params (`state`, `type` if provided)
3. Query Pinecone — return top 5 results
4. Map Pinecone results → `RAGResult[]` (same shape as before)

**`getByIds(unitIds)` flow:**
1. Fetch vectors by ID from Pinecone
2. Return mapped `School[]`

**Error handling:** If Pinecone is unavailable, log the error and return `[]` (graceful degradation — the prompt builder already handles empty RAG results).

---

## New Dependencies

```json
"@pinecone-database/pinecone": "latest",
"openai": "latest",
"papaparse": "latest",
"@types/papaparse": "latest"
```

---

## New Environment Variables

```bash
PINECONE_API_KEY=        # from Pinecone console
PINECONE_INDEX=pathwayai-schools
OPENAI_API_KEY=          # for embeddings only (text-embedding-3-small)
```

Add to `.env.local.example`.

---

## Files Changed / Created

| File | Action |
|------|--------|
| `src/lib/services/rag.ts` | Add `PineconeRAGService`, update `ragService` export |
| `src/lib/data/cds.ts` | Create — curated CDS data for broad school coverage |
| `scripts/ingest-ipeds.ts` | Create — IPEDS CSV → Pinecone ingest script |
| `scripts/ingest-cds.ts` | Create — CDS JSON → Pinecone ingest script |
| `scripts/download-ipeds.ts` | Create — helper to download IPEDS CSV files from NCES |
| `.env.local.example` | Add `PINECONE_API_KEY`, `PINECONE_INDEX`, `OPENAI_API_KEY` |
| `package.json` | Add new dependencies |

---

## Out of Scope

- Hybrid BM25 + vector re-ranking (deferred — pure vector search sufficient for prototype)
- Automated IPEDS refresh pipeline (manual re-run before demo is sufficient)
- State-level financial aid data
- Non-degree pathway data (trade programs, apprenticeships, bootcamps)
