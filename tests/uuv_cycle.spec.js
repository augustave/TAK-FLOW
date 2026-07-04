import { expect, test } from '@playwright/test';

// UUV dive-cycle coverage: submerged UUVs enter EMCON regardless of EW zones,
// surfaced UUVs track normally and are designable. The live cycle is a
// wall-clock sine (~125s period), so the e2e depth override pins it.

const ENTITY = { UUV_SURFACED: 3, UUV_SUBMERGED: 4 };

async function setupUuvApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));

  await page.evaluate(() => {
    const api = window.__TAK_FLOW_TEST__;
    const trackManager = window.opsLogInstance.exportContextGetter().trackManager;
    // Generated SW- ids only: named UUVs (ORCA-H1, SNAKE-1) collide in the
    // numeric id map (both reduce to digits "1"/"2").
    api.findLiveUuv = (entityType) => {
      for (const [id, state] of trackManager.liveTrackStateById.entries()) {
        if (id.startsWith('SW-') && state.entityType === entityType) {
          return { id, confidence: state.confidence, entityType: state.entityType };
        }
      }
      return null;
    };
  });
}

test.describe('TAK-FLOW UUV dive cycle', () => {
  test.setTimeout(120000);

  test('surfaced UUVs are designable, submerged UUVs run EMCON decay', async ({ page }) => {
    await setupUuvApi(page);

    // 1. Force everything to the surface: UUVs report entityType 3 and a
    // HIGH-threat surfaced UUV clears the 0.6 designation gate.
    await page.evaluate(() => window.__TAK_FLOW_TEST__.setUuvDepthOverride(0));
    let surfaced = null;
    await expect.poll(async () => {
      surfaced = await page.evaluate(() => window.__TAK_FLOW_TEST__.findLiveUuv(3));
      return Boolean(surfaced && surfaced.confidence >= 0.6);
    }, { timeout: 20000 }).toBe(true);

    const designable = await page.evaluate(
      (id) => window.__TAK_FLOW_TEST__.canDesignate(id),
      surfaced.id
    );
    expect(designable).toBe(true);

    // 2. Submerge: entityType flips to 4 and EMCON alpha-decay begins
    // (confidence strictly below full despite no EW-zone membership).
    await page.evaluate(() => window.__TAK_FLOW_TEST__.setUuvDepthOverride(-20));
    await expect.poll(async () => page.evaluate(() => {
      const submerged = window.__TAK_FLOW_TEST__.findLiveUuv(4);
      return submerged ? submerged.confidence : 1;
    }), { timeout: 20000 }).toBeLessThan(1.0);

    // 3. Resurface: EMCON state clears and full-confidence surfaced UUVs return.
    await page.evaluate(() => window.__TAK_FLOW_TEST__.setUuvDepthOverride(0));
    await expect.poll(async () => page.evaluate(() => {
      const resurfaced = window.__TAK_FLOW_TEST__.findLiveUuv(3);
      return resurfaced ? resurfaced.confidence : 0;
    }), { timeout: 20000 }).toBe(1.0);

    await page.evaluate(() => window.__TAK_FLOW_TEST__.setUuvDepthOverride(null));
  });
});
