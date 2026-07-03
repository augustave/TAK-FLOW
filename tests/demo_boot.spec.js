import { expect, test } from '@playwright/test';

// ?demo=1 boots straight into the shipped canonical mission replay
// (public/demo/replay.tak-flow.canonical-mission-01.json, recorded via
// `npm run record:demo`).

test.describe('TAK-FLOW demo boot', () => {
  test('?demo=1 loads the canonical mission replay into the transport', async ({ page }) => {
    await page.goto('/?e2e=1&demo=1');
    await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));

    await expect(page.locator('#replay-transport-bar')).toBeVisible({ timeout: 15000 });

    // The artifact's mission markers populate the event jump.
    await expect.poll(async () =>
      page.evaluate(() =>
        [...document.querySelectorAll('#replay-event-jump option')].map((o) => o.value)
      )
    , { timeout: 15000 }).toEqual(expect.arrayContaining([
      expect.stringContaining('MISSION_START'),
      expect.stringContaining('MISSION_COMPLETE')
    ]));

    const metadata = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplayExportMetadata());
    expect(metadata.version).toBe('tak-flow.replay.v2');
    expect(metadata.ringBufferLength).toBeGreaterThan(10);
    expect(metadata.eventSnapshotLength).toBeGreaterThan(2);

    // Scrubbing the shipped artifact restores state (transport is live, not
    // just visible).
    const restored = await page.evaluate(() => {
      let frame = null;
      const onFrame = (e) => { frame = e.detail.snapshot; };
      window.addEventListener('replay:frame', onFrame);
      const scrub = document.getElementById('replay-scrub');
      scrub.value = String(Math.floor(Number(scrub.max) / 2));
      scrub.dispatchEvent(new Event('input', { bubbles: true }));
      window.removeEventListener('replay:frame', onFrame);
      return frame ? { timestamp: frame.timestamp, tracks: frame.trackState.length } : null;
    });
    expect(restored).toBeTruthy();
    expect(restored.tracks).toBeGreaterThan(50);
  });
});
