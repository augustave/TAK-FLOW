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

// --- THE OPFOR BRAIN ---
// Priority 1: Survive (Evade if under attack)
// Priority 2: Flank Blue Force
const opforBrain = new Selector([
    new Sequence([
        new IsUnderAttack(),
        new ExecuteEvasiveManeuver()
    ]),
    new FlankBlueForce()
]);

const tacticalState = {
    hostiles: [],
    friendlies: []
};

const EW_ZONES = [ { x: 0, y: 0, radius: 10.0 } ];
const emconState = new Map(); // idStr -> { lastX, lastY, entryTime }
const MAX_VELOCITY = 5.0; // units/sec

// Listen for the Float32Array from the main thread
self.onmessage = function(e) {
    const rawData = new Float32Array(e.data);
    
    tacticalState.hostiles.length = 0;
    tacticalState.friendlies.length = 0;
    
    // Format: [id, allegiance, x, y, vx, vy, threat] (Stride = 7)
    for (let i = 0; i < rawData.length; i += 7) {
        const id = rawData[i];
        const allegiance = rawData[i+1];
        const x = rawData[i+2];
        const y = rawData[i+3];
        const vx = rawData[i+4];
        const vy = rawData[i+5];
        const threat = rawData[i+6];
        
        if (id === 0 && x === 0 && y === 0) continue; 

        if (allegiance === 1.0) { // 1 = Hostile
            tacticalState.hostiles.push({ id, x, y, vx, vy, threat, desiredVector: {x: 0, y: 0} });
        } else if (allegiance === 0.0) { // 0 = Friendly
            tacticalState.friendlies.push({ id, x, y, vx, vy, threat });
        }
    }
    
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
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(h);
        
        opforBrain.evaluate(h, tacticalState);
        intentsBuffer[wIdx++] = h.id;
        intentsBuffer[wIdx++] = h.desiredVector.x;
        intentsBuffer[wIdx++] = h.desiredVector.y;
        intentsBuffer[wIdx++] = 0.0;
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
                    for (let h of grid.get(nKey)) {
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
    const discreteCount = tacticalState.hostiles.length - clusteredHostiles.size;
    const totalRenderCount = discreteCount + centroids.length;
    
    const renderingBuffer = new Float32Array(totalRenderCount * STRIDE);
    let ptr = 0;
    const now = performance.now();
    const emconAlerts = [];
    
    for (let c of centroids) {
        let isEmcon = false;
        for (let z of EW_ZONES) {
            const dx = c.x - z.x, dy = c.y - z.y;
            if (dx*dx + dy*dy < z.radius * z.radius) { isEmcon = true; break; }
        }
        
        const idStr = 'C' + c.id;
        
        if (isEmcon) {
            if (!emconState.has(idStr)) emconState.set(idStr, { lastX: c.x, lastY: c.y, entryTime: now });
            const state = emconState.get(idStr);
            const timeLossSec = (now - state.entryTime) / 1000.0;
            const ghostRadius = c.radius + (MAX_VELOCITY * timeLossSec);
            
            renderingBuffer[ptr] = c.id;
            renderingBuffer[ptr+1] = 2.0; // EMCON Ghost
            renderingBuffer[ptr+2] = state.lastX;
            renderingBuffer[ptr+3] = state.lastY;
            renderingBuffer[ptr+4] = 0.0;
            renderingBuffer[ptr+5] = Math.atan2(c.vy, c.vx) + Math.PI / 2;
            renderingBuffer[ptr+6] = Math.sqrt(c.vx*c.vx + c.vy*c.vy);
            renderingBuffer[ptr+7] = ghostRadius;
            renderingBuffer[ptr+8] = c.count;
            renderingBuffer[ptr+9] = Math.max(0, c.threat * (1.0 - timeLossSec/10.0));
            
            emconAlerts.push({ id: `CENTROID-${c.id}`, radius: ghostRadius });
        } else {
            emconState.delete(idStr);
            renderingBuffer[ptr] = c.id;
            renderingBuffer[ptr+1] = 1.0; // Swarm Centroid
            renderingBuffer[ptr+2] = c.x;
            renderingBuffer[ptr+3] = c.y;
            renderingBuffer[ptr+4] = 0.0;
            renderingBuffer[ptr+5] = Math.atan2(c.vy, c.vx) + Math.PI / 2;
            renderingBuffer[ptr+6] = Math.sqrt(c.vx*c.vx + c.vy*c.vy);
            renderingBuffer[ptr+7] = c.radius;
            renderingBuffer[ptr+8] = c.count;
            renderingBuffer[ptr+9] = c.threat;
        }
        ptr += STRIDE;
    }
    
    for (let h of tacticalState.hostiles) {
        if (!clusteredHostiles.has(h.id)) {
            let isEmcon = false;
            for (let z of EW_ZONES) {
                const dx = h.x - z.x, dy = h.y - z.y;
                if (dx*dx + dy*dy < z.radius * z.radius) { isEmcon = true; break; }
            }
            
            const idStr = 'T' + h.id;
            
            if (isEmcon) {
                if (!emconState.has(idStr)) emconState.set(idStr, { lastX: h.x, lastY: h.y, entryTime: now });
                const state = emconState.get(idStr);
                const timeLossSec = (now - state.entryTime) / 1000.0;
                const ghostRadius = 0.5 + (MAX_VELOCITY * timeLossSec); // Base radius 0.5 for discrete
                
                renderingBuffer[ptr] = h.id;
                renderingBuffer[ptr+1] = 2.0; // EMCON Ghost
                renderingBuffer[ptr+2] = state.lastX;
                renderingBuffer[ptr+3] = state.lastY;
                renderingBuffer[ptr+4] = 0.0;
                renderingBuffer[ptr+5] = Math.atan2(h.vy, h.vx) + Math.PI / 2;
                renderingBuffer[ptr+6] = Math.sqrt(h.vx*h.vx + h.vy*h.vy);
                renderingBuffer[ptr+7] = ghostRadius;
                renderingBuffer[ptr+8] = 1;
                renderingBuffer[ptr+9] = Math.max(0, h.threat * (1.0 - timeLossSec/10.0));
                
                emconAlerts.push({ id: `SW-${h.id}`, radius: ghostRadius });
            } else {
                emconState.delete(idStr);
                renderingBuffer[ptr] = h.id;
                renderingBuffer[ptr+1] = 0.0; // Discrete Track
                renderingBuffer[ptr+2] = h.x;
                renderingBuffer[ptr+3] = h.y;
                renderingBuffer[ptr+4] = 0.0;
                renderingBuffer[ptr+5] = Math.atan2(h.vy, h.vx) + Math.PI / 2;
                renderingBuffer[ptr+6] = Math.sqrt(h.vx*h.vx + h.vy*h.vy);
                renderingBuffer[ptr+7] = 0.0;
                renderingBuffer[ptr+8] = 1;
                renderingBuffer[ptr+9] = h.threat;
            }
            ptr += STRIDE;
        }
    }

    const uiMetadata = {
        centroids: centroids.map(c => ({
            id: c.id,
            count: c.count,
            radius: c.radius,
            childIds: c.childIds
        })),
        emcon: emconAlerts
    };

    self.postMessage({
        render: renderingBuffer.buffer, 
        intents: intentsBuffer.buffer,
        ui: uiMetadata
    }, [renderingBuffer.buffer, intentsBuffer.buffer]);
};
