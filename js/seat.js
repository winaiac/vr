import * as THREE from 'three';

// ==========================================
// 🎨 ฟังก์ชันวาด UI โฮโลแกรมสไตล์ ศิลปะไทย x ไซ-ไฟ
// ==========================================
function createCyberNagaBoardTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // 1. พื้นหลังกระจกโค้งมน (Rounded Glass)
    ctx.fillStyle = 'rgba(5, 15, 25, 0.85)';
    ctx.shadowBlur = 50; ctx.shadowColor = '#00e5ff';
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(40, 40, 944, 944, 80); } else { ctx.rect(40, 40, 944, 944); }
    ctx.fill();

    // กรอบนีออนเรืองแสง
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.9)';
    ctx.lineWidth = 8; ctx.stroke();

    // 2. วาดลายกนกนาคไซไฟ (มุมทั้ง 4)
    const drawKanok = (x, y, scaleX, scaleY) => {
        ctx.save(); ctx.translate(x, y); ctx.scale(scaleX, scaleY);
        // ลายหางนาค (สีฟ้า)
        ctx.strokeStyle = '#00e5ff'; ctx.shadowBlur = 20; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(0, 40);
        ctx.quadraticCurveTo(100, 40, 120, 150);
        ctx.quadraticCurveTo(130, 200, 40, 250);
        ctx.stroke();
        // เส้นเสริม (สีทอง)
        ctx.strokeStyle = '#ffd700'; ctx.shadowColor = '#ffd700'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(30, 40);
        ctx.quadraticCurveTo(110, 80, 80, 180);
        ctx.stroke(); ctx.restore();
    };

    drawKanok(40, 40, 1, 1);       // บนซ้าย
    drawKanok(984, 40, -1, 1);     // บนขวา
    drawKanok(40, 984, 1, -1);     // ล่างซ้าย
    drawKanok(984, 984, -1, -1);   // ล่างขวา

    // 3. Grid ไซไฟจางๆ
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.1)'; ctx.lineWidth = 2;
    for(let i=150; i<900; i+=120) {
        ctx.beginPath(); ctx.moveTo(80, i); ctx.lineTo(944, i); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(i, 80); ctx.lineTo(i, 944); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function createCyberCircleButton() {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.shadowBlur = 20; ctx.shadowColor = '#00e5ff';
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 12;

    // วาดทรงกลมให้เข้ากับเบาะ
    ctx.beginPath();
    ctx.arc(128, 128, 90, 0, Math.PI * 2);
    ctx.closePath();
    
    // ไล่สีจากตรงกลางออกไปขอบ
    const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 100);
    grad.addColorStop(0, 'rgba(0, 229, 255, 0.8)');
    grad.addColorStop(1, 'rgba(0, 40, 60, 0.3)');
    ctx.fillStyle = grad; ctx.fill(); ctx.stroke();

    // แกนกลางสีทอง (พอยเตอร์)
    ctx.shadowColor = '#ffd700'; ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(128, 128, 20, 0, Math.PI * 2); ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}


