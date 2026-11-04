import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// บรรทัดนี้สำคัญมากครับ ต้องมี ref และคำสั่งอื่นๆ ครบถ้วน
import { ref, get, update, onValue, onDisconnect, increment, set, onChildAdded, onChildRemoved } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

import { appConfig } from '../config.js';
import { updateEngagingContext, toggleReactionUI } from './engaging.js';
import { createMeditatorAvatar } from './avatar.js';
import { loadBuddhaWithEffects, updateBuddhaEffects } from './buddha.js';
import { createFireflies, updateFireflies } from './fireflies.js';;

export function setupMeditationScene(renderer, cssRenderer, db, currentUserName) {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xa3c4d1, 0.02);
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load('textures/trees.jpg', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        scene.background = texture;
    });

    let fireflies = createFireflies();
    scene.add(fireflies);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffcc80, 1.5, 15); pointLight.position.set(0, 4, -2); scene.add(pointLight);
    
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
            scene.fog.color.setHex(0x08152b);
            scene.fog.density = 0.05; 
            ambientLight.color.setHex(0x2a3b5c); 
            ambientLight.intensity = 0.6; 
            moonLight.intensity = 1.2; 
            pointLight.intensity = 1.0; 
            if (fireflies) fireflies.visible = true;
        } else {
            if (scene.backgroundIntensity !== undefined) scene.backgroundIntensity = 1.0;
            scene.fog.color.setHex(0xa3c4d1);
            scene.fog.density = 0.015; 
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
    let currentSeatStatus = "สถานะ: คลิกเลือกเบาะ หรือเลือกเมนูด้านบน";
    let currentOverrideMode = null; 

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

    // --- ระบบซิงค์บอท Firebase ให้นั่งบนเบาะตรงกันทุกคน ---
    const activeBotsInScene = {};
    const botNamesList = ["กัลยาณมิตรใจดี", "ผู้แสวงบุญ", "คนรักสงบ", "ผู้ใฝ่ธรรม", "ศิษย์ตถาคต", "ผู้เบิกบาน", "ผู้เจริญในธรรม", "คนมีเมตตา"];

    function initFirebaseBots() {
        // อิงตามห้องที่อยู่ปัจจุบัน
        const botsRef = ref(db, `rooms/${myRoomId}/bots`);

        get(botsRef).then((snapshot) => {
            if (!snapshot.exists()) {
                // ถ้ายังไม่มีบอทในห้อง ให้สุ่มเบาะและส่งบอทขึ้น Firebase
                generateInitialBotsToFirebase();
            }
        });

        // เมื่อมีการแจ้งจาก Firebase ว่ามีบอทเพิ่ม
        onChildAdded(botsRef, (snapshot) => {
            const botId = snapshot.key;
            const data = snapshot.val();
            renderBot(botId, data);
        });

        // เมื่อบอทถูกลบออก
        onChildRemoved(botsRef, (snapshot) => {
            const botId = snapshot.key;
            if (activeBotsInScene[botId]) {
                const data = snapshot.val();
                const cushion = cushionsList[data.cushionIndex];
                if(cushion) {
                    cushion.userData.isOccupied = false;
                    cushion.material.color.setHex(0x3b2219); // คืนสีเบาะเป็นสีว่าง
                }
                seatingGroup.remove(activeBotsInScene[botId]);
                delete activeBotsInScene[botId];
                localBotCount--;
                updateServerStatusUI();
            }
        });
    }

    function generateInitialBotsToFirebase() {
        const numBots = Math.floor(Math.random() * 4) + 3; // สุ่ม 3-6 ตัวเหมือนเดิม
        const availableIndices = [...Array(cushionsList.length).keys()];
        
        for (let i = 0; i < numBots; i++) {
            if (availableIndices.length === 0) break;
            // สุ่มเลขเบาะที่ว่างอยู่
            const cushionIdx = availableIndices.splice(Math.floor(Math.random() * availableIndices.length), 1)[0];
            
            const botId = 'bot_' + i;
            const name = botNamesList[Math.floor(Math.random() * botNamesList.length)];
            
            const tempAvatar = createMeditatorAvatar(name);
            const colors = tempAvatar.userData.customColors;
            
            const botData = {
                name: name,
                colors: colors,
                cushionIndex: cushionIdx, // ส่งเลขเบาะไปให้ Firebase จำ
                state: 'SIT'
            };
            
            set(ref(db, `rooms/${myRoomId}/bots/${botId}`), botData);
        }
    }

    function renderBot(botId, data) {
        if(!activeBotsInScene[botId]) {
            localBotCount++;
            updateServerStatusUI();

            const cushion = cushionsList[data.cushionIndex];
            if(cushion) {
                // จองเบาะและเปลี่ยนสีเบาะเป็นสีเข้ม
                cushion.userData.isOccupied = true; 
                cushion.userData.occupantName = data.name;
                cushion.material.color.setHex(0x2a1610);
                
                // สร้างอวตารโดยใช้สีเดียวกับที่ดึงมาจาก Firebase
                const botAvatar = createMeditatorAvatar(data.name, data.colors);
                // จัดให้นั่งบนเบาะเป๊ะๆ
                botAvatar.position.set(cushion.position.x, 0.05, cushion.position.z);
                
                seatingGroup.add(botAvatar);
                activeBotsInScene[botId] = botAvatar;
            }

            // ส่งชื่อบอททั้งหมดให้ระบบ Engaging เอาไปสุ่มแชทสาธุ
            const currentBotNames = Object.values(activeBotsInScene).map(b => b.userData.userName);
            updateEngagingContext(myRoomId, currentBotNames);
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
        myRoomId = targetRoom; initFirebaseBots();
        
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

    // --- 1. ย้ายโต๊ะหมู่บูชาและพระประธานไปทางซ้าย ---
    const altarGroup = new THREE.Group(); 
    altarGroup.position.set(-6.5, 0, -5.5); 
    altarGroup.rotation.y = Math.PI / 6; 
    scene.add(altarGroup);
    
    // [แก้ไข] ขยายความกว้างโต๊ะ (แกน X เป็น 3.8) และความลึก (แกน Z เป็น 1.8) ให้กว้างสมกับฐานพระ
    const table = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.5, 1.8), new THREE.MeshStandardMaterial({ color: 0x4a2e18 })); 
    table.position.set(0, 1.25, 0); 
    altarGroup.add(table);

    loadBuddhaWithEffects(altarGroup);

    // --- YouTube CSS3D ---
    const tvGroup = new THREE.Group(); tvGroup.position.set(0, 2.9, -5.5); scene.add(tvGroup); 
    
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

    const iframe = document.createElement('iframe'); 
    iframe.width = "700"; 
    iframe.height = "400"; 
    iframe.frameBorder = "0"; 
    iframe.allowFullscreen = true; 
    
    // [แก้ไขจุดนี้] เพิ่มการอนุญาตให้เล่นอัตโนมัติ (Autoplay) ผ่าน iframe
    iframe.allow = "autoplay; encrypted-media; fullscreen"; 
    
    iframe.style.borderRadius = "4px"; 
    iframe.style.backfaceVisibility = 'hidden';
    iframe.style.webkitBackfaceVisibility = 'hidden';
    div.appendChild(iframe);
    
    const cssObject = new CSS3DObject(div); cssObject.position.set(0, 0, 0.12); cssObject.scale.set(0.01, 0.01, 0.01); tvGroup.add(cssObject);

    function updateVideoAndSchedule() {
        if (currentOverrideMode === 'PRAY') {
            const targetVideoUrl = `https://www.youtube.com/embed/O9RwxXP1Dwg?autoplay=1`; 
            const newScheduleStatus = "โหมด: ขอขมาและบูชาพระรัตนตรัย";
            
            if (currentScheduleStatus !== newScheduleStatus || !iframe.src.includes('O9RwxXP1Dwg')) {
                currentScheduleStatus = newScheduleStatus;
                iframe.src = targetVideoUrl;
            }
            return; 
        }

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
    
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 70px Sarabun, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
    ctx.fillText('🎧 โหมดวิทยุสมาธิ (VR Audio)', canvas.width / 2, 140);
    
    ctx.beginPath(); ctx.moveTo(350, 210); ctx.lineTo(930, 210); ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2; ctx.stroke();
    
    ctx.fillStyle = '#ffffff'; ctx.font = '36px Sarabun, sans-serif'; 
    ctx.fillText('เพื่อให้ท่านได้รับฟังเสียงสวดมนต์ในขณะอยู่ภายในโลกเสมือนจริง', canvas.width / 2, 270);
    
    // ===========================================
    // [อัปเดต] เช็คระบบปฏิบัติการว่าเป็น Windows หรือไม่ เพื่อแสดงข้อความที่เหมาะสม
    const isWindows = navigator.userAgent.toLowerCase().includes('windows');
    ctx.fillStyle = '#4CAF50'; ctx.font = 'bold 32px Sarabun, sans-serif'; 
    
    if (isWindows) {
        // ถ้าเป็น Windows ให้บอกทริคพับจอ
        ctx.fillText('💡 ทริคสำหรับ Windows: สามารถย่อหน้าต่าง (Minimize) เพื่อเป็นโหมดฟังเสียงได้', canvas.width / 2, 330);
    } else {
        // ถ้าไม่แน่ใจ หรือเป็นมือถือ/แท็บเล็ต/Mac ให้บอกให้เปิดหน้าเว็บทิ้งไว้
        ctx.fillText('💡 คำแนะนำ: กรุณาเปิดหน้าเว็บทิ้งไว้เพื่อการฟังเสียงสวดมนต์อย่างต่อเนื่อง', canvas.width / 2, 330);
    }
    // ===========================================
    
    ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 42px Sarabun, sans-serif'; 
    ctx.fillText('คำแนะนำขั้นตอนการใช้งาน:', canvas.width / 2, 410);
    
    ctx.fillStyle = '#ffffff'; ctx.font = '32px Sarabun, sans-serif';
    ctx.fillText('1. ถอดแว่น หรือกดปุ่ม "EXIT VR" ด้านล่าง เพื่อออกไปที่หน้าจอปกติก่อน', canvas.width / 2, 470);
    ctx.fillText('2. แตะที่จอ YouTube 1 ครั้งเพื่อปลดล็อคระบบเสียง (หากยังไม่ได้ยินเสียง)', canvas.width / 2, 530);
    ctx.fillText('3. กดปุ่ม "ENTER VR" เพื่อกลับเข้าสู่ลานปฏิบัติธรรมอีกครั้ง', canvas.width / 2, 590);
    
    const vrTextTexture = new THREE.CanvasTexture(canvas); vrTextTexture.colorSpace = THREE.SRGBColorSpace;
    const vrScreen = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.9), new THREE.MeshBasicMaterial({ map: vrTextTexture })); 
    vrScreen.position.set(0, 0, 0.11); 
    tvGroup.add(vrScreen);

    // --- 2. ยุบรวม Board ทั้ง 3 เป็นบอร์ดเดียว (PR Board 3-in-1) ไว้ทางขวา ---
    const hotspotGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32);
    const hotspotMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x886600 });
    const backBtnGeo = new THREE.PlaneGeometry(1.05, 0.3);
    const warpBtnGeo = new THREE.PlaneGeometry(1.1, 0.3);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    
    const prGroup = new THREE.Group(); 
    prGroup.position.set(5.5, 1.925, -5.5); 
    prGroup.rotation.y = -Math.PI / 8; 
    scene.add(prGroup);
    
    const prFrame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.95, 0.1), new THREE.MeshStandardMaterial({ color: 0x4a2b18, roughness: 1.0 })); prGroup.add(prFrame);
    
    const prCanvas = document.createElement('canvas'); prCanvas.width = 500; prCanvas.height = 750; 
    const prCtx = prCanvas.getContext('2d');
    const prTexture = new THREE.CanvasTexture(prCanvas); prTexture.colorSpace = THREE.SRGBColorSpace;
    const prPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.5, 3.75), 
        new THREE.MeshBasicMaterial({ 
            map: prTexture, 
            fog: false // ปิดหมอกไม่ให้บังบอร์ด PR
        })
    ); 
    prPlane.position.set(0, 0, 0.06); prGroup.add(prPlane);

    let prPageState = 0; 
    let prOpacity = 1.0; 

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

    function drawPRBoard() {
        prCtx.globalAlpha = 1.0; 
        
        const prWoodGrad = prCtx.createLinearGradient(0, 0, 0, 750);
        prWoodGrad.addColorStop(0, '#5c3a21'); prWoodGrad.addColorStop(0.4, '#422815'); 
        prWoodGrad.addColorStop(0.8, '#5c3a21'); prWoodGrad.addColorStop(1, '#2e1b0d');
        prCtx.fillStyle = prWoodGrad; prCtx.fillRect(0, 0, 500, 750); 
        
        prCtx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let i = 0; i < 500; i += 8) { if (Math.random() > 0.2) prCtx.fillRect(i, 0, Math.random() * 3 + 1, 750); }
        
        drawBoardButtons(prCtx); 

        prCtx.globalAlpha = prOpacity; 

        if (prPageState === 0) {
            prCtx.fillStyle = '#ffd700'; prCtx.font = 'bold 32px Sarabun, sans-serif'; prCtx.textAlign = 'center'; 
            prCtx.fillText(appConfig.prBoard.title, 250, 60);
            prCtx.beginPath(); prCtx.moveTo(80, 80); prCtx.lineTo(420, 80); prCtx.strokeStyle = '#ffd700'; prCtx.lineWidth = 2; prCtx.stroke();
            
            prCtx.fillStyle = '#00ffcc'; prCtx.font = 'bold 26px Sarabun, sans-serif'; 
            prCtx.fillText(appConfig.prBoard.scheduleTitle, 250, 130);
            
            prCtx.textAlign = 'left'; prCtx.fillStyle = '#ffffff'; prCtx.font = '22px Sarabun, sans-serif';
            appConfig.prBoard.scheduleLines.forEach((line, index) => { 
                prCtx.fillText(line, 60, 190 + (index * 45)); 
            });
            
            prCtx.textAlign = 'center'; prCtx.fillStyle = '#aaaaaa'; prCtx.font = '16px Sarabun, sans-serif';
            prCtx.fillText('หน้า 1/3 : ตารางออกอากาศ', 250, 630);
            
        } else if (prPageState === 1) {
            prCtx.fillStyle = '#ffd700'; prCtx.font = 'bold 32px Sarabun, sans-serif'; prCtx.textAlign = 'center'; prCtx.fillText('🙏 ร่วมสร้างวิหารธรรมออนไลน์', 250, 60);
            prCtx.beginPath(); prCtx.moveTo(40, 80); prCtx.lineTo(460, 80); prCtx.strokeStyle = '#ffd700'; prCtx.lineWidth = 2; prCtx.stroke();
            prCtx.fillStyle = '#ffffff'; prCtx.font = 'bold 22px Sarabun, sans-serif'; prCtx.fillText('"ทุกการภาวนาที่เกิดขึ้น ณ พื้นที่แห่งนี้', 250, 130); prCtx.fillText('ท่านคือผู้มีส่วนร่วมในมหากุศล"', 250, 165);
            prCtx.fillStyle = '#cccccc'; prCtx.font = '18px Sarabun, sans-serif'; prCtx.fillText('หากผลงานนี้มีประโยชน์กับคุณ หรือมีไอเดียอยากเสนอแนะเพิ่มเติม', 250, 230);
            prCtx.fillText('สามารถทักมาพูดคุย เลี้ยงกาแฟ หรือร่วมสนับสนุนโปรเจกต์ได้เลย', 250, 260); prCtx.fillText('ครับ ยินดีรับฟังทุกความคิดเห็น!', 250, 290);
            prCtx.fillStyle = '#ffffff';
            if (prCtx.roundRect) { prCtx.beginPath(); prCtx.roundRect(50, 360, 400, 240, 15); prCtx.fill(); prCtx.strokeStyle = '#ffd700'; prCtx.lineWidth = 4; prCtx.stroke();
            } else { prCtx.fillRect(50, 360, 400, 240); }
            prCtx.fillStyle = '#666666'; prCtx.font = 'bold 24px Sarabun, sans-serif'; prCtx.fillText('LINE ID / เบอร์โทร:', 250, 410);
            prCtx.fillStyle = '#4CAF50'; prCtx.font = 'bold 36px Sarabun, sans-serif'; prCtx.fillText('0926533228', 250, 460);
            
            prCtx.fillStyle = '#aaaaaa'; prCtx.font = '16px Sarabun, sans-serif';
            prCtx.fillText('หน้า 2/3 : ผู้พัฒนา', 250, 630);
        } else {
            prCtx.fillStyle = '#e94560'; prCtx.font = 'bold 36px Sarabun, sans-serif'; prCtx.textAlign = 'center'; prCtx.fillText('👓 แนะนำการรับชมด้วยแว่น VR', 250, 70);
            prCtx.beginPath(); prCtx.moveTo(40, 90); prCtx.lineTo(460, 90); prCtx.strokeStyle = '#e94560'; prCtx.lineWidth = 2; prCtx.stroke();
            prCtx.fillStyle = '#ffffff'; prCtx.font = '22px Sarabun, sans-serif'; prCtx.fillText('นิทรรศการนี้ถูกออกแบบมาเพื่อรองรับการรับชม', 250, 140); prCtx.fillText('แบบ 360 องศาเต็มรูปแบบ ในโลกเสมือนจริง', 250, 175);
            prCtx.fillStyle = '#00ffcc'; prCtx.font = 'bold 24px Sarabun, sans-serif'; prCtx.fillText('อุปกรณ์ที่รองรับ:', 250, 240);
            prCtx.fillStyle = '#cccccc'; prCtx.font = '22px Sarabun, sans-serif'; prCtx.fillText('• Meta Quest 2, 3, Pro', 250, 275); prCtx.fillText('• Pico 4 / Apple Vision Pro', 250, 310); prCtx.fillText('• แว่น PC VR อื่นๆ ผ่านเบราว์เซอร์', 250, 345);
            prCtx.fillStyle = '#ff9800'; prCtx.font = 'bold 24px Sarabun, sans-serif'; prCtx.fillText('วิธีเข้าใช้งาน:', 250, 420);
            prCtx.fillStyle = '#ffffff'; prCtx.font = '20px Sarabun, sans-serif'; prCtx.fillText('1. เปิดแอปเบราว์เซอร์ (Browser) ภายในแว่น VR', 250, 460); prCtx.fillText('2. พิมพ์ URL เพื่อเข้าสู่เว็บไซต์นี้', 250, 495);
            prCtx.fillText('3. คลิกที่ปุ่ม "ENTER VR" บริเวณขอบจอด้านล่าง', 250, 530); prCtx.fillText('4. สัมผัสประสบการณ์โลกเสมือนจริงได้ทันที', 250, 565);
            
            prCtx.fillStyle = '#aaaaaa'; prCtx.font = '16px Sarabun, sans-serif';
            prCtx.fillText('หน้า 3/3 : คำแนะนำ VR', 250, 630);
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
                
                prPageState = (prPageState + 1) % 3; 
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

    const prHotspot = new THREE.Mesh(hotspotGeo, hotspotMat); prHotspot.position.set(4.0, 0.025, -4.0);
    prHotspot.userData = { isHotspot: true, type: "PR", targetPos: new THREE.Vector3(2.5, 1.5, -3.0), lookAtPos: new THREE.Vector3(5.5, 1.675, -5.5) }; scene.add(prHotspot);

    const prBackHitbox = new THREE.Mesh(backBtnGeo, hitboxMat); prBackHitbox.position.set(-0.6, -1.575, 0.07); prBackHitbox.userData = { isBackButton: true }; prGroup.add(prBackHitbox);
    const prWarpHitbox = new THREE.Mesh(warpBtnGeo, hitboxMat); prWarpHitbox.position.set(0.575, -1.575, 0.07); prWarpHitbox.userData = { isWarpButton: true }; prGroup.add(prWarpHitbox);

    const interactables = [...cushionsList, prHotspot, prBackHitbox, prWarpHitbox];

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
        
        toggleReactionUI(true);

        isSeated = false; isReading = false; isTransitioning = true; controls.enabled = false;
        targetCamPos.copy(defaultCameraPos); targetLookAt.copy(defaultTargetPos);
        currentSeatStatus = "สถานะ: คลิกเลือกเบาะ หรือเลือกเมนูด้านบน";

        if (currentOverrideMode !== null) {
            currentOverrideMode = null;
            updateVideoAndSchedule();
        }

        const topCapsule = document.getElementById('top-capsule-menu');
        if (topCapsule) topCapsule.style.display = 'flex';

        // [เพิ่มจุดนี้] ปลดล็อคพิกัดอวตาร ให้กลับมาอิงตามกล้องปกติเวลาเดิน
        window.lockedAvatar = null; 
    }

    // [แก้ไขจุดนี้] เพิ่มการรับค่าท่าทาง (poseState) ว่าจะให้นั่งหรือยืน
    function moveToBoard(targetPos, lookAtPos, statusText, poseState = 'STAND') {
        if (!scene.visible || isTransitioning || isSeated || isReading) return;
        targetCamPos.copy(targetPos); targetLookAt.copy(lookAtPos);
        isReading = true; isTransitioning = true; controls.enabled = false;
        
        document.getElementById('stand-btn').style.display = 'block'; 
        document.getElementById('warp-btn').style.display = 'none';
        
        toggleReactionUI(false);
        
        currentSeatStatus = `สถานะ: ${poseState === 'STAND' ? 'ยืนอ่าน' : 'นั่ง'} (${statusText})`;

        // [เพิ่มจุดนี้] สั่งล็อคพิกัดและท่าทางส่งให้ Firebase ทันทีที่เข้าโหมด
        window.lockedAvatar = { x: targetPos.x, y: 0, z: targetPos.z, state: poseState };
    }

    // --- 3. เพิ่มการเชื่อมต่อปุ่มแคปซูลเมนูด้านบน ---
    const prayBtn = document.getElementById('pray-btn');
    const infoBoardBtn = document.getElementById('info-board-btn');
    const topCapsule = document.getElementById('top-capsule-menu'); 

    if (prayBtn) {
        prayBtn.addEventListener('click', () => {
            currentOverrideMode = 'PRAY'; 
            updateVideoAndSchedule();

            // ส่งคำสั่ง 'SIT' เพื่อให้นั่งขอขมา
            moveToBoard(
                new THREE.Vector3(-2.49, 2.20, -1.27), 
                new THREE.Vector3(-3.00, 2.00, -5.50), 
                "บูชาพระรัตนตรัย",
                'SIT'
            );
            
            if (topCapsule) topCapsule.style.display = 'none';
        });
    }

    if (infoBoardBtn) {
        infoBoardBtn.addEventListener('click', () => {
            currentOverrideMode = null; 
            updateVideoAndSchedule();

            // ส่งคำสั่ง 'STAND' เพื่อให้ยืนอ่านบอร์ด
            moveToBoard(
                new THREE.Vector3(1.67, 2.05, -1.29),  
                new THREE.Vector3(2.00, 2.00, -5.50),  
                "กระดานประชาสัมพันธ์",
                'STAND'
            );
            
            if (topCapsule) topCapsule.style.display = 'none';
        });
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
                const boardType = obj.userData.type === "PR" ? "กระดานประชาสัมพันธ์" : "บอร์ดอื่นๆ";
                // ดึงพิกัดจากปุ่ม hotspot และล็อคให้เป็นท่ายืน
                moveToBoard(obj.userData.targetPos, obj.userData.lookAtPos, boardType, 'STAND');
            } else if (!obj.userData.isOccupied) {
                obj.userData.isOccupied = true; obj.userData.isMine = true;
                obj.material.color.setHex(0x00ffcc); mySelectedCushion = obj;
                
                const pos = new THREE.Vector3(); obj.getWorldPosition(pos);
                targetCamPos.set(pos.x, 1.0, pos.z);
                
                const dir = new THREE.Vector3(0, 2.9, -5.5).sub(targetCamPos).normalize();
                targetLookAt.copy(targetCamPos).add(dir.multiplyScalar(0.01));
                
                isSeated = true; isTransitioning = true; controls.enabled = false;
                
                document.getElementById('stand-btn').style.display = 'block';
                document.getElementById('warp-btn').style.display = 'none';
                
                currentSeatStatus = `สถานะ: นั่งสมาธิ แถว ${obj.userData.row}, ตัวที่ ${obj.userData.col}`;

                // [เพิ่มจุดนี้] ล็อคพิกัดอวตารให้อยู่กับเบาะนั่งอย่างตายตัว
                window.lockedAvatar = { x: pos.x, y: 0, z: pos.z, state: 'SIT' };
            }
        }
    });

    document.getElementById('stand-btn').addEventListener('click', goBackToStandby);

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

    function onEnterScene() {
        div.style.display = 'block'; cssObject.visible = true; 
        window.currentActiveMainZone = 'meditation';
        window.currentActiveSubZone = '';

        updateServerStatusUI(); updateVideoAndSchedule(); 
        
        if (isSeated || isReading) {
            if (isSeated || isReading) document.getElementById('stand-btn').style.display = 'block'; 
            document.getElementById('warp-btn').style.display = 'none';
        } else {
            document.getElementById('warp-btn').style.display = 'block';
        }
    }
    
    function onExitScene() {
        div.style.display = 'none'; cssObject.visible = false; 
        document.getElementById('stand-btn').style.display = 'none';
        document.getElementById('warp-btn').style.display = 'none';
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
        } else if (controls.enabled) { 
            controls.update(); 
            
            // ==========================================
            // [อัปเดต] ล็อกขอบเขตมุมกล้องและพิกัดการเดิน (Boundary Clamping)
            
            // 1. ล็อกความสูง (แกน Y)
            // - ป้องกันมุดใต้ดิน (ต่ำสุด 0.5)
            // - ป้องกันลอยเหนือเศียรพระประธาน (สูงสุด 3.0)
            if (camera.position.y < 0.5) camera.position.y = 0.5;
            if (camera.position.y > 3.0) camera.position.y = 3.0;

            // 2. ล็อกระยะการเดินลึกเข้าไปในจอ (แกน Z)
            // - จอทีวีอยู่แถวๆ Z = -5.5 เราจะบล็อกให้เดินใกล้สุดได้แค่ Z = -4.5 (ไม่ให้ทะลุจอ)
            // - ถอยหลังสุดได้ถึง Z = 15.0
            if (camera.position.z < -4.5) camera.position.z = -4.5;
            if (camera.position.z > 15.0) camera.position.z = 15.0;

            // 3. ล็อกระยะการเดินซ้าย-ขวา (แกน X)
            // - ไม่ให้ออกนอกลานดิน (ซ้ายสุด -7.5, ขวาสุด 7.5)
            if (camera.position.x < -7.5) camera.position.x = -7.5;
            if (camera.position.x > 7.5) camera.position.x = 7.5;

            // 4. ล็อกการเงยหน้า (Polar Angle)
            // - ไม่ให้ก้มจนเห็นแต่พื้นมากเกินไป และไม่เงยหน้าจนทะลุเพดานป่า
            // Math.PI / 2 คือระดับสายตาขนานพื้น
            const minLookUp = (Math.PI / 2) - 0.5; // เงยสุด
            const maxLookDown = (Math.PI / 2) + 0.3; // ก้มสุด
            
            if (controls.getPolarAngle() < minLookUp) {
                controls.minPolarAngle = minLookUp;
            } else if (controls.getPolarAngle() > maxLookDown) {
                controls.maxPolarAngle = maxLookDown;
            } else {
                controls.minPolarAngle = 0; 
                controls.maxPolarAngle = Math.PI; 
            }
            // ==========================================
        }

        if (scene.visible) {
            updateBuddhaEffects();
            updateFireflies();
            
            // ==========================================
            // [เพิ่มใหม่] สั่งให้อวตารบอททั้งหมดกระพริบตา
            Object.values(activeBotsInScene).forEach(bot => {
                if (bot.update) bot.update();
            });
            // ==========================================
        }

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

    window.addEventListener('keydown', (event) => {
        if (event.key === 'c' || event.key === 'C') {
            const cam = camera.position;
            const tgt = controls.target;
            const coordText = `CamPos: ${cam.x.toFixed(2)}, ${cam.y.toFixed(2)}, ${cam.z.toFixed(2)}\nLookAt: ${tgt.x.toFixed(2)}, ${tgt.y.toFixed(2)}, ${tgt.z.toFixed(2)}`;
            
            console.log("พิกัดมุมกล้อง:\n" + coordText);
            alert("จดตัวเลขนี้ส่งมาให้ผมได้เลยครับ:\n\n" + coordText);
        }
    });

    return { scene, camera, controls, update, onEnterScene, onExitScene };
}