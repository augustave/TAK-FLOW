import { trackData, sources, confidences, loadScenario } from '../data/mockData.js';

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
        this.hiddenTrackIds = new Set();
        this.centroidIdMap = {};
        this.hostileIdMap = {};

        // Phase 12 Dynamical System Validation Harness
        this.swarmTelemetry = {
            polarization: 0,
            milling: 0,
            cohesion: 0,
            com: new THREE.Vector2(),
            activeCount: 0
        };

        // Phase 13: OPFOR Web Worker
        this.initOpforWorker();

        this.initTracks();
    }

    initOpforWorker() {
        this.opforWorker = new Worker('src/core/opforWorker.js', { type: 'module' });
        this.workerPending = false;
        
        this.opforWorker.onmessage = (e) => {
            this.workerPending = false;
            if (e.data.intents) {
                this.applyOpforIntents(new Float32Array(e.data.intents));
            }
            if (e.data.render) {
                this.latestRenderingBuffer = new Float32Array(e.data.render);
            }
            if (e.data.ui) {
                this.updateUiSwarms(e.data.ui.centroids || []);
                this.latestEmconMetadata = e.data.ui.emcon || [];
                
                this.latestEmconMetadata.forEach(emconData => {
                    if (emconData.id.startsWith('SW-')) {
                        const rawId = parseInt(emconData.id.substring(3));
                        const tr = this.instances['hostile']?.tracks[rawId];
                        if (tr && tr.t && tr.t.id) emconData.realId = tr.t.id;
                    } else if (emconData.id.startsWith('CENTROID-')) {
                        const rawId = parseInt(emconData.id.substring(9));
                        emconData.realId = 'C-' + rawId;
                    }
                });

                if (this.latestEmconMetadata.length > 0 && window.opsLogInstance) {
                    if (!this.emconLogs) this.emconLogs = new Set();
                    this.latestEmconMetadata.forEach(emconData => {
                        if (!this.emconLogs.has(emconData.id)) {
                            this.emconLogs.add(emconData.id);
                            const displayId = emconData.realId ? (typeof emconData.realId === 'number' ? 'TK-' + emconData.realId : emconData.realId) : emconData.id;
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

    sendStateToWorker() {
        if (this.workerPending) return;
        const swarms = [];
        Object.values(this.instances).forEach(inst => {
            inst.tracks.forEach(tr => {
                if (tr.isSwarm) swarms.push({ tr, type: inst.mesh.userData.type });
            });
        });

        if (swarms.length === 0) return;

        const buffer = new Float32Array(swarms.length * 7);
        let idx = 0;

        for (let i = 0; i < swarms.length; i++) {
            const item = swarms[i];
            const tr = item.tr;
            
            const numId = parseInt(tr.t.id.replace(/\D/g, '')) || 0;
            buffer[idx++] = numId;
            buffer[idx++] = item.type === 'hostile' ? 1.0 : (item.type === 'friendly' ? 0.0 : 2.0);
            buffer[idx++] = tr.pos.x;
            buffer[idx++] = tr.pos.y;
            buffer[idx++] = tr.vel ? tr.vel.x : 0.0;
            buffer[idx++] = tr.vel ? tr.vel.y : 0.0;
            buffer[idx++] = tr.t.threat_level === 'HIGH' ? 1.0 : (tr.t.threat_level === 'MEDIUM' ? 0.5 : 0.0);
        }

        this.workerPending = true;
        this.opforWorker.postMessage(buffer.buffer, [buffer.buffer]);
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
                const isSwarm = t.subtype === 'UAS SWARM';
                const angle = Math.random() * Math.PI * 2;
                this.instances[t.type].tracks.push({
                    t: t,
                    baseX: t.x, baseY: t.y, offset: Math.random() * Math.PI * 2,
                    isSwarm: isSwarm,
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
        const centroidMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
        this.centroidMesh = new THREE.InstancedMesh(centroidGeo, centroidMat, 50); // max 50 centroids
        this.centroidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.centroidMesh.count = 0;
        this.centroidMesh.userData = { isTrackInstancedMesh: true, type: 'centroid' };
        this.overlayGroup.add(this.centroidMesh);

        const emconFS = `
            varying vec2 vUv;
            uniform float uTime;
            void main() {
                float d = distance(vUv, vec2(0.5));
                if (d > 0.5) discard;
                float pulse = (sin(uTime * 3.0 - d * 15.0) + 1.0) * 0.5;
                float alpha = (1.0 - (d * 2.0)) * (0.3 + 0.4 * pulse);
                vec3 color = mix(vec3(1.0, 0.5, 0.0), vec3(1.0, 0.2, 0.2), 1.0 - (d * 2.0));
                gl_FragColor = vec4(color, alpha);
            }
        `;
        const emconVS = `
            varying vec2 vUv;
            void main() {
                vUv = uv;
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
        this.emconMesh = new THREE.InstancedMesh(emconGeo, this.emconMaterial, 2000);
        this.emconMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.emconMesh.count = 0;
        this.emconMesh.userData = { isTrackInstancedMesh: true, type: 'emcon' };
        this.overlayGroup.add(this.emconMesh);

        this.setupSelectionVisuals();
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
        
        if (window.store) {
            window.store.set('selectedTrackId', null);
            window.store.set('reconMode', false);
        }
        
        this.initTracks();

        if (profile === 'swarm' && window.opsLogInstance) {
            window.opsLogInstance.addEntry('SYSTEM', 'KINEMATICS', 'SWARM EXHIBITING STARFLAG TOPOLOGICAL COHESION (K=7) & FUZZY LOGIC SENSORY NOISE', 0);
        }
    }

    getTrackData() {
        return this.trackData.filter(t => !t.isHiddenByCentroid);
    }

    getSwarmTelemetry() {
        return this.swarmTelemetry;
    }

    getTrackMeshes() {
        const meshes = Object.values(this.instances).map(inst => inst.mesh).filter(m => m !== null);
        if (this.centroidMesh) meshes.push(this.centroidMesh);
        if (this.emconMesh) meshes.push(this.emconMesh);
        return meshes;
    }

    getTrackIdFromHit(hit) {
        const type = hit.object.userData.type;
        if (type === 'emcon') {
            return this.emconIdMap ? this.emconIdMap[hit.instanceId] : null;
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
        return this.provenanceByTrackId[id];
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

        // Optimization: Spatial Hash Grid
        const grid = new Map();
        const CELL_SIZE = 2.0;
        
        for (let i = 0; i < swarms.length; i++) {
            const tr = swarms[i].tr;
            const key = Math.floor(tr.pos.x / CELL_SIZE) + ',' + Math.floor(tr.pos.y / CELL_SIZE);
            if (!grid.has(key)) grid.set(key, []);
            grid.get(key).push(swarms[i]);
        }

        const ALIGN_WEIGHT = 0.8;
        const COHESION_WEIGHT = 0.5;
        const SEPARATION_WEIGHT = 1.8;
        const HUNT_WEIGHT = 1.2;
        const MAX_SPEED = 5.0; 
        const MAX_FORCE = 3.0;
        
        // STARFLAG: Topological Fixed K Nearest Neighbors
        const TOPOLOGICAL_K = 7;

        for (let i = 0; i < swarms.length; i++) {
            const item = swarms[i];
            const tr = item.tr;
            
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
                                if (distSq > 0.0001) { // not self
                                    if (item.type === otherItem.type) {
                                        // Collect all friendly neighbors for sorting
                                        localNeighbors.push({ tr: otherItem.tr, distSq });
                                        
                                        // Separation strictly requires metric bounding (collision avoidance)
                                        if (distSq < CELL_SIZE * 0.4 * CELL_SIZE * 0.4) {
                                            const dist = Math.sqrt(distSq);
                                            const diff = tr.pos.clone().sub(otherItem.tr.pos).normalize().divideScalar(dist);
                                            localSeparations.push(diff);
                                        }
                                    } 
                                    else if (distSq < CELL_SIZE * CELL_SIZE && 
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

            // STARFLAG: Sort found neighbors by distance and slice top K
            localNeighbors.sort((a, b) => a.distSq - b.distSq);
            const topK = localNeighbors.slice(0, TOPOLOGICAL_K);
            const neighborCount = topK.length;

            let steer = new THREE.Vector2();

            if (neighborCount > 0) {
                for (let k = 0; k < neighborCount; k++) {
                    const n = topK[k].tr;
                    cohesion.add(n.pos);
                    
                    // Fuzzy Logic (Bajec): Add sensory noise to the velocity perception
                    const fuzzyNoise = 0.8 + (Math.random() * 0.4); // 0.8x to 1.2x variance
                    const fuzzyVel = n.vel.clone().multiplyScalar(fuzzyNoise);
                    align.add(fuzzyVel);
                }

                align.divideScalar(neighborCount);
                if (align.lengthSq() > 0) align.setLength(MAX_SPEED).sub(tr.vel);
                
                cohesion.divideScalar(neighborCount).sub(tr.pos);
                if (cohesion.lengthSq() > 0) cohesion.setLength(MAX_SPEED).sub(tr.vel);
                
                steer.add(align.multiplyScalar(ALIGN_WEIGHT));
                steer.add(cohesion.multiplyScalar(COHESION_WEIGHT));
            }
            
            // Separation resolves over metric boundaries to prevent overlap
            if (localSeparations.length > 0) {
                for (let s = 0; s < localSeparations.length; s++) {
                    separation.add(localSeparations[s]);
                }
                separation.divideScalar(localSeparations.length);
                if(separation.lengthSq() > 0) separation.setLength(MAX_SPEED).sub(tr.vel);
                steer.add(separation.multiplyScalar(SEPARATION_WEIGHT));
            }
            
            if (huntCount > 0) {
                hunt.divideScalar(huntCount).sub(tr.pos);
                if(hunt.lengthSq() > 0) hunt.setLength(MAX_SPEED).sub(tr.vel);
                steer.add(hunt.multiplyScalar(HUNT_WEIGHT));
            }

            // Boundary avoidance
            const mapLimit = 36.0;
            if (tr.pos.x < -mapLimit) steer.x += MAX_FORCE;
            if (tr.pos.x > mapLimit) steer.x -= MAX_FORCE;
            if (tr.pos.y < -mapLimit) steer.y += MAX_FORCE;
            if (tr.pos.y > mapLimit) steer.y -= MAX_FORCE;

            // Phase 13: OPFOR Web Worker Intelligence Override
            // Blend the background BT intent into the physical steering
            if (tr.desiredOpforVector && (tr.desiredOpforVector.x !== 0 || tr.desiredOpforVector.y !== 0)) {
                const opforForce = tr.desiredOpforVector.clone().setLength(MAX_SPEED).sub(tr.vel);
                // Give the OPFOR intelligence a high weight to override basic flocking when necessary
                steer.add(opforForce.multiplyScalar(2.0)); 
            }

            if (steer.lengthSq() > MAX_FORCE * MAX_FORCE) steer.setLength(MAX_FORCE);
            
            tr.vel.add(steer.multiplyScalar(dt));
            if (tr.vel.lengthSq() > MAX_SPEED * MAX_SPEED) tr.vel.setLength(MAX_SPEED);
            
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

        if (dt > 0 && effectiveMotion > 0) {
            this.updateSwarmBoids(dt * effectiveMotion);
            this.sendStateToWorker();
        }

        const dummy = new THREE.Object3D();
        let selectedTrackData = null;
        let selectedTrackPos = null;

        Object.keys(this.instances).forEach(type => {
            const inst = this.instances[type];
            if(!inst.mesh) return;
            
            inst.mesh.material.opacity = 0.82 * (1 - skinVal);
            
            if (type !== 'hostile') {
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
                    const sc = isSelected ? 1.15 + Math.sin(t * 3 + tr.offset) * 0.12 : 1 + Math.sin(t * 2 + tr.offset) * 0.15;
                    dummy.scale.setScalar(sc);
                    
                    if (effectiveMotion > 0) {
                        tr.t.time_to_event_seconds = Math.max(0, tr.t.time_to_event_seconds - dt * effectiveMotion);
                    }
                    
                    if (tr.t.threat_level === 'HIGH' && tr.t.time_to_event_seconds < 60) {
                        if (!tr.alerted && window.opsLogInstance) {
                            tr.alerted = true;
                            window.opsLogInstance.addEntry('CRITICAL', tr.t.id, `HIGH THREAT IMMINENT: T-MINUS ${Math.floor(tr.t.time_to_event_seconds)}s`, 2, tr.t.time_to_event_seconds);
                        }
                        const urgentPulse = (Math.sin(t * 15 + tr.offset) + 1) * 0.5;
                        color.setHex(urgentPulse > 0.5 ? 0xffffff : 0xff0000);
                        inst.mesh.setColorAt(i, color);
                    } else {
                        inst.mesh.setColorAt(i, this.typeColors[type]);
                    }
                    
                    dummy.updateMatrix();
                    inst.mesh.setMatrixAt(i, dummy.matrix);
                    
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
            this.centroidMesh.material.opacity = 0.9 * (1 - skinVal);
            
            const buffer = this.latestRenderingBuffer;
            const STRIDE = 10;
            const color = new THREE.Color();
            
            this.hostileIdMap = {};
            this.centroidIdMap = {};
            this.emconIdMap = {};

            for (let i = 0; i < buffer.length; i += STRIDE) {
                const id = buffer[i];
                const entityType = buffer[i+1];
                const x = buffer[i+2];
                const y = buffer[i+3];
                const yaw = buffer[i+5];
                const radius = buffer[i+7];
                const threat = buffer[i+9];

                dummy.position.set(x, y, 0.2);
                dummy.rotation.set(0, 0, yaw);
                
                const isCentroid = entityType === 1.0;
                const isEmcon = entityType === 2.0;
                
                let strId = `SW-${id}`;
                if (isCentroid) strId = `CENTROID-${id}`;
                else if (isEmcon && this.latestEmconMetadata) {
                    const emconData = this.latestEmconMetadata.find(e => parseInt(e.id.replace(/\D/g, '')) === id);
                    if (emconData) strId = emconData.id;
                }
                
                const isSelected = strId === selectedId;

                const baseSc = isSelected ? 1.15 + Math.sin(t * 3) * 0.12 : 1 + Math.sin(t * 2) * 0.15;
                
                if (isEmcon) {
                    this.emconIdMap[emconCount] = strId;
                    dummy.scale.setScalar(radius);
                    dummy.updateMatrix();
                    this.emconMesh.setMatrixAt(emconCount, dummy.matrix);
                    
                    if (isSelected) {
                        selectedTrackPos = { x, y };
                        this.selectionGroup.position.set(x, y, 0.2);
                        this.selectionGroup.scale.setScalar(radius * 1.5);
                        
                        this.lockRing.visible = false;
                        this.bracketLine.material.color = new THREE.Color(0xff8800);
                        this.bracketLine.material.opacity = 0.5 * (1 - skinVal);
                    }
                    emconCount++;
                } else if (!isCentroid) {
                    this.hostileIdMap[discreteCount] = strId;
                    dummy.scale.setScalar(baseSc);
                    if (threat > 0.8) {
                        const urgentPulse = (Math.sin(t * 15) + 1) * 0.5;
                        color.setHex(urgentPulse > 0.5 ? 0xffffff : 0xff0000);
                        this.instances.hostile.mesh.setColorAt(discreteCount, color);
                    } else {
                        this.instances.hostile.mesh.setColorAt(discreteCount, this.typeColors.hostile);
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
                    dummy.scale.setScalar((radius * 0.8) + (Math.sin(t * 4) * 0.15));
                    dummy.updateMatrix();
                    this.centroidMesh.setMatrixAt(centroidCount, dummy.matrix);
                    
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

            this.instances.hostile.mesh.count = discreteCount;
            this.instances.hostile.mesh.instanceMatrix.needsUpdate = true;
            if (this.instances.hostile.mesh.instanceColor) this.instances.hostile.mesh.instanceColor.needsUpdate = true;
            if (this.instances.hostile.mesh.geometry.boundingSphere === null) this.instances.hostile.mesh.geometry.computeBoundingSphere();

            this.centroidMesh.count = centroidCount;
            this.centroidMesh.instanceMatrix.needsUpdate = true;
            if (this.centroidMesh.geometry.boundingSphere === null) this.centroidMesh.geometry.computeBoundingSphere();
            
            this.emconMesh.count = emconCount;
            this.emconMesh.instanceMatrix.needsUpdate = true;
            if (this.emconMesh.geometry.boundingSphere === null) this.emconMesh.geometry.computeBoundingSphere();
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
    }
}
