import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { mapVS, mapFS } from '../shaders.js';

export function setupMapEngine(container) {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030608, 0.012);

    const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 45, 35);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    container.appendChild(renderer.domElement);

    // Explosions (8 slots)
    const explosions = [];
    for(let i = 0; i < 8; i++) explosions.push(new THREE.Vector3(0,0,0));

    // SAM positions
    const samPositions = [
        new THREE.Vector3(-12, 8, 0),
        new THREE.Vector3(15, -5, 0),
        new THREE.Vector3(-5, -18, 0)
    ];
    const samRadii = [12.0, 18.0, 8.0];

    // AlphaEarth Simulated 64-D Embedding Tensor
    // Initialized pseudo-randomly for terrain generation consistency
    const alphaEarthData = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
        alphaEarthData[i] = Math.random();
    }
    // High vegetation (Dim 45), Moderate iron (Dim 22), Low water bodies (Dim 8)
    alphaEarthData[45] = 0.8;
    alphaEarthData[22] = 0.6;
    alphaEarthData[8]  = 0.2;

    const uniforms = {
        time: { value: 0 },
        uExplosions: { value: explosions },
        uSkinMode: { value: 0 },
        uMapMode: { value: 1.0 },
        uSAMPositions: { value: samPositions },
        uSAMRadii: { value: samRadii },
        uAlphaEarthData: { value: alphaEarthData }
    };

    const mapMat = new THREE.ShaderMaterial({
        vertexShader: mapVS,
        fragmentShader: mapFS,
        uniforms,
        side: THREE.DoubleSide
    });

    const mapGeo = new THREE.PlaneGeometry(80, 80, 64, 64);
    const mapMesh = new THREE.Mesh(mapGeo, mapMat);
    mapMesh.rotation.x = -Math.PI / 2;
    scene.add(mapMesh);

    // 3D OVERLAYS
    const overlayGroup = new THREE.Group();
    overlayGroup.rotation.x = -Math.PI / 2;
    overlayGroup.position.y = 0.15;
    scene.add(overlayGroup);

    // Grid
    const grid = new THREE.GridHelper(80, 40, 0x88aacc, 0x88aacc);
    grid.material.opacity = 0.04;
    grid.material.transparent = true;
    grid.rotation.x = Math.PI / 2;
    overlayGroup.add(grid);

    // Radar sweep
    const radarGeo = new THREE.CircleGeometry(18, 64);
    const radarMat = new THREE.MeshBasicMaterial({ color: 0x88bbdd, transparent: true, opacity: 0.03, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const radarMesh = new THREE.Mesh(radarGeo, radarMat);
    overlayGroup.add(radarMesh);

    const rLineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(18,0,0)]);
    const rLineMat = new THREE.LineBasicMaterial({ color: 0xaaccee, transparent: true, opacity: 0.3 });
    radarMesh.add(new THREE.Line(rLineGeo, rLineMat));

    // SAM rings
    samPositions.forEach((pos, i) => {
        const ringGeo = new THREE.RingGeometry(samRadii[i] - 0.15, samRadii[i], 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3333, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(pos.x, pos.y, 0.05);
        overlayGroup.add(ring);
    });

    // POST-PROCESSING Pipeline
    const renderScene = new RenderPass(scene, camera);
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);

    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.85);
    composer.addPass(bloomPass);

    const filmPass = new FilmPass(0.35, false);
    composer.addPass(filmPass);

    return { scene, camera, renderer, composer, bloomPass, filmPass, mapMesh, overlayGroup, radarMesh, uniforms, explosions, alphaEarthData };
}
