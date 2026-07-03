import { expect, test } from '@playwright/test';

// AUDIT F6: snapshot-driven viewport restoration is deterministic and
// identity-correct across every entity class, and an in-flight live worker
// frame cannot mutate a restored snapshot.

async function setupDeterminismApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));

  await page.evaluate(() => {
    const api = window.__TAK_FLOW_TEST__;
    const trackManager = window.opsLogInstance.exportContextGetter().trackManager;

    api.listGhosts = () => (trackManager.latestGhostMetadata || []).map((g) => ({
      id: g.id, numericId: g.numericId, profileId: g.profileId || null, confidence: g.confidence
    }));

    // Jump to an event frame and sample everything in the SAME task: the
    // restored snapshot (via replay:frame), the live-state rows for its ids,
    // and the rebuilt ghost/EMCON metadata maps. An explicit event marker is
    // used (not the last ring frame): ring ticks starve on slow runners, so
    // the newest ring frame can postdate ghost expiry.
    api.jumpAndSample = (eventType) => {
      let frameSnapshot = null;
      const onFrame = (e) => { frameSnapshot = e.detail.snapshot; };
      window.addEventListener('replay:frame', onFrame);
      const ctx = window.opsLogInstance.exportContextGetter();
      ctx.replayPlayer.jumpToEvent(eventType, 0);
      window.removeEventListener('replay:frame', onFrame);
      if (!frameSnapshot) return { error: 'no replay:frame fired' };

      const rows = frameSnapshot.trackState
        .filter((r) => r.entityType !== undefined)
        .map((r) => ({
          id: r.id,
          entityType: r.entityType,
          x: r.x,
          y: r.y,
          confidence: r.confidence,
          live: api.getLiveTrackState(r.id)
        }));
      return {
        timestamp: frameSnapshot.timestamp,
        rows,
        ghostMetaCount: trackManager.latestGhostMetadata.length,
        emconMetaCount: trackManager.latestEmconMetadata.length,
        ghostMetaNumericIds: trackManager.latestGhostMetadata.map((g) => g.numericId)
      };
    };

    api.sampleLiveIds = (ids) => ids.map((id) => api.getLiveTrackState(id));
  });
}

test.describe('TAK-FLOW replay viewport determinism', () => {
  test.setTimeout(150000);

  test('scrubbed frames restore exact identities for ghosts, EMCON, and singles', async ({ page }) => {
    await setupDeterminismApi(page);

    // Build a rich frame: ghosts + submerged UUVs (EMCON) + hostile singles.
    await page.evaluate(() => {
      window.__TAK_FLOW_TEST__.injectGhostTracks(4, 'dji-test');
      window.__TAK_FLOW_TEST__.setUuvDepthOverride(-20);
    });

    await expect.poll(async () =>
      page.evaluate(() => window.__TAK_FLOW_TEST__.listGhosts().length)
    , { timeout: 10000 }).toBeGreaterThan(0);

    // Mark an event frame while ghosts + submerged UUVs are provably live —
    // captureReplayEvent snapshots synchronously.
    await page.waitForTimeout(800);
    await page.evaluate(() => window.__TAK_FLOW_TEST__.captureReplayEvent('DETERMINISM_MARKER'));

    await page.evaluate(() => window.__TAK_FLOW_TEST__.openReplay());
    await expect(page.locator('#replay-transport-bar')).toBeVisible();

    // Jump to the marker frame; every restored row's live state must equal
    // the snapshot row exactly (same task — no worker frame in between).
    const sample = await page.evaluate(() =>
      window.__TAK_FLOW_TEST__.jumpAndSample('DETERMINISM_MARKER')
    );
    expect(sample.error).toBeUndefined();

    const byType = new Map();
    for (const row of sample.rows) {
      byType.set(row.entityType, (byType.get(row.entityType) || 0) + 1);
      expect(row.live, `live state for ${row.id}`).toBeTruthy();
      expect(row.live.x, `${row.id} x`).toBeCloseTo(row.x, 5);
      expect(row.live.y, `${row.id} y`).toBeCloseTo(row.y, 5);
      expect(row.live.confidence, `${row.id} confidence`).toBeCloseTo(row.confidence, 5);
      expect(row.live.entityType, `${row.id} entityType`).toBe(row.entityType);
    }

    // The frame really contained all three classes under test.
    expect(byType.get(0) || 0, 'ghost rows').toBeGreaterThan(0);        // SIGINT_GHOST
    expect(byType.get(4) || 0, 'submerged UUV rows').toBeGreaterThan(0); // UUV_SUBMERGED (EMCON)
    expect(byType.get(5) || 0, 'hostile singles').toBeGreaterThan(0);    // HOSTILE_SINGLE

    // Ghost/EMCON metadata maps were rebuilt from the snapshot (negative
    // numeric ids preserved for hit-testing).
    expect(sample.ghostMetaCount).toBeGreaterThan(0);
    expect(sample.emconMetaCount).toBeGreaterThan(0);
    for (const numericId of sample.ghostMetaNumericIds) {
      expect(numericId).toBeLessThan(0);
    }

    // Late-frame immunity: any in-flight live worker frame has long landed;
    // the restored state must be byte-identical 800ms later.
    const ids = sample.rows.slice(0, 10).map((r) => r.id);
    const before = await page.evaluate((list) => window.__TAK_FLOW_TEST__.sampleLiveIds(list), ids);
    await page.waitForTimeout(800);
    const after = await page.evaluate((list) => window.__TAK_FLOW_TEST__.sampleLiveIds(list), ids);
    expect(after).toEqual(before);

    // Exit replay: live motion resumes (regression guard for the
    // workerPending deadlock).
    await page.evaluate(() => {
      window.__TAK_FLOW_TEST__.setUuvDepthOverride(null);
      window.__TAK_FLOW_TEST__.closeReplay();
    });

    let mover = null;
    await expect.poll(async () => {
      mover = await page.evaluate(() => {
        const api = window.__TAK_FLOW_TEST__;
        const entries = api.listTracks().filter((t) => t.id.startsWith('SW-'));
        for (const t of entries) {
          const live = api.getLiveTrackState(t.id);
          if (live && live.entityType === 5) return { id: t.id, x: live.x, y: live.y };
        }
        return null;
      });
      return Boolean(mover);
    }, { timeout: 15000 }).toBe(true);

    await expect.poll(async () => page.evaluate((ref) => {
      const live = window.__TAK_FLOW_TEST__.getLiveTrackState(ref.id);
      if (!live) return true; // culled/clustered — sim provably progressed
      const dx = live.x - ref.x;
      const dy = live.y - ref.y;
      return Math.sqrt(dx * dx + dy * dy) > 0.05;
    }, mover), { timeout: 15000 }).toBe(true);
  });
});