// ==========================================
// 💺 ฟังก์ชันหลักสร้างที่นั่งและโฮโลแกรม
// ==========================================
export function createSeatingAndHologram() {
    const cushionGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
    const seatingGroup = new THREE.Group(); 
    seatingGroup.position.set(0, 0.05, -1.5); 
    
    const cushionsList = [];
    const hologramButtons = [];

    // 1. ตั้งค่าตำแหน่งและขนาดของแท่นโฮโลแกรมรวมทั้งหมด
    const hologramGroup = new THREE.Group();
    hologramGroup.position.set(0, 1.6, 4.0); 
    hologramGroup.rotation.x = -Math.PI / 16; 
    hologramGroup.scale.set(0.6, 0.6, 0.6);

    // ฉากหลังดรอปแสง (Focus Backdrop) ซ้อนอยู่หลังโฮโลแกรม
    const backdropGeo = new THREE.PlaneGeometry(12, 8);
    const backdropMat = new THREE.MeshBasicMaterial({ color: 0x000510, transparent: true, opacity: 0.65 });
    const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
    backdrop.position.set(0, 0, -0.2); 
    hologramGroup.add(backdrop);

    // 2. ป้ายข้อความหัวข้อ (Title) บนจอโฮโลแกรม
    const holoCanvas = document.createElement('canvas'); holoCanvas.width = 512; holoCanvas.height = 128;
    const hCtx = holoCanvas.getContext('2d');
    
    const grad = hCtx.createLinearGradient(0,0,0,128);
    grad.addColorStop(0, 'rgba(0, 30, 80, 0.8)');
    grad.addColorStop(1, 'rgba(0, 10, 30, 0.8)');
    hCtx.fillStyle = grad; 
    hCtx.fillRect(0, 0, 512, 128);
    
    hCtx.strokeStyle = '#00ffcc'; hCtx.lineWidth = 3; hCtx.strokeRect(2, 2, 508, 124);
    hCtx.fillStyle = '#ffffff'; hCtx.font = 'bold 42px Sarabun'; hCtx.textAlign = 'center'; hCtx.textBaseline = 'middle';
    hCtx.shadowColor = '#00ffcc'; hCtx.shadowBlur = 10;
    hCtx.fillText('ทัชหน้าจอเพื่อวาร์ปไปที่นั่ง', 256, 64);
    
    const holoTitleMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(holoCanvas), transparent: true, blending: THREE.AdditiveBlending });
    const holoTitle = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), holoTitleMat);
    holoTitle.position.set(-0.21, 1.55, 0);
    hologramGroup.add(holoTitle);

    // 3. 🔴 เปลี่ยนจากกระจกสี่เหลี่ยมธรรมดา มาใช้ Texture ลายกนกไซ-ไฟ
    const holoBaseGeo = new THREE.PlaneGeometry(3.0, 3.0);
    const boardMat = new THREE.MeshBasicMaterial({ 
        map: createCyberNagaBoardTexture(), 
        transparent: true, side: THREE.DoubleSide
    });
    const holoBase = new THREE.Mesh(holoBaseGeo, boardMat);
    holoBase.position.set(-0.21, -0.15, 0);
    hologramGroup.add(holoBase);

    // ขนาดของปุ่มที่นั่งแต่ละปุ่มบนจอโฮโลแกรม
    const holoBtnGeo = new THREE.PlaneGeometry(0.35, 0.35);
    
    // 🔴 สร้าง Texture ปุ่มดอกบัวไซ-ไฟ รอไว้
    // 🔴 เปลี่ยน Texture ปุ่มเป็นทรงกลมไซ-ไฟ
    const circleTex = createCyberCircleButton();

    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 6; c++) {
            // เบาะจริงในลาน
            let xPos = (c < 3) ? (c - 3) * 1.2 - 0.5 : (c - 4) * 1.2 + 1.2 + 0.5;
            const cushion = new THREE.Mesh(cushionGeo, new THREE.MeshStandardMaterial({ color: 0x3b2219 }));
            cushion.position.set(xPos, 0, r * 1.1);
            cushion.userData = { row: r + 1, col: c + 1, isOccupied: false, isMine: false };
            seatingGroup.add(cushion); 
            cushionsList.push(cushion);

            // 4. ปุ่มโฮโลแกรมทรงกลม
            const btnMat = new THREE.MeshBasicMaterial({ 
                map: circleTex, transparent: true, color: 0xffffff, blending: THREE.AdditiveBlending 
            });
            const holoBtn = new THREE.Mesh(holoBtnGeo, btnMat);
            
            const hX = (c < 3) ? (c - 3) * 0.42 - 0.15 : (c - 4) * 0.42 + 0.15 + 0.42;
            const hY = 0.8 - (r * 0.42); 
            
            holoBtn.position.set(hX, hY, 0.02);
            holoBtn.userData = { isHologramBtn: true, targetCushion: cushion, isClicked: false, clickTime: 0 };
            hologramGroup.add(holoBtn);
            hologramButtons.push(holoBtn);
            
            cushion.userData.holoBtn = holoBtn; 
        }
    }

    // ==========================================
    // 🌟 5. เพิ่มระบบแอนิเมชันให้โฮโลแกรม
    // ==========================================
    hologramGroup.userData.spawnTime = Date.now();

    hologramGroup.update = function() {
        const now = Date.now();
        const elapsed = now - this.userData.spawnTime;
        
        // แอนิเมชันตอนเปิดตัวโฮโลแกรม (เด้งดึ๋ง Elastic)
        if (elapsed < 1200) {
            const t = elapsed / 1200;
            const scale = Math.sin(-13.0 * (t + 1.0) * Math.PI / 2) * Math.pow(2.0, -10.0 * t) + 1.0;
            this.scale.set(scale * 0.6, scale * 0.6, scale * 0.6); // คูณ 0.6 ตาม scale เริ่มต้นของกรุ๊ป
        } else {
            this.scale.set(0.6, 0.6, 0.6);
        }
        
        // แอนิเมชันปุ่มดอกบัว (ลอยหายใจเบาๆ + พองตัวตอนทัช)
        this.children.forEach((child, index) => {
            if (child.userData.isHologramBtn) {
                let targetScale = 1.0;
                
                // ลอยหายใจเบาๆ
                targetScale += Math.sin(now * 0.003 + index) * 0.06;
                
                // พองตัวกระเพื่อมตอนโดนสัมผัส (Touch Ripple)
                if (child.userData.isClicked) {
                    const clickElapsed = now - child.userData.clickTime;
                    if (clickElapsed < 600) {
                        targetScale = 1.0 + Math.sin(clickElapsed * 0.015) * 0.4;
                    }
                }
                child.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.2);
            }
        });
    };

    return { seatingGroup, hologramGroup, cushionsList, hologramButtons };
}