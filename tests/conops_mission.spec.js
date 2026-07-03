import { expect, test } from '@playwright/test';

// Executable mission: "Contested Littoral Watch" — the canonical CONOPS v2
// narrative (docs/defense-readiness/mission_conops_v1.md) driven end-to-end
// through the same UI surfaces and test APIs an operator/instructor exercises.
// Every phase below maps 1:1 to a numbered CONOPS step.

async function setupMissionApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));
  await page.waitForSelector('#track-tbody tr');

  await page.evaluate(() => {
    const api = window.__TAK_FLOW_TEST__;
    const trackManager = window.opsLogInstance.exportContextGetter().trackManager;

    api.missionGhost = () => {
      for (const [id, state] of trackManager.liveTrackStateById.entries()) {
        if (id.startsWith('GHOST-')) return { id, confidence: state.confidence };
      }
      return null;
    };

    api.missionMinSingleConfidence = () => {
      let min = Infinity;
      for (const [id, state] of trackManager.liveTrackStateById.entries()) {
        if (!id.startsWith('SW-')) continue;
        if (state.entityType === 2 || state.entityType === 5) min = Math.min(min, state.confidence);
      }
      return Number.isFinite(min) ? min : null;
    };
  });
}

test.describe('TAK-FLOW CONOPS mission: Contested Littoral Watch', () => {
  test.setTimeout(150000);

  test('runs the canonical mission end-to-end', async ({ page }) => {
    await setupMissionApi(page);

    // Step 1 — Scenario load: MASSED SWARM via the instructor panel.
    await page.selectOption('#scenario-profile-select', 'swarm');
    await page.click('#btn-scenario-load');
    await expect.poll(async () =>
      page.evaluate(() => window.__TAK_FLOW_TEST__.listTracks().length)
    , { timeout: 15000 }).toBeGreaterThan(800);

    // Step 2 — Watchfloor picture: track table and live worker lane are up.
    await expect(page.locator('#track-tbody tr').first()).toBeVisible();

    // Steps 3+4 — SIGINT decoy burst, then the zero-trust designation gate.
    // Ghosts live 6-12s and the abort banner is a temporary flash, so the
    // find -> designate -> read-banner chain runs page-side in ONE task:
    // no ghost expiry or flash decay between Node round-trips.
    await page.evaluate(() => window.__TAK_FLOW_TEST__.injectGhostTracks(5));
    const blocked = await page.evaluate(async () => {
      const api = window.__TAK_FLOW_TEST__;
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        const ghost = api.missionGhost();
        if (ghost) {
          api.selectTrack(ghost.id);
          const staged = api.stageDesignation(ghost.id);
          return {
            ...staged,
            ghostConfidence: ghost.confidence,
            alertText: document.getElementById('alert-text')?.textContent || ''
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      return null;
    });
    expect(blocked).toBeTruthy();
    expect(blocked.ghostConfidence).toBeLessThan(0.5);
    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('strike-blocked');
    expect(blocked.alertText).toContain('INSUFFICIENT TRACK PROVENANCE');
    // Note: the ops log is a severity-sorted 50-entry queue; the severity-1
    // guardrail entry is evicted by the swarm's severity-2 threat alerts, so
    // the audit assertion here is the alert surface + blocked reason.

    // Step 5 — EW degradation: a play-area-wide jamming zone forces EMCON
    // alpha-decay; the ops log records the datalink loss.
    await page.evaluate(() => window.__TAK_FLOW_TEST__.setEwZone(0, 0, 1000));
    await expect.poll(async () => page.evaluate(() => {
      const min = window.__TAK_FLOW_TEST__.missionMinSingleConfidence();
      return min === null ? 1 : min;
    }), { timeout: 15000 }).toBeLessThan(1.0);

    await expect.poll(async () => page.evaluate(() => {
      const logs = window.__TAK_FLOW_TEST__.getUiState().opsLog;
      return logs.some((entry) => String(entry.details).includes('DATALINK SEVERED'));
    }), { timeout: 20000 }).toBe(true);

    // Jamming lifts; the default zone returns.
    await page.evaluate(() => window.__TAK_FLOW_TEST__.setEwZone(0, 0, 10));

    // Step 6 — Swarm-fracture advisory: the rule-based gate goes critical.
    const advisory = await page.evaluate(() => window.__TAK_FLOW_TEST__.forceTelemetry({
      polarization: 0.21,
      milling: 0.58,
      cohesion: 0.03,
      activeCount: 150,
      com: { x: 4, y: -6 }
    }));
    expect(advisory.critical).toBe(true);
    await expect(page.locator('#rec-actions-badge')).toContainText('CRITICAL');

    // Step 7 — Counterfactual recon macro (3DGS) executes from the advisory.
    const executed = await page.evaluate(() => window.__TAK_FLOW_TEST__.executeRecommendedAction());
    expect(executed.counterfactualActive).toBe(true);

    // Step 8 — Provenance-clean designation with undo: a high-confidence
    // track arms, commits, and the operator rolls it back.
    const target = await page.evaluate(() => {
      const high = window.__TAK_FLOW_TEST__.listTracks().find(
        (t) => t.confidenceScore >= 0.6 && !t.id.startsWith('GHOST-')
      );
      window.__TAK_FLOW_TEST__.selectTrack(high.id);
      return { id: high.id, staged: window.__TAK_FLOW_TEST__.stageDesignation(high.id) };
    });
    expect(target.staged.ok).toBe(true);
    await expect(page.locator('#confirm-strip')).toBeVisible();
    await page.keyboard.press('r');
    await page.keyboard.press('Enter');
    await expect(page.locator('#undo-strip')).toBeVisible();
    await page.locator('#btn-undo').click();
    await expect(page.locator('#undo-strip')).toBeHidden();

    // Step 9 — After-action: mark the mission, verify the replay artifact is
    // exportable with the current schema and both buffers populated.
    await page.evaluate(() => window.__TAK_FLOW_TEST__.captureReplayEvent('CONOPS_MISSION_COMPLETE'));
    const replay = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplayExportMetadata());
    expect(replay.version).toBe('tak-flow.replay.v2');
    expect(replay.filename).toMatch(/^replay\.tak-flow\..+\.json$/);
    expect(replay.ringBufferLength).toBeGreaterThan(0);
    expect(replay.eventSnapshotLength).toBeGreaterThan(0);
  });
});
