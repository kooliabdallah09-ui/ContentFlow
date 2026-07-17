// Storage cleanup for ugc-assets — DRY RUN by default.
// Usage: node --env-file=.env.local /tmp/storage-cleanup.mjs [--delete]
//
// Safety model:
//  - Scans a broad set of DB tables and extracts EVERY ugc-assets path that
//    appears anywhere in any row (JSON-stringified, so jsonb components,
//    retryContext URLs, etc. are all caught).
//  - An object is only deletable if it is (a) not referenced anywhere AND
//    (b) older than 48 hours (protects in-flight generations).

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const DELETE = process.argv.includes('--delete')
const BUCKET = 'ugc-assets'
const MIN_AGE_MS = 48 * 3600 * 1000

const TABLES = [
  'ugc_content', 'content', 'brand_profiles', 'user_saved_actors',
  'user_influencers', 'user_influencer_photos', 'templates',
  'content_calendar', 'profiles', 'batch_items', 'scheduled_jobs',
  'youtube_publish_queue', 'content_plans',
]

const headers = { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' }

async function fetchAllRows(table) {
  const rows = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1000&offset=${offset}`, { headers })
    if (!res.ok) { console.log(`  (skip ${table}: ${res.status})`); return rows }
    const batch = await res.json()
    rows.push(...batch)
    if (batch.length < 1000) break
  }
  return rows
}

// Extract every ugc-assets object path appearing anywhere in a string.
function extractPaths(str, into) {
  const re = /ugc-assets\/([A-Za-z0-9_\-./%]+)/g
  let m
  while ((m = re.exec(str)) !== null) {
    into.add(decodeURIComponent(m[1]).replace(/^\/+/, ''))
  }
}

async function listAllObjects(prefix = '') {
  const out = []
  let offset = 0
  while (true) {
    const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST', headers,
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    })
    const items = await res.json()
    if (!Array.isArray(items) || !items.length) break
    for (const it of items) {
      if (it.id === null) {
        out.push(...await listAllObjects(prefix ? `${prefix}/${it.name}` : it.name))
      } else {
        out.push({
          path: prefix ? `${prefix}/${it.name}` : it.name,
          size: it.metadata?.size ?? 0,
          created: new Date(it.created_at).getTime(),
        })
      }
    }
    if (items.length < 1000) break
    offset += 1000
  }
  return out
}

const referenced = new Set()
for (const t of TABLES) {
  const rows = await fetchAllRows(t)
  const before = referenced.size
  extractPaths(JSON.stringify(rows), referenced)
  console.log(`${t}: ${rows.length} rows, +${referenced.size - before} referenced paths`)
}
console.log(`\nTotal referenced storage paths: ${referenced.size}`)

const objects = await listAllObjects()
const now = Date.now()
let keepRef = 0, keepRecent = 0
const deletable = []
for (const o of objects) {
  if (referenced.has(o.path)) { keepRef++; continue }
  if (now - o.created < MIN_AGE_MS) { keepRecent++; continue }
  deletable.push(o)
}
const delMB = deletable.reduce((s, o) => s + o.size, 0) / 1024 / 1024
const totMB = objects.reduce((s, o) => s + o.size, 0) / 1024 / 1024

console.log(`\nBucket total: ${objects.length} files, ${totMB.toFixed(1)} MB`)
console.log(`Kept (referenced in DB): ${keepRef}`)
console.log(`Kept (younger than 48h): ${keepRecent}`)
console.log(`DELETABLE: ${deletable.length} files, ${delMB.toFixed(1)} MB`)

// Per-folder breakdown of deletable weight
const byFolder = {}
for (const o of deletable) {
  const folder = o.path.split('/')[0]
  byFolder[folder] = byFolder[folder] ?? { n: 0, mb: 0 }
  byFolder[folder].n++
  byFolder[folder].mb += o.size / 1024 / 1024
}
for (const [f, v] of Object.entries(byFolder).sort((a, b) => b[1].mb - a[1].mb)) {
  console.log(`  ${f}/: ${v.n} files, ${v.mb.toFixed(1)} MB`)
}

if (!DELETE) {
  console.log('\nDRY RUN — nothing deleted. Re-run with --delete to remove the files above.')
} else {
  console.log('\nDeleting…')
  for (let i = 0; i < deletable.length; i += 100) {
    const chunk = deletable.slice(i, i + 100).map(o => o.path)
    const res = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE', headers,
      body: JSON.stringify({ prefixes: chunk }),
    })
    if (!res.ok) console.log(`  chunk ${i / 100}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`)
    else console.log(`  deleted ${Math.min(i + 100, deletable.length)}/${deletable.length}`)
  }
  console.log('Done.')
}
