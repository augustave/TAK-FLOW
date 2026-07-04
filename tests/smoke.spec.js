import { expect, test } from '@playwright/test';

async function getTestApi(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));
  await page.waitForSelector('#track-tbody tr');
}

test.describe('TAK-FLOW smoke', () => {
  test('enforces designation guardrails and supports undo', async ({ page }) => {
    await getTestApi(page);

    // Guardrail block runs page-side in one task: the strike-abort banner is
    // a temporary flash that expires between CDP round-trips on slow runners.
    const guardrail = await page.evaluate(() => {
      const tracks = window.__TAK_FLOW_TEST__.listTracks();
      const low = tracks.find((track) => track.confidenceScore < 0.6 && !track.id.startsWith('GHOST-'));
      const high = tracks.find((track) => track.confidenceScore >= 0.6 && !track.id.startsWith('GHOST-'));
      if (!low || !high) return null;
      window.__TAK_FLOW_TEST__.selectTrack(low.id);
      const panelVisible = document.getElementById('active-track-panel')?.style.display !== 'none';
      const blocked = window.__TAK_FLOW_TEST__.stageDesignation(low.id);
      const alertText = document.getElementById('alert-text')?.textContent || '';
      return { low, high, panelVisible, blocked, alertText };
    });

    expect(guardrail).not.toBeNull();
    expect(guardrail.panelVisible).toBe(true);
    expect(guardrail.blocked.ok).toBe(false);
    expect(guardrail.alertText).toContain('INSUFFICIENT TRACK PROVENANCE');

    const armed = await page.evaluate((trackId) => {
      window.__TAK_FLOW_TEST__.selectTrack(trackId);
      return window.__TAK_FLOW_TEST__.stageDesignation(trackId);
    }, guardrail.high.id);
    expect(armed.ok).toBe(true);

    await expect(page.locator('#confirm-strip')).toBeVisible();
    await page.keyboard.press('r');
    await page.keyboard.press('Enter');

    // Undo runs page-side in one task: the undo window lasts only 30s and
    // separate visible/click/hidden round-trips can outlast it on slow runners.
    const undone = await page.evaluate(async (expectedId) => {
      const strip = document.getElementById('undo-strip');
      const deadline = Date.now() + 15000;
      while (Date.now() < deadline) {
        if (strip && strip.style.display !== 'none') {
          const undoText = document.getElementById('undo-text')?.textContent || '';
          document.getElementById('btn-undo')?.click();
          return {
            undoText,
            hiddenAfter: strip.style.display === 'none',
            uiState: window.__TAK_FLOW_TEST__.getUiState()
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      return null;
    }, guardrail.high.id);

    expect(undone, 'undo strip never appeared').toBeTruthy();
    expect(undone.undoText).toContain(guardrail.high.id);
    expect(undone.hiddenAfter).toBe(true);
    expect(undone.uiState.undoDesignation).toBeNull();
  });

  test('exports replay artifacts and opens replay transport', async ({ page }) => {
    await getTestApi(page);

    // The e2e ring capture ticks at 600ms; wait for the first tick so the
    // exported session provably contains ring data.
    await expect.poll(async () =>
      page.evaluate(() => window.__TAK_FLOW_TEST__.getReplayExportMetadata().ringBufferLength)
    , { timeout: 10000 }).toBeGreaterThan(0);

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
    expect(download.suggestedFilename()).toMatch(/^replay\.tak-flow\..+\.json$/);

    const path = await download.path();
    expect(path).toBeTruthy();

    const replayPayload = await page.evaluate(() => window.__TAK_FLOW_TEST__.getReplayExportMetadata());

    expect(replayPayload.version).toBe('tak-flow.replay.v2');
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
