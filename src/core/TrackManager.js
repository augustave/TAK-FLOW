import * as THREE from 'three';
import { trackData, sources, confidences, loadScenario } from '../data/mockData.js';
import { store } from './Store.js';

export class TrackManager {
    constructor(overlayGroup) {
        this.overlayGroup = overlayGroup;
        this.trackData = trackData;
        this.provenanceByTrackId = {};
        this.trackDestinations = {};
        this.typeColors = { hostile: new THREE.Color(0xff3333), friendly: new THREE.Color(0x4a9eff), unknown: new THREE.Color(0xffcc00) };
        
        this.geometries = {
            // Hostile: Diamond with a tail
            hostile: new THREE.ShapeGeometry((() => { 
                const s = new THREE.Shape(); 
                s.moveTo(0, -0.6); s.lineTo(-0.5, 0.4); s.lineTo(0, 0.2); s.lineTo(0.5, 0.4); s.closePath(); 
                return s; 
            })()),
            
            // Friendly: Circle with a tail
            friendly: new THREE.ShapeGeometry((() => { 
                const s = new THREE.Shape(); 
                s.absarc(0, 0, 0.4, 0, Math.PI * 2, false);
                s.moveTo(-0.2, 0.35); s.lineTo(0, 0.8); s.lineTo(0.2, 0.35); // Tail pointing "back"
                return s; 
            })()),
            
            // Unknown: Square with a tail
            unknown: new THREE.ShapeGeometry((() => { 
                const s = new THREE.Shape(); 
                s.moveTo(0, 0.5); s.lineTo(0.5, 0); s.lineTo(0.2, -0.3); s.lineTo(0, -0.8); s.lineTo(-0.2, -0.3); s.lineTo(-0.5, 0); s.closePath(); 
                return s; 
            })())
        };
        
        this.instances = {
            hostile: { mesh: null, tracks: [] },
            friendly: { mesh: null, tracks: [] },
            unknown: { mesh: null, tracks: [] }
        };

        this.workerPending = false;
        this.latestRenderingBuffer = null;
        this.latestUiMetadata = null;
        this.latestEmconMetadata = [];
        this.latestGhostMetadata = [];
        this.hiddenTrackIds = new Set();
        this.centroidIdMap = {};
        this.hostileIdMap = {};
        this.emconIdMap = {};
        this.numericTrackIdMap = new Map();
        this.emconMetaByNumericId = new Map();
        this.ghostMetaByNumericId = new Map();
        this.liveTrackStateById = new Map();
        this.trackLossLogs = new Set();

        // Phase 12 Dynamical System Validation Harness
        this.swarmTelemetry = {
            polarization: 0,
            milling: 0,
            cohesion: 0,
            com: new THREE.Vector2(),
            activeCount: 0
        };
        this.counterfactualScanState = {
            active: false,
            x: 0,
            y: 0,
            radius: 12
        };
        this.upfConfig = {
            coneRadius: 12.0,
            nonPrimaryOpacity: 0.15
        };
        this.upfFocusState = {
            active: false,
            coneX: 0,
            coneY: 0,
            radius: this.upfConfig.coneRadius,
            radiusSq: this.upfConfig.coneRadius * this.upfConfig.coneRadius,
            cursorX: 0,
            cursorY: 0,
            primaryId: null,
            primaryConfidence: 0,
            candidateIds: new Set(),
            lastUpdatedMs: 0
        };
        this.upfTrackedIds = new Set();
        this.upfPrimaryWorldPos = null;
        this._upfColorA = new THREE.Color();
        this._upfColorB = new THREE.Color();
        this.replayCapture = null;
        this.replayMode = false;

        // Phase 13: OPFOR Web Worker
        this.initOpforWorker();

        this.initTracks();
    }

    initOpforWorker() {
        this.opforWorker = new Worker(new URL('./opforWorker.js', import.meta.url), { type: 'module' });
        this.workerPending = false;
        
        this.opforWorker.onmessage = (e) => {
            const payload = e.data || {};
            if (payload.type === 'TRACK_LOST') {
                this.handleTrackLost(payload.id);
                return;
            }

            this.workerPending = false;
            if (payload.intents) {
                this.applyOpforIntents(new Float32Array(payload.intents));
            }
            if (payload.render) {
                this.latestRenderingBuffer = new Float32Array(payload.render);
            }
            if (payload.ui) {
                this.latestUiMetadata = payload.ui;
                this.updateUiSwarms(payload.ui.centroids || []);
                this.latestEmconMetadata = (payload.ui.emcon || []).map(emconData => {
                    const workerId = emconData.id;
                    const realId = this.resolveWorkerTrackId(workerId);
                    return { ...emconData, realId };
                });
                this.emconMetaByNumericId = new Map();
                this.latestEmconMetadata.forEach(emconData => {
                    this.emconMetaByNumericId.set(emconData.numericId, emconData);
                });

                this.latestGhostMetadata = payload.ui.ghosts || [];
                this.ghostMetaByNumericId = new Map();
                this.latestGhostMetadata.forEach(ghostData => {
                    this.ghostMetaByNumericId.set(ghostData.numericId, ghostData);
                });
                
                if (this.latestEmconMetadata.length > 0 && window.opsLogInstance) {
                    if (!this.emconLogs) this.emconLogs = new Set();
                    this.latestEmconMetadata.forEach(emconData => {
                        if (!this.emconLogs.has(emconData.id)) {
                            this.emconLogs.add(emconData.id);
                            const displayId = emconData.realId || emconData.id;
                            window.opsLogInstance.addEntry('WARNING', `[EW ALERT]`, `TRACK ${displayId} DATALINK SEVERED. INITIATING KINEMATIC EXTRAPOLATION.`, 2, 45);
                        }
                    });
                }
            }
        };
    }

    updateUiSwarms(uiMetadata) {
        this.hiddenTrackIds = new Set();
        uiMetadata.forEach(c => {
            c.childIds.forEach(id => this.hiddenTrackIds.add(id));
            if (window.opsLogInstance) {
                const logKey = `CENTROID-${c.id}`;
                if (!this.centroidLogs) this.centroidLogs = new Set();
                if (!this.centroidLogs.has(logKey)) {
                    this.centroidLogs.add(logKey);
                    window.opsLogInstance.addEntry('CRITICAL', `[SWARM-CENTROID]`, `${c.count} TRACKS - HIGH COHESION DETECTED`, 1, 30);
                }
            }
        });
        
        this.trackData.forEach(t => {
            const numId = parseInt(t.id.replace(/\D/g, '')) || 0;
            t.isHiddenByCentroid = this.hiddenTrackIds.has(numId);
        });
    }

    resolveWorkerTrackId(workerTrackId) {
        if (typeof workerTrackId !== 'string') return workerTrackId;
        if (workerTrackId.startsWith('SW-')) {
            const numericId = parseInt(workerTrackId.substring(3), 10);
            return this.numericTrackIdMap.get(numericId) || workerTrackId;
        }
        return workerTrackId;
    }

    removeTrackFromScope(trackId) {
        if (!trackId || typeof trackId !== 'string') return false;
        let removed = false;

        const dataIdx = this.trackData.findIndex(t => t.id === trackId);
        if (dataIdx !== -1) {
            this.trackData.splice(dataIdx, 1);
            removed = true;
        }

        Object.values(this.instances).forEach(inst => {
            const before = inst.tracks.length;
            inst.tracks = inst.tracks.filter(tr => tr.t.id !== trackId);
            if (inst.tracks.length !== before) {
                removed = true;
                if (inst.mesh) {
                    inst.mesh.count = Math.min(inst.mesh.count, inst.tracks.length);
                    inst.mesh.instanceMatrix.needsUpdate = true;
                    if (inst.mesh.instanceColor) inst.mesh.instanceColor.needsUpdate = true;
                }
            }
        });

        if (this.provenanceByTrackId[trackId]) delete this.provenanceByTrackId[trackId];
        if (this.trackDestinations[trackId]) delete this.trackDestinations[trackId];
        this.liveTrackStateById.delete(trackId);

        if (store.get('selectedTrackId') === trackId) {
            store.set('selectedTrackId', null);
            store.set('reconMode', false);
        }

        return removed;
    }

    handleTrackLost(workerTrackId) {
        const resolvedTrackId = this.resolveWorkerTrackId(workerTrackId);
        const removedResolved = this.removeTrackFromScope(resolvedTrackId);
        const removedWorker = !removedResolved && resolvedTrackId !== workerTrackId
            ? this.removeTrackFromScope(workerTrackId)
            : false;

        const displayId = removedResolved || removedWorker ? (resolvedTrackId || workerTrackId) : (resolvedTrackId || workerTrackId);
        if (window.opsLogInstance && displayId && !this.trackLossLogs.has(displayId)) {
            this.trackLossLogs.add(displayId);
            window.opsLogInstance.addEntry('INFO', displayId, `TRACK ${displayId} DROPPED FROM SCOPE - SIGNAL LOST`, 0, 999);
        }
    }

