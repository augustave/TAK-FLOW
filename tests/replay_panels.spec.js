import { expect, test } from '@playwright/test';

// AUDIT F1-F5 panel-state replay fidelity: Track Log selection, SWARM
// KINEMATICS order parameters, Recommended Actions advisory lifecycle,
// OpsLog delta rebuild, and the transport bar itself.

async function setupPanelsApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));
  await page.waitForSelector('#track-tbody tr');

  await page.evaluate(() => {
    const api = window.__TAK_FLOW_TEST__;
    api.jumpToReplayEvent = (eventType, occurrence = 0) => {
      let frameSnapshot = null;
      const onFrame = (e) => { frameSnapshot = e.detail.snapshot; };
      window.addEventListener('replay:frame', onFrame);
      const ctx = window.opsLogInstance.exportContextGetter();
      ctx.replayPlayer.jumpToEvent(eventType, occurrence);
      window.removeEventListener('replay:frame', onFrame);
      return frameSnapshot;
    };
    api.getReplayPanelState = () => ({
      polarization: document.getElementById('kinematics-polarization')?.textContent,
      milling: document.getElementById('kinematics-milling')?.textContent,
      cohesion: document.getElementById('kinematics-cohesion')?.textContent,
      recBadge: document.getElementById('rec-actions-badge')?.textContent,
      recCritical: document.getElementById('recommended-actions-panel')?.classList.contains('critical') || false,
      selectedRowIds: [...document.querySelectorAll('#track-tbody tr.track-selected td:first-child')]
        .map((cell) => cell.textContent.trim()),
      opsFeedCount: document.querySelectorAll('#ops-feed .sigint-entry, #ops-log-feed .sigint-entry').length
    });
  });
}

test.describe('TAK-FLOW replay panel fidelity', () => {
  test.setTimeout(150000);

  test('scrubbed frames drive kinematics, advisory, Track Log selection, and ops log', async ({ page }) => {
    await setupPanelsApi(page);

    // Build the advisory lifecycle in live mode: select a track, force the
    // critical gate (V_JEPA_ONSET), execute the macro (3DGS_MACRO_EXECUTED),
    // then clear (V_JEPA_CLEAR).
    const selectedId = await page.evaluate(() => {
      const high = window.__TAK_FLOW_TEST__.listTracks().find(
        (t) => t.confidenceScore >= 0.6 && !t.id.startsWith('GHOST-')
      );
      window.__TAK_FLOW_TEST__.selectTrack(high.id);
      return high.id;
    });

    await page.evaluate(() => window.__TAK_FLOW_TEST__.forceTelemetry({
      polarization: 0.21, milling: 0.58, cohesion: 0.03, activeCount: 150, com: { x: 4, y: -6 }
    }));
    await expect(page.locator('#rec-actions-badge')).toContainText('CRITICAL');
    await page.evaluate(() => window.__TAK_FLOW_TEST__.executeRecommendedAction());
    // Marker frame with a known selection + critical gate (the swarm can
    // trigger natural onsets pre-selection, so V_JEPA_ONSET frames are not
    // guaranteed to carry our selection).
    await page.evaluate(() => window.__TAK_FLOW_TEST__.captureReplayEvent('F1_MARKER'));
    await page.waitForTimeout(600); // let ring capture record the critical frame
    await page.evaluate(() => window.__TAK_FLOW_TEST__.clearTelemetryOverride());
    await page.waitForTimeout(400);

    await page.evaluate(() => window.__TAK_FLOW_TEST__.openReplay());
    await expect(page.locator('#replay-transport-bar')).toBeVisible();

    // F5: transport affordances — event jump options carry the lifecycle.
    const eventOptions = await page.evaluate(() =>
      [...document.querySelectorAll('#replay-event-jump option')].map((o) => o.value)
    );
    expect(eventOptions.some((v) => v.startsWith('V_JEPA_ONSET'))).toBe(true);
    expect(eventOptions.some((v) => v.startsWith('3DGS_MACRO_EXECUTED'))).toBe(true);

    // F1 + F2 + F3: jump to the marker frame — it carries our selection, the
    // forced order parameters, and the critical gate. Kinematics panel must
    // show the captured values, the advisory panel must be critical, and the
    // Track Log highlight must follow the snapshot's captured selection.
    const markerSnapshot = await page.evaluate(() => window.__TAK_FLOW_TEST__.jumpToReplayEvent('F1_MARKER'));
    expect(markerSnapshot).toBeTruthy();
    const markerPanels = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplayPanelState());
    expect(markerPanels.polarization).toBe(markerSnapshot.orderParams.polarization.toFixed(2));
    expect(markerPanels.milling).toBe(markerSnapshot.orderParams.milling.toFixed(2));
    expect(markerPanels.cohesion).toBe(markerSnapshot.orderParams.cohesion.toFixed(2));
    expect(markerPanels.recCritical).toBe(true);

    expect(markerSnapshot.uiState.selectedTrackId).toBe(selectedId);
    expect(markerPanels.selectedRowIds.some((id) => id.includes(selectedId))).toBe(true);

    // F4: the ops log rebuild grows with the scrub position (accumulated
    // deltas), never shrinking as we step forward.
    const stepCounts = [];
    for (let i = 0; i < 3; i += 1) {
      await page.keyboard.press('ArrowRight'); // F5: keyboard transport
      const state = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplayPanelState());
      stepCounts.push(state.opsFeedCount);
    }
    for (let i = 1; i < stepCounts.length; i += 1) {
      expect(stepCounts[i]).toBeGreaterThanOrEqual(stepCounts[i - 1]);
    }

    // F3 (clear): a later frame shows the advisory stood down.
    const lastClear = eventOptions.filter((v) => v.startsWith('V_JEPA_CLEAR')).length - 1;
    const clearSnapshot = lastClear < 0 ? null : await page.evaluate(
      (occurrence) => window.__TAK_FLOW_TEST__.jumpToReplayEvent('V_JEPA_CLEAR', occurrence),
      lastClear
    );
    if (clearSnapshot) {
      const clearedPanels = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplayPanelState());
      expect(clearedPanels.recCritical).toBe(false);
    }

    await page.evaluate(() => window.__TAK_FLOW_TEST__.closeReplay());
    await expect(page.locator('#replay-transport-bar')).toBeHidden();
  });
});
