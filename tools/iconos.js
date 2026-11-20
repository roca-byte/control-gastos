/* Genera icons/icon-192.png e icons/icon-512.png a partir de icons/icon.svg.
 * Uso:  node tools/iconos.js   (necesita Playwright). Volver a correrlo si cambia el SVG.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '..', 'icons', 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  for (const lado of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: lado, height: lado } });
    await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${lado}px;height:${lado}px}</style>${svg}`);
    await page.screenshot({ path: path.join(__dirname, '..', 'icons', `icon-${lado}.png`) });
    await page.close();
  }
  await browser.close();
})();
