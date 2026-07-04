import { expect, test } from '@playwright/test';

// Ghost-track RF profile families + timed spoof windows. Profiles carry a
// worker-side `ghost` block (confidence range, lifetime, speed, spoofWindow);
// the zero-trust ceiling (< 0.5) is a worker invariant, not a profile knob.
//
// Timing notes: ghosts live 6-12s and spoof phases are wall-clock anchored,
// so the window test measures its own elapsed time and skips (rather than
// flakes) if the environment is too slow to hit a phase.

async function setupGhostApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));

  await page.evaluate(() => {
    const api = window.__TAK_FLOW_TEST__;
    const trackManager = window.opsLogInstance.exportContextGetter().trackManager;
    api.listGhosts = () => (trackManager.latestGhostMetadata || []).map((g) => ({
      id: g.id,
      profileId: g.profileId || null,
      confidence: g.confidence
    }));
  });
}

test.describe('TAK-FLOW ghost RF profile families', () => {
  test.setTimeout(120000);

  test('bebop family honors confidence bounds, blocking, and lifetime expiry', async ({ page }) => {
    await setupGhostApi(page);

    await page.evaluate(() => window.__TAK_FLOW_TEST__.injectGhostTracks(3, 'bebop'));

    // Spawned with the family id and inside the profile confidence band.
    let ghosts = [];
    await expect.poll(async () => {
      ghosts = await page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts());
      return ghosts.length;
    }, { timeout: 10000 }).toBeGreaterThan(0);

    for (const ghost of ghosts) {
      expect(ghost.profileId).toBe('bebop');
      expect(ghost.confidence).toBeGreaterThanOrEqual(0.2);
      expect(ghost.confidence).toBeLessThanOrEqual(0.35);
      expect(ghost.confidence).toBeLessThan(0.5); // zero-trust invariant (C-013)
    }

    // Designation stays blocked for every family member (single evaluate so
    // ghosts cannot expire between round-trips).
    const blocking = await page.evaluate(() =>
      window.__TAK_FLOW_TEST__.listGhosts().map((g) => window.__TAK_FLOW_TEST__.canDesignate(g.id))
    );
    for (const designable of blocking) expect(designable).toBe(false);

    // Lifetime band [6000, 9000]ms: with no further bursts, every family
    // member expires (upper bound + margin).
    await expect.poll(async () =>
      page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts().length)
    , { timeout: 20000 }).toBe(0);
  });

  test('dji-test spoof window gates bursts: ON spawns, OFF suppresses', async ({ page }) => {
    await setupGhostApi(page);

    // Burst 1 anchors the window (elapsed 0 -> ON phase of on:4000/off:4000).
    const t0 = Date.now();
    await page.evaluate(() => window.__TAK_FLOW_TEST__.injectGhostTracks(2, 'dji-test'));

    let initialIds = [];
    await expect.poll(async () => {
      const ghosts = await page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts());
      initialIds = ghosts.map((g) => g.id);
      return ghosts.length;
    }, { timeout: 5000 }).toBeGreaterThan(0);

    const ghosts = await page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts());
    for (const ghost of ghosts) {
      expect(ghost.profileId).toBe('dji-test');
      expect(ghost.confidence).toBeGreaterThanOrEqual(0.3);
      expect(ghost.confidence).toBeLessThan(0.5);
    }

    // Burst 2 must land mid-OFF (4-8s into the 8s cycle). Aim for 5.5s.
    const preOffSleep = Math.max(0, 5500 - (Date.now() - t0));
    await page.waitForTimeout(preOffSleep);
    const offElapsed = Date.now() - t0;
    test.skip(offElapsed < 4200 || offElapsed > 7500,
      `environment too slow to hit the OFF phase (elapsed ${offElapsed}ms)`);

    await page.evaluate(() => window.__TAK_FLOW_TEST__.injectGhostTracks(2, 'dji-test'));
    await page.waitForTimeout(1000);
    const idsAfterOffBurst = await page.evaluate(() =>
      window.__TAK_FLOW_TEST__.listGhosts().map((g) => g.id)
    );
    // No NEW ghost ids may appear from an OFF-phase burst (existing ones may
    // expire concurrently, so compare sets rather than counts).
    for (const id of idsAfterOffBurst) expect(initialIds).toContain(id);

    // Burst 3 in the next ON phase (8-12s). Aim for 9s.
    const preOnSleep = Math.max(0, 9000 - (Date.now() - t0));
    await page.waitForTimeout(preOnSleep);
    const onElapsed = Date.now() - t0;
    test.skip(onElapsed < 8200 || onElapsed > 11500,
      `environment too slow to hit the second ON phase (elapsed ${onElapsed}ms)`);

    await page.evaluate(() => window.__TAK_FLOW_TEST__.injectGhostTracks(2, 'dji-test'));
    await expect.poll(async () => {
      const ids = await page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts().map((g) => g.id));
      return ids.some((id) => !initialIds.includes(id) && !idsAfterOffBurst.includes(id));
    }, { timeout: 5000 }).toBe(true);
  });
});
