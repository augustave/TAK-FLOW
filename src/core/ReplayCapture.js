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
        if (this._tickInterval) return;
        window.opsLogInstance?.addEntry('MODE', 'SYSTEM', 'REPLAY CAPTURE ACTIVE', 0, 999);
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

    _getOpsLogDelta(consume = true) {
        const logs = store.get('opsLog') || [];
        const unseen = [];
        for (let i = logs.length - 1; i >= 0; i--) {
            const entry = logs[i];
            const key = `${entry.ts}|${entry.action}|${entry.target}|${entry.details}|${entry.severity}|${entry.timeToEvent}`;
            if (this._seenOpsLogKeys.has(key)) continue;
            unseen.unshift({ ...entry });
            if (consume) this._seenOpsLogKeys.add(key);
        }
        return unseen;
    }

    _buildSnapshot(triggerEvent = null, options = {}) {
        const consumeOpsLogDelta = options.consumeOpsLogDelta !== false;
        const timestamp = this._getTimestamp();
        const trackState = cloneTrackState(this.trackManager.getReplayTrackState());
        const upfState = this.trackManager.getUpfFocusSnapshot();
        const pendingDesignation = store.get('pendingDesignation');
        const undoDesignation = store.get('undoDesignation');
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
                primaryId: upfState.primaryId || null,
                coneAngleDeg: 0,
                candidates: upfState.candidateIds || [],
                active: Boolean(upfState.active),
                coneX: safeNumber(upfState.coneX),
                coneY: safeNumber(upfState.coneY),
                radius: safeNumber(upfState.radius, 12),
                cursorX: safeNumber(upfState.cursorX),
                cursorY: safeNumber(upfState.cursorY),
                primaryConfidence: safeNumber(upfState.primaryConfidence),
                lastUpdatedMs: safeNumber(upfState.lastUpdatedMs)
            },
            opsLogDelta: this._getOpsLogDelta(consumeOpsLogDelta),
            recommendedAction: {
                active: Boolean(this.domController?.vjepaWarningActive),
                type: this.domController?.vjepaWarningActive ? 'V-JEPA' : null,
                counterfactualBound: Boolean(this.trackManager?.counterfactualScanState?.active)
            },
            counterfactualState: {
                active: Boolean(this.trackManager?.counterfactualScanState?.active),
                x: safeNumber(this.trackManager?.counterfactualScanState?.x),
                y: safeNumber(this.trackManager?.counterfactualScanState?.y),
                radius: safeNumber(this.trackManager?.counterfactualScanState?.radius)
            },
            uiState: {
                selectedTrackId: store.get('selectedTrackId') || null,
                reconMode: Boolean(store.get('reconMode')),
                destinationMode: Boolean(this.domController?.destinationMode),
                pendingDesignation: pendingDesignation ? { ...pendingDesignation } : null,
                pendingDesignationStage: safeNumber(store.get('pendingDesignationStage')),
                undoDesignation: undoDesignation
                    ? {
                        trackId: undoDesignation.trackId || null,
                        details: undoDesignation.details || '',
                        mgrs: undoDesignation.mgrs || null
                    }
                    : null,
                confirmVisible: this.domController?.confirmStrip?.style.display === 'flex',
                undoVisible: this.domController?.undoStrip?.style.display === 'flex',
                vjepaHoverActive: Boolean(this.domController?.vjepaHoverActive)
            },
            designationQueue: this.trackManager.getDesignationQueueSnapshot(),
            triggerEvent
        };
    }

    createSnapshot(triggerEvent = null, options = {}) {
        return this._buildSnapshot(triggerEvent, options);
    }

    getExportFilename() {
        return `replay.tak-h.${this.sessionId}.${this.startTimestamp}.json`;
    }

    serializeSession() {
        return structuredClone({
            version: SNAPSHOT_VERSION,
            sessionId: this.sessionId,
            startTimestamp: this.startTimestamp,
            ringBuffer: this.ringBuffer,
            eventSnapshots: this.eventSnapshots
        });
    }

    _tickCapture(force = false) {
        if (this.trackManager?.replayMode) return null;
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
        if (this.trackManager?.replayMode) return null;
        const snapshot = this._buildSnapshot(eventType);
        this.eventSnapshots.push(snapshot);
        window.dispatchEvent(new CustomEvent('replay:capture-updated'));
        return snapshot;
    }

    exportSession() {
        const payload = this.serializeSession();
        const json = JSON.stringify(payload, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = this.getExportFilename();
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
