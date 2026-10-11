const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    for (const language of ['', 'fr/']) {
      await page.goto(pathToFileURL(path.resolve(__dirname, '..', language, 'series/ladies.html')).href);
      // Resize the same page to exercise rotation without reloading the images.
      for (const [width, height] of [[390, 844], [844, 390], [320, 568], [430, 932], [900, 600], [901, 600], [1280, 800]]) {
        await page.setViewportSize({ width, height });
        const panels = await page.locator('.side-caption img').evaluateAll(images => images.map(image => {
          const bounds = image.getBoundingClientRect();
          const caption = image.parentElement.querySelector('.prompt-box').getBoundingClientRect();
          const style = getComputedStyle(image);
          return {
            loaded: image.complete && image.naturalWidth > 0,
            left: bounds.left,
            right: bounds.right,
            contentWidth: bounds.width - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth),
            contentHeight: bounds.height - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth),
            stacked: bounds.bottom <= caption.top + 1 || caption.bottom <= bounds.top + 1,
          };
        }));
        assert.equal(panels.length, 2);
        for (const panel of panels) {
          const label = `${language || 'en/'}ladies at ${width}×${height}`;
          assert.ok(panel.loaded, `${label}: image did not load`);
          assert.ok(panel.contentWidth > 100 && panel.contentHeight > 100, `${label}: image collapsed`);
          assert.ok(panel.left >= 0 && panel.right <= width + 1, `${label}: image outside viewport`);
          assert.equal(panel.stacked, width <= 900, `${label}: incorrect caption layout`);
        }
        const pair = await page.locator('.step:not(.side-caption) img').evaluateAll(images => images.map(image => {
          const bounds = image.getBoundingClientRect();
          return { top: bounds.top, width: bounds.width };
        }));
        assert.equal(pair.length, 2);
        assert.ok(pair.every(image => image.width > 100));
        assert.ok(Math.abs(pair[0].top - pair[1].top) < 1, 'Paired panels should stay side by side');
      }
    }
    console.log('PASS: French and English images remain visible across 7 viewport sizes and rotation.');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
