import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [size, name] of [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'apple-touch-icon.png']]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.goto('file://' + process.cwd() + '/icon.html');
  await page.evaluate(s => { const el = document.getElementById('icon'); el.setAttribute('width', s); el.setAttribute('height', s); }, size);
  await page.screenshot({ path: 'vercel/public/icons/' + name, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
await browser.close();
console.log('icons done');
