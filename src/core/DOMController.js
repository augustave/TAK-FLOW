import { store } from './Store.js';

export class DOMController {
    constructor(trackManager, opsLog) {
        this.trackManager = trackManager;
        this.opsLog = opsLog;

        this.confirmStrip = document.getElementById('confirm-strip');
        this.confirmTitle = document.getElementById('confirm-title');
        this.confirmTarget = document.getElementById('confirm-target');
        this.confirmHint = document.getElementById('confirm-hint');
        this.reasonSelect = document.getElementById('confirm-reason');
        this.confirmButton = document.getElementById('btn-confirm');
        this.cancelButton = document.getElementById('btn-cancel');
        
        this.undoStrip = document.getElementById('undo-strip');
        this.undoText = document.getElementById('undo-text');
        this.undoButton = document.getElementById('btn-undo');
        
        this.activeTrackPanelEl = document.getElementById('active-track-panel');
        this.trackLogCountEl = document.getElementById('track-count');
        this.atLockStatusEl = document.getElementById('at-lock-status');
        this.atDestinationEl = document.getElementById('at-destination');
        this.setDestinationButtonEl = document.getElementById('btn-set-destination');
        this.clearDestinationButtonEl = document.getElementById('btn-clear-destination');
        this.reconConfirmBtn = document.getElementById('btn-recon-confirm');
        this.reconAbortBtn = document.getElementById('btn-recon-abort');
        
        // PRD: Track Log Filtering & Sorting State
        this.filterSearch = '';
        this.filterThreat = 'ALL';
        this.sortKey = 'id';
        this.sortDir = 1; // 1 = asc, -1 = desc
        
        this.tbody = document.getElementById('track-tbody');

        // Phase 12 Telemetry DOM
        this.domPol = document.getElementById('kinematics-polarization');
        this.barPol = document.getElementById('bar-polarization');
        this.domMill = document.getElementById('kinematics-milling');
        this.barMill = document.getElementById('bar-milling');
        this.domCoh = document.getElementById('kinematics-cohesion');
        this.barCoh = document.getElementById('bar-cohesion');
        this.kinematicsBadge = document.getElementById('kinematics-badge');
        this.recommendedActionsPanelEl = document.getElementById('recommended-actions-panel');
        this.recommendedActionsBadgeEl = document.getElementById('rec-actions-badge');
        this.recDecoyCardEl = document.getElementById('rec-decoy-card');
        this.recVjepaCardEl = document.getElementById('rec-vjepa-card');
        this.recExecuteBtnEl = document.getElementById('btn-rec-execute');
        this.decoySimPanelEl = document.getElementById('decoy-sim-panel');

        this.cursorCoords = document.getElementById('cursor-coords');
        this.cursorMgrs = document.getElementById('cursor-mgrs');
        this.alertDotEl = document.getElementById('alert-dot');
        this.alertTextEl = document.getElementById('alert-text');

        this.undoTimeoutId = null;
        this.destinationMode = false;
        this.provenanceFlashIntervalId = null;
        this.provenanceFlashTimeoutId = null;
        this.vjepaWarningActive = false;
        this.vjepaWarningLogged = false;
        // Make clearUndoWindow globally available for OpsLog clear
        window.clearUndoWindow = () => this.clearUndoWindow();

        this.initDOMListeners();
        this.updateTrackTable();
        
        // Simulating the loading of the AlphaEarth foundation model 64-D embedding tensor
        setTimeout(() => {
            this.opsLog.addEntry('SYSTEM', 'ALPHAEARTH', '64-D EMBEDDING TENSOR LOADED. RESOLUTION: 10M.', 0, 999);
            const aeBadge = document.getElementById('alphaearth-badge');
            if (aeBadge) {
                aeBadge.textContent = 'SYNCED';
                aeBadge.className = 'panel-badge badge-live';
            }
        }, 2000);

        setInterval(() => {
            const selectedId = store.get('selectedTrackId');
            if(selectedId && !document.hidden) {
                const track = this.trackManager.getTrackById(selectedId);
                if(track) this.updateActiveTrackPanel(track);
            }
        }, 1000);
    }

