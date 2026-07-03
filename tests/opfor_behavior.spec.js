import { expect, test } from '@playwright/test';

// Behavior-lane coverage via the worker DIAGNOSTICS channel: pheromone
// deposition/evaporation, EMCON bookkeeping, and EW-zone state round-trip.

async function setupBehaviorApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));
}

async function pollDiagnostics(page) {
  return page.evaluate(async () => {
    window.__TAK_FLOW_TEST__.requestWorkerDiagnostics();
    // Diagnostics responses arrive on the next worker message turn.
    await new Promise((resolve) => setTimeout(resolve, 100));
    return window.__TAK_FLOW_TEST__.getWorkerDiagnostics();
  });
}

test.describe('TAK-FLOW opfor behavior diagnostics', () => {
  test.setTimeout(120000);

  test('pheromone traces deposit and evaporate; EW zones round-trip', async ({ page }) => {
    await setupBehaviorApi(page);

    // 1. Deposition: hostiles chasing friendlies (SYNC_ENV @1Hz) lay validated
    // traces; SAM zones lay negative traces. Grid fills within seconds.
    let populated = null;
    await expect.poll(async () => {
      populated = await pollDiagnostics(page);
      return populated ? populated.pheromoneCells : 0;
    }, { timeout: 30000 }).toBeGreaterThan(0);

    expect(populated.hostiles).toBeGreaterThan(0);
    expect(populated.friendlies).toBeGreaterThan(0);

    // 2. EMCON bookkeeping: the default zone plus dive-cycling UUVs keep at
    // least one EMCON state alive.
    await expect.poll(async () => {
      const diag = await pollDiagnostics(page);
      return diag ? diag.emconStates : 0;
    }, { timeout: 30000 }).toBeGreaterThan(0);

    // 3. EW-zone round-trip: default zone reported, override reported, and
    // scenario reset restores the default.
    expect(populated.ewZones).toEqual([{ x: 0, y: 0, radius: 10 }]);

    await page.evaluate(() => window.__TAK_FLOW_TEST__.setEwZone(5, -5, 42));
    await expect.poll(async () => {
      const diag = await pollDiagnostics(page);
      return diag ? JSON.stringify(diag.ewZones) : '';
    }, { timeout: 10000 }).toBe(JSON.stringify([{ x: 5, y: -5, radius: 42 }]));

    // 4. Scenario clear resets the stigmergy layer: RESET_STATE empties the
    // grid and, with no hostiles left to deposit, it stays empty.
    await page.click('#btn-scenario-clear');

    await expect.poll(async () => {
      const diag = await pollDiagnostics(page);
      if (!diag) return Number.MAX_SAFE_INTEGER;
      return diag.pheromoneCells;
    }, { timeout: 30000 }).toBe(0);

    // Scenario reset also restored the default EW zone.
    const afterClear = await pollDiagnostics(page);
    expect(afterClear.ewZones).toEqual([{ x: 0, y: 0, radius: 10 }]);
    expect(afterClear.hostiles).toBe(0);
  });
});
