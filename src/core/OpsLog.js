import { store } from './Store.js';

export class OpsLog {
    constructor() {
        this.feedEl = document.getElementById('ops-log-feed');
        this.exportContextGetter = null;
        
        document.getElementById('btn-export-log')?.addEventListener('click', () => {
            const report = this.buildTelemetryReport();
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", "TAK_TELEMETRY_REPORT_" + new Date().toISOString() + ".json");
            dlAnchorElem.click();
            this.addEntry('MODE', 'SYSTEM', 'OPS LOG EXPORTED');
        });

        document.getElementById('btn-clear-log')?.addEventListener('click', () => {
            store.set('opsLog', []);
            // This relies on a global clearUndoWindow which should be in DOMController
            // We dispatch an event or trigger it safely.
            if(window.clearUndoWindow) window.clearUndoWindow();
            if(this.feedEl) this.feedEl.replaceChildren();
            this.addEntry('MODE', 'SYSTEM', 'SESSION CLEARED');
        });

        this.addEntry('MODE', 'SYSTEM', 'SESSION INITIALIZED');
    }

    setExportContext(getter) {
        this.exportContextGetter = typeof getter === 'function' ? getter : null;
    }

    appendSpan(parent, className, text) {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        parent.appendChild(span);
    }

    addEntry(action, target, details, severity = 0, timeToEvent = 999) {
        const now = new Date();
        const ts = now.toISOString().substr(11, 8) + 'Z';
        // Severity scale: 0 = Info, 1 = Warn, 2 = Critical
        const entryObj = { ts, action, target, details, severity, timeToEvent };
        
        let logs = [...store.get('opsLog')];
        logs.push(entryObj);
        
        // PRD Requirement: Alert Queue Priority Rules
        // 1. HIGH threat first (highest severity)
        // 2. Shortest time_to_event next
        // 3. Most recent timestamp fallback
        logs.sort((a, b) => {
            if (b.severity !== a.severity) return b.severity - a.severity;
            if (a.timeToEvent !== b.timeToEvent) return a.timeToEvent - b.timeToEvent;
            return b.ts.localeCompare(a.ts);
        });
        
        // Cap history to 50 for performance
        if (logs.length > 50) logs = logs.slice(0, 50);
        store.set('opsLog', logs);
        
        this.renderFeed();
        return true;
    }

    renderFeed() {
        if (!this.feedEl) return;
        this.feedEl.replaceChildren();
        
        const logs = store.get('opsLog');
        logs.forEach(log => {
            const entry = document.createElement('div');
            entry.className = 'sigint-entry';
            
            // Map styling
            let colorClass = 'info';
            if (log.severity === 1) colorClass = 'warn';
            if (log.severity === 2) colorClass = 'crit sigint-flash'; // Add flashing class for HIGH threats
            
            if (log.action === 'DESIGNATE') colorClass += ' crit';
            
            this.appendSpan(entry, 'sigint-time', log.ts);
            this.appendSpan(entry, `sigint-tag ${colorClass}`, log.action);
            this.appendSpan(entry, 'sigint-text', `[${log.target}] ${log.details}`);
            
            this.feedEl.appendChild(entry);
        });
    }

    safeClone(value) {
        return JSON.parse(JSON.stringify(value, (key, val) => {
            if (val instanceof Set) return Array.from(val.values());
            if (val instanceof Map) return Array.from(val.entries());
            if (val && typeof val === 'object') {
                const hasXYZ = typeof val.x === 'number' && typeof val.y === 'number' && typeof val.z === 'number';
                const hasXY = typeof val.x === 'number' && typeof val.y === 'number' && val.z === undefined;
                if (hasXYZ) return { x: val.x, y: val.y, z: val.z };
                if (hasXY) return { x: val.x, y: val.y };
            }
            return val;
        }));
    }

    withSectionCapture(target, key, producer) {
        try {
            target[key] = producer();
        } catch (err) {
            target[key] = {
                error: err?.message || String(err)
            };
        }
    }

