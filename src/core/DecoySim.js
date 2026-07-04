import { fallbackDecoyProfiles } from '../data/mockData.js';
import { store } from './Store.js';

export class DecoySim {
    constructor(sigintFeed, opsLog) {
        this.sigintFeed = sigintFeed;
        this.opsLog = opsLog;
        
        this.profiles = Array.isArray(window.NARUTO_SIM_PROFILES) && window.NARUTO_SIM_PROFILES.length > 0
            ? window.NARUTO_SIM_PROFILES
            : fallbackDecoyProfiles;

        this.decoySimBadgeEl = document.getElementById('decoy-sim-badge');
        this.decoyProfileSelectEl = document.getElementById('decoy-profile-select');
        this.decoyCountInputEl = document.getElementById('decoy-count');
        this.decoyCountValueEl = document.getElementById('decoy-count-value');
        this.decoyActiveEl = document.getElementById('decoy-active');
        this.decoyLastBurstEl = document.getElementById('decoy-last-burst');
        this.decoyStartButtonEl = document.getElementById('btn-decoy-start');
        this.decoyStopButtonEl = document.getElementById('btn-decoy-stop');
        this.trackCountBadgeEl = document.getElementById('track-count');

        this.initDOM();
        this.updatePanelStatus();
    }

    initDOM() {
        if(!this.decoyProfileSelectEl) return;
        
        this.decoyProfileSelectEl.replaceChildren();
        this.profiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.displayName || profile.id;
            this.decoyProfileSelectEl.appendChild(option);
        });

        this.decoyCountInputEl?.addEventListener('input', () => this.updatePanelStatus());
        this.decoyProfileSelectEl?.addEventListener('change', () => {
            if(store.get('decoySim').running) {
                this.stopSimulation('PROFILE_CHANGE');
            }
        });
        this.decoyStartButtonEl?.addEventListener('click', () => this.startSimulation());
        this.decoyStopButtonEl?.addEventListener('click', () => this.stopSimulation('USER_STOP'));
    }

    updateTrackCountBadge() {
        if(!this.trackCountBadgeEl) return;
        const baseTrackCount = window.__baseTrackCount || 12; // Temporary mock
        const simState = store.get('decoySim');
        const total = baseTrackCount + (simState.running ? simState.activeDecoys.length : 0);
        this.trackCountBadgeEl.textContent = `${total} ACTIVE`;
    }

    updatePanelStatus() {
        if(!this.decoyCountValueEl) return;
        
        const simState = store.get('decoySim');
        this.decoyCountValueEl.textContent = this.decoyCountInputEl.value;
        this.decoyActiveEl.textContent = String(simState.activeDecoys.length);
        this.decoyStartButtonEl.classList.toggle('active', simState.running);
        
        if(simState.running) {
            this.decoySimBadgeEl.textContent = 'RUNNING';
            this.decoySimBadgeEl.className = 'panel-badge badge-live';
        } else {
            this.decoySimBadgeEl.textContent = 'IDLE';
            this.decoySimBadgeEl.className = 'panel-badge badge-nominal';
        }
        this.updateTrackCountBadge();
    }

    getSelectedProfile() {
        const selected = this.profiles.find(p => p.id === this.decoyProfileSelectEl.value);
        return selected || this.profiles[0];
    }

    normalizeHexPrefix(input) {
        const cleaned = String(input || '').toUpperCase().replace(/[^0-9A-F]/g, '');
        return cleaned.slice(0, Math.min(cleaned.length, 12));
    }

    randomHex(length) {
        const chars = '0123456789ABCDEF';
        let out = '';
        for(let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
        return out;
    }

    buildPatternSuffix(pattern) {
        let out = '';
        for(const ch of String(pattern || '')) {
            if(ch === 'L') out += String.fromCharCode(65 + Math.floor(Math.random() * 26));
            else if(ch === 'N') out += Math.floor(Math.random() * 10).toString();
            else if(ch === 'H') out += this.randomHex(1);
            else if(ch === 'A') out += Math.random() < 0.5
                ? String.fromCharCode(65 + Math.floor(Math.random() * 26))
                : Math.floor(Math.random() * 10).toString();
            else out += ch;
        }
        return out;
    }

    formatMac(prefix) {
        let full = this.normalizeHexPrefix(prefix);
        if(full.length < 12) full += this.randomHex(12 - full.length);
        full = full.slice(0, 12);
        return full.match(/.{1,2}/g).join(':').toLowerCase();
    }

    makeDecoySet(profile, count) {
        const channels = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'];
        const prefixes = Array.isArray(profile.macPrefixes) && profile.macPrefixes.length > 0 ? profile.macPrefixes : ['AA11BB'];
        const set = [];
        for(let i = 0; i < count; i++) {
            const suffix = this.buildPatternSuffix(profile.endString);
            const ssid = `${profile.startString || 'DECOY-'}${suffix}`;
            const mac = this.formatMac(prefixes[Math.floor(Math.random() * prefixes.length)]);
            const channel = channels[Math.floor(Math.random() * channels.length)];
            set.push({ ssid, mac, channel, profileId: profile.id });
        }
        return set;
    }

    scheduleBurst() {
        if(this.timerId) clearTimeout(this.timerId);
        
        const simState = store.get('decoySim');
        if(!simState.running) return;

        this.timerId = setTimeout(() => {
            const currentSimState = store.get('decoySim');
            if(currentSimState.running && !document.hidden && currentSimState.activeDecoys.length > 0) {
                const sample = currentSimState.activeDecoys[Math.floor(Math.random() * currentSimState.activeDecoys.length)];
                if(this.decoyLastBurstEl) {
                    this.decoyLastBurstEl.textContent = `${sample.channel} / ${sample.mac.slice(0, 8)}`;
                }
                
                this.sigintFeed?.renderMessage({
                    tag: currentSimState.burstCount % 4 === 0 ? 'warn' : 'intel',
                    text: `SIM RF DECOY ${sample.ssid} MAC ${sample.mac} CH ${sample.channel} (NO TX)`
                });
                
                store.set('decoySim', { ...currentSimState, burstCount: currentSimState.burstCount + 1 });
            }
            this.scheduleBurst();
        }, 2200 + Math.random() * 2000);
    }

    startSimulation() {
        const simState = store.get('decoySim');
        if(simState.running) return;
        
        const profile = this.getSelectedProfile();
        const count = Number(this.decoyCountInputEl.value);
        
        store.set('decoySim', {
            running: true,
            activeDecoys: this.makeDecoySet(profile, count),
            burstCount: 0,
            profileId: profile.id,
            ghost: profile.ghost ? { ...profile.ghost } : null
        });

        if(this.decoyLastBurstEl) this.decoyLastBurstEl.textContent = '--';
        this.opsLog?.addEntry('MODE', 'DECOY_SIM', `START PROFILE:${profile.id} COUNT:${count} SAFE_SIM`);
        
        this.updatePanelStatus();
        this.scheduleBurst();
    }

    stopSimulation(reason = 'MANUAL') {
        if(this.timerId) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
        const simState = store.get('decoySim');
        if(simState.running) {
            this.opsLog?.addEntry('MODE', 'DECOY_SIM', `STOP REASON:${reason}`);
        }
        store.set('decoySim', {
            running: false,
            activeDecoys: [],
            burstCount: 0
        });

        if(this.decoyLastBurstEl) this.decoyLastBurstEl.textContent = '--';
        this.updatePanelStatus();
    }
}
