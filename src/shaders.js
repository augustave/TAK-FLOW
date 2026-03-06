export const mapVS = `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
    }
`;

export const mapFS = `
    varying vec2 vUv;
    varying vec3 vWorldPos;
    uniform float time;
    uniform vec3 uExplosions[8];
    uniform float uSkinMode; // 0 = standard tactical, 1 = archival scan
    uniform float uMapMode;  // 1.0 = Topo, 0.0 = Flat
    uniform vec3 uSAMPositions[3];
    uniform float uSAMRadii[3];
    uniform float uAlphaEarthData[64];

    float random(vec2 st) { return fract(sin(dot(st, vec2(12.9898,78.233))) * 43758.5453); }
    
    float noise(vec2 st) {
        vec2 i = floor(st), f = fract(st);
        float a = random(i), b = random(i + vec2(1,0)), c = random(i + vec2(0,1)), d = random(i + vec2(1,1));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
    }
    
    float fbm(vec2 st) {
        float v = 0.0, a = 0.5;
        for(int i = 0; i < 7; i++) { v += a * noise(st); st *= 2.0; a *= 0.5; }
        return v;
    }

    float fbm4(vec2 st) {
        float v = 0.0, a = 0.5;
        for(int i = 0; i < 4; i++) { v += a * noise(st); st *= 2.0; a *= 0.5; }
        return v;
    }

    // Domain warping for organic feel
    float warpedFbm(vec2 uv, float t) {
        vec2 q = vec2(fbm(uv + vec2(0.0, 0.0)), fbm(uv + vec2(5.2, 1.3)));
        vec2 r = vec2(fbm(uv + 4.0*q + vec2(1.7, 9.2) + 0.001*t), fbm(uv + 4.0*q + vec2(8.3, 2.8) + 0.001*t));
        return fbm(uv + 4.0*r);
    }

    // AlphaEarth Embedding Decoder
    // Uses specific 64-D vector indices to modulate terrain properties
    float alphaEarthTopography(vec2 uv, float t) {
        // Pseudo-sample embedding dimensions
        float crustalDensity = uAlphaEarthData[12]; // Dim 12: Lithosphere density proxy
        float vegIndex = uAlphaEarthData[45];       // Dim 45: Surface vegetation/canopy proxy
        float hydrology = uAlphaEarthData[8];       // Dim 8: Surface moisture/water body proxy
        
        vec2 q = vec2(fbm(uv + vec2(crustalDensity, hydrology)), fbm(uv + vec2(5.2, 1.3)));
        vec2 r = vec2(fbm(uv + (4.0 - vegIndex)*q + vec2(1.7, 9.2) + 0.001*t), fbm(uv + 4.0*q + vec2(8.3, 2.8) + 0.001*t));
        
        float baseElevation = fbm(uv + 4.0*r);
        
        // Carve out lakes based on hydrology embedding
        baseElevation -= smoothstep(0.4, 1.0, hydrology) * 0.15 * fbm(uv * 10.0);
        
        return clamp(baseElevation, 0.0, 1.0);
    }

    // Museum heightmap
    float museumH(vec2 uv) {
        float path = sin(uv.y * 5.0) * 0.15 + 0.5;
        path += (step(0.5, fract(uv.y * 10.0)) - 0.5) * 0.05;
        float dist = abs(uv.x - path);
        float edgeN = fbm(uv * 15.0) * 0.15;
        float mask = step(dist, 0.25 + edgeN);
        if(mask < 0.5) return 0.0;
        float overlap = step(0.6, fbm(floor(uv * 12.0)));
        float baseH = 0.5 + overlap * 0.1;
        vec2 gv = fract(uv * 40.0) - 0.5;
        vec2 id = floor(uv * 40.0);
        float crater = smoothstep(0.35, 0.0, length(gv)) * step(0.85, random(id));
        float trench = smoothstep(0.015, 0.0, abs(fbm(uv * 20.0) - 0.5)) * step(0.4, fbm(uv * 30.0));
        float anno = smoothstep(0.005, 0.0, abs(fbm(uv * 8.0 + 10.0) - 0.5)) * step(0.85, fbm(uv * 3.0));
        return baseH - crater * 0.2 - trench * 0.15 + anno * 0.05;
    }

    void main() {
        vec2 wp = (vUv - 0.5) * 80.0;
        
        // === EXPLOSIONS ===
        float totalFlash = 0.0, totalScorch = 0.0;
        for(int i = 0; i < 8; i++) {
            float et = uExplosions[i].z;
            if(et > 0.0) {
                float d = distance(wp, uExplosions[i].xy);
                float r = et * 25.0;
                float rt = 1.5 + et * 3.0;
                float ring = smoothstep(r, r-rt, d) - smoothstep(r-rt, r-rt*2.0, d);
                totalFlash += ring * (1.0 - et) * 1.5;
                float inner = smoothstep(3.0, 0.0, d) * max(0.0, 1.0 - et * 3.0);
                totalFlash += inner * 2.0;
                float scS = 4.0 + random(uExplosions[i].xy) * 3.0;
                totalScorch += smoothstep(scS, 0.0, d + fbm(wp * 2.0) * 2.0) * (1.0 - et * 0.4);
            }
        }

        // === SAM RINGS ===
        float samOverlay = 0.0;
        for(int i = 0; i < 3; i++) {
            float d = distance(wp, uSAMPositions[i].xy);
            float r = uSAMRadii[i];
            float ringW = 0.3;
            float ring = smoothstep(r, r - ringW, d) - smoothstep(r - ringW, r - ringW * 2.0, d);
            float fill = smoothstep(r, r * 0.8, d) * 0.04;
            float dashes = step(0.5, fract(atan(wp.y - uSAMPositions[i].y, wp.x - uSAMPositions[i].x) * 8.0 / 6.2832 + time * 0.1));
            samOverlay += (ring * dashes * 0.6 + fill);
        }

        // ====== TACTICAL MODE ======
        vec3 cTac = vec3(0.0);
        if (uSkinMode < 0.99) {
            float grit = random(vUv * 500.0);
            
            // 1. Elevation (Heightmap) using AlphaEarth
            float elevation = alphaEarthTopography(vUv * 4.0, time);
            
            // 2. Fake Normals (Bump Mapping)
            // Calculate a normal vector from the height derivative
            vec2 e = vec2(0.005, 0.0);
            float hX = alphaEarthTopography((vUv + e.xy) * 4.0, time);
            float hY = alphaEarthTopography((vUv + e.yx) * 4.0, time);
            vec3 normal = normalize(vec3(elevation - hX, elevation - hY, 0.02));
            
            // 3. Lighting
            vec3 lightDir = normalize(vec3(0.5, 0.8, 0.6)); // Light from top right
            float diff = max(dot(normal, lightDir), 0.0);
            float lightIntensity = diff * 0.7 + 0.5; // ambient + diffuse
            
            // 4. Topographical Tiers
            vec3 terrainColor;
            
            // Water (Lowest tier)
            float waterMask = step(elevation, 0.35);
            vec3 deepWater = vec3(0.10, 0.16, 0.18);
            vec3 shallowWater = vec3(0.18, 0.28, 0.26);
            vec3 waterColor = mix(deepWater, shallowWater, elevation / 0.35);
            // Add slight time-based ripple to water normals
            if(elevation < 0.35) {
                float ripple = fbm(vUv * 20.0 + time * 0.05);
                waterColor += ripple * 0.04;
                lightIntensity = max(dot(normalize(normal + vec3(ripple*0.02, ripple*0.02, 0.0)), lightDir), 0.0) * 0.5 + 0.6;
            }

            // Coastline / Sand
            float coastMask = step(0.35, elevation) * step(elevation, 0.38);
            vec3 coastColor = mix(vec3(0.40, 0.42, 0.35), vec3(0.35, 0.38, 0.32), (elevation - 0.35) * 33.3);
            
            // Lowlands / Grass
            float lowMask = step(0.38, elevation) * step(elevation, 0.65);
            vec3 lowColor = mix(vec3(0.22, 0.28, 0.24), vec3(0.30, 0.35, 0.28), (elevation - 0.38) * 3.7);
            
            // Highlands / Rock
            float highMask = step(0.65, elevation);
            float ironProp = uAlphaEarthData[22]; // Dim 22: Ferric iron oxide index
            vec3 rawRockColor = mix(vec3(0.45, 0.43, 0.40), vec3(0.65, 0.62, 0.60), (elevation - 0.65) * 2.8);
            vec3 highColor = mix(rawRockColor, vec3(0.6, 0.35, 0.25), ironProp * 0.4); // Reddish tint if high iron

            
            terrainColor = waterColor * waterMask + 
                           coastColor * coastMask + 
                           lowColor * lowMask + 
                           highColor * highMask;

            // Apply global terrain lighting (fade out if in FLAT mode)
            lightIntensity = mix(1.0, lightIntensity, uMapMode);
            terrainColor *= lightIntensity;
            
            // 5. Urban structures
            // Only place cities on flat ground (lowlands), not in water or mountains
            vec2 gridUv = vUv * 20.0;
            vec2 id = floor(gridUv);
            float tileN = random(id);
            vec2 gl2 = fract(gridUv);
            float bx = step(0.96, gl2.x) + step(gl2.x, 0.04);
            float by = step(0.96, gl2.y) + step(gl2.y, 0.04);
            float isBorder = clamp(bx + by, 0.0, 1.0);
            
            // Clusters: use low-freq FBM to group cities together, modulated by AlphaEarth Urban Index
            float urbanIndex = uAlphaEarthData[50]; // Dim 50: Anthropogenic structure density
            float cityCluster = fbm(vUv * 6.0) + (urbanIndex * 0.3);
            float isBuildingMask = step(0.85 - (urbanIndex * 0.2), tileN) * step(0.65, cityCluster) * lowMask * uMapMode; 
            
            vec3 buildingColor = mix(vec3(0.25, 0.28, 0.30), vec3(0.25, 0.28, 0.30), random(id + 10.0));
            buildingColor = mix(buildingColor, vec3(0.2, 0.22, 0.24), isBorder);
            
            // 6. Roads
            // Make roads conform roughly to land, break over water
            float road1 = smoothstep(0.02, 0.0, abs(fract(vUv.x * 5.0) - 0.5));
            float road2 = smoothstep(0.02, 0.0, abs(fract(vUv.y * 5.0 + 0.25) - 0.5));
            float roads = clamp(road1 + road2, 0.0, 1.0) * (1.0 - waterMask) * uMapMode;
            vec3 roadColor = vec3(0.25, 0.27, 0.30);

            // 7. Aerial photo patches (wartime damage / bare earth)
            // Limit to landmasses
            float photoShape = fbm(vUv * 3.0 + fbm(vUv * 15.0) * 0.15);
            float photoMask = step(0.7 + fbm(vUv * 8.0) * 0.1, photoShape) * (1.0 - waterMask) * uMapMode;
            float trenchL = smoothstep(0.012, 0.0, abs(fbm(vUv * 14.0 + vec2(time*0.0005)) - 0.5)) * step(0.4, fbm(vUv * 40.0));
            vec3 photoColor = mix(vec3(0.18, 0.16, 0.14), vec3(0.45, 0.42, 0.38), trenchL) - grit * 0.12;
            
            // Compose
            vec3 col = terrainColor;
            col = mix(col, buildingColor, isBuildingMask * (1.0 - roads));
            col = mix(col, roadColor, roads * 0.6);
            col = mix(col, photoColor, photoMask * 0.6);
            col -= grit * 0.08;
            
            // SAM zones (red tint)
            col = mix(col, vec3(0.8, 0.1, 0.1), clamp(samOverlay, 0.0, 0.3));
            
            // Scorch & flash
            col = mix(col, vec3(0.02), clamp(totalScorch, 0.0, 0.9));
            col += vec3(1.0, 0.85, 0.6) * clamp(totalFlash, 0.0, 1.5);
            
            cTac = col;
        }

        // ====== MUSEUM MODE ======
        vec3 cMus = vec3(0.0);
        if (uSkinMode > 0.01) {
            float grit = random(vUv * 600.0) * 0.08;
            float h = museumH(vUv);
            vec3 board = vec3(0.96, 0.95, 0.93) - grit;
            float trF = smoothstep(0.015, 0.0, abs(fbm(vUv * 20.0) - 0.5)) * step(0.4, fbm(vUv * 30.0));
            vec3 photo = mix(vec3(0.1, 0.12, 0.15), vec3(0.85, 0.85, 0.85), trF) - grit * 1.5;
            float anno = smoothstep(0.005, 0.0, abs(fbm(vUv * 8.0 + 10.0) - 0.5)) * step(0.85, fbm(vUv * 3.0));
            photo = mix(photo, vec3(0.95), anno);
            
            vec2 e = vec2(0.003, 0.0);
            vec3 n = normalize(vec3(h - museumH(vUv + e.xy), h - museumH(vUv + e.yx), 0.012));
            vec3 ld = normalize(vec3(0.2, 0.8, 1.0) - vec3(vUv, 0.0));
            float diff = max(dot(n, ld), 0.0);
            float shadow = museumH(vUv + ld.xy * 0.005) > h ? 0.5 : 1.0;
            vec3 alb = h > 0.05 ? photo : board;
            float vig = smoothstep(1.2, 0.2, length(vUv - 0.5));
            vec3 col = alb * (diff * 0.8 + 0.3) * shadow * vig;
            col = mix(col, vec3(0.05), clamp(totalScorch, 0.0, 0.9));
            col += vec3(1.0, 0.9, 0.8) * clamp(totalFlash, 0.0, 1.0);
            cMus = col;
        }

        if (uSkinMode <= 0.01) gl_FragColor = vec4(cTac, 1.0);
        else if (uSkinMode >= 0.99) gl_FragColor = vec4(cMus, 1.0);
        else gl_FragColor = vec4(mix(cTac, cMus, uSkinMode), 1.0);
    }
`;