    sendStateToWorker() {
        if (this.workerPending) return;
        const swarms = [];
        Object.values(this.instances).forEach(inst => {
            inst.tracks.forEach(tr => {
                if (tr.isSwarm) swarms.push({ tr, type: inst.mesh.userData.type });
            });
        });

        const subtypeToCode = {
            'XLUUV_ORCA': 10,
            'LUUV_SNAKEHEAD': 11,
            'MUUV_KNIFEFISH': 12,
            'SUUV_SANDSHARK': 13
        };

        const buffer = new Float32Array(swarms.length * 9);
        let idx = 0;
        this.numericTrackIdMap = new Map();

        for (let i = 0; i < swarms.length; i++) {
            const item = swarms[i];
            const tr = item.tr;
            
            const numId = parseInt(tr.t.id.replace(/\D/g, '')) || 0;
            const subtypeCode = subtypeToCode[tr.t.subtype] || 0;
            this.numericTrackIdMap.set(numId, tr.t.id);
            buffer[idx++] = numId;
            buffer[idx++] = item.type === 'hostile' ? 1.0 : (item.type === 'friendly' ? 0.0 : 2.0);
            buffer[idx++] = tr.pos.x;
            buffer[idx++] = tr.pos.y;
            buffer[idx++] = tr.z || 0.0;
            buffer[idx++] = tr.vel ? tr.vel.x : 0.0;
            buffer[idx++] = tr.vel ? tr.vel.y : 0.0;
            buffer[idx++] = tr.t.threat_level === 'HIGH' ? 1.0 : (tr.t.threat_level === 'MEDIUM' ? 0.5 : 0.0);
            buffer[idx++] = subtypeCode;
        }

        const decoyState = store.get('decoySim') || {};
        this.workerPending = true;

        // Fetch AlphaEarth payload
        let aeBuffer = null;
        if (window.opsLogInstance) {
            const expCtx = window.opsLogInstance.exportContext;
            if (expCtx) {
                const mapEng = expCtx().mapEngine;
                if (mapEng && mapEng.alphaEarthData) {
                    aeBuffer = mapEng.alphaEarthData.buffer;
                }
            }
        }

        const msgPayload = {
            buffer: buffer.buffer,
            decoyActive: Boolean(decoyState.running),
            decoyBurstCount: Number(decoyState.burstCount) || 0
        };

        const transferrables = [buffer.buffer];
        if (aeBuffer) {
            msgPayload.alphaEarthBuffer = aeBuffer;
            // Since MapEngine holds `alphaEarthData` statefully, we don't transfer ownership to worker, just slice it.
            msgPayload.alphaEarthBuffer = aeBuffer.slice(0);
        }

        this.opforWorker.postMessage(msgPayload, transferrables);
    }

    applyOpforIntents(intentsBuffer) {
        // [id, vx, vy, vz]
        const intentMap = new Map();
        for (let i = 0; i < intentsBuffer.length; i += 4) {
            intentMap.set(intentsBuffer[i], new THREE.Vector2(intentsBuffer[i+1], intentsBuffer[i+2]));
        }

        Object.values(this.instances).forEach(inst => {
            if (inst.mesh.userData.type !== 'hostile') return;
            
            inst.tracks.forEach(tr => {
                if (tr.isSwarm) {
                    const numId = parseInt(tr.t.id.replace(/\D/g, '')) || 0;
                    if (intentMap.has(numId)) {
                        tr.desiredOpforVector = intentMap.get(numId);
                    }
                }
            });
        });
    }

