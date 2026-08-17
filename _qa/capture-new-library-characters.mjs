import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'

const baseUrl = process.env.SKY_LEAP_QA_URL || 'http://127.0.0.1:4178/'
const outDir = new URL('./ui/full-roster-56/', import.meta.url)
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
const errors = []
page.on('console', message => {
  if (message.type() === 'error' && !message.text().includes('guest-shell')) errors.push(message.text())
})
page.on('pageerror', error => errors.push(error.message))

await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
await page.locator('#collectionEntry').click()
await page.locator('#shop.show').waitFor()
await page.waitForFunction(() => !document.querySelector('#shopState')?.textContent?.includes('载入'))

const targets = new Map([
  ['余光街区电工林', 'people-afterlight-lin-390x844.png'],
  ['余光街区值守员乔', 'people-afterlight-jo-390x844.png'],
  ['熄光壳', 'monster-blackout-husk-390x844.png'],
  ['缆猎者', 'monster-cable-stalker-390x844.png'],
])
const seen = []

for (let index = 0; index < 56; index += 1) {
  const name = (await page.locator('#shopName').textContent())?.trim() || ''
  seen.push(name)
  const filename = targets.get(name)
  if (filename) {
    await page.waitForTimeout(180)
    await page.screenshot({ path: new URL(filename, outDir).pathname, fullPage: true })
  }
  if (index < 55) await page.locator('#shopNextBtn').click()
}

console.log(JSON.stringify({
  total: seen.length,
  unique: new Set(seen).size,
  targetsSeen: [...targets.keys()].filter(name => seen.includes(name)),
  horizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  errors,
}, null, 2))

await browser.close()
