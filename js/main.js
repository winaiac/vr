import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

import { setupMeditationScene } from './meditation-scene.js';
import { setupRealmScene } from './realm-scene.js';
import { initEngagingSystem } from './engaging.js';

// 1. User & Firebase Setup
import { initIDPS, changeUserName } from './idps.js'; 

const { userId, userName, channelTag } = initIDPS("กัลยาณมิตร");
let currentUserName = userName;

const userProfileBtn = document.getElementById('user-profile');
userProfileBtn.innerText = `ผู้ใช้งาน: ${currentUserName}`;

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