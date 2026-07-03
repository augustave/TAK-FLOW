import { expect, test } from '@playwright/test';

async function setupEwTestApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));
  
  // injectGhostTracks / setEwZone / canDesignate / getTrackConfidence are
  // built into __TAK_FLOW_TEST__; only the ghost-merging listTracks view is
  // still a test-time extension.
  await page.evaluate(() => {
    const api = window.__TAK_FLOW_TEST__;
    const trackManager = window.opsLogInstance.exportContextGetter().trackManager;

    const originalListTracks = api.listTracks;
    api.listTracks = () => {
      const tracks = originalListTracks();
      // Add ghost tracks from liveState
      for (let [id, state] of trackManager.liveTrackStateById.entries()) {
          if (id.startsWith('GHOST-') && !tracks.find(t => t.id === id)) {
              tracks.push({
                  id: id,
                  type: 'unknown',
                  subtype: 'SIGINT_DECOY',
                  confidenceScore: state.confidence,
                  provenance: { source: 'ELINT-ESM', confidence: 'LOW' }
              });
          }
      }
      return tracks;
    };
  });
}

test.describe('TAK-FLOW EW Degradation & Ghost-Track Mechanics', () => {
  test.setTimeout(180000);
  test('ghost-track isolation and designation blocking', async ({ page }) => {
    await setupEwTestApi(page);

    // 1. Inject ghost tracks
    await page.evaluate(() => window.__TAK_FLOW_TEST__.injectGhostTracks(5));

    // 2+3. Find a ghost and run every designation assertion in ONE evaluate:
    // ghosts live only 6-12s, so on a slow CI runner the ghost can expire
    // between separate round-trips (observed: stageDesignation returning
    // 'track-not-found' instead of 'strike-blocked').
    let result = null;
    await expect.poll(async () => {
      result = await page.evaluate(() => {
        const api = window.__TAK_FLOW_TEST__;
        const ghost = api.listTracks().find(t => t.id.startsWith('GHOST-'));
        if (!ghost) return null;
        const designable = api.canDesignate(ghost.id);
        api.selectTrack(ghost.id);
        const staged = api.stageDesignation(ghost.id);
        // Read the flash banner in the same task — it expires quickly.
        const alertText = document.getElementById('alert-text')?.textContent || '';
        return { ghost, designable, staged, alertText };
      });
      return Boolean(result);
    }, { timeout: 10000 }).toBe(true);

    // Assert confidence is < 0.5 (as per requirement: aConfidence < 0.5)
    expect(result.ghost.confidenceScore).toBeLessThan(0.5);
    console.log(`Ghost track ${result.ghost.id} detected with confidence ${result.ghost.confidenceScore}`);

    // Blocked from strike-designation, with UI feedback
    expect(result.designable).toBe(false);
    expect(result.staged.ok).toBe(false);
    expect(result.staged.reason).toBe('strike-blocked');
    expect(result.alertText).toContain('INSUFFICIENT TRACK PROVENANCE');
  });

  test('EMCON alpha-decay and track culling', async ({ page }) => {
    await setupEwTestApi(page);

    // 1. Cover the whole play area with a single EW zone so the observed track cannot
    // wander out of EMCON mid-test (tracks escaping the old hardcoded x:0,y:0,r:10 zone
    // stopped decaying and never culled — the original flake). Every hostile swarm track
    // now enters EMCON and decays deterministically.
    const zone = await page.evaluate(() => window.__TAK_FLOW_TEST__.setEwZone(0, 0, 1000));
    expect(zone.radius).toBe(1000);

    // 2. Pick a track with a strictly decreasing confidence across two consecutive
    // samples — proof that EMCON alpha-decay is acting on it right now. Outside EMCON,
    // listTracks reports static provenance scores (0.9/0.7/0.35) which never decay, so a
    // plain `confidence < 1.0` filter selects tracks that will never cull. Restrict to
    // hostile UAS SWARM: UUVs also run EMCON from dive cycles and can surface mid-test,
    // resetting their decay.
    let emconTrackId = null;
    const previousSample = new Map();
    await expect.poll(async () => {
      const tracks = await page.evaluate(() => window.__TAK_FLOW_TEST__.listTracks());
      for (const t of tracks) {
        if (t.type !== 'hostile' || t.subtype !== 'UAS SWARM') continue;
        const prev = previousSample.get(t.id);
        previousSample.set(t.id, t.confidenceScore);
        if (!emconTrackId && prev !== undefined && t.confidenceScore < prev) {
          emconTrackId = t.id;
          console.log(`EMCON decay confirmed on ${t.id} (confidence ${prev.toFixed(4)} -> ${t.confidenceScore.toFixed(4)})`);
        }
      }
      return emconTrackId !== null;
    }, { timeout: 30000, interval: 500 }).toBe(true);

    // 4. Assert the track drops from scope. The worker culls an EMCON track when its
    // confidence hits <= 0.05 or its uncertainty radius exceeds 20 — with the track
    // pinned inside the zone, the radius path fires within ~10s of EMCON entry.
    await expect.poll(async () => {
      const tracks = await page.evaluate(() => window.__TAK_FLOW_TEST__.listTracks());
      const track = tracks.find(t => t.id === emconTrackId);
      if (!track) return true; // Track culled
      console.log(`Confidence for ${emconTrackId}: ${track.confidenceScore.toFixed(4)}`);
      return false;
    }, {
        timeout: 60000,
        interval: 1000
    }).toBe(true);

    const finalTracks = await page.evaluate(() => window.__TAK_FLOW_TEST__.listTracks());
    expect(finalTracks.find(t => t.id === emconTrackId)).toBeUndefined();
    console.log(`Track ${emconTrackId} successfully culled after confidence decay.`);
  });
});
