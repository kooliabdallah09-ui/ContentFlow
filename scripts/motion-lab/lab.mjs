// Motion lab: test and tune the Motion Ads writer without paying for API calls.
// A person (or Claude Code) plays the writer model by hand, using the exact
// brief the app would send; this script prepares that brief and renders the
// result with the app's own compiler, kit, music and effects.
//
//   node scripts/motion-lab/lab.mjs prep <url> [slug]   fetch the site: text, image, logo, colours, screenshot
//   (edit motion-lab/runs/<slug>/brief.json: brandName, product, cta, tone…)
//   node scripts/motion-lab/lab.mjs request <slug>      write request.md: the brief exactly as the model gets it
//   (write motion-lab/runs/<slug>/ad.tsx, following MOTION_SYSTEM_PROMPT)
//   node scripts/motion-lab/lab.mjs stills <slug> [frames|auto]   render JPEG stills (default: 10 spread out)
//   node scripts/motion-lab/lab.mjs render <slug>       render ad.mp4
//   node scripts/motion-lab/lab.mjs view <slug>         open it in a player at http://localhost:4747

import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const RUNS = path.join(ROOT, 'motion-lab/runs')
const CACHE = path.join(RUNS, '.cache')
const PORT = 4747
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129 Safari/537.36'

const [cmd, arg1, arg2] = process.argv.slice(2)
const runDir = slug => path.join(RUNS, slug)

async function app() {
  const outfile = path.join(CACHE, 'node-entry.mjs')
  await build({
    entryPoints: [path.join(ROOT, 'scripts/motion-lab/node-entry.ts')], outfile, bundle: true, platform: 'node', format: 'esm',
    alias: { '@': ROOT }, external: ['@anthropic-ai/sdk'], logLevel: 'warning',
  })
  process.env.ANTHROPIC_API_KEY ||= 'unused-by-the-lab'
  return import(pathToFileURL(outfile).href + '?' + Date.now())
}

async function download(url, accept = 'image/*') {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, signal: AbortSignal.timeout(30_000) })
    if (!r.ok) return null
    return { bytes: Buffer.from(await r.arrayBuffer()), type: (r.headers.get('content-type') ?? '').split(';')[0].trim(), url: r.url }
  } catch { return null }
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }

async function firstImage(urls, dir, name) {
  for (const u of urls) {
    const f = await download(u)
    if (f && EXT[f.type]) {
      const file = `${name}.${EXT[f.type]}`
      await writeFile(path.join(dir, file), f.bytes)
      return file
    }
  }
  return null
}

async function prep(url, slug) {
  const full = /^https?:\/\//i.test(url) ? url : `https://${url}`
  slug ||= new URL(full).hostname.replace(/^www\./, '').replace(/\W+/g, '-')
  const dir = runDir(slug)
  await mkdir(dir, { recursive: true })
  const { extractBrand } = await app()

  const page = await download(full, 'text/html')
  if (!page) throw new Error(`Could not fetch ${full}`)
  const html = page.bytes.toString('utf8')
  const text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 6000)
  await writeFile(path.join(dir, 'page.txt'), text)

  const found = extractBrand(html, page.url)
  // Same Microlink call as /api/screenshot with compact: true.
  const shotApi = `https://api.microlink.io/?url=${encodeURIComponent(full)}&screenshot=true&meta=false&viewport.width=1440&viewport.height=900&type=jpeg&quality=85&viewport.deviceScaleFactor=1`
  const [image, logo, siteShot] = await Promise.all([
    firstImage(found.images, dir, 'image'),
    firstImage(found.logos, dir, 'logo'),
    download(shotApi, 'application/json').then(async r => {
      const shotUrl = r && JSON.parse(r.bytes.toString()).data?.screenshot?.url
      return shotUrl ? firstImage([shotUrl], dir, 'siteShot') : null
    }).catch(() => null),
  ])

  const brief = {
    brandName: '', product: '', audience: '', idea: '', cta: '',
    website: new URL(full).hostname.replace(/^www\./, ''),
    tone: 'playful', trackKey: 'happy-times',
    hasProductImage: !!image, hasLogo: !!logo, hasSiteShot: !!siteShot,
    brandColors: found.colors.length ? found.colors : undefined,
    storyboard: null,
    files: { image, logo, siteShot },
  }
  await writeFile(path.join(dir, 'brief.json'), JSON.stringify(brief, null, 2))
  console.log(`${slug}: image ${image ?? '—'}, logo ${logo ?? '—'}, screenshot ${siteShot ?? '—'}, colours ${found.colors.join(' ') || '—'}`)
  console.log(`Fill brandName / product / cta in ${path.relative(ROOT, dir)}/brief.json from page.txt (the app uses Haiku for this).`)
}

