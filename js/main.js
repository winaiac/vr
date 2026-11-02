import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

import { setupMeditationScene } from './meditation-scene.js';
// แก้ไขบรรทัด import { setupMeditationScene } ให้มีโค้ดนี้ต่อท้าย
import { createMeditatorAvatar, switchAvatarPosture, switchAvatarToOrb } from './avatar.js';
import { ref, set, onChildAdded, onChildChanged, onChildRemoved } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

import { setupRealmScene } from './realm-scene.js';
import { initEngagingSystem } from './engaging.js';

// 1. User & Firebase Setup
import { initIDPS, changeUserName } from './idps.js'; 

const { userId, userName, channelTag } = initIDPS("กัลยาณมิตร");
let currentUserName = userName;

const userProfileBtn = document.getElementById('user-profile');
userProfileBtn.innerText = `ผู้ใช้งาน: ${currentUserName}`;

// 2. --- เพิ่มตัวแปรสำหรับจัดการผู้เล่นอื่น (ใต้การกำหนด userId) ---
const otherPlayers = {}; 
// ค่าเริ่มต้นของสถานะอวตารเรา
let myAvatarState = 'SIT'; 
let myIsOrbMode = false;
let myOrbColor = 0x00e5ff;

// ==========================================
// ควบคุมปุ่มคลิกเปลี่ยนชื่อผู้ใช้
// ==========================================
const nameModal = document.getElementById('name-change-modal');
const newNameInput = document.getElementById('new-name-input');
const confirmNameBtn = document.getElementById('confirm-name-btn');
const cancelNameBtn = document.getElementById('cancel-name-btn');
const nameModalMsg = document.getElementById('name-modal-msg'); 

// 1. ทำให้คลิกที่ชื่อตรงมุมซ้ายบนแล้วกล่องแก้ไขเด้งขึ้นมา
// 1. ทำให้คลิกที่ชื่อตรงมุมซ้ายบนแล้วกล่องแก้ไขเด้งขึ้นมา (เพิ่มเงื่อนไขเช็คสิทธิ์รายวัน)
userProfileBtn.addEventListener('click', () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const lastChangeDate = localStorage.getItem('app_last_name_change_date');

    // ตรวจสอบว่าวันนี้ใช้สิทธิ์เปลี่ยนชื่อไปหรือยัง
    if (lastChangeDate === todayStr) {
        // หากใช้สิทธิ์แล้ว ให้เปลี่ยนข้อความเตือนสีแดงที่ปุ่มชั่วคราว 3 วินาที
        const originalText = userProfileBtn.innerText;
        userProfileBtn.innerText = "⏳ วันนี้เปลี่ยนชื่อไปแล้ว รอพรุ่งนี้นะครับ";
        userProfileBtn.style.color = "#ff5252"; // สีแดงแจ้งเตือน
        
        setTimeout(() => {
            userProfileBtn.innerText = originalText;
            userProfileBtn.style.color = "#ff9800"; // กลับเป็นสีส้มปกติ
        }, 3000);
        
        return; // หยุดการทำงานคำสั่งด้านล่าง (ไม่เปิดกล่องแก้ไข)
    }

    // หากยังไม่ใช้สิทธิ์ ให้เปิดกล่องตามปกติ
    newNameInput.value = currentUserName.replace(channelTag, ''); 
    nameModalMsg.style.display = 'none'; 
    nameModal.style.display = 'flex';
    newNameInput.focus();
});

// 2. เมื่อกดยกเลิกในกล่อง ให้ปิดหน้าต่าง
cancelNameBtn.addEventListener('click', () => {
    nameModal.style.display = 'none';
});

