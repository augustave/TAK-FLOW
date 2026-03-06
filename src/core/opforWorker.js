// --- CORE BEHAVIOR TREE CLASSES ---
class Node {
    evaluate(track, tacticalState) { return 'FAILURE'; }
}

class Selector extends Node {
    constructor(children) { super(); this.children = children; }
    evaluate(track, tacticalState) {
        for (let child of this.children) {
            const status = child.evaluate(track, tacticalState);
            if (status === 'SUCCESS' || status === 'RUNNING') return status;
        }
        return 'FAILURE';
    }
}

class Sequence extends Node {
    constructor(children) { super(); this.children = children; }
    evaluate(track, tacticalState) {
        for (let child of this.children) {
            const status = child.evaluate(track, tacticalState);
            if (status === 'FAILURE') return 'FAILURE';
            if (status === 'RUNNING') return 'RUNNING';
        }
        return 'SUCCESS';
    }
}

// --- TACTICAL LEAF NODES (ACTIONS & CONDITIONS) ---

class IsUnderAttack extends Node {
    evaluate(track, tacticalState) {
        // Logic: Check if a Blue Force track is within lethal radius (e.g., 20.0 units)
        if (tacticalState.friendlies.length === 0) return 'FAILURE';
        
        let nearestDistSq = Infinity;
        for (let j = 0; j < tacticalState.friendlies.length; j++) {
            const f = tacticalState.friendlies[j];
            const dx = f.x - track.x;
            const dy = f.y - track.y;
            const distSq = dx*dx + dy*dy;
            if (distSq < nearestDistSq) nearestDistSq = distSq;
        }

        return nearestDistSq < (20.0 * 20.0) ? 'SUCCESS' : 'FAILURE';
    }
}

class ExecuteEvasiveManeuver extends Node {
    evaluate(track, tacticalState) {
        // Logic: Calculate a vector perpendicular and away from the nearest threat
        let nearestF = null;
        let nearestDistSq = Infinity;
        
        for (let j = 0; j < tacticalState.friendlies.length; j++) {
            const f = tacticalState.friendlies[j];
            const dx = f.x - track.x;
            const dy = f.y - track.y;
            const distSq = dx*dx + dy*dy;
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearestF = f;
            }
        }

        if (nearestF) {
            // Flee vector (from threat to track)
            const rx = track.x - nearestF.x;
            const ry = track.y - nearestF.y;
            const len = Math.sqrt(rx*rx + ry*ry) || 1;
            
            // Scatter outward and perpendicular
            track.desiredVector = { x: (rx/len) + (ry/len)*0.5, y: (ry/len) - (rx/len)*0.5 };
        } else {
            track.desiredVector = { x: 0, y: 0 };
        }
        
        return 'SUCCESS';
    }
}

class FlankBlueForce extends Node {
    evaluate(track, tacticalState) {
        // Logic: Identify center of mass of Blue Force and aim for the perimeter
        if (tacticalState.friendlies.length === 0) {
            track.desiredVector = { x: 0, y: 0 };
            return 'SUCCESS';
        }

        let cx = 0, cy = 0;
        for (let j = 0; j < tacticalState.friendlies.length; j++) {
            cx += tacticalState.friendlies[j].x;
            cy += tacticalState.friendlies[j].y;
        }
        cx /= tacticalState.friendlies.length;
        cy /= tacticalState.friendlies.length;

        // Vector to Center of Mass
        const rx = cx - track.x;
        const ry = cy - track.y;
        const dist = Math.sqrt(rx*rx + ry*ry) || 1;

        // Flank: If far away, aim toward CoM. If deep, aim perpendicular to the CoM vector (orbit/flank)
        if (dist > 50.0) {
            track.desiredVector = { x: rx/dist, y: ry/dist }; // Approach
        } else {
            // Perpendicular wrap
            track.desiredVector = { x: -ry/dist, y: rx/dist }; 
        }

        return 'SUCCESS';
    }
}

