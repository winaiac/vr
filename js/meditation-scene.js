import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { ref, get, update, onValue, onDisconnect, increment } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { appConfig } from '../config.js';
import { updateEngagingContext, toggleReactionUI } from './engaging.js';
import { createMeditatorAvatar } from './avatar.js';
import { loadBuddhaWithEffects, updateBuddhaEffects } from './buddha.js';
import { createFireflies, updateFireflies } from './fireflies.js';

export function setupMeditationScene(renderer, cssRenderer, db, currentUserName) {
    const scene = new THREE.Scene();
    // [เพิ่มใหม่] ประกาศหมอกไว้ตั้งแต่เริ่ม เพื่อให้โมเดลทุกชิ้นรู้จักหมอก
    scene.fog = new THREE.FogExp2(0xa3c4d1, 0.02);
    
    // --- 1. โหลดภาพพื้นหลัง 360 องศา ---
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('textures/trees.jpg', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        scene.background = texture;
    });

    // --- 2. เรียกใช้งานหิ่งห้อยจากไฟล์แยก ---
    let fireflies = createFireflies();
    scene.add(fireflies);

    // --- 3. ระบบไฟและบรรยากาศ (สลับกลางวัน-กลางคืน) ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffcc80, 1.5, 15); pointLight.position.set(0, 4, -2); scene.add(pointLight);
    
    // [เพิ่มใหม่] ไฟแสงจันทร์ (Cinematic Moonlight สีฟ้า) สาดลงมาที่ลาน
    const moonLight = new THREE.DirectionalLight(0x4a8df8, 0.0); 
    moonLight.position.set(5, 10, 5); 
    moonLight.target.position.set(0, 0, 0);
    scene.add(moonLight); scene.add(moonLight.target);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.MeshStandardMaterial({ color: 0x4a2e18, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);

    function updateEnvironmentTime() {
        const currentHour = new Date().getHours();
        const isNight = currentHour >= 18 || currentHour < 6; 

        if (isNight) {
            if (scene.backgroundIntensity !== undefined) scene.backgroundIntensity = 0.15; 
            
            // [แก้ใหม่] แค่เปลี่ยนสีและความหนาแน่น แทนการ new หมอกใหม่
            scene.fog.color.setHex(0x08152b); // สีหมอกกลางคืน (น้ำเงินเข้ม)
            scene.fog.density = 0.05; // ปรับตัวเลขนี้ได้ครับ (ยิ่งเยอะหมอกยิ่งหนา)
            
            ambientLight.color.setHex(0x2a3b5c); 
            ambientLight.intensity = 0.6; 
            moonLight.intensity = 1.2; 
            pointLight.intensity = 1.0; 
            if (fireflies) fireflies.visible = true;
        } else {
            if (scene.backgroundIntensity !== undefined) scene.backgroundIntensity = 1.0;
            
            // [แก้ใหม่] กลับเป็นสีหมอกกลางวัน
            scene.fog.color.setHex(0xa3c4d1); // สีหมอกกลางวัน (ฟ้าอมเทา)
            scene.fog.density = 0.015; // กลางวันหมอกจางๆ
            
            ambientLight.color.setHex(0xffffff);
            ambientLight.intensity = 0.8;
            moonLight.intensity = 0.0; 
            pointLight.intensity = 1.5;
            if (fireflies) fireflies.visible = false;
        }
    }
    updateEnvironmentTime();
    setInterval(updateEnvironmentTime, 60000);

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

    let currentScheduleStatus = "โหมด: สแตนด์บาย";
    let currentSeatStatus = "สถานะ: คลิกเลือกเบาะ หรือคลิกจุดสีทองหน้าบอร์ด";

    // --- Firebase Logic & Bots ---
    const ROOM_CAPACITY = 30;
    let localBotCount = 0, roomUsersCount = 1, globalUsersCount = 1, currentRoomNum = "1";
    let myRoomId = null;

    const startDate = new Date('2026-10-01').getTime(); 
    const daysPassed = Math.max(0, Math.floor((new Date().getTime() - startDate) / (1000 * 60 * 60 * 24)));
    const allTimeVisitors = 1845 + (daysPassed * 123) + Math.floor(Math.random() * 30);

    window.currentActiveMainZone = 'meditation';
    window.currentActiveSubZone = '';
    window.exhibitionTotalBots = Math.floor(Math.random() * 15) + 30; 
    window.currentRoomBots = 0;

    let globalStatsInterval = null;
    let currentStatIndex = 0;

    window.updateGlobalHUD = function(mainZone = window.currentActiveMainZone, subZoneName = window.currentActiveSubZone) {
        document.getElementById('user-profile').innerText = `👤 ผู้ใช้งาน: ${currentUserName}`;
        
        const totalGlobal = globalUsersCount + localBotCount + window.exhibitionTotalBots;
        const totalRoom = roomUsersCount + localBotCount;
        
        const statsTexts = [
            `👁️ ผู้เข้าชมสะสม: ${allTimeVisitors.toLocaleString()} คน`,
            `🌐 รวมทั้งเว็บ และ แอพ: ${totalGlobal} คน`,
            "" 
        ];

        if (mainZone === 'meditation') {
            statsTexts[2] = `🙏 ลานปฏิบัติธรรม ห้อง ${currentRoomNum} (${totalRoom}/${ROOM_CAPACITY} คน)`;
        } else if (mainZone === 'exhibition') {
            let locText = subZoneName === 'Lobby' ? `📍 หน้าโถงสารบัญ: ${window.currentRoomBots} คน` : `${subZoneName}: ${window.currentRoomBots} คน`;
            statsTexts[2] = `🌌 นิทรรศการรวม: ${window.exhibitionTotalBots} คน | ${locText}`;
        }

        const rotatingEl = document.getElementById('rotating-global-stats');
        if (!rotatingEl) return;

        currentStatIndex = 2;
        rotatingEl.innerText = statsTexts[currentStatIndex];
        rotatingEl.style.opacity = 1;

        if (globalStatsInterval) clearInterval(globalStatsInterval);

        globalStatsInterval = setInterval(() => {
            rotatingEl.style.opacity = 0; 
            setTimeout(() => {
                currentStatIndex = (currentStatIndex + 1) % 3; 
                rotatingEl.innerText = statsTexts[currentStatIndex];
                
                if (currentStatIndex === 0) rotatingEl.style.color = '#ff9800'; 
                else if (currentStatIndex === 1) rotatingEl.style.color = '#00ffcc'; 
                else rotatingEl.style.color = '#ffffff'; 

                rotatingEl.style.opacity = 1; 
            }, 500); 
        }, 4000);
    };

    function updateServerStatusUI() {
        window.updateGlobalHUD(); 
    }

    function spawnAIBots() {
        const botCount = Math.floor(Math.random() * 4) + 3; localBotCount = botCount; updateServerStatusUI();
        const availableIndices = [...Array(cushionsList.length).keys()];
        for (let i = 0; i < botCount; i++) {
            if (availableIndices.length === 0) break;
            const cushionIdx = availableIndices.splice(Math.floor(Math.random() * availableIndices.length), 1)[0];
            const botCushion = cushionsList[cushionIdx];
            botCushion.userData.isOccupied = true; 
            botCushion.userData.occupantName = `กัลยาณมิตร${Math.floor(Math.random() * 900 + 100)}`;
            botCushion.material.color.setHex(0x2a1610);
            const avatar = createMeditatorAvatar(); avatar.position.set(botCushion.position.x, 0.05, botCushion.position.z); seatingGroup.add(avatar);
        }
    }

    async function joinRoom() {
        const roomsRef = ref(db, 'rooms'); const snapshot = await get(roomsRef);
        let rooms = snapshot.val() || {}; let targetRoom = null, maxRoomIndex = 0;
        
        for (const [roomId, roomData] of Object.entries(rooms)) {
            const roomNum = parseInt(roomId.split('_')[1]);
            if (roomNum > maxRoomIndex) maxRoomIndex = roomNum;
            if (roomData.count < ROOM_CAPACITY) { targetRoom = roomId; break; }
        }
        
        if (!targetRoom) targetRoom = `room_${maxRoomIndex + 1}`;
        myRoomId = targetRoom; spawnAIBots(); 
        
        const myRoomCountRef = ref(db, `rooms/${myRoomId}/count`); 
        const globalCountRef = ref(db, `global_users`);
        
        onDisconnect(myRoomCountRef).set(increment(-1)); 
        onDisconnect(globalCountRef).set(increment(-1));
        
        update(ref(db), { [`rooms/${myRoomId}/count`]: increment(1), [`global_users`]: increment(1) });
        
        onValue(globalCountRef, (snap) => { 
            let count = snap.val() || 1;
            if (count < 0) { count = 1; update(ref(db), { 'global_users': 1 }); }
            globalUsersCount = count; 
            updateServerStatusUI(); 
        });
        
        onValue(myRoomCountRef, (snap) => { 
            let count = snap.val() || 1;
            if (count < 0) { count = 1; update(ref(db), { [`rooms/${myRoomId}/count`]: 1 }); }
            roomUsersCount = count; 
            currentRoomNum = myRoomId.split('_')[1]; 
            updateServerStatusUI(); 
        });

        const botNames = cushionsList
            .filter(c => c.userData.isOccupied && !c.userData.isMine)
            .map(c => c.userData.occupantName);
        updateEngagingContext(myRoomId, botNames);
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

    const altarGroup = new THREE.Group(); altarGroup.position.set(-3.2, 0, -4.5); scene.add(altarGroup);
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.0), new THREE.MeshStandardMaterial({ color: 0x4a2e18 })); table.position.set(0, 0.4, 0); altarGroup.add(table);

    loadBuddhaWithEffects(altarGroup);

    // --- YouTube CSS3D ---
    const tvGroup = new THREE.Group(); tvGroup.position.set(1.5, 2.9, -4.8); scene.add(tvGroup);
    
    const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })); 
    tvGroup.add(tvFrame);

    const standMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3 });
    const speakerMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.5 });
    
    const soundbarGeo = new THREE.BoxGeometry(7.2, 0.3, 0.25);
    const soundbar = new THREE.Mesh(soundbarGeo, speakerMat);
    soundbar.position.set(0, -2.25, 0); 
    tvGroup.add(soundbar);
    
    const wooferGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.05, 32); 
    wooferGeo.rotateX(Math.PI / 2); 
    const wooferPositions = [-3.2, -2.8, -2.4, 2.4, 2.8, 3.2]; 
    wooferPositions.forEach(x => {
        const woofer = new THREE.Mesh(wooferGeo, coneMat);
        woofer.position.set(x, -2.25, 0.13); 
        tvGroup.add(woofer);
    });

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.45, 16);
    const leftPole = new THREE.Mesh(poleGeo, standMat); leftPole.position.set(-1.5, -2.625, 0); tvGroup.add(leftPole);
    const rightPole = new THREE.Mesh(poleGeo, standMat); rightPole.position.set(1.5, -2.625, 0); tvGroup.add(rightPole);
    
    const baseGeo = new THREE.BoxGeometry(4.0, 0.05, 1.2);
    const standBase = new THREE.Mesh(baseGeo, standMat); standBase.position.set(0, -2.875, 0); tvGroup.add(standBase);
    
    const div = document.createElement('div'); div.style.width = '700px'; div.style.height = '400px'; div.style.backgroundColor = '#000';
    div.style.backfaceVisibility = 'hidden';
    div.style.webkitBackfaceVisibility = 'hidden';

    const iframe = document.createElement('iframe'); iframe.width = "700"; iframe.height = "400"; iframe.frameBorder = "0"; iframe.allowFullscreen = true; iframe.style.borderRadius = "4px"; 
    iframe.style.backfaceVisibility = 'hidden';
    iframe.style.webkitBackfaceVisibility = 'hidden';
    div.appendChild(iframe);
    
    const cssObject = new CSS3DObject(div); cssObject.position.set(0, 0, 0.12); cssObject.scale.set(0.01, 0.01, 0.01); tvGroup.add(cssObject);

    function updateVideoAndSchedule() {
        const now = new Date(); 
        const curMins = now.getHours() * 60 + now.getMinutes();
        const curSeconds = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds(); 
        
        let targetVideoUrl = ""; 
        let newScheduleStatus = "";
        let offset = 0;

        for (let prog of appConfig.youtube.schedule) {
            if (curMins >= prog.start && curMins < prog.end) {
                let startSeconds = prog.start * 60;
                
                if (prog.realStart !== undefined) {
                    startSeconds = prog.realStart * 60;
                }

                if (curSeconds >= startSeconds) {
                    offset = curSeconds - startSeconds;
                } else {
                    offset = (curSeconds + 86400) - startSeconds;
                }

                targetVideoUrl = `https://www.youtube.com/embed/${prog.id}?autoplay=1&start=${offset}`; 
                
                const sHr = String(Math.floor(prog.start / 60)).padStart(2, '0');
                const sMin = String(prog.start % 60).padStart(2, '0');
                let eMins = prog.end === 1440 ? 0 : prog.end; 
                if (prog.realStart !== undefined && prog.start === 0) {
                    newScheduleStatus = `โหมด: ${prog.name} (19:00 - 04:00)`; 
                } else {
                    const eHr = String(Math.floor(eMins / 60)).padStart(2, '0');
                    const eMin = String(eMins % 60).padStart(2, '0');
                    newScheduleStatus = `โหมด: ${prog.name} (${sHr}:${sMin} - ${eHr}:${eMin})`;
                }
                break;
            }
        }

        if (!targetVideoUrl) {
            targetVideoUrl = `https://www.youtube.com/embed/6B6LeMlaTu0?autoplay=1`;
            newScheduleStatus = "โหมด: สแตนด์บาย";
        }

        if (currentScheduleStatus !== newScheduleStatus || !iframe.src.includes('youtube')) {
            currentScheduleStatus = newScheduleStatus;
            iframe.src = targetVideoUrl;
        }
    }
    
    updateVideoAndSchedule();

    setInterval(() => {
        if (scene.visible) updateVideoAndSchedule();
    }, 10000);

    const canvas = document.createElement('canvas'); canvas.width = 1280; canvas.height = 720; const ctx = canvas.getContext('2d');
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 720); bgGrad.addColorStop(0, '#1a0b00'); bgGrad.addColorStop(0.5, '#3b1c00'); bgGrad.addColorStop(1, '#1a0b00');
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 4; ctx.strokeRect(40, 40, 1200, 640);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 70px Sarabun, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎧 โหมดวิทยุสมาธิ (VR Audio)', canvas.width / 2, 160);
    ctx.beginPath(); ctx.moveTo(350, 230); ctx.lineTo(930, 230); ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = '36px Sarabun, sans-serif'; ctx.fillText('เพื่อให้ท่านได้รับฟังเสียงสวดมนต์ในขณะอยู่ภายในโลกเสมือนจริง', canvas.width / 2, 310);
    ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 42px Sarabun, sans-serif'; ctx.fillText('คำแนะนำขั้นตอนการใช้งาน:', canvas.width / 2, 400);
    ctx.fillStyle = '#ffffff'; ctx.font = '34px Sarabun, sans-serif';
    ctx.fillText('1. ถอดแว่น หรือกดปุ่ม "EXIT VR" ด้านล่าง เพื่อออกไปที่หน้าจอปกติก่อน', canvas.width / 2, 470);
    ctx.fillText('2. กดปุ่ม ▶️ Play ที่จอวิดีโอ YouTube เพื่อให้เสียงสวดมนต์เริ่มทำงาน', canvas.width / 2, 530);
    ctx.fillText('3. กดปุ่ม "ENTER VR" เพื่อกลับเข้าสู่ลานปฏิบัติธรรมอีกครั้ง', canvas.width / 2, 590);
    const vrTextTexture = new THREE.CanvasTexture(canvas); vrTextTexture.colorSpace = THREE.SRGBColorSpace;
    const vrScreen = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.9), new THREE.MeshBasicMaterial({ map: vrTextTexture })); vrScreen.position.set(0, 0, 0.11); tvGroup.add(vrScreen);

    function drawBoardButtons(cCtx) {
        cCtx.fillStyle = '#d32f2f';
        if (cCtx.roundRect) { cCtx.beginPath(); cCtx.roundRect(25, 660, 210, 60, 15); cCtx.fill(); } else { cCtx.fillRect(25, 660, 210, 60); }
        cCtx.strokeStyle = '#ffffff'; cCtx.lineWidth = 2; cCtx.stroke();
        cCtx.fillStyle = '#ffffff'; cCtx.font = 'bold 22px Sarabun, sans-serif'; cCtx.textAlign = 'center';
        cCtx.fillText('🚶 ถอยไปจุดเริ่มต้น', 130, 698);

        cCtx.fillStyle = '#9c27b0';
        if (cCtx.roundRect) { cCtx.beginPath(); cCtx.roundRect(255, 660, 220, 60, 15); cCtx.fill(); } else { cCtx.fillRect(255, 660, 220, 60); }
        cCtx.strokeStyle = '#ffffff'; cCtx.lineWidth = 2; cCtx.stroke();
        cCtx.fillStyle = '#ffffff'; cCtx.font = 'bold 20px Sarabun, sans-serif';
        cCtx.fillText('🌌 เข้าสู่ 31 ภพภูมิ', 365, 698);
    }

    const hotspotGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32);
    const hotspotMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x886600 });
    const backBtnGeo = new THREE.PlaneGeometry(1.05, 0.3);
    const warpBtnGeo = new THREE.PlaneGeometry(1.1, 0.3);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    
    // 1. PR Board (แบบสลับหน้า)
    const prGroup = new THREE.Group(); prGroup.position.set(-7.5, 1.925, 0.0); prGroup.rotation.y = Math.PI / 2; scene.add(prGroup);
    const prFrame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.95, 0.1), new THREE.MeshStandardMaterial({ color: 0x4a2b18, roughness: 1.0 })); prGroup.add(prFrame);
    
    const prCanvas = document.createElement('canvas'); prCanvas.width = 500; prCanvas.height = 750; 
    const prCtx = prCanvas.getContext('2d');
    const prTexture = new THREE.CanvasTexture(prCanvas); prTexture.colorSpace = THREE.SRGBColorSpace;
    const prPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.75), new THREE.MeshBasicMaterial({ map: prTexture })); 
    prPlane.position.set(0, 0, 0.06); prGroup.add(prPlane);

    let prPageState = 0; 
    let prOpacity = 1.0; 

    function drawPRBoard() {
        prCtx.globalAlpha = 1.0; 
        
        const prWoodGrad = prCtx.createLinearGradient(0, 0, 0, 750);
        prWoodGrad.addColorStop(0, '#5c3a21'); prWoodGrad.addColorStop(0.4, '#422815'); 
        prWoodGrad.addColorStop(0.8, '#5c3a21'); prWoodGrad.addColorStop(1, '#2e1b0d');
        prCtx.fillStyle = prWoodGrad; prCtx.fillRect(0, 0, 500, 750); 
        
        prCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let i = 0; i < 500; i += 8) { if (Math.random() > 0.2) prCtx.fillRect(i, 0, Math.random() * 3 + 1, 750); }
        
        prCtx.fillStyle = '#ffd700'; prCtx.font = 'bold 32px Sarabun, sans-serif'; prCtx.textAlign = 'center'; 
        prCtx.fillText(appConfig.prBoard.title, 250, 60);
        prCtx.beginPath(); prCtx.moveTo(80, 80); prCtx.lineTo(420, 80); prCtx.strokeStyle = '#ffd700'; prCtx.lineWidth = 2; prCtx.stroke();

        drawBoardButtons(prCtx); 

        prCtx.globalAlpha = prOpacity; 

        if (prPageState === 0) {
            prCtx.fillStyle = '#00ffcc'; prCtx.font = 'bold 26px Sarabun, sans-serif'; 
            prCtx.fillText(appConfig.prBoard.scheduleTitle, 250, 130);
            
            prCtx.textAlign = 'left'; prCtx.fillStyle = '#ffffff'; prCtx.font = '22px Sarabun, sans-serif';
            appConfig.prBoard.scheduleLines.forEach((line, index) => { 
                prCtx.fillText(line, 60, 190 + (index * 45)); 
            });
            
            prCtx.textAlign = 'center'; prCtx.fillStyle = '#aaaaaa'; prCtx.font = '16px Sarabun, sans-serif';
            prCtx.fillText('หน้า 1/2 : สลับหน้าอัตโนมัติ', 250, 630);
            
        } else {
            prCtx.textAlign = 'center'; prCtx.fillStyle = '#ffeb3b'; prCtx.font = 'bold 26px Sarabun, sans-serif'; 
            prCtx.fillText(appConfig.prBoard.contactTitle, 250, 160);
            
            prCtx.fillStyle = '#ffffff'; prCtx.font = '22px Sarabun, sans-serif';
            appConfig.prBoard.contactLines.forEach((line, index) => { 
                prCtx.fillText(line, 250, 220 + (index * 40)); 
            });
            
            prCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            if (prCtx.roundRect) { 
                prCtx.beginPath(); prCtx.roundRect(70, 420, 360, 110, 15); prCtx.fill(); 
                prCtx.strokeStyle = '#ffd700'; prCtx.lineWidth = 2; prCtx.stroke();
            } else { 
                prCtx.fillRect(70, 420, 360, 110); 
            }
            prCtx.fillStyle = '#00ffcc'; prCtx.font = 'bold 22px Sarabun, sans-serif'; 
            prCtx.fillText(appConfig.prBoard.contactBoxTitle, 250, 465);
            prCtx.fillStyle = '#ffffff'; prCtx.font = 'bold 34px Sarabun, sans-serif'; 
            prCtx.fillText(appConfig.prBoard.contactPhone, 250, 510);
            
            prCtx.fillStyle = '#aaaaaa'; prCtx.font = '16px Sarabun, sans-serif';
            prCtx.fillText('หน้า 2/2 : สลับหน้าอัตโนมัติ', 250, 630);
        }

        prCtx.globalAlpha = 1.0; 
        prTexture.needsUpdate = true; 
    }

    drawPRBoard(); 

    setInterval(() => {
        if (!scene.visible) return;
        
        let fadeOutTimer = setInterval(() => {
            prOpacity -= 0.1; 
            if (prOpacity <= 0) {
                prOpacity = 0;
                clearInterval(fadeOutTimer); 
                
                prPageState = (prPageState + 1) % 2; 
                drawPRBoard();
                
                let fadeInTimer = setInterval(() => {
                    prOpacity += 0.1; 
                    if (prOpacity >= 1.0) {
                        prOpacity = 1.0;
                        clearInterval(fadeInTimer); 
                    }
                    drawPRBoard();
                }, 35); 
            } else {
                drawPRBoard();
            }
        }, 35); 
        
    }, 8000); 

    const prHotspot = new THREE.Mesh(hotspotGeo, hotspotMat); prHotspot.position.set(-5.0, 0.025, 0.0);
    prHotspot.userData = { isHotspot: true, type: "PR", targetPos: new THREE.Vector3(-5.0, 1.5, 0.0), lookAtPos: new THREE.Vector3(-7.5, 1.675, 0.0) }; scene.add(prHotspot);

    const prBackHitbox = new THREE.Mesh(backBtnGeo, hitboxMat); prBackHitbox.position.set(-0.6, -1.575, 0.07); prBackHitbox.userData = { isBackButton: true }; prGroup.add(prBackHitbox);
    const prWarpHitbox = new THREE.Mesh(warpBtnGeo, hitboxMat); prWarpHitbox.position.set(0.575, -1.575, 0.07); prWarpHitbox.userData = { isWarpButton: true }; prGroup.add(prWarpHitbox);

    // 2. Dev Board
    const devGroup = new THREE.Group(); devGroup.position.set(7.5, 1.925, 0.0); devGroup.rotation.y = -Math.PI / 2; scene.add(devGroup);
    const devFrame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.95, 0.1), new THREE.MeshStandardMaterial({ color: 0x4a2b18, roughness: 1.0 })); devGroup.add(devFrame);
    const devCanvas = document.createElement('canvas'); devCanvas.width = 500; devCanvas.height = 750; const devCtx = devCanvas.getContext('2d');
    const devWoodGrad = devCtx.createLinearGradient(0, 0, 0, 750);
    devWoodGrad.addColorStop(0, '#5c3a21'); devWoodGrad.addColorStop(0.4, '#422815'); devWoodGrad.addColorStop(0.8, '#5c3a21'); devWoodGrad.addColorStop(1, '#2e1b0d');
    devCtx.fillStyle = devWoodGrad; devCtx.fillRect(0, 0, 500, 750); devCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    for (let i = 0; i < 500; i += 8) { if (Math.random() > 0.2) devCtx.fillRect(i, 0, Math.random() * 3 + 1, 750); }
    devCtx.fillStyle = '#ffd700'; devCtx.font = 'bold 32px Sarabun, sans-serif'; devCtx.textAlign = 'center'; devCtx.fillText('🙏 ร่วมสร้างวิหารธรรมออนไลน์', 250, 60);
    devCtx.beginPath(); devCtx.moveTo(40, 80); devCtx.lineTo(460, 80); devCtx.strokeStyle = '#ffd700'; devCtx.lineWidth = 2; devCtx.stroke();
    devCtx.fillStyle = '#ffffff'; devCtx.font = 'bold 22px Sarabun, sans-serif'; devCtx.fillText('"ทุกการภาวนาที่เกิดขึ้น ณ พื้นที่แห่งนี้', 250, 130); devCtx.fillText('ท่านคือผู้มีส่วนร่วมในมหากุศล"', 250, 165);
    devCtx.fillStyle = '#cccccc'; devCtx.font = '18px Sarabun, sans-serif'; devCtx.fillText('หากผลงานนี้มีประโยชน์กับคุณ หรือมีไอเดียอยากเสนอแนะเพิ่มเติม', 250, 230);
    devCtx.fillText('สามารถทักมาพูดคุย เลี้ยงกาแฟ หรือร่วมสนับสนุนโปรเจกต์ได้เลย', 250, 260); devCtx.fillText('ครับ ยินดีรับฟังทุกความคิดเห็น!', 250, 290);
    devCtx.fillStyle = '#ffffff';
    if (devCtx.roundRect) { devCtx.beginPath(); devCtx.roundRect(50, 360, 400, 240, 15); devCtx.fill(); devCtx.strokeStyle = '#ffd700'; devCtx.lineWidth = 4; devCtx.stroke();
    } else { devCtx.fillRect(50, 360, 400, 240); }
    devCtx.fillStyle = '#666666'; devCtx.font = 'bold 24px Sarabun, sans-serif'; devCtx.fillText('LINE ID / เบอร์โทร:', 250, 410);
    devCtx.fillStyle = '#4CAF50'; devCtx.font = 'bold 36px Sarabun, sans-serif'; devCtx.fillText('0926533228', 250, 460);
    devCtx.fillStyle = '#5ac346';
    if (devCtx.roundRect) { devCtx.beginPath(); devCtx.roundRect(100, 500, 300, 60, 30); devCtx.fill(); } else { devCtx.fillRect(100, 500, 300, 60); }
    devCtx.fillStyle = '#ffffff'; devCtx.font = 'bold 22px Sarabun, sans-serif'; devCtx.fillText('💬 ทักไลน์มาคุยกัน', 250, 538);
    drawBoardButtons(devCtx); 

    const devTexture = new THREE.CanvasTexture(devCanvas); devTexture.colorSpace = THREE.SRGBColorSpace;
    const devPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.75), new THREE.MeshBasicMaterial({ map: devTexture })); devPlane.position.set(0, 0, 0.06); devGroup.add(devPlane);

    const lineBtnGeo = new THREE.PlaneGeometry(1.5, 0.3); const lineBtnMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0 });
    const lineHitbox = new THREE.Mesh(lineBtnGeo, lineBtnMat); lineHitbox.position.set(0, -0.775, 0.07); lineHitbox.userData = { isLineButton: true }; devGroup.add(lineHitbox);

    const devHotspot = new THREE.Mesh(hotspotGeo, hotspotMat.clone()); devHotspot.position.set(5.0, 0.025, 0.0);
    devHotspot.userData = { isHotspot: true, type: "DEV", targetPos: new THREE.Vector3(5.0, 1.5, 0.0), lookAtPos: new THREE.Vector3(7.5, 1.675, 0.0) }; scene.add(devHotspot);
    
    const devBackHitbox = new THREE.Mesh(backBtnGeo, hitboxMat); devBackHitbox.position.set(-0.6, -1.575, 0.07); devBackHitbox.userData = { isBackButton: true }; devGroup.add(devBackHitbox);
    const devWarpHitbox = new THREE.Mesh(warpBtnGeo, hitboxMat); devWarpHitbox.position.set(0.575, -1.575, 0.07); devWarpHitbox.userData = { isWarpButton: true }; devGroup.add(devWarpHitbox);

    // 3. VR Guide Board
    const vrGuideGroup = new THREE.Group(); vrGuideGroup.position.set(-5.5, 1.925, -5.0); vrGuideGroup.rotation.y = Math.PI / 4; scene.add(vrGuideGroup);
    const vrFrame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.95, 0.1), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 })); vrGuideGroup.add(vrFrame);
    const vrCanvas = document.createElement('canvas'); vrCanvas.width = 500; vrCanvas.height = 750; const vrCtx = vrCanvas.getContext('2d');
    const vrBgGrad = vrCtx.createLinearGradient(0, 0, 0, 750); vrBgGrad.addColorStop(0, '#1a1a2e'); vrBgGrad.addColorStop(1, '#16213e');
    vrCtx.fillStyle = vrBgGrad; vrCtx.fillRect(0, 0, 500, 750);
    vrCtx.strokeStyle = '#0f3460'; vrCtx.lineWidth = 10; vrCtx.strokeRect(5, 5, 490, 740);
    vrCtx.strokeStyle = '#e94560'; vrCtx.lineWidth = 2; vrCtx.strokeRect(15, 15, 470, 720);
    vrCtx.fillStyle = '#e94560'; vrCtx.font = 'bold 36px Sarabun, sans-serif'; vrCtx.textAlign = 'center'; vrCtx.fillText('👓 แนะนำการรับชมด้วยแว่น VR', 250, 70);
    vrCtx.beginPath(); vrCtx.moveTo(40, 90); vrCtx.lineTo(460, 90); vrCtx.strokeStyle = '#e94560'; vrCtx.lineWidth = 2; vrCtx.stroke();
    vrCtx.fillStyle = '#ffffff'; vrCtx.font = '22px Sarabun, sans-serif'; vrCtx.fillText('นิทรรศการนี้ถูกออกแบบมาเพื่อรองรับการรับชม', 250, 140); vrCtx.fillText('แบบ 360 องศาเต็มรูปแบบ ในโลกเสมือนจริง', 250, 175);
    vrCtx.fillStyle = '#00ffcc'; vrCtx.font = 'bold 24px Sarabun, sans-serif'; vrCtx.fillText('อุปกรณ์ที่รองรับ:', 250, 240);
    vrCtx.fillStyle = '#cccccc'; vrCtx.font = '22px Sarabun, sans-serif'; vrCtx.fillText('• Meta Quest 2, 3, Pro', 250, 275); vrCtx.fillText('• Pico 4 / Apple Vision Pro', 250, 310); vrCtx.fillText('• แว่น PC VR อื่นๆ ผ่านเบราว์เซอร์', 250, 345);
    vrCtx.fillStyle = '#ff9800'; vrCtx.font = 'bold 24px Sarabun, sans-serif'; vrCtx.fillText('วิธีเข้าใช้งาน:', 250, 420);
    vrCtx.fillStyle = '#ffffff'; vrCtx.font = '20px Sarabun, sans-serif'; vrCtx.fillText('1. เปิดแอปเบราว์เซอร์ (Browser) ภายในแว่น VR', 250, 460); vrCtx.fillText('2. พิมพ์ URL เพื่อเข้าสู่เว็บไซต์นี้', 250, 495);
    vrCtx.fillText('3. คลิกที่ปุ่ม "ENTER VR" บริเวณขอบจอด้านล่าง', 250, 530); vrCtx.fillText('4. สัมผัสประสบการณ์โลกเสมือนจริงได้ทันที', 250, 565);
    drawBoardButtons(vrCtx);

    const vrTexture = new THREE.CanvasTexture(vrCanvas); vrTexture.colorSpace = THREE.SRGBColorSpace;
    const vrPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.75), new THREE.MeshBasicMaterial({ map: vrTexture })); vrPlane.position.set(0, 0, 0.06); vrGuideGroup.add(vrPlane);

    const vrTargetPos = new THREE.Vector3(-3.5, 1.5, -3.0); const vrLookAtPos = new THREE.Vector3(-5.5, 1.675, -5.0);
    
    const vrBackHitbox = new THREE.Mesh(backBtnGeo, hitboxMat); vrBackHitbox.position.set(-0.6, -1.575, 0.07); vrBackHitbox.userData = { isBackButton: true }; vrGuideGroup.add(vrBackHitbox);
    const vrWarpHitbox = new THREE.Mesh(warpBtnGeo, hitboxMat); vrWarpHitbox.position.set(0.575, -1.575, 0.07); vrWarpHitbox.userData = { isWarpButton: true }; vrGuideGroup.add(vrWarpHitbox);

    const interactables = [...cushionsList, prHotspot, devHotspot, lineHitbox, prBackHitbox, prWarpHitbox, devBackHitbox, devWarpHitbox, vrBackHitbox, vrWarpHitbox];

    let isSeated = false, isReading = false, isTransitioning = false, mySelectedCushion = null;
    const targetCamPos = new THREE.Vector3(), targetLookAt = new THREE.Vector3();
    const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();

    function goBackToStandby() {
        if (mySelectedCushion) {
            mySelectedCushion.userData.isMine = false; mySelectedCushion.userData.isOccupied = false;
            mySelectedCushion.material.color.setHex(0x3b2219); mySelectedCushion = null;
        }
        document.getElementById('stand-btn').style.display = 'none';
        
        document.getElementById('warp-btn').style.display = 'block';
        
        const bottomMenu = document.getElementById('bottom-menu-hud');
        if (bottomMenu) bottomMenu.style.display = 'flex';

        toggleReactionUI(true);

        isSeated = false; isReading = false; isTransitioning = true; controls.enabled = false;
        targetCamPos.copy(defaultCameraPos); targetLookAt.copy(defaultTargetPos);
        currentSeatStatus = "สถานะ: คลิกเลือกเบาะ หรือคลิกจุดสีทองหน้าบอร์ด";
    }

    function moveToBoard(targetPos, lookAtPos, statusText) {
        if (!scene.visible || isTransitioning || isSeated || isReading) return;
        targetCamPos.copy(targetPos); targetLookAt.copy(lookAtPos);
        isReading = true; isTransitioning = true; controls.enabled = false;
        
        document.getElementById('stand-btn').style.display = 'none';
        document.getElementById('warp-btn').style.display = 'none';
        const bottomMenu = document.getElementById('bottom-menu-hud');
        if (bottomMenu) bottomMenu.style.display = 'none';
        
        toggleReactionUI(false);
        
        currentSeatStatus = `สถานะ: ยืนอ่าน (${statusText})`;
    }

    window.addEventListener('click', (event) => {
        if (event.target.tagName !== 'CANVAS') return;
        if (!scene.visible || isTransitioning) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1; mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactables);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            
            if (obj.userData.isBackButton) { goBackToStandby(); return; }
            if (obj.userData.isWarpButton) { document.getElementById('warp-btn').click(); return; }
            if (obj.userData.isLineButton) { window.open('https://line.me/ti/p/~0926533228', '_blank'); return; }

            if (isSeated || isReading) return;

            if (obj.userData.isHotspot) {
                targetCamPos.copy(obj.userData.targetPos); targetLookAt.copy(obj.userData.lookAtPos);
                isReading = true; isTransitioning = true; controls.enabled = false;
                
                document.getElementById('stand-btn').style.display = 'none';
                document.getElementById('warp-btn').style.display = 'none';
                const bottomMenu = document.getElementById('bottom-menu-hud');
                if (bottomMenu) bottomMenu.style.display = 'none';
                
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
                
                document.getElementById('stand-btn').style.display = 'block';
                document.getElementById('warp-btn').style.display = 'none';
                const bottomMenu = document.getElementById('bottom-menu-hud');
                if (bottomMenu) bottomMenu.style.display = 'none';
                
                currentSeatStatus = `สถานะ: นั่งสมาธิ แถว ${obj.userData.row}, ตัวที่ ${obj.userData.col}`;
            }
        }
    });

    document.getElementById('stand-btn').addEventListener('click', goBackToStandby);

    const prBoardBtn = document.getElementById('pr-board-btn');
    if (prBoardBtn) prBoardBtn.addEventListener('click', () => moveToBoard(new THREE.Vector3(-5.0, 1.5, 0.0), new THREE.Vector3(-7.5, 1.675, 0.0), "กระดานสะพานบุญ"));

    const devBoardBtn = document.getElementById('dev-board-btn');
    if (devBoardBtn) devBoardBtn.addEventListener('click', () => moveToBoard(new THREE.Vector3(5.0, 1.5, 0.0), new THREE.Vector3(7.5, 1.675, 0.0), "บอร์ดสนับสนุนผู้พัฒนา"));

    const vrGuideBtn = document.getElementById('vr-guide-btn');
    if (vrGuideBtn) {
        const newVrGuideBtn = vrGuideBtn.cloneNode(true);
        vrGuideBtn.parentNode.replaceChild(newVrGuideBtn, vrGuideBtn);
        newVrGuideBtn.addEventListener('click', () => moveToBoard(vrTargetPos, vrLookAtPos, "คำแนะนำ VR"));
    }

    const rotatingEl = document.getElementById('rotating-status');
    let currentStatusIndex = 0; const statusColors = ['#ffd700', '#00ffcc'];

    setInterval(() => {
        if (!scene.visible) return; 
        rotatingEl.style.opacity = 0;
        setTimeout(() => {
            const textToShow = currentStatusIndex === 0 ? currentScheduleStatus : currentSeatStatus;
            rotatingEl.innerText = textToShow; rotatingEl.style.color = statusColors[currentStatusIndex];
            rotatingEl.style.borderColor = statusColors[currentStatusIndex]; rotatingEl.style.opacity = 1;
            currentStatusIndex = (currentStatusIndex + 1) % 2;
        }, 400);
    }, 3500);

    setInterval(() => {
        if (!scene.visible) return;
        const now = new Date();
        document.getElementById('time-display').innerText = now.toLocaleTimeString('th-TH', { hour12: false });
        
        const cleanDateStr = now.toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        document.getElementById('date-display').innerText = cleanDateStr;
        
        const lunarEl = document.getElementById('lunar-display');
        if (lunarEl) lunarEl.style.display = 'none';
    }, 1000);

    let bottomMenuState = 0;
    setInterval(() => {
        if (!scene.visible) return;

        const prBtn = document.getElementById('pr-board-btn');
        const devBtn = document.getElementById('dev-board-btn');
        const vrBtn = document.getElementById('vr-guide-btn');

        const vrButtonEl = document.getElementById('VRButton');
        const isVrNeeded = vrButtonEl && (vrButtonEl.style.display === 'none' || vrButtonEl.textContent.includes('NOT'));

        bottomMenuState++;
        if (bottomMenuState > 2) bottomMenuState = 0;
        
        if (!isVrNeeded && bottomMenuState === 2) {
            bottomMenuState = 0; 
        }

        if (prBtn) prBtn.style.opacity = 0;
        if (devBtn) devBtn.style.opacity = 0;
        if (vrBtn) vrBtn.style.opacity = 0;

        setTimeout(() => {
            if (prBtn) prBtn.style.display = 'none';
            if (devBtn) devBtn.style.display = 'none';
            if (vrBtn) vrBtn.style.display = 'none';

            if (bottomMenuState === 0 && prBtn) { prBtn.style.display = 'inline-block'; prBtn.style.opacity = 1; }
            else if (bottomMenuState === 1 && devBtn) { devBtn.style.display = 'inline-block'; devBtn.style.opacity = 1; }
            else if (bottomMenuState === 2 && vrBtn) { vrBtn.style.display = 'inline-block'; vrBtn.style.opacity = 1; }
        }, 300);
    }, 5000);

    function onEnterScene() {
        div.style.display = 'block'; cssObject.visible = true; 
        window.currentActiveMainZone = 'meditation';
        window.currentActiveSubZone = '';

        updateServerStatusUI(); updateVideoAndSchedule(); 
        
        if (isSeated || isReading) {
            if (isSeated) document.getElementById('stand-btn').style.display = 'block'; 
            document.getElementById('warp-btn').style.display = 'none';
            
            const bottomMenu = document.getElementById('bottom-menu-hud');
            if (bottomMenu) bottomMenu.style.display = 'none';
        } else {
            document.getElementById('warp-btn').style.display = 'block';
            
            const bottomMenu = document.getElementById('bottom-menu-hud');
            if (bottomMenu) bottomMenu.style.display = 'flex';
        }
    }
    
    function onExitScene() {
        div.style.display = 'none'; cssObject.visible = false; 
        document.getElementById('stand-btn').style.display = 'none';
        document.getElementById('warp-btn').style.display = 'none';
        
        const bottomMenu = document.getElementById('bottom-menu-hud');
        if (bottomMenu) bottomMenu.style.display = 'none';
        
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

        // อัปเดตลูกไฟสวรรค์รอบพระประธาน
        if (scene.visible && window.updateBuddhaEffects) {
            window.updateBuddhaEffects();
        }

        // [แก้ใหม่] อัปเดตแอนิเมชันหิ่งห้อย (เรียกจากไฟล์แยก)
        if (scene.visible) updateFireflies();

        // ซ่อนจอ YouTube เมื่อมองจากด้านหลัง (ป้องกันจอทะลุ)
        if (scene.visible) {
            const tvWorldPos = new THREE.Vector3();
            tvGroup.getWorldPosition(tvWorldPos);

            const tvNormal = new THREE.Vector3(0, 0, 1);
            tvNormal.applyQuaternion(tvGroup.quaternion);

            const viewDir = new THREE.Vector3().subVectors(camera.position, tvWorldPos).normalize();

            if (tvNormal.dot(viewDir) < 0) {
                cssObject.visible = false; 
            } else {
                cssObject.visible = true; 
            }
        }
    }

    return { scene, camera, controls, update, onEnterScene, onExitScene };
}