// 3. เมื่อกดบันทึกชื่อในกล่อง
confirmNameBtn.addEventListener('click', () => {
    const newName = newNameInput.value.trim();
    if (!newName) {
        nameModalMsg.innerText = "⚠️ กรุณากรอกชื่อก่อนกดบันทึกครับ";
        nameModalMsg.style.color = "#ff5252";
        nameModalMsg.style.display = "block";
        return;
    }

    const result = changeUserName(newName, channelTag);
    
    if (result.success) {
        currentUserName = result.newName;
        userProfileBtn.innerText = `👤 ผู้ใช้งาน: ${currentUserName}`;
        
        nameModalMsg.innerText = result.message; 
        nameModalMsg.style.color = "#00ffcc";
        nameModalMsg.style.display = "block";
        
        setTimeout(() => {
            nameModal.style.display = 'none';
        }, 1500);
        
    } else {
        nameModalMsg.innerText = result.message; 
        nameModalMsg.style.color = "#ff5252";
        nameModalMsg.style.display = "block";
    }
});
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyDu_F3ydhj9Pn3-WexZZoIoLntTM7dFqQs",
    authDomain: "meditation-pavilion.firebaseapp.com",
    databaseURL: "https://meditation-pavilion-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "meditation-pavilion",
    storageBucket: "meditation-pavilion.firebasestorage.app",
    messagingSenderId: "564385718895",
    appId: "1:564385718895:web:43c63082b6150c6ac4e39a"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 2. Renderer Setup
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// --- ระบบจัดการปุ่ม VR ---
const vrButtonEl = VRButton.createButton(renderer);
vrButtonEl.id = 'VRButton'; 
document.body.appendChild(vrButtonEl);

const checkVR = setInterval(() => {
    const text = vrButtonEl.textContent.toUpperCase();
    if (text.includes('NOT SUPPORTED') || text.includes('NOT AVAILABLE')) {
        vrButtonEl.style.display = 'none'; 
        const vrGuideBtn = document.getElementById('vr-guide-btn');
        if (vrGuideBtn) vrGuideBtn.style.display = 'block'; 
        clearInterval(checkVR); 
    } 
    else if (text.includes('ENTER VR')) {
        clearInterval(checkVR); 
    }
}, 300); 

const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('css-container').appendChild(cssRenderer.domElement);

// เปิดใช้งาน UI และเชื่อมต่อ Firebase ให้ระบบอิโมจิ
initEngagingSystem(db, currentUserName);

// 3. Create Scenes
const meditationModule = setupMeditationScene(renderer, cssRenderer, db, currentUserName);
const realmModule = setupRealmScene(renderer, cssRenderer, currentUserName);

let activeModule = meditationModule;
meditationModule.scene.visible = true;
realmModule.scene.visible = false;
if (meditationModule.onEnterScene) meditationModule.onEnterScene(); 

// 3.1 ฟังก์ชันส่งตำแหน่งของเราขึ้น Firebase
function updateMyPositionToFirebase() {
    if (!activeModule || !activeModule.camera) return;

    let syncY = activeModule.camera.position.y;
    let syncX = activeModule.camera.position.x;
    let syncZ = activeModule.camera.position.z;

    // กฎแรงโน้มถ่วง: ถ้าอยู่ในท่านั่ง ให้ล็อคความสูง Y ติดพื้นเสมอ
    if (myAvatarState === 'SIT' && !myIsOrbMode) {
        syncY = 0; 
    }

    // กฎกระจายตัวหน้าแท่นขอขมา (สมมติพิกัดแท่นขอขมาคือ Z < -5)
    if (myAvatarState === 'SIT' && syncZ < -5 && !myIsOrbMode) {
        // ใช้ userId มาช่วยคำนวณตำแหน่งคงที่ เพื่อให้ยืนกระจายจุดเดิมเสมอ
        const hash = parseInt(userId.replace(/\D/g, '').substring(0,4)) || Math.random() * 1000;
        syncX += (hash % 10) * 0.3 - 1.5; 
        syncZ += ((hash * 2) % 10) * 0.2; 
    }

    const myData = {
        name: currentUserName,
        x: syncX,
        y: syncY,
        z: syncZ,
        state: myAvatarState,
        isOrb: myIsOrbMode,
        color: myOrbColor,
        lastActive: Date.now()
    };

    set(ref(db, `players/${userId}`), myData);
}