async function request(slug) {
  const { briefText, MOTION_PLAN_PROMPT } = await app()
  const brief = JSON.parse(await readFile(path.join(runDir(slug), 'brief.json'), 'utf8'))
  const shot = brief.hasSiteShot ? `[Image: ${brief.files.siteShot}, "Screenshot of the brand's real website (the design to copy):"]\n\n` : ''
  const out = [
    '# System prompt: MOTION_SYSTEM_PROMPT in lib/motion/prompt.ts (with kit-docs.ts and example-ad.ts)',
    '',
    brief.storyboard ? '# Write request' : '# Plan request (then write, with the storyboard added to brief.json)',
    '',
    shot + (brief.storyboard ? 'Write the ad for this brief.\n\n' : 'Brief:\n') + briefText(brief),
    brief.storyboard ? '' : '\n' + MOTION_PLAN_PROMPT,
  ].join('\n')
  await writeFile(path.join(runDir(slug), 'request.md'), out)
  console.log(out)
}

async function serve(onPost) {
  const viewer = path.join(CACHE, 'viewer.js')
  await build({
    entryPoints: [path.join(ROOT, 'scripts/motion-lab/viewer.tsx')], outfile: viewer, bundle: true, format: 'iife',
    target: 'es2022', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
  })
  const types = { '.wav': 'audio/wav', '.flac': 'audio/flac', '.mp4': 'video/mp4', '.js': 'text/javascript', '.json': 'application/json', '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.tsx': 'text/plain' }
  const server = createServer(async (req, res) => {
    const u = new URL(req.url, `http://localhost:${PORT}`)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges')
    if (req.method === 'OPTIONS') return res.end()
    if (req.method === 'POST') {
      const chunks = []
      for await (const c of req) chunks.push(c)
      await onPost?.(u, Buffer.concat(chunks))
      return res.end('ok')
    }
    if (u.pathname === '/') {
      res.setHeader('Content-Type', 'text/html')
      return res.end('<!doctype html><meta charset="utf-8"><body style="margin:0;background:#111"><div id="root"></div><script src="/viewer.js"></script>')
    }
    const file = u.pathname === '/viewer.js' ? viewer
      : u.pathname.startsWith('/motion-lab/runs/') ? path.join(ROOT, decodeURIComponent(u.pathname))
      : u.pathname.startsWith('/pack/') ? path.join(ROOT, 'Social SFX Pack - Collection 1', decodeURIComponent(u.pathname.slice(6)))
      : path.join(ROOT, 'public', decodeURIComponent(u.pathname))
    if (!file.startsWith(ROOT) || !existsSync(file)) { res.statusCode = 404; return res.end() }
    const data = await readFile(file)
    res.setHeader('Content-Type', types[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
    res.setHeader('Accept-Ranges', 'bytes')
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '')
    if (range) {
      const start = range[1] ? Number(range[1]) : data.length - Number(range[2])
      const end = range[1] && range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1
      res.statusCode = 206
      res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`)
      return res.end(data.subarray(start, end + 1))
    }
    res.end(data)
  })
  await new Promise(r => server.listen(PORT, r))
  return server
}

async function headless(slug, query) {
  const dir = runDir(slug)
  if (!existsSync(path.join(dir, 'ad.tsx'))) throw new Error(`No ad.tsx in ${dir}`)
  if (query.startsWith('stills')) for (const f of await readdir(dir)) if (f.startsWith('still-')) await rm(path.join(dir, f))
  let chrome
  const result = await new Promise(async resolve => {
    const server = await serve(async (u, body) => {
      if (u.pathname === '/save') await writeFile(path.join(dir, path.basename(u.searchParams.get('name'))), body)
      if (u.pathname === '/done') { server.close(); resolve(body.toString()) }
    })
    const profile = path.join(CACHE, 'chrome-profile')
    chrome = spawn(CHROME, ['--headless=new', '--disable-gpu-sandbox', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${profile}`,
      '--no-first-run', `http://localhost:${PORT}/?slug=${encodeURIComponent(slug)}&${query}`], { stdio: 'ignore' })
    setTimeout(() => { server.close(); resolve('ERROR timed out') }, 10 * 60_000)
  })
  chrome.kill()
  console.log(result === 'ok' ? `done → ${path.relative(ROOT, dir)}` : result)
  if (result !== 'ok') process.exitCode = 1
  process.exit()
}

