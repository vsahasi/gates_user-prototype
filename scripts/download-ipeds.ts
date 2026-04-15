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
const OUT_DIR = path.join(process.cwd(), 'data', 'ipeds')

const FILES = [
  { name: 'IC', url: `https://nces.ed.gov/ipeds/datacenter/data/IC${YEAR}.zip` },
  { name: 'ADM', url: `https://nces.ed.gov/ipeds/datacenter/data/ADM${YEAR}.zip` },
  { name: 'GR', url: `https://nces.ed.gov/ipeds/datacenter/data/GR${YEAR}.zip` },
]

async function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        download(res.headers.location!, dest).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
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
