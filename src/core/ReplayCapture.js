import { store } from './Store.js';

const SNAPSHOT_VERSION = 'tak-h.replay.v1';
const CAPTURE_INTERVAL_MS = 250;
const MAX_RING_BUFFER = 14400;

function cloneTrackState(trackState) {
    return structuredClone(trackState);
}

function safeNumber(value, fallback = 0) {
    return Number.isFinite(value) ? value : fallback;
}

export class ReplayCapture {
    constructor(trackManager, domController) {
        this.trackManager = trackManager;
        this.domController = domController;
        this.ringBuffer = [];
        this.eventSnapshots = [];
        this.sessionId = crypto.randomUUID();
        this.startTimestamp = Date.now();
        this._tickInterval = null;
        this._lastCaptureAt = -Infinity;
        this._seenOpsLogKeys = new Set();
    }

    start() {
        window.opsLogInstance?.addEntry('MODE', 'SYSTEM', 'REPLAY CAPTURE ACTIVE', 0, 999);
        if (this._tickInterval) return;
        this._tickInterval = window.setInterval(() => this._tickCapture(), CAPTURE_INTERVAL_MS);
    }

    stop() {
        if (this._tickInterval) {
            clearInterval(this._tickInterval);
            this._tickInterval = null;
        }
    }

    _getTimestamp() {
        return Date.now() - this.startTimestamp;
    }

    _getOpsLogDelta() {
        const logs = store.get('opsLog') || [];
        const unseen = [];
        for (let i = logs.length - 1; i >= 0; i--) {
            const entry = logs[i];
            const key = `${entry.ts}|${entry.action}|${entry.target}|${entry.details}|${entry.severity}|${entry.timeToEvent}`;
            if (this._seenOpsLogKeys.has(key)) continue;
            unseen.unshift({ ...entry });
            this._seenOpsLogKeys.add(key);
        }
        return unseen;
    }

    _buildSnapshot(triggerEvent = null) {
        const timestamp = this._getTimestamp();
        const trackState = cloneTrackState(this.trackManager.getReplayTrackState());
        return {
            version: SNAPSHOT_VERSION,
            timestamp,
            trackState,
            orderParams: {
                polarization: safeNumber(this.trackManager.swarmTelemetry?.polarization),
                milling: safeNumber(this.trackManager.swarmTelemetry?.milling),
                cohesion: safeNumber(this.trackManager.swarmTelemetry?.cohesion),
                activeCount: safeNumber(this.trackManager.swarmTelemetry?.activeCount)
            },
            vejpaGate: {
                active: Boolean(this.domController?.vjepaWarningActive),
                onset: this.domController?.vjepaGateOnsetMs ?? null
            },
            ufpState: {
                primaryId: this.trackManager.upfFocusState?.primaryId || null,
                coneAngleDeg: 0,
                candidates: Array.from(this.trackManager.upfFocusState?.candidateIds || [])
            },
            opsLogDelta: this._getOpsLogDelta(),
            recommendedAction: {
                active: Boolean(this.domController?.vjepaWarningActive),
                type: this.domController?.vjepaWarningActive ? 'V-JEPA' : null,
                counterfactualBound: Boolean(this.trackManager?.counterfactualScanState?.active)
            },
            designationQueue: this.trackManager.getDesignationQueueSnapshot(),
            triggerEvent
        };
    }

    _tickCapture(force = false) {
        const now = performance.now();
        if (!force && now - this._lastCaptureAt < (CAPTURE_INTERVAL_MS - 5)) return;
        this._lastCaptureAt = now;
        const snapshot = this._buildSnapshot(null);
        this.ringBuffer.push(snapshot);
        if (this.ringBuffer.length > MAX_RING_BUFFER) {
            this.ringBuffer.splice(0, this.ringBuffer.length - MAX_RING_BUFFER);
        }
        window.dispatchEvent(new CustomEvent('replay:capture-updated'));
        return snapshot;
    }

    captureEvent(eventType) {
        const snapshot = this._buildSnapshot(eventType);
        this.eventSnapshots.push(snapshot);
        window.dispatchEvent(new CustomEvent('replay:capture-updated'));
        return snapshot;
    }

    exportSession() {
        const payload = structuredClone({
            version: SNAPSHOT_VERSION,
            sessionId: this.sessionId,
            startTimestamp: this.startTimestamp,
            ringBuffer: this.ringBuffer,
            eventSnapshots: this.eventSnapshots
        });
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `replay.tak-h.${this.sessionId}.${this.startTimestamp}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        return json;
    }

    importSession(jsonString) {
        let parsed;
        try {
            parsed = JSON.parse(jsonString);
        } catch (err) {
            throw new Error(`Replay import failed: invalid JSON (${err.message})`);
        }

        if (!parsed || parsed.version !== SNAPSHOT_VERSION) {
            throw new Error('Replay import failed: unsupported schema version');
        }
        if (!Array.isArray(parsed.ringBuffer) || !Array.isArray(parsed.eventSnapshots)) {
            throw new Error('Replay import failed: missing replay buffers');
        }

        this.ringBuffer = parsed.ringBuffer;
        this.eventSnapshots = parsed.eventSnapshots;
        this.sessionId = parsed.sessionId || crypto.randomUUID();
        this.startTimestamp = parsed.startTimestamp || Date.now();
        this._seenOpsLogKeys = new Set();
        return true;
    }
}
