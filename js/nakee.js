import * as THREE from 'three';

// 🖌️ ฟังก์ชันวาดลายเกล็ดลางๆ
function createScaleTexture() {
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 256;
    const ctx = cvs.getContext('2d');
    ctx.fillStyle = '#ffffff'; 
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)'; 
    ctx.lineWidth = 4;
    
    for (let y = 0; y <= 256; y += 32) {
        for (let x = 0; x <= 256; x += 32) {
            let offsetX = (y % 64 === 0) ? 0 : 16;
            ctx.beginPath();
            ctx.arc(x + offsetX, y, 20, 0, Math.PI);
            ctx.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(cvs);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 2); 
    return tex;
}

// 🏷️ ฟังก์ชันสร้างป้ายชื่อแขวนคอ
function createBadgeTexture(text) {
    const cvs = document.createElement('canvas');
    cvs.width = 256; cvs.height = 128;
    const ctx = cvs.getContext('2d');
    
    // พื้นหลังป้ายสีทอง/เหลือง
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 108, 20);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // ข้อความบนป้าย
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 50px Sarabun, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 64);

    const tex = new THREE.CanvasTexture(cvs);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// 🎨 วัสดุมาตรฐานสำหรับพญานาค
export const defaultBodyMat = new THREE.MeshStandardMaterial({ color: 0x00b159, roughness: 0.6, map: createScaleTexture() }); 
export const defaultBellyMat = new THREE.MeshStandardMaterial({ color: 0xffe680, roughness: 0.6 }); 
const goldMat = new THREE.MeshStandardMaterial({ 
    color: 0xffd700, 
    metalness: 0.7, 
    roughness: 0.3,
    emissive: 0xffcc00, // 🔴 เพิ่มสีเรืองแสง (เหลืองทอง)
    emissiveIntensity: 0.5 // 🔴 ความสว่างของการเรืองแสง
});
const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
export const pupilMat = new THREE.MeshBasicMaterial({ color: 0x5C4033 }); 
const blushMat = new THREE.MeshBasicMaterial({ color: 0xff6688, transparent: true, opacity: 0.5 });
const mouthMat = new THREE.MeshBasicMaterial({ color: 0xff5555 });

