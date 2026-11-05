import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let emberSystem; 
// เพิ่มตัวแปรเก็บแสงไฟขอขมา
export let praySpotLight; 

export function loadBuddhaWithEffects(altarGroup) {
    const tableHeight = 2.5; 

    // ==========================================
    // 1. สร้างป้าย "คำขอขมา บูชาพระรัตนตรัย" สีทองเรืองแสง
    // ==========================================
    const prayCanvas = document.createElement('canvas');
    prayCanvas.width = 2560; 
    prayCanvas.height = 1280; 
    const pCtx = prayCanvas.getContext('2d');
    
    pCtx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    if (pCtx.roundRect) {
        pCtx.roundRect(40, 40, 2480, 1200, 40);
    } else {
        pCtx.fillRect(40, 40, 2480, 1200);
    }
    pCtx.fill();
    pCtx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
    pCtx.lineWidth = 10;
    pCtx.stroke();

    pCtx.fillStyle = '#ffdf80';
    pCtx.shadowColor = '#ffdf80';
    pCtx.shadowBlur = 20;
    pCtx.font = 'bold 90px Sarabun, sans-serif'; 
    pCtx.textAlign = 'center';
    pCtx.fillText('คำขอขมาและบูชาพระรัตนตรัย', 1280, 180);

    pCtx.shadowBlur = 0; 
    pCtx.fillStyle = '#ffffff';
    pCtx.font = 'bold 65px Sarabun, sans-serif'; 
    pCtx.fillText('สัพพัง อะปะราธัง ขะมะถะ เม ภันเต', 1280, 360);
    pCtx.fillText('อุกาสะ ทะวารัตตะเยนะ กะตัง', 1280, 460);
    pCtx.fillText('สัพพัง อะปะราธัง ขะมะถะ เม ภันเต', 1280, 560);
    pCtx.fillText('อุกาสะ ขะมามิ ภันเต', 1280, 660);
    
    pCtx.fillStyle = '#ffcc00';
    pCtx.font = 'bold 65px Sarabun, sans-serif'; 
    pCtx.fillText('อะระหัง สัมมาสัมพุทโธ ภะคะวา, พุทธัง ภะคะวันตัง อะภิวาเทมิ (กราบ)', 1280, 860);
    pCtx.fillText('สะวากขาโต ภะคะวะตา ธัมโม, ธัมมัง นะมัสสามิ (กราบ)', 1280, 980);
    pCtx.fillText('สุปะฏิปันโน ภะคะวะโต สาวะกะสังโฆ, สังฆัง นะมามิ (กราบ)', 1280, 1100);

    const prayTex = new THREE.CanvasTexture(prayCanvas);
    prayTex.colorSpace = THREE.SRGBColorSpace;
    
    const prayPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(3.8, 1.9), 
        new THREE.MeshBasicMaterial({ 
            map: prayTex, 
            transparent: true, 
            depthWrite: false,
            fog: false 
        })
    );
    
    prayPlane.position.set(0, tableHeight - 0.75, 1.10);
    prayPlane.rotation.x = -Math.PI / 12; 
    
    altarGroup.add(prayPlane);

    // ==========================================
    // 2. โหลดและขยายองค์พระประธาน
    // ==========================================
    const loader = new GLTFLoader();
    
    loader.load('bhuddha.glb', function (gltf) {
        const buddhaModel = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(buddhaModel);
        const scaleFactor = 3.2 / box.getSize(new THREE.Vector3()).y; 
        buddhaModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
        const center = new THREE.Box3().setFromObject(buddhaModel).getCenter(new THREE.Vector3());
        
        buddhaModel.position.set(-center.x, tableHeight - new THREE.Box3().setFromObject(buddhaModel).min.y, -center.z); 
        
        const auraCanvas = document.createElement('canvas');
        auraCanvas.width = 256; auraCanvas.height = 256;
        const ctx = auraCanvas.getContext('2d');
        const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0, 'rgba(255, 215, 0, 0.8)'); 
        grad.addColorStop(0.4, 'rgba(255, 140, 0, 0.3)'); 
        grad.addColorStop(1, 'rgba(255, 140, 0, 0)'); 
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
        
        const auraTex = new THREE.CanvasTexture(auraCanvas);
        const auraPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(4.5, 4.5), 
            new THREE.MeshBasicMaterial({ map: auraTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
        );
        auraPlane.position.set(0, tableHeight + 1.2, -0.2); 
        buddhaModel.add(auraPlane);

        const buddhaLight = new THREE.PointLight(0xffdf80, 5.0, 8); 
        buddhaLight.position.set(0, tableHeight + 1.5, 1.5);
        buddhaModel.add(buddhaLight);

        const spotLight = new THREE.SpotLight(0xffffff, 4.0);
        spotLight.position.set(0, tableHeight + 3.0, 2.0);
        spotLight.target = buddhaModel;
        spotLight.angle = Math.PI / 5;
        spotLight.penumbra = 0.5;
        buddhaModel.add(spotLight);

        altarGroup.add(buddhaModel);

        // ==========================================
        // เพิ่มใหม่: สร้าง SpotLight สำหรับฉายแสงตอนขอขมา
        // ==========================================
        praySpotLight = new THREE.SpotLight(0xffffff, 0); // เริ่มต้นที่ความสว่าง 0 (ปิดไฟ)
        praySpotLight.position.set(0, tableHeight + 4.0, 3.0); // ยกสูงขึ้นและถอยออกมาเพื่อให้ส่องครอบคลุม
        praySpotLight.target = buddhaModel; // เล็งไปที่พระประธาน
        praySpotLight.angle = Math.PI / 4; // ความกว้างของลำแสง
        praySpotLight.penumbra = 0.5; // ขอบแสงฟุ้งนุ่มนวล
        praySpotLight.distance = 15; // ระยะส่องสว่าง
        praySpotLight.decay = 2; // การดรอปของแสงสมจริง
        
        altarGroup.add(praySpotLight);
        altarGroup.add(praySpotLight.target); // ต้องแอด target เข้ากรุ๊ปด้วยเสมอ
    });

    // ==========================================
    // 3. ระบบดาวประกายพฤกษ์ (เอฟเฟกต์รอบองค์พระ)
    // ==========================================
    emberSystem = createLocalizedEmbers();
    emberSystem.position.set(0, tableHeight, 0); 
    altarGroup.add(emberSystem);
}

