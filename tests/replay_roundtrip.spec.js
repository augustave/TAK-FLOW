import { expect, test } from '@playwright/test';

// TP-007: replay export/import round-trip. Exports the live session, re-imports
// it, and asserts schema version, buffer integrity, and that a scrubbed frame
// actually restores captured track state.

async function setupRoundtripApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));

  await page.evaluate(() => {
    const api = window.__TAK_FLOW_TEST__;
    const trackManager = window.opsLogInstance.exportContextGetter().trackManager;
    api.exportReplaySessionObject = () => trackManager.replayCapture.serializeSession();
  });
}

test.describe('TAK-FLOW replay round-trip', () => {
  test('exported session re-imports without schema loss and restores a scrubbed frame', async ({ page }) => {
    await setupRoundtripApi(page);

    // Guarantee at least one event snapshot and a few ring snapshots (250ms cadence).
    await page.evaluate(() => window.__TAK_FLOW_TEST__.captureReplayEvent('ROUNDTRIP_MARKER'));
    await expect.poll(async () =>
      page.evaluate(() => window.__TAK_FLOW_TEST__.getReplayExportMetadata().ringBufferLength)
    , { timeout: 10000 }).toBeGreaterThan(2);

    const exported = await page.evaluate(() => window.__TAK_FLOW_TEST__.exportReplaySessionObject());
    expect(exported.version).toBe('tak-flow.replay.v2');
    expect(exported.ringBuffer.length).toBeGreaterThan(2);
    expect(exported.eventSnapshots.length).toBeGreaterThan(0);

    const metadata = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplayExportMetadata());
    expect(metadata.filename).toMatch(/^replay\.tak-flow\..+\.json$/);

    // Re-import the exported session verbatim.
    const imported = await page.evaluate(
      (session) => window.__TAK_FLOW_TEST__.importReplaySession(session),
      exported
    );
    expect(imported.ringBufferLength).toBe(exported.ringBuffer.length);
    expect(imported.eventSnapshotLength).toBe(exported.eventSnapshots.length);

    // Import is lossless: the first ring snapshot survives byte-identical.
    const snapshot = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplaySnapshot(0, 'ring'));
    expect(snapshot.version).toBe('tak-flow.replay.v2');
    expect(snapshot.trackState.length).toBe(exported.ringBuffer[0].trackState.length);
    expect(snapshot.trackState[0]).toEqual(exported.ringBuffer[0].trackState[0]);

    // Scrub to the last frame and verify the restored live state matches the
    // very snapshot the player applied (surfaced via the replay:frame event).
    // Everything happens in one task so an in-flight worker frame cannot
    // overwrite the restored state before we sample it (full replay-mode
    // gating lands with the viewport-determinism phase).
    await page.evaluate(() => window.__TAK_FLOW_TEST__.openReplay());
    await expect(page.locator('#replay-transport-bar')).toBeVisible();

    const restored = await page.evaluate(() => {
      let frameSnapshot = null;
      const onFrame = (e) => { frameSnapshot = e.detail.snapshot; };
      window.addEventListener('replay:frame', onFrame);
      const scrub = document.getElementById('replay-scrub');
      scrub.value = scrub.max;
      scrub.dispatchEvent(new Event('input', { bubbles: true }));
      window.removeEventListener('replay:frame', onFrame);
      if (!frameSnapshot) return { error: 'no replay:frame event fired' };
      const row = frameSnapshot.trackState.find(
        (r) => r.entityType === 5 && !String(r.id).startsWith('GHOST-')
      );
      if (!row) return { error: 'restored frame has no live hostile single' };
      return {
        version: frameSnapshot.version,
        row,
        live: window.__TAK_FLOW_TEST__.getLiveTrackState(row.id)
      };
    });

    expect(restored.error).toBeUndefined();
    expect(restored.version).toBe('tak-flow.replay.v2');
    expect(restored.live, `restored frame should expose ${restored.row?.id}`).toBeTruthy();
    expect(restored.live.x).toBeCloseTo(restored.row.x, 5);
    expect(restored.live.y).toBeCloseTo(restored.row.y, 5);
    expect(restored.live.confidence).toBeCloseTo(restored.row.confidence, 5);
    expect(restored.live.entityType).toBe(5);

    await page.evaluate(() => window.__TAK_FLOW_TEST__.closeReplay());
  });
});