// 🐉 ฟังก์ชันหลักสำหรับสร้างน้องพญานาค (ส่งข้อความป้ายชื่อเข้าไปได้)
export function createNakee(badgeText = "รปภ.") {
    const nagaGroup = new THREE.Group();

    // 1. ฐานลำตัว
    const coilGeo = new THREE.SphereGeometry(1.2, 32, 16);
    const coil1 = new THREE.Mesh(coilGeo, defaultBodyMat);
    coil1.scale.set(1, 0.25, 1);
    coil1.position.y = 0.25;
    nagaGroup.add(coil1);

    const coil2 = new THREE.Mesh(coilGeo, defaultBodyMat);
    coil2.scale.set(0.8, 0.25, 0.8);
    coil2.position.y = 0.55;
    nagaGroup.add(coil2);

    // 2. ลำคอ
    const neckGeo = new THREE.CapsuleGeometry(0.35, 1.2, 4, 16);
    const neck = new THREE.Mesh(neckGeo, defaultBodyMat);
    neck.position.set(0, 1.2, 0.4);
    neck.rotation.x = Math.PI / 12; 
    nagaGroup.add(neck);

    // 3. ท้อง
    const bellyGeo = new THREE.CapsuleGeometry(0.25, 1.1, 4, 16);
    const belly = new THREE.Mesh(bellyGeo, defaultBellyMat);
    belly.position.set(0, 1.15, 0.6);
    belly.rotation.x = Math.PI / 12;
    nagaGroup.add(belly);

    // 🔴 สายคล้องคอ + ป้ายชื่อ
    const collarGeo = new THREE.TorusGeometry(0.36, 0.02, 16, 32);
    const collar = new THREE.Mesh(collarGeo, mouthMat); 
    // ปรับเชือกให้สูงขึ้นนิดนึง
    collar.position.set(0, 1.25, 0.55);
    collar.rotation.x = Math.PI / 2 + 0.2;
    nagaGroup.add(collar);

    const badgeGeo = new THREE.PlaneGeometry(0.4, 0.2);
    const badgeMat = new THREE.MeshBasicMaterial({ map: createBadgeTexture(badgeText), transparent: true });
    const badge = new THREE.Mesh(badgeGeo, badgeMat);
    // 🔴 ขยับป้ายให้สูงขึ้น (y จาก 0.85 เป็น 0.92) และขยับมาข้างหน้า (z จาก 0.72 เป็น 0.78)
    badge.position.set(0, 1.12, 0.89);
    badge.rotation.x = 0.13; // ปรับให้ป้ายไม่ก้มมากไป
    nagaGroup.add(badge);

    // 4. ส่วนหัว
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.1, 0.7);
    nagaGroup.add(headGroup);
    
    const headGeo = new THREE.SphereGeometry(0.7, 32, 32);
    const head = new THREE.Mesh(headGeo, defaultBodyMat);
    headGroup.add(head);

    // จมูก/ปาก
    const snoutGeo = new THREE.SphereGeometry(0.35, 32, 16);
    const snout = new THREE.Mesh(snoutGeo, defaultBellyMat);
    snout.position.set(0, -0.15, 0.52);
    snout.scale.set(1.1, 0.7, 0.7); 
    headGroup.add(snout);

    // รอยยิ้ม
    const smileGeo = new THREE.TorusGeometry(0.12, 0.015, 16, 32, Math.PI);
    const smile = new THREE.Mesh(smileGeo, mouthMat);
    smile.position.set(0, -0.22, 0.73); 
    smile.rotation.z = Math.PI; 
    smile.rotation.x = -Math.PI / 12; 
    headGroup.add(smile);

    // ตา
    const eyeGeo = new THREE.SphereGeometry(0.18, 16, 16);
    const pupilGeo = new THREE.SphereGeometry(0.07, 16, 16);
    
    const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    leftEye.position.set(-0.3, 0.2, 0.5);
    const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
    leftPupil.scale.set(1, 1, 0.2); 
    leftPupil.position.set(-0.06, 0.02, 0.17); 
    leftPupil.rotation.y = -Math.PI / 6; 
    leftEye.add(leftPupil);
    headGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
    rightEye.position.set(0.3, 0.2, 0.5);
    const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
    rightPupil.scale.set(1, 1, 0.2); 
    rightPupil.position.set(0.06, 0.02, 0.17); 
    rightPupil.rotation.y = Math.PI / 6; 
    rightEye.add(rightPupil);
    headGroup.add(rightEye);

    // แก้มแดง
    const blushGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const leftBlush = new THREE.Mesh(blushGeo, blushMat);
    leftBlush.position.set(-0.45, -0.05, 0.5);
    headGroup.add(leftBlush);
    const rightBlush = new THREE.Mesh(blushGeo, blushMat);
    rightBlush.position.set(0.45, -0.05, 0.5);
    headGroup.add(rightBlush);

    // หงอนพญานาคสีทอง
    const crestShape = new THREE.Shape();
    crestShape.moveTo(0.05, 0); 
    crestShape.bezierCurveTo(0.15, 0.4, 0.1, 0.7, -0.1, 0.85); 
    crestShape.quadraticCurveTo(-0.1, 0.5, -0.25, 0.65); 
    crestShape.quadraticCurveTo(-0.25, 0.4, -0.4, 0.45); 
    crestShape.lineTo(-0.45, 0); 
    
    const extrudeSettings = { depth: 0.06, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };
    const crestGeo = new THREE.ExtrudeGeometry(crestShape, extrudeSettings);
    crestGeo.center(); 
    const crest = new THREE.Mesh(crestGeo, goldMat);
    crest.position.set(0, 0.7, -0.2); 
    crest.rotation.y = Math.PI / 2; 
    headGroup.add(crest);

    // หาง
    const tailGeo = new THREE.ConeGeometry(0.15, 1.2, 16);
    const tail = new THREE.Mesh(tailGeo, defaultBodyMat);
    tail.position.set(1.0, 0.2, -0.5);
    tail.rotation.z = -Math.PI / 3;
    tail.rotation.x = Math.PI / 2;
    nagaGroup.add(tail);

    // ⚙️ ตัวแปรสำหรับคุมอนิเมชันแต่ละตัวให้ไม่พร้อมกัน
    nagaGroup.userData = { 
        head: headGroup, 
        leftEye: leftEye, 
        rightEye: rightEye,
        lastBlinkTime: Date.now() + Math.random() * 2000,
        nextBlinkDelay: Math.random() * 3000 + 2000,
        isBlinking: false,
        timeOffset: Math.random() * 100 // ส่ายหัวคนละจังหวะ
    };

    // 🏃‍♂️ ฟังก์ชันอัปเดตการขยับ (เรียกใช้จาก main loop)
    nagaGroup.update = function(time, now) {
        const t = time + this.userData.timeOffset;
        
        // ส่ายหัวดุ๊กดิ๊ก
        this.userData.head.rotation.y = Math.sin(t * 2) * 0.1;
        this.userData.head.rotation.z = Math.cos(t * 1.5) * 0.05;
        this.userData.head.position.y = 2.1 + (Math.sin(t * 3) * 0.02);

        // กระพริบตา
        if (!this.userData.isBlinking && (now - this.userData.lastBlinkTime > this.userData.nextBlinkDelay)) {
            this.userData.isBlinking = true;
            this.userData.leftEye.scale.y = 0.1;
            this.userData.rightEye.scale.y = 0.1;
            
            setTimeout(() => {
                this.userData.leftEye.scale.y = 1.0;
                this.userData.rightEye.scale.y = 1.0;
                this.userData.isBlinking = false;
                this.userData.lastBlinkTime = Date.now();
                this.userData.nextBlinkDelay = Math.random() * 3000 + 2000;
            }, 150); 
        }
    };

    return nagaGroup;
}