    snapshotSigintFeed(sigintFeed) {
        const entries = [];
        const feedEl = sigintFeed?.feedEl;
        if (feedEl) {
            const nodes = Array.from(feedEl.querySelectorAll('.sigint-entry'));
            nodes.forEach((node) => {
                entries.push({
                    tag: node.dataset.tag || '',
                    time: node.querySelector('.sigint-time')?.textContent || '',
                    level: node.querySelector('.sigint-tag')?.textContent || '',
                    text: node.querySelector('.sigint-text')?.textContent || ''
                });
            });
        }

        return {
            activeFilter: sigintFeed?.activeFilter || 'all',
            sigIdx: sigintFeed?.sigIdx || 0,
            paused: Boolean(store.get('sigintPaused')),
            statusBadge: sigintFeed?.sigintStatusBadgeEl?.textContent || '',
            entries
        };
    }

    snapshotTrackManager(trackManager) {
        const instances = {};
        const instanceKeys = Object.keys(trackManager?.instances || {});
        instanceKeys.forEach((type) => {
            const inst = trackManager.instances[type];
            instances[type] = {
                trackCount: inst?.tracks?.length || 0,
                meshCount: inst?.mesh?.count ?? 0,
                tracks: (inst?.tracks || []).map((tr) => ({
                    id: tr?.t?.id || null,
                    type: tr?.t?.type || null,
                    subtype: tr?.t?.subtype || null,
                    baseX: tr?.baseX ?? null,
                    baseY: tr?.baseY ?? null,
                    pos: tr?.pos ? { x: tr.pos.x, y: tr.pos.y } : null,
                    vel: tr?.vel ? { x: tr.vel.x, y: tr.vel.y } : null,
                    z: tr?.z ?? 0,
                    isSwarm: Boolean(tr?.isSwarm),
                    alerted: Boolean(tr?.alerted),
                    isHiddenByCentroid: Boolean(tr?.t?.isHiddenByCentroid),
                    desiredOpforVector: tr?.desiredOpforVector ? { x: tr.desiredOpforVector.x, y: tr.desiredOpforVector.y } : null
                }))
            };
        });

        const liveTrackStateById = {};
        if (trackManager?.liveTrackStateById instanceof Map) {
            trackManager.liveTrackStateById.forEach((value, key) => {
                liveTrackStateById[key] = this.safeClone(value);
            });
        }

        const centroidIdMap = this.safeClone(trackManager?.centroidIdMap || {});
        const hostileIdMap = this.safeClone(trackManager?.hostileIdMap || {});
        const emconIdMap = this.safeClone(trackManager?.emconIdMap || {});
        const numericTrackIdMap = trackManager?.numericTrackIdMap instanceof Map ? Object.fromEntries(trackManager.numericTrackIdMap.entries()) : {};
        const emconMetaByNumericId = trackManager?.emconMetaByNumericId instanceof Map ? Object.fromEntries(trackManager.emconMetaByNumericId.entries()) : {};
        const ghostMetaByNumericId = trackManager?.ghostMetaByNumericId instanceof Map ? Object.fromEntries(trackManager.ghostMetaByNumericId.entries()) : {};

        const selectedTrackId = store.get('selectedTrackId');
        const selectedTrack = selectedTrackId ? trackManager?.getTrackById?.(selectedTrackId) : null;
        const selectedProvenance = selectedTrackId ? trackManager?.getProvenance?.(selectedTrackId) : null;
        const selectedConfidenceScore = selectedTrackId ? trackManager?.getTrackConfidenceScore?.(selectedTrackId) : null;
        const selectedDestination = selectedTrackId ? trackManager?.getDestination?.(selectedTrackId) : null;

        return {
            workerPending: Boolean(trackManager?.workerPending),
            counts: {
                totalTrackData: trackManager?.trackData?.length || 0,
                activeTrackDataVisible: trackManager?.getTrackData?.()?.length || 0,
                centroidMeshCount: trackManager?.centroidMesh?.count ?? 0,
                emconMeshCount: trackManager?.emconMesh?.count ?? 0
            },
            swarmTelemetry: this.safeClone(trackManager?.swarmTelemetry || {}),
            hiddenTrackIds: Array.from(trackManager?.hiddenTrackIds || []),
            trackLossLogs: Array.from(trackManager?.trackLossLogs || []),
            emconLogs: Array.from(trackManager?.emconLogs || []),
            centroidLogs: Array.from(trackManager?.centroidLogs || []),
            trackData: this.safeClone(trackManager?.trackData || []),
            provenanceByTrackId: this.safeClone(trackManager?.provenanceByTrackId || {}),
            trackDestinations: this.safeClone(trackManager?.trackDestinations || {}),
            latestUiMetadata: this.safeClone(trackManager?.latestUiMetadata || null),
            latestEmconMetadata: this.safeClone(trackManager?.latestEmconMetadata || []),
            latestGhostMetadata: this.safeClone(trackManager?.latestGhostMetadata || []),
            latestRenderingBuffer: trackManager?.latestRenderingBuffer ? Array.from(trackManager.latestRenderingBuffer) : [],
            liveTrackStateById,
            idMappings: {
                centroidIdMap,
                hostileIdMap,
                emconIdMap,
                numericTrackIdMap,
                emconMetaByNumericId,
                ghostMetaByNumericId
            },
            selectedTrack: {
                id: selectedTrackId,
                data: this.safeClone(selectedTrack),
                provenance: this.safeClone(selectedProvenance),
                confidenceScore: selectedConfidenceScore,
                destination: this.safeClone(selectedDestination)
            },
            overlays: {
                reconSplatVisible: Boolean(trackManager?.reconSplatGroup?.visible),
                reconPointDrawCount: trackManager?.reconPoints?.geometry?.drawRange?.count ?? 0,
                counterfactualScanVisible: Boolean(trackManager?.counterfactualScanGroup?.visible)
            },
            counterfactualScanState: this.safeClone(trackManager?.counterfactualScanState || {}),
            instances
        };
    }

