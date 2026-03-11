import { expect, test } from '@playwright/test';

async function getTestApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));
  await page.waitForSelector('#track-tbody tr');
}

test.describe('TAK-FLOW smoke', () => {
  test('enforces designation guardrails and supports undo', async ({ page }) => {
    await getTestApi(page);

    const trackSelection = await page.evaluate(() => {
      const tracks = window.__TAK_FLOW_TEST__.listTracks();
      const low = tracks.find((track) => track.confidenceScore < 0.6 && !track.id.startsWith('GHOST-'));
      const high = tracks.find((track) => track.confidenceScore >= 0.6 && !track.id.startsWith('GHOST-'));
      if (!low || !high) return null;
      window.__TAK_FLOW_TEST__.selectTrack(low.id);
      return { low, high };
    });

    expect(trackSelection).not.toBeNull();
    await expect(page.locator('#active-track-panel')).toBeVisible();

    const blocked = await page.evaluate((trackId) => window.__TAK_FLOW_TEST__.stageDesignation(trackId), trackSelection.low.id);
    expect(blocked.ok).toBe(false);
    await expect(page.locator('#alert-text')).toContainText('INSUFFICIENT TRACK PROVENANCE');

    const armed = await page.evaluate((trackId) => {
      window.__TAK_FLOW_TEST__.selectTrack(trackId);
      return window.__TAK_FLOW_TEST__.stageDesignation(trackId);
    }, trackSelection.high.id);
    expect(armed.ok).toBe(true);

    await expect(page.locator('#confirm-strip')).toBeVisible();
    await page.keyboard.press('r');
    await page.keyboard.press('Enter');
    await expect(page.locator('#undo-strip')).toBeVisible();
    await expect(page.locator('#undo-text')).toContainText(trackSelection.high.id);

    await page.locator('#btn-undo').click();
    await expect(page.locator('#undo-strip')).toBeHidden();
    const postUndoState = await page.evaluate(() => window.__TAK_FLOW_TEST__.getUiState());
    expect(postUndoState.undoDesignation).toBeNull();
  });

  test('exports replay artifacts and opens replay transport', async ({ page }) => {
    await getTestApi(page);

    await page.evaluate(() => {
      const high = window.__TAK_FLOW_TEST__.listTracks().find((track) => track.confidenceScore >= 0.6 && !track.id.startsWith('GHOST-'));
      window.__TAK_FLOW_TEST__.selectTrack(high.id);
      window.__TAK_FLOW_TEST__.captureReplayEvent('SMOKE_MARKER');
      window.__TAK_FLOW_TEST__.openReplay();
    });

    await expect(page.locator('#replay-transport-bar')).toBeVisible();
    await expect.poll(async () => page.locator('#replay-event-jump option').count()).toBeGreaterThan(1);

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#replay-export').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^replay\.tak-h\..+\.json$/);

    const path = await download.path();
    expect(path).toBeTruthy();

    const replayPayload = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplayExportMetadata());

    expect(replayPayload.version).toBe('tak-h.replay.v1');
    expect(replayPayload.ringBufferLength).toBeGreaterThan(0);
    expect(replayPayload.eventSnapshotLength).toBeGreaterThan(0);
  });

  test('surfaces recommended-action critical state and allows execution', async ({ page }) => {
    await getTestApi(page);

    const result = await page.evaluate(() => window.__TAK_FLOW_TEST__.forceTelemetry({
      polarization: 0.21,
      milling: 0.58,
      cohesion: 0.03,
      activeCount: 150,
      com: { x: 4, y: -6 }
    }));

    expect(result.critical).toBe(true);
    await expect(page.locator('#recommended-actions-panel')).toHaveClass(/critical/);
    await expect(page.locator('#rec-actions-badge')).toContainText('CRITICAL');
    await expect(page.locator('#btn-rec-execute')).toBeEnabled();

    const executeResult = await page.evaluate(() => window.__TAK_FLOW_TEST__.executeRecommendedAction());
    expect(executeResult.counterfactualActive).toBe(true);
  });
});
