import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

export function setupRealmScene(renderer, cssRenderer, currentUserName) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1.8, 3.5);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, -4.0);
    controls.enablePan = false; controls.minDistance = 1.5; controls.maxDistance = 25.0;

    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.8; 
    controls.addEventListener('start', () => { controls.autoRotate = false; });

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const pointLight = new THREE.PointLight(0xffffff, 1, 20); pointLight.position.set(0, 5, -4); scene.add(pointLight);

    const textureLoader = new THREE.TextureLoader();
    const masterRoomGroup = new THREE.Group(); scene.add(masterRoomGroup); masterRoomGroup.visible = false;

    // Stage Ring
    const stageGroup = new THREE.Group(); stageGroup.position.set(0, 0, -4.5); masterRoomGroup.add(stageGroup);
    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(2, 0.02, 16, 64), new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.8 }));
    ringMesh.rotation.x = -Math.PI / 2; ringMesh.position.y = 0.05; stageGroup.add(ringMesh);

    // YouTube Display
    const tvGroup = new THREE.Group(); tvGroup.position.set(-4.8, 2.5, -3.5); tvGroup.rotation.y = Math.PI / 8; masterRoomGroup.add(tvGroup);
    const tvWireframe = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.2, 3.6, 0.02)), new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6 }));
    tvGroup.add(tvWireframe);
    
    const div = document.createElement('div');
    div.style.width = '600px'; div.style.height = '340px'; div.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    div.style.display = 'none'; 

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%'; iframe.style.height = '100%'; iframe.style.border = 'none'; iframe.allowFullscreen = true;
    div.appendChild(iframe);
    
    const cssObject = new CSS3DObject(div); cssObject.position.set(0, 0, 0.02); cssObject.scale.set(0.01, 0.01, 0.01); tvGroup.add(cssObject);
    cssObject.visible = false; 

    // Info Board
    const infoBoardGroup = new THREE.Group(); infoBoardGroup.position.set(4.8, 2.2, -3.5); infoBoardGroup.rotation.y = -Math.PI / 8; masterRoomGroup.add(infoBoardGroup);
    const boardCanvas = document.createElement('canvas'); boardCanvas.width = 600; boardCanvas.height = 800;
    const boardCtx = boardCanvas.getContext('2d'); const boardTexture = new THREE.CanvasTexture(boardCanvas);
    const boardPlane = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.0), new THREE.MeshBasicMaterial({ map: boardTexture, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    infoBoardGroup.add(boardPlane);

    // --- Smoke Particles (ควัน) ---
    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = 128; smokeCanvas.height = 128;
    const sCtx = smokeCanvas.getContext('2d');
    const sGradient = sCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
    sGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)'); 
    sGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)');
    sGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    sCtx.fillStyle = sGradient; sCtx.fillRect(0, 0, 128, 128);
    const smokeTexture = new THREE.CanvasTexture(smokeCanvas);
    smokeTexture.needsUpdate = true;

    const smokeGeo = new THREE.BufferGeometry(); const smokeCount = 150;
    const smokePos = new Float32Array(smokeCount * 3), smokeSpeeds = new Float32Array(smokeCount), smokePhases = new Float32Array(smokeCount);
    for (let i = 0; i < smokeCount; i++) {
        smokePos[i * 3] = (Math.random() - 0.5) * 15; smokePos[i * 3 + 1] = (Math.random() - 0.5) * 6; smokePos[i * 3 + 2] = (Math.random() - 0.5) * 15 - 2;
        smokeSpeeds[i] = 0.005 + Math.random() * 0.015; smokePhases[i] = Math.random() * Math.PI * 2;
    }
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
    const smokeMat = new THREE.PointsMaterial({ size: 7, map: smokeTexture, color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.NormalBlending });
    const smokeParticles = new THREE.Points(smokeGeo, smokeMat); scene.add(smokeParticles); smokeParticles.visible = false;

    // --- [เพิ่มใหม่]: เอฟเฟกต์สะเก็ดไฟลอยเอื่อยๆ (Embers) ---
    const emberCanvas = document.createElement('canvas');
    emberCanvas.width = 32; emberCanvas.height = 32;
    const eCtx = emberCanvas.getContext('2d');
    const eGradient = eCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
    eGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');    // แกนกลางสีขาวจ้า
    eGradient.addColorStop(0.2, 'rgba(255, 150, 0, 0.8)');  // สีส้มอมเหลือง
    eGradient.addColorStop(1, 'rgba(255, 50, 0, 0)');       // ขอบสีแดงจางๆ
    eCtx.fillStyle = eGradient; eCtx.fillRect(0, 0, 32, 32);
    const emberTexture = new THREE.CanvasTexture(emberCanvas);
    emberTexture.needsUpdate = true;

    const emberGeo = new THREE.BufferGeometry(); const emberCount = 100;
    const emberPos = new Float32Array(emberCount * 3), emberSpeeds = new Float32Array(emberCount), emberPhases = new Float32Array(emberCount);
    for (let i = 0; i < emberCount; i++) {
        emberPos[i * 3] = (Math.random() - 0.5) * 20;     // X (กระจายกว้างๆ)
        emberPos[i * 3 + 1] = (Math.random() - 0.5) * 10; // Y (ระดับความสูง)
        emberPos[i * 3 + 2] = (Math.random() - 0.5) * 20; // Z (ความลึก)
        emberSpeeds[i] = 0.005 + Math.random() * 0.015;   // อัตราการลอยขึ้น
        emberPhases[i] = Math.random() * Math.PI * 2;     // จังหวะส่ายไปมา
    }
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    
    // ใช้ AdditiveBlending เพื่อให้สะเก็ดไฟเรืองแสงเวลาซ้อนกัน
    const emberMat = new THREE.PointsMaterial({ size: 0.25, map: emberTexture, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    const emberParticles = new THREE.Points(emberGeo, emberMat); scene.add(emberParticles); emberParticles.visible = true;


    // Realms Database
    const realmsConfig = [
        { id: 28, name: "อรูปภูมิ", zone: "arupa", color: 0x00ffff, yt: "0bhmtvfULcY", desc: ["ภูมิของผู้ที่เข้าถึงความว่างเปล่า", "ไม่มีรูปร่าง มีเพียงจิตและเจตสิก", "มีอายุยืนยาวมหาศาล", "สถิตอยู่ในความสงบอันประณีตสูงสุด"] },
        { id: 12, name: "รูปภูมิ", zone: "rupa", color: 0xffffff, yt: "Uh6E4hpato8", desc: ["ภูมิของพระพรหมผู้บรรลุรูปฌาน", "มีรัศมีกายสว่างไสวงดงาม", "ไม่มีความกังวลในเรื่องกามคุณ", "อิ่มเอิบด้วยปีติและสุขอันบริสุทธิ์"] },
        { id: 6, name: "สวรรค์ ๖ ชั้น", zone: "kama", color: 0xffd700, yt: "Zk6r7yFeVE4", desc: ["เทวภูมิ ๖ ชั้น ที่สถิตของทวยเทพ", "มีวิมานทองและสวนสวรรค์ตระการตา", "อายุขัยยืนยาว เสวยทิพยสมบัติ", "เกิดจากการทำกุศลกรรมบถ ๑๐"] },
        { id: 5, name: "มนุษยภูมิ", zone: "kama", color: 0x4CAF50, yt: "VA6O-RGu0hE", desc: ["ภูมิที่ปะปนด้วยความสุขและความทุกข์", "เป็นสถานที่หลักสำหรับสร้างบุญบารมี", "มีโอกาสบรรลุธรรมได้มากที่สุด", "เป็นศูนย์กลางของวัฏสงสาร"] },
        { id: 4.1, name: "สำนักพระยายมราช", zone: "abaya", color: 0x4a148c, yt: "os0QgFpd0jc", desc: ["สถานที่พิพากษาดวงวิญญาณ", "พระยายมราชซักถามเทวทูตทั้ง ๕", "เพื่อให้ดวงวิญญาณระลึกถึงบุญกุศล", "ตัดสินอย่างยุติธรรมตามกฎแห่งกรรม"] },
        { id: 4.2, name: "อสูรพิภพ", zone: "abaya", color: 0x5d4037, yt: "mzfPlNM8a58", desc: ["ภูมิของอสุรกาย", "มักมีความริษยาและมิจฉาทิฏฐิ", "ต้องทนทุกข์เพราะความหิวและความโกรธ", "มักอาศัยอยู่ใต้เขาพระสุเมรุ"] },
        { id: 3, name: "เปรตภูมิ", zone: "abaya", color: 0x8b0000, yt: "Zmqs1bUfM44", desc: ["ภูมิของผู้ที่ตายด้วยความโลภ", "มีความหิวโหยตลอดเวลา อาหารเป็นไฟ", "รูปร่างสูงใหญ่ ผอมโซ ทนทุกขเวทนา", "รอรับส่วนบุญกุศลที่ญาติอุทิศให้"] },
        { id: 2, name: "ติรัจฉานภูมิ", zone: "abaya", color: 0x8d6e63, yt: "Utbc7_EAgUc", desc: ["ภูมิของสัตว์เดรัจฉาน", "มีความเป็นอยู่ตามสัญชาตญาณ", "ต้องดิ้นรนเอาชีวิตรอดตลอดเวลา", "เกิดจากความหลง (โมหะ) เป็นหลัก"] },
        { id: 1.1, name: "นรกขุม ๑-๔", zone: "abaya", color: 0xff3300, yt: "Yud_Z2Gj9LY", desc: ["สัญชีวนรก ถึง โรรุวนรก", "รับผลกรรมจากการฆ่าสัตว์ ลักทรัพย์ ผิดกาม", "ถูกลงทัณฑ์ด้วยไฟนรกและอาวุธนานาประการ", "ต้องตายแล้วเกิดใหม่รับกรรมซ้ำๆ"] },
        { id: 1.4, name: "โลกันตนรก", zone: "abaya", color: 0x111111, yt: "DJAp20_7W_s", desc: ["ขุมนรกที่อยู่นอกจักรวาล มืดมิดสนิท", "สำหรับผู้ทำมิจฉาทิฏฐิขั้นรุนแรง", "สัตว์นรกเกาะอยู่ตามหน้าผา หนาวเย็นยะเยือก", "เมื่อร่วงตกลงน้ำกรดจะละลายหายไปทันที"] }
    ];

    realmsConfig.forEach(realm => {
        const btn = document.createElement('button');
        btn.className = `zone-btn btn-${realm.zone}`; btn.innerText = realm.name;
        btn.onclick = () => loadMasterRoom(realm);
        const container = document.getElementById(`zone-${realm.zone}`);
        if (container) container.appendChild(btn);
    });

    let currentActiveZone = "";

    function setLobbyBackground() {
        textureLoader.load('textures/lobby.jpg', (tex) => { tex.mapping = THREE.EquirectangularReflectionMapping; scene.background = tex; });
        scene.fog = new THREE.FogExp2(0x0a0a15, 0.02); 
        smokeParticles.visible = false;
        emberParticles.visible = true; // โชว์สะเก็ดไฟหน้าสารบัญ
        controls.autoRotate = true; 
    }

    function loadMasterRoom(realm) {
        document.getElementById('fade-overlay').style.opacity = 1;
        controls.autoRotate = false; 

        setTimeout(() => {
            document.getElementById('realm-menu').style.display = 'none';
            document.getElementById('return-lobby-btn').style.display = 'block';
            document.getElementById('back-to-meditation-btn').style.display = 'none';
            
            masterRoomGroup.visible = true;
            div.style.display = 'block'; 
            cssObject.visible = true; 
            emberParticles.visible = false; // ปิดสะเก็ดไฟตอนเข้าห้อง เพื่อโชว์เฉพาะควันของห้องนั้น
            
            document.getElementById('realm-status').innerText = `กำลังชม: ${realm.name}`;
            document.getElementById('realm-status').style.color = `#${realm.color.toString(16).padStart(6, '0')}`;
            
            pointLight.color.setHex(realm.color); currentActiveZone = realm.zone;
            ringMesh.material.color.setHex(realm.color); tvWireframe.material.color.setHex(realm.color); smokeMat.color.setHex(realm.color);
            iframe.src = `https://www.youtube.com/embed/${realm.yt}?autoplay=1&rel=0`;
            
            const bgPaths = { 28: 'arpp.jpg', 12: 'rpp.jpg', 6: 'sawan.jpg', 5: 'manud.jpg', 4.2: 'asul.jpg', 4.1: 'yama.jpg', 3: 'pred.jpg', 2: 'animal.jpg', 1.1: 'narok.jpg', 1.4: 'narok.jpg' };
            if (bgPaths[realm.id]) textureLoader.load('textures/' + bgPaths[realm.id], (tex) => { tex.mapping = THREE.EquirectangularReflectionMapping; scene.background = tex; });
            else scene.background = new THREE.Color(realm.color).multiplyScalar(0.075);
            
            if (realm.zone === 'abaya' || [28, 5].includes(realm.id)) { 
                scene.fog = new THREE.FogExp2(realm.color, 0.04); 
                smokeParticles.visible = true; 
            } else { 
                scene.fog = new THREE.FogExp2(realm.color, 0.015); 
                smokeParticles.visible = false; 
            }
            
            boardCtx.clearRect(0, 0, 600, 800);
            boardCtx.fillStyle = 'rgba(10, 15, 25, 0.65)';
            boardCtx.fillRect(0, 0, 600, 800);
            boardCtx.shadowColor = '#00e5ff';
            boardCtx.shadowBlur = 15;
            boardCtx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
            boardCtx.lineWidth = 3;
            boardCtx.strokeRect(15, 15, 570, 770);
            boardCtx.shadowBlur = 0;
            boardCtx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
            boardCtx.lineWidth = 1;
            boardCtx.strokeRect(25, 25, 550, 750);
            boardCtx.shadowColor = realm.color ? `#${realm.color.toString(16).padStart(6, '0')}` : '#00e5ff';
            boardCtx.shadowBlur = 10;
            boardCtx.fillStyle = '#ffffff';
            boardCtx.font = 'bold 42px Sarabun, sans-serif';
            boardCtx.textAlign = 'center';
            boardCtx.fillText(realm.name, 300, 90);
            boardCtx.shadowBlur = 0;
            boardCtx.beginPath();
            boardCtx.moveTo(100, 120);
            boardCtx.lineTo(500, 120);
            boardCtx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            boardCtx.lineWidth = 2;
            boardCtx.stroke();
            boardCtx.fillStyle = '#00e5ff';
            boardCtx.font = 'bold 28px Sarabun, sans-serif';
            boardCtx.fillText("STATUS & DATA", 300, 170);
            boardCtx.fillStyle = '#e0e0e0';
            boardCtx.font = '26px Sarabun, sans-serif';
            boardCtx.textAlign = 'left';
            
            if (realm.desc) {
                realm.desc.forEach((line, index) => {
                    boardCtx.fillStyle = '#00e5ff';
                    boardCtx.fillText("⯈", 50, 240 + (index * 50));
                    boardCtx.fillStyle = '#e0e0e0';
                    boardCtx.fillText(line, 85, 240 + (index * 50));
                });
            }
            boardTexture.needsUpdate = true;
            
            document.getElementById('fade-overlay').style.opacity = 0;
        }, 800);
    }

    document.getElementById('return-lobby-btn').addEventListener('click', () => {
        document.getElementById('fade-overlay').style.opacity = 1;
        setTimeout(() => {
            document.getElementById('realm-menu').style.display = 'flex';
            document.getElementById('return-lobby-btn').style.display = 'none';
            document.getElementById('back-to-meditation-btn').style.display = 'block';
            
            masterRoomGroup.visible = false;
            div.style.display = 'none'; 
            cssObject.visible = false; 
            
            iframe.src = "";
            setLobbyBackground(); 
            camera.position.set(0, 1.8, 3.5); controls.target.set(0, 1.5, -4.0);
            
            document.getElementById('fade-overlay').style.opacity = 0;
        }, 800);
    });

    const moveState = { forward: false, backward: false, left: false, right: false };
    const walkSpeed = 0.08;
    window.addEventListener('keydown', (e) => {
        if (!scene.visible || !masterRoomGroup.visible) return;
        if (e.code === 'KeyW') moveState.forward = true; if (e.code === 'KeyS') moveState.backward = true;
        if (e.code === 'KeyA') moveState.left = true; if (e.code === 'KeyD') moveState.right = true;
    });
    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') moveState.forward = false; if (e.code === 'KeyS') moveState.backward = false;
        if (e.code === 'KeyA') moveState.left = false; if (e.code === 'KeyD') moveState.right = false;
    });

    function onEnterScene() {
        document.getElementById('realm-menu').style.display = 'flex';
        setLobbyBackground();
        div.style.display = 'none'; 
        cssObject.visible = false; 
    }
    
    function onExitScene() {
        document.getElementById('realm-menu').style.display = 'none';
        document.getElementById('return-lobby-btn').style.display = 'none';
        masterRoomGroup.visible = false;
        div.style.display = 'none'; 
        cssObject.visible = false; 
        iframe.src = "";
        controls.autoRotate = false; 
        emberParticles.visible = false; // ปิดสะเก็ดไฟเมื่อสลับไปลานธรรม
    }

    function update() {
        controls.update();
        
        if (masterRoomGroup.visible) stageGroup.rotation.y += 0.002;
        
        if (masterRoomGroup.visible && (moveState.forward || moveState.backward || moveState.left || moveState.right)) {
            const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize();
            const right = new THREE.Vector3(); right.crossVectors(camera.up, forward).normalize();
            const moveVector = new THREE.Vector3();
            if (moveState.forward) moveVector.add(forward); if (moveState.backward) moveVector.sub(forward);
            if (moveState.left) moveVector.add(right); if (moveState.right) moveVector.sub(right);
            moveVector.normalize().multiplyScalar(walkSpeed);
            camera.position.add(moveVector); controls.target.add(moveVector);
        }

        // อัปเดตควัน
        if (smokeParticles.visible) {
            const positions = smokeParticles.geometry.attributes.position.array;
            for (let i = 0; i < smokeCount; i++) {
                positions[i*3+1] += smokeSpeeds[i]; positions[i*3] += Math.sin(Date.now()*0.001 + smokePhases[i])*0.005;
                if (positions[i*3+1] > 6) { positions[i*3+1] = -3; positions[i*3] = (Math.random()-0.5)*15; }
            }
            smokeParticles.geometry.attributes.position.needsUpdate = true;
        }

        // อัปเดตสะเก็ดไฟ (ลอยขึ้นและส่ายซ้ายขวาเบาๆ)
        if (emberParticles.visible) {
            const ePositions = emberParticles.geometry.attributes.position.array;
            for (let i = 0; i < emberCount; i++) {
                ePositions[i*3+1] += emberSpeeds[i]; 
                ePositions[i*3] += Math.sin(Date.now()*0.001 + emberPhases[i])*0.01; 
                ePositions[i*3+2] += Math.cos(Date.now()*0.001 + emberPhases[i])*0.01; 
                
                if (ePositions[i*3+1] > 5) { 
                    ePositions[i*3+1] = -5; // ถ้าลอยสูงเกินไป ให้ดึงกลับมาเริ่มที่พื้นใหม่
                    ePositions[i*3] = (Math.random()-0.5)*20;
                    ePositions[i*3+2] = (Math.random()-0.5)*20;
                }
            }
            emberParticles.geometry.attributes.position.needsUpdate = true;
        }
    }

    return { scene, camera, controls, update, onEnterScene, onExitScene };
}