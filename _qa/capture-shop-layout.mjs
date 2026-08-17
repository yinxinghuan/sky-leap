import { chromium } from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'

const baseUrl = process.env.SKY_LEAP_QA_URL || 'http://127.0.0.1:4178/'
const outDir = new URL('./ui/logo-height-compat/', import.meta.url)
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const results = []

for (const viewport of [
  { width: 390, height: 844, label: '390x844' },
  { width: 390, height: 630, label: '390x630' },
  { width: 320, height: 568, label: '320x568' },
]) {
  const page = await browser.newPage({ viewport })
  const errors = []
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('guest-shell')) errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
  await page.locator('#collectionEntry').click()
  await page.locator('#shop.show').waitFor()
  await page.waitForTimeout(900)

  const layout = await page.evaluate(() => {
    const rect = selector => {
      const box = document.querySelector(selector)?.getBoundingClientRect()
      return box && { top: box.top, bottom: box.bottom, height: box.height }
    }
    const sheet = rect('.shop-sheet')
    const action = rect('#shopAction')
    const close = rect('#shopClose')
    return {
      viewport: { width: innerWidth, height: innerHeight },
      sheet,
      action,
      close,
      actionVisible: Boolean(action && sheet && action.top >= sheet.top && action.bottom <= sheet.bottom),
      closeVisible: Boolean(close && sheet && close.top >= sheet.top && close.bottom <= sheet.bottom),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    }
  })

  const path = new URL(`after-platform-layout-shop-${viewport.label}.png`, outDir)
  await page.screenshot({ path: path.pathname, fullPage: true })
  results.push({ label: viewport.label, layout, errors })
  await page.close()
}

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.locator('#shop').waitFor({ state: 'attached' })
  await page.evaluate(() => document.querySelector('#collectionEntry')?.click())
  await page.waitForFunction(() => document.querySelector('#shop')?.classList.contains('show'))
  await page.waitForTimeout(900)
  await page.screenshot({ path: new URL('after-external-guest-shop-390x844.png', outDir).pathname, fullPage: true })
  results.push({
    label: 'external-guest-390x844',
    guestBannerPresent: await page.locator('#alteru-guest-banner').count() > 0,
    errors,
  })
  await page.close()
}

await browser.close()
console.log(JSON.stringify(results, null, 2))
