import { store } from './core/Store.js';
import { setupMapEngine } from './core/MapEngine.js';
import { TrackManager } from './core/TrackManager.js';
import { SigintFeed } from './core/SigintFeed.js';
import { OpsLog } from './core/OpsLog.js';
import { DecoySim } from './core/DecoySim.js';
import { HUDController } from './core/HUDController.js';
import { DOMController } from './core/DOMController.js';
import { DrawController } from './core/DrawController.js';
import { SplatController } from './core/SplatController.js';

// Setup Map
const container = document.getElementById('canvas-container');
const mapEngine = setupMapEngine(container);

// Setup Controllers & Systems
const opsLog = new OpsLog();
window.opsLogInstance = opsLog; // For TrackManager access
const sigintFeed = new SigintFeed();
const decoySim = new DecoySim(sigintFeed, opsLog);
const hudController = new HUDController();
const trackManager = new TrackManager(mapEngine.overlayGroup);
const domController = new DOMController(trackManager, opsLog);
const drawController = new DrawController(mapEngine.scene, mapEngine.overlayGroup);
const splatController = new SplatController(mapEngine.scene, mapEngine.overlayGroup);

opsLog.setExportContext(() => ({
    store,
    mapEngine,
    trackManager,
    sigintFeed,
    decoySim,
    hudController,
    domController,
    drawController,
    splatController
}));

// Logic: Interactions
const raycaster = new THREE.Raycaster();
const mClick = new THREE.Vector2();
const SPATIAL_CONE_RADIUS = 12.0;

function getTrackFromObject(object) {
    let current = object;
    while (current) {
        if (current.userData && current.userData.track) return current.userData.track;
        current = current.parent;
    }
    return null;
}

window.addEventListener('mousedown', e => {
    if(store.get('pendingDesignation')) return;
    if(e.target.closest('#hud .panel') || e.target.closest('#skin-toggle') || e.target.closest('#confirm-strip') || e.target.closest('#undo-strip') || e.target.closest('.drawer-toggle')) return;
    hudController.closeDrawers();
    
    mClick.x = (e.clientX / window.innerWidth) * 2 - 1;
    mClick.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mClick, mapEngine.camera);
    
    // Draw Mode Intercept
    if(drawController.isDrawing) {
        const mapHits = raycaster.intersectObject(mapEngine.mapMesh);
        if(mapHits.length > 0) {
            const localPoint = mapEngine.overlayGroup.worldToLocal(mapHits[0].point.clone());
            drawController.addPoint(localPoint);
        }
        return; // Prevent normal map interactions while drawing
    }

    const mapHits = raycaster.intersectObject(mapEngine.mapMesh);
    const selectedTrackId = store.get('selectedTrackId');
    if(mapHits.length > 0 && !selectedTrackId && !domController.destinationMode) {
        const localPoint = mapEngine.overlayGroup.worldToLocal(mapHits[0].point.clone());
        const autoSelectedTrackId = trackManager.resolveSpatialConeSelection(localPoint.x, -localPoint.z);
        if (autoSelectedTrackId) {
            domController.selectTrack(autoSelectedTrackId);
            return;
        }
    }

    const trackHits = raycaster.intersectObjects(trackManager.getTrackMeshes(), false);
    if(trackHits.length > 0) {
        const hit = trackHits[0];
        const trackId = trackManager.getTrackIdFromHit(hit);
        if (trackId) {
            domController.selectTrack(trackId);
            return;
        }
    }

    if(mapHits.length > 0 && selectedTrackId) {
        const p = mapHits[0].point;
        if(domController.destinationMode) {
            const mgrsE = Math.floor(48250 + p.x * 50);
            const mgrsN = Math.floor(17530 + (-p.z) * 50);
            const mgrsString = `38TLN ${String(mgrsE).padStart(5,'0')} ${String(mgrsN).padStart(5,'0')}`;
            
            trackManager.setDestination(selectedTrackId, { x: p.x, y: -(p.z), mgrs: mgrsString });
            opsLog.addEntry('DESTINATION', selectedTrackId, `SET TO ${mgrsString}`);
            
            domController.destinationMode = false;
            domController.setDestinationButtonEl.classList.remove('active');
            domController.setDestinationButtonEl.textContent = 'SET DEST';
            
            const track = trackManager.getTrackById(selectedTrackId);
            if(track) domController.updateActiveTrackPanel(track);
            return;
        }

        const mx = p.x;
        const mgrsE = Math.floor(48250 + mx * 50);
        const mgrsN = Math.floor(17530 + (-p.z) * 50);
        const mgrsString = `38TLN ${String(mgrsE).padStart(5,'0')} ${String(mgrsN).padStart(5,'0')}`;

        if (!domController.canInitiateStrike(selectedTrackId)) {
            return;
        }
        
        store.set('pendingDesignation', { x: p.x, z: p.z, mgrs: mgrsString, trackId: selectedTrackId });
        domController.confirmStrip.style.display = 'flex';
        domController.confirmStrip.style.left = e.clientX + 'px';
        domController.confirmStrip.style.top = e.clientY + 'px';
        domController.confirmTarget.textContent = `${selectedTrackId} @ ${mgrsString}`;
        domController.setDesignationStage(1);
        
        const prov = trackManager.getProvenance(selectedTrackId);
        if(prov && prov.confidence === 'LOW') {
            domController.reasonSelect.style.display = 'block';
            domController.reasonSelect.value = "VISUAL_CORROBORATION";
        } else {
            domController.reasonSelect.style.display = 'none';
        }
        return;
    }
    
    if(mapHits.length > 0 && !selectedTrackId) {
        const p = mapHits[0].point;
        mapEngine.explosions[window.expIdx || 0].set(p.x, p.z, 0.01);
        window.expIdx = ((window.expIdx || 0) + 1) % 8;
    }
});

