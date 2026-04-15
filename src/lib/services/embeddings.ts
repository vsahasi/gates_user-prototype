import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const MODEL = 'text-embedding-3-small'
const BATCH_SIZE = 100

/**
 * Embed a single text string.
 */
export async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({ model: MODEL, input: text })
  return res.data[0].embedding
}

/**
 * Embed an array of texts in batches of BATCH_SIZE.
 * Returns embeddings in the same order as input texts.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const res = await openai.embeddings.create({ model: MODEL, input: batch })
    const sorted = res.data.sort((a, b) => a.index - b.index)
    results.push(...sorted.map((r) => r.embedding))
    console.log(`  Embedded ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length}`)
  }
  return results
}
