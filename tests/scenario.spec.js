import { expect, test } from '@playwright/test';

// TP-009: scenario load/clear controls and deterministic state transitions.

async function setupScenarioApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));

  await page.evaluate(() => {
    const api = window.__TAK_FLOW_TEST__;
    const trackManager = window.opsLogInstance.exportContextGetter().trackManager;

    api.findLiveSingle = () => {
      for (const [id, state] of trackManager.liveTrackStateById.entries()) {
        if (id.startsWith('SW-') && state.entityType === 5) {
          return { id, x: state.x, y: state.y, confidence: state.confidence };
        }
      }
      return null;
    };

    // Min confidence across live singles, EMCON (type 2) included — under a
    // play-area-wide zone every single flips to type 2, so a type-5-only scan
    // would go blind exactly when decay is happening.
    api.minSingleConfidence = () => {
      let min = Infinity;
      for (const [id, state] of trackManager.liveTrackStateById.entries()) {
        if (!id.startsWith('SW-')) continue;
        if (state.entityType === 2 || state.entityType === 5) {
          min = Math.min(min, state.confidence);
        }
      }
      return Number.isFinite(min) ? min : null;
    };
  });
}

test.describe('TAK-FLOW scenario controls', () => {
  test.setTimeout(120000);

  test('scenario load/clear changes populations and resets worker EW state', async ({ page }) => {
    await setupScenarioApi(page);

    // e2e boots at drill (patrol) scale.
    const baselineCount = await page.evaluate(() => window.__TAK_FLOW_TEST__.listTracks().length);
    expect(baselineCount).toBeGreaterThan(100);
    expect(baselineCount).toBeLessThan(400);

    // Prove the worker is decaying under a play-area-wide EW zone before reset.
    await page.evaluate(() => window.__TAK_FLOW_TEST__.setEwZone(0, 0, 1000));
    await expect.poll(async () => page.evaluate(() => {
      const min = window.__TAK_FLOW_TEST__.minSingleConfidence();
      return min === null ? 1 : min;
    }), { timeout: 15000 }).toBeLessThan(1.0);

    // Load STANDARD PATROL through the real instructor controls: population
    // changes prove the load path, and RESET_STATE must restore the default
    // EW zone (x:0,y:0,r:10) — if the giant zone had survived, every hostile
    // single would decay below 1.0 within seconds and cull by ~8s. A stable
    // full-confidence single proves the reset.
    await page.selectOption('#scenario-profile-select', 'patrol');
    await page.click('#btn-scenario-load');
    await expect.poll(async () => page.evaluate(() => {
      const single = window.__TAK_FLOW_TEST__.findLiveSingle();
      return single ? single.confidence : 0;
    }), { timeout: 15000 }).toBe(1.0);

    // CLEAR empties the scope.
    await page.click('#btn-scenario-clear');
    await expect.poll(async () =>
      page.evaluate(() => window.__TAK_FLOW_TEST__.listTracks().length)
    , { timeout: 10000 }).toBe(0);

    // Reload a scenario so the session ends in a live state; population
    // returning proves load after clear.
    await page.selectOption('#scenario-profile-select', 'patrol');
    await page.click('#btn-scenario-load');
    await expect.poll(async () =>
      page.evaluate(() => window.__TAK_FLOW_TEST__.listTracks().length)
    , { timeout: 15000 }).toBeGreaterThan(100);
  });

  test('replay enter/exit resumes live motion', async ({ page }) => {
    await setupScenarioApi(page);

    // Enter and exit replay.
    await page.evaluate(() => window.__TAK_FLOW_TEST__.openReplay());
    await expect(page.locator('#replay-transport-bar')).toBeVisible();
    await page.evaluate(() => window.__TAK_FLOW_TEST__.closeReplay());

    // A worker-driven single must move again after exit.
    let before = null;
    await expect.poll(async () => {
      before = await page.evaluate(() => window.__TAK_FLOW_TEST__.findLiveSingle());
      return Boolean(before);
    }, { timeout: 15000 }).toBe(true);

    await expect.poll(async () => page.evaluate((ref) => {
      const now = window.__TAK_FLOW_TEST__.getLiveTrackState(ref.id);
      if (!now) return true; // culled/clustered still proves live sim progressed
      const dx = now.x - ref.x;
      const dy = now.y - ref.y;
      return Math.sqrt(dx * dx + dy * dy) > 0.05;
    }, before), { timeout: 15000 }).toBe(true);
  });
});
