/**
 * Downloads IPEDS survey component CSV files from NCES and extracts them
 * into data/ipeds/. Run once before ingest-ipeds.ts.
 *
 * Usage: pnpm download:ipeds
 */

import https from 'https'
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'

const YEAR = '2023'
const YEAR_SHORT = YEAR.slice(2) // "23" — GR200 uses 2-digit year suffix
const OUT_DIR = path.join(process.cwd(), 'data', 'ipeds')

// IPEDS 2023 splits the data we need across four components:
//   HD     = Directory Information (INSTNM, CITY, STABBR, CONTROL, ICLEVEL)
//   IC_AY  = Student Charges Academic Year (TUITION2, TUITION3)
//   ADM    = Admissions (ADMCON7, SATVR/SATMT percentiles)
//   GR200  = Graduation Rate 200 (C150_4, C150_L4 completion rates)
// IC2023.zip (Educational Offerings) and GR2023.zip (cohort counts) do NOT
// have the columns we need — don't fetch them.
const FILES = [
  { name: 'HD', url: `https://nces.ed.gov/ipeds/datacenter/data/HD${YEAR}.zip` },
  { name: 'IC_AY', url: `https://nces.ed.gov/ipeds/datacenter/data/IC${YEAR}_AY.zip` },
  { name: 'ADM', url: `https://nces.ed.gov/ipeds/datacenter/data/ADM${YEAR}.zip` },
  { name: 'GR200', url: `https://nces.ed.gov/ipeds/datacenter/data/GR200_${YEAR_SHORT}.zip` },
]

async function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location!, dest).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} fetching ${url}`))
        return
      }
      const file = fs.createWriteStream(dest)
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
      file.on('error', reject)
    }).on('error', reject)
  })
}

async function main() {
  console.log(`Downloading IPEDS ${YEAR} data to ${OUT_DIR}/\n`)

  for (const { name, url } of FILES) {
    const zipPath = path.join(OUT_DIR, `${name}${YEAR}.zip`)
    console.log(`Downloading ${name}${YEAR}.zip...`)
    await download(url, zipPath)

    console.log(`Extracting ${name}${YEAR}.zip...`)
    const zip = new AdmZip(zipPath)
    zip.extractAllTo(OUT_DIR, true)

    const entries = zip.getEntries().map((e) => e.entryName)
    console.log(`  Extracted: ${entries.join(', ')}`)
    fs.unlinkSync(zipPath)
    console.log(`  Done.\n`)
  }

  console.log('All IPEDS files downloaded.')
  console.log('\nIMPORTANT: Verify CSV column names match FIELD_NAMES in scripts/ingest-ipeds.ts')
  console.log('Run: head -1 data/ipeds/ic2023.csv | tr "," "\\n" | head -30')
}

main().catch((err) => { console.error(err); process.exit(1) })
