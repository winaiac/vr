import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let emberSystem; 

export function loadBuddhaWithEffects(altarGroup) {
    const loader = new GLTFLoader();
    
    loader.load('bhuddha.glb', function (gltf) {
        const buddhaModel = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(buddhaModel);
        const scaleFactor = 1.1 / box.getSize(new THREE.Vector3()).y; 
        buddhaModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
        const center = new THREE.Box3().setFromObject(buddhaModel).getCenter(new THREE.Vector3());
        buddhaModel.position.set(-center.x, 0.8 - new THREE.Box3().setFromObject(buddhaModel).min.y, -center.z); 
        
        const auraCanvas = document.createElement('canvas');
        auraCanvas.width = 256; auraCanvas.height = 256;
        const ctx = auraCanvas.getContext('2d');
        const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        grad.addColorStop(0, 'rgba(255, 215, 0, 0.6)'); 
        grad.addColorStop(0.4, 'rgba(255, 140, 0, 0.2)'); 
        grad.addColorStop(1, 'rgba(255, 140, 0, 0)'); 
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
        
        const auraTex = new THREE.CanvasTexture(auraCanvas);
        const auraPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(2.5, 2.5),
            new THREE.MeshBasicMaterial({ map: auraTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
        );
        auraPlane.position.set(0, 1.0, -0.15); 
        buddhaModel.add(auraPlane);

        const buddhaLight = new THREE.PointLight(0xffdf80, 2.5, 4);
        buddhaLight.position.set(0, 1.5, 0.8);
        buddhaModel.add(buddhaLight);

        altarGroup.add(buddhaModel);
    });

    emberSystem = createLocalizedEmbers();
    emberSystem.position.set(0, 0.8, 0); 
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
            pos[i * 3] = (Math.random() - 0.5) * 1.8; 
            pos[i * 3 + 1] = Math.random() * 1.5; 
            pos[i * 3 + 2] = (Math.random() - 0.5) * 1.0; 
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
            
            if (positions[i*3+1] > 1.8) { 
                positions[i*3+1] = 0; 
                positions[i*3] = (Math.random() - 0.5) * 1.8;
                positions[i*3+2] = (Math.random() - 0.5) * 1.0;
            }
        }
        particles.geometry.attributes.position.needsUpdate = true;
    });
}