// 3.2 ฟังก์ชันรับข้อมูลผู้เล่นอื่น
function initPlayerSync() {
    const playersRef = ref(db, 'players');

    // เมื่อมีผู้เล่นเข้ามาใหม่ หรืออัปเดตข้อมูล
    const updatePlayer = (snapshot) => {
        const uid = snapshot.key;
        if (uid === userId) return; // ไม่ต้องวาดตัวเอง

        const data = snapshot.val();
        
        // กรองคนออฟไลน์ (ไม่อัปเดตเกิน 3 นาที)
        if (Date.now() - data.lastActive > 180000) {
            removePlayer(uid);
            return;
        }

        if (!otherPlayers[uid]) {
            const newAvatar = createMeditatorAvatar(data.name);
            activeModule.scene.add(newAvatar); // เพิ่มลงในซีนปัจจุบัน
            otherPlayers[uid] = newAvatar;
        }

        const avatar = otherPlayers[uid];
        avatar.position.set(data.x, data.y, data.z);
        avatar.lookAt(0, data.y, 0); // หันเข้าหากลางห้อง

        if (data.isOrb) {
            switchAvatarToOrb(avatar, data.color, true);
        } else {
            switchAvatarToOrb(avatar, null, false); 
            switchAvatarPosture(avatar, data.state === 'STAND');
        }
    };

    onChildAdded(playersRef, updatePlayer);
    onChildChanged(playersRef, updatePlayer);

    // เมื่อผู้เล่นออก
    onChildRemoved(playersRef, (snapshot) => {
        removePlayer(snapshot.key);
    });
}

function removePlayer(uid) {
    if (otherPlayers[uid]) {
        activeModule.scene.remove(otherPlayers[uid]);
        delete otherPlayers[uid];
    }
}

// เรียกใช้ระบบซิงค์ผู้เล่น
initPlayerSync();



// 4. Transition Logic (ระบบสลับฉากและการแสดงผล UI)
const overlay = document.getElementById('fade-overlay');



function switchScene(targetMode) {
    overlay.style.opacity = 1;
    setTimeout(() => {
        // ==============================================================
        // [คำแนะนำ: การควบคุม UI เวลาข้ามห้อง]
        // 1. ถ้าต้องการให้ UI ตัวไหน เปิด/ปิด ตามห้อง ให้ดึง ID ของ HTML มาเก็บเป็นตัวแปรไว้ตรงนี้ก่อน
        // ==============================================================
        const topCapsule = document.getElementById('top-capsule-menu'); // ปุ่มขอขมา/บอร์ด
        // ตัวอย่าง: const chatUI = document.getElementById('chat-master-container'); // ถ้าอนาคตอยากซ่อนระบบแชท

        if (targetMode === 'REALM') {
            activeModule = realmModule;
            meditationModule.scene.visible = false;
            realmModule.scene.visible = true;
            
            document.getElementById('meditation-ui-group').style.display = 'none';
            document.getElementById('realm-ui-group').style.display = 'block';
            document.getElementById('warp-btn').style.display = 'none';
            document.getElementById('back-to-meditation-btn').style.display = 'block';
            

            // --- เพิ่ม 3 บรรทัดนี้ ---
            window.currentZoneName = "โถงไตรภพ"; // อัปเดตโซนให้ระบบแชท
            myIsOrbMode = true; // แปลงร่างเป็นดวงจิต
            myAvatarState = 'STAND';

            // ==============================================================
            // [คำแนะนำ: ห้องนิทรรศการภพภูมิ (REALM)]
            // 2. เมื่ออยู่ห้องภพภูมิ ให้สั่งซ่อน UI ด้วย .style.display = 'none'
            // ==============================================================
            if (topCapsule) topCapsule.style.display = 'none';
            // ตัวอย่าง: if (chatUI) chatUI.style.display = 'none';
            
            if (meditationModule.onExitScene) meditationModule.onExitScene();
            if (realmModule.onEnterScene) realmModule.onEnterScene();
        } else {
            activeModule = meditationModule;
            realmModule.scene.visible = false;
            meditationModule.scene.visible = true;
            
            document.getElementById('realm-ui-group').style.display = 'none';
            document.getElementById('meditation-ui-group').style.display = 'block';
            document.getElementById('warp-btn').style.display = 'block';
            document.getElementById('back-to-meditation-btn').style.display = 'none';
            
            // --- เพิ่ม 3 บรรทัดนี้ ---
            window.currentZoneName = "ลานธรรม"; // อัปเดตโซน
            myIsOrbMode = false; // กลับร่างคน
            myAvatarState = 'SIT'; // นั่งที่เบาะ

            // ==============================================================
            // [คำแนะนำ: ห้องลานปฏิบัติธรรม (MEDITATION)]
            // 3. เมื่อกลับมาลานปฏิบัติธรรม ให้เรียก UI กลับมาด้วย 'flex' หรือ 'block'
            // (ใช้ flex ถ้า UI นั้นสร้างด้วย Flexbox, หรือใช้ block ถ้าเป็น div ทั่วไป)
            // ==============================================================
            if (topCapsule) topCapsule.style.display = 'flex';
            // ตัวอย่าง: if (chatUI) chatUI.style.display = 'flex';
            
            if (realmModule.onExitScene) realmModule.onExitScene();
            if (meditationModule.onEnterScene) meditationModule.onEnterScene();
        }

        // ย้ายอวตารคนอื่นไปโชว์ในซีนใหม่
        Object.values(otherPlayers).forEach(avatar => {
             activeModule.scene.add(avatar);
        });

        overlay.style.opacity = 0;
    }, 800);
}