    initDOMListeners() {
        this.setDestinationButtonEl?.addEventListener('click', () => {
            const selectedId = store.get('selectedTrackId');
            if(!selectedId) {
                this.opsLog.addEntry('MODE', 'SYSTEM', 'DEST MODE REQUIRES TRACK SELECT');
                return;
            }
            this.destinationMode = !this.destinationMode;
            this.setDestinationButtonEl.classList.toggle('active', this.destinationMode);
            this.setDestinationButtonEl.textContent = this.destinationMode ? 'CLICK MAP...' : 'SET DEST';
        });

        // Search Input
        const searchInput = document.getElementById('track-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterSearch = e.target.value.toLowerCase();
                this.updateTrackTable();
            });
        }
        
        // Threat Filter
        const threatFilter = document.getElementById('track-filter');
        if (threatFilter) {
            threatFilter.addEventListener('change', (e) => {
                this.filterThreat = e.target.value;
                this.updateTrackTable();
            });
        }
        
        // Sort Headers
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.getAttribute('data-sort');
                if (this.sortKey === key) {
                    this.sortDir *= -1; // toggle direction
                } else {
                    this.sortKey = key;
                    this.sortDir = 1;
                }
                
                // Update Carets
                document.querySelectorAll('th[data-sort]').forEach(h => {
                    const text = h.textContent.replace(' ▾', '').replace(' ▴', '');
                    if (h === th) {
                        h.textContent = this.sortDir === 1 ? `${text} ▾` : `${text} ▴`;
                    } else {
                        h.textContent = `${text} ▾`;
                    }
                });
                
                this.updateTrackTable();
            });
        });

        // Instructor Scenario Loading
        const btnScenarioLoad = document.getElementById('btn-scenario-load');
        if (btnScenarioLoad) {
            btnScenarioLoad.addEventListener('click', () => {
                const profile = document.getElementById('scenario-profile-select').value;
                this.trackManager.resetScenario(profile);
                this.opsLog.addEntry('MODE', 'INSTRUCTOR', `FORCED SCENARIO PROFILE: [${profile.toUpperCase()}]`);
                this.updateTrackTable();
            });
        }
        
        const btnScenarioClear = document.getElementById('btn-scenario-clear');
        if (btnScenarioClear) {
            btnScenarioClear.addEventListener('click', () => {
                this.trackManager.resetScenario('clear');
                this.opsLog.addEntry('MODE', 'SYSTEM', 'SCENARIO CLEARED (OPERATOR STANDBY)');
                this.updateTrackTable();
            });
        }

        const btnRecon = document.getElementById('btn-recon');
        btnRecon.addEventListener('click', () => {
            const selectedId = store.get('selectedTrackId');
            if(!selectedId) {
                this.opsLog.addEntry('MODE', 'SYSTEM', 'RECON MODE REQUIRES TRACK SELECT');
                return;
            }
            const isRecon = !store.get('reconMode');
            store.set('reconMode', isRecon);
            
            if (isRecon) {
                // 1.5s Tasking Delay
                this.opsLog.addEntry('MODE', '3DGS', `[ISR] TASKING OVERHEAD ASSET TO GRID...`);
                btnRecon.textContent = 'TASKING...';
                btnRecon.disabled = true;
                btnRecon.style.background = 'var(--panel-bg)';
                btnRecon.style.color = 'var(--text-dim)';
                
                setTimeout(() => {
                    const track = this.trackManager.getTrackById(selectedId);
                    // Crucial: Only reveal the splat and buttons if the user hasn't selected another track mid-delay
                    if (track && store.get('selectedTrackId') === selectedId) {
                        const radius = track.subtype === 'SWARM CENTROID' ? 10.0 : 4.0;
                        this.trackManager.generateReconSplat(track.x, track.y, radius);
                        
                        // Mutate Panel Buttons
                        btnRecon.style.display = 'none';
                        if(this.setDestinationButtonEl) this.setDestinationButtonEl.style.display = 'none';
                        if(this.clearDestinationButtonEl) this.clearDestinationButtonEl.style.display = 'none';
                        if(this.reconConfirmBtn) this.reconConfirmBtn.style.display = 'block';
                        if(this.reconAbortBtn) this.reconAbortBtn.style.display = 'block';
                    }
                }, 1500);

            } else {
                this.deactivateRecon(selectedId);
            }
        });
        
        if (this.reconConfirmBtn) {
            this.reconConfirmBtn.addEventListener('click', () => {
                const selectedId = store.get('selectedTrackId');
                if(!selectedId) return;
                
                this.opsLog.addEntry('INTEL', selectedId, `VISUAL PROVENANCE CONFIRMED. WEAPONS RELEASE AUTHORIZED.`);
                store.set('reconMode', false);
                this.trackManager.opforWorker.postMessage({ type: 'FORCE_CONFIDENCE', id: selectedId, value: 1.0 });
                this.deactivateRecon(selectedId);
                
                // Re-eval lock status now that confidence is forced to 1.0
                const track = this.trackManager.getTrackById(selectedId);
                if(track) this.updateActiveTrackPanel(track);
            });
        }

        if (this.reconAbortBtn) {
            this.reconAbortBtn.addEventListener('click', () => {
                const selectedId = store.get('selectedTrackId');
                if(!selectedId) return;
                
                this.opsLog.addEntry('INTEL', selectedId, `TARGET UNVERIFIED. STRIKE ABORTED.`);
                store.set('reconMode', false);
                this.deactivateRecon(selectedId);
            });
        }

        this.clearDestinationButtonEl?.addEventListener('click', () => {
            const selectedId = store.get('selectedTrackId');
            if(!selectedId) return;
            if(this.trackManager.clearDestination(selectedId)) {
                this.opsLog.addEntry('DESTINATION', selectedId, 'CLEARED');
                this.updateTrackTable();
                
                const track = this.trackManager.getTrackById(selectedId);
                if(track) this.updateActiveTrackPanel(track);
                store.set('selectedTrackId', selectedId); // Force re-render of visuals
            }
            this.destinationMode = false;
            this.setDestinationButtonEl.classList.remove('active');
            this.setDestinationButtonEl.textContent = 'SET DEST';
        });

        this.confirmButton?.addEventListener('click', () => {
            if(!store.get('pendingDesignation')) return;
            if(store.get('pendingDesignationStage') === 1) {
                this.setDesignationStage(2);
                return;
            }
            this.commitDesignation();
        });

        this.cancelButton?.addEventListener('click', () => {
            store.set('pendingDesignation', null);
            this.hideConfirmStrip();
        });

        this.undoButton?.addEventListener('click', () => this.undoLastDesignation());

        const btnMap = document.getElementById('btn-map');
        if(btnMap) {
            btnMap.addEventListener('click', () => {
                const isTopo = store.get('mapMode') === 1;
                store.set('mapMode', isTopo ? 0 : 1);
                btnMap.textContent = isTopo ? 'MAP: FLAT' : 'MAP: TOPO';
                btnMap.classList.toggle('active', !isTopo);
            });
        }

        if (this.recVjepaCardEl) {
            this.recVjepaCardEl.addEventListener('mouseenter', () => this.setVjepaHover(true));
            this.recVjepaCardEl.addEventListener('mouseleave', () => this.setVjepaHover(false));
            this.recVjepaCardEl.addEventListener('focus', () => this.setVjepaHover(true));
            this.recVjepaCardEl.addEventListener('blur', () => this.setVjepaHover(false));
        }

        this.recExecuteBtnEl?.addEventListener('click', () => this.executeVjepaReconMacro());

        document.addEventListener('mousemove', e => {
            if(!this.cursorCoords || !this.cursorMgrs) return;
            const mx = ((e.clientX / window.innerWidth) * 2 - 1) * 40;
            const my = (-(e.clientY / window.innerHeight) * 2 + 1) * 40;
            this.cursorCoords.textContent = `${mx.toFixed(2).padStart(7, ' ')} / ${my.toFixed(2).padStart(7, ' ')}`;
            const mgrsE = Math.floor(48250 + mx * 50);
            const mgrsN = Math.floor(17530 + my * 50);
            this.cursorMgrs.textContent = `38TLN ${String(mgrsE).padStart(5,'0')} ${String(mgrsN).padStart(5,'0')}`;
        });
    }

    selectTrack(id) {
        if(store.get('selectedTrackId') === id) return;
        store.set('selectedTrackId', id);
        store.set('reconMode', false);
        this.deactivateRecon(id);
        
        const track = this.trackManager.getTrackById(id);
        if(track) {
            const prov = this.trackManager.getProvenance(id);
            this.opsLog.addEntry('SELECT', id, `TYPE:${track.subtype} SRC:${prov.source}`);
            this.updateActiveTrackPanel(track);
        } else {
            this.updateActiveTrackPanel(null);
        }
        
        this.trackManager.updateSelectionVisuals(id);
        this.updateTrackTable();
    }

    deactivateRecon(trackId) {
        const btnRecon = document.getElementById('btn-recon');
        if (btnRecon) {
            btnRecon.disabled = false;
            btnRecon.style.display = 'block';
            btnRecon.textContent = 'RECON [3DGS]';
            btnRecon.style.background = 'var(--amber-alert)';
            btnRecon.style.color = '#000';
        }
        
        if (this.setDestinationButtonEl) this.setDestinationButtonEl.style.display = 'block';
        if (this.clearDestinationButtonEl) this.clearDestinationButtonEl.style.display = 'block';
        if (this.reconConfirmBtn) this.reconConfirmBtn.style.display = 'none';
        if (this.reconAbortBtn) this.reconAbortBtn.style.display = 'none';
        
        if (this.trackManager) {
            this.trackManager.hideReconSplat();
        }
    }

    updateActiveTrackPanel(track) {
        if(!this.activeTrackPanelEl) return;
        if(!track) {
            this.activeTrackPanelEl.style.display = 'none';
            this.activeTrackPanelEl.classList.remove('track-locked');
            this.atLockStatusEl.textContent = 'STANDBY';
            this.atDestinationEl.textContent = '--';
            this.setDestinationButtonEl.disabled = true;
            this.clearDestinationButtonEl.disabled = true;
            this.destinationMode = false;
            store.set('reconMode', false);
            store.set('pendingDesignation', null);
            this.hideConfirmStrip();
            this.clearUndoWindow();
            this.setDestinationButtonEl.classList.remove('active');
            this.setDestinationButtonEl.textContent = 'SET DEST';
            this.deactivateRecon(null);
            return;
        }

        this.activeTrackPanelEl.style.display = 'block';
        this.activeTrackPanelEl.classList.add('track-locked');
        this.setDestinationButtonEl.disabled = false;
        this.clearDestinationButtonEl.disabled = false;
        
        const prov = this.trackManager.getProvenance(track.id);
        const confidenceScore = this.trackManager.getTrackConfidenceScore(track.id);
        document.getElementById('at-id').textContent = track.id + ' / ' + track.subtype;
        
        let isEmcon = false;
        let emconRadius = 0;
        let emconConfidence = confidenceScore;
        
        if (this.trackManager.latestEmconMetadata) {
            const emconData = this.trackManager.latestEmconMetadata.find(e => 
                e.id === track.id ||
                e.realId === track.id
            );
            if (emconData) {
                isEmcon = true;
                emconRadius = emconData.radius;
                emconConfidence = emconData.confidence;
            }
        }
        const isGhost = track.id.startsWith('GHOST-');
        
        if (isGhost) {
            document.getElementById('at-kinematics').textContent = `[ SIGINT GHOST ] ERRATIC / UNVERIFIED`;
            document.getElementById('at-source').textContent = 'ELINT-ESM';
            
            const confEl = document.getElementById('at-confidence');
            confEl.textContent = `${Math.round(confidenceScore * 100)}% / UNVERIFIED`;
            confEl.className = 'data-value red';
            
            const ageEl = document.getElementById('at-age');
            ageEl.textContent = '--';
            ageEl.className = 'data-value red';
            
            const badgeEl = document.getElementById('at-provenance-badge');
            badgeEl.textContent = 'ZERO-TRUST';
            badgeEl.className = 'panel-badge badge-alert';
            
            this.atLockStatusEl.textContent = 'RECON REQUIRED';
            this.atLockStatusEl.className = 'data-value amber';
        } else if (isEmcon) {
            document.getElementById('at-kinematics').textContent = `[ PROBABILISTIC / EMCON ] R: ${emconRadius.toFixed(2)}km`;
            document.getElementById('at-source').textContent = 'EXTRAPOLATED';
            
            const confEl = document.getElementById('at-confidence');
            confEl.textContent = `${Math.round(emconConfidence * 100)}% / DEGRADED`;
            confEl.className = `data-value ${emconConfidence < 0.2 ? 'red' : 'amber'}`;
            
            const ageEl = document.getElementById('at-age');
            ageEl.textContent = '--';
            ageEl.className = 'data-value amber';
            
            const badgeEl = document.getElementById('at-provenance-badge');
            badgeEl.textContent = 'EMCON ALERT';
            badgeEl.className = 'panel-badge badge-alert';
            
            this.atLockStatusEl.textContent = 'DATALINK SEVERED';
            this.atLockStatusEl.className = 'data-value amber';
        } else {
            const brg = (Math.atan2(track.x, track.y) * 180 / Math.PI + 360) % 360;
            const rng = Math.sqrt(track.x * track.x + track.y * track.y).toFixed(1);
            document.getElementById('at-kinematics').textContent = `${brg.toFixed(0).padStart(3,'0')}° / ${rng}km / ${track.spd}kt`;
            document.getElementById('at-source').textContent = prov.source;
            
            const confEl = document.getElementById('at-confidence');
            confEl.textContent = prov.confidence;
            confEl.className = 'data-value ' + (prov.confidence === 'HIGH' ? 'green' : (prov.confidence === 'MEDIUM' ? 'amber' : 'red'));
            
            const ageSeconds = Math.floor((Date.now() - prov.lastUpdate) / 1000);
            const ageEl = document.getElementById('at-age');
            ageEl.textContent = ageSeconds + 's';
            
            const badgeEl = document.getElementById('at-provenance-badge');
            if(ageSeconds > 120) {
                ageEl.textContent += ' [STALE]';
                ageEl.className = 'data-value red';
                badgeEl.textContent = 'STALE';
                badgeEl.className = 'panel-badge badge-alert';
                this.atLockStatusEl.textContent = 'LOCK / STALE';
                this.atLockStatusEl.className = 'data-value amber';
            } else {
                ageEl.className = 'data-value';
                badgeEl.textContent = 'TRACKING';
                badgeEl.className = 'panel-badge badge-nominal';
                this.atLockStatusEl.textContent = 'LOCKED ON';
                this.atLockStatusEl.className = 'data-value cyan';
            }
        }

        const dest = this.trackManager.getDestination(track.id);
        this.atDestinationEl.textContent = dest ? dest.mgrs : '--';
    }

    updateTrackTable() {
        if(!this.tbody) return;
        this.tbody.replaceChildren();
        
        const selectedTrackId = store.get('selectedTrackId');
        
        let tracks = this.trackManager.getTrackData();
        
        // Filter by Threat
        if (this.filterThreat !== 'ALL') {
            if (this.filterThreat === 'HIGH') {
                tracks = tracks.filter(t => t.type === 'hostile');
            } else if (this.filterThreat === 'MEDIUM') {
                tracks = tracks.filter(t => t.type === 'unknown');
            } else if (this.filterThreat === 'LOW') {
                tracks = tracks.filter(t => t.type === 'friendly');
            }
        }
        
        // Filter by Search (ID or Type)
        if (this.filterSearch !== '') {
            tracks = tracks.filter(t => 
                t.id.toLowerCase().includes(this.filterSearch) || 
                t.subtype.toLowerCase().includes(this.filterSearch)
            );
        }
        
        // Sort
        tracks.sort((a, b) => {
            let valA, valB;
            switch(this.sortKey) {
                case 'id': valA = a.id; valB = b.id; break;
                case 'type': valA = a.subtype; valB = b.subtype; break;
                case 'brg':
                    valA = (Math.atan2(a.x, a.y) * 180 / Math.PI + 360) % 360;
                    valB = (Math.atan2(b.x, b.y) * 180 / Math.PI + 360) % 360;
                    break;
                case 'rng': 
                    valA = Math.sqrt(a.x*a.x + a.y*a.y); 
                    valB = Math.sqrt(b.x*b.x + b.y*b.y); 
                    break;
                case 'spd': valA = a.spd; valB = b.spd; break;
                default: valA = a.id; valB = b.id;
            }
            if(valA < valB) return -1 * this.sortDir;
            if(valA > valB) return 1 * this.sortDir;
            return 0;
        });
        
        this.trackLogCountEl.textContent = `${tracks.length} ACTIVE`;
        
        tracks.forEach(t => {
            const iconClass = t.type === 'hostile' ? 'hostile' : t.type === 'friendly' ? 'friendly' : 'unknown';
            const color = t.type === 'hostile' ? 'var(--red-force)' : t.type === 'friendly' ? 'var(--blue-force)' : 'var(--yellow-unknown)';
            const brg = (Math.atan2(t.x, t.y) * 180 / Math.PI + 360) % 360;
            const rng = Math.sqrt(t.x * t.x + t.y * t.y).toFixed(1);
            
            const prov = this.trackManager.getProvenance(t.id);
            const ageSeconds = Math.floor((Date.now() - prov.lastUpdate) / 1000);
            const confClass = prov.confidence === 'HIGH' ? 'trust-high' : (prov.confidence === 'MEDIUM' ? 'trust-medium' : 'trust-low');
            
            const row = document.createElement('tr');
            const isSelected = t.id === selectedTrackId;
            row.className = isSelected ? 'track-selected' : '';
            row.style.cursor = 'pointer';
            row.tabIndex = 0;
            
            row.onclick = () => {
                this.selectTrack(t.id);
                document.body.classList.remove('left-drawer-open');
                document.body.classList.remove('right-drawer-open');
            };
            row.onkeydown = (e) => {
                if(e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectTrack(t.id);
                }
            };

            const idCell = document.createElement('td');
            idCell.style.color = color;
            const icon = document.createElement('span');
            icon.className = `track-icon ${iconClass}`;
            idCell.appendChild(icon);
            idCell.appendChild(document.createTextNode(t.id));
            if(isSelected) {
                const pin = document.createElement('span');
                pin.className = 'track-lock-pin';
                pin.textContent = 'LOCK';
                idCell.appendChild(pin);
            }

            const subtypeCell = document.createElement('td');
            subtypeCell.textContent = t.subtype;
            const bearingCell = document.createElement('td');
            bearingCell.textContent = `${brg.toFixed(0).padStart(3,'0')}°`;
            const rangeCell = document.createElement('td');
            rangeCell.textContent = `${rng}km`;
            const speedCell = document.createElement('td');
            speedCell.textContent = String(t.spd);

            const trustCell = document.createElement('td');
            const trustWrap = document.createElement('span');
            trustWrap.className = 'track-trust-wrap';
            const confBadge = document.createElement('span');
            confBadge.className = `track-trust-badge ${confClass}`;
            confBadge.textContent = prov.confidence;
            const ageBadge = document.createElement('span');
            ageBadge.className = `track-age-badge ${ageSeconds > 120 ? 'stale' : ''}`;
            ageBadge.textContent = `${ageSeconds}s`;
            trustWrap.appendChild(confBadge);
            trustWrap.appendChild(ageBadge);
            trustCell.appendChild(trustWrap);

            row.appendChild(idCell);
            row.appendChild(subtypeCell);
            row.appendChild(bearingCell);
            row.appendChild(rangeCell);
            row.appendChild(speedCell);
            row.appendChild(trustCell);
            this.tbody.appendChild(row);
        });
    }

    setDesignationStage(stage) {
        store.set('pendingDesignationStage', stage);
        if(!store.get('pendingDesignation')) return;
        
        if (stage === 1) {
            this.confirmTitle.textContent = 'REVIEW DESIGNATION';
            this.confirmHint.textContent = 'R OR ENTER TO ARM';
            this.confirmButton.textContent = 'REVIEW [R]';
            this.confirmStrip.style.borderColor = 'var(--amber-alert)';
        } else {
            this.confirmTitle.textContent = 'FINAL CONFIRMATION';
            this.confirmHint.textContent = 'ENTER TO COMMIT';
            this.confirmButton.textContent = 'COMMIT [ENTER]';
            this.confirmStrip.style.borderColor = 'var(--red-force)';
        }
    }

    hideConfirmStrip() {
        if(this.confirmStrip) {
            this.confirmStrip.style.display = 'none';
            this.confirmStrip.style.borderColor = 'var(--amber-alert)';
        }
        store.set('pendingDesignationStage', 0);
    }

    clearUndoWindow() {
        if (this.undoTimeoutId) {
            clearTimeout(this.undoTimeoutId);
            this.undoTimeoutId = null;
        }
        store.set('undoDesignation', null);
        if(this.undoStrip) this.undoStrip.style.display = 'none';
    }

    flashStrikeAbortWarning(message) {
        if (!this.alertTextEl || !this.alertDotEl) return;
        const prevText = this.alertTextEl.textContent;
        const prevTextColor = this.alertTextEl.style.color;
        const prevTextOpacity = this.alertTextEl.style.opacity;
        const prevDotColor = this.alertDotEl.style.background;
        const prevDotOpacity = this.alertDotEl.style.opacity;

        if (this.provenanceFlashIntervalId) clearInterval(this.provenanceFlashIntervalId);
        if (this.provenanceFlashTimeoutId) clearTimeout(this.provenanceFlashTimeoutId);

        this.alertTextEl.textContent = message;
        this.alertTextEl.style.color = 'var(--amber-alert)';
        this.alertDotEl.style.background = 'var(--amber-alert)';

        let flashTick = 0;
        this.provenanceFlashIntervalId = setInterval(() => {
            const isBright = flashTick % 2 === 0;
            this.alertTextEl.style.opacity = isBright ? '1' : '0.35';
            this.alertDotEl.style.opacity = isBright ? '1' : '0.35';
            flashTick++;
        }, 120);

        this.provenanceFlashTimeoutId = setTimeout(() => {
            if (this.provenanceFlashIntervalId) {
                clearInterval(this.provenanceFlashIntervalId);
                this.provenanceFlashIntervalId = null;
            }
            this.alertTextEl.textContent = prevText;
            this.alertTextEl.style.color = prevTextColor;
            this.alertTextEl.style.opacity = prevTextOpacity;
            this.alertDotEl.style.background = prevDotColor;
            this.alertDotEl.style.opacity = prevDotOpacity;
        }, 1800);
    }

    canInitiateStrike(trackId) {
        const confidence = this.trackManager.getTrackConfidenceScore(trackId);
        const reconOverride = Boolean(store.get('reconMode'));
        if (confidence >= 0.6 || reconOverride) return true;

        const warningMsg = '[ STRIKE ABORTED: INSUFFICIENT TRACK PROVENANCE. 3DGS RECON REQUIRED ]';
        this.flashStrikeAbortWarning(warningMsg);
        this.opsLog.addEntry('WARNING', trackId || 'SYSTEM', warningMsg, 1, 999);
        store.set('pendingDesignation', null);
        this.hideConfirmStrip();
        return false;
    }

    commitDesignation() {
        const pending = store.get('pendingDesignation');
        if(!pending) return false;
        if (!this.canInitiateStrike(pending.trackId)) return false;
        
        const reason = this.reasonSelect.style.display !== 'none' ? this.reasonSelect.value : 'N/A';
        const details = `AT ${pending.mgrs} ${reason !== 'N/A' ? 'R:'+reason : ''}`.trim();
        const entryNode = this.opsLog.addEntry('DESIGNATE', pending.trackId, details);

        this.clearUndoWindow();
        store.set('undoDesignation', { trackId: pending.trackId, details, entryNode });
        
        this.undoText.textContent = `DESIGNATED ${pending.trackId} @ ${pending.mgrs}`;
        this.undoStrip.style.display = 'flex';
        this.undoTimeoutId = setTimeout(() => this.clearUndoWindow(), 8000);

        store.set('pendingDesignation', null);
        this.hideConfirmStrip();
        return true;
    }

    undoLastDesignation() {
        const undoDesig = store.get('undoDesignation');
        if(!undoDesig) return;
        
        const logs = [...store.get('opsLog')];
        const idx = logs.findIndex(item => item.action === 'DESIGNATE' && item.target === undoDesig.trackId && item.details === undoDesig.details);
        if(idx !== -1) {
            logs.splice(idx, 1);
            store.set('opsLog', logs);
        }
        
        if(undoDesig.entryNode && undoDesig.entryNode.parentElement) {
            undoDesig.entryNode.parentElement.removeChild(undoDesig.entryNode);
        }
        
        this.opsLog.addEntry('MODE', 'SYSTEM', `DESIGNATION REVOKED ${undoDesig.trackId}`);
        this.clearUndoWindow();
    }

    isVjepaThreatAnxietyCondition(telemetry) {
        if (!telemetry) return false;
        return telemetry.cohesion <= 0.05 && telemetry.milling >= 0.40 && telemetry.activeCount > 100;
    }

    getVjepaAnchor(telemetry) {
        const com = telemetry?.com;
        if (!com || !Number.isFinite(com.x) || !Number.isFinite(com.y)) return null;
        return { x: com.x, y: com.y };
    }

    getVjepaScanRadius(telemetry) {
        const activeCount = Number(telemetry?.activeCount) || 0;
        return Math.max(10, Math.min(18, 8 + (activeCount * 0.04)));
    }

    setVjepaHover(active) {
        this.vjepaHoverActive = Boolean(active);
        this.syncVjepaCounterfactualOverlay();
    }

    syncVjepaCounterfactualOverlay() {
        if (!this.trackManager) return;
        if (this.vjepaWarningActive && this.vjepaHoverActive && this.vjepaAnchor) {
            this.trackManager.showCounterfactualScanZone(
                this.vjepaAnchor.x,
                this.vjepaAnchor.y,
                this.getVjepaScanRadius(this.trackManager.getSwarmTelemetry())
            );
            return;
        }
        this.trackManager.hideCounterfactualScanZone();
    }

    executeVjepaReconMacro() {
        if (!this.vjepaWarningActive || !this.vjepaAnchor || !this.trackManager) return;
        const telemetry = this.trackManager.getSwarmTelemetry();
        const radius = this.getVjepaScanRadius(telemetry);
        const executed = this.trackManager.executeWideAreaReconMacro(this.vjepaAnchor.x, this.vjepaAnchor.y, radius);
        if (!executed) return;

        this.opsLog.addEntry(
            'MODE',
            '3DGS',
            `[ EXECUTE ] WIDE-AREA RECON TASKED OVER SWARM MEDIAN (${this.vjepaAnchor.x.toFixed(2)}, ${this.vjepaAnchor.y.toFixed(2)})`,
            1,
            120
        );
    }

    updateRecommendedActions(telemetry) {
        const isCritical = this.isVjepaThreatAnxietyCondition(telemetry);
        this.vjepaWarningActive = isCritical;
        this.vjepaAnchor = isCritical ? this.getVjepaAnchor(telemetry) : null;

        if (isCritical) {
            if (!this.vjepaWarningLogged) {
                this.opsLog.addEntry(
                    'WARNING',
                    'V-JEPA',
                    'SWARM FRACTURE DETECTED. PREDICTIVE RE-MERGE LIKELY OUTSIDE EW COVER. WIDE-AREA 3DGS RECON RECOMMENDED.',
                    1,
                    180
                );
                this.vjepaWarningLogged = true;
            }
        } else {
            this.vjepaWarningLogged = false;
            this.vjepaHoverActive = false;
        }

        if (this.recommendedActionsPanelEl && this.recommendedActionsBadgeEl) {
            this.recommendedActionsPanelEl.classList.toggle('critical', isCritical);
            this.recommendedActionsBadgeEl.textContent = isCritical ? 'CRITICAL' : 'STANDBY';
            this.recommendedActionsBadgeEl.className = isCritical
                ? 'panel-badge badge-alert'
                : 'panel-badge badge-nominal';
        }

        if (this.recDecoyCardEl) {
            this.recDecoyCardEl.style.display = isCritical ? 'none' : 'block';
        }
        if (this.recVjepaCardEl) {
            this.recVjepaCardEl.style.display = isCritical ? 'block' : 'none';
            this.recVjepaCardEl.classList.toggle('flash', isCritical);
        }
        if (this.decoySimPanelEl) {
            this.decoySimPanelEl.classList.toggle('superseded', isCritical);
        }
        if (this.recExecuteBtnEl) {
            const canExecute = isCritical && Boolean(this.vjepaAnchor);
            this.recExecuteBtnEl.disabled = !canExecute;
            this.recExecuteBtnEl.style.opacity = canExecute ? '1' : '0.45';
        }

        this.syncVjepaCounterfactualOverlay();
    }

    update() {
        if (!this.trackManager || !this.domPol) return;
        
        const telemetry = this.trackManager.getSwarmTelemetry();
        if (telemetry.activeCount === 0) {
            this.domPol.textContent = '0.00';
            this.barPol.style.width = '0%';
            this.domMill.textContent = '0.00';
            this.barMill.style.width = '0%';
            this.domCoh.textContent = '0.00';
            this.barCoh.style.width = '0%';
            this.kinematicsBadge.textContent = 'NO LOC';
            this.kinematicsBadge.className = 'panel-badge badge-warning';
            this.updateRecommendedActions(telemetry);
            return;
        }

        // Format to 2 decimal places
        const polStr = telemetry.polarization.toFixed(2);
        const millStr = telemetry.milling.toFixed(2);
        const cohStr = telemetry.cohesion.toFixed(2);

        this.domPol.textContent = polStr;
        this.barPol.style.width = `${telemetry.polarization * 100}%`;
        
        this.domMill.textContent = millStr;
        this.barMill.style.width = `${telemetry.milling * 100}%`;
        
        this.domCoh.textContent = cohStr;
        this.barCoh.style.width = `${telemetry.cohesion * 100}%`;

        // Update Badge state
        if (telemetry.milling > 0.6) {
            this.kinematicsBadge.textContent = 'MILLING';
            this.kinematicsBadge.className = 'panel-badge badge-critical';
        } else if (telemetry.polarization > 0.7) {
            this.kinematicsBadge.textContent = 'ALIGNED';
            this.kinematicsBadge.className = 'panel-badge badge-warning';
        } else if (telemetry.cohesion > 0.8) {
            this.kinematicsBadge.textContent = 'CLUSTERED';
            this.kinematicsBadge.className = 'panel-badge badge-nominal';
        } else {
            this.kinematicsBadge.textContent = 'DISORDERED';
            this.kinematicsBadge.className = 'panel-badge';
            this.kinematicsBadge.style.background = 'var(--panel-bg)';
            this.kinematicsBadge.style.color = '#fff';
        }

        this.updateRecommendedActions(telemetry);
    }
}
