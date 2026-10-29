// Writes the nav links from lib/marketing-nav.json into the static landing
// (public/lp/index.html), between the nav-links markers. MarketingHeader reads
// the same JSON, so the landing and every other public page share one list.
import { readFileSync, writeFileSync } from 'node:fs'

const nav = JSON.parse(readFileSync(new URL('../lib/marketing-nav.json', import.meta.url), 'utf8'))
const file = new URL('../public/lp/index.html', import.meta.url)
const html = readFileSync(file, 'utf8')

// On the landing itself, "/#how" is just an in-page "#how".
const links = nav.map(n => `        <a href="${n.href.replace(/^\/#/, '#')}">${n.label}</a>`).join('\n')
const re = /(<!-- nav-links:start -->)[\s\S]*?(\n\s*<!-- nav-links:end -->)/
if (!re.test(html)) throw new Error('nav-links markers missing in public/lp/index.html')
const out = html.replace(re, `$1\n${links}$2`)
if (out !== html) writeFileSync(file, out)
console.log('landing nav synced:', nav.map(n => n.label).join(' | '))
