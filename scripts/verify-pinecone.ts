/**
 * Pinecone index health-check + bootstrap.
 *
 * Verifies the configured PINECONE_INDEX exists, creates it if missing
 * (serverless, dim 1536 for text-embedding-3-small, cosine metric),
 * then prints vector counts per namespace.
 *
 * Usage: pnpm verify:pinecone
 */
import { Pinecone } from '@pinecone-database/pinecone'

const INDEX = process.env.PINECONE_INDEX ?? 'pathwayai-schools'
const DIMENSION = 1536 // text-embedding-3-small

async function main() {
  if (!process.env.PINECONE_API_KEY) {
    console.error('PINECONE_API_KEY not set in environment')
    process.exit(1)
  }

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })

  const list = await pc.listIndexes()
  const existing = list.indexes?.find((i) => i.name === INDEX)

  if (!existing) {
    console.log(`Index "${INDEX}" not found. Creating serverless index...`)
    await pc.createIndex({
      name: INDEX,
      dimension: DIMENSION,
      metric: 'cosine',
      spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
      waitUntilReady: true,
    })
    console.log(`Created index "${INDEX}".`)
  } else {
    console.log(`Index "${INDEX}" exists (dim=${existing.dimension}, metric=${existing.metric}).`)
  }

  const index = pc.index(INDEX)
  const stats = await index.describeIndexStats()
  console.log('\nIndex stats:')
  console.log(`  total vectors: ${stats.totalRecordCount ?? 0}`)
  console.log(`  namespaces:`)
  const namespaces = (stats.namespaces ?? {}) as Record<string, { recordCount?: number }>
  for (const [ns, info] of Object.entries(namespaces)) {
    console.log(`    "${ns}": ${info.recordCount ?? 0} vectors`)
  }
  if (Object.keys(namespaces).length === 0) {
    console.log('    (none — run pnpm ingest:cds and pnpm ingest:ipeds to populate)')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
