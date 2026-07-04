import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ENTITY_TYPE,
    RENDER_ROW_STRIDE,
    INPUT_ROW_STRIDE,
    isEmconType,
    isCentroidType,
    isUuvType,
    normalizeLegacyEntityType,
    normalizeLegacyTrackState
} from '../../src/core/trackSchema.js';

test('entity type codes are unique', () => {
    const codes = Object.values(ENTITY_TYPE);
    assert.equal(new Set(codes).size, codes.length);
});

test('strides match the worker buffer layouts', () => {
    assert.equal(RENDER_ROW_STRIDE, 10);
    assert.equal(INPUT_ROW_STRIDE, 9);
});

test('predicates classify every code exactly once per mesh lane', () => {
    const emcon = [ENTITY_TYPE.EMCON_SINGLE, ENTITY_TYPE.UUV_SUBMERGED, ENTITY_TYPE.EMCON_CENTROID];
    const centroidIdentity = [ENTITY_TYPE.SWARM_CENTROID, ENTITY_TYPE.EMCON_CENTROID];
    const uuv = [ENTITY_TYPE.UUV_SURFACED, ENTITY_TYPE.UUV_SUBMERGED];

    for (const code of Object.values(ENTITY_TYPE)) {
        assert.equal(isEmconType(code), emcon.includes(code), `isEmconType(${code})`);
        assert.equal(isCentroidType(code), centroidIdentity.includes(code), `isCentroidType(${code})`);
        assert.equal(isUuvType(code), uuv.includes(code), `isUuvType(${code})`);
    }
});

test('normalizeLegacyEntityType rewrites the two ambiguous v1 codes by id prefix', () => {
    // v1 code 1.0 on a non-centroid id was a misrouted hostile single
    assert.equal(normalizeLegacyEntityType(1.0, 'SW-1042'), ENTITY_TYPE.HOSTILE_SINGLE);
    assert.equal(normalizeLegacyEntityType(1.0, 'TK-4071'), ENTITY_TYPE.HOSTILE_SINGLE);
    // v1 code 1.0 on a CENTROID- id stays a centroid (real centroid, or
    // unrecoverably misrouted single -- documented residual ambiguity)
    assert.equal(normalizeLegacyEntityType(1.0, 'CENTROID-9'), ENTITY_TYPE.SWARM_CENTROID);
    // v1 code 2.0 on a CENTROID- id was an EMCON centroid
    assert.equal(normalizeLegacyEntityType(2.0, 'CENTROID-9'), ENTITY_TYPE.EMCON_CENTROID);
    // v1 code 2.0 on a track id stays an EMCON single
    assert.equal(normalizeLegacyEntityType(2.0, 'SW-1042'), ENTITY_TYPE.EMCON_SINGLE);
    // unambiguous codes pass through
    assert.equal(normalizeLegacyEntityType(0.0, 'GHOST-3'), ENTITY_TYPE.SIGINT_GHOST);
    assert.equal(normalizeLegacyEntityType(3.0, 'ORCA-H1'), ENTITY_TYPE.UUV_SURFACED);
    assert.equal(normalizeLegacyEntityType(4.0, 'ORCA-H1'), ENTITY_TYPE.UUV_SUBMERGED);
    // missing id is treated as non-centroid
    assert.equal(normalizeLegacyEntityType(1.0, undefined), ENTITY_TYPE.HOSTILE_SINGLE);
});

test('normalizeLegacyTrackState rewrites rows in place and tolerates junk', () => {
    const rows = [
        { id: 'SW-1042', entityType: 1.0 },
        { id: 'CENTROID-9', entityType: 2.0 },
        { id: 'GHOST-3', entityType: 0.0 },
        null
    ];
    const result = normalizeLegacyTrackState(rows);
    assert.equal(result, rows);
    assert.equal(rows[0].entityType, ENTITY_TYPE.HOSTILE_SINGLE);
    assert.equal(rows[1].entityType, ENTITY_TYPE.EMCON_CENTROID);
    assert.equal(rows[2].entityType, ENTITY_TYPE.SIGINT_GHOST);
    assert.equal(normalizeLegacyTrackState(undefined), undefined);
});
