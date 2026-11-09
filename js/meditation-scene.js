import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { ref, get, update, onValue, onDisconnect, increment, set, onChildAdded, onChildRemoved } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { appConfig } from '../config.js';
import { updateEngagingContext, toggleReactionUI } from './engaging.js';
import { createMeditatorAvatar } from './avatar.js';
import { createNakee, defaultBodyMat, defaultBellyMat } from './nakee.js';
import { loadBuddhaWithEffects, updateBuddhaEffects, togglePrayLight } from './buddha.js';
import { createFireflies, updateFireflies } from './fireflies.js';
import { createSeatingAndHologram } from './seat.js';

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

    // 🔴 1. สร้างพื้นลาน 1 แผ่น (ทำสีขอบให้มืดกลืนกับป่า ลดอาการกระพริบ)
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 1024; floorCanvas.height = 1024;
    const floorCtx = floorCanvas.getContext('2d');
    
    const floorGrad = floorCtx.createRadialGradient(512, 512, 200, 512, 512, 500);
    floorGrad.addColorStop(0, '#4a2e18');   // สีน้ำตาลตรงกลาง
    floorGrad.addColorStop(0.6, '#2e1c0e'); // สีน้ำตาลเข้ม
    floorGrad.addColorStop(1, '#050301');   // สีดำสนิทที่ขอบ
    
    floorCtx.fillStyle = floorGrad; floorCtx.fillRect(0, 0, 1024, 1024);
    floorCtx.fillStyle = 'rgba(0,0,0,0.15)';
    for(let i=0; i<15000; i++) { floorCtx.fillRect(Math.random()*1024, Math.random()*1024, 2, 2); }
    
    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.colorSpace = THREE.SRGBColorSpace;

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(60, 60), 
        new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2; 
    scene.add(floor);

    // 🔴 2. สร้าง "โดนัทหมอก" ลอยบังเฉพาะขอบพื้น (ปรับความสมูทและสมจริงขั้นสุด)
    window.groundFogMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false, 
        uniforms: {
            time: { value: 0 },
            isNight: { value: 0.0 } 
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform float isNight;
            varying vec2 vUv;
            
            float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            float noise(vec2 p) {
                vec2 i = floor(p), f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                           mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
            }
            float fbm(vec2 p) {
                float f = 0.0, amp = 0.5;
                for(int i=0; i<4; i++) { f += amp * noise(p); p *= 2.0; amp *= 0.5; }
                return f;
            }

            void main() {
                // ขยายสเกล uv เพื่อให้เนื้อหมอกดูละเอียดเป็นไอละอองมากขึ้น
                vec2 uv = vUv * 4.0;
                
                // ปรับความเร็วให้ไหลเอื่อยๆ ช้าลง ดูสงบและเป็นธรรมชาติ
                uv.x += time * 0.008; 
                uv.y += time * 0.005; 
                
                float n = fbm(uv);
                
                float dist = distance(vUv, vec2(0.5));
                
                // การไล่ระดับ (Smoothness):
                // วงใน: ค่อยๆ ซึมก่อตัวอย่างช้าๆ ตั้งแต่ระยะ 0.25 (ไกลตัวผู้ใช้) และเข้มสุดที่ 0.45
                float innerFade = smoothstep(0.25, 0.45, dist);
                // วงนอก: เฟดออกให้กลืนกับป่าที่ขอบสุด (0.50) แบบละมุนๆ
                float outerFade = smoothstep(0.50, 0.45, dist);
                
                float ringAlpha = innerFade * outerFade;
                
                // สีหมอก: 
                // กลางวัน: "เขียวอมเทาตุ่นๆ" กลืนกับต้นไม้และรากไม้ ไม่ขาวสว่างจนหลอกตา
                vec3 dayColor = vec3(0.40, 0.50, 0.40); 
                // กลางคืน: "น้ำเงินอมเทามืด" กลืนไปกับความเงียบสงัด
                vec3 nightColor = vec3(0.03, 0.08, 0.12); 
                vec3 finalColor = mix(dayColor, nightColor, isNight);
                
                // ลดความหนาสูงสุดลงเหลือ 0.65 ให้ดูเป็นไอหมอกบางๆ ไม่ทึบจนเกินไป
                gl_FragColor = vec4(finalColor, n * ringAlpha * 0.65); 
            }
        `
    });
    
    const groundFog = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), window.groundFogMat);
    groundFog.rotation.x = -Math.PI / 2;
    groundFog.position.y = 0.15; 
    scene.add(groundFog);

    function updateEnvironmentTime() {
        const currentHour = new Date().getHours();
        const isNight = currentHour >= 18 || currentHour < 6; 
        
        // สั่งเปลี่ยนสีหมอกตามเวลาจริง
        if (window.groundFogMat) {
            window.groundFogMat.uniforms.isNight.value = isNight ? 1.0 : 0.0;
        }
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
    let currentSeatStatus = "สถานะ: ทัชหน้าจอโฮโลแกรมเพื่อเลือกที่นั่ง";
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
        const nameSpan = document.getElementById('nav-user-name');
        if (nameSpan) nameSpan.innerText = currentUserName;
        
        const totalGlobal = globalUsersCount + localBotCount + window.exhibitionTotalBots;
        const totalRoom = roomUsersCount + localBotCount;
        
        console.log(`[Debug - HUD] อัปเดตยอดผู้ใช้งาน | บอทลานธรรม: ${localBotCount} | คนจริง: ${roomUsersCount} | รวมทั้งห้อง: ${totalRoom}`);

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
        if (!rotatingEl) {
            console.warn(`[Debug - HUD] ❌ หาแท็ก HTML id='rotating-global-stats' ไม่เจอ!`);
            return;
        }

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

    const activeBotsInScene = {};
    const botNamesList = ["กัลยาณมิตรใจดี", "ผู้แสวงบุญ", "คนรักสงบ", "ผู้ใฝ่ธรรม", "ศิษย์ตถาคต", "ผู้เบิกบาน", "ผู้เจริญในธรรม", "คนมีเมตตา"];

    function initFirebaseBots() {
        console.log(`[Debug - Firebase] ⏳ กำลังเช็คข้อมูลบอทในห้อง: ${myRoomId}`);
        const botsRef = ref(db, `rooms/${myRoomId}/bots`);
        get(botsRef).then((snapshot) => { 
            if (!snapshot.exists()) {
                console.log(`[Debug - Firebase] ⚠️ ไม่พบบอทในห้องนี้ กำลังสร้างบอทใหม่...`);
                generateInitialBotsToFirebase();
            } else {
                console.log(`[Debug - Firebase] ✅ พบบอทเดิมค้างอยู่ในห้อง จำนวน ${Object.keys(snapshot.val()).length} ตัว`);
            }
        }).catch(err => console.error(`[Debug - Firebase] ❌ Error การอ่านข้อมูล:`, err));

        onChildAdded(botsRef, (snapshot) => {
            const botId = snapshot.key; const data = snapshot.val();
            console.log(`[Debug - Firebase] 📥 โหลดข้อมูลบอทสำเร็จ:`, botId, data);
            renderBot(botId, data);
        });

        onChildRemoved(botsRef, (snapshot) => {
            const botId = snapshot.key;
            if (activeBotsInScene[botId]) {
                const data = snapshot.val(); const cushion = cushionsList[data.cushionIndex];
                if(cushion) {
                    cushion.userData.isOccupied = false;
                    cushion.material.color.setHex(0x3b2219); 
                    if (cushion.userData.holoBtn) cushion.userData.holoBtn.material.color.setHex(0x00ffcc);
                }
                seatingGroup.remove(activeBotsInScene[botId]);
                delete activeBotsInScene[botId]; localBotCount--; updateServerStatusUI();
                console.log(`[Debug - Scene] 🗑️ ลบบอท ${botId} ออกจากฉาก`);
            }
        });
    }

    function generateInitialBotsToFirebase() {
        const numBots = Math.floor(Math.random() * 4) + 3; 
        console.log(`[Debug - Firebase] 🎲 สุ่มจำนวนบอทได้: ${numBots} ตัว`);
        const availableIndices = [...Array(cushionsList.length).keys()];
        
        for (let i = 0; i < numBots; i++) {
            if (availableIndices.length === 0) break;
            const cushionIdx = availableIndices.splice(Math.floor(Math.random() * availableIndices.length), 1)[0];
            const botId = 'bot_' + i; 
            const name = botNamesList[Math.floor(Math.random() * botNamesList.length)];
            
            const colors = {
                skin: Math.random() > 0.5 ? 0xffe0bd : 0xf1c27d, 
                shirt: 0xffffff, 
                pants: 0xffffff, 
                gender: Math.random() > 0.5 ? 'M' : 'F'
            };
            
            set(ref(db, `rooms/${myRoomId}/bots/${botId}`), { name: name, colors: colors, cushionIndex: cushionIdx, state: 'SIT' })
                .then(() => console.log(`[Debug - Firebase] 💾 บันทึกบอท ${botId} ลง Firebase สำเร็จ`))
                .catch(err => console.error(`[Debug - Firebase] ❌ บันทึกบอท ${botId} ล้มเหลว:`, err));
        }
    }

    function renderBot(botId, data) {
        if(!activeBotsInScene[botId]) {
            console.log(`[Debug - Avatar] 🛠️ กำลังสร้าง 3D อวตารให้บอท: ${botId}`);
            try {
                const cushion = cushionsList[data.cushionIndex];
                if(cushion) {
                    cushion.userData.isOccupied = true; cushion.userData.occupantName = data.name;
                    cushion.material.color.setHex(0x2a1610);
                    if (cushion.userData.holoBtn) cushion.userData.holoBtn.material.color.setHex(0xff3333);
                    
                    const botAvatar = createMeditatorAvatar(data.name, data.colors);
                    botAvatar.position.set(cushion.position.x, 0.05, cushion.position.z);
                    seatingGroup.add(botAvatar); activeBotsInScene[botId] = botAvatar;
                    
                    localBotCount++; 
                    console.log(`[Debug - Avatar] ✅ สร้างอวตารสำเร็จ! จำนวนบอทในฉากตอนนี้ = ${localBotCount}`);
                    updateServerStatusUI();
                } else {
                    console.warn(`[Debug - Avatar] ❌ หาเบาะที่นั่ง index ${data.cushionIndex} ไม่เจอ`);
                }
                updateEngagingContext(myRoomId, Object.values(activeBotsInScene).map(b => b.userData.userName));
            } catch (err) {
                console.error(`[Debug - Avatar] ❌ Error ระหว่างสร้างอวตารให้บอท ${botId}:`, err);
            }
        }
    }

    // ==========================================
    // 🌟 ระบบบอทสุ่มกดแชทอิโมจิ (แสดงในโซนแชท)
    // ==========================================
    const botChatEmojis = ['🙏 สาธุ', '👍 ดีมากเลย', '💖 สุดยอดเลย'];
    setInterval(() => {
        if (!scene.visible) return;
        const botIds = Object.keys(activeBotsInScene);
        
        // โอกาสที่บอทจะแชทในแต่ละรอบ 6 วินาที (สุ่มเจอค่อยพิมพ์)
        if (botIds.length > 0 && Math.random() > 0.5) {
            const randomBotId = botIds[Math.floor(Math.random() * botIds.length)];
            const randomBot = activeBotsInScene[randomBotId];
            const botName = randomBot.userData.userName || "กัลยาณมิตร";
            const emoji = botChatEmojis[Math.floor(Math.random() * botChatEmojis.length)];
            
            const chatMaster = document.getElementById('chat-master-container');
            const floatingContainer = document.getElementById('floating-reactions-container');
            
            if (chatMaster && floatingContainer) {
                const msgDiv = document.createElement('div');
                const nameColor = '#ff9800'; 
                msgDiv.innerHTML = `<span>${emoji}</span><span style="color: ${nameColor}; font-weight: bold; margin-left: 8px; font-size: 13px;"> - ${botName} (ลานธรรม)</span>`;
                
                msgDiv.style.cssText = `
                    background: rgba(0, 0, 0, 0.7); color: #fff; padding: 6px 14px;
                    border-radius: 20px; border-left: 3px solid ${nameColor};
                    font-family: 'Sarabun', sans-serif; font-size: 14px;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(4px);
                    opacity: 0; transform: translateY(10px); transition: all 0.4s ease; align-self: flex-start;
                    display: flex; align-items: center;
                `;
                
                floatingContainer.appendChild(msgDiv);
                
                // แอนิเมชันให้ข้อความลอยขึ้นมา
                requestAnimationFrame(() => {
                    msgDiv.style.opacity = '1';
                    msgDiv.style.transform = 'translateY(0px)';
                    
                    // จำกัดข้อความไม่ให้ล้นจอ
                    if (floatingContainer.children.length > 6) {
                        floatingContainer.removeChild(floatingContainer.children[0]);
                    }
                });

                // ตั้งเวลาให้ข้อความหายไป
                setTimeout(() => {
                    if (msgDiv.parentNode) {
                        msgDiv.style.opacity = '0';
                        setTimeout(() => {
                            if (msgDiv.parentNode) msgDiv.remove();
                        }, 400);
                    }
                }, 30000);
            }
        }
    }, 6000); // 🔴 จุดนี้แหละครับที่รอบที่แล้วผมเผลอตัดออกไป โค้ดเลยแจ้ง error missing )

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
        
        onDisconnect(myRoomCountRef).set(increment(-1)); onDisconnect(globalCountRef).set(increment(-1));
        update(ref(db), { [`rooms/${myRoomId}/count`]: increment(1), [`global_users`]: increment(1) });
        
        onValue(globalCountRef, (snap) => { 
            let count = snap.val() || 1; if (count < 0) { count = 1; update(ref(db), { 'global_users': 1 }); }
            globalUsersCount = count; updateServerStatusUI(); 
        });
        
        onValue(myRoomCountRef, (snap) => { 
            let count = snap.val() || 1; if (count < 0) { count = 1; update(ref(db), { [`rooms/${myRoomId}/count`]: 1 }); }
            roomUsersCount = count; currentRoomNum = myRoomId.split('_')[1]; updateServerStatusUI(); 
        });
    }

    // --- Cushions & Hologram UI ---
    const { seatingGroup, hologramGroup, cushionsList, hologramButtons } = createSeatingAndHologram();
    scene.add(seatingGroup); scene.add(hologramGroup); joinRoom();

    // --- Altar Group ---
    const altarGroup = new THREE.Group(); 
    altarGroup.position.set(-6.5, 0, -5.5); 
    altarGroup.rotation.y = Math.PI / 6; 
    scene.add(altarGroup);
    
    const table = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.5, 1.8), new THREE.MeshStandardMaterial({ color: 0x4a2e18 })); 
    table.position.set(0, 1.25, 0); altarGroup.add(table);

    loadBuddhaWithEffects(altarGroup);

    // --- TV Group ---
    const tvGroup = new THREE.Group(); tvGroup.position.set(0, 2.9, -5.5); scene.add(tvGroup); 
    
    const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 })); 
    tvGroup.add(tvFrame);

    const standMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.3 });
    const speakerMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.5 });
    
    const soundbarGeo = new THREE.BoxGeometry(7.2, 0.3, 0.25);
    const soundbar = new THREE.Mesh(soundbarGeo, speakerMat);
    soundbar.position.set(0, -2.25, 0); tvGroup.add(soundbar);
    
    const wooferGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.05, 32); wooferGeo.rotateX(Math.PI / 2); 
    const wooferPositions = [-3.2, -2.8, -2.4, 2.4, 2.8, 3.2]; 
    wooferPositions.forEach(x => {
        const woofer = new THREE.Mesh(wooferGeo, coneMat); woofer.position.set(x, -2.25, 0.13); tvGroup.add(woofer);
    });

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.45, 16);
    const leftPole = new THREE.Mesh(poleGeo, standMat); leftPole.position.set(-1.5, -2.625, 0); tvGroup.add(leftPole);
    const rightPole = new THREE.Mesh(poleGeo, standMat); rightPole.position.set(1.5, -2.625, 0); tvGroup.add(rightPole);
    
    const baseGeo = new THREE.BoxGeometry(4.0, 0.05, 1.2);
    const standBase = new THREE.Mesh(baseGeo, standMat); standBase.position.set(0, -2.875, 0); tvGroup.add(standBase);
    
    const div = document.createElement('div'); div.style.width = '700px'; div.style.height = '400px'; div.style.backgroundColor = '#000';
    div.style.backfaceVisibility = 'hidden'; div.style.webkitBackfaceVisibility = 'hidden';

    const iframe = document.createElement('iframe'); 
    iframe.width = "700"; iframe.height = "400"; iframe.frameBorder = "0"; iframe.allowFullscreen = true; 
    iframe.allow = "autoplay; encrypted-media; fullscreen"; 
    iframe.style.borderRadius = "4px"; iframe.style.backfaceVisibility = 'hidden'; iframe.style.webkitBackfaceVisibility = 'hidden';
    div.appendChild(iframe);
    
    const cssObject = new CSS3DObject(div); cssObject.position.set(0, 0, 0.12); cssObject.scale.set(0.01, 0.01, 0.01); tvGroup.add(cssObject);

    // ภาพนิ่งหน้าปก Standby
    const capyouTex = textureLoader.load('textures/capyou.png'); capyouTex.colorSpace = THREE.SRGBColorSpace;
    const capyouMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.9), new THREE.MeshBasicMaterial({ map: capyouTex }));
    capyouMesh.position.set(0, 0, 0.12); tvGroup.add(capyouMesh);

    // ==========================================
    // 🎨 ฟังก์ชันวาดกระดานประชาสัมพันธ์ (สัดส่วน 16:9 ขนาด 1280x720)
    // ==========================================
    function drawPRPage(ctx, pageIndex, alpha) {
        ctx.globalAlpha = 1.0;
        const grad = ctx.createLinearGradient(0, 0, 0, 720);
        grad.addColorStop(0, '#1a0b00'); grad.addColorStop(0.5, '#3b1c00'); grad.addColorStop(1, '#1a0b00');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 1280, 720);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        for (let i = 0; i < 1280; i += 12) { if (Math.random() > 0.2) ctx.fillRect(i, 0, Math.random() * 4 + 1, 720); }

        ctx.globalAlpha = alpha;
        if (pageIndex === 0) { // หน้าตารางเวลา
            ctx.fillStyle = '#ffd700'; ctx.font = 'bold 55px Sarabun, sans-serif'; ctx.textAlign = 'center'; 
            ctx.fillText(appConfig.prBoard.title || 'กระดานประชาสัมพันธ์', 640, 90);
            ctx.beginPath(); ctx.moveTo(200, 120); ctx.lineTo(1080, 120); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.stroke();
            
            ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 42px Sarabun, sans-serif'; 
            ctx.fillText(appConfig.prBoard.scheduleTitle || 'ตารางเวลา', 640, 200);
            ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = '36px Sarabun, sans-serif';
            (appConfig.prBoard.scheduleLines || []).forEach((line, index) => { 
                ctx.fillText(line, 350, 280 + (index * 60)); 
            });
        } else if (pageIndex === 1) { // หน้าข่าวบอกบุญ
            ctx.fillStyle = '#ffd700'; ctx.font = 'bold 55px Sarabun, sans-serif'; ctx.textAlign = 'center'; 
            ctx.fillText('🙏 ร่วมสร้างวิหารธรรมออนไลน์', 640, 90);
            ctx.beginPath(); ctx.moveTo(200, 120); ctx.lineTo(1080, 120); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.stroke();
            
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 38px Sarabun, sans-serif'; 
            ctx.fillText('"ทุกการภาวนาที่เกิดขึ้น ณ พื้นที่แห่งนี้ ท่านคือผู้มีส่วนร่วมในมหากุศล"', 640, 200);
            
            ctx.fillStyle = '#cccccc'; ctx.font = '32px Sarabun, sans-serif'; 
            ctx.fillText('หากผลงานนี้มีประโยชน์กับคุณ หรือมีไอเดียอยากเสนอแนะเพิ่มเติม', 640, 280);
            ctx.fillText('สามารถทักมาพูดคุย เลี้ยงกาแฟ หรือร่วมสนับสนุนโปรเจกต์ได้เลยครับ ยินดีรับฟังทุกความคิดเห็น!', 640, 340);
            
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(340, 420, 600, 220, 20); ctx.fill(); ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 4; ctx.stroke(); } 
            else { ctx.fillRect(340, 420, 600, 220); }
            
            ctx.fillStyle = '#aaaaaa'; ctx.font = 'bold 36px Sarabun, sans-serif'; ctx.fillText('LINE ID / เบอร์โทร:', 640, 490);
            ctx.fillStyle = '#4CAF50'; ctx.font = 'bold 64px Sarabun, sans-serif'; ctx.fillText('0926533228', 640, 580);
        } else { // หน้าคู่มือ VR
            ctx.fillStyle = '#e94560'; ctx.font = 'bold 55px Sarabun, sans-serif'; ctx.textAlign = 'center'; 
            ctx.fillText('👓 แนะนำการรับชมด้วยแว่น VR', 640, 90);
            ctx.beginPath(); ctx.moveTo(200, 120); ctx.lineTo(1080, 120); ctx.strokeStyle = '#e94560'; ctx.lineWidth = 3; ctx.stroke();
            
            ctx.fillStyle = '#ffffff'; ctx.font = '36px Sarabun, sans-serif'; 
            ctx.fillText('นิทรรศการนี้ถูกออกแบบมาเพื่อรองรับการรับชมแบบ 360 องศาเต็มรูปแบบ ในโลกเสมือนจริง', 640, 200);
            
            ctx.textAlign = 'left';
            ctx.fillStyle = '#00ffcc'; ctx.font = 'bold 38px Sarabun, sans-serif'; ctx.fillText('อุปกรณ์ที่รองรับ:', 200, 320);
            ctx.fillStyle = '#cccccc'; ctx.font = '32px Sarabun, sans-serif'; 
            ctx.fillText('• Meta Quest 2, 3, Pro', 200, 380); 
            ctx.fillText('• Pico 4 / Apple Vision Pro', 200, 440); 
            ctx.fillText('• แว่น PC VR อื่นๆ ผ่านเบราว์เซอร์', 200, 500);
            
            ctx.fillStyle = '#ff9800'; ctx.font = 'bold 38px Sarabun, sans-serif'; ctx.fillText('วิธีเข้าใช้งาน:', 720, 320);
            ctx.fillStyle = '#ffffff'; ctx.font = '32px Sarabun, sans-serif'; 
            ctx.fillText('1. เปิดแอปเบราว์เซอร์ (Browser) ภายในแว่น VR', 720, 380); 
            ctx.fillText('2. พิมพ์ URL เพื่อเข้าสู่เว็บไซต์นี้', 720, 440);
            ctx.fillText('3. คลิกที่ปุ่ม "ENTER VR" บริเวณขอบจอด้านล่าง', 720, 500); 
            ctx.fillText('4. สัมผัสประสบการณ์โลกเสมือนจริงได้ทันที', 720, 560);
        }
    }

    // --- กระดานไม้ PR Board (ด้านขวา) ---
    const prGroup = new THREE.Group(); 
    prGroup.position.set(6.5, 2.5, -5.5); 
    prGroup.rotation.y = -Math.PI / 6; 
    scene.add(prGroup);
    
    const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x4a2b18, roughness: 1.0 });
    const prFrame = new THREE.Mesh(new THREE.BoxGeometry(5.0, 3.0, 0.1), woodMaterial); 
    prGroup.add(prFrame);
    
    const legGeo = new THREE.BoxGeometry(0.15, 1.6, 0.15);
    const leftLeg = new THREE.Mesh(legGeo, woodMaterial); leftLeg.position.set(-2.0, -1.7, -0.05); prGroup.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, woodMaterial); rightLeg.position.set(2.0, -1.7, -0.05); prGroup.add(rightLeg);

    const footGeo = new THREE.BoxGeometry(0.25, 0.1, 1.2);
    const leftFoot = new THREE.Mesh(footGeo, woodMaterial); leftFoot.position.set(-2.0, -2.45, -0.05); prGroup.add(leftFoot);
    const rightFoot = new THREE.Mesh(footGeo, woodMaterial); rightFoot.position.set(2.0, -2.45, -0.05); prGroup.add(rightFoot);
    
    const prCanvasPhysical = document.createElement('canvas'); prCanvasPhysical.width = 1280; prCanvasPhysical.height = 720; 
    const prCtxPhysical = prCanvasPhysical.getContext('2d');
    const prTexPhysical = new THREE.CanvasTexture(prCanvasPhysical); prTexPhysical.colorSpace = THREE.SRGBColorSpace;
    const prPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.8), new THREE.MeshBasicMaterial({ map: prTexPhysical, fog: false })); 
    prPlane.position.set(0, 0, 0.06); prGroup.add(prPlane);

    let prPagePhysical = 0; let prOpacityPhysical = 1.0; 
    drawPRPage(prCtxPhysical, prPagePhysical, prOpacityPhysical); prTexPhysical.needsUpdate = true;

    setInterval(() => {
        if (!scene.visible) return;
        let fadeOutTimer = setInterval(() => {
            prOpacityPhysical -= 0.1; 
            if (prOpacityPhysical <= 0) {
                prOpacityPhysical = 0; clearInterval(fadeOutTimer); 
                prPagePhysical = (prPagePhysical + 1) % 3; 
                drawPRPage(prCtxPhysical, prPagePhysical, prOpacityPhysical); prTexPhysical.needsUpdate = true;
                
                let fadeInTimer = setInterval(() => {
                    prOpacityPhysical += 0.1; 
                    if (prOpacityPhysical >= 1.0) { prOpacityPhysical = 1.0; clearInterval(fadeInTimer); }
                    drawPRPage(prCtxPhysical, prPagePhysical, prOpacityPhysical); prTexPhysical.needsUpdate = true;
                }, 35); 
            } else {
                drawPRPage(prCtxPhysical, prPagePhysical, prOpacityPhysical); prTexPhysical.needsUpdate = true;
            }
        }, 35); 
    }, 10000); 

    // --- จอ PR สำหรับฉายบนทีวี ---
    const prCanvasTV = document.createElement('canvas'); prCanvasTV.width = 1280; prCanvasTV.height = 720;
    const prCtxTV = prCanvasTV.getContext('2d');
    const prTexTV = new THREE.CanvasTexture(prCanvasTV); prTexTV.colorSpace = THREE.SRGBColorSpace;
    const prTvMesh = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 3.9), new THREE.MeshBasicMaterial({ map: prTexTV, fog: false }));
    prTvMesh.position.set(0, 0, 0.13); // ซ้อนทับจอทีวี
    prTvMesh.visible = false;
    tvGroup.add(prTvMesh);

    let currentTVPRPage = 0;
    function drawTVPRBoard() {
        drawPRPage(prCtxTV, currentTVPRPage, 1.0);
        prTexTV.needsUpdate = true;
    }

    // ==========================================
    // 🎛️ ระบบสร้างปุ่ม 3D และจัดกลุ่ม
    // ==========================================
    function create3DButton(text, bgColor, textColor, w, h, fontSize = 42) {
        const cvs = document.createElement('canvas'); cvs.width = 512; cvs.height = 128; const cx = cvs.getContext('2d');
        cx.fillStyle = bgColor;
        if(cx.roundRect) { cx.beginPath(); cx.roundRect(10, 10, 492, 108, 54); cx.fill(); } else { cx.fillRect(10, 10, 492, 108); }
        cx.strokeStyle = '#ffffff'; cx.lineWidth = 6; cx.stroke();
        cx.fillStyle = textColor; cx.font = `bold ${fontSize}px Sarabun, sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText(text, 256, 64);
        const tex = new THREE.CanvasTexture(cvs); tex.colorSpace = THREE.SRGBColorSpace;
        return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    }

    const btnGroup = new THREE.Group(); scene.add(btnGroup);
    
    const btnAltar = create3DButton('🙏 ขอขมาพระรัตนตรัย', '#B71C1C', '#ffffff', 2.8, 0.7, 45);
    btnAltar.position.set(-5.5, 0.5, -4.5); btnAltar.rotation.y = Math.PI / 6;
    btnAltar.userData = { isAltarBtn: true }; btnGroup.add(btnAltar);
    
    const btnPR = create3DButton('📢 อ่านประชาสัมพันธ์', '#0D47A1', '#ffffff', 2.8, 0.7, 45);
    btnPR.position.set(5.5, 0.5, -4.5); btnPR.rotation.y = -Math.PI / 6;
    btnPR.userData = { isPRBtn: true }; btnGroup.add(btnPR);

    // 🐉 สร้างอาเรย์เก็บแก๊งรปภ. พญานาคน้อย
    const nakeeGuards = [];

    // ตัวที่ 1: เฝ้าบอร์ดประชาสัมพันธ์ (น้องพิ๊งกี้ - โทนสีชมพู)
    const guardPR = createNakee("น้องพิ๊งกี้");
    // ขยับออกด้านข้างและถอยหลังเพื่อหลบปุ่มและบอร์ด
    guardPR.position.set(9.8, 0, -3.5); 
    guardPR.rotation.y = -Math.PI / 4;  
    
    // เปลี่ยนเป็นสีพิ๊งกี้ พร้อมเรืองแสงสู้ความมืด (Emissive)
    const pinkyBody = defaultBodyMat.clone(); 
    pinkyBody.color.setHex(0xff99a8);
    pinkyBody.emissive.setHex(0xff99a8); // 🔴 เรืองแสงสีชมพู
    pinkyBody.emissiveIntensity = 0.4;   // 🔴 ปรับระดับความสว่างในที่มืด

    const pinkyBelly = defaultBellyMat.clone(); 
    pinkyBelly.color.setHex(0xffe6e6);
    pinkyBelly.emissive.setHex(0xffe6e6);
    pinkyBelly.emissiveIntensity = 0.4;

    guardPR.traverse(child => {
        if (child.isMesh) {
            if (child.material === defaultBodyMat) child.material = pinkyBody;
            if (child.material === defaultBellyMat) child.material = pinkyBelly;
        }
    });
    scene.add(guardPR);
    nakeeGuards.push(guardPR);

    // ตัวที่ 2: เฝ้าโต๊ะหมู่บูชา (น้องสกาย - โทนสีฟ้า)
    const guardAltar = createNakee("น้องสกาย");
    // ขยับออกด้านซ้ายและถอยหลังเพื่อหลบโต๊ะพระและปุ่ม
    guardAltar.position.set(-9.8, 0, -3.5); 
    guardAltar.rotation.y = Math.PI / 4;
    
    // เปลี่ยนเป็นสีสกาย (ฟ้า) พร้อมเรืองแสงสู้ความมืด
    const skyBody = defaultBodyMat.clone(); 
    skyBody.color.setHex(0x87cefa);
    skyBody.emissive.setHex(0x87cefa); // 🔴 เรืองแสงสีฟ้า
    skyBody.emissiveIntensity = 0.4;

    const skyBelly = defaultBellyMat.clone(); 
    skyBelly.color.setHex(0xf0f8ff);
    skyBelly.emissive.setHex(0xf0f8ff);
    skyBelly.emissiveIntensity = 0.4;

    guardAltar.traverse(child => {
        if (child.isMesh) {
            if (child.material === defaultBodyMat) child.material = skyBody;
            if (child.material === defaultBellyMat) child.material = skyBelly;
        }
    });
    scene.add(guardAltar);
    nakeeGuards.push(guardAltar);

    const tvControlGroup = new THREE.Group();
    tvControlGroup.position.set(0, -2.4, 0.15); 
    tvControlGroup.visible = false; 
    tvGroup.add(tvControlGroup);
    
    const btnReturn = create3DButton('🎧 ฟังธรรม', '#2E7D32', '#ffffff', 1.8, 0.45, 48);
    btnReturn.userData = { isReturnBtn: true }; tvControlGroup.add(btnReturn);
    
    const btnPage1 = create3DButton('📅 ตารางเวลา', '#E65100', '#ffffff', 1.6, 0.4, 40);
    btnPage1.userData = { isPageBtn: true, pageIndex: 0 }; tvControlGroup.add(btnPage1);
    
    const btnPage2 = create3DButton('👓 คู่มือ VR', '#4A148C', '#ffffff', 1.6, 0.4, 40);
    btnPage2.userData = { isPageBtn: true, pageIndex: 2 }; tvControlGroup.add(btnPage2);
    
    const btnPage3 = create3DButton('📢 ข่าวบอกบุญ', '#006064', '#ffffff', 1.6, 0.4, 40);
    btnPage3.userData = { isPageBtn: true, pageIndex: 1 }; tvControlGroup.add(btnPage3);

    const interactables = [...cushionsList, ...hologramButtons, btnAltar, btnPR, btnReturn, btnPage1, btnPage2, btnPage3];

    // ==========================================
    // ตรรกะจัดการวิดีโอและหน้าจอทีวี
    // ==========================================
    function updateVideoAndSchedule() {
        if (currentOverrideMode === 'PR') {
            iframe.src = ""; // หยุดวิดีโอ
            currentScheduleStatus = "โหมด: อ่านกระดานประชาสัมพันธ์";
            return;
        }

        if (currentOverrideMode === 'PRAY') {
            const targetVideoUrl = `https://www.youtube.com/embed/O9RwxXP1Dwg?autoplay=1`; 
            const newScheduleStatus = "โหมด: ขอขมาและบูชาพระรัตนตรัย";
            if (currentScheduleStatus !== newScheduleStatus || !iframe.src.includes('O9RwxXP1Dwg')) {
                currentScheduleStatus = newScheduleStatus; iframe.src = targetVideoUrl;
            }
            return; 
        }

        const now = new Date(); 
        const curSeconds = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds(); 
        const curMins = now.getHours() * 60 + now.getMinutes();
        
        let targetVideoUrl = ""; let newScheduleStatus = ""; let offset = 0;
        for (let prog of appConfig.youtube.schedule) {
            if (curMins >= prog.start && curMins < prog.end) {
                let startSeconds = prog.start * 60;
                if (prog.realStart !== undefined) startSeconds = prog.realStart * 60;
                offset = (curSeconds >= startSeconds) ? curSeconds - startSeconds : (curSeconds + 86400) - startSeconds;
                targetVideoUrl = `https://www.youtube.com/embed/${prog.id}?autoplay=1&start=${offset}`; 
                
                const sHr = String(Math.floor(prog.start / 60)).padStart(2, '0'); const sMin = String(prog.start % 60).padStart(2, '0');
                let eMins = prog.end === 1440 ? 0 : prog.end; 
                if (prog.realStart !== undefined && prog.start === 0) {
                    newScheduleStatus = `โหมด: ${prog.name} (19:00 - 04:00)`; 
                } else {
                    const eHr = String(Math.floor(eMins / 60)).padStart(2, '0'); const eMin = String(eMins % 60).padStart(2, '0');
                    newScheduleStatus = `โหมด: ${prog.name} (${sHr}:${sMin} - ${eHr}:${eMin})`;
                }
                break;
            }
        }
        if (!targetVideoUrl) { targetVideoUrl = `https://www.youtube.com/embed/6B6LeMlaTu0?autoplay=1`; newScheduleStatus = "โหมด: สแตนด์บาย"; }
        if (currentScheduleStatus !== newScheduleStatus || !iframe.src.includes('youtube')) {
            currentScheduleStatus = newScheduleStatus; iframe.src = targetVideoUrl;
        }
    }
    updateVideoAndSchedule();
    setInterval(() => { if (scene.visible && currentOverrideMode !== 'PR') updateVideoAndSchedule(); }, 10000);

    let isSeated = false, isReading = false, isTransitioning = false, mySelectedCushion = null;
    const targetCamPos = new THREE.Vector3(), targetLookAt = new THREE.Vector3();
    const raycaster = new THREE.Raycaster(); const mouse = new THREE.Vector2();

    function goBackToStandby() {
        // 🔴 เพิ่ม 2 บรรทัดนี้ เพื่อรีเซ็ตหน้าจอโฮโลแกรมให้เด้งเปิดตัวใหม่
        hologramGroup.userData.spawnTime = Date.now(); 
        hologramButtons.forEach(btn => btn.userData.isClicked = false); 
        
        if (mySelectedCushion) {
            mySelectedCushion.userData.isMine = false; mySelectedCushion.userData.isOccupied = false;
            mySelectedCushion.material.color.setHex(0x3b2219); 
            if (mySelectedCushion.userData.holoBtn) mySelectedCushion.userData.holoBtn.material.color.setHex(0x00ffcc);
            mySelectedCushion = null;
        }
        document.getElementById('stand-btn').style.display = 'none';
        document.getElementById('warp-btn').style.display = 'block';
        toggleReactionUI(true);

        isSeated = false; isReading = false; isTransitioning = true; controls.enabled = false;
        targetCamPos.copy(defaultCameraPos); targetLookAt.copy(defaultTargetPos);
        currentSeatStatus = "สถานะ: ทัชหน้าจอโฮโลแกรมเพื่อเลือกที่นั่ง";

        currentOverrideMode = null; updateVideoAndSchedule(); togglePrayLight(false);
        btnAltar.visible = true; btnPR.visible = true; tvControlGroup.visible = false;
        window.lockedAvatar = null; hologramGroup.visible = true;
    }

    // ==========================================
    // 🖱️ ระบบคลิก (Raycaster)
    // ==========================================
    window.addEventListener('click', (event) => {
        if (event.target.tagName !== 'CANVAS' || !scene.visible || isTransitioning) return;

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1; mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(interactables);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            
            if (obj.userData.isAltarBtn) {
                currentOverrideMode = 'PRAY'; updateVideoAndSchedule(); togglePrayLight(true);
                btnAltar.visible = false; btnPR.visible = false;
                tvControlGroup.visible = true; btnPage1.visible = false; btnPage2.visible = false; btnPage3.visible = false;
                btnReturn.position.set(0, 0, 0); 
            } 
            else if (obj.userData.isPRBtn) {
                currentOverrideMode = 'PR'; currentTVPRPage = 0; drawTVPRBoard(); updateVideoAndSchedule(); togglePrayLight(false);
                btnAltar.visible = false; btnPR.visible = false;
                tvControlGroup.visible = true; btnPage1.visible = true; btnPage2.visible = true; btnPage3.visible = true;
                btnPage1.position.set(-2.0, 0, 0); btnPage2.position.set(-0.5, 0, 0); btnPage3.position.set(1.0, 0, 0);
                btnReturn.position.set(2.7, 0, 0); 
            }
            else if (obj.userData.isReturnBtn) {
                currentOverrideMode = null; updateVideoAndSchedule(); togglePrayLight(false);
                btnAltar.visible = true; btnPR.visible = true; tvControlGroup.visible = false;
            }
            else if (obj.userData.isPageBtn) {
                currentTVPRPage = obj.userData.pageIndex; drawTVPRBoard();
            }
            else if (obj.userData.isHologramBtn) {
                if (isSeated || isReading) return; 
                const targetCush = obj.userData.targetCushion;
                if (targetCush.userData.isOccupied) return; 
                
                targetCush.userData.isOccupied = true; targetCush.userData.isMine = true;
                targetCush.material.color.setHex(0x00ffcc); obj.material.color.setHex(0xffeb3b);
                
                // 🔴 เพิ่ม 2 บรรทัดนี้สำหรับแอนิเมชันปุ่มกระเพื่อมตอนทัช
                obj.userData.isClicked = true;
                obj.userData.clickTime = Date.now();
                
                mySelectedCushion = targetCush;
                
                const pos = new THREE.Vector3(); targetCush.getWorldPosition(pos);
                targetCamPos.set(pos.x, 1.0, pos.z);
                const dir = new THREE.Vector3(0, 2.9, -5.5).sub(targetCamPos).normalize();
                targetLookAt.copy(targetCamPos).add(dir.multiplyScalar(0.01));
                
                isSeated = true; isTransitioning = true; controls.enabled = false;
                document.getElementById('stand-btn').style.display = 'block'; document.getElementById('warp-btn').style.display = 'none';
                currentSeatStatus = `สถานะ: นั่งสมาธิ แถว ${targetCush.userData.row}, ตัวที่ ${targetCush.userData.col}`;
                window.lockedAvatar = { x: pos.x, y: 0, z: pos.z, state: 'SIT' };
                hologramGroup.visible = false;
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
    }, 1000);

    function onEnterScene() {
        div.style.display = 'block'; cssObject.visible = true; 
        window.currentActiveMainZone = 'meditation'; window.currentActiveSubZone = '';
        updateServerStatusUI(); updateVideoAndSchedule(); 
        
        if (isSeated || isReading) {
            document.getElementById('stand-btn').style.display = 'block'; document.getElementById('warp-btn').style.display = 'none';
        } else {
            document.getElementById('warp-btn').style.display = 'block';
        }
    }
    
    function onExitScene() {
        div.style.display = 'none'; cssObject.visible = false; 
        document.getElementById('stand-btn').style.display = 'none'; document.getElementById('warp-btn').style.display = 'none';
        iframe.src = ""; 
    }

    function update() {

        const time = performance.now() * 0.001;
        const now = Date.now();

        // 🔴 สั่งให้น้องๆ พญานาคอัปเดตการขยับและกระพริบตา
        nakeeGuards.forEach(naga => {
            if (naga.update) naga.update(time, now);
        });

        // 🔴 สั่งให้ควันเคลื่อนที่เอื่อยๆ ตลอดเวลา
        if (window.groundFogMat) {
            window.groundFogMat.uniforms.time.value += 0.015;
        }
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
            if (!isSeated && !isReading) {
                camera.position.set(0, 1.5, 6.0); controls.target.set(0, 1.5, 4.0); 
                controls.enableRotate = false; controls.enableZoom = false; controls.enablePan = false;    
            } else {
                controls.enableRotate = true;
            }
            const minLookUp = (Math.PI / 2) - 0.5; const maxLookDown = (Math.PI / 2) + 0.3; 
            if (controls.getPolarAngle() < minLookUp) controls.minPolarAngle = minLookUp;
            else if (controls.getPolarAngle() > maxLookDown) controls.maxPolarAngle = maxLookDown;
            else { controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI; }
        }

        if (scene.visible) {
            updateBuddhaEffects(); updateFireflies();
            Object.values(activeBotsInScene).forEach(bot => { if (bot.update) bot.update(); });
            
            // 🔴 แทรกโค้ดสั่งให้แอนิเมชันโฮโลแกรมทำงานตลอดเวลา
            if (hologramGroup && hologramGroup.visible && hologramGroup.update) {
                hologramGroup.update();
            }
        }

        if (scene.visible) {
            const tvWorldPos = new THREE.Vector3(); tvGroup.getWorldPosition(tvWorldPos);
            const tvNormal = new THREE.Vector3(0, 0, 1); tvNormal.applyQuaternion(tvGroup.quaternion);
            const viewDir = new THREE.Vector3().subVectors(camera.position, tvWorldPos).normalize();

            if (tvNormal.dot(viewDir) < 0) {
                cssObject.visible = false; capyouMesh.visible = false; prTvMesh.visible = false;
            } else {
                if (!isSeated) { // ยังไม่เลือกที่นั่ง โชว์หน้าปก
                    cssObject.visible = false; capyouMesh.visible = true; prTvMesh.visible = false;
                } else {
                    if (currentOverrideMode === 'PR') { // โหมดประชาสัมพันธ์ (ซ่อน YouTube โชว์บอร์ด)
                        cssObject.visible = false; capyouMesh.visible = false; prTvMesh.visible = true;
                    } else { // โหมดปกติ หรือ ขอขมา (โชว์ YouTube)
                        cssObject.visible = true; capyouMesh.visible = false; prTvMesh.visible = false;
                    }
                }
            }
        }
    }

    return { scene, camera, controls, update, onEnterScene, onExitScene };
}