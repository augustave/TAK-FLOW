function formatReplayTimestamp(timestamp) {
    const totalMs = Math.max(0, Number(timestamp) || 0);
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const millis = Math.floor(totalMs % 1000);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export class ReplayPlayer {
    constructor(trackManager, domController) {
        this.trackManager = trackManager;
        this.domController = domController;
        this.snapshots = [];
        this.currentIndex = 0;
        this.playbackSpeed = 1;
        this.isPlaying = false;
        this._playInterval = null;

        this.transportEl = document.getElementById('replay-transport-bar');
        this.scrubEl = document.getElementById('replay-scrub');
        this.tickListEl = document.getElementById('replay-scrub-ticks');
        this.markersEl = document.getElementById('replay-markers');
        this.playPauseEl = document.getElementById('replay-play-pause');
        this.stepBackEl = document.getElementById('replay-step-back');
        this.stepFwdEl = document.getElementById('replay-step-fwd');
        this.speedEl = document.getElementById('replay-speed');
        this.eventJumpEl = document.getElementById('replay-event-jump');
        this.timestampEl = document.getElementById('replay-timestamp');
        this.exportEl = document.getElementById('replay-export');

        this.bindUi();
    }

    bindUi() {
        this.stepBackEl?.addEventListener('click', () => this.stepBackward());
        this.stepFwdEl?.addEventListener('click', () => this.stepForward());
        this.playPauseEl?.addEventListener('click', () => {
            if (this.isPlaying) this.pause();
            else this.play();
        });
        this.speedEl?.addEventListener('change', (e) => this.setSpeed(Number(e.target.value)));
        this.scrubEl?.addEventListener('input', (e) => {
            const idx = Number(e.target.value) || 0;
            this.pause();
            this._restoreFrame(idx);
        });
        this.eventJumpEl?.addEventListener('change', (e) => {
            const value = e.target.value;
            if (!value) return;
            const [eventType, occurrence] = value.split('|');
            this.jumpToEvent(eventType, Number(occurrence) || 0);
        });
        this.exportEl?.addEventListener('click', () => this.trackManager.replayCapture?.exportSession());

        window.addEventListener('keydown', (e) => {
            if (!this.transportEl || this.transportEl.style.display === 'none') return;
            if (e.code === 'ArrowLeft') {
                e.preventDefault();
                this.stepBackward();
            } else if (e.code === 'ArrowRight') {
                e.preventDefault();
                this.stepForward();
            } else if (e.code === 'Space') {
                e.preventDefault();
                if (this.isPlaying) this.pause();
                else this.play();
            }
        });

        window.addEventListener('replay:capture-updated', () => {
            if (this.isPlaying || this.trackManager.replayMode) return;
            this.load(this.trackManager.replayCapture);
        });
    }

    load(replayCapture) {
        this.pause();
        this.trackManager.setReplayMode(false);
        this.snapshots = [...replayCapture.ringBuffer, ...replayCapture.eventSnapshots]
            .sort((a, b) => a.timestamp - b.timestamp);
        this.currentIndex = 0;
        if (this.transportEl) this.transportEl.style.display = this.snapshots.length > 0 ? 'flex' : 'none';
        this.populateEventJump();
        this.populateMarkers();
        this.syncUi();
    }

    populateEventJump() {
        if (!this.eventJumpEl) return;
        this.eventJumpEl.replaceChildren();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'JUMP TO EVENT';
        this.eventJumpEl.appendChild(placeholder);

        const occurrences = new Map();
        this.snapshots.forEach((snapshot) => {
            if (!snapshot.triggerEvent) return;
            const seen = occurrences.get(snapshot.triggerEvent) || 0;
            occurrences.set(snapshot.triggerEvent, seen + 1);
            const option = document.createElement('option');
            option.value = `${snapshot.triggerEvent}|${seen}`;
            option.textContent = `[${formatReplayTimestamp(snapshot.timestamp)}] ${snapshot.triggerEvent}`;
            this.eventJumpEl.appendChild(option);
        });
    }

    populateMarkers() {
        if (!this.tickListEl || !this.markersEl) return;
        this.tickListEl.replaceChildren();
        this.markersEl.replaceChildren();
        const max = Math.max(1, this.snapshots.length - 1);
        const totalDuration = this.snapshots.at(-1)?.timestamp || 1;

        this.snapshots.forEach((snapshot, index) => {
            if (!snapshot.triggerEvent) return;
            const option = document.createElement('option');
            option.value = String(index);
            this.tickListEl.appendChild(option);

            const marker = document.createElement('span');
            marker.className = `replay-marker ${snapshot.triggerEvent === 'VEJPA_ONSET' ? 'marker-vejpa' : ''} ${snapshot.triggerEvent === 'DESIGNATION_CONFIRM' ? 'marker-designation' : ''}`;
            marker.style.left = `${(snapshot.timestamp / totalDuration) * 100}%`;
            marker.title = snapshot.triggerEvent;
            this.markersEl.appendChild(marker);
        });

        if (this.scrubEl) {
            this.scrubEl.min = '0';
            this.scrubEl.max = String(max);
            this.scrubEl.step = '1';
            this.scrubEl.value = String(this.currentIndex);
        }
    }

    play() {
        if (this.isPlaying || this.snapshots.length === 0) return;
        this.isPlaying = true;
        this.trackManager.setReplayMode(true);
        this._playInterval = window.setInterval(() => {
            if (this.currentIndex >= this.snapshots.length - 1) {
                this.pause();
                return;
            }
            this._restoreFrame(this.currentIndex + 1);
        }, 250 / this.playbackSpeed);
        this.syncUi();
    }

    pause() {
        if (this._playInterval) {
            clearInterval(this._playInterval);
            this._playInterval = null;
        }
        this.isPlaying = false;
        this.syncUi();
    }

    setSpeed(speed) {
        const valid = [0.25, 0.5, 1, 2, 4];
        if (!valid.includes(speed)) return;
        const wasPlaying = this.isPlaying;
        this.pause();
        this.playbackSpeed = speed;
        if (wasPlaying) this.play();
        this.syncUi();
    }

    stepForward() {
        this.pause();
        const next = Math.min(this.snapshots.length - 1, this.currentIndex + 1);
        this._restoreFrame(next);
    }

    stepBackward() {
        this.pause();
        const next = Math.max(0, this.currentIndex - 1);
        this._restoreFrame(next);
    }

    jumpToEvent(eventType, occurrence = 0) {
        const matches = this.snapshots
            .map((snapshot, index) => ({ snapshot, index }))
            .filter(item => item.snapshot.triggerEvent === eventType);
        if (!matches[occurrence]) return;
        this.pause();
        this._restoreFrame(matches[occurrence].index);
    }

    scrubTo(timestamp) {
        if (this.snapshots.length === 0) return;
        let closestIndex = 0;
        let closestDelta = Infinity;
        this.snapshots.forEach((snapshot, index) => {
            const delta = Math.abs(snapshot.timestamp - timestamp);
            if (delta < closestDelta) {
                closestDelta = delta;
                closestIndex = index;
            }
        });
        this.pause();
        this._restoreFrame(closestIndex);
    }

    _restoreFrame(index) {
        if (!this.snapshots[index]) return;
        this.currentIndex = index;
        const snapshot = this.snapshots[index];
        this.domController.replayLogEntries = this.snapshots
            .slice(0, index + 1)
            .flatMap(item => item.opsLogDelta || []);
        this.trackManager.restoreSnapshot(snapshot);
        this.domController.restoreSnapshot(snapshot);
        this.syncUi();
        window.dispatchEvent(new CustomEvent('replay:frame', {
            detail: { index, snapshot }
        }));
    }

    syncUi() {
        if (this.playPauseEl) this.playPauseEl.textContent = this.isPlaying ? 'PAUSE' : 'PLAY';
        if (this.scrubEl) this.scrubEl.value = String(this.currentIndex);
        if (this.timestampEl) this.timestampEl.textContent = formatReplayTimestamp(this.snapshots[this.currentIndex]?.timestamp || 0);
        if (this.speedEl) this.speedEl.value = String(this.playbackSpeed);
    }
}
