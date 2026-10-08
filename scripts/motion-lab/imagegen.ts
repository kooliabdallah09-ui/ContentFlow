// Motion lab: generate art-directed stills with the app's Nano Banana helper.
// Usage (via lab.mjs bundling): node imagegen.mjs <outDir> <prompts.json>
import { writeFileSync, readFileSync } from 'node:fs'
import { generateNanoBananaImage } from '../../lib/nanobanana'

const [outDir, promptsFile] = process.argv.slice(2)
const { style, items } = JSON.parse(readFileSync(promptsFile, 'utf8')) as { style: string; items: Array<{ name: string; prompt: string; ratio?: '9:16' | '16:9' | '1:1' | '3:4'; model?: 'pro' | 'nb2' }> }

await Promise.all(items.map(async it => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await generateNanoBananaImage(`${it.prompt}\n\n${style}`, { raw: true, ratio: it.ratio ?? '9:16', model: it.model ?? 'nb2' })
      const ext = r.mimeType.includes('png') ? 'png' : 'jpg'
      writeFileSync(`${outDir}/${it.name}.${ext}`, Buffer.from(r.imageBase64, 'base64'))
      console.log('ok', it.name)
      return
    } catch (e) { console.log('retry', it.name, (e as Error).message.slice(0, 120)) }
  }
}))
