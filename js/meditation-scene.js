import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { ref, get, update, onValue, onDisconnect, increment } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { appConfig } from '../config.js';

export function setupMeditationScene(renderer, cssRenderer, db, currentUserName) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a3b4c);
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const defaultCameraPos = new THREE.Vector3(0, 2.5, 6.0);
    const defaultTargetPos = new THREE.Vector3(0, 1, -2);
    camera.position.copy(defaultCameraPos);

    const vrCameraRig = new THREE.Group(); vrCameraRig.add(camera); scene.add(vrCameraRig);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.maxPolarAngle = Math.PI / 2 + 0.1;
    controls.target.copy(defaultTargetPos);
    controls.rotateSpeed = -1.0;

    let currentScheduleStatus = "โหมด: สแตนด์บาย (ช่องวัดท่าซุง)";
    let currentSeatStatus = "สถานะ: คลิกเลือกเบาะ หรือคลิกจุดสีทองหน้าบอร์ด";

    // --- Firebase Logic & Bots ---
    const ROOM_CAPACITY = 30;
    let localBotCount = 0, roomUsersCount = 1, globalUsersCount = 1, currentRoomNum = "1";
    let myRoomId = null;

    function updateServerStatusUI() {
        if (!scene.visible) return;
        const totalGlobal = globalUsersCount + localBotCount;
        const totalRoom = roomUsersCount + localBotCount;
        document.getElementById('server-status').innerText = `🌐 รวมทุกห้อง: ${totalGlobal} คน | 🏠 ห้องที่ ${currentRoomNum} (${totalRoom}/${ROOM_CAPACITY} คน)`;
    }

    function createMeditatorAvatar() {
        const group = new THREE.Group();
        const auraMaterial = new THREE.MeshStandardMaterial({
            color: 0xffeab3, emissive: 0xd4af37, emissiveIntensity: 0.6,
            roughness: 0.4, metalness: 0.1
        });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), auraMaterial);
        head.position.set(0, 0.60, 0); group.add(head);
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 16), auraMaterial);
        shoulder.scale.set(1.35, 0.65, 1.0); shoulder.position.set(0, 0.44, 0); group.add(shoulder);
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.26, 0.25, 16), auraMaterial);
        body.position.set(0, 0.32, 0); group.add(body);
        const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), auraMaterial);
        pelvis.scale.set(1.1, 0.6, 0.9); pelvis.position.set(0, 0.16, 0.02); group.add(pelvis);
        const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 16), auraMaterial);
        legs.scale.set(1.1, 1, 0.8); legs.position.set(0, 0.04, 0.05); group.add(legs);
        const armGeo = new THREE.CapsuleGeometry(0.045, 0.26, 4, 8);
        const leftArm = new THREE.Mesh(armGeo, auraMaterial);
        leftArm.position.set(-0.17, 0.28, 0.10); leftArm.rotation.set(-0.5, 0, 0.2); group.add(leftArm);
        const rightArm = new THREE.Mesh(armGeo, auraMaterial);
        rightArm.position.set(0.17, 0.28, 0.10); rightArm.rotation.set(-0.5, 0, -0.2); group.add(rightArm);
        group.rotation.y = Math.PI;
        return group;
    }

    function spawnAIBots() {
        const botCount = Math.floor(Math.random() * 4) + 3; 
        localBotCount = botCount;
        updateServerStatusUI();

        const availableIndices = [...Array(cushionsList.length).keys()];
        for (let i = 0; i < botCount; i++) {
            if (availableIndices.length === 0) break;
            const cushionIdx = availableIndices.splice(Math.floor(Math.random() * availableIndices.length), 1)[0];
            const botCushion = cushionsList[cushionIdx];

            botCushion.userData.isOccupied = true;
            botCushion.userData.occupantName = `กัลยาณมิตร${Math.floor(Math.random() * 900 + 100)} (AI)`;
            botCushion.material.color.setHex(0x2a1610);

            const avatar = createMeditatorAvatar();
            avatar.position.set(botCushion.position.x, 0.05, botCushion.position.z);
            seatingGroup.add(avatar);
        }
    }

    async function joinRoom() {
        const roomsRef = ref(db, 'rooms');
        const snapshot = await get(roomsRef);
        let rooms = snapshot.val() || {};
        let targetRoom = null, maxRoomIndex = 0;

        for (const [roomId, roomData] of Object.entries(rooms)) {
            const roomNum = parseInt(roomId.split('_')[1]);
            if (roomNum > maxRoomIndex) maxRoomIndex = roomNum;
            if (roomData.count < ROOM_CAPACITY) { targetRoom = roomId; break; }
        }
        if (!targetRoom) targetRoom = `room_${maxRoomIndex + 1}`;
        myRoomId = targetRoom;

        spawnAIBots(); 

        const myRoomCountRef = ref(db, `rooms/${myRoomId}/count`);
        const globalCountRef = ref(db, `global_users`);
        onDisconnect(myRoomCountRef).set(increment(-1));
        onDisconnect(globalCountRef).set(increment(-1));
        update(ref(db), { [`rooms/${myRoomId}/count`]: increment(1), [`global_users`]: increment(1) });

        onValue(globalCountRef, (snap) => { globalUsersCount = snap.val() || 1; updateServerStatusUI(); });
        onValue(myRoomCountRef, (snap) => { roomUsersCount = snap.val() || 1; currentRoomNum = myRoomId.split('_')[1]; updateServerStatusUI(); });
    }

    // --- Cushions ---
    const cushionGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
    const seatingGroup = new THREE.Group(); seatingGroup.position.set(0, 0.05, -1.5); scene.add(seatingGroup);
    const cushionsList = [];
    
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 6; c++) {
            let xPos = (c < 3) ? (c - 3) * 1.2 - 0.5 : (c - 4) * 1.2 + 1.2 + 0.5;
            const cushion = new THREE.Mesh(cushionGeo, new THREE.MeshStandardMaterial({ color: 0x3b2219 }));
            cushion.position.set(xPos, 0, r * 1.1);
            cushion.userData = { row: r + 1, col: c + 1, isOccupied: false, isMine: false };
            seatingGroup.add(cushion); cushionsList.push(cushion);
        }
    }

    joinRoom();

    // --- Environment & Lights ---
    scene.add(new THREE.AmbientLight(0xfff3e0, 0.6));
    const pointLight = new THREE.PointLight(0xffcc80, 1.5, 15);
    pointLight.position.set(0, 4, -2);
    scene.add(pointLight);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ color: 0x5c4033 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const altarGroup = new THREE.Group(); altarGroup.position.set(-3.2, 0, -4.5); scene.add(altarGroup);
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.0), new THREE.MeshStandardMaterial({ color: 0x4a2e18 }));
    table.position.set(0, 0.4, 0); altarGroup.add(table);

    const loader = new GLTFLoader();
    loader.load('bhuddha.glb', function (gltf) {
        const buddhaModel = gltf.scene;
        const box = new THREE.Box3().setFromObject(buddhaModel);
        const scaleFactor = 1.1 / box.getSize(new THREE.Vector3()).y;
        buddhaModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
        const center = new THREE.Box3().setFromObject(buddhaModel).getCenter(new THREE.Vector3());
        buddhaModel.position.set(-center.x, 0.8 - new THREE.Box3().setFromObject(buddhaModel).min.y, -center.z);
        altarGroup.add(buddhaModel);
    });

    // --- YouTube CSS3D ---
    const tvGroup = new THREE.Group(); tvGroup.position.set(1.5, 2.9, -4.8); scene.add(tvGroup);
    const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 }));
    tvGroup.add(tvFrame);
    
    const div = document.createElement('div');
    div.style.width = '700px'; div.style.height = '400px'; div.style.backgroundColor = '#000';
    
    const iframe = document.createElement('iframe');
    iframe.width = "700"; iframe.height = "400";
    iframe.frameBorder = "0"; iframe.allowFullscreen = true;
    iframe.style.borderRadius = "4px";
    div.appendChild(iframe);
    
    const cssObject = new CSS3DObject(div);
    cssObject.position.set(0, 0, 0.12); cssObject.scale.set(0.01, 0.01, 0.01);
    tvGroup.add(cssObject);

    function updateVideoAndSchedule() {
        const now = new Date();
        const curMins = now.getHours() * 60 + now.getMinutes();
        let activeVideoUrl = appConfig.youtube.standbyUrl;
        currentScheduleStatus = "โหมด: สแตนด์บาย (ช่องวัดท่าซุง)";
        
        if (curMins >= appConfig.youtube.morningStart && curMins <= appConfig.youtube.morningEnd) {
            activeVideoUrl = appConfig.youtube.morningUrl + "?autoplay=1";
            currentScheduleStatus = "โหมด: ทำวัตรเช้า (04:00 - 05:30)";
        } else if (curMins >= appConfig.youtube.eveningStart && curMins <= appConfig.youtube.eveningEnd) {
            activeVideoUrl = appConfig.youtube.eveningUrl + "?autoplay=1";
            currentScheduleStatus = "โหมด: ทำวัตรเย็น (18:00 - 19:30)";
        }
        
        if (iframe.src !== activeVideoUrl) {
            iframe.src = activeVideoUrl; 
        }
    }
    updateVideoAndSchedule();

    const canvas = document.createElement('canvas');
    canvas.width = 1280; canvas.height = 720;
    const ctx = canvas.getContext('2d');
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 720);
    bgGrad.addColorStop(0, '#1a0b00'); bgGrad.addColorStop(0.5, '#3b1c00'); bgGrad.addColorStop(1, '#1a0b00');
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 4; ctx.strokeRect(40, 40, 1200, 640);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 70px Sarabun, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🎧 โหมดวิทยุสมาธิ (VR Audio)', canvas.width / 2, 160);
    ctx.beginPath(); ctx.moveTo(350, 230); ctx.lineTo(930, 230); ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = '36px Sarabun, sans-serif';
    ctx.fillText('เพื่อให้ท่านได้รับฟังเสียงสวดมนต์ในขณะอยู่ภายในโลกเสมือนจริง', canvas.width / 2, 310);
    ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 42px Sarabun, sans-serif'; ctx.fillText('คำแนะนำขั้นตอนการใช้งาน:', canvas.width / 2, 400);
    ctx.fillStyle = '#ffffff'; ctx.font = '34px Sarabun, sans-serif';
    ctx.fillText('1. ถอดแว่น หรือกดปุ่ม "EXIT VR" ด้านล่าง เพื่อออกไปที่หน้าจอปกติก่อน', canvas.width / 2, 470);
    ctx.fillText('2. กดปุ่ม ▶️ Play ที่จอวิดีโอ YouTube เพื่อให้เสียงสวดมนต์เริ่มทำงาน', canvas.width / 2, 530);
    ctx.fillText('3. กดปุ่ม "ENTER VR" เพื่อกลับเข้าสู่ลานปฏิบัติธรรมอีกครั้ง', canvas.width / 2, 590);

    const vrTextTexture = new THREE.CanvasTexture(canvas); vrTextTexture.colorSpace = THREE.SRGBColorSpace;
    const vrScreen = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.9), new THREE.MeshBasicMaterial({ map: vrTextTexture }));
    vrScreen.position.set(0, 0, 0.11); tvGroup.add(vrScreen);

    // --- Boards (PR, Dev & VR Guide) ---
    const hotspotGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32);
    const hotspotMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x886600 });
    
    // 1. PR Board
    const prGroup = new THREE.Group(); prGroup.position.set(-7.5, 1.675, 0.0); prGroup.rotation.y = Math.PI / 2; scene.add(prGroup);
    const prFrame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.45, 0.1), new THREE.MeshStandardMaterial({ color: 0x4a2b18, roughness: 1.0 })); prGroup.add(prFrame);
    
    const prCanvas = document.createElement('canvas'); prCanvas.width = 500; prCanvas.height = 650;
    const prCtx = prCanvas.getContext('2d');
    const prWoodGrad = prCtx.createLinearGradient(0, 0, 0, 650);
    prWoodGrad.addColorStop(0, '#5c3a21'); prWoodGrad.addColorStop(0.4, '#422815'); prWoodGrad.addColorStop(0.8, '#5c3a21'); prWoodGrad.addColorStop(1, '#2e1b0d');
    prCtx.fillStyle = prWoodGrad; prCtx.fillRect(0, 0, 500, 650);
    prCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let i = 0; i < 500; i += 8) { if (Math.random() > 0.2) prCtx.fillRect(i, 0, Math.random() * 3 + 1, 650); }
    prCtx.fillStyle = '#ffd700'; prCtx.font = 'bold 32px Sarabun, sans-serif'; prCtx.textAlign = 'center';
    prCtx.fillText(appConfig.prBoard.title, 250, 60);
    prCtx.beginPath(); prCtx.moveTo(100, 80); prCtx.lineTo(400, 80); prCtx.strokeStyle = '#ffd700'; prCtx.lineWidth = 2; prCtx.stroke();
    prCtx.fillStyle = '#00ffcc'; prCtx.font = 'bold 24px Sarabun, sans-serif'; prCtx.fillText(appConfig.prBoard.scheduleTitle, 250, 135);
    prCtx.textAlign = 'left'; prCtx.fillStyle = '#ffffff'; prCtx.font = '22px Sarabun, sans-serif';
    appConfig.prBoard.scheduleLines.forEach((line, index) => { prCtx.fillText(line, 80, 180 + (index * 40)); });
    prCtx.beginPath(); prCtx.moveTo(150, 310); prCtx.lineTo(350, 310); prCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; prCtx.lineWidth = 1; prCtx.stroke();
    prCtx.textAlign = 'center'; prCtx.fillStyle = '#ffeb3b'; prCtx.font = 'bold 24px Sarabun, sans-serif';
    prCtx.fillText(appConfig.prBoard.contactTitle, 250, 370);
    prCtx.fillStyle = '#ffffff'; prCtx.font = '18px Sarabun, sans-serif';
    appConfig.prBoard.contactLines.forEach((line, index) => { prCtx.fillText(line, 250, 420 + (index * 30)); });
    prCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    if (prCtx.roundRect) { prCtx.beginPath(); prCtx.roundRect(70, 520, 360, 90, 15); prCtx.fill(); prCtx.strokeStyle = '#ffd700'; prCtx.lineWidth = 2; prCtx.stroke();
    } else { prCtx.fillRect(70, 520, 360, 90); }
    prCtx.fillStyle = '#00ffcc'; prCtx.font = 'bold 20px Sarabun, sans-serif'; prCtx.fillText(appConfig.prBoard.contactBoxTitle, 250, 555);
    prCtx.fillStyle = '#ffffff'; prCtx.font = 'bold 28px Sarabun, sans-serif'; prCtx.fillText(appConfig.prBoard.contactPhone, 250, 595);
    
    const prTexture = new THREE.CanvasTexture(prCanvas); prTexture.colorSpace = THREE.SRGBColorSpace;
    const prPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.25), new THREE.MeshBasicMaterial({ map: prTexture }));
    prPlane.position.set(0, 0, 0.06); prGroup.add(prPlane);

    const prHotspot = new THREE.Mesh(hotspotGeo, hotspotMat);
    prHotspot.position.set(-5.0, 0.025, 0.0);
    prHotspot.userData = { isHotspot: true, type: "PR", targetPos: new THREE.Vector3(-5.0, 1.5, 0.0), lookAtPos: new THREE.Vector3(-7.5, 1.675, 0.0) };
    scene.add(prHotspot);

    // 2. Dev Board
    const devGroup = new THREE.Group(); devGroup.position.set(7.5, 1.675, 0.0); devGroup.rotation.y = -Math.PI / 2; scene.add(devGroup);
    const devFrame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.45, 0.1), new THREE.MeshStandardMaterial({ color: 0x4a2b18, roughness: 1.0 })); devGroup.add(devFrame);
    
    const devCanvas = document.createElement('canvas'); devCanvas.width = 500; devCanvas.height = 650;
    const devCtx = devCanvas.getContext('2d');
    const devWoodGrad = devCtx.createLinearGradient(0, 0, 0, 650);
    devWoodGrad.addColorStop(0, '#5c3a21'); devWoodGrad.addColorStop(0.4, '#422815'); devWoodGrad.addColorStop(0.8, '#5c3a21'); devWoodGrad.addColorStop(1, '#2e1b0d');
    devCtx.fillStyle = devWoodGrad; devCtx.fillRect(0, 0, 500, 650);
    devCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let i = 0; i < 500; i += 8) { if (Math.random() > 0.2) devCtx.fillRect(i, 0, Math.random() * 3 + 1, 650); }
    devCtx.fillStyle = '#ffd700'; devCtx.font = 'bold 32px Sarabun, sans-serif'; devCtx.textAlign = 'center';
    devCtx.fillText('🙏 ร่วมสร้างวิหารธรรมออนไลน์', 250, 60);
    devCtx.beginPath(); devCtx.moveTo(40, 80); devCtx.lineTo(460, 80); devCtx.strokeStyle = '#ffd700'; devCtx.lineWidth = 2; devCtx.stroke();
    devCtx.fillStyle = '#ffffff'; devCtx.font = 'bold 22px Sarabun, sans-serif';
    devCtx.fillText('"ทุกการภาวนาที่เกิดขึ้น ณ พื้นที่แห่งนี้', 250, 130); devCtx.fillText('ท่านคือผู้มีส่วนร่วมในมหากุศล"', 250, 165);
    devCtx.fillStyle = '#cccccc'; devCtx.font = '18px Sarabun, sans-serif';
    devCtx.fillText('หากผลงานนี้มีประโยชน์กับคุณ หรือมีไอเดียอยากเสนอแนะเพิ่มเติม', 250, 230);
    devCtx.fillText('สามารถทักมาพูดคุย เลี้ยงกาแฟ หรือร่วมสนับสนุนโปรเจกต์ได้เลย', 250, 260);
    devCtx.fillText('ครับ ยินดีรับฟังทุกความคิดเห็น!', 250, 290);
    devCtx.fillStyle = '#ffffff';
    if (devCtx.roundRect) { devCtx.beginPath(); devCtx.roundRect(50, 360, 400, 240, 15); devCtx.fill(); devCtx.strokeStyle = '#ffd700'; devCtx.lineWidth = 4; devCtx.stroke();
    } else { devCtx.fillRect(50, 360, 400, 240); }
    devCtx.fillStyle = '#666666'; devCtx.font = 'bold 24px Sarabun, sans-serif'; devCtx.fillText('LINE ID / เบอร์โทร:', 250, 410);
    devCtx.fillStyle = '#4CAF50'; devCtx.font = 'bold 36px Sarabun, sans-serif'; devCtx.fillText('0926533228', 250, 460);
    devCtx.fillStyle = '#5ac346';
    if (devCtx.roundRect) { devCtx.beginPath(); devCtx.roundRect(100, 500, 300, 60, 30); devCtx.fill(); } else { devCtx.fillRect(100, 500, 300, 60); }
    devCtx.fillStyle = '#ffffff'; devCtx.font = 'bold 22px Sarabun, sans-serif'; devCtx.fillText('💬 ทักไลน์มาคุยกัน', 250, 538);
    
    const devTexture = new THREE.CanvasTexture(devCanvas); devTexture.colorSpace = THREE.SRGBColorSpace;
    const devPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.25), new THREE.MeshBasicMaterial({ map: devTexture }));
    devPlane.position.set(0, 0, 0.06); devGroup.add(devPlane);

    const lineBtnGeo = new THREE.PlaneGeometry(1.5, 0.3);
    const lineBtnMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0 });
    const lineHitbox = new THREE.Mesh(lineBtnGeo, lineBtnMat);
    lineHitbox.position.set(0, -1.025, 0.07); lineHitbox.userData = { isLineButton: true }; devGroup.add(lineHitbox);

    const devHotspot = new THREE.Mesh(hotspotGeo, hotspotMat.clone());
    devHotspot.position.set(5.0, 0.025, 0.0);
    devHotspot.userData = { isHotspot: true, type: "DEV", targetPos: new THREE.Vector3(5.0, 1.5, 0.0), lookAtPos: new THREE.Vector3(7.5, 1.675, 0.0) };
    scene.add(devHotspot);

    // --- [เพิ่มใหม่] 3. VR Guide Board (บอร์ดแนะนำ VR) ---
    const vrGuideGroup = new THREE.Group(); 
    vrGuideGroup.position.set(-5.5, 1.675, -5.0); // ตั้งไว้เยื้องซ้ายของหน้าจอ YouTube
    vrGuideGroup.rotation.y = Math.PI / 4; // หันหน้าเฉียงเข้าหาตรงกลาง
    scene.add(vrGuideGroup);
    
    const vrFrame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.45, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 })); 
    vrGuideGroup.add(vrFrame);
    
    const vrCanvas = document.createElement('canvas'); vrCanvas.width = 500; vrCanvas.height = 650;
    const vrCtx = vrCanvas.getContext('2d');
    
    const vrBgGrad = vrCtx.createLinearGradient(0, 0, 0, 650);
    vrBgGrad.addColorStop(0, '#1a1a2e'); vrBgGrad.addColorStop(1, '#16213e');
    vrCtx.fillStyle = vrBgGrad; vrCtx.fillRect(0, 0, 500, 650);
    
    vrCtx.strokeStyle = '#0f3460'; vrCtx.lineWidth = 10; vrCtx.strokeRect(5, 5, 490, 640);
    vrCtx.strokeStyle = '#e94560'; vrCtx.lineWidth = 2; vrCtx.strokeRect(15, 15, 470, 620);
    
    vrCtx.fillStyle = '#e94560'; vrCtx.font = 'bold 36px Sarabun, sans-serif'; vrCtx.textAlign = 'center';
    vrCtx.fillText('👓 แนะนำการรับชมด้วยแว่น VR', 250, 70);
    vrCtx.beginPath(); vrCtx.moveTo(40, 90); vrCtx.lineTo(460, 90); vrCtx.strokeStyle = '#e94560'; vrCtx.lineWidth = 2; vrCtx.stroke();
    
    vrCtx.fillStyle = '#ffffff'; vrCtx.font = '22px Sarabun, sans-serif';
    vrCtx.fillText('นิทรรศการนี้ถูกออกแบบมาเพื่อรองรับการรับชม', 250, 140);
    vrCtx.fillText('แบบ 360 องศาเต็มรูปแบบ ในโลกเสมือนจริง', 250, 175);
    
    vrCtx.fillStyle = '#00ffcc'; vrCtx.font = 'bold 24px Sarabun, sans-serif';
    vrCtx.fillText('อุปกรณ์ที่รองรับ:', 250, 240);
    vrCtx.fillStyle = '#cccccc'; vrCtx.font = '22px Sarabun, sans-serif';
    vrCtx.fillText('• Meta Quest 2, 3, Pro', 250, 275);
    vrCtx.fillText('• Pico 4 / Apple Vision Pro', 250, 310);
    vrCtx.fillText('• แว่น PC VR อื่นๆ ผ่านเบราว์เซอร์', 250, 345);
    
    vrCtx.fillStyle = '#ff9800'; vrCtx.font = 'bold 24px Sarabun, sans-serif';
    vrCtx.fillText('วิธีเข้าใช้งาน:', 250, 420);
    vrCtx.fillStyle = '#ffffff'; vrCtx.font = '20px Sarabun, sans-serif';
    vrCtx.fillText('1. เปิดแอปเบราว์เซอร์ (Browser) ภายในแว่น VR', 250, 460);
    vrCtx.fillText('2. พิมพ์ URL เพื่อเข้าสู่เว็บไซต์นี้', 250, 495);
    vrCtx.fillText('3. คลิกที่ปุ่ม "ENTER VR" บริเวณขอบจอด้านล่าง', 250, 530);
    vrCtx.fillText('4. สัมผัสประสบการณ์โลกเสมือนจริงได้ทันที', 250, 565);

    const vrTexture = new THREE.CanvasTexture(vrCanvas); vrTexture.colorSpace = THREE.SRGBColorSpace;
    const vrPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.25), new THREE.MeshBasicMaterial({ map: vrTexture }));
    vrPlane.position.set(0, 0, 0.06); vrGuideGroup.add(vrPlane);

    // เก็บพิกัดเป้าหมายสำหรับการวาร์ปไปอ่านบอร์ด VR
    const vrTargetPos = new THREE.Vector3(-3.5, 1.5, -3.0); 
    const vrLookAtPos = new THREE.Vector3(-5.5, 1.675, -5.0);

    const interactables = [...cushionsList, prHotspot, devHotspot, lineHitbox];

    // --- Raycaster / Click Logic ---
    let isSeated = false, isReading = false, isTransitioning = false, mySelectedCushion = null;
    const targetCamPos = new THREE.Vector3(), targetLookAt = new THREE.Vector3();
    const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();

    window.addEventListener('click', (event) => {
        if (event.target.tagName !== 'CANVAS') return;
        if (!scene.visible || isTransitioning) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1; mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactables);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            
            if (obj.userData.isLineButton) {
                window.open('https://line.me/ti/p/~0926533228', '_blank');
                return;
            }

            if (isSeated || isReading) return;

            if (obj.userData.isHotspot) {
                targetCamPos.copy(obj.userData.targetPos); targetLookAt.copy(obj.userData.lookAtPos);
                isReading = true; isTransitioning = true; controls.enabled = false;
                document.getElementById('stand-btn').innerText = "🚶 เดินกลับ";
                document.getElementById('stand-btn').style.display = 'block';
                
                // [เพิ่ม] ซ่อนปุ่มแนะนำ VR ตอนเดินไปอ่านบอร์ด
                const vrGuideBtn = document.getElementById('vr-guide-btn');
                if (vrGuideBtn) vrGuideBtn.style.display = 'none';
                
                const boardType = obj.userData.type === "PR" ? "กระดานสะพานบุญ" : "บอร์ดสนับสนุนผู้พัฒนา";
                currentSeatStatus = `สถานะ: ยืนอ่าน (${boardType})`;

            } else if (!obj.userData.isOccupied) {
                obj.userData.isOccupied = true; obj.userData.isMine = true;
                obj.material.color.setHex(0x00ffcc); mySelectedCushion = obj;
                
                const pos = new THREE.Vector3(); obj.getWorldPosition(pos);
                targetCamPos.set(pos.x, 1.0, pos.z);
                const dir = new THREE.Vector3(1.5, 2.9, -4.8).sub(targetCamPos).normalize();
                targetLookAt.copy(targetCamPos).add(dir.multiplyScalar(0.01));
                
                isSeated = true; isTransitioning = true; controls.enabled = false;
                document.getElementById('stand-btn').innerText = "🚶 ลุกจากที่นั่ง";
                document.getElementById('stand-btn').style.display = 'block';
                
                // [เพิ่ม] ซ่อนปุ่มแนะนำ VR ตอนนั่งปฏิบัติธรรม
                const vrGuideBtn = document.getElementById('vr-guide-btn');
                if (vrGuideBtn) vrGuideBtn.style.display = 'none';
                
                currentSeatStatus = `สถานะ: นั่งสมาธิ แถว ${obj.userData.row}, ตัวที่ ${obj.userData.col}`;
            }
        }
    });

    document.getElementById('stand-btn').addEventListener('click', () => {
        if (mySelectedCushion) {
            mySelectedCushion.userData.isMine = false; mySelectedCushion.userData.isOccupied = false;
            mySelectedCushion.material.color.setHex(0x3b2219); mySelectedCushion = null;
        }
        document.getElementById('stand-btn').style.display = 'none';
        isSeated = false; isReading = false; isTransitioning = true; controls.enabled = false;
        targetCamPos.copy(defaultCameraPos); targetLookAt.copy(defaultTargetPos);
        
        currentSeatStatus = "สถานะ: คลิกเลือกเบาะ หรือคลิกจุดสีทองหน้าบอร์ด";

        // [เพิ่ม] คืนค่าปุ่มแนะนำ VR กลับมา (ตรวจสอบก่อนว่าระบบ VR ไม่รองรับใช่หรือไม่)
        const vrButtonEl = document.getElementById('VRButton');
        if (vrButtonEl && (vrButtonEl.style.display === 'none' || vrButtonEl.textContent.includes('NOT'))) {
            const vrGuideBtn = document.getElementById('vr-guide-btn');
            if (vrGuideBtn) vrGuideBtn.style.display = 'block';
        }
    });

    // --- [แอนิเมชันวาร์ป] ดักจับปุ่มแนะนำ VR ที่เราเพิ่งสร้าง ---
    const vrGuideBtn = document.getElementById('vr-guide-btn');
    if (vrGuideBtn) {
        vrGuideBtn.addEventListener('click', () => {
            if (!scene.visible || isTransitioning || isSeated || isReading) return;
            
            targetCamPos.copy(vrTargetPos); 
            targetLookAt.copy(vrLookAtPos);
            
            isReading = true; 
            isTransitioning = true; 
            controls.enabled = false;
            
            document.getElementById('stand-btn').innerText = "🚶 เดินกลับ";
            document.getElementById('stand-btn').style.display = 'block';
            
            // [เพิ่ม] ซ่อนปุ่มตอนกำลังอ่านบอร์ด VR
            vrGuideBtn.style.display = 'none';
            
            currentSeatStatus = `สถานะ: ยืนอ่าน (คำแนะนำ VR)`;
        });
    }

    const rotatingEl = document.getElementById('rotating-status');
    let currentStatusIndex = 0;
    const statusColors = ['#ffd700', '#00ffcc'];

    setInterval(() => {
        if (!scene.visible) return; 
        
        rotatingEl.style.opacity = 0;
        setTimeout(() => {
            const textToShow = currentStatusIndex === 0 ? currentScheduleStatus : currentSeatStatus;
            rotatingEl.innerText = textToShow;
            rotatingEl.style.color = statusColors[currentStatusIndex];
            rotatingEl.style.borderColor = statusColors[currentStatusIndex];
            rotatingEl.style.opacity = 1;
            
            currentStatusIndex = (currentStatusIndex + 1) % 2;
        }, 400);
    }, 3500);

    setInterval(() => {
        if (!scene.visible) return;
        const now = new Date();
        document.getElementById('time-display').innerText = now.toLocaleTimeString('th-TH', { hour12: false });
        document.getElementById('date-display').innerText = now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }, 1000);

   // --- Lifecycle Methods ---
    function onEnterScene() {
        div.style.display = 'block'; 
        cssObject.visible = true; 
        updateServerStatusUI();
        updateVideoAndSchedule(); 
        
        // [แก้บั๊ก] ตรวจสอบว่าก่อนไป 31 ภพภูมิ ผู้ใช้นั่งเบาะหรืออ่านบอร์ดค้างไว้หรือไม่
        if (isSeated || isReading) {
            document.getElementById('stand-btn').style.display = 'block'; // โชว์ปุ่มลุก/เดินกลับคืนมา
        } else {
            // ถ้าไม่ได้นั่งเบาะ/อ่านบอร์ด ให้โชว์ปุ่ม VR Guide แทน (ตรวจสอบว่าเครื่องรองรับ VR ไหม)
            const vrButtonEl = document.getElementById('VRButton');
            if (vrButtonEl && (vrButtonEl.style.display === 'none' || vrButtonEl.textContent.includes('NOT'))) {
                const vrGuideBtn = document.getElementById('vr-guide-btn');
                if (vrGuideBtn) vrGuideBtn.style.display = 'block';
            }
        }
    }
    
    function onExitScene() {
        div.style.display = 'none'; 
        cssObject.visible = false; 
        document.getElementById('stand-btn').style.display = 'none'; // ซ่อนปุ่มลุกจากเบาะ
        
        // ซ่อนปุ่ม VR Guide ตอนเข้าไปดู 31 ภพภูมิ
        const vrGuideBtn = document.getElementById('vr-guide-btn');
        if (vrGuideBtn) vrGuideBtn.style.display = 'none';
        
        iframe.src = ""; 
    }

    function update() {
        if (isTransitioning) {
            camera.position.lerp(targetCamPos, 0.15); controls.target.lerp(targetLookAt, 0.15);
            if (camera.position.distanceTo(targetCamPos) < 0.05) {
                isTransitioning = false; camera.position.copy(targetCamPos); controls.target.copy(targetLookAt); controls.enabled = true;
                
                if (isSeated || isReading) {
                    controls.enableZoom = false; controls.enablePan = false; controls.rotateSpeed = -0.7;
                    controls.minPolarAngle = Math.PI / 2 - 0.4; controls.maxPolarAngle = Math.PI / 2 + 0.3;
                    const angle = Math.atan2(targetCamPos.x - targetLookAt.x, targetCamPos.z - targetLookAt.z);
                    const range = (110 * Math.PI) / 180;
                    controls.minAzimuthAngle = angle - range; controls.maxAzimuthAngle = angle + range;
                } else {
                    controls.enableZoom = true; controls.enablePan = true; controls.rotateSpeed = -1.0;
                    controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI / 2 + 0.1;
                    controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
                }
            }
        } else if (controls.enabled) { controls.update(); }
    }

    return { scene, camera, controls, update, onEnterScene, onExitScene };
}