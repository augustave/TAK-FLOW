import { expect, test } from '@playwright/test';

// Stigmergy overlay: the worker's pheromone grid (previously computed but
// invisible) exports thresholded cells in ui.pheromone; a HUD toggle renders
// them as a heat layer labeled as simulation ("HOSTILE ROUTE MEMORY (SIM)").

async function setupOverlayApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));

  await page.evaluate(() => {
    const api = window.__TAK_FLOW_TEST__;
    const trackManager = window.opsLogInstance.exportContextGetter().trackManager;
    api.getPheromoneOverlayState = () => ({
      cells: (trackManager.latestPheromoneCells || []).length,
      sampleCell: (trackManager.latestPheromoneCells || [])[0] || null,
      meshVisible: Boolean(trackManager.pheromoneMesh?.visible),
      meshCount: trackManager.pheromoneMesh?.count ?? -1
    });
  });
}

test.describe('TAK-FLOW pheromone route-memory overlay', () => {
  test.setTimeout(120000);

  test('cells export after hostile activity and the HUD toggle drives the heat layer', async ({ page }) => {
    await setupOverlayApi(page);

    // 1. Cells arrive in ui.pheromone once hostiles interact with targets/SAMs.
    let state = null;
    await expect.poll(async () => {
      state = await page.evaluate(() => window.__TAK_FLOW_TEST__.getPheromoneOverlayState());
      return state.cells;
    }, { timeout: 30000 }).toBeGreaterThan(0);

    expect(state.sampleCell).toBeTruthy();
    expect(Number.isFinite(state.sampleCell.x)).toBe(true);
    expect(Number.isFinite(state.sampleCell.y)).toBe(true);
    expect(Math.abs(state.sampleCell.level)).toBeGreaterThanOrEqual(0.05);

    // 2. Default OFF: the mesh stays hidden even with cells available.
    expect(state.meshVisible).toBe(false);

    // 3. HUD toggle ON: mesh renders the cells and the button labels itself
    // as simulation-only.
    await page.click('#btn-pheromone');
    await expect(page.locator('#btn-pheromone')).toContainText('ROUTE MEMORY (SIM): ON');
    await expect.poll(async () => {
      const on = await page.evaluate(() => window.__TAK_FLOW_TEST__.getPheromoneOverlayState());
      return on.meshVisible && on.meshCount > 0;
    }, { timeout: 10000 }).toBe(true);

    // 4. Toggle OFF hides it again.
    await page.click('#btn-pheromone');
    await expect(page.locator('#btn-pheromone')).toContainText('ROUTE MEMORY (SIM): OFF');
    await expect.poll(async () => {
      const off = await page.evaluate(() => window.__TAK_FLOW_TEST__.getPheromoneOverlayState());
      return off.meshVisible;
    }, { timeout: 10000 }).toBe(false);
  });
});
