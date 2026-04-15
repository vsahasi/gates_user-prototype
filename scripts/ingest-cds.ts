/**
 * Reads curated CDS data from src/lib/data/cds.ts, converts each entry
 * to a natural-language text chunk, embeds via OpenAI, and upserts to Pinecone.
 *
 * Usage: pnpm ingest:cds
 */

import { Pinecone } from '@pinecone-database/pinecone'
import { CDS_DATA } from '../src/lib/data/cds'
import { embedBatch } from '../src/lib/services/embeddings'
import { formatCdsChunk, buildCdsMetadata } from '../src/lib/utils/chunk-formatters'

const PINECONE_BATCH = 100

async function main() {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  const index = pinecone.index(process.env.PINECONE_INDEX ?? 'pathwayai-schools').namespace('schools')

  console.log(`Ingesting ${CDS_DATA.length} CDS entries into Pinecone...\n`)

  for (let i = 0; i < CDS_DATA.length; i += PINECONE_BATCH) {
    const batch = CDS_DATA.slice(i, i + PINECONE_BATCH)
    const texts = batch.map(formatCdsChunk)
    const embeddings = await embedBatch(texts)

    const records = batch.map((entry, j) => ({
      id: `cds_${entry.unitId}`,
      values: embeddings[j],
      metadata: buildCdsMetadata(entry),
    }))

    await index.upsert({ records })
    console.log(`  Upserted ${Math.min(i + PINECONE_BATCH, CDS_DATA.length)}/${CDS_DATA.length}`)
  }

  console.log(`\nDone. ${CDS_DATA.length} CDS entries indexed in Pinecone.`)
}

main().catch((err) => { console.error(err); process.exit(1) })