window.addEventListener('mousemove', e => {
    if(e.target.closest('#hud .panel') || e.target.closest('#skin-toggle') || e.target.closest('#confirm-strip') || e.target.closest('#undo-strip') || e.target.closest('.drawer-toggle')) {
        trackManager.clearSpatialConeFocus();
        return;
    }

    mClick.x = (e.clientX / window.innerWidth) * 2 - 1;
    mClick.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mClick, mapEngine.camera);
    
    const mapHits = raycaster.intersectObject(mapEngine.mapMesh);
    if(mapHits.length > 0) {
        const localPoint = mapEngine.overlayGroup.worldToLocal(mapHits[0].point.clone());
        const cursorX = localPoint.x;
        const cursorY = -localPoint.z;
        trackManager.setSpatialConeFocus(cursorX, cursorY, cursorX, cursorY, SPATIAL_CONE_RADIUS);
        if(drawController.isDrawing) {
            drawController.updatePreview(localPoint);
        }
        return;
    }

    trackManager.clearSpatialConeFocus();
});

// Setup hook inside commitDesignation 
// (We should wrap the original logic to also set explosion)
const originalCommit = domController.commitDesignation.bind(domController);
domController.commitDesignation = function() {
    const pending = store.get('pendingDesignation');
    const committed = originalCommit();
    if(committed && pending) {
        mapEngine.explosions[window.expIdx || 0].set(pending.x, pending.z, 0.01);
        window.expIdx = ((window.expIdx || 0) + 1) % 8;
    }
    return committed;
}

