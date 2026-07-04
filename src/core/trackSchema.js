// Shared contract between opforWorker (producer), TrackManager (consumer),
// and the replay pipeline. The render buffer is a flat Float32Array of
// RENDER_ROW_STRIDE-wide rows; entityType is the row's discriminator.
// Keep this module pure (no DOM, no THREE) — it is unit-tested under node.

export const INPUT_ROW_STRIDE = 9;   // [id, allegiance, x, y, z, vx, vy, threat, subtypeCode]
export const RENDER_ROW_STRIDE = 10; // [id, entityType, x, y, z, yaw, speed, radius, count, confidence]

export const ENTITY_TYPE = Object.freeze({
    SIGINT_GHOST: 0.0,
    SWARM_CENTROID: 1.0,
    EMCON_SINGLE: 2.0,
    UUV_SURFACED: 3.0,
    UUV_SUBMERGED: 4.0,
    HOSTILE_SINGLE: 5.0,
    EMCON_CENTROID: 6.0
});

export function isEmconType(entityType) {
    return entityType === ENTITY_TYPE.EMCON_SINGLE
        || entityType === ENTITY_TYPE.UUV_SUBMERGED
        || entityType === ENTITY_TYPE.EMCON_CENTROID;
}

export function isCentroidType(entityType) {
    return entityType === ENTITY_TYPE.SWARM_CENTROID
        || entityType === ENTITY_TYPE.EMCON_CENTROID;
}

export function isUuvType(entityType) {
    return entityType === ENTITY_TYPE.UUV_SURFACED
        || entityType === ENTITY_TYPE.UUV_SUBMERGED;
}

// Replays recorded before tak-flow.replay.v2 used entityType 1.0 for both
// centroids and non-EMCON hostile singles, and 2.0 for both EMCON singles
// and EMCON centroids. Snapshot rows carry string ids, so identity is
// recoverable by prefix. Residual ambiguity: v1 rows where a misrouted
// single was recorded under a CENTROID- id cannot be distinguished from a
// real centroid and are left as centroids.
export function normalizeLegacyEntityType(entityType, idString) {
    const id = String(idString ?? '');
    if (entityType === ENTITY_TYPE.SWARM_CENTROID && !id.startsWith('CENTROID-')) {
        return ENTITY_TYPE.HOSTILE_SINGLE;
    }
    if (entityType === ENTITY_TYPE.EMCON_SINGLE && id.startsWith('CENTROID-')) {
        return ENTITY_TYPE.EMCON_CENTROID;
    }
    return entityType;
}

// In-place normalization of one snapshot's trackState array (v1 -> v2).
export function normalizeLegacyTrackState(trackState) {
    if (!Array.isArray(trackState)) return trackState;
    for (const entry of trackState) {
        if (!entry || typeof entry !== 'object') continue;
        entry.entityType = normalizeLegacyEntityType(entry.entityType, entry.id);
    }
    return trackState;
}