class EvaluateAlphaEarthTerrainCost extends Node {
    evaluate(track, tacticalState) {
        // Logic: Calculate terrain traversal cost based on AlphaEarth embeddings
        // Dim 12: Lithosphere density
        // Dim 45: Surface vegetation
        // Dim 8: Hydrology
        if (!tacticalState.alphaEarthData || tacticalState.alphaEarthData.length < 64) {
            return 'FAILURE'; 
        }

        const crustD = tacticalState.alphaEarthData[12];
        const vegI = tacticalState.alphaEarthData[45];
        const hydro = tacticalState.alphaEarthData[8];

        // Basic collision check: Water bodies
        // In the shader: baseElevation -= smoothstep(0.4, 1.0, hydro) * 0.15 * fbm(uv*10);
        // If hydrology is high, we assume water/river blocking ground troops unless they are UUVs
        
        const isGroundUnit = track.subtypeCode < 10;
        
        // Pseudo-steering: Repel from "dense vegetation" centers (just a synthetic gradient)
        if (vegI > 0.6 && isGroundUnit) {
            // Apply a slight repulsive force randomly associated with high vegetation chunks
            // We use the spatial hash coordinates to generate pseudo-deterministic terrain lumps
            const cx = Math.floor(track.x / 5.0) * 5.0;
            const cy = Math.floor(track.y / 5.0) * 5.0;
            const lumpHash = Math.abs(Math.sin(cx * 12.9898 + cy * 78.233)) * vegI;
            
            if (lumpHash > 0.5) {
                // Steer away from block
                const rx = track.x - cx;
                const ry = track.y - cy;
                const d = Math.sqrt(rx*rx + ry*ry) || 1.0;
                track.desiredVector.x += (rx/d) * 0.4;
                track.desiredVector.y += (ry/d) * 0.4;
            }
        }

        return 'SUCCESS';
    }
}

// --- THE OPFOR BRAIN ---
// Priority 1: Survive (Evade if under attack)
// Priority 2: Navigate AlphaEarth Terrain Costs
// Priority 3: Flank Blue Force
const opforBrain = new Selector([
    new Sequence([
        new IsUnderAttack(),
        new ExecuteEvasiveManeuver()
    ]),
    new Sequence([
        new EvaluateAlphaEarthTerrainCost(),
        new FlankBlueForce()
    ]),
    new FlankBlueForce()
]);

const tacticalState = {
    hostiles: [],
    friendlies: [],
    alphaEarthData: null
};

const EW_ZONES = [ { x: 0, y: 0, radius: 10.0 } ];
const emconState = new Map(); // idStr -> { lastX, lastY, entryTime }
const MAX_VELOCITY = 5.0; // units/sec
const EMCON_CONFIDENCE_DECAY_PER_SEC = 0.01;
const EMCON_LOST_CONFIDENCE_THRESHOLD = 0.05;
const EMCON_MAX_RADIUS_KM = 20.0;
const lostTrackNotified = new Set();
const forcedConfidenceById = new Map(); // TrackId -> expiry timestamp
const FORCED_CONFIDENCE_TTL_MS = 180000;
const ghostTracks = new Map(); // numericId -> { id, x, y, yaw, confidence, expiresAt }
let nextGhostId = -1;
let lastDecoyBurstCount = 0;

// Phase 16: Pheromone Data Layer
const pheromoneGrid = new Map(); // "x,y" -> level
const PHEROMONE_DECAY_RATE = 0.005;

let envFriendlyTargets = [];
let envSamZones = [];