// Server render: bundles the ad with Remotion's bundler and renders it in local
// Chrome, where the whole of CSS works. Assets are served by the lab server.
async function serverRender(slug, frames) {
  const { bundle } = await import('@remotion/bundler')
  const { renderMedia, renderStill, selectComposition } = await import('@remotion/renderer')
  const dir = runDir(slug)
  const brief = JSON.parse(await readFile(path.join(dir, 'brief.json'), 'utf8'))
  const server = await serve()
  const base = `http://localhost:${PORT}/motion-lab/runs/${encodeURIComponent(slug)}/`
  const url = f => (f ? base + f.split('/').map(encodeURIComponent).join('/') : null)
  const f = brief.files ?? {}
  const sfxNames = ['click', 'pop', 'switch', 'whoosh', 'tick', 'type', 'impact', 'bonk', 'success', 'bong', 'error', 'glitch']
  const inputProps = {
    assets: {
      productImage: brief.hasProductImage ? url(f.image) : null, logo: brief.hasLogo ? url(f.logo) : null, siteShot: brief.hasSiteShot ? url(f.siteShot) : null,
      images: (f.images ?? []).map(url), videos: (f.videos ?? []).map(url), voice: url(f.voice), pack: `http://localhost:${PORT}/pack/`, base,
    },
    audio: {
      music: f.music ? { src: url(f.music), offset: brief.musicOffset ?? 0 } : null,
      sfx: Object.fromEntries(sfxNames.map(n => [n, `http://localhost:${PORT}/motion-audio/sfx/${n}.mp3`])),
    },
  }
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'scripts/motion-lab/remotion-entry.tsx'),
    webpackOverride: c => ({ ...c, resolve: { ...c.resolve, alias: { ...(c.resolve?.alias ?? {}), 'lab-ad': path.join(dir, 'ad.tsx'), '@motion-kit': path.join(ROOT, 'lib/motion/kit/index.ts') } } }),
  })
  const opts = { serveUrl, inputProps, browserExecutable: CHROME, chromiumOptions: { gl: 'angle' } }
  const composition = await selectComposition({ ...opts, id: 'ad' })
  if (frames) {
    for (const fr of await readdir(dir)) if (fr.startsWith('still-')) await rm(path.join(dir, fr))
    const list = frames === 'auto' ? Array.from({ length: 10 }, (_, i) => Math.round((i + 0.5) * composition.durationInFrames / 10)) : frames.split(',').map(Number)
    for (const frame of list) {
      await renderStill({ ...opts, composition, frame, output: path.join(dir, `still-${String(frame).padStart(3, '0')}.jpg`), imageFormat: 'jpeg', jpegQuality: 85, scale: 0.5 })
    }
  } else {
    await renderMedia({ ...opts, composition, codec: 'h264', crf: 16, outputLocation: path.join(dir, 'ad.mp4'),
      onProgress: ({ progress }) => process.stdout.write(`\r${Math.round(progress * 100)}%`) })
    console.log()
  }
  server.close()
  console.log(`done → ${path.relative(ROOT, dir)}`)
}

if (cmd === 'sstills' && arg1) await serverRender(arg1, arg2 || 'auto')
else if (cmd === 'srender' && arg1) await serverRender(arg1, null)
else if (cmd === 'prep' && arg1) await prep(arg1, arg2)
else if (cmd === 'request' && arg1) await request(arg1)
else if (cmd === 'stills' && arg1) await headless(arg1, `stills=${arg2 || 'auto'}`)
else if (cmd === 'render' && arg1) await headless(arg1, 'render=1')
else if (cmd === 'view' && arg1) { await serve(); console.log(`http://localhost:${PORT}/?slug=${encodeURIComponent(arg1)}  (Ctrl+C to stop)`) }
else { console.log('usage: lab.mjs prep <url> [slug] | request <slug> | stills <slug> [frames|auto] | render <slug> | view <slug>'); process.exitCode = 1 }