document.getElementById('warp-btn').addEventListener('click', () => switchScene('REALM'));
document.getElementById('back-to-meditation-btn').addEventListener('click', () => switchScene('MEDITATION'));
window.onload = () => { setTimeout(() => { overlay.style.opacity = 0; }, 200); };

// 5. Fullscreen Logic
const fsButton = document.getElementById('fullscreen-btn');
if (sessionStorage.getItem('keepFullscreen') === 'true') {
    fsButton.innerText = "ย่อหน้าจอ";
    fsButton.classList.remove('pulse-anim');
    const restoreFullscreen = () => {
        if (!document.fullscreenElement) document.body.requestFullscreen().catch(() => {});
        window.removeEventListener('pointerdown', restoreFullscreen);
    };
    window.addEventListener('pointerdown', restoreFullscreen);
}
fsButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!document.fullscreenElement) {
        document.body.requestFullscreen();
        sessionStorage.setItem('keepFullscreen', 'true');
    } else {
        document.exitFullscreen();
        sessionStorage.setItem('keepFullscreen', 'false');
    }
});
document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
        fsButton.innerText = "ย่อหน้าจอ";
        fsButton.classList.remove('pulse-anim');
    } else {
        fsButton.innerText = "ขยายเต็มจอ";
        fsButton.classList.add('pulse-anim');
        sessionStorage.setItem('keepFullscreen', 'false');
    }
});

// 6. Loop & Resize
renderer.setAnimationLoop(() => {
    if (activeModule && activeModule.update) activeModule.update();

    // อัปเดตตำแหน่งตัวเองขึ้น Firebase (ทำทุกเฟรมอาจจะถี่ไป แนะนำให้ตั้งเวลา หรือตรวจจับการขยับแทน)
    // แต่เพื่อความง่ายในเบื้องต้น เรียกใช้ตรงนี้ก่อนได้ครับ
    updateMyPositionToFirebase();

    renderer.render(activeModule.scene, activeModule.camera);
    cssRenderer.render(activeModule.scene, activeModule.camera);
});
window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    cssRenderer.setSize(w, h);
    meditationModule.camera.aspect = w / h; meditationModule.camera.updateProjectionMatrix();
    realmModule.camera.aspect = w / h; realmModule.camera.updateProjectionMatrix();
});