// Logic: Keyboard
window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    const undoDesignation = store.get('undoDesignation');
    if(undoDesignation && key === 'u') {
        e.preventDefault();
        domController.undoLastDesignation();
        return;
    }

    const pending = store.get('pendingDesignation');
    if(pending) {
        const tag = document.activeElement && document.activeElement.tagName ? document.activeElement.tagName.toLowerCase() : '';
        if(tag === 'input' || tag === 'textarea') return;
        if(tag === 'select' && e.key !== 'Escape') return;

        if(e.key === 'Escape') {
            store.set('pendingDesignation', null);
            domController.hideConfirmStrip();
            return;
        }

        const stage = store.get('pendingDesignationStage');
        if(stage === 1 && (key === 'r' || e.key === 'Enter')) {
            e.preventDefault();
            domController.setDesignationStage(2);
            return;
        }

        if(stage === 2 && e.key === 'Enter') {
            e.preventDefault();
            domController.commitDesignation();
        }
        return;
    }

    const tag = document.activeElement && document.activeElement.tagName ? document.activeElement.tagName.toLowerCase() : '';
    if(tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if(e.key === 'ArrowDown') {
        e.preventDefault();
        selectRelativeTrack(1);
        return;
    }
    if(e.key === 'ArrowUp') {
        e.preventDefault();
        selectRelativeTrack(-1);
        return;
    }
    if(key === 'd') {
        e.preventDefault();
        store.set('isCompactHud', !store.get('isCompactHud'));
        return;
    }
    if(key === 'h') {
        e.preventDefault();
        store.set('isHighContrast', !store.get('isHighContrast'));
        return;
    }
    if(key === 'm') {
        e.preventDefault();
        store.set('reduceMotion', !store.get('reduceMotion'));
        return;
    }
    if(key === '[') {
        e.preventDefault();
        hudController.toggleDrawer('left');
        return;
    }
    if(key === ']') {
        e.preventDefault();
        hudController.toggleDrawer('right');
        return;
    }
    if(e.key === 'Escape') {
        hudController.closeDrawers();
    }
});

function selectRelativeTrack(step) {
    const trackData = trackManager.getTrackData();
    if(trackData.length === 0) return;
    const selectedId = store.get('selectedTrackId');
    const idx = trackData.findIndex(t => t.id === selectedId);
    const base = idx === -1 ? 0 : idx;
    const next = (base + step + trackData.length) % trackData.length;
    domController.selectTrack(trackData[next].id);
}

// Logic: Animate
let lastFrameTs = 0;
let lastHiddenRenderTs = 0;
let lastEnvSyncTs = 0;
const compassNeedle = document.getElementById('compass-needle');

