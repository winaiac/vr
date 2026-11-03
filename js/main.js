import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

import { setupMeditationScene } from './meditation-scene.js';
import { createMeditatorAvatar, switchAvatarPosture, switchAvatarToOrb } from './avatar.js';

import { ref, set, get, onChildAdded, onChildChanged, onChildRemoved } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

import { setupRealmScene } from './realm-scene.js';
import { initEngagingSystem, updateChatUserName } from './engaging.js';

// 1. User & Firebase Setup
import { initIDPS, changeUserName } from './idps.js';

const { userId, userName, channelTag } = initIDPS("กัลยาณมิตร");
let currentUserName = userName;

const userProfileBtn = document.getElementById('user-profile');
userProfileBtn.innerText = `ผู้ใช้งาน: ${currentUserName}`;

// 2. --- เพิ่มตัวแปรสำหรับจัดการผู้เล่นอื่น ---
const otherPlayers = {}; 
let myAvatarState = 'SIT'; 
let myIsOrbMode = false;
let myOrbColor = 0x00e5ff;

// ==========================================
// จัดการข้อมูลอวตารส่วนตัว (สีผิว, สีผม, สีเสื้อ, ทรงผม)
// ==========================================
const skinPalettes = [
    { color: 0xffdfc4, emissive: 0x8a6b51 },
    { color: 0xf0d5b6, emissive: 0x8a6b51 },
    { color: 0xd2a171, emissive: 0x6b4c31 },
    { color: 0x8d5524, emissive: 0x3d230e },
    { color: 0x4a2a18, emissive: 0x1a0f0a }
];
const hairColors = [0x111111, 0x2b1d14, 0x4a3123, 0xccaa55, 0x8c3310, 0xdddddd];
const shirtColors = [0xffffff, 0xffffff, 0xf5f5dc, 0xcce0ff, 0xd4f0d4, 0xffe6e6, 0xdddddd];
const pantsColors = [0xffffff, 0xffffff, 0x333333, 0x555555, 0x8b5a2b, 0x2c3e50];

let myAvatarColors = JSON.parse(localStorage.getItem('myAvatarColors'));
if (!myAvatarColors) {
    myAvatarColors = {
        skin: skinPalettes[Math.floor(Math.random() * skinPalettes.length)],
        hair: hairColors[Math.floor(Math.random() * hairColors.length)],
        shirt: shirtColors[Math.floor(Math.random() * shirtColors.length)],
        pants: pantsColors[Math.floor(Math.random() * pantsColors.length)],
        isLongHair: Math.random() > 0.5
    };
    localStorage.setItem('myAvatarColors', JSON.stringify(myAvatarColors));
}

// ==========================================
// ควบคุมปุ่มคลิกเปลี่ยนชื่อผู้ใช้ & พรีวิวอวตาร 3D
// ==========================================
const nameModal = document.getElementById('name-change-modal');
const newNameInput = document.getElementById('new-name-input');
const confirmNameBtn = document.getElementById('confirm-name-btn');
const cancelNameBtn = document.getElementById('cancel-name-btn');
const nameModalMsg = document.getElementById('name-modal-msg'); 

const randomAvatarBtn = document.createElement('button');
randomAvatarBtn.innerHTML = '🎲 สุ่มรูปลักษณ์ใหม่';
randomAvatarBtn.style.cssText = 'background: #e67e22; color: white; border: none; border-radius: 8px; padding: 10px; margin-top: 10px; margin-bottom: 10px; cursor: pointer; font-family: "Sarabun"; font-weight: bold; width: 100%; display: block;';
confirmNameBtn.parentNode.insertBefore(randomAvatarBtn, confirmNameBtn);

let myPreviewAvatar = null; 
let previewLight = null; 
let previewDarkBG = null; 
let isDraggingAvatar = false;
let previousMouseX = 0;
let manualRotationOffset = 0; 
let autoRotationAngle = 0;

function showPreviewAvatar() {
    hidePreviewAvatar(); 
    
    // [ซ่อนจอ YouTube] ป้องกันจอ CSS3D บังทะลุหัวอวตาร
    const cssContainer = document.getElementById('css-container');
    if (cssContainer) cssContainer.style.display = 'none';
    
    myPreviewAvatar = createMeditatorAvatar(newNameInput.value || currentUserName, myAvatarColors);
    switchAvatarPosture(myPreviewAvatar, true); 
    
    myPreviewAvatar.position.set(0, -0.7, -1.8); 
    
    autoRotationAngle = 0;
    manualRotationOffset = 0;
    myPreviewAvatar.rotation.y = 0; 
    
    previewLight = new THREE.Group(); 
    const pLight = new THREE.PointLight(0xffffff, 5.0, 5); 
    pLight.position.set(0, 0.2, -0.8); 
    const aLight = new THREE.AmbientLight(0xffffff, 1.5); 
    previewLight.add(pLight);
    previewLight.add(aLight);
    
    const bgGeo = new THREE.PlaneGeometry(20, 20);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85, depthWrite: false });
    previewDarkBG = new THREE.Mesh(bgGeo, bgMat);
    previewDarkBG.position.set(0, 0, -2.5); 
    
    activeModule.camera.add(previewDarkBG);
    activeModule.camera.add(myPreviewAvatar);
    activeModule.camera.add(previewLight);
}

