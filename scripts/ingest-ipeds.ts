/**
 * Reads downloaded IPEDS CSV files, joins IC + ADM + GR on UNITID,
 * filters to public community colleges and 4-year publics + tribal colleges,
 * converts each to a natural-language text chunk, embeds via OpenAI,
 * and upserts to Pinecone.
 *
 * Usage: pnpm ingest:ipeds
 * Prerequisites: pnpm download:ipeds
 */

import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'
import { Pinecone } from '@pinecone-database/pinecone'
import { embedBatch } from '../src/lib/services/embeddings'
import { formatIpedsChunk, buildIpedsMetadata, type IpedsRecord } from '../src/lib/utils/chunk-formatters'
import type { SchoolType } from '../src/lib/types'

// ── Field name configuration ─────────────────────────────────────────────────
// IPEDS 2023 splits the data we need across four files (see download-ipeds.ts):
//   HD     = Directory (INSTNM, CITY, STABBR, CONTROL, ICLEVEL) — primary source
//   IC_AY  = Tuition (TUITION2, TUITION3), joined on UNITID
//   ADM    = Admissions (ADMCON7, SAT percentiles), joined on UNITID
//   GR200  = Completion rates (C150_4, C150_L4), joined on UNITID
// If NCES changes column names between years, update these constants.
// To inspect headers: head -1 data/ipeds/hd2023.csv | tr "," "\n"
const HD_FIELDS = {
  unitId: 'UNITID',
  name: 'INSTNM',
  city: 'CITY',
  state: 'STABBR',
  control: 'CONTROL',    // 1=public, 2=private nonprofit, 3=private for-profit
  level: 'ICLEVEL',      // 1=4-year, 2=2-year, 3=<2-year
}

const IC_AY_FIELDS = {
  unitId: 'UNITID',
  tuitionInState: 'TUITION2',
  tuitionOutState: 'TUITION3',
}

const ADM_FIELDS = {
  unitId: 'UNITID',
  testReq: 'ADMCON7',    // 1=required, 2=recommended, 3=neither required/recommended, 5=not considered
  satVrLow: 'SATVR25',
  satVrHigh: 'SATVR75',
  satMtLow: 'SATMT25',
  satMtHigh: 'SATMT75',
}

const GR200_FIELDS = {
  unitId: 'UNITID',
  gradRate4yr: 'BAGR150', // Bachelor's cohort: 150% time grad rate (%)
  gradRate2yr: 'L4GR150', // Less-than-4-year cohort: 150% time grad rate (%)
}

// ── Tribal college UNITID allowlist (AIHEC member institutions) ──────────────
const TRIBAL_UNIT_IDS = new Set([
  '155061', // Haskell Indian Nations University
  '181446', // Salish Kootenai College
  '187897', // Diné College
  '386123', // Navajo Technical University
  '219976', // Sitting Bull College
  '200004', // Turtle Mountain Community College
  '200800', // United Tribes Technical College
  '216278', // Oglala Lakota College
  '219471', // Sinte Gleska University
  '174792', // Fond du Lac Tribal and Community College
  '169044', // Bay Mills Community College
  '180489', // Chief Dull Knife College
  '180347', // Fort Peck Community College
  '180694', // Little Big Horn College
  '181604', // Stone Child College
  '200217', // Fort Berthold Community College
  '199677', // Cankdeska Cikana Community College
  '175752', // Keweenaw Bay Ojibwa Community College
  '238616', // Lac Courte Oreilles Ojibwa Community College
  '238476', // College of Menominee Nation
  '445027', // Tohono O'odham Community College
  '444004', // Ilisagvik College
  '180176', // Aaniiih Nakoda College
  '180228', // Blackfeet Community College
  '219940', // Sisseton Wahpeton College
])

const DATA_DIR = path.join(process.cwd(), 'data', 'ipeds')
const YEAR = '2023'
const PINECONE_BATCH = 100

function parseCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf8')
  // IPEDS CSVs ship with a UTF-8 BOM on the first header (e.g. "\ufeffUNITID"),
  // which makes row['UNITID'] return undefined. Strip it via transformHeader.
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.replace(/^\ufeff/, ''),
  })
  if (result.errors.length > 0) {
    console.warn(`  Parse warnings in ${path.basename(filePath)}:`, result.errors.slice(0, 3))
  }
  return result.data
}

function toNum(val: string | undefined): number {
  const n = parseFloat(val ?? '')
  return isNaN(n) ? 0 : n
}

function toNumOrNull(val: string | undefined): number | null {
  const n = parseFloat(val ?? '')
  return isNaN(n) ? null : n
}

