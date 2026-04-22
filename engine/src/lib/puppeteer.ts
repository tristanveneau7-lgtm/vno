import puppeteer from 'puppeteer'

/**
 * Take an above-the-fold PNG screenshot of a URL using headless Chromium.
 *
 * 1440x900 viewport mirrors a standard laptop hero section — large enough
 * to capture the layout, small enough to keep token cost reasonable when
 * fed to Claude vision. networkidle2 gives the page a chance to finish
 * fetching fonts/images before the shot, with a 30s ceiling so a broken
 * reference doesn't hang the whole build.
 */
export async function screenshotUrl(url: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    const screenshot = await page.screenshot({
      fullPage: false, // above-the-fold only — Claude vision works better on a clean hero shot
      type: 'png',
    })
    return screenshot as Buffer
  } finally {
    await browser.close()
  }
}
