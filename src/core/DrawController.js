
import * as THREE from 'three';

export class DrawController {
    constructor(scene, overlayGroup) {
        this.scene = scene;
        this.overlayGroup = overlayGroup;
        
        this.isDrawing = false;
        this.points = [];
        this.zones = [];
        
        // Visuals for the active line segment
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2, depthTest: false, depthWrite: false });
        this.activeLineGeo = new THREE.BufferGeometry();
        this.activeLine = new THREE.Line(this.activeLineGeo, lineMat);
        this.activeLine.frustumCulled = false;
        this.activeLine.visible = false;
        this.activeLine.position.z = 0.05;
        this.activeLine.renderOrder = 999;
        this.overlayGroup.add(this.activeLine);

        // Preview point
        const dotGeo = new THREE.CircleGeometry(0.3, 16);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false });
        this.previewDot = new THREE.Mesh(dotGeo, dotMat);
        this.previewDot.visible = false;
        this.previewDot.position.z = 0.05;
        this.previewDot.renderOrder = 999;
        this.overlayGroup.add(this.previewDot);

        this.drawBtn = document.getElementById('btn-draw-zone');
        if(this.drawBtn) {
            this.drawBtn.addEventListener('click', () => this.toggleDrawingMode());
        }

        window.addEventListener('keydown', (e) => {
            if(e.key.toLowerCase() === 'z') {
                if(document.activeElement && document.activeElement.tagName === 'INPUT') return;
                this.toggleDrawingMode();
            }
            if(e.key === 'Enter' || e.key === 'Escape') {
                if(this.isDrawing && this.points.length > 2) {
                    this.finishZone();
                } else if(this.isDrawing) {
                    this.cancelZone();
                }
            }
        });
    }

    toggleDrawingMode() {
        this.isDrawing = !this.isDrawing;
        if(this.isDrawing) {
            if(this.drawBtn) {
                this.drawBtn.classList.remove('badge-nominal');
                this.drawBtn.classList.add('badge-live');
                this.drawBtn.innerText = 'DRAWING...';
            }
            document.body.style.cursor = 'crosshair';
        } else {
            this.cancelZone();
        }
    }

    cancelZone() {
        this.isDrawing = false;
        this.points = [];
        this.activeLine.visible = false;
        this.previewDot.visible = false;
        if(this.drawBtn) {
            this.drawBtn.classList.add('badge-nominal');
            this.drawBtn.classList.remove('badge-live');
            this.drawBtn.innerText = 'DRAW [Z]';
        }
        document.body.style.cursor = 'default';
    }

    addPoint(localPoint) {
        if(!this.isDrawing) return;
        this.points.push(new THREE.Vector3(localPoint.x, localPoint.y, 0));
        this.updateLine();
    }

    updatePreview(localPoint) {
        if(!this.isDrawing) return;
        this.previewDot.visible = true;
        this.previewDot.position.set(localPoint.x, localPoint.y, 0.05);
        
        if(this.points.length > 0) {
            const pts = [...this.points, new THREE.Vector3(localPoint.x, localPoint.y, 0)];
            this.activeLineGeo.setFromPoints(pts);
            this.activeLine.visible = true;
        }
    }

    updateLine() {
        if(this.points.length > 0) {
            this.activeLineGeo.setFromPoints(this.points);
            this.activeLine.visible = true;
        }
    }

    finishZone() {
        if(this.points.length < 3) return;
        
        // Add completion segment back to start
        const pts = [...this.points, this.points[0].clone()];
        
        // Create Fill Shape using local X and Y
        const shape = new THREE.Shape();
        shape.moveTo(pts[0].x, pts[0].y);
        for(let i=1; i<pts.length; i++) {
            shape.lineTo(pts[i].x, pts[i].y);
        }

        const geo = new THREE.ShapeGeometry(shape);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0x00ccff, 
            transparent: true, 
            opacity: 0.15,
            side: THREE.DoubleSide,
            depthTest: false,
            depthWrite: false
        });
        const fillMesh = new THREE.Mesh(geo, mat);
        fillMesh.position.z = 0.05;
        fillMesh.renderOrder = 999;

        // Create Outline Line
        const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00ccff, linewidth: 2, transparent: true, opacity: 0.8, depthTest: false, depthWrite: false });
        const outlineMesh = new THREE.Line(lineGeo, lineMat);
        outlineMesh.position.z = 0.05;
        outlineMesh.renderOrder = 999;

        // Combine
        const zoneGroup = new THREE.Group();
        zoneGroup.add(fillMesh);
        zoneGroup.add(outlineMesh);
        zoneGroup.userData.isTerrainFeature = true;
        
        this.overlayGroup.add(zoneGroup);
        this.zones.push(zoneGroup);

        this.cancelZone(); // Reset state
    }
}