function hidePreviewAvatar() {
    if (myPreviewAvatar) activeModule.camera.remove(myPreviewAvatar);
    if (previewLight) activeModule.camera.remove(previewLight);
    if (previewDarkBG) activeModule.camera.remove(previewDarkBG); 
    myPreviewAvatar = null;
    previewLight = null;
    previewDarkBG = null;
    
    // [แสดงจอ YouTube กลับมา] เมื่อปิดหน้าต่างเปลี่ยนชื่อ
    const cssContainer = document.getElementById('css-container');
    if (cssContainer) cssContainer.style.display = 'block';
}

userProfileBtn.addEventListener('click', () => {
    // [อัปเดตระบบเวลา] เปลี่ยนเป็นหน่วงเวลา 10 นาที (600,000 มิลลิวินาที)
    const now = Date.now();
    const lastChangeTime = localStorage.getItem('app_last_name_change_time') || 0;
    const cooldown = 10 * 60 * 1000; 

    if (now - lastChangeTime < cooldown) {
        const remainMin = Math.ceil((cooldown - (now - lastChangeTime)) / 60000);
        const originalText = userProfileBtn.innerText;
        userProfileBtn.innerText = `⏳ เปลี่ยนชื่อได้อีกครั้งใน ${remainMin} นาที`;
        userProfileBtn.style.color = "#ff5252"; 
        setTimeout(() => {
            userProfileBtn.innerText = originalText;
            userProfileBtn.style.color = "#ff9800"; 
        }, 3000);
    }

    newNameInput.value = currentUserName.replace(channelTag, ''); 
    nameModalMsg.style.display = 'none'; 
    nameModal.style.display = 'flex';
    
    nameModal.style.background = 'transparent';  
    nameModal.style.backdropFilter = 'none';
    nameModal.style.webkitBackdropFilter = 'none';
    nameModal.style.pointerEvents = 'auto'; 
    
    const innerBox = nameModal.firstElementChild;
    innerBox.style.position = 'absolute';
    innerBox.style.top = '70px'; 
    innerBox.style.left = '20px'; 
    innerBox.style.margin = '0';
    innerBox.style.pointerEvents = 'auto'; 

    // เปลี่ยนข้อความอธิบายในหน้าต่างให้เป็น 10 นาที
    const descText = innerBox.querySelector('p');
    if (descText) descText.innerText = "คุณสามารถเปลี่ยนชื่อได้ทุก 10 นาที";

    confirmNameBtn.innerText = 'บันทึก';

    newNameInput.focus();
    showPreviewAvatar();
});

// จับการลากนิ้ว/เมาส์ เพื่อหมุนอวตาร
nameModal.addEventListener('pointerdown', (e) => {
    if (e.target === nameModal) {
        isDraggingAvatar = true;
        previousMouseX = e.clientX;
    }
});

window.addEventListener('pointermove', (e) => {
    if (isDraggingAvatar && myPreviewAvatar) {
        const deltaX = e.clientX - previousMouseX;
        manualRotationOffset += deltaX * 0.015; 
        previousMouseX = e.clientX;
    }
});

window.addEventListener('pointerup', () => {
    isDraggingAvatar = false;
});

randomAvatarBtn.addEventListener('click', () => {
    myAvatarColors = {
        skin: skinPalettes[Math.floor(Math.random() * skinPalettes.length)],
        hair: hairColors[Math.floor(Math.random() * hairColors.length)],
        shirt: shirtColors[Math.floor(Math.random() * shirtColors.length)],
        pants: pantsColors[Math.floor(Math.random() * pantsColors.length)],
        isLongHair: Math.random() > 0.5
    };
    localStorage.setItem('myAvatarColors', JSON.stringify(myAvatarColors));
    
    showPreviewAvatar(); 
    updateMyPositionToFirebase(); 
});

newNameInput.addEventListener('input', () => {
    if(myPreviewAvatar) showPreviewAvatar();
});

