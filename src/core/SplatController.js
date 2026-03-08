import { store } from './Store.js';

import * as THREE from 'three';

export class SplatController {
    constructor(scene, overlayGroup) {
        this.scene = scene;
        this.overlayGroup = overlayGroup;
        
        this.isActive = false;
        this.targetTrackId = null;
        this.targetPos = new THREE.Vector3();
        
        this.setupPointCloud();
        
        store.subscribe('reconMode', (isRecon) => {
            if (isRecon) {
                this.activate(store.get('selectedTrackId'));
            } else {
                this.deactivate();
            }
        });
    }

    setupPointCloud() {
        this.splatGroup = new THREE.Group();
        this.splatGroup.visible = false;
        // Make it render above all terrain
        this.splatGroup.renderOrder = 999;
        
        // 1. Core Target Box (Abstracted Vehicle/SAM)
        const coreGeo = new THREE.BoxGeometry(2, 1, 3);
        const coreMat = new THREE.MeshBasicMaterial({ 
            color: 0x00ccff, 
            wireframe: true,
            transparent: true,
            opacity: 0.8,
            depthTest: false
        });
        this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
        this.splatGroup.add(this.coreMesh);

        // 2. Procedural "Gaussian Splats" (Instanced Ellipsoids forming a cloud surrounding the target)
        const splatCount = 2000;
        const splatGeo = new THREE.SphereGeometry(0.15, 8, 8);
        const splatMat = new THREE.MeshBasicMaterial({ 
            color: 0xffaa00, 
            transparent: true, 
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false
        });
        
        this.splats = new THREE.InstancedMesh(splatGeo, splatMat, splatCount);
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        
        for (let i = 0; i < splatCount; i++) {
            // Distribute splats around a central hemisphere
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            
            // Bias towards ground and center
            let radius = Math.random() * 8.0;
            radius = Math.pow(radius, 0.5) * 3; // concentrate near center
            
            const x = radius * Math.sin(phi) * Math.cos(theta);
            let y = Math.abs(radius * Math.sin(phi) * Math.sin(theta)); // force above ground
            const z = radius * Math.cos(phi);
            
            // Squash Y to make it look like ground vehicles/emplacements
            y *= 0.4;
            
            dummy.position.set(x, y, z);
            
            // Random stretching to simulate 3D Gaussians (ellipsoids)
            dummy.scale.set(
                0.2 + Math.random() * 1.5,
                0.2 + Math.random() * 0.5,
                0.2 + Math.random() * 1.5
            );
            
            dummy.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            dummy.updateMatrix();
            this.splats.setMatrixAt(i, dummy.matrix);
            
            // Color variation: Core is bright blue/white, edges are amber/red
            const dist = Math.sqrt(x*x + y*y + z*z);
            if (dist < 2.0) color.setHex(0x00ffff);
            else if (dist < 4.0) color.setHex(0x4a9eff);
            else if (dist < 6.0) color.setHex(0xffaa00);
            else color.setHex(0xff3333);
            
            this.splats.setColorAt(i, color);
        }
        
        this.splatGroup.add(this.splats);
        
        // Add sweeping scanner plane
        const scanGeo = new THREE.PlaneGeometry(16, 16);
        const scanMat = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.1,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false
        });
        this.scanPlane = new THREE.Mesh(scanGeo, scanMat);
        this.scanPlane.rotation.x = -Math.PI / 2;
        this.splatGroup.add(this.scanPlane);

        this.scene.add(this.splatGroup);
    }

    activate(trackId) {
        if (!trackId) return;
        this.targetTrackId = trackId;
        this.isActive = true;
        this.splatGroup.visible = true;
    }

    deactivate() {
        this.isActive = false;
        this.targetTrackId = null;
        this.splatGroup.visible = false;
    }

    animate(t, trackManager, camera) {
        if (!this.isActive || !this.targetTrackId) return;

        // Find the target track's current physical position
        let found = false;
        const instances = trackManager.instances;
        Object.keys(instances).forEach(type => {
            const inst = instances[type];
            for (let i = 0; i < inst.tracks.length; i++) {
                if (inst.tracks[i].t.id === this.targetTrackId) {
                    const px = inst.tracks[i].pos ? inst.tracks[i].pos.x : 0;
                    const py = inst.tracks[i].pos ? inst.tracks[i].pos.y : 0;
                    
                    // Local to World translation (overlayGroup is rotated -PI/2 on X)
                    this.targetPos.set(px, 0.2, -py); 
                    found = true;
                }
            }
        });

        if (found) {
            // Position the splat cloud directly over the tracked unit
            this.splatGroup.position.copy(this.targetPos);
            
            // Spin the wireframe core
            this.coreMesh.rotation.y = t * 0.5;
            
            // Pulse the scanner plane up and down
            this.scanPlane.position.y = (Math.sin(t * 3) + 1) * 2.0;
            this.scanPlane.material.opacity = 0.05 + Math.max(0, Math.sin(t * 3)) * 0.15;
            
            // Animate splat opacities slightly
            this.splats.material.opacity = 0.4 + Math.sin(t * 5) * 0.1;
        }
    }
}
