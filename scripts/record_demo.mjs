// Records the canonical mission replay artifact shipped at
// public/demo/replay.tak-flow.canonical-mission-01.json (served by ?demo=1).
// Non-CI lane: run `npm run record:demo` after any change that affects
// replay fidelity, then commit the refreshed artifact.
//
// The recorded drill uses the GHOST-DISCRIMINATION-DRILL training preset
// (patrol population + DJI ghost family) so the artifact stays small.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const PORT = 4198;
const BASE = `http://127.0.0.1:${PORT}`;
const OUT_PATH = path.resolve('public/demo/replay.tak-flow.canonical-mission-01.json');
const MAX_BYTES = 8 * 1024 * 1024;

function waitForServer(url, timeoutMs = 60000) {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
        const probe = async () => {
            try {
                const response = await fetch(url);
                if (response.ok) return resolve();
            } catch { /* not up yet */ }
            if (Date.now() - startedAt > timeoutMs) return reject(new Error('preview server never came up'));
            setTimeout(probe, 400);
        };
        probe();
    });
}

const server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT)], {
    stdio: 'ignore',
    detached: false
});

try {
    await waitForServer(BASE);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto(`${BASE}/?e2e=1`);
    await page.waitForFunction(() => Boolean(window.__TAK_FLOW_TEST__));
    await page.waitForSelector('#track-tbody tr');

    // Arm the drill: patrol picture + DJI ghost family + default EW zone.
    await page.selectOption('#training-preset-select', 'GHOST-DISCRIMINATION-DRILL');
    await page.click('#btn-preset-arm');
    await page.waitForTimeout(2000);

    // Mission beats (mirrors the CONOPS structure at drill scale).
    await page.evaluate(() => {
        const api = window.__TAK_FLOW_TEST__;
        api.captureReplayEvent('MISSION_START');
    });

    // Ghost designation refusal.
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
        const api = window.__TAK_FLOW_TEST__;
        const ctx = window.opsLogInstance.exportContextGetter();
        for (const [id] of ctx.trackManager.liveTrackStateById.entries()) {
            if (id.startsWith('GHOST-')) {
                api.selectTrack(id);
                api.stageDesignation(id);
                break;
            }
        }
    });

    // EW squall: widen the zone briefly, then lift it.
    await page.evaluate(() => window.__TAK_FLOW_TEST__.setEwZone(0, 0, 30));
    await page.waitForTimeout(4000);
    await page.evaluate(() => window.__TAK_FLOW_TEST__.setEwZone(0, 0, 10));

    // Advisory onset + counterfactual macro.
    await page.evaluate(() => {
        const api = window.__TAK_FLOW_TEST__;
        api.forceTelemetry({ polarization: 0.21, milling: 0.58, cohesion: 0.03, activeCount: 150, com: { x: 4, y: -6 } });
        api.executeRecommendedAction();
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__TAK_FLOW_TEST__.clearTelemetryOverride());

    // Clean designation + undo on a high-confidence track.
    await page.evaluate(() => {
        const api = window.__TAK_FLOW_TEST__;
        const high = api.listTracks().find((t) => t.confidenceScore >= 0.6 && !t.id.startsWith('GHOST-'));
        api.selectTrack(high.id);
        api.stageDesignation(high.id);
    });
    await page.keyboard.press('r');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(600);
    await page.locator('#btn-undo').click();

    await page.waitForTimeout(1500);
    await page.evaluate(() => window.__TAK_FLOW_TEST__.captureReplayEvent('MISSION_COMPLETE'));

    const session = await page.evaluate(() => {
        const ctx = window.opsLogInstance.exportContextGetter();
        return ctx.trackManager.replayCapture.serializeSession();
    });
    await browser.close();

    const json = JSON.stringify(session);
    if (json.length > MAX_BYTES) {
        throw new Error(`artifact too large: ${(json.length / 1024 / 1024).toFixed(1)} MB > 8 MB — shorten the mission`);
    }
    mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, json);
    console.log(`recorded ${OUT_PATH}: ${(json.length / 1024).toFixed(0)} KB, ` +
        `${session.ringBuffer.length} ring + ${session.eventSnapshots.length} event snapshots, version ${session.version}`);
} finally {
    server.kill();
}
