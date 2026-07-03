import { expect, test } from '@playwright/test';

// Ghost-track RF profile families + timed spoof windows. Profiles carry a
// worker-side `ghost` block (confidence range, lifetime, speed, spoofWindow);
// the zero-trust ceiling (< 0.5) is a worker invariant, not a profile knob.

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

  test('bebop family honors confidence/lifetime bounds and stays designation-blocked', async ({ page }) => {
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

    // Designation stays blocked for every family member.
    for (const ghost of ghosts) {
      const designable = await page.evaluate(
        (id) => window.__TAK_FLOW_TEST__.canDesignate(id),
        ghost.id
      );
      expect(designable).toBe(false);
    }

    // Lifetime band [6000, 9000]ms: still present at ~4s, all expired by ~11s
    // (no further bursts are injected, so nothing respawns).
    await page.waitForTimeout(4000);
    const midLife = await page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts());
    expect(midLife.length).toBeGreaterThan(0);

    await expect.poll(async () =>
      page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts().length)
    , { timeout: 12000 }).toBe(0);
  });

  test('dji-test spoof window gates bursts: ON spawns, OFF suppresses', async ({ page }) => {
    await setupGhostApi(page);

    // Burst 1 at window start (elapsed 0 -> ON phase of on:2000/off:2000).
    await page.evaluate(() => window.__TAK_FLOW_TEST__.injectGhostTracks(2, 'dji-test'));
    let onCount = 0;
    await expect.poll(async () => {
      onCount = await page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts().length);
      return onCount;
    }, { timeout: 5000 }).toBeGreaterThan(0);

    const ghosts = await page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts());
    for (const ghost of ghosts) {
      expect(ghost.profileId).toBe('dji-test');
      expect(ghost.confidence).toBeGreaterThanOrEqual(0.3);
      expect(ghost.confidence).toBeLessThan(0.5);
    }

    // Burst 2 lands mid-OFF phase (~2.6s into the 4s cycle): suppressed.
    await page.waitForTimeout(2600);
    await page.evaluate(() => window.__TAK_FLOW_TEST__.injectGhostTracks(2, 'dji-test'));
    await page.waitForTimeout(1000);
    const duringOff = await page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts().length);
    expect(duringOff).toBe(onCount);

    // Burst 3 in the next ON phase (~4.4s): spawns again.
    await page.waitForTimeout(800); // ~4.4s elapsed => ON
    await page.evaluate(() => window.__TAK_FLOW_TEST__.injectGhostTracks(2, 'dji-test'));
    await expect.poll(async () =>
      page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts().length)
    , { timeout: 5000 }).toBeGreaterThan(onCount);
  });
});