function animate(ts) {
    requestAnimationFrame(animate);
    if(lastFrameTs === 0) lastFrameTs = ts;
    const dt = Math.min((ts - lastFrameTs) / 1000, 0.1);
    lastFrameTs = ts;

    if(document.hidden && ts - lastHiddenRenderTs < 160) return;
    if(document.hidden) lastHiddenRenderTs = ts;

    // 1Hz Environment Sync (Pheromone Logic)
    if (ts - lastEnvSyncTs >= 1000) {
        lastEnvSyncTs = ts;
        const targets = trackManager.getTrackData()
            .filter(t => t.type === 'friendly')
            .map(t => ({ x: t.x, y: t.y }));
        
        // Match UI engagement zones panel
        const threats = [
            { x: -15.0, y: 20.0, radius: 15.0 }, // SAM-1
            { x: 30.0, y: -25.0, radius: 35.0 }  // SAM-2
        ];
        
        if (trackManager.opforWorker) {
            trackManager.opforWorker.postMessage({
                type: 'SYNC_ENV',
                targets,
                threats
            });
        }
    }

    const reduceMotion = store.get('reduceMotion');
    const motionScale = reduceMotion ? 0.45 : 1.0;
    const effectiveMotion = (document.hidden ? 0.25 : 1.0) * motionScale;
    
    // update simTime
    const simTime = store.get('simTime') + dt * effectiveMotion;
    store.set('simTime', simTime);
    const t = simTime;

    const targetSkin = store.get('skinMode');
    const targetMap = store.get('mapMode');
    mapEngine.uniforms.time.value = t;
    mapEngine.uniforms.uSkinMode.value = THREE.MathUtils.lerp(mapEngine.uniforms.uSkinMode.value, targetSkin, 0.04);
    mapEngine.uniforms.uMapMode.value = THREE.MathUtils.lerp(mapEngine.uniforms.uMapMode.value, targetMap, 0.08);
    const skinVal = mapEngine.uniforms.uSkinMode.value;

    const activeTrackPanel = document.getElementById('active-track-panel');
    const opsLogPanel = document.getElementById('ops-log-panel');
    if(activeTrackPanel) activeTrackPanel.style.opacity = (1 - skinVal).toFixed(2);
    if(opsLogPanel) opsLogPanel.style.opacity = (1 - skinVal).toFixed(2);

    mapEngine.overlayGroup.traverse(child => {
        if(child.material) {
            if(child.userData.baseOp === undefined) {
                child.userData.baseOp = child.material.opacity;
                child.material.transparent = true;
            }
            
            let finalOpacity = child.userData.baseOp * (1 - skinVal);
            
            // Fade out drawn polygons when in FLAT map mode
            if (child.parent && child.parent.userData.isTerrainFeature) {
                finalOpacity *= mapEngine.uniforms.uMapMode.value;
            }
            
            child.material.opacity = finalOpacity;
        }
    });

    for(let i = 0; i < 8; i++) {
        if(mapEngine.explosions[i].z > 0) {
            mapEngine.explosions[i].z += 0.008;
            if(mapEngine.explosions[i].z > 1) mapEngine.explosions[i].z = 0;
        }
    }

    mapEngine.radarMesh.rotation.z -= 0.015 * Math.max(effectiveMotion, 0.08);

    const selectedTrackId = store.get('selectedTrackId');
    const reconMode = store.get('reconMode');
    
    trackManager.animateTracks(t, skinVal, effectiveMotion, selectedTrackId);
    domController.update();
    splatController.animate(t, trackManager, mapEngine.camera);

    const camAngle = t * 0.06;
    
    // Camera Logic
    if (reconMode && splatController.isActive && splatController.targetPos) {
        // Zoom in to tracking view
        const target = splatController.targetPos;
        mapEngine.camera.position.lerp(new THREE.Vector3(target.x + Math.sin(t*0.5)*8, 12, target.z + Math.cos(t*0.5)*8), 0.04);
        mapEngine.camera.lookAt(target);
        
        mapEngine.uniforms.uMapMode.value = THREE.MathUtils.lerp(mapEngine.uniforms.uMapMode.value, 0.0, 0.1); // flatten terrain
    } else {
        // Macro view
        mapEngine.camera.position.lerp(new THREE.Vector3(Math.sin(camAngle) * 6 + Math.sin(t * 1.7) * 0.15, 45 + Math.sin(t * 0.4) * 1.5, 33 + Math.cos(camAngle * 0.8) * 4), 0.04);
        mapEngine.camera.lookAt(Math.sin(t * 0.08) * 2, 0, Math.cos(t * 0.06) * 2);
    }
    
    const heading = (camAngle * 180 / Math.PI) % 360;
    if(compassNeedle) compassNeedle.style.transform = `translate(-50%, -100%) rotate(${-heading}deg)`;

    // Post-processing overrides based on skin
    mapEngine.bloomPass.strength = 1.5 * (1 - skinVal);
    mapEngine.filmPass.uniforms.nIntensity.value = 1.2 * skinVal;
    mapEngine.filmPass.uniforms.sIntensity.value = 1.8 * skinVal;

    mapEngine.composer.render();
}

window.addEventListener('resize', () => {
    mapEngine.camera.aspect = window.innerWidth / window.innerHeight;
    mapEngine.camera.updateProjectionMatrix();
    mapEngine.renderer.setSize(window.innerWidth, window.innerHeight);
    mapEngine.composer.setSize(window.innerWidth, window.innerHeight);
    if(window.innerWidth > 1100) hudController.closeDrawers();
});

requestAnimationFrame(animate);
