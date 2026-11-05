import * as THREE from 'three';

export function createSeatingAndHologram() {
    const cushionGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
    const seatingGroup = new THREE.Group(); 
    seatingGroup.position.set(0, 0.05, -1.5); 
    
    const cushionsList = [];
    const hologramButtons = [];

    // 1. ตั้งค่าตำแหน่งและขนาดของแท่นโฮโลแกรมรวมทั้งหมด
    const hologramGroup = new THREE.Group();
    
    // [ปรับแก้ตำแหน่งโฮโลแกรมรวม] พิกัด (X: ซ้าย-ขวา, Y: ขึ้น-ลง, Z: หน้า-หลัง)
    // - Y = 1.6 ดันหน้าจอให้สูงขึ้น เพื่อให้พ้นเมนู UI ด้านล่าง
    // - Z = 4.0 คือระยะห่างจากกล้องที่ยืนอยู่ (ถอยออกไป 2 เมตร)
    hologramGroup.position.set(0, 1.6, 4.0); 
    
    // [ปรับความแหงนของหน้าจอ] ยิ่งค่าน้อยยิ่งเงยหน้าขึ้น
    hologramGroup.rotation.x = -Math.PI / 16; 
    
    // [ปรับขนาดโฮโลแกรมรวม] (X: กว้าง, Y: สูง, Z: ลึก)
    // 0.6 คือย่อลงเหลือ 60% จากขนาดจริง เพื่อไม่ให้บังวิว
    hologramGroup.scale.set(0.6, 0.6, 0.6);

    // ==========================================
    // ฉากหลังดรอปแสง (Focus Backdrop) ซ้อนอยู่หลังโฮโลแกรม
    const backdropGeo = new THREE.PlaneGeometry(12, 8);
    const backdropMat = new THREE.MeshBasicMaterial({ color: 0x000510, transparent: true, opacity: 0.65 });
    const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
    backdrop.position.set(0, 0, -0.2); // ถอยไปอยู่หลังสุดของกรุ๊ป
    hologramGroup.add(backdrop);
    // ==========================================

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
    
    // [ปรับขนาดป้ายข้อความ] (ความกว้าง 2.2, ความสูง 0.55)
    const holoTitle = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), holoTitleMat);
    
    // [ปรับตำแหน่งป้ายข้อความ] ขยับแกน Y ขึ้นเพื่อให้ลอยอยู่เหนือกระจก
    holoTitle.position.set(-0.21, 1.55, 0);
    hologramGroup.add(holoTitle);

    // 3. กรอบใสของจอโฮโลแกรม (แผงกระจกด้านหลังปุ่มที่นั่ง)
    // [ปรับขนาดแผงกระจก] กว้าง 3.0, สูง 2.6 เพื่อให้คลุมปุ่มที่นั่งได้หมด ไม่ตกขอบ
    const holoBaseGeo = new THREE.PlaneGeometry(3.0, 2.6);
    const holoBaseMat = new THREE.MeshBasicMaterial({ color: 0x001122, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const holoBase = new THREE.Mesh(holoBaseGeo, holoBaseMat);
    
    // [ปรับตำแหน่งแผงกระจก] ขยับแกน Y ลงมา -0.15 ให้อยู่กึ่งกลางปุ่มพอดี
    holoBase.position.set(-0.21, -0.15, 0);
    
    const edges = new THREE.EdgesGeometry(holoBaseGeo);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00ffcc, linewidth: 2, transparent: true, opacity: 0.5 }));
    holoBase.add(line);
    
    hologramGroup.add(holoBase);

    // ขนาดของปุ่มที่นั่งแต่ละปุ่มบนจอโฮโลแกรม (0.35 x 0.35)
    const holoBtnGeo = new THREE.PlaneGeometry(0.35, 0.35);

    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 6; c++) {
            // เบาะจริงในลาน
            let xPos = (c < 3) ? (c - 3) * 1.2 - 0.5 : (c - 4) * 1.2 + 1.2 + 0.5;
            const cushion = new THREE.Mesh(cushionGeo, new THREE.MeshStandardMaterial({ color: 0x3b2219 }));
            cushion.position.set(xPos, 0, r * 1.1);
            cushion.userData = { row: r + 1, col: c + 1, isOccupied: false, isMine: false };
            seatingGroup.add(cushion); 
            cushionsList.push(cushion);

            // 4. ปุ่มที่นั่งจำลองบนจอโฮโลแกรม
            const holoMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
            const holoBtn = new THREE.Mesh(holoBtnGeo, holoMat);
            
            // สมการคำนวณตำแหน่งปุ่มให้เรียงกัน (hX=แกนแนวนอน, hY=แกนแนวตั้ง)
            const hX = (c < 3) ? (c - 3) * 0.42 - 0.15 : (c - 4) * 0.42 + 0.15 + 0.42;
            const hY = 0.8 - (r * 0.42); 
            
            holoBtn.position.set(hX, hY, 0.02);
            holoBtn.userData = { isHologramBtn: true, targetCushion: cushion };
            hologramGroup.add(holoBtn);
            hologramButtons.push(holoBtn);
            
            cushion.userData.holoBtn = holoBtn; 
        }
    }

    return { seatingGroup, hologramGroup, cushionsList, hologramButtons };
}