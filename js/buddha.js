import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let emberSystem; 

export function loadBuddhaWithEffects(altarGroup) {
    const tableHeight = 2.5; 

    // ==========================================
    // 1. สร้างป้าย "คำขอขมา บูชาพระรัตนตรัย" สีทองเรืองแสง (แบบมีขอบ Margin สวยงาม)
    // ==========================================
    const prayCanvas = document.createElement('canvas');
    // ขยายพื้นที่ Canvas ให้กว้างเป็นพิเศษ (Ultra Wide) เพื่อเพิ่มพื้นที่ว่างซ้ายขวา
    prayCanvas.width = 2560; 
    prayCanvas.height = 1280; 
    const pCtx = prayCanvas.getContext('2d');
    
    // วาดพื้นหลัง (กำหนดให้เว้นระยะจากขอบ Canvas เข้ามา 40px เพื่อสร้างกรอบ Margin)
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

    // หัวข้อ
    pCtx.fillStyle = '#ffdf80';
    pCtx.shadowColor = '#ffdf80';
    pCtx.shadowBlur = 20;
    pCtx.font = 'bold 90px Sarabun, sans-serif'; 
    pCtx.textAlign = 'center';
    pCtx.fillText('คำขอขมาและบูชาพระรัตนตรัย', 1280, 180);

    // เนื้อหาบทสวดท่อนบน
    pCtx.shadowBlur = 0; 
    pCtx.fillStyle = '#ffffff';
    pCtx.font = 'bold 65px Sarabun, sans-serif'; 
    pCtx.fillText('สัพพัง อะปะราธัง ขะมะถะ เม ภันเต', 1280, 360);
    pCtx.fillText('อุกาสะ ทะวารัตตะเยนะ กะตัง', 1280, 460);
    pCtx.fillText('สัพพัง อะปะราธัง ขะมะถะ เม ภันเต', 1280, 560);
    pCtx.fillText('อุกาสะ ขะมามิ ภันเต', 1280, 660);
    
    // เนื้อหาบทสวดท่อนล่าง (ประโยคยาว จะไม่ตกขอบแล้วเพราะเราขยาย Canvas เผื่อไว้กว้างมาก)
    pCtx.fillStyle = '#ffcc00';
    pCtx.font = 'bold 65px Sarabun, sans-serif'; 
    pCtx.fillText('อะระหัง สัมมาสัมพุทโธ ภะคะวา, พุทธัง ภะคะวันตัง อะภิวาเทมิ (กราบ)', 1280, 860);
    pCtx.fillText('สะวากขาโต ภะคะวะตา ธัมโม, ธัมมัง นะมัสสามิ (กราบ)', 1280, 980);
    pCtx.fillText('สุปะฏิปันโน ภะคะวะโต สาวะกะสังโฆ, สังฆัง นะมามิ (กราบ)', 1280, 1100);

    const prayTex = new THREE.CanvasTexture(prayCanvas);
    prayTex.colorSpace = THREE.SRGBColorSpace;
    
    // ปรับขนาดแผ่นป้าย 3D ให้สัมพันธ์กับ Canvas ใหม่
    const prayPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(3.8, 1.9), 
        new THREE.MeshBasicMaterial({ 
            map: prayTex, 
            transparent: true, 
            depthWrite: false,
            fog: false 
        })
    );
    
    // [แก้ไข] ขยับป้ายให้ยื่นออกมาจากหน้าโต๊ะอีกนิด (Z จาก 0.95 เป็น 0.96) เพื่อแก้ปัญหากล่องดำซ้อนทับกัน (Z-fighting)
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
    });

    // ==========================================
    // 3. ระบบดาวประกายพฤกษ์ (เอฟเฟกต์รอบองค์พระ)
    // ==========================================
    emberSystem = createLocalizedEmbers();
    emberSystem.position.set(0, tableHeight, 0); 
    altarGroup.add(emberSystem);
}

function createLocalizedEmbers() {
    const group = new THREE.Group(); // สร้าง Group เพื่อรวมดาวหลายๆ เลเยอร์

    // 1. วาด Texture ดาวประกายพฤกษ์ (ทำแค่ครั้งเดียวแล้วใช้ร่วมกัน)
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

    // 2. ฟังก์ชันย่อยสำหรับสร้างกลุ่มดาวแต่ละขนาดและความสว่าง
    function createStarLayer(size, opacity, count) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const speeds = new Float32Array(count);
        const phases = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            // ขยายขอบเขตการลอยให้ครอบคลุมพระองค์ใหญ่ (X: 3.5, Y: 4.0, Z: 2.0)
            pos[i * 3] = (Math.random() - 0.5) * 3.5; 
            pos[i * 3 + 1] = Math.random() * 4.0; 
            pos[i * 3 + 2] = (Math.random() - 0.5) * 2.0; 
            speeds[i] = 0.001 + Math.random() * 0.005; // ปรับให้ลอยช้าลงนิดนึง ดูศักดิ์สิทธิ์ขึ้น
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

    // 3. นำดาวแต่ละเลเยอร์มาใส่รวมกันใน Group
    group.add(createStarLayer(0.08, 0.3, 25));  // เลเยอร์ 1: ดวงเล็ก สว่างน้อย (พื้นหลัง)
    group.add(createStarLayer(0.18, 0.6, 15));  // เลเยอร์ 2: ดวงกลาง สว่างปานกลาง
    group.add(createStarLayer(0.35, 1.0, 8));   // เลเยอร์ 3: ดวงใหญ่ สว่างมากวิบวับ

    return group;
}

export function updateBuddhaEffects() {
    if (!emberSystem || !emberSystem.visible) return;
    
    // อัปเดตดาวประกายพฤกษ์ทุกเลเยอร์ที่อยู่ใน Group
    emberSystem.children.forEach(particles => {
        const positions = particles.geometry.attributes.position.array;
        const { speeds, phases, count } = particles.userData;
        
        for (let i = 0; i < count; i++) {
            positions[i*3+1] += speeds[i]; 
            positions[i*3] += Math.sin(Date.now()*0.001 + phases[i]) * 0.002; 
            
            // ปรับระดับความสูงสูงสุดก่อนวนกลับลงมาที่ฐาน (ขยายเป็น 4.0 ตามสเกลพระ)
            if (positions[i*3+1] > 4.0) { 
                positions[i*3+1] = 0; 
                positions[i*3] = (Math.random() - 0.5) * 3.5;
                positions[i*3+2] = (Math.random() - 0.5) * 2.0;
            }
        }
        particles.geometry.attributes.position.needsUpdate = true;
    });
}