    snapshotMapEngine(mapEngine) {
        const camera = mapEngine?.camera;
        const uniforms = mapEngine?.uniforms || {};
        const serializeUniform = (uniformValue) => {
            const v = uniformValue?.value;
            if (Array.isArray(v)) return v.map((item) => this.safeClone(item));
            return this.safeClone(v);
        };
        const uniformSnapshot = {};
        Object.keys(uniforms).forEach((k) => {
            uniformSnapshot[k] = serializeUniform(uniforms[k]);
        });

        return {
            camera: camera ? {
                position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
                rotation: { x: camera.rotation.x, y: camera.rotation.y, z: camera.rotation.z },
                quaternion: { x: camera.quaternion.x, y: camera.quaternion.y, z: camera.quaternion.z, w: camera.quaternion.w },
                fov: camera.fov,
                aspect: camera.aspect,
                near: camera.near,
                far: camera.far
            } : null,
            renderer: mapEngine?.renderer ? {
                width: mapEngine.renderer.domElement?.width || null,
                height: mapEngine.renderer.domElement?.height || null,
                pixelRatio: mapEngine.renderer.getPixelRatio()
            } : null,
            composer: {
                bloomStrength: mapEngine?.bloomPass?.strength ?? null,
                filmNoise: mapEngine?.filmPass?.uniforms?.nIntensity?.value ?? null,
                filmScanline: mapEngine?.filmPass?.uniforms?.sIntensity?.value ?? null
            },
            uniforms: uniformSnapshot,
            explosions: (mapEngine?.explosions || []).map((e) => ({ x: e.x, y: e.y, z: e.z })),
            radarRotationZ: mapEngine?.radarMesh?.rotation?.z ?? null
        };
    }

    snapshotDrawController(drawController) {
        const zones = [];
        (drawController?.zones || []).forEach((zone, idx) => {
            const outline = zone?.children?.find((c) => c.isLine && c.geometry?.attributes?.position);
            let points = [];
            if (outline) {
                const arr = outline.geometry.attributes.position.array;
                for (let i = 0; i < arr.length; i += 3) {
                    points.push({ x: arr[i], y: arr[i + 1], z: arr[i + 2] });
                }
            }
            zones.push({
                index: idx,
                visible: zone?.visible ?? true,
                pointCount: points.length,
                points
            });
        });

        return {
            isDrawing: Boolean(drawController?.isDrawing),
            activeDraftPoints: (drawController?.points || []).map((p) => ({ x: p.x, y: p.y, z: p.z })),
            totalZones: (drawController?.zones || []).length,
            zones
        };
    }

    snapshotDomController(domController) {
        return {
            destinationMode: Boolean(domController?.destinationMode),
            filterSearch: domController?.filterSearch || '',
            filterThreat: domController?.filterThreat || 'ALL',
            sortKey: domController?.sortKey || 'id',
            sortDir: domController?.sortDir || 1,
            pendingDesignationStage: store.get('pendingDesignationStage'),
            confirmStripVisible: domController?.confirmStrip?.style?.display !== 'none',
            alertText: domController?.alertTextEl?.textContent || '',
            recommendedActions: {
                badge: domController?.recommendedActionsBadgeEl?.textContent || '',
                panelCritical: domController?.recommendedActionsPanelEl?.classList?.contains('critical') || false,
                decoySuppressed: domController?.decoySimPanelEl?.classList?.contains('superseded') || false,
                vjepaWarningActive: Boolean(domController?.vjepaWarningActive),
                vjepaHoverActive: Boolean(domController?.vjepaHoverActive),
                vjepaAnchor: this.safeClone(domController?.vjepaAnchor || null)
            }
        };
    }

    snapshotHudController(hudController) {
        return {
            densityBadge: hudController?.densityBadgeEl?.textContent || '',
            densityButton: hudController?.densityButtonEl?.textContent || '',
            contrastButton: hudController?.contrastButtonEl?.textContent || '',
            motionButton: hudController?.motionButtonEl?.textContent || '',
            panelOpacityValue: hudController?.panelOpacityValueEl?.textContent || '',
            zuluClock: hudController?.zuluClock?.textContent || '',
            zuluDate: hudController?.zuluDate?.textContent || '',
            dtgDisplay: hudController?.dtgDisplay?.textContent || ''
        };
    }

    snapshotSplatController(splatController) {
        return {
            isActive: Boolean(splatController?.isActive),
            targetTrackId: splatController?.targetTrackId || null,
            targetPos: splatController?.targetPos ? {
                x: splatController.targetPos.x,
                y: splatController.targetPos.y,
                z: splatController.targetPos.z
            } : null
        };
    }

    snapshotDecoySim(decoySim) {
        return {
            profiles: this.safeClone(decoySim?.profiles || []),
            selectedProfileId: decoySim?.decoyProfileSelectEl?.value || null,
            requestedCount: Number(decoySim?.decoyCountInputEl?.value || 0),
            panel: {
                badge: decoySim?.decoySimBadgeEl?.textContent || '',
                active: decoySim?.decoyActiveEl?.textContent || '',
                lastBurst: decoySim?.decoyLastBurstEl?.textContent || ''
            },
            storeDecoyState: this.safeClone(store.get('decoySim'))
        };
    }

    buildTelemetryReport() {
        const now = new Date();
        const context = this.exportContextGetter ? this.exportContextGetter() : {};
        const report = {
            reportType: 'TAK-G TELEMETRY REPORT',
            exportedAtIso: now.toISOString(),
            exportedAtEpochMs: now.getTime(),
            runtime: {
                href: window.location.href,
                userAgent: navigator.userAgent,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight,
                    devicePixelRatio: window.devicePixelRatio
                },
                documentHidden: document.hidden
            },
            state: {
                store: this.safeClone(store.state),
                opsLog: this.safeClone(store.get('opsLog'))
            },
            systems: {}
        };

        this.withSectionCapture(report.systems, 'trackManager', () => this.snapshotTrackManager(context.trackManager));
        this.withSectionCapture(report.systems, 'sigintFeed', () => this.snapshotSigintFeed(context.sigintFeed));
        this.withSectionCapture(report.systems, 'decoySim', () => this.snapshotDecoySim(context.decoySim));
        this.withSectionCapture(report.systems, 'mapEngine', () => this.snapshotMapEngine(context.mapEngine));
        this.withSectionCapture(report.systems, 'drawController', () => this.snapshotDrawController(context.drawController));
        this.withSectionCapture(report.systems, 'domController', () => this.snapshotDomController(context.domController));
        this.withSectionCapture(report.systems, 'hudController', () => this.snapshotHudController(context.hudController));
        this.withSectionCapture(report.systems, 'splatController', () => this.snapshotSplatController(context.splatController));

        report.exportSummary = {
            sectionCount: Object.keys(report.systems).length,
            hasErrors: Object.values(report.systems).some((section) => Boolean(section && section.error)),
            opsLogEntries: report.state.opsLog.length,
            activeTrackCount: report.systems.trackManager?.counts?.activeTrackDataVisible ?? null
        };

        return report;
    }
}