function createLocalizedEmbers() {
    const group = new THREE.Group(); 

    const canvas = document.createElement('canvas');
    canvas.width = 64; canvas.height = 64; 
    const ctx = canvas.getContext('2d');
    const cx = 32, cy = 32, r = 30;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.15, 'rgba(255, 220, 100, 0.8)');
    grad.addColorStop(0.4, 'rgba(255, 150, 0, 0.2)');
    grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); 
    ctx.quadraticCurveTo(cx, cy, cx + r, cy); 
    ctx.quadraticCurveTo(cx, cy, cx, cy + r); 
    ctx.quadraticCurveTo(cx, cy, cx - r, cy); 
    ctx.quadraticCurveTo(cx, cy, cx, cy - r); 
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);

    function createStarLayer(size, opacity, count) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const speeds = new Float32Array(count);
        const phases = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 3.5; 
            pos[i * 3 + 1] = Math.random() * 4.0; 
            pos[i * 3 + 2] = (Math.random() - 0.5) * 2.0; 
            
            // ==============================================================
            // [ปรับแต่งได้: 1. ความเร็วในการลอยตัวขึ้นด้านบน (Vertical Speed)]
            // ==============================================================
            // ค่าเดิม: 0.001 + Math.random() * 0.005 
            // ค่าใหม่: 0.005 + Math.random() * 0.015 (เร็วขึ้น 3 เท่า)
            // 👉 ถ้าอยากให้ดาวพุ่งเร็วขึ้นอีก ให้เพิ่มตัวเลข 0.005 และ 0.015 ให้มากขึ้น
            speeds[i] = 0.005 + Math.random() * 0.015; 
            
            phases[i] = Math.random() * Math.PI * 2;
        }
        
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        
        const mat = new THREE.PointsMaterial({ 
            size: size, map: texture, transparent: true, 
            opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending 
        });
        
        const particles = new THREE.Points(geo, mat);
        particles.userData = { speeds, phases, count };
        return particles;
    }

    group.add(createStarLayer(0.08, 0.3, 25));  
    group.add(createStarLayer(0.18, 0.6, 15));  
    group.add(createStarLayer(0.35, 1.0, 8));   

    return group;
}

export function updateBuddhaEffects() {
    if (!emberSystem || !emberSystem.visible) return;
    
    emberSystem.children.forEach(particles => {
        const positions = particles.geometry.attributes.position.array;
        const { speeds, phases, count } = particles.userData;
        
        for (let i = 0; i < count; i++) {
            // ดันดาวให้ลอยขึ้นตามค่า speed ที่เราเพิ่มไว้
            positions[i*3+1] += speeds[i]; 
            
            // ==============================================================
            // [ปรับแต่งได้: 2. ความเร็วในการส่ายไปมาระหว่างลอย (Sway Speed)]
            // ==============================================================
            // ค่าเดิม: Date.now() * 0.001 (ส่ายช้าๆ) และ * 0.002 (รัศมีการส่ายแคบๆ)
            // ค่าใหม่: Date.now() * 0.003 (ส่ายเร็วขึ้น 3 เท่า) และ * 0.004 (รัศมีการส่ายกว้างขึ้น 2 เท่า)
            // 👉 ถ้าอยากให้ดาวส่ายวิบวับเหมือนมีลมพัดแรงๆ ให้เพิ่มเลข 0.003 ให้มากขึ้น
            // 👉 ถ้าอยากให้วงสวิงกว้างขึ้น ให้เพิ่มเลข 0.004 ให้มากขึ้น
            positions[i*3] += Math.sin(Date.now() * 0.003 + phases[i]) * 0.004; 
            
            if (positions[i*3+1] > 4.0) { 
                positions[i*3+1] = 0; 
                positions[i*3] = (Math.random() - 0.5) * 3.5;
                positions[i*3+2] = (Math.random() - 0.5) * 2.0;
            }
        }
        particles.geometry.attributes.position.needsUpdate = true;
    });
}

// ==========================================
// เพิ่มใหม่: ฟังก์ชันสำหรับค่อยๆ หรี่/เร่งแสงไฟขอขมา
// ==========================================
let prayLightInterval;
export function togglePrayLight(isOn) {
    if (!praySpotLight) return;
    
    clearInterval(prayLightInterval);
    
    // ตั้งค่าเป้าหมายความสว่าง: ถ้าเปิดให้สว่าง 15.0, ถ้าปิดให้เป็น 0
    const targetIntensity = isOn ? 15.0 : 0.0; 
    
    prayLightInterval = setInterval(() => {
        // ค่อยๆ ปรับความสว่างทีละนิด (Lerp effect)
        praySpotLight.intensity += (targetIntensity - praySpotLight.intensity) * 0.1;
        
        // ถ้าความสว่างใกล้เคียงเป้าหมายแล้ว ให้หยุดลูป
        if (Math.abs(praySpotLight.intensity - targetIntensity) < 0.1) {
            praySpotLight.intensity = targetIntensity;
            clearInterval(prayLightInterval);
        }
    }, 30);
}