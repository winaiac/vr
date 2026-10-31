import * as THREE from 'three';

let firefliesSystem;

export function createFireflies() {
    const particleCount = 200; 
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    const speeds = new Float32Array(particleCount);
    const initialPositions = new Float32Array(particleCount * 3); 

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 40;     
        positions[i * 3 + 1] = Math.random() * 5 + 0.5;          
        positions[i * 3 + 2] = (Math.random() - 0.5) * 40; 
        
        initialPositions[i * 3] = positions[i * 3];
        initialPositions[i * 3 + 1] = positions[i * 3 + 1];
        initialPositions[i * 3 + 2] = positions[i * 3 + 2];

        phases[i] = Math.random() * Math.PI * 2; 
        // [แก้ใหม่] ปรับให้ความเร็วกระพริบช้าลงและหลากหลายขึ้น
        speeds[i] = 0.3 + Math.random() * 0.7;   
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0xd4ff00) } // เหลืองอมเขียว
        },
        vertexShader: `
            uniform float uTime;
            attribute float aPhase;
            attribute float aSpeed;
            varying float vAlpha;
            void main() {
                // [แก้ใหม่] ใช้ smoothstep ช่วยให้จังหวะกระพริบมีช่วงดับสนิทและสว่างวาบสลับกันชัดเจน
                vAlpha = smoothstep(-0.2, 0.8, sin(uTime * aSpeed + aPhase)); 
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = (15.0 + vAlpha * 25.0) * (1.0 / -mvPosition.z); 
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            uniform vec3 uColor;
            varying float vAlpha;
            void main() {
                float dist = distance(gl_PointCoord, vec2(0.5));
                if (dist > 0.5) discard;
                float alpha = smoothstep(0.5, 0.0, dist);
                gl_FragColor = vec4(uColor, alpha * vAlpha * 0.9);
            }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    firefliesSystem = new THREE.Points(geometry, material);
    firefliesSystem.userData = { initialPositions, phases, speeds };
    return firefliesSystem;
}

export function updateFireflies() {
    if (!firefliesSystem || !firefliesSystem.visible) return;

    const time = Date.now() * 0.001;
    firefliesSystem.material.uniforms.uTime.value = time; 

    const positions = firefliesSystem.geometry.attributes.position.array;
    const { initialPositions, phases, speeds } = firefliesSystem.userData;

    for (let i = 0; i < positions.length / 3; i++) {
        // [แก้ใหม่] ลดตัวคูณเวลาลง เพื่อให้หิ่งห้อยบินช้าๆ เอื่อยๆ สโลว์โมชัน
        positions[i * 3] = initialPositions[i * 3] + Math.sin(time * 0.05 * speeds[i] + phases[i]) * 2.0; 
        positions[i * 3 + 1] = initialPositions[i * 3 + 1] + Math.sin(time * 0.03 * speeds[i] + phases[i]) * 1.0; 
        positions[i * 3 + 2] = initialPositions[i * 3 + 2] + Math.cos(time * 0.04 * speeds[i] + phases[i]) * 2.0; 
    }
    
    firefliesSystem.geometry.attributes.position.needsUpdate = true;
}