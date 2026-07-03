import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'replay.v1.minimal.json'
);

const ENTITY = {
  SIGINT_GHOST: 0,
  SWARM_CENTROID: 1,
  EMCON_SINGLE: 2,
  UUV_SURFACED: 3,
  UUV_SUBMERGED: 4,
  HOSTILE_SINGLE: 5,
  EMCON_CENTROID: 6
};

async function setupIdentityApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));

  // Test-time extensions over the built-in API (promotion to built-ins is
  // scheduled for the coverage-completion phase).
  await page.evaluate(() => {
    const api = window.__TAK_FLOW_TEST__;
    const trackManager = window.opsLogInstance.exportContextGetter().trackManager;

    api.listLiveEntries = () => {
      const rows = [];
      for (const [id, state] of trackManager.liveTrackStateById.entries()) {
        rows.push({ id, entityType: state.entityType, confidence: state.confidence, count: state.count });
      }
      return rows;
    };

    api.getMeshCounts = () => ({
      hostile: trackManager.instances.hostile.mesh?.count ?? -1,
      hostileCapacity: trackManager.instances.hostile.mesh?.instanceMatrix?.count ?? -1,
      centroid: trackManager.centroidMesh?.count ?? -1
    });
  });
}

test.describe('TAK-FLOW entity identity', () => {
  test('hostile singles keep their real ids and live confidence', async ({ page }) => {
    await setupIdentityApi(page);

    // 1+2. A non-EMCON hostile single must appear in live state under its own
    // SW- id with the dedicated HOSTILE_SINGLE code (pre-fix these rows were
    // mislabelled entityType 1.0 and registered as CENTROID-<n>), and its
    // listTracks confidence must be the live worker value, not the static
    // provenance fallback (0.9 / 0.7 / 0.35). Sampled in one evaluate so an
    // EMCON transition between samples cannot skew the comparison.
    let pair = null;
    await expect.poll(async () => {
      pair = await page.evaluate(() => {
        const api = window.__TAK_FLOW_TEST__;
        const entry = api.listLiveEntries().find((e) => e.id.startsWith('SW-') && e.entityType === 5);
        if (!entry) return null;
        const listed = api.listTracks().find((t) => t.id === entry.id);
        return listed ? { entry, listed } : null;
      });
      return Boolean(pair);
    }, { timeout: 20000 }).toBe(true);

    expect(pair.listed.confidenceScore).toBeCloseTo(pair.entry.confidence, 5);
    expect([0.9, 0.7, 0.35]).not.toContain(pair.listed.confidenceScore);

    // 3. No phantom centroids: a CENTROID- id implies a centroid entity type
    // and vice versa, for every live row.
    const entries = await page.evaluate(() => window.__TAK_FLOW_TEST__.listLiveEntries());
    for (const entry of entries) {
      const isCentroidId = entry.id.startsWith('CENTROID-');
      const isCentroidType = entry.entityType === ENTITY.SWARM_CENTROID
        || entry.entityType === ENTITY.EMCON_CENTROID;
      expect(isCentroidId, `${entry.id} (entityType ${entry.entityType})`).toBe(isCentroidType);
    }

    // 4. Mesh routing: singles render through the hostile instanced mesh
    // within its allocation; the 50-cap centroid ring mesh only holds real
    // centroids.
    const meshCounts = await page.evaluate(() => window.__TAK_FLOW_TEST__.getMeshCounts());
    expect(meshCounts.hostile).toBeGreaterThan(0);
    expect(meshCounts.hostile).toBeLessThanOrEqual(meshCounts.hostileCapacity);
    expect(meshCounts.centroid).toBeLessThanOrEqual(50);
  });

  test('legacy v1 replay imports normalize ambiguous entity types', async ({ page }) => {
    await setupIdentityApi(page);

    const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));
    const imported = await page.evaluate(
      (session) => window.__TAK_FLOW_TEST__.importReplaySession(session),
      fixture
    );
    expect(imported.ringBufferLength).toBe(1);
    expect(imported.eventSnapshotLength).toBe(1);

    const metadata = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplayExportMetadata());
    expect(metadata.version).toBe('tak-flow.replay.v2');

    const ringSnapshot = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplaySnapshot(0, 'ring'));
    const typesById = Object.fromEntries(ringSnapshot.trackState.map((row) => [row.id, row.entityType]));
    expect(typesById['SW-1042']).toBe(ENTITY.HOSTILE_SINGLE);   // was ambiguous 1.0
    expect(typesById['CENTROID-77']).toBe(ENTITY.EMCON_CENTROID); // was ambiguous 2.0
    expect(typesById['GHOST-3']).toBe(ENTITY.SIGINT_GHOST);

    const eventSnapshot = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplaySnapshot(0, 'event'));
    expect(eventSnapshot.trackState[0].entityType).toBe(ENTITY.HOSTILE_SINGLE);
    expect(eventSnapshot.triggerEvent).toBe('FIXTURE_MARKER');
  });
});