cancelNameBtn.addEventListener('click', () => {
    nameModal.style.display = 'none';
    hidePreviewAvatar(); 
});

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
        // [เพิ่มใหม่] บันทึกเวลาล่าสุดที่เปลี่ยนชื่อสำเร็จลงเครื่อง
        localStorage.setItem('app_last_name_change_time', Date.now());
        updateMyPositionToFirebase(); 
        // [เพิ่มบรรทัดนี้] สั่งให้ระบบแชทรับรู้ชื่อใหม่ทันที
        updateChatUserName(currentUserName);
        
        setTimeout(() => {
            nameModal.style.display = 'none';
            hidePreviewAvatar(); 
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

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

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

initEngagingSystem(db, currentUserName);

const meditationModule = setupMeditationScene(renderer, cssRenderer, db, currentUserName);
const realmModule = setupRealmScene(renderer, cssRenderer, currentUserName);

let activeModule = meditationModule;
meditationModule.scene.visible = true;
realmModule.scene.visible = false;
if (meditationModule.onEnterScene) meditationModule.onEnterScene(); 

function updateMyPositionToFirebase() {
    if (!activeModule || !activeModule.camera) return;

    let syncY = activeModule.camera.position.y;
    let syncX = activeModule.camera.position.x;
    let syncZ = activeModule.camera.position.z;
    let syncState = myAvatarState;

    if (window.lockedAvatar && !myIsOrbMode) {
        syncX = window.lockedAvatar.x;
        syncY = window.lockedAvatar.y; 
        syncZ = window.lockedAvatar.z;
        syncState = window.lockedAvatar.state; 
    } else {
        if (!myIsOrbMode) syncY = 0; 
        if (syncZ < -5 && !myIsOrbMode) {
            const hash = parseInt(userId.replace(/\D/g, '').substring(0,4)) || Math.random() * 1000;
            syncX += (hash % 10) * 0.3 - 1.5; 
            syncZ += ((hash * 2) % 10) * 0.2; 
        }
    }

    const myData = {
        name: currentUserName,
        x: syncX,
        y: syncY,
        z: syncZ,
        state: syncState,
        isOrb: myIsOrbMode,
        color: myOrbColor,
        avatarColors: myAvatarColors, 
        lastActive: Date.now()
    };

    set(ref(db, `players/${userId}`), myData);
}

function initPlayerSync() {
    const playersRef = ref(db, 'players');

    const updatePlayer = (snapshot) => {
        const uid = snapshot.key;
        if (uid === userId) return; 

        const data = snapshot.val();
        
        if (Date.now() - data.lastActive > 180000) {
            removePlayer(uid);
            return;
        }

        // ===========================================
        // [เพิ่มใหม่] เช็คว่าถ้าชื่อเปลี่ยน หรือ สีเสื้อ/สีผิวเปลี่ยน ให้ลบอวตารเพื่อนตัวเก่าทิ้งเพื่อวาดใหม่
        if (otherPlayers[uid]) {
            const oldName = otherPlayers[uid].userData.userName;
            const oldColors = JSON.stringify(otherPlayers[uid].userData.customColors);
            const newColors = JSON.stringify(data.avatarColors);
            
            if (oldName !== data.name || oldColors !== newColors) {
                removePlayer(uid);
            }
        }
        // ===========================================

        if (!otherPlayers[uid]) {
            const newAvatar = createMeditatorAvatar(data.name, data.avatarColors);
            activeModule.scene.add(newAvatar); 
            otherPlayers[uid] = newAvatar;
        }

        const avatar = otherPlayers[uid];
        avatar.position.set(data.x, data.y, data.z);
        avatar.lookAt(0, data.y, -100); 

        if (data.isOrb) {
            switchAvatarToOrb(avatar, data.color, true);
        } else {
            switchAvatarToOrb(avatar, null, false); 
            switchAvatarPosture(avatar, data.state === 'STAND');
        }
    };

    onChildAdded(playersRef, updatePlayer);
    onChildChanged(playersRef, updatePlayer);

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

initPlayerSync();

const overlay = document.getElementById('fade-overlay');

function switchScene(targetMode) {
    overlay.style.opacity = 1;
    setTimeout(() => {
        const topCapsule = document.getElementById('top-capsule-menu'); 

        if (targetMode === 'REALM') {
            activeModule = realmModule;
            meditationModule.scene.visible = false;
            realmModule.scene.visible = true;
            
            document.getElementById('meditation-ui-group').style.display = 'none';
            document.getElementById('realm-ui-group').style.display = 'block';
            document.getElementById('warp-btn').style.display = 'none';
            document.getElementById('back-to-meditation-btn').style.display = 'block';
            
            window.currentZoneName = "โถงไตรภพ"; 
            myIsOrbMode = true; 
            myAvatarState = 'STAND';

            if (topCapsule) topCapsule.style.display = 'none';
            
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
            
            window.currentZoneName = "ลานธรรม"; 
            myIsOrbMode = false; 
            myAvatarState = 'SIT'; 

            if (topCapsule) topCapsule.style.display = 'flex';
            
            if (realmModule.onExitScene) realmModule.onExitScene();
            if (meditationModule.onEnterScene) meditationModule.onEnterScene();
        }

        Object.values(otherPlayers).forEach(avatar => {
             activeModule.scene.add(avatar);
        });

        overlay.style.opacity = 0;
    }, 800);
}

document.getElementById('warp-btn').addEventListener('click', () => switchScene('REALM'));
document.getElementById('back-to-meditation-btn').addEventListener('click', () => switchScene('MEDITATION'));
window.onload = () => { setTimeout(() => { overlay.style.opacity = 0; }, 200); };

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

renderer.setAnimationLoop(() => {
    if (activeModule && activeModule.update) activeModule.update();

    updateMyPositionToFirebase();

    // สั่งหมุนอวตารพรีวิว
    if (myPreviewAvatar) {
        if (!isDraggingAvatar) {
            autoRotationAngle -= 0.005; 
        }
        myPreviewAvatar.rotation.y = autoRotationAngle + manualRotationOffset;
    }

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