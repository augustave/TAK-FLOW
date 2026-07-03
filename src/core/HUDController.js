import { store } from './Store.js';

export class HUDController {
    constructor() {
        this.densityBadgeEl = document.getElementById('density-badge');
        this.densityButtonEl = document.getElementById('btn-density');
        this.contrastButtonEl = document.getElementById('btn-contrast');
        this.motionButtonEl = document.getElementById('btn-motion');
        this.pheromoneButtonEl = document.getElementById('btn-pheromone');
        this.panelOpacityInputEl = document.getElementById('panel-opacity');
        this.panelOpacityValueEl = document.getElementById('panel-opacity-value');
        this.leftDrawerToggleEl = document.getElementById('left-drawer-toggle');
        this.rightDrawerToggleEl = document.getElementById('right-drawer-toggle');
        this.btnToggleSkin = document.getElementById('skin-toggle');
        
        this.zuluClock = document.getElementById('zulu-clock');
        this.zuluDate = document.getElementById('zulu-date');
        this.dtgDisplay = document.getElementById('dtg-display');

        this.initDOM();
        this.initClocks();
    }

    initDOM() {
        this.densityButtonEl?.addEventListener('click', () => {
            store.set('isCompactHud', !store.get('isCompactHud'));
        });
        this.contrastButtonEl?.addEventListener('click', () => {
            store.set('isHighContrast', !store.get('isHighContrast'));
        });
        this.motionButtonEl?.addEventListener('click', () => {
            store.set('reduceMotion', !store.get('reduceMotion'));
        });
        this.pheromoneButtonEl?.addEventListener('click', () => {
            store.set('pheromoneOverlay', !store.get('pheromoneOverlay'));
        });
        store.subscribe('pheromoneOverlay', (enabled) => {
            if (!this.pheromoneButtonEl) return;
            this.pheromoneButtonEl.textContent = enabled ? 'ROUTE MEMORY (SIM): ON' : 'ROUTE MEMORY (SIM): OFF';
            this.pheromoneButtonEl.classList.toggle('active', Boolean(enabled));
        });
        this.panelOpacityInputEl?.addEventListener('input', e => {
            this.setPanelOpacity(Number(e.target.value));
        });
        this.btnToggleSkin?.addEventListener('click', () => {
            const currentSkin = store.get('skinMode');
            this.setSkinMode(currentSkin === 0 ? 1 : 0);
        });

        this.leftDrawerToggleEl?.addEventListener('click', e => {
            e.stopPropagation();
            this.toggleDrawer('left');
        });

        this.rightDrawerToggleEl?.addEventListener('click', e => {
            e.stopPropagation();
            this.toggleDrawer('right');
        });

        // Subscriptions
        store.subscribe('isCompactHud', (val) => this.applyHudDensity(val));
        store.subscribe('isHighContrast', (val) => this.applyHighContrast(val));
        store.subscribe('reduceMotion', (val) => this.applyReducedMotion(val));
        
        // Init opacity
        this.setPanelOpacity(88);
    }

    setPanelOpacity(percentage) {
        const bounded = Math.max(35, Math.min(95, percentage));
        const alpha = (bounded / 100).toFixed(2);
        document.documentElement.style.setProperty('--panel-bg-alpha', alpha);
        if(this.panelOpacityInputEl) this.panelOpacityInputEl.value = String(bounded);
        if(this.panelOpacityValueEl) this.panelOpacityValueEl.textContent = `${bounded}%`;
    }

    applyHudDensity(compact) {
        document.body.classList.toggle('compact-hud', compact);
        if(this.densityButtonEl) {
            this.densityButtonEl.textContent = compact ? 'DENSITY: COMPACT' : 'DENSITY: NORMAL';
            this.densityButtonEl.classList.toggle('active', compact);
        }
        if(this.densityBadgeEl) {
            this.densityBadgeEl.textContent = compact ? 'COMPACT' : 'NORMAL';
        }
    }

    applyHighContrast(enabled) {
        document.body.classList.toggle('high-contrast', enabled);
        if(this.contrastButtonEl) {
            this.contrastButtonEl.textContent = enabled ? 'CONTRAST: HIGH' : 'CONTRAST: STD';
            this.contrastButtonEl.classList.toggle('active', enabled);
        }
    }

    applyReducedMotion(enabled) {
        document.body.classList.toggle('reduced-motion', enabled);
        if(this.motionButtonEl) {
            this.motionButtonEl.textContent = enabled ? 'MOTION: REDUCED' : 'MOTION: FULL';
            this.motionButtonEl.classList.toggle('active', enabled);
        }
    }

    setSkinMode(mode) {
        store.set('skinMode', mode);
        if(mode === 1) {
            if(this.btnToggleSkin) {
                this.btnToggleSkin.innerText = '⬡ SWITCH TO TACTICAL C2';
                this.btnToggleSkin.style.color = 'var(--amber-alert)';
                this.btnToggleSkin.style.borderColor = 'var(--amber-alert)';
            }
            const aor = document.getElementById('aor-display');
            if(aor) aor.textContent = 'ARCHIVAL / WWI RECON';
        } else {
            if(this.btnToggleSkin) {
                this.btnToggleSkin.innerText = '⬡ SWITCH TO ARCHIVAL SCAN';
                this.btnToggleSkin.style.color = 'var(--cyan-data)';
                this.btnToggleSkin.style.borderColor = 'rgba(0,221,255,0.3)';
            }
            const aor = document.getElementById('aor-display');
            if(aor) aor.textContent = 'SECTOR 4-ALPHA';
        }
    }

    toggleDrawer(side) {
        const leftClass = 'left-drawer-open';
        const rightClass = 'right-drawer-open';
        if (side === 'left') {
            document.body.classList.toggle(leftClass);
            document.body.classList.remove(rightClass);
        } else {
            document.body.classList.toggle(rightClass);
            document.body.classList.remove(leftClass);
        }
    }

    closeDrawers() {
        document.body.classList.remove('left-drawer-open');
        document.body.classList.remove('right-drawer-open');
    }

    initClocks() {
        this.updateClocks();
        setInterval(() => this.updateClocks(), 1000);
    }

    updateClocks() {
        const now = new Date();
        const h = String(now.getUTCHours()).padStart(2, '0');
        const m = String(now.getUTCMinutes()).padStart(2, '0');
        const s = String(now.getUTCSeconds()).padStart(2, '0');
        if(this.zuluClock) this.zuluClock.textContent = `${h}:${m}:${s}Z`;

        const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const d = String(now.getUTCDate()).padStart(2, '0');
        const mon = months[now.getUTCMonth()];
        const yr = String(now.getUTCFullYear()).slice(-2);
        if(this.zuluDate) this.zuluDate.textContent = `${d} ${mon} ${now.getUTCFullYear()}`;
        if(this.dtgDisplay) this.dtgDisplay.textContent = `${d}${h}${m}${s}Z${mon}${yr}`;
    }
}