function evaporatePheromones() {
    for (let [key, level] of pheromoneGrid.entries()) {
        const newLevel = level > 0 ? 
            Math.max(0, level - PHEROMONE_DECAY_RATE) : 
            Math.min(0, level + PHEROMONE_DECAY_RATE);
            
        if (Math.abs(newLevel) < 0.001) {
            pheromoneGrid.delete(key);
        } else {
            pheromoneGrid.set(key, newLevel);
        }
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function maybeEmitTrackLost(trackId) {
    if (lostTrackNotified.has(trackId)) return;
    lostTrackNotified.add(trackId);
    self.postMessage({ type: 'TRACK_LOST', id: trackId });
}

function normalizeForcedTrackId(rawId) {
    if (typeof rawId !== 'string') return '';
    const tkMatch = /^TK-(\d+)$/.exec(rawId);
    if (tkMatch) return `SW-${tkMatch[1]}`;
    return rawId;
}

function setForcedConfidenceTrack(rawId, nowTs) {
    const normalized = normalizeForcedTrackId(rawId);
    if (!normalized) return;
    forcedConfidenceById.set(normalized, nowTs + FORCED_CONFIDENCE_TTL_MS);
}

function isForcedTrackConfirmed(trackId, nowTs) {
    const expiresAt = forcedConfidenceById.get(trackId);
    if (!expiresAt) return false;
    if (expiresAt <= nowTs) {
        forcedConfidenceById.delete(trackId);
        return false;
    }
    return true;
}

function getOrCreateEmconState(idStr, x, y, vx, vy, now, initialConfidence) {
    if (!emconState.has(idStr)) {
        emconState.set(idStr, {
            lastX: x, lastY: y, lastVx: vx, lastVy: vy,
            entryTime: now, lastUpdateTs: now, lastYawTs: now,
            confidence: clamp(initialConfidence, 0, 1),
            bankAngle: 0
        });
    }
    return emconState.get(idStr);
}

function decayEmconConfidence(state, now) {
    const deltaSec = Math.max(0, (now - state.lastUpdateTs) / 1000.0);
    state.lastUpdateTs = now;
    state.confidence = Math.max(0, state.confidence - (EMCON_CONFIDENCE_DECAY_PER_SEC * deltaSec));
}

function appendRenderRow(rows, id, entityType, x, y, z, yaw, speed, radius, count, confidence) {
    rows.push(id, entityType, x, y, z, yaw, speed, radius, count, confidence);
}

function updateGhostTracks(decoyActive, decoyBurstCount, now) {
    if (decoyActive && decoyBurstCount > lastDecoyBurstCount) {
        const spawnCount = clamp(decoyBurstCount - lastDecoyBurstCount, 1, 3);
        for (let i = 0; i < spawnCount; i++) {
            const ghostId = nextGhostId--;
            ghostTracks.set(ghostId, {
                id: ghostId,
                x: (Math.random() - 0.5) * 60.0,
                y: (Math.random() - 0.5) * 60.0,
                yaw: Math.random() * Math.PI * 2.0,
                confidence: 0.2 + (Math.random() * 0.29), // always < 0.5
                expiresAt: now + 6000 + (Math.random() * 6000)
            });
        }
    }

    lastDecoyBurstCount = decoyBurstCount;

    for (let ghost of ghostTracks.values()) {
        if (!decoyActive || now >= ghost.expiresAt) {
            forcedConfidenceById.delete(`GHOST-${Math.abs(ghost.id)}`);
            ghostTracks.delete(ghost.id);
            continue;
        }

        if (!ghost.vx) {
            ghost.vx = Math.cos(ghost.yaw) * 12.0;
            ghost.vy = Math.sin(ghost.yaw) * 12.0;
        }
        if (Math.random() < 0.05 || !ghost.targetYaw) ghost.targetYaw = Math.random() * Math.PI * 2.0;
        
        let yawDiff = ghost.targetYaw - ghost.yaw;
        while(yawDiff > Math.PI) yawDiff -= Math.PI * 2;
        while(yawDiff < -Math.PI) yawDiff += Math.PI * 2;
        
        const speed = Math.sqrt(ghost.vx*ghost.vx + ghost.vy*ghost.vy) || 1.0;
        const latAccelLimit = Math.tan(1.047) * 9.81; // 60 degrees max bank
        const maxTurnRate = latAccelLimit / speed;
        const dt = 0.1; // simulated worker dt
        
        const turnStep = clamp(yawDiff, -maxTurnRate * dt, maxTurnRate * dt);
        ghost.yaw += turnStep;
        
        ghost.vx = Math.cos(ghost.yaw) * speed;
        ghost.vy = Math.sin(ghost.yaw) * speed;

        ghost.x = clamp(ghost.x + ghost.vx * dt, -39.0, 39.0);
        ghost.y = clamp(ghost.y + ghost.vy * dt, -39.0, 39.0);
    }
}

// Listen for the Float32Array from the main thread
self.onmessage = function(e) {
    const payload = e.data || {};
    
    // Non-buffer payloads (e.g. system overrides)
    if (payload.type === 'FORCE_CONFIDENCE' && payload.id) {
        setForcedConfidenceTrack(payload.id, performance.now());
        return;
    }

    if (payload.type === 'RESET_STATE') {
        emconState.clear();
        lostTrackNotified.clear();
        ghostTracks.clear();
        forcedConfidenceById.clear();
        pheromoneGrid.clear();
        lastDecoyBurstCount = 0;
        return;
    }
    
    if (payload.type === 'SYNC_ENV') {
        envFriendlyTargets = payload.targets || [];
        envSamZones = payload.threats || [];
        return;
    }

    const dataBuffer = payload instanceof ArrayBuffer ? payload : payload.buffer;
    if (!dataBuffer) return;
    const rawData = new Float32Array(dataBuffer);
    const decoyActive = Boolean(payload.decoyActive);
    const decoyBurstCount = Number(payload.decoyBurstCount) || 0;
    
    if (payload.alphaEarthBuffer) {
        tacticalState.alphaEarthData = new Float32Array(payload.alphaEarthBuffer);
    }
    
    tacticalState.hostiles.length = 0;
    tacticalState.friendlies.length = 0;
    
    // Format: [id, allegiance, x, y, z, vx, vy, threat, subtypeCode] (Stride = 9)
    for (let i = 0; i < rawData.length; i += 9) {
        const id = rawData[i];
        const allegiance = rawData[i+1];
        const x = rawData[i+2];
        const y = rawData[i+3];
        const z = rawData[i+4];
        const vx = rawData[i+5];
        const vy = rawData[i+6];
        const threat = rawData[i+7];
        const subtypeCode = rawData[i+8];
        
        if (id === 0 && x === 0 && y === 0) continue; 

        if (allegiance === 1.0) { // 1 = Hostile
            tacticalState.hostiles.push({ id, x, y, z, vx, vy, threat, subtypeCode, desiredVector: {x: 0, y: 0} });
        } else if (allegiance === 0.0) { // 0 = Friendly
            tacticalState.friendlies.push({ id, x, y, z, vx, vy, threat, subtypeCode });
        }
    }
    
    evaporatePheromones();
    
    // 1. Behavior Tree Intents
    const intentsBuffer = new Float32Array(tacticalState.hostiles.length * 4); // [id, vx, vy, vz]
    let wIdx = 0;
    
    // 2. Spatial Hash Clustering for Hostiles
    const grid = new Map();
    const CELL_SIZE = 2.5; 
    
    for (let h of tacticalState.hostiles) {
        const cx = Math.floor(h.x / CELL_SIZE);
        const cy = Math.floor(h.y / CELL_SIZE);
        const key = `${cx},${cy}`;
        if (!grid.has(key)) grid.set(key, { hostiles: [], cx, cy });
        grid.get(key).hostiles.push(h);
    }
    
    // Evaluate behavioral intents + Pheromone Logic per spatial cell to save O(m*n) limits
    for (let [key, cellData] of grid.entries()) {
        const { cx, cy, hostiles } = cellData;
        const cellCenter = { x: (cx + 0.5) * CELL_SIZE, y: (cy + 0.5) * CELL_SIZE };
        
        // 1. Find nearest targets relative to cell center
        let nearestFriendly = null;
        let nearestFriendlyDistSq = Infinity;
        for (let f of envFriendlyTargets) {
            const dx = f.x - cellCenter.x;
            const dy = f.y - cellCenter.y;
            const dSq = dx*dx + dy*dy;
            if (dSq < nearestFriendlyDistSq) {
                nearestFriendlyDistSq = dSq;
                nearestFriendly = f;
            }
        }
        
        let nearestSam = null;
        let nearestSamDistSq = Infinity;
        for (let s of envSamZones) {
            const dx = s.x - cellCenter.x;
            const dy = s.y - cellCenter.y;
            const dSq = dx*dx + dy*dy;
            if (dSq < nearestSamDistSq) {
                nearestSamDistSq = dSq;
                nearestSam = s;
            }
        }
        
        // 2. Evaluate drones within cell
        for (let h of hostiles) {
            opforBrain.evaluate(h, tacticalState);
            
            // Ant Logic: Trace Deposition
            if (nearestSam && nearestSamDistSq <= (nearestSam.radius * nearestSam.radius)) {
                // Inside Threat Zone: Massive negative trace
                const currentP = pheromoneGrid.get(key) || 0;
                pheromoneGrid.set(key, Math.max(-50.0, currentP - 5.0)); // Ineffective Trace
            } else if (nearestFriendly) {
                // Dot Product to see if closing distance
                const vxTarget = nearestFriendly.x - h.x;
                const vyTarget = nearestFriendly.y - h.y;
                const dot = (h.vx * vxTarget) + (h.vy * vyTarget);
                
                if (dot > 0) {
                    const currentP = pheromoneGrid.get(key) || 0;
                    pheromoneGrid.set(key, Math.min(50.0, currentP + 0.1)); // Validated Trace
                }
            }
            
            // Ant Logic: Gradient Sampling (Gradient Ascent)
            let maxPheromone = -Infinity;
            let bestGradientVec = { x: 0, y: 0 };
            
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const neighborKey = `${cx+dx},${cy+dy}`;
                    const nLevel = pheromoneGrid.get(neighborKey) || 0;
                    
                    if (nLevel > maxPheromone && nLevel > 0) {
                        maxPheromone = nLevel;
                        bestGradientVec.x = dx;
                        bestGradientVec.y = dy;
                    } else if (nLevel < -2.0 && dx === 0 && dy === 0) {
                        // Current cell is highly toxic, push away from center
                        bestGradientVec.x = h.vx; // Keep moving
                        bestGradientVec.y = h.vy;
                    }
                }
            }
            
            // Normalize Gradient
            const gLen = Math.sqrt(bestGradientVec.x*bestGradientVec.x + bestGradientVec.y*bestGradientVec.y);
            if (gLen > 0) {
                bestGradientVec.x /= gLen;
                bestGradientVec.y /= gLen;
            }
            
            // Fuse Intent + Gradient into Steer Force
            const PHEROMONE_WEIGHT = 1.5;
            h.desiredVector.x += bestGradientVec.x * PHEROMONE_WEIGHT;
            h.desiredVector.y += bestGradientVec.y * PHEROMONE_WEIGHT;
            
            // Normalize final intent vector
            const vLen = Math.sqrt(h.desiredVector.x*h.desiredVector.x + h.desiredVector.y*h.desiredVector.y);
            if (vLen > 0) {
                h.desiredVector.x /= vLen;
                h.desiredVector.y /= vLen;
            }
            
            intentsBuffer[wIdx++] = h.id;
            intentsBuffer[wIdx++] = h.desiredVector.x;
            intentsBuffer[wIdx++] = h.desiredVector.y;
            intentsBuffer[wIdx++] = 0.0;
        }
    }

    const clusteredHostiles = new Set();
    const centroids = [];

    for (let [key, cell] of grid.entries()) {
        const [cx, cy] = key.split(',').map(Number);
        
        let localHostiles = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nKey = `${cx+dx},${cy+dy}`;
                if (grid.has(nKey)) {
                    for (let h of grid.get(nKey).hostiles) {
                        if (!clusteredHostiles.has(h.id)) localHostiles.push(h);
                    }
                }
            }
        }
        
        if (localHostiles.length > 15) {
            let polX = 0, polY = 0, validVels = 0;
            for (let h of localHostiles) {
                const len = Math.sqrt(h.vx*h.vx + h.vy*h.vy);
                if (len > 0) {
                    polX += h.vx / len;
                    polY += h.vy / len;
                    validVels++;
                }
            }
            
            let polarization = 0;
            if (validVels > 0) {
                polX /= validVels;
                polY /= validVels;
                polarization = Math.sqrt(polX*polX + polY*polY);
            }
            
            if (polarization > 0.85) {
                let sumX = 0, sumY = 0, sumVx = 0, sumVy = 0, maxThreat = 0;
                let childIds = [];
                for (let h of localHostiles) {
                    sumX += h.x;
                    sumY += h.y;
                    sumVx += h.vx;
                    sumVy += h.vy;
                    if (h.threat > maxThreat) maxThreat = h.threat;
                    clusteredHostiles.add(h.id);
                    childIds.push(h.id);
                }
                const count = localHostiles.length;
                const avgX = sumX / count;
                const avgY = sumY / count;
                
                let maxSq = 0;
                for (let h of localHostiles) {
                    const dx = h.x - avgX;
                    const dy = h.y - avgY;
                    const distSq = dx*dx + dy*dy;
                    if (distSq > maxSq) maxSq = distSq;
                }
                const radius = Math.sqrt(maxSq) + 0.5;
                
                centroids.push({
                    id: localHostiles[0].id, 
                    x: avgX, y: avgY, 
                    vx: sumVx / count, vy: sumVy / count,
                    radius: radius, 
                    count: count, 
                    threat: maxThreat,
                    childIds: childIds
                });
            }
        }
    }

    // 3. Output Render Buffer Schema (Stride = 10)
    const STRIDE = 10;
    const renderRows = [];
    const now = performance.now();
    const emconAlerts = [];
    const ghostUiTracks = [];

    updateGhostTracks(decoyActive, decoyBurstCount, now);
    
    for (let c of centroids) {
        let isEmcon = false;
        const stringId = `CENTROID-${c.id}`;
        const isForcedConfirmed = isForcedTrackConfirmed(stringId, now);

        if (!isForcedConfirmed) {
            for (let z of EW_ZONES) {
                const dx = c.x - z.x, dy = c.y - z.y;
                if (dx*dx + dy*dy < z.radius * z.radius) { isEmcon = true; break; }
            }
        }
        
        const idStr = 'C' + c.id;
        
        if (isEmcon) {
            const state = getOrCreateEmconState(idStr, c.x, c.y, c.vx, c.vy, now, c.threat);
            decayEmconConfidence(state, now);
            const timeLossSec = (now - state.entryTime) / 1000.0;
            
            const speed = Math.sqrt(c.vx*c.vx + c.vy*c.vy) || 1.0;
            const dot = (state.lastVx*c.vx + state.lastVy*c.vy) / (speed*speed);
            const cross = (state.lastVx*c.vy - state.lastVy*c.vx) / (speed*speed);
            const dtYaw = Math.max(0.016, (now - state.lastYawTs) / 1000.0);
            const latAccel = speed * Math.abs(Math.atan2(cross, dot)) / dtYaw;
            const bankAngle = clamp(Math.atan(latAccel / 9.81), 0, 1.047);
            state.lastYawTs = now; state.lastVx = c.vx; state.lastVy = c.vy;

            const baseExpansionRate = MAX_VELOCITY * 0.5;
            const shapeWarpFactor = 0.8;
            const ghostRadius = c.radius + (baseExpansionRate * timeLossSec) + (Math.abs(bankAngle) * speed * shapeWarpFactor);
            const radiusFade = clamp(1.0 - ((ghostRadius - 15.0) / 5.0), 0.0, 1.0);
            const renderConfidence = state.confidence * radiusFade;

            if (state.confidence <= EMCON_LOST_CONFIDENCE_THRESHOLD || ghostRadius > EMCON_MAX_RADIUS_KM) {
                emconState.delete(idStr);
                forcedConfidenceById.delete(stringId);
                maybeEmitTrackLost(`CENTROID-${c.id}`);
                continue;
            }

            appendRenderRow(
                renderRows,
                c.id,
                2.0,
                state.lastX,
                state.lastY,
                0.0,
                Math.atan2(c.vy, c.vx) + Math.PI / 2,
                Math.sqrt(c.vx * c.vx + c.vy * c.vy),
                ghostRadius,
                c.count,
                renderConfidence
            );
            
            emconAlerts.push({
                id: `CENTROID-${c.id}`,
                numericId: c.id,
                radius: ghostRadius,
                confidence: renderConfidence,
                x: state.lastX,
                y: state.lastY
            });
        } else {
            emconState.delete(idStr);
            lostTrackNotified.delete(`CENTROID-${c.id}`);
            appendRenderRow(
                renderRows,
                c.id,
                1.0,
                c.x,
                c.y,
                0.0,
                Math.atan2(c.vy, c.vx) + Math.PI / 2,
                Math.sqrt(c.vx * c.vx + c.vy * c.vy),
                c.radius,
                c.count,
                c.threat
            );
        }
    }
    
    for (let h of tacticalState.hostiles) {
        if (!clusteredHostiles.has(h.id)) {
            let isEmcon = false;
            const stringId = `SW-${h.id}`;
            const isForcedConfirmed = isForcedTrackConfirmed(stringId, now);
            const isUUV = (h.subtypeCode >= 10 && h.subtypeCode <= 13);
            const isSubmerged = isUUV && h.z < -0.1;

            if (!isForcedConfirmed) {
                if (isSubmerged) {
                    isEmcon = true;
                } else {
                    for (let z of EW_ZONES) {
                        const dx = h.x - z.x, dy = h.y - z.y;
                        if (dx*dx + dy*dy < z.radius * z.radius) { isEmcon = true; break; }
                    }
                }
            }
            
            const idStr = 'T' + h.id;
            
            if (isEmcon) {
                const state = getOrCreateEmconState(idStr, h.x, h.y, h.vx, h.vy, now, h.threat);
                decayEmconConfidence(state, now);
                const timeLossSec = (now - state.entryTime) / 1000.0;
                
                const speed = Math.sqrt(h.vx*h.vx + h.vy*h.vy) || 1.0;
                const dot = (state.lastVx*h.vx + state.lastVy*h.vy) / (speed*speed);
                const cross = (state.lastVx*h.vy - state.lastVy*h.vx) / (speed*speed);
                const dtYaw = Math.max(0.016, (now - state.lastYawTs) / 1000.0);
                const latAccel = speed * Math.abs(Math.atan2(cross, dot)) / dtYaw;
                const bankAngle = clamp(Math.atan(latAccel / 9.81), 0, 1.047);
                state.lastYawTs = now; state.lastVx = h.vx; state.lastVy = h.vy;

                let ghostRadius = 0.5;
                if (isUUV) {
                    const distTraveled = speed * timeLossSec;
                    ghostRadius = 0.5 + (0.001 * distTraveled);
                } else {
                    const baseExpansionRate = MAX_VELOCITY * 0.5;
                    const shapeWarpFactor = 0.8;
                    ghostRadius = 0.5 + (baseExpansionRate * timeLossSec) + (Math.abs(bankAngle) * speed * shapeWarpFactor);
                }
                
                const radiusFade = clamp(1.0 - ((ghostRadius - 15.0) / 5.0), 0.0, 1.0);
                const renderConfidence = state.confidence * radiusFade;

                if (state.confidence <= EMCON_LOST_CONFIDENCE_THRESHOLD || ghostRadius > EMCON_MAX_RADIUS_KM) {
                    emconState.delete(idStr);
                    forcedConfidenceById.delete(stringId);
                    maybeEmitTrackLost(`SW-${h.id}`);
                    continue;
                }

                appendRenderRow(
                    renderRows,
                    h.id,
                    isUUV ? 4.0 : 2.0,
                    state.lastX,
                    state.lastY,
                    0.0,
                    Math.atan2(h.vy, h.vx) + Math.PI / 2,
                    Math.sqrt(h.vx * h.vx + h.vy * h.vy),
                    ghostRadius,
                    1,
                    renderConfidence
                );
                
                emconAlerts.push({
                    id: `SW-${h.id}`,
                    numericId: h.id,
                    radius: ghostRadius,
                    confidence: renderConfidence,
                    x: state.lastX,
                    y: state.lastY
                });
            } else {
                emconState.delete(idStr);
                lostTrackNotified.delete(`SW-${h.id}`);
                appendRenderRow(
                    renderRows,
                    h.id,
                    isUUV ? 3.0 : 1.0,
                    h.x,
                    h.y,
                    h.z,
                    Math.atan2(h.vy, h.vx) + Math.PI / 2,
                    Math.sqrt(h.vx * h.vx + h.vy * h.vy),
                    0.0,
                    1,
                    h.threat
                );
            }
        }
    }

    for (let ghost of ghostTracks.values()) {
        const ghostTrackId = `GHOST-${Math.abs(ghost.id)}`;
        const isForcedConfirmed = isForcedTrackConfirmed(ghostTrackId, now);
        const renderConfidence = isForcedConfirmed ? 1.0 : ghost.confidence;

        appendRenderRow(
            renderRows,
            ghost.id,
            0.0,
            ghost.x,
            ghost.y,
            0.0,
            ghost.yaw,
            0.0,
            0.0,
            1.0,
            renderConfidence
        );
        ghostUiTracks.push({
            id: ghostTrackId,
            numericId: ghost.id,
            x: ghost.x,
            y: ghost.y,
            confidence: renderConfidence
        });
    }

    const renderingBuffer = new Float32Array(renderRows.length);
    for (let i = 0; i < renderRows.length; i++) renderingBuffer[i] = renderRows[i];

    const uiMetadata = {
        centroids: centroids.map(c => ({
            id: c.id,
            count: c.count,
            radius: c.radius,
            childIds: c.childIds
        })),
        emcon: emconAlerts,
        ghosts: ghostUiTracks
    };

    self.postMessage({
        render: renderingBuffer.buffer, 
        intents: intentsBuffer.buffer,
        ui: uiMetadata
    }, [renderingBuffer.buffer, intentsBuffer.buffer]);
};