    initTracks() {
        this.trackData.forEach(t => {
            this.provenanceByTrackId[t.id] = {
                source: sources[Math.floor(Math.random() * sources.length)],
                confidence: confidences[Math.floor(Math.random() * confidences.length)],
                lastUpdate: Date.now() - Math.random() * 300000
            };
            
            if (this.instances[t.type]) {
                const UUV_SUBTYPES = {
                    'XLUUV_ORCA': { mass_kg: 50000, max_speed_kts: 8.0, turn_radius_m: 15.0 },
                    'LUUV_SNAKEHEAD': { mass_kg: 3000, max_speed_kts: 10.0, turn_radius_m: 5.0 },
                    'MUUV_KNIFEFISH': { mass_kg: 500, max_speed_kts: 12.0, turn_radius_m: 1.5 },
                    'SUUV_SANDSHARK': { mass_kg: 30, max_speed_kts: 5.0, turn_radius_m: 0.2 }
                };
                const isSwarm = t.subtype === 'UAS SWARM' || UUV_SUBTYPES.hasOwnProperty(t.subtype);
                const angle = Math.random() * Math.PI * 2;
                this.instances[t.type].tracks.push({
                    t: t,
                    baseX: t.x, baseY: t.y, offset: Math.random() * Math.PI * 2,
                    isSwarm: isSwarm,
                    isUUV: UUV_SUBTYPES.hasOwnProperty(t.subtype),
                    uuvParams: UUV_SUBTYPES[t.subtype] || null,
                    z: 0.0,
                    alerted: false, // Track if we've fired the 60s warning
                    pos: new THREE.Vector2(t.x, t.y),
                    vel: isSwarm ? new THREE.Vector2(Math.cos(angle), Math.sin(angle)).multiplyScalar((t.spd / 120) * 0.5 + 0.1) : null
                });
            }
        });

        Object.keys(this.instances).forEach(type => {
            const inst = this.instances[type];
            const count = inst.tracks.length;
            if (count === 0) return;
            
            // Dim unknown tracks significantly so they are less dense/distracting on the terrain
            const baseOpacity = type === 'unknown' ? 0.25 : 0.82;
            const mat = new THREE.MeshBasicMaterial({ color: this.typeColors[type], transparent: true, opacity: baseOpacity });
            inst.mesh = new THREE.InstancedMesh(this.geometries[type], mat, count);
            inst.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            inst.mesh.userData = { isTrackInstancedMesh: true, type: type };
            
            // Dummy setup to ensure bounding sphere allows raycasting initially
            const dummy = new THREE.Object3D();
            for(let i=0; i<count; i++) {
                dummy.position.set(inst.tracks[i].baseX, inst.tracks[i].baseY, 0.2);
                dummy.updateMatrix();
                inst.mesh.setMatrixAt(i, dummy.matrix);
            }
            this.overlayGroup.add(inst.mesh);
        });

        const centroidGeo = new THREE.RingGeometry(0.8, 1.0, 32);
        const centroidMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.9, side: THREE.DoubleSide, vertexColors: true });
        this.centroidMesh = new THREE.InstancedMesh(centroidGeo, centroidMat, 50); // max 50 centroids
        this.centroidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.centroidMesh.count = 0;
        this.centroidMesh.userData = { isTrackInstancedMesh: true, type: 'centroid' };
        this.overlayGroup.add(this.centroidMesh);

        const emconFS = `
            varying vec2 vUv;
            varying float vConfidence;
            varying float vFocusWeight;
            uniform float uTime;
            void main() {
                float d = distance(vUv, vec2(0.5));
                if (d > 0.5) discard;
                float pulse = (sin(uTime * 3.0 - d * 15.0) + 1.0) * 0.5;
                // Threat Confidence dictates GLSL alpha decay rate 
                float baseAlpha = (1.0 - (d * 2.0)) * (0.3 + 0.4 * pulse);
                float decayRate = pow(clamp(vConfidence, 0.0, 1.0), 1.5);
                float alpha = min(baseAlpha * decayRate * clamp(vFocusWeight, 0.0, 1.0), 0.6);
                vec3 color = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.2, 0.2), 1.0 - (d * 2.0));
                gl_FragColor = vec4(color, alpha);
            }
        `;
        const emconVS = `
            varying vec2 vUv;
            varying float vConfidence;
            varying float vFocusWeight;
            attribute float aConfidence;
            attribute float aFocusWeight;
            void main() {
                vUv = uv;
                vConfidence = aConfidence;
                vFocusWeight = aFocusWeight;
                vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
            }
        `;
        this.emconMaterial = new THREE.ShaderMaterial({
            fragmentShader: emconFS,
            vertexShader: emconVS,
            uniforms: { uTime: { value: 0 } },
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        const emconGeo = new THREE.PlaneGeometry(2, 2);
        this.emconConfidenceAttr = new THREE.InstancedBufferAttribute(new Float32Array(2000), 1);
        this.emconFocusAttr = new THREE.InstancedBufferAttribute(new Float32Array(2000), 1);
        emconGeo.setAttribute('aConfidence', this.emconConfidenceAttr);
        emconGeo.setAttribute('aFocusWeight', this.emconFocusAttr);
        this.emconMesh = new THREE.InstancedMesh(emconGeo, this.emconMaterial, 2000);
        this.emconMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.emconMesh.count = 0;
        this.emconMesh.userData = { isTrackInstancedMesh: true, type: 'emcon' };
        this.overlayGroup.add(this.emconMesh);

        const uuvGeo = new THREE.ShapeGeometry((() => { 
            const s = new THREE.Shape(); 
            s.moveTo(-0.6, 0.2); 
            s.lineTo(0.6, 0.2); 
            s.lineTo(0.8, 0); 
            s.lineTo(0.6, -0.2); 
            s.lineTo(-0.6, -0.2); 
            s.lineTo(-0.8, 0); 
            s.closePath(); 
            s.moveTo(-0.2, 0.2);
            s.lineTo(-0.2, 0.5);
            s.lineTo(0.1, 0.5);
            s.lineTo(0.1, 0.2);
            return s; 
        })());
        const uuvMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9, vertexColors: true });
        this.uuvMesh = new THREE.InstancedMesh(uuvGeo, uuvMat, 500);
        this.uuvMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.uuvMesh.count = 0;
        this.uuvMesh.userData = { isTrackInstancedMesh: true, type: 'uuv' };
        this.overlayGroup.add(this.uuvMesh);

        this.init3DGSReconSystem();
        this.setupSelectionVisuals();
    }

    init3DGSReconSystem() {
        if (this.reconSplatGroup) return;

        this.reconSplatGroup = new THREE.Group();
        this.reconSplatGroup.visible = false;
        
        // Bounding Box
        const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
        const boxMat = new THREE.LineBasicMaterial({ color: 0x00FFFF, transparent: true, opacity: 0.8 });
        this.reconBoundingBox = new THREE.LineSegments(boxGeo, boxMat);
        this.reconSplatGroup.add(this.reconBoundingBox);

        // Splat Points
        const maxPoints = 10000;
        const ptsGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(maxPoints * 3);
        ptsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        ptsGeo.setDrawRange(0, 0);

        const pointFS = `
            varying float vY;
            uniform float uTime;
            void main() {
                // LiDAR Scanline Effect
                float scan = (sin(uTime * 4.0 - vY * 10.0) + 1.0) * 0.5;
                float alpha = 0.2 + (scan * 0.8);
                vec3 baseColor = mix(vec3(0.0, 0.5, 0.8), vec3(0.0, 1.0, 1.0), scan);
                gl_FragColor = vec4(baseColor, alpha);
            }
        `;
        const pointVS = `
            varying float vY;
            void main() {
                vY = position.y;
                vec4 mvPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_PointSize = 2.0;
            }
        `;

        this.reconSplatMat = new THREE.ShaderMaterial({
            fragmentShader: pointFS,
            vertexShader: pointVS,
            transparent: true,
            depthWrite: false,
            uniforms: { uTime: { value: 0 } },
            blending: THREE.AdditiveBlending
        });

        this.reconPoints = new THREE.Points(ptsGeo, this.reconSplatMat);
        this.reconSplatGroup.add(this.reconPoints);
        
        // Attach to overlay group to scale correctly relative to UI plane
        this.overlayGroup.add(this.reconSplatGroup);
        this.initCounterfactualScanOverlay();
    }

    generateReconSplat(x, y, radius) {
        this.reconSplatGroup.position.set(x, y, 0); 
        
        // Scale Box
        const boundingSize = Math.max(radius * 1.5, 3.0);
        this.reconBoundingBox.scale.set(boundingSize, boundingSize, boundingSize);
        
        const count = Math.floor(5000 + Math.random() * 5000); // 5k-10k
        const posAttr = this.reconPoints.geometry.attributes.position;
        const positions = posAttr.array;
        
        for (let i = 0; i < count; i++) {
            // Distribute points spherically or cylindrically inside the box region
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const r = Math.pow(Math.random(), 1/3) * (boundingSize / 2);
            
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);     // X
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta); // Y
            positions[i * 3 + 2] = r * Math.cos(phi);                   // Z
        }
        
        // Normalize Y for shader scanline distribution
        const maxR = boundingSize / 2;
        for (let i = 0; i < count; i++) {
            positions[i * 3 + 1] /= maxR; // Range ~[-1, 1]
        }
        
        posAttr.needsUpdate = true;
        this.reconPoints.geometry.setDrawRange(0, count);
        this.reconSplatGroup.visible = true;
    }

    hideReconSplat() {
        this.reconSplatGroup.visible = false;
        this.reconPoints.geometry.setDrawRange(0, 0);
    }

    initCounterfactualScanOverlay() {
        if (this.counterfactualScanGroup) return;

        this.counterfactualScanGroup = new THREE.Group();
        this.counterfactualScanGroup.visible = false;

        const outerGeo = new THREE.RingGeometry(0.9, 1.0, 72);
        const outerMat = new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 0.45,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.counterfactualOuterRing = new THREE.Mesh(outerGeo, outerMat);
        this.counterfactualOuterRing.position.z = 0.03;
        this.counterfactualScanGroup.add(this.counterfactualOuterRing);

        const innerGeo = new THREE.RingGeometry(0.5, 0.58, 64);
        const innerMat = new THREE.MeshBasicMaterial({
            color: 0xffc266,
            transparent: true,
            opacity: 0.28,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this.counterfactualInnerRing = new THREE.Mesh(innerGeo, innerMat);
        this.counterfactualInnerRing.position.z = 0.032;
        this.counterfactualScanGroup.add(this.counterfactualInnerRing);

        this.overlayGroup.add(this.counterfactualScanGroup);
    }

    showCounterfactualScanZone(x, y, radius = 12) {
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        this.counterfactualScanState = {
            active: true,
            x,
            y,
            radius: THREE.MathUtils.clamp(Number(radius) || 12, 6, 20)
        };
        if (this.counterfactualScanGroup) this.counterfactualScanGroup.visible = true;
        return true;
    }

    hideCounterfactualScanZone() {
        this.counterfactualScanState.active = false;
        if (this.counterfactualScanGroup) this.counterfactualScanGroup.visible = false;
    }

    executeWideAreaReconMacro(x, y, radius = 12) {
        const ok = this.showCounterfactualScanZone(x, y, radius);
        if (!ok) return false;
        this.generateReconSplat(x, y, this.counterfactualScanState.radius);
        return true;
    }

    updateCounterfactualScanOverlay(t, skinVal) {
        if (!this.counterfactualScanGroup || !this.counterfactualScanState.active) {
            if (this.counterfactualScanGroup) this.counterfactualScanGroup.visible = false;
            return;
        }

        const state = this.counterfactualScanState;
        const pulse = (Math.sin(t * 2.6) + 1) * 0.5;
        const expand = 1.0 + pulse * 0.35;
        this.counterfactualScanGroup.visible = true;
        this.counterfactualScanGroup.position.set(state.x, state.y, 0.03);
        this.counterfactualOuterRing.scale.setScalar(state.radius * expand);
        this.counterfactualInnerRing.scale.setScalar(state.radius * (0.58 + pulse * 0.12));
        this.counterfactualOuterRing.material.opacity = (0.26 + pulse * 0.22) * (1 - skinVal);
        this.counterfactualInnerRing.material.opacity = (0.15 + (1 - pulse) * 0.15) * (1 - skinVal);
    }

    setupSelectionVisuals() {
        if (this.selectionGroup) return; // Already exists

        this.selectionGroup = new THREE.Group();
        this.selectionGroup.visible = false;
        this.overlayGroup.add(this.selectionGroup);

        const lockGeo = new THREE.RingGeometry(0.85, 1.05, 32);
        const lockMat = new THREE.MeshBasicMaterial({ color: 0x00ddff, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false });
        this.lockRing = new THREE.Mesh(lockGeo, lockMat);
        this.lockRing.position.z = 0.01;
        this.selectionGroup.add(this.lockRing);

        const bracketGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.8, 1.8));
        this.bracketLine = new THREE.LineSegments(bracketGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 }));
        this.selectionGroup.add(this.bracketLine);

        const destMarkerGeo = new THREE.CircleGeometry(0.24, 20);
        const destMarkerMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
        this.destMarker = new THREE.Mesh(destMarkerGeo, destMarkerMat);
        this.destMarker.visible = false;
        this.overlayGroup.add(this.destMarker);

        const destLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const destLineMat = new THREE.LineBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.35 });
        this.destLine = new THREE.Line(destLineGeo, destLineMat);
        this.destLine.visible = false;
        this.overlayGroup.add(this.destLine);

        this.initUpfAttentionOverlay();
    }

    initUpfAttentionOverlay() {
        if (this.upfAttentionGroup) return;
        this.upfAttentionGroup = new THREE.Group();
        this.upfAttentionGroup.visible = false;

        const hexPts = [];
        const hexRadius = 1.35;
        for (let i = 0; i < 6; i++) {
            const a0 = (Math.PI / 3) * i;
            const a1 = (Math.PI / 3) * ((i + 1) % 6);
            hexPts.push(new THREE.Vector3(Math.cos(a0) * hexRadius, Math.sin(a0) * hexRadius, 0.05));
            hexPts.push(new THREE.Vector3(Math.cos(a1) * hexRadius, Math.sin(a1) * hexRadius, 0.05));
        }
        const hexGeo = new THREE.BufferGeometry().setFromPoints(hexPts);
        const hexMat = new THREE.LineBasicMaterial({
            color: 0xffcc33,
            transparent: true,
            opacity: 0.0
        });
        this.upfPrimaryBracket = new THREE.LineSegments(hexGeo, hexMat);
        this.upfAttentionGroup.add(this.upfPrimaryBracket);

        const guideGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const guideMat = new THREE.LineBasicMaterial({
            color: 0xffc266,
            transparent: true,
            opacity: 0.0
        });
        this.upfGuideLine = new THREE.Line(guideGeo, guideMat);
        this.upfGuideLine.visible = false;
        this.overlayGroup.add(this.upfGuideLine);

        this.overlayGroup.add(this.upfAttentionGroup);
    }

    updateUpfAttentionOverlay(t, skinVal) {
        if (!this.upfAttentionGroup || !this.upfGuideLine) return;

        const focus = this.upfFocusState;
        if (!focus.active || !focus.primaryId || !this.upfPrimaryWorldPos) {
            this.upfAttentionGroup.visible = false;
            this.upfGuideLine.visible = false;
            return;
        }

        const pulse = (Math.sin(t * 9.0) + 1.0) * 0.5;
        this.upfAttentionGroup.visible = true;
        this.upfAttentionGroup.position.set(this.upfPrimaryWorldPos.x, this.upfPrimaryWorldPos.y, 0.09);
        this.upfAttentionGroup.scale.setScalar(1.0 + (pulse * 0.22));
        this.upfPrimaryBracket.material.opacity = (0.35 + (pulse * 0.55)) * (1 - skinVal);

        this.upfGuideLine.visible = true;
        this.upfGuideLine.geometry.setFromPoints([
            new THREE.Vector3(focus.cursorX, focus.cursorY, 0.07),
            new THREE.Vector3(this.upfPrimaryWorldPos.x, this.upfPrimaryWorldPos.y, 0.07)
        ]);
        this.upfGuideLine.material.opacity = (0.25 + (pulse * 0.45)) * (1 - skinVal);
    }

    resetScenario(profile) {
        if (profile === 'clear') {
            trackData.length = 0;
        } else {
            loadScenario(profile);
        }
        
        Object.keys(this.instances).forEach(type => {
            const inst = this.instances[type];
            if(inst.mesh) {
                this.overlayGroup.remove(inst.mesh);
                inst.mesh.geometry.dispose();
                inst.mesh.material.dispose();
                inst.mesh = null;
            }
            inst.tracks = [];
        });

        if (this.centroidMesh) {
            this.overlayGroup.remove(this.centroidMesh);
            this.centroidMesh.geometry.dispose();
            this.centroidMesh.material.dispose();
            this.centroidMesh = null;
        }

        if (this.emconMesh) {
            this.overlayGroup.remove(this.emconMesh);
            this.emconMesh.geometry.dispose();
            this.emconMesh.material.dispose();
            this.emconMesh = null;
            if (this.emconMaterial) {
                this.emconMaterial.dispose();
                this.emconMaterial = null;
            }
        }
        
        if (this.uuvMesh) {
            this.overlayGroup.remove(this.uuvMesh);
            this.uuvMesh.geometry.dispose();
            this.uuvMesh.material.dispose();
            this.uuvMesh = null;
        }
        
        if (this.reconSplatGroup) {
            this.hideReconSplat();
        }
        if (this.counterfactualScanGroup) {
            this.hideCounterfactualScanZone();
        }
        this.clearSpatialConeFocus();
        this.upfPrimaryWorldPos = null;
        if (this.upfAttentionGroup) this.upfAttentionGroup.visible = false;
        if (this.upfGuideLine) this.upfGuideLine.visible = false;
        
        if (this.opforWorker) {
            this.opforWorker.postMessage({ type: 'RESET_STATE' });
        }

        this.latestRenderingBuffer = null;
        this.latestEmconMetadata = [];
        this.latestGhostMetadata = [];
        this.emconMetaByNumericId = new Map();
        this.ghostMetaByNumericId = new Map();
        this.liveTrackStateById = new Map();
        this.numericTrackIdMap = new Map();
        this.trackLossLogs = new Set();
        this.emconLogs = new Set();
        
        this.initTracks();

        if (profile === 'swarm' && window.opsLogInstance) {
            window.opsLogInstance.addEntry('SYSTEM', 'KINEMATICS', 'SWARM EXHIBITING STARFLAG TOPOLOGICAL COHESION (K=7) & FUZZY LOGIC SENSORY NOISE', 0);
        }
    }

    getTrackData() {
        return this.trackData.filter(t => !t.isHiddenByCentroid);
    }

    getTrackById(id) {
        const track = this.trackData.find(t => t.id === id);
        if (track) return track;

        const liveState = this.liveTrackStateById.get(id);
        if (!liveState) return null;

        const subtype = String(id).startsWith('GHOST-')
            ? 'SIGINT GHOST'
            : (String(id).startsWith('CENTROID-') ? 'SWARM CENTROID' : 'EMCON TRACK');

        return {
            id,
            type: 'unknown',
            subtype,
            x: liveState.x,
            y: liveState.y,
            spd: Math.round((liveState.speed || 0) * 10) / 10,
            threat_level: liveState.confidence >= 0.7 ? 'HIGH' : (liveState.confidence >= 0.4 ? 'MEDIUM' : 'LOW'),
            time_to_event_seconds: 0,
            isSynthetic: true
        };
    }

    getSwarmTelemetry() {
        return this.swarmTelemetry;
    }

    setReplayMode(active) {
        this.replayMode = Boolean(active);
    }

    getDesignationQueueSnapshot() {
        const queue = [];
        const pendingDesignation = store.get('pendingDesignation');
        const undoDesignation = store.get('undoDesignation');
        if (pendingDesignation) queue.push({ type: 'pending', ...pendingDesignation });
        if (undoDesignation) queue.push({ type: 'undo', ...undoDesignation });
        return queue;
    }

    getReplayTrackState() {
        const trackState = [];
        const seen = new Set();

        this.trackData.forEach((track) => {
            const live = this.liveTrackStateById.get(track.id);
            const confidence = live?.confidence ?? this.getTrackConfidenceScore(track.id);
            const velocity = live ? { vx: 0, vy: live.speed || 0, vz: 0 } : { vx: 0, vy: track.spd || 0, vz: 0 };
            trackState.push({
                id: track.id,
                x: live?.x ?? track.x,
                y: live?.y ?? track.y,
                z: live?.z ?? 0,
                vx: velocity.vx,
                vy: velocity.vy,
                vz: velocity.vz,
                confidence,
                domain: track.type,
                emconState: Boolean(live && (live.entityType === 2 || live.entityType === 4)),
                isSigint: false,
                rfProfile: null,
                entityType: live?.entityType ?? 0,
                radius: live?.radius ?? 0,
                count: 1,
                subtype: track.subtype
            });
            seen.add(track.id);
        });

        this.liveTrackStateById.forEach((live, id) => {
            if (seen.has(id)) return;
            const ghost = this.latestGhostMetadata.find(item => item.id === id);
            const emcon = this.latestEmconMetadata.find(item => item.id === id || item.realId === id);
            trackState.push({
                id,
                x: live.x,
                y: live.y,
                z: live.z || 0,
                vx: 0,
                vy: live.speed || 0,
                vz: 0,
                confidence: live.confidence,
                domain: String(id).startsWith('CENTROID-') ? 'centroid' : 'synthetic',
                emconState: Boolean(emcon || live.entityType === 2 || live.entityType === 4),
                isSigint: Boolean(ghost || String(id).startsWith('GHOST-')),
                rfProfile: ghost?.rfProfile || null,
                entityType: live.entityType,
                radius: live.radius || emcon?.radius || 0,
                count: String(id).startsWith('CENTROID-') ? Math.max(1, Math.round((live.radius || 1) * 2)) : 1,
                subtype: String(id).startsWith('GHOST-') ? 'SIGINT GHOST' : 'EMCON TRACK'
            });
        });

        return trackState;
    }

    restoreSnapshot(snapshot) {
        if (!snapshot) return;
        this.setReplayMode(true);
        this.swarmTelemetry = {
            ...this.swarmTelemetry,
            ...snapshot.orderParams,
            com: this.swarmTelemetry.com
        };
        this.upfFocusState = {
            ...this.upfFocusState,
            primaryId: snapshot.ufpState?.primaryId || null,
            candidateIds: new Set(snapshot.ufpState?.candidates || [])
        };

        const renderRows = [];
        const liveMap = new Map();
        snapshot.trackState.forEach((entry) => {
            liveMap.set(entry.id, {
                x: entry.x,
                y: entry.y,
                z: entry.z,
                speed: Math.sqrt((entry.vx || 0) ** 2 + (entry.vy || 0) ** 2),
                radius: entry.radius || 0,
                confidence: entry.confidence,
                entityType: entry.entityType || 0
            });

            const track = this.trackData.find(item => item.id === entry.id);
            if (track) {
                track.x = entry.x;
                track.y = entry.y;
                track.spd = Math.round(Math.sqrt((entry.vx || 0) ** 2 + (entry.vy || 0) ** 2));
                const inst = this.instances[track.type];
                const tr = inst?.tracks?.find(item => item.t.id === entry.id);
                if (tr) {
                    tr.pos.set(entry.x, entry.y);
                    if (tr.vel) tr.vel.set(entry.vx || 0, entry.vy || 0);
                }
                return;
            }

            if (entry.entityType) {
                renderRows.push(
                    Number.parseInt(String(entry.id).replace(/\D/g, ''), 10) || 0,
                    entry.entityType,
                    entry.x,
                    entry.y,
                    entry.z || 0,
                    Math.atan2(entry.vy || 0, entry.vx || 1),
                    Math.sqrt((entry.vx || 0) ** 2 + (entry.vy || 0) ** 2),
                    entry.radius || 0,
                    entry.count || 1,
                    entry.confidence || 0
                );
            }
        });

        this.liveTrackStateById = liveMap;
        this.latestRenderingBuffer = new Float32Array(renderRows);
    }

    getTrackMeshes() {
        const meshes = Object.values(this.instances).map(inst => inst.mesh).filter(m => m !== null);
        if (this.centroidMesh) meshes.push(this.centroidMesh);
        if (this.emconMesh) meshes.push(this.emconMesh);
        if (this.uuvMesh) meshes.push(this.uuvMesh);
        return meshes;
    }

    getTrackIdFromHit(hit) {
        const type = hit.object.userData.type;
        if (type === 'emcon') {
            return this.emconIdMap ? this.emconIdMap[hit.instanceId] : null;
        } else if (type === 'uuv') {
            return this.uuvIdMap ? this.uuvIdMap[hit.instanceId] : null;
        } else if (type === 'centroid') {
            return this.centroidIdMap ? this.centroidIdMap[hit.instanceId] : null;
        } else if (type === 'hostile') {
            return this.hostileIdMap ? this.hostileIdMap[hit.instanceId] : null;
        } else if (this.instances[type]) {
            const tr = this.instances[type].tracks[hit.instanceId];
            return tr ? tr.t.id : null;
        }
        return null;
    }

    getProvenance(id) {
        if (this.provenanceByTrackId[id]) return this.provenanceByTrackId[id];
        const confidenceScore = this.getTrackConfidenceScore(id);
        return {
            source: String(id).startsWith('GHOST-') ? 'ELINT-ESM' : 'EXTRAPOLATED',
            confidence: this.confidenceScoreToLabel(confidenceScore),
            lastUpdate: Date.now()
        };
    }

    confidenceLabelToScore(label) {
        if (label === 'HIGH') return 0.9;
        if (label === 'MEDIUM') return 0.7;
        if (label === 'LOW') return 0.35;
        return 0.0;
    }

    confidenceScoreToLabel(score) {
        if (score >= 0.75) return 'HIGH';
        if (score >= 0.6) return 'MEDIUM';
        return 'LOW';
    }

    getTrackConfidenceScore(id) {
        if (!id) return 0.0;
        const liveState = this.liveTrackStateById.get(id);
        if (liveState && Number.isFinite(liveState.confidence)) {
            return THREE.MathUtils.clamp(liveState.confidence, 0, 1);
        }
        const prov = this.provenanceByTrackId[id];
        if (prov) return this.confidenceLabelToScore(prov.confidence);
        return 0.0;
    }

    clearSpatialConeFocus() {
        const prevCursorX = this.upfFocusState.cursorX || 0;
        const prevCursorY = this.upfFocusState.cursorY || 0;
        this.upfFocusState = {
            active: false,
            coneX: 0,
            coneY: 0,
            radius: this.upfConfig.coneRadius,
            radiusSq: this.upfConfig.coneRadius * this.upfConfig.coneRadius,
            cursorX: prevCursorX,
            cursorY: prevCursorY,
            primaryId: null,
            primaryConfidence: 0,
            candidateIds: new Set(),
            lastUpdatedMs: Date.now()
        };
        this.upfTrackedIds = new Set();
    }

    setSpatialConeFocus(coneX, coneY, cursorX, cursorY, radius = this.upfConfig.coneRadius) {
        if (!Number.isFinite(coneX) || !Number.isFinite(coneY)) {
            this.clearSpatialConeFocus();
            return null;
        }

        const resolvedRadius = Math.max(2.0, Number(radius) || this.upfConfig.coneRadius);
        const radiusSq = resolvedRadius * resolvedRadius;
        const candidates = [];
        const byId = new Map();
        const consider = (id, x, y, confidence, entityType) => {
            if (!id || !Number.isFinite(x) || !Number.isFinite(y)) return;
            const dx = x - coneX;
            const dy = y - coneY;
            const distSq = (dx * dx) + (dy * dy);
            if (distSq > radiusSq) return;
            const nextCandidate = {
                id,
                x,
                y,
                confidence: THREE.MathUtils.clamp(Number(confidence) || 0, 0, 1),
                entityType: Number(entityType) || 0,
                distSq
            };
            const existing = byId.get(id);
            if (!existing || nextCandidate.confidence > existing.confidence || (nextCandidate.confidence === existing.confidence && nextCandidate.distSq < existing.distSq)) {
                byId.set(id, nextCandidate);
            }
        };

        this.liveTrackStateById.forEach((state, id) => {
            consider(id, state.x, state.y, state.confidence, state.entityType);
        });
        this.getTrackData().forEach((track) => {
            consider(track.id, track.x, track.y, this.getTrackConfidenceScore(track.id), 0);
        });
        byId.forEach((value) => candidates.push(value));

        if (candidates.length === 0) {
            this.clearSpatialConeFocus();
            this.upfFocusState.cursorX = Number.isFinite(cursorX) ? cursorX : coneX;
            this.upfFocusState.cursorY = Number.isFinite(cursorY) ? cursorY : coneY;
            this.upfFocusState.coneX = coneX;
            this.upfFocusState.coneY = coneY;
            this.upfFocusState.radius = resolvedRadius;
            this.upfFocusState.radiusSq = radiusSq;
            return null;
        }

        candidates.sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            return a.distSq - b.distSq;
        });

        const primary = candidates[0];
        const previousPrimaryId = this.upfFocusState.primaryId;
        this.upfTrackedIds = new Set(candidates.map(c => c.id));
        this.upfFocusState = {
            active: true,
            coneX,
            coneY,
            radius: resolvedRadius,
            radiusSq,
            cursorX: Number.isFinite(cursorX) ? cursorX : coneX,
            cursorY: Number.isFinite(cursorY) ? cursorY : coneY,
            primaryId: primary.id,
            primaryConfidence: primary.confidence,
            candidateIds: this.upfTrackedIds,
            lastUpdatedMs: Date.now()
        };

        if (primary.id && primary.id !== previousPrimaryId) {
            this.replayCapture?.captureEvent('UPF_PRIMARY_RESOLVED');
        }

        return {
            primaryId: primary.id,
            candidateCount: candidates.length,
            primaryConfidence: primary.confidence
        };
    }

    resolveSpatialConeSelection(clickX, clickY) {
        const focus = this.upfFocusState;
        if (!focus.active || !focus.primaryId) return null;
        if (!Number.isFinite(clickX) || !Number.isFinite(clickY)) return null;
        const dx = clickX - focus.coneX;
        const dy = clickY - focus.coneY;
        const distSq = (dx * dx) + (dy * dy);
        if (distSq > focus.radiusSq) return null;
        return focus.primaryId;
    }

    getUpfTrackRole(trackId) {
        if (!trackId || !this.upfFocusState.active) return 0;
        if (!this.upfFocusState.candidateIds.has(trackId)) return 0;
        return this.upfFocusState.primaryId === trackId ? 1 : 2;
    }

    getUpfAdjustedColor(baseColor, trackId, t) {
        const role = this.getUpfTrackRole(trackId);
        if (role === 0) return baseColor;

        if (role === 1) {
            const pulse = (Math.sin(t * 8.5) + 1.0) * 0.5;
            this._upfColorA.copy(baseColor);
            this._upfColorB.setHex(0xffd34d);
            this._upfColorA.lerp(this._upfColorB, 0.45 + (pulse * 0.35));
            return this._upfColorA;
        }

        this._upfColorA.copy(baseColor).multiplyScalar(this.upfConfig.nonPrimaryOpacity);
        return this._upfColorA;
    }

    getUpfFocusSnapshot() {
        return {
            active: Boolean(this.upfFocusState.active),
            coneX: this.upfFocusState.coneX,
            coneY: this.upfFocusState.coneY,
            radius: this.upfFocusState.radius,
            cursorX: this.upfFocusState.cursorX,
            cursorY: this.upfFocusState.cursorY,
            primaryId: this.upfFocusState.primaryId,
            primaryConfidence: this.upfFocusState.primaryConfidence,
            candidateCount: this.upfFocusState.candidateIds.size,
            candidateIds: Array.from(this.upfFocusState.candidateIds.values()),
            lastUpdatedMs: this.upfFocusState.lastUpdatedMs
        };
    }

    setDestination(id, destObj) {
        this.trackDestinations[id] = destObj;
    }

    getDestination(id) {
        return this.trackDestinations[id];
    }

    clearDestination(id) {
        if(this.trackDestinations[id]) {
            delete this.trackDestinations[id];
            return true;
        }
        return false;
    }

    updateSelectionVisuals(selectedId) {
        // Now handled per-frame in animateTracks
    }

    updateDestinationVisuals(selectedId) {
        // Now handled per-frame in animateTracks
    }

    updateSwarmBoids(dt) {
        const swarms = [];
        Object.values(this.instances).forEach(inst => {
            inst.tracks.forEach(tr => {
                if (tr.isSwarm) swarms.push({ tr, type: inst.mesh.userData.type });
            });
        });

        const grid = new Map();
        const CELL_SIZE = 2.0;
        
        for (let i = 0; i < swarms.length; i++) {
            const tr = swarms[i].tr;
            const key = Math.floor(tr.pos.x / CELL_SIZE) + ',' + Math.floor(tr.pos.y / CELL_SIZE);
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(swarms[i]);
        }

        const SEPARATION_WEIGHT = 1.8;
        const HUNT_WEIGHT = 1.2;
        const MAX_SPEED = 12.0; 
        const MAX_FORCE = 3.0;
        const TOPOLOGICAL_K = 7;
        
        // Aerodynamic constants
        const MASS_KG = 0.08;
        const RHO = 1.225; // Air density
        const CD = 0.05; // Drag coeff
        const CL = 0.15; // Lift coeff
        const MAX_BANKING_RAD = 1.047; // 60 deg

        for (let i = 0; i < swarms.length; i++) {
            const item = swarms[i];
            const tr = item.tr;
            const numId = parseInt(tr.t.id.replace(/\D/g, '')) || 0;
            const isUUV = tr.isUUV;
            
            // Phase Transition: TRANSIT vs EMCON_EVASION
            const isEmconEvasion = this.emconMetaByNumericId.has(numId);
            const ALIGN_WEIGHT = isEmconEvasion ? (isUUV ? 0.0 : 0.2) : (isUUV ? 0.0 : 2.0);
            const COHESION_WEIGHT = isEmconEvasion ? (isUUV ? 0.0 : 4.0) : (isUUV ? 0.0 : 0.2);
            
            const cx = Math.floor(tr.pos.x / CELL_SIZE);
            const cy = Math.floor(tr.pos.y / CELL_SIZE);
            
            let align = new THREE.Vector2();
            let cohesion = new THREE.Vector2();
            let separation = new THREE.Vector2();
            let hunt = new THREE.Vector2();
            
            let huntCount = 0;
            const localNeighbors = [];
            const localSeparations = [];

            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const key = (cx + dx) + ',' + (cy + dy);
                    const cell = grid.get(key);
                    if (cell) {
                        for (let j = 0; j < cell.length; j++) {
                            const otherItem = cell[j];
                            if (otherItem.tr !== tr) {
                                const distSq = tr.pos.distanceToSquared(otherItem.tr.pos);
                                if (distSq > 0.0001) {
                                    if (item.type === otherItem.type) {
                                        // Fuzzy logic noise in distance sorting
                                        const fuzzyNoise = 0.9 + Math.random() * 0.2; 
                                        localNeighbors.push({ tr: otherItem.tr, distSq: distSq * fuzzyNoise });
                                        
                                        if (distSq < CELL_SIZE * 0.4 * CELL_SIZE * 0.4) {
                                            const dist = Math.sqrt(distSq);
                                            const diff = tr.pos.clone().sub(otherItem.tr.pos).normalize().divideScalar(dist);
                                            localSeparations.push(diff);
                                        }
                                    } else if (distSq < CELL_SIZE * CELL_SIZE && 
                                            ((item.type === 'friendly' && otherItem.type === 'hostile') || 
                                             (item.type === 'hostile' && otherItem.type === 'friendly'))) {
                                        hunt.add(otherItem.tr.pos);
                                        huntCount++;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            localNeighbors.sort((a, b) => a.distSq - b.distSq);
            const topK = localNeighbors.slice(0, TOPOLOGICAL_K);
            const neighborCount = topK.length;

            let targetForce = new THREE.Vector2();

            if (neighborCount > 0) {
                for (let k = 0; k < neighborCount; k++) {
                    const n = topK[k].tr;
                    cohesion.add(n.pos);
                    const fuzzyVelNoise = 0.8 + (Math.random() * 0.4); 
                    align.add(n.vel.clone().multiplyScalar(fuzzyVelNoise));
                }
                align.divideScalar(neighborCount);
                if (align.lengthSq() > 0) align.setLength(MAX_SPEED).sub(tr.vel);
                
                cohesion.divideScalar(neighborCount).sub(tr.pos);
                if (cohesion.lengthSq() > 0) cohesion.setLength(MAX_SPEED).sub(tr.vel);
                
                targetForce.add(align.multiplyScalar(ALIGN_WEIGHT));
                targetForce.add(cohesion.multiplyScalar(COHESION_WEIGHT));
            }
            
            if (localSeparations.length > 0) {
                for (let s = 0; s < localSeparations.length; s++) {
                    separation.add(localSeparations[s]);
                }
                separation.divideScalar(localSeparations.length);
                if(separation.lengthSq() > 0) separation.setLength(MAX_SPEED).sub(tr.vel);
                targetForce.add(separation.multiplyScalar(SEPARATION_WEIGHT));
            }
            
            if (huntCount > 0) {
                hunt.divideScalar(huntCount).sub(tr.pos);
                if(hunt.lengthSq() > 0) hunt.setLength(MAX_SPEED).sub(tr.vel);
                targetForce.add(hunt.multiplyScalar(HUNT_WEIGHT));
            }

            // Evasion Jitters in EMCON
            if (isEmconEvasion) {
                const evadeForce = new THREE.Vector2((Math.random() - 0.5) * 40.0, (Math.random() - 0.5) * 40.0);
                targetForce.add(evadeForce);
            }

            const mapLimit = 36.0;
            if (tr.pos.x < -mapLimit) targetForce.x += MAX_FORCE * 5;
            if (tr.pos.x > mapLimit) targetForce.x -= MAX_FORCE * 5;
            if (tr.pos.y < -mapLimit) targetForce.y += MAX_FORCE * 5;
            if (tr.pos.y > mapLimit) targetForce.y -= MAX_FORCE * 5;

            if (tr.desiredOpforVector && (tr.desiredOpforVector.x !== 0 || tr.desiredOpforVector.y !== 0)) {
                const opforForce = tr.desiredOpforVector.clone().setLength(MAX_SPEED).sub(tr.vel);
                targetForce.add(opforForce.multiplyScalar(2.0)); 
            }

            // --- Newtonian Aerodynamic / Hydrodynamic Integrator ---
            const speed = tr.vel.length() || 0.1;
            const speedSq = speed * speed;
            const heading = tr.vel.clone().normalize();
            
            if (isUUV) {
                const uuv = tr.uuvParams;
                const mass = uuv.mass_kg;
                const maxSpeed = uuv.max_speed_kts;
                
                // Hydrodynamics: Water Drag = v^2 * 1023.0
                const dragMag = 0.5 * 1023.0 * speedSq * 0.04;
                const dragForce = heading.clone().multiplyScalar(-dragMag);
                
                // Depth oscillation between 0 and -30
                tr.z = Math.sin(Date.now() / 20000 + tr.offset) * 30.0;
                if (tr.z > 0) tr.z = 0; 
                if (tr.t.threat_level === 'HIGH' && tr.t.time_to_event_seconds < 120) tr.z = -20;
                
                // Ocean Current Drift
                const driftX = Math.sin(tr.pos.y * 0.05 + Date.now()/10000) * 0.5;
                const driftY = Math.cos(tr.pos.x * 0.05 + Date.now()/10000) * 0.5;
                targetForce.add(new THREE.Vector2(driftX, driftY).multiplyScalar(mass * 0.1));
                
                const thrustMag = targetForce.dot(heading);
                const thrustForce = heading.clone().multiplyScalar(Math.max(0.1, thrustMag));
                const perpForce = targetForce.clone().sub(heading.clone().multiplyScalar(thrustMag));
                
                const turnRateLimit = maxSpeed / Math.max(0.1, uuv.turn_radius_m);
                let latAccel = perpForce.length() / mass;
                const maxLatAccel = turnRateLimit * speed;
                if (latAccel > maxLatAccel) {
                    latAccel = maxLatAccel;
                    perpForce.setLength(latAccel * mass);
                }
                
                const totalForce = new THREE.Vector2().add(thrustForce).add(perpForce).add(dragForce);
                const accel = totalForce.divideScalar(mass);
                tr.vel.add(accel.multiplyScalar(dt));
                if (tr.vel.lengthSq() > maxSpeed * maxSpeed) tr.vel.setLength(maxSpeed);
            } else {
                const dragMag = 0.5 * RHO * speedSq * CD;
                const dragForce = heading.clone().multiplyScalar(-dragMag);
                
                const liftMag = 0.5 * RHO * speedSq * CL;
                
                const thrustMag = targetForce.dot(heading);
                const thrustForce = heading.clone().multiplyScalar(Math.max(0.1, thrustMag)); 
                
                const perpForce = targetForce.clone().sub(heading.clone().multiplyScalar(thrustMag));
                let latAccel = perpForce.length() / MASS_KG;
                let beta = Math.atan(latAccel / 9.81);
                
                if (beta > MAX_BANKING_RAD) {
                    beta = MAX_BANKING_RAD;
                    latAccel = Math.tan(beta) * 9.81;
                    perpForce.setLength(latAccel * MASS_KG);
                }
                
                const totalForce = new THREE.Vector2().add(thrustForce).add(perpForce).add(dragForce);
                const accel = totalForce.divideScalar(MASS_KG);
                tr.vel.add(accel.multiplyScalar(dt));
                if (tr.vel.lengthSq() > MAX_SPEED * MAX_SPEED) tr.vel.setLength(MAX_SPEED);
            }
            
            tr.pos.add(tr.vel.clone().multiplyScalar(dt));
        }

        this.updateSwarmTelemetry(swarms);
    }

    updateSwarmTelemetry(swarms) {
        if (swarms.length === 0) {
            this.swarmTelemetry.activeCount = 0;
            return;
        }

        let com = new THREE.Vector2();
        let avgVel = new THREE.Vector2();
        
        // 1. Calculate Center of Mass (CoM) and Average Velocity
        for (let i = 0; i < swarms.length; i++) {
            com.add(swarms[i].tr.pos);
            avgVel.add(swarms[i].tr.vel);
        }
        com.divideScalar(swarms.length);
        avgVel.divideScalar(swarms.length);
        
        this.swarmTelemetry.com.copy(com);
        this.swarmTelemetry.activeCount = swarms.length;

        // 2. Polarization (Alignment magnitude 0-1)
        // If they are all flying the exact same direction, the sum of normalized vectors divided by N will be 1
        let polarizationSum = new THREE.Vector2();
        for (let i = 0; i < swarms.length; i++) {
            if (swarms[i].tr.vel.lengthSq() > 0) {
                polarizationSum.add(swarms[i].tr.vel.clone().normalize());
            }
        }
        this.swarmTelemetry.polarization = polarizationSum.length() / swarms.length;

        // 3. Milling (Angular Momentum around CoM)
        let millingSum = 0;
        let cohesionSum = 0;
        
        for (let i = 0; i < swarms.length; i++) {
            const tr = swarms[i].tr;
            const toCom = tr.pos.clone().sub(com);
            const dist = toCom.length();
            cohesionSum += dist;
            
            if (dist > 0.001 && tr.vel.lengthSq() > 0) {
                // Cross product of unit vector to CoM and normalized velocity
                const rNorm = toCom.normalize();
                const vNorm = tr.vel.clone().normalize();
                // 2D Cross product magnitude: x1*y2 - y1*x2
                const cross = (rNorm.x * vNorm.y) - (rNorm.y * vNorm.x);
                millingSum += Math.abs(cross);
            }
        }
        
        this.swarmTelemetry.milling = millingSum / swarms.length;
        
        // 4. Cohesion (Inverse Dispersion)
        const avgDist = cohesionSum / swarms.length;
        // Normalize Cohesion to a 0-1 scale visually where ~30 unit spread is 0 cohesion, 0 spread is 1
        this.swarmTelemetry.cohesion = Math.max(0, 1.0 - (avgDist / 20.0));
    }

    animateTracks(t, skinVal, effectiveMotion, selectedId) {
        if (this.lastTime === undefined) this.lastTime = t;
        const dt = Math.min(t - this.lastTime, 0.1);
        this.lastTime = t;

        if (this.emconMaterial) {
            this.emconMaterial.uniforms.uTime.value = t;
        }

        if (this.reconSplatMat) {
            this.reconSplatMat.uniforms.uTime.value = t;
        }
        this.updateCounterfactualScanOverlay(t, skinVal);

        if (!this.replayMode && dt > 0 && effectiveMotion > 0) {
            this.updateSwarmBoids(dt * effectiveMotion);
            this.sendStateToWorker();
        }

        const dummy = new THREE.Object3D();
        let selectedTrackData = null;
        let selectedTrackPos = null;
        this.upfPrimaryWorldPos = null;

        Object.keys(this.instances).forEach(type => {
            const inst = this.instances[type];
            if(!inst.mesh) return;
            
            const baseTypeOpacity = type === 'unknown' ? 0.25 : 0.82;
            inst.mesh.material.opacity = baseTypeOpacity * (1 - skinVal);
            
            if (type !== 'hostile') {
                inst.mesh.count = inst.tracks.length;
                const color = new THREE.Color();
                for(let i = 0; i < inst.tracks.length; i++) {
                    const tr = inst.tracks[i];
                    let px, py;
                    
                    if (tr.isSwarm) {
                        px = tr.pos.x;
                        py = tr.pos.y;
                    } else {
                        const drift = tr.t.spd > 0 ? 0.3 : 0.05;
                        px = tr.baseX + Math.sin(t * 0.3 + tr.offset) * drift * 3;
                        py = tr.baseY + Math.cos(t * 0.25 + tr.offset) * drift * 3;
                        tr.pos.set(px, py); // Keep pos updated for potential interactions
                    }
                    
                    let timeAngle;
                    if (tr.isSwarm) {
                        timeAngle = Math.atan2(tr.vel.y, tr.vel.x) + Math.PI / 2;
                    } else {
                        timeAngle = t * 0.8 * Math.max(effectiveMotion, 0.08) + tr.offset;
                    }
                    
                    dummy.position.set(px, py, 0.2);
                    dummy.rotation.set(0, 0, timeAngle);
                    
                    const isSelected = tr.t.id === selectedId;
                    const upfRole = this.getUpfTrackRole(tr.t.id);
                    let sc = isSelected ? 1.15 + Math.sin(t * 3 + tr.offset) * 0.12 : 1 + Math.sin(t * 2 + tr.offset) * 0.15;
                    if (upfRole === 1) sc *= 1.2 + (((Math.sin(t * 9.0) + 1) * 0.5) * 0.18);
                    if (upfRole === 2) sc *= 0.85;
                    dummy.scale.setScalar(sc);
                    
                    if (!this.replayMode && effectiveMotion > 0) {
                        tr.t.time_to_event_seconds = Math.max(0, tr.t.time_to_event_seconds - dt * effectiveMotion);
                    }
                    
                    if (tr.t.threat_level === 'HIGH' && tr.t.time_to_event_seconds < 60) {
                        if (!tr.alerted && window.opsLogInstance) {
                            tr.alerted = true;
                            window.opsLogInstance.addEntry('CRITICAL', tr.t.id, `HIGH THREAT IMMINENT: T-MINUS ${Math.floor(tr.t.time_to_event_seconds)}s`, 2, tr.t.time_to_event_seconds);
                        }
                        const urgentPulse = (Math.sin(t * 15 + tr.offset) + 1) * 0.5;
                        color.setHex(urgentPulse > 0.5 ? 0xffffff : 0xff0000);
                        inst.mesh.setColorAt(i, this.getUpfAdjustedColor(color, tr.t.id, t));
                    } else {
                        inst.mesh.setColorAt(i, this.getUpfAdjustedColor(this.typeColors[type], tr.t.id, t));
                    }
                    
                    dummy.updateMatrix();
                    inst.mesh.setMatrixAt(i, dummy.matrix);

                    if (upfRole === 1) this.upfPrimaryWorldPos = { x: px, y: py };
                    
                    if (isSelected) {
                        selectedTrackData = tr.t;
                        selectedTrackPos = { x: px, y: py };
                        
                        this.selectionGroup.position.set(px, py, 0.2);
                        this.selectionGroup.scale.setScalar(sc);
                        
                        const pulse = (Math.sin(t * 7) + 1) * 0.5;
                        this.lockRing.material.opacity = (0.18 + pulse * 0.35) * (1 - skinVal);
                        this.lockRing.scale.setScalar(1.0 + pulse * 0.28);
                        this.bracketLine.material.opacity = 1.0 * (1 - skinVal);
                        this.bracketLine.material.color = this.typeColors[type];
                    }
                }
                inst.mesh.instanceMatrix.needsUpdate = true;
                if (inst.mesh.instanceColor) inst.mesh.instanceColor.needsUpdate = true;
                if(inst.mesh.geometry.boundingSphere === null) {
                    inst.mesh.geometry.computeBoundingSphere();
                }
            } else {
                for(let i = 0; i < inst.tracks.length; i++) {
                    const tr = inst.tracks[i];
                    if (!tr.isSwarm) {
                        const drift = tr.t.spd > 0 ? 0.3 : 0.05;
                        tr.pos.x = tr.baseX + Math.sin(t * 0.3 + tr.offset) * drift * 3;
                        tr.pos.y = tr.baseY + Math.cos(t * 0.25 + tr.offset) * drift * 3;
                    }
                }
            }
        });

        // Render Spatial Hash Data for Hostiles and Centroids
        if (this.latestRenderingBuffer && this.centroidMesh && this.instances.hostile.mesh && this.emconMesh) {
            let discreteCount = 0;
            let centroidCount = 0;
            let emconCount = 0;
            let uuvCount = 0;
            this.centroidMesh.material.opacity = 0.9 * (1 - skinVal);
            if (this.uuvMesh) this.uuvMesh.material.opacity = 0.9 * (1 - skinVal);
            
            const buffer = this.latestRenderingBuffer;
            const STRIDE = 10;
            const color = new THREE.Color();
            
            this.hostileIdMap = {};
            this.centroidIdMap = {};
            this.emconIdMap = {};
            this.uuvIdMap = {};
            const liveTrackState = new Map();

            for (let i = 0; i < buffer.length; i += STRIDE) {
                const numericId = Math.trunc(buffer[i]);
                const entityType = buffer[i+1];
                const x = buffer[i+2];
                const y = buffer[i+3];
                const yaw = buffer[i+5];
                const speed = buffer[i+6];
                const radius = buffer[i+7];
                const threat = THREE.MathUtils.clamp(buffer[i+9], 0, 1);

                dummy.position.set(x, y, 0.2);
                dummy.rotation.set(0, 0, yaw);
                
                const isCentroid = entityType === 1.0;
                const isEmcon = entityType === 2.0;
                const isUUV_Surfaced = entityType === 3.0;
                const isUUV_Submerged = entityType === 4.0;
                
                let strId = `SW-${numericId}`;
                if (isCentroid) {
                    strId = `CENTROID-${numericId}`;
                } else if (isEmcon || isUUV_Submerged) {
                    const emconData = this.emconMetaByNumericId.get(numericId);
                    if (emconData) strId = emconData.realId || emconData.id || strId;
                } else if (numericId < 0 && this.ghostMetaByNumericId.has(numericId)) {
                    strId = this.ghostMetaByNumericId.get(numericId).id;
                } else if (this.numericTrackIdMap.has(numericId)) {
                    strId = this.numericTrackIdMap.get(numericId);
                }

                liveTrackState.set(strId, { x, y, speed, radius, confidence: threat, entityType });
                
                const isSelected = strId === selectedId;
                const upfRole = this.getUpfTrackRole(strId);
                if (upfRole === 1) this.upfPrimaryWorldPos = { x, y };

                let baseSc = isSelected ? 1.15 + Math.sin(t * 3) * 0.12 : 1 + Math.sin(t * 2) * 0.15;
                if (upfRole === 1) baseSc *= 1.24 + (((Math.sin(t * 9.0) + 1) * 0.5) * 0.16);
                if (upfRole === 2) baseSc *= 0.82;
                
                if (isEmcon || isUUV_Submerged) {
                    this.emconIdMap[emconCount] = strId;
                    if (this.emconConfidenceAttr) this.emconConfidenceAttr.setX(emconCount, threat);
                    if (this.emconFocusAttr) this.emconFocusAttr.setX(emconCount, upfRole === 2 ? this.upfConfig.nonPrimaryOpacity : 1.0);
                    dummy.scale.setScalar(upfRole === 2 ? radius * 0.85 : radius);
                    dummy.updateMatrix();
                    this.emconMesh.setMatrixAt(emconCount, dummy.matrix);
                    
                    if (isSelected) {
                        selectedTrackPos = { x, y };
                        this.selectionGroup.position.set(x, y, 0.2);
                        this.selectionGroup.scale.setScalar(radius * 1.5);
                        
                        this.lockRing.visible = false;
                        this.bracketLine.material.color = new THREE.Color(isUUV_Submerged ? 0x0088ff : 0xff8800);
                        this.bracketLine.material.opacity = 0.5 * (1 - skinVal);
                    }
                    emconCount++;
                } else if (isUUV_Surfaced) {
                    this.uuvIdMap[uuvCount] = strId;
                    dummy.scale.setScalar(baseSc * 1.5);
                    dummy.updateMatrix();
                    if (this.uuvMesh) {
                        this.uuvMesh.setMatrixAt(uuvCount, dummy.matrix);
                        this._upfColorB.setHex(0x00ffff);
                        this.uuvMesh.setColorAt(uuvCount, this.getUpfAdjustedColor(this._upfColorB, strId, t));
                    }
                    
                    if (isSelected) {
                        selectedTrackPos = { x, y };
                        this.selectionGroup.position.set(x, y, 0.2);
                        this.selectionGroup.scale.setScalar(baseSc * 1.5);
                        
                        const pulse = (Math.sin(t * 7) + 1) * 0.5;
                        this.lockRing.material.opacity = (0.18 + pulse * 0.35) * (1 - skinVal);
                        this.lockRing.scale.setScalar(1.0 + pulse * 0.28);
                        this.bracketLine.material.opacity = 1.0 * (1 - skinVal);
                        this.bracketLine.material.color = new THREE.Color(0x00ffff);
                        this.lockRing.visible = true;
                    }
                    uuvCount++;
                } else if (!isCentroid) {
                    this.hostileIdMap[discreteCount] = strId;
                    dummy.scale.setScalar(baseSc);
                    if (threat > 0.8) {
                        const urgentPulse = (Math.sin(t * 15) + 1) * 0.5;
                        color.setHex(urgentPulse > 0.5 ? 0xffffff : 0xff0000);
                        this.instances.hostile.mesh.setColorAt(discreteCount, this.getUpfAdjustedColor(color, strId, t));
                    } else {
                        this.instances.hostile.mesh.setColorAt(discreteCount, this.getUpfAdjustedColor(this.typeColors.hostile, strId, t));
                    }
                    
                    dummy.updateMatrix();
                    this.instances.hostile.mesh.setMatrixAt(discreteCount, dummy.matrix);
                    
                    if (isSelected) {
                        selectedTrackPos = { x, y };
                        this.selectionGroup.position.set(x, y, 0.2);
                        this.selectionGroup.scale.setScalar(baseSc);
                        
                        const pulse = (Math.sin(t * 7) + 1) * 0.5;
                        this.lockRing.material.opacity = (0.18 + pulse * 0.35) * (1 - skinVal);
                        this.lockRing.scale.setScalar(1.0 + pulse * 0.28);
                        this.bracketLine.material.opacity = 1.0 * (1 - skinVal);
                        this.bracketLine.material.color = this.typeColors.hostile;
                        this.lockRing.visible = true;
                    }
                    discreteCount++;
                } else {
                    this.centroidIdMap[centroidCount] = strId;
                    const centroidScale = (radius * 0.8) + (Math.sin(t * 4) * 0.15);
                    dummy.scale.setScalar(upfRole === 2 ? centroidScale * 0.82 : centroidScale);
                    dummy.updateMatrix();
                    this.centroidMesh.setMatrixAt(centroidCount, dummy.matrix);
                    this._upfColorB.setHex(0xff3333);
                    this.centroidMesh.setColorAt(centroidCount, this.getUpfAdjustedColor(this._upfColorB, strId, t));
                    
                    if (isSelected) {
                        selectedTrackPos = { x, y };
                        this.selectionGroup.position.set(x, y, 0.2);
                        this.selectionGroup.scale.setScalar(radius * 1.5);
                        
                        this.lockRing.visible = false;
                        this.bracketLine.material.color = new THREE.Color(0xff3333);
                        this.bracketLine.material.opacity = 1.0 * (1 - skinVal);
                    }
                    centroidCount++;
                }
            }

            this.liveTrackStateById = liveTrackState;

            this.instances.hostile.mesh.count = discreteCount;
            this.instances.hostile.mesh.instanceMatrix.needsUpdate = true;
            if (this.instances.hostile.mesh.instanceColor) this.instances.hostile.mesh.instanceColor.needsUpdate = true;
            if (this.instances.hostile.mesh.geometry.boundingSphere === null) this.instances.hostile.mesh.geometry.computeBoundingSphere();

            this.centroidMesh.count = centroidCount;
            this.centroidMesh.instanceMatrix.needsUpdate = true;
            if (this.centroidMesh.instanceColor) this.centroidMesh.instanceColor.needsUpdate = true;
            if (this.centroidMesh.geometry.boundingSphere === null) this.centroidMesh.geometry.computeBoundingSphere();
            
            this.emconMesh.count = emconCount;
            this.emconMesh.instanceMatrix.needsUpdate = true;
            if (this.emconConfidenceAttr) this.emconConfidenceAttr.needsUpdate = true;
            if (this.emconFocusAttr) this.emconFocusAttr.needsUpdate = true;
            if (this.emconMesh.geometry.boundingSphere === null) this.emconMesh.geometry.computeBoundingSphere();
            
            if (this.uuvMesh) {
                this.uuvMesh.count = uuvCount;
                this.uuvMesh.instanceMatrix.needsUpdate = true;
                if (this.uuvMesh.instanceColor) this.uuvMesh.instanceColor.needsUpdate = true;
                if (this.uuvMesh.geometry.boundingSphere === null) this.uuvMesh.geometry.computeBoundingSphere();
            }
        }

        if (!selectedId || !selectedTrackPos) {
            this.selectionGroup.visible = false;
            this.destMarker.visible = false;
            this.destLine.visible = false;
        } else {
            this.selectionGroup.visible = true;
            this.lockRing.visible = true;
            
            const dest = this.trackDestinations[selectedId];
            if (dest) {
                this.destMarker.position.set(dest.x, dest.y, 0.08);
                this.destMarker.visible = true;
                this.destLine.geometry.setFromPoints([
                    new THREE.Vector3(selectedTrackPos.x, selectedTrackPos.y, 0.06),
                    new THREE.Vector3(dest.x, dest.y, 0.06)
                ]);
                this.destLine.material.opacity = 0.8 * (1 - skinVal);
                this.destLine.visible = true;
            } else {
                this.destMarker.visible = false;
                this.destLine.visible = false;
            }
        }

        this.updateUpfAttentionOverlay(t, skinVal);
    }
}
