import { expect, test } from '@playwright/test';

// C-015 regression lane: viewport symbology colors stay synchronized with the
// DOM token palette through a high-contrast round trip. Token pairs are the
// authority table in docs/defense-readiness/visual_token_manifest_v1.md.

const STANDARD = { redForce: '#ff3333', blueForce: '#4a9eff', yellowUnknown: '#ffcc00' };
const HIGH_CONTRAST = { redForce: '#ff6a6a', blueForce: '#7bc6ff', yellowUnknown: '#ffe066' };

async function getPalette(page) {
  return page.evaluate(() => window.__TAK_FLOW_TEST__.getPaletteState());
}

function expectSynced(state, expectedTokens) {
  expect(state.tokens.redForce.toLowerCase()).toBe(expectedTokens.redForce);
  expect(state.tokens.blueForce.toLowerCase()).toBe(expectedTokens.blueForce);
  expect(state.tokens.yellowUnknown.toLowerCase()).toBe(expectedTokens.yellowUnknown);
  // The 3D palette must equal the CSS tokens, not just change.
  expect(state.palette.hostile.toLowerCase()).toBe(expectedTokens.redForce);
  expect(state.palette.friendly.toLowerCase()).toBe(expectedTokens.blueForce);
  expect(state.palette.unknown.toLowerCase()).toBe(expectedTokens.yellowUnknown);
}

test.describe('TAK-FLOW palette token sync', () => {
  test('3D palette follows CSS tokens through a high-contrast round trip', async ({ page }) => {
    await page.goto('/?e2e=1');
    await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));

    const initial = await getPalette(page);
    expect(initial.isHighContrast).toBe(false);
    expectSynced(initial, STANDARD);

    await page.evaluate(() => window.__TAK_FLOW_TEST__.setHighContrast(true));
    await expect.poll(async () => (await getPalette(page)).palette.hostile.toLowerCase())
      .toBe(HIGH_CONTRAST.redForce);
    const contrasted = await getPalette(page);
    expect(contrasted.isHighContrast).toBe(true);
    expectSynced(contrasted, HIGH_CONTRAST);

    await page.evaluate(() => window.__TAK_FLOW_TEST__.setHighContrast(false));
    await expect.poll(async () => (await getPalette(page)).palette.hostile.toLowerCase())
      .toBe(STANDARD.redForce);
    const restored = await getPalette(page);
    expect(restored.isHighContrast).toBe(false);
    expectSynced(restored, STANDARD);
  });
});