async function main() {
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! })
  const index = pinecone.index(process.env.PINECONE_INDEX ?? 'pathwayai-schools').namespace('schools')

  // ── Locate CSVs ────────────────────────────────────────────────────────────
  console.log('Loading IPEDS CSV files...')
  const files = fs.readdirSync(DATA_DIR)
  const findCsv = (prefix: string) =>
    files.find((f) => {
      const lower = f.toLowerCase()
      return lower.startsWith(prefix.toLowerCase()) && lower.endsWith('.csv') && !lower.includes('_rv')
    })

  const hdFile = findCsv(`hd${YEAR}`)
  const icAyFile = findCsv(`ic${YEAR}_ay`)
  const admFile = findCsv(`adm${YEAR}`)
  const gr200File = findCsv(`gr200_${YEAR.slice(2)}`)

  if (!hdFile || !icAyFile || !admFile || !gr200File) {
    console.error('Missing CSV files. Run: npm run download:ipeds')
    console.error(`  HD: ${hdFile ?? 'MISSING'}`)
    console.error(`  IC_AY: ${icAyFile ?? 'MISSING'}`)
    console.error(`  ADM: ${admFile ?? 'MISSING'}`)
    console.error(`  GR200: ${gr200File ?? 'MISSING'}`)
    console.error('Found files:', files.join(', '))
    process.exit(1)
  }

  console.log(`  HD: ${hdFile} | IC_AY: ${icAyFile} | ADM: ${admFile} | GR200: ${gr200File}`)

  const hdRows = parseCsv(path.join(DATA_DIR, hdFile))
  const icAyRows = parseCsv(path.join(DATA_DIR, icAyFile))
  const admRows = parseCsv(path.join(DATA_DIR, admFile))
  const gr200Rows = parseCsv(path.join(DATA_DIR, gr200File))

  console.log(
    `  HD: ${hdRows.length} rows | IC_AY: ${icAyRows.length} rows | ADM: ${admRows.length} rows | GR200: ${gr200Rows.length} rows`
  )

  // ── Build lookup maps (IC_AY + ADM + GR200 keyed by UNITID) ────────────────
  const icAyByUnitId = new Map(icAyRows.map((r) => [r[IC_AY_FIELDS.unitId], r]))
  const admByUnitId = new Map(admRows.map((r) => [r[ADM_FIELDS.unitId], r]))
  const grByUnitId = new Map(gr200Rows.map((r) => [r[GR200_FIELDS.unitId], r]))

  // ── Filter and join ────────────────────────────────────────────────────────
  console.log('\nFiltering institutions...')
  const records: IpedsRecord[] = []

  for (const hd of hdRows) {
    const unitId = hd[HD_FIELDS.unitId]
    const control = hd[HD_FIELDS.control]
    const level = hd[HD_FIELDS.level]
    const isPublic = control === '1'
    const is4Year = level === '1'
    const is2Year = level === '2'
    const isTribal = TRIBAL_UNIT_IDS.has(unitId)

    if (!isTribal && !(isPublic && (is4Year || is2Year))) continue

    const icAy = icAyByUnitId.get(unitId)
    const adm = admByUnitId.get(unitId)
    const gr = grByUnitId.get(unitId)

    const satVrLow = adm ? toNumOrNull(adm[ADM_FIELDS.satVrLow]) : null
    const satVrHigh = adm ? toNumOrNull(adm[ADM_FIELDS.satVrHigh]) : null
    const satMtLow = adm ? toNumOrNull(adm[ADM_FIELDS.satMtLow]) : null
    const satMtHigh = adm ? toNumOrNull(adm[ADM_FIELDS.satMtHigh]) : null

    const satLow = satVrLow !== null && satMtLow !== null ? satVrLow + satMtLow : null
    const satHigh = satVrHigh !== null && satMtHigh !== null ? satVrHigh + satMtHigh : null

    const gradRate4 = gr ? toNumOrNull(gr[GR200_FIELDS.gradRate4yr]) : null
    const gradRate2 = gr ? toNumOrNull(gr[GR200_FIELDS.gradRate2yr]) : null
    const gradRateRaw = gradRate4 ?? gradRate2 ?? 0
    const gradRate = gradRateRaw / 100

    let type: SchoolType = is2Year ? 'community_college' : '4_year_public'
    if (isTribal) type = 'tribal'

    records.push({
      unitId,
      name: hd[HD_FIELDS.name],
      city: hd[HD_FIELDS.city],
      state: hd[HD_FIELDS.state],
      type,
      inStateTuition: toNum(icAy?.[IC_AY_FIELDS.tuitionInState]),
      outOfStateTuition: toNum(icAy?.[IC_AY_FIELDS.tuitionOutState]),
      gradRate,
      requiresTestScore: adm ? adm[ADM_FIELDS.testReq] === '1' : false,
      satRangeLow: satLow && satLow > 0 ? satLow : null,
      satRangeHigh: satHigh && satHigh > 0 ? satHigh : null,
      cipCodes: [],
      dataYear: parseInt(YEAR),
    })
  }

  console.log(`  Kept ${records.length} institutions after filtering`)

  // ── Embed and upsert in batches ────────────────────────────────────────────
  console.log('\nEmbedding and upserting to Pinecone...')

  for (let i = 0; i < records.length; i += PINECONE_BATCH) {
    const batch = records.slice(i, i + PINECONE_BATCH)
    const texts = batch.map(formatIpedsChunk)
    const embeddings = await embedBatch(texts)

    const vectors = batch.map((record, j) => ({
      id: `ipeds_${record.unitId}`,
      values: embeddings[j],
      metadata: buildIpedsMetadata(record),
    }))

    await index.upsert({ records: vectors })
    console.log(`  Upserted ${Math.min(i + PINECONE_BATCH, records.length)}/${records.length}`)
  }

  console.log(`\nDone. ${records.length} IPEDS institutions indexed in Pinecone.`)
}

main().catch((err) => { console.error(err); process.exit(1) })
