import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js'; 
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";
import { generateViralShareText } from './viral-share.js';
import { setupMeditationScene } from './meditation-scene.js';
import { createMeditatorAvatar, switchAvatarPosture, switchAvatarToOrb } from './avatar.js';

import { ref, set, get, update, onValue, increment, onChildAdded, onChildChanged, onChildRemoved } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

import { setupRealmScene } from './realm-scene.js';
import { initEngagingSystem, updateChatUserName } from './engaging.js';


// 1. User & Firebase Setup
import { initIDPS, changeUserName } from './idps.js';

const { userId, userName, channelTag } = initIDPS("กัลยาณมิตร");
let currentUserName = userName;

// 🔴 อัปเดตชื่อ และแต้มบุญ บนปุ่มโปรไฟล์หลัก
function updateUserProfileBtn(isRealmMode = false) {
    const userProfileBtn = document.getElementById('user-profile-btn'); // 🔴 เปลี่ยน ID เป็น user-profile-btn
    const nameSpan = document.getElementById('nav-user-name');
    const settingsIcon = document.getElementById('nav-settings-icon');

    if (nameSpan) {
        nameSpan.innerText = currentUserName;
    } else {
        console.warn("⚠️ [Diagnostic] ไม่พบแท็ก <span id='nav-user-name'> ในหน้า HTML");
    }

    if (userProfileBtn) {
        if (isRealmMode) {
            userProfileBtn.style.pointerEvents = 'none'; 
            if (settingsIcon) settingsIcon.style.display = 'none';
        } else {
            userProfileBtn.style.pointerEvents = 'auto'; 
            if (settingsIcon) settingsIcon.style.display = 'inline';
        }
    } else {
        console.warn("⚠️ [Diagnostic] ไม่พบแท็ก <button id='user-profile-btn'> ในหน้า HTML");
    }
}
// เรียกใช้งานครั้งแรกหลังโหลด
setTimeout(() => updateUserProfileBtn(), 500); 

const otherPlayers = {}; 
let myAvatarState = 'SIT'; 
let myIsOrbMode = false;
let myOrbColor = 0x00e5ff;
let myMeritPoints = 0; 
let isPreviewingAura = false; 

// ==========================================
// จัดการข้อมูลอวตารส่วนตัว
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
        isLongHair: Math.random() > 0.5,
        gender: 'M' 
    };
    localStorage.setItem('myAvatarColors', JSON.stringify(myAvatarColors));
}
if (!myAvatarColors.gender) {
    myAvatarColors.gender = 'M';
    localStorage.setItem('myAvatarColors', JSON.stringify(myAvatarColors));
}

const nameModal = document.getElementById('name-change-modal');
const newNameInput = document.getElementById('new-name-input');
const confirmNameBtn = document.getElementById('confirm-name-btn');
const cancelNameBtn = document.getElementById('cancel-name-btn');
const nameModalMsg = document.getElementById('name-modal-msg'); 

// ==========================================
// 🔴 เตรียมความพร้อมสำหรับฉากตั้งค่า (Preview Scene)
// ==========================================
const previewScene = new THREE.Scene();
const previewCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
previewCamera.position.set(0, 0, 0);

let myPreviewAvatar = null; 
let previewLight = null; 
let previewDarkBG = null; 
let isDraggingAvatar = false;
let previousMouseX = 0;
let manualRotationOffset = 0; 
let autoRotationAngle = 0;
let greetingStartTime = Date.now();

function showPreviewAvatar() {
    hidePreviewAvatar(); 
    
    const cssContainer = document.getElementById('css-container');
    if (cssContainer) cssContainer.style.display = 'none';

    const uisToHide = [
        'rotating-global-stats', 'meditation-ui-group', 'realm-ui-group', 
        'top-capsule-menu', 'center-ui-group', 'fullscreen-btn', 
        'chat-master-container', 'controls-hint'
    ];
    uisToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.dataset.prevDisplay = el.style.display; 
            el.style.display = 'none';
        }
    });
    
    const modalEl = document.getElementById('name-change-modal');
    if (modalEl) modalEl.style.display = 'block';
    
    myPreviewAvatar = createMeditatorAvatar(newNameInput.value || currentUserName, myAvatarColors, myAvatarColors.gender, myMeritPoints, isPreviewingAura);
    switchAvatarPosture(myPreviewAvatar, true); 
    
    const aspect = window.innerWidth / window.innerHeight;
    const isLandscape = aspect > 1.0; 
    
    const avatarX = isLandscape ? 0.60 : 0.32;    
    const avatarY = isLandscape ? -0.40 : -0.40;  
    const avatarZ = isLandscape ? -2.50 : -2.00; 
    const avatarScale = isLandscape ? 1.0 : 0.85;
    
    myPreviewAvatar.position.set(avatarX, avatarY, avatarZ); 
    myPreviewAvatar.scale.set(avatarScale, avatarScale, avatarScale);
    myPreviewAvatar.userData.baseY = avatarY; 
    
    autoRotationAngle = 0;
    manualRotationOffset = 0;
    myPreviewAvatar.rotation.x = 0.0; 
    myPreviewAvatar.rotation.y = -0.15; 

    greetingStartTime = Date.now();
    
    previewLight = new THREE.Group(); 
    const pLight = new THREE.PointLight(0xffffff, 3.5, 10); pLight.position.set(0, 0.5, 0); 
    const aLight = new THREE.AmbientLight(0xffffff, 1.2); 
    const rimLightBlue = new THREE.PointLight(0x00e5ff, 5.0, 5); rimLightBlue.position.set(1.5, 0.5, -2.5); 
    const rimLightOrange = new THREE.PointLight(0xff9800, 5.0, 5); rimLightOrange.position.set(-1.5, -0.2, -2.5); 
    previewLight.add(pLight, aLight, rimLightBlue, rimLightOrange);
    
    const bgGeo = new THREE.PlaneGeometry(25, 25); 
    const bgMat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0.0 } },
        vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
            uniform float time; varying vec2 vUv;
            void main() {
                float dist = distance(vUv, vec2(0.5, 0.5));
                float aura = smoothstep(0.4, 0.0, dist); 
                float pulse = (sin(time * 2.5) * 0.5) + 0.5; 
                float intensity = 0.5 + (pulse * 0.4); 
                vec3 edgeColor = vec3(0.01, 0.01, 0.02);
                vec3 centerColor = vec3(0.0, 0.6, 0.8); 
                vec3 finalColor = mix(edgeColor, centerColor, aura * intensity);
                gl_FragColor = vec4(finalColor, 1.0); 
            }
        `,
        depthWrite: true 
    });
    previewDarkBG = new THREE.Mesh(bgGeo, bgMat);
    previewDarkBG.position.set(0, 0, -3.0); 
    
    previewScene.add(previewDarkBG);
    previewScene.add(myPreviewAvatar);
    previewScene.add(previewLight);

    updateSharePreview(false);
}

function hidePreviewAvatar() {
    if (myPreviewAvatar) previewScene.remove(myPreviewAvatar);
    if (previewLight) previewScene.remove(previewLight);
    if (previewDarkBG) previewScene.remove(previewDarkBG); 
    
    myPreviewAvatar = null;
    previewLight = null;
    previewDarkBG = null;
    
    const cssContainer = document.getElementById('css-container');
    if (cssContainer) cssContainer.style.display = 'block';

    const modalEl = document.getElementById('name-change-modal');
    if (modalEl) modalEl.style.display = 'none';
    
    const uisToHide = [
        'rotating-global-stats', 'meditation-ui-group', 'realm-ui-group', 
        'top-capsule-menu', 'center-ui-group', 'fullscreen-btn', 
        'chat-master-container', 'controls-hint'
    ];
    uisToHide.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.dataset.prevDisplay !== undefined) {
            el.style.display = el.dataset.prevDisplay;
        }
    });
}

// 🔴 แก้ไข event listener ให้ใช้ ID ใหม่
const profileBtn = document.getElementById('user-profile-btn');
if(profileBtn) {
    profileBtn.addEventListener('click', () => {
        const now = Date.now();
        const lastChangeTime = localStorage.getItem('app_last_name_change_time') || 0;
        const cooldown = 10 * 60 * 1000; 

        if (now - lastChangeTime < cooldown) {
            const remainMin = Math.ceil((cooldown - (now - lastChangeTime)) / 60000);
            const originalText = profileBtn.innerHTML;
            profileBtn.innerHTML = `⏳ รออีก ${remainMin} นาที`;
            profileBtn.style.color = "#ff5252"; 
            setTimeout(() => {
                profileBtn.innerHTML = originalText;
                profileBtn.style.color = "#ffffff"; 
            }, 3000);
        }

        newNameInput.value = currentUserName.replace(channelTag, ''); 
        nameModalMsg.style.display = 'none'; 
        showPreviewAvatar();
    });
}

function generateRandomAppearance(targetGender) {
    myAvatarColors = {
        skin: skinPalettes[Math.floor(Math.random() * skinPalettes.length)],
        hair: hairColors[Math.floor(Math.random() * hairColors.length)],
        shirt: shirtColors[Math.floor(Math.random() * shirtColors.length)],
        pants: pantsColors[Math.floor(Math.random() * pantsColors.length)],
        isLongHair: targetGender === 'F' ? (Math.random() > 0.3) : (Math.random() > 0.7),
        gender: targetGender
    };
    localStorage.setItem('myAvatarColors', JSON.stringify(myAvatarColors));
    
    if(myPreviewAvatar) {
        previewScene.remove(myPreviewAvatar);
        myPreviewAvatar = createMeditatorAvatar(newNameInput.value || currentUserName, myAvatarColors, myAvatarColors.gender, myMeritPoints, isPreviewingAura);
        switchAvatarPosture(myPreviewAvatar, true);
        
        const aspect = window.innerWidth / window.innerHeight;
        const isLandscape = aspect > 1.0; 
        const avatarX = isLandscape ? 0.60 : 0.32;    
        const avatarY = isLandscape ? -0.40 : -0.40;  
        const avatarZ = isLandscape ? -2.50 : -2.00; 
        const avatarScale = isLandscape ? 1.0 : 0.85;
        
        myPreviewAvatar.position.set(avatarX, avatarY, avatarZ); 
        myPreviewAvatar.scale.set(avatarScale, avatarScale, avatarScale);
        myPreviewAvatar.rotation.x = 0.0; 
        myPreviewAvatar.rotation.y = -0.15; 
        myPreviewAvatar.userData.baseY = avatarY;
        
        previewScene.add(myPreviewAvatar);
    }
    
    updateMyPositionToFirebase(); 
    updateSharePreview(false);
}

const btnGenMale = document.getElementById('btn-gen-male');
if (btnGenMale) btnGenMale.addEventListener('click', () => generateRandomAppearance('M'));

const btnGenFemale = document.getElementById('btn-gen-female');
if (btnGenFemale) btnGenFemale.addEventListener('click', () => generateRandomAppearance('F'));

cancelNameBtn.addEventListener('click', () => {
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
        updateUserProfileBtn(activeModule === realmModule);
        
        nameModalMsg.innerText = result.message; 
        nameModalMsg.style.color = "#00ffcc";
        nameModalMsg.style.display = "block";
        localStorage.setItem('app_last_name_change_time', Date.now());
        
        updateMyPositionToFirebase(); 
        updateChatUserName(currentUserName); 
        
        setTimeout(() => {
            hidePreviewAvatar(); 
        }, 1500);
    } else {
        nameModalMsg.innerText = result.message; 
        nameModalMsg.style.color = "#ff5252";
        nameModalMsg.style.display = "block";
    }
});

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

renderer.domElement.addEventListener('pointerdown', (e) => {
    if (myPreviewAvatar) {
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

    update(ref(db, `players/${userId}`), myData);
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

        if (otherPlayers[uid]) {
            const oldName = otherPlayers[uid].userData.userName;
            const oldColors = JSON.stringify(otherPlayers[uid].userData.customColors);
            const newColors = JSON.stringify(data.avatarColors);
            const oldPoints = otherPlayers[uid].userData.meritPoints || 0; 
            
            if (oldName !== data.name || oldColors !== newColors || oldPoints !== (data.meritPoints || 0)) {
                removePlayer(uid);
            }
        }

        if (!otherPlayers[uid]) {
            const newAvatar = createMeditatorAvatar(data.name, data.avatarColors, data.avatarColors.gender, data.meritPoints || 0);
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
            
            if (topCapsule) topCapsule.style.display = 'none';
            updateUserProfileBtn(true);
            
            window.currentZoneName = "โถงไตรภพ"; 
            myIsOrbMode = true; 
            myAvatarState = 'STAND';
            
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
            
            if (topCapsule) topCapsule.style.display = 'flex';
            updateUserProfileBtn(false);
            
            window.currentZoneName = "ลานธรรม"; 
            myIsOrbMode = false; 
            myAvatarState = 'SIT'; 
            
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

let talkTimer = 0;
let isTalking = false; 

renderer.setAnimationLoop(() => {
    updateMyPositionToFirebase();

    if (myPreviewAvatar) {
        const aspect = window.innerWidth / window.innerHeight;
        const isLandscape = aspect > 1.0; 
        const lookAtOffset = isLandscape ? -0.18 : 0; 
        
        const timeNow = Date.now();
        
        const swayOffset = Math.sin(timeNow * 0.001) * 0.05; 
        
        myPreviewAvatar.rotation.y = manualRotationOffset + lookAtOffset + swayOffset;
        
        const baseY = myPreviewAvatar.userData.baseY !== undefined ? myPreviewAvatar.userData.baseY : -0.5;
        myPreviewAvatar.position.y = baseY + (Math.sin(timeNow * 0.002) * 0.015);
        
        if (myPreviewAvatar.update) myPreviewAvatar.update();

        myPreviewAvatar.traverse((child) => {
            if (child.isMesh) {
                const name = child.name.toLowerCase();
                let isMouth = name.includes('mouth');
                
                if (child.parent && child.parent.name === 'headGroup' && child.position.z >= 0.10) {
                    const hex = child.material && child.material.color ? child.material.color.getHex() : -1;
                    if (hex === 0x994444) isMouth = true; 
                }

                if (isMouth) {
                    let elapsed = Date.now() - greetingStartTime;
                    let targetScaleX = 1.0; let targetScaleY = 1.0; 
                    
                    if (elapsed < 1400) {
                        if (elapsed < 350) { targetScaleX = 2.0; targetScaleY = 0.9; } 
                        else if (elapsed < 750) { targetScaleX = 3.5; targetScaleY = 1.1; } 
                        else { targetScaleX = 0.5; targetScaleY = 1.4; }
                    } else if (isTalking) {
                        let wave = Math.sin(Date.now() * 0.015);
                        targetScaleX = 1.0 + Math.max(0, wave * 2.5); 
                        targetScaleY = 1.0 - (wave * 0.1); 
                    }
                    child.scale.x += (targetScaleX - child.scale.x) * 0.3;
                    child.scale.y += (targetScaleY - child.scale.y) * 0.3;
                }
            }
        });

        if (previewDarkBG && previewDarkBG.material.uniforms) {
            previewDarkBG.material.uniforms.time.value += 0.015; 
        }

        renderer.render(previewScene, previewCamera);

    } else {
        if (activeModule && activeModule.update) activeModule.update();
        renderer.render(activeModule.scene, activeModule.camera);
        cssRenderer.render(activeModule.scene, activeModule.camera);
    }

    Object.values(otherPlayers).forEach(avatar => {
        if (avatar.update) avatar.update();
    });
});

window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    cssRenderer.setSize(w, h);
    meditationModule.camera.aspect = w / h; meditationModule.camera.updateProjectionMatrix();
    realmModule.camera.aspect = w / h; realmModule.camera.updateProjectionMatrix();
    
    if (typeof previewCamera !== 'undefined') {
        previewCamera.aspect = w / h;
        previewCamera.updateProjectionMatrix();
    }
});

// ==========================================
// ระบบแชร์ & ข้อความไวรัล & Rate Limiter & พรีวิวออร่า
// ==========================================
const shareInput = document.getElementById('share-link-input');
if (shareInput) {
    shareInput.value = `https://winaiac.github.io/vr/?ref=${userId}`;
}

let regenTimestamps = [];
const MAX_REGEN_PER_MIN = 12; 

function updateSharePreview(checkLimit = true) {
    const link = document.getElementById('share-link-input').value;
    const gender = myAvatarColors.gender || 'M';
    
    if (checkLimit) {
        const now = Date.now();
        regenTimestamps = regenTimestamps.filter(ts => now - ts < 60000);
        
        if (regenTimestamps.length >= MAX_REGEN_PER_MIN) {
            const waitTime = Math.ceil((60000 - (now - regenTimestamps[0])) / 1000);
            const limitMsg = document.getElementById('share-limit-msg');
            if (limitMsg) {
                limitMsg.innerText = `⏳ รอ ${waitTime} วิ`;
                limitMsg.style.display = 'block';
                setTimeout(() => limitMsg.style.display = 'none', 3000);
            }
            return; 
        }
        regenTimestamps.push(now); 
    }
    
    const viralMessage = generateViralShareText(currentUserName, link, gender);
    const previewEl = document.getElementById('share-text-preview');
    if (previewEl) previewEl.value = viralMessage;
}

const regenBtn = document.getElementById('regen-share-btn');
if (regenBtn) {
    regenBtn.addEventListener('click', () => updateSharePreview(true));
}

const copyBtn = document.getElementById('copy-link-btn');
if (copyBtn && shareInput) {
    copyBtn.addEventListener('click', () => {
        const previewEl = document.getElementById('share-text-preview');
        
        if (previewEl) {
            previewEl.select();
            navigator.clipboard.writeText(previewEl.value).then(() => {
                showCopySuccess();
            }).catch(err => {
                document.execCommand('copy');
                showCopySuccess();
            });
        } else {
            shareInput.select();
            document.execCommand('copy');
            showCopySuccess();
        }
        
        function showCopySuccess() {
            const oldText = copyBtn.innerHTML;
            copyBtn.innerHTML = '✅ สำเร็จ!';
            copyBtn.style.background = '#00ffcc';
            copyBtn.style.color = '#111';
            setTimeout(() => {
                copyBtn.innerHTML = oldText;
                copyBtn.style.background = '#4CAF50';
                copyBtn.style.color = 'white';
            }, 2000);
        }
    });
}

// 🔴 ปุ่มเปิด-ปิด พรีวิวออร่า
const auraBtn = document.getElementById('preview-aura-btn');
if (auraBtn) {
    auraBtn.addEventListener('click', () => {
        isPreviewingAura = !isPreviewingAura;
        auraBtn.innerText = isPreviewingAura ? "🛑 ปิดพรีวิวออร่า" : "✨ พรีวิวร่างออร่า (จำลอง 100 บุญ)";
        auraBtn.style.background = isPreviewingAura ? "#ff5252" : "#ffd700";
        auraBtn.style.color = isPreviewingAura ? "#fff" : "#111";
        
        if(myPreviewAvatar) {
            previewScene.remove(myPreviewAvatar);
            myPreviewAvatar = createMeditatorAvatar(newNameInput.value || currentUserName, myAvatarColors, myAvatarColors.gender, myMeritPoints, isPreviewingAura);
            switchAvatarPosture(myPreviewAvatar, true);
            
            const aspect = window.innerWidth / window.innerHeight;
            const isLandscape = aspect > 1.0; 
            const avatarX = isLandscape ? 0.60 : 0.32;    
            const avatarY = isLandscape ? -0.40 : -0.40;  
            const avatarZ = isLandscape ? -2.50 : -2.00; 
            const avatarScale = isLandscape ? 1.0 : 0.85;
            
            myPreviewAvatar.position.set(avatarX, avatarY, avatarZ); 
            myPreviewAvatar.scale.set(avatarScale, avatarScale, avatarScale);
            myPreviewAvatar.rotation.x = 0.0; 
            myPreviewAvatar.rotation.y = -0.15; 
            myPreviewAvatar.userData.baseY = avatarY;
            
            previewScene.add(myPreviewAvatar);
        }
    });
}

const urlParams = new URLSearchParams(window.location.search);
const refId = urlParams.get('ref'); 

// ==========================================
// 🔍 ระบบดึงคะแนนจาก Firebase พร้อมตัววินิจฉัย (Debug)
// ==========================================
console.log("🔍 [Diagnostic] เริ่มเชื่อมต่อฐานข้อมูลแต้มบุญสำหรับ User ID:", userId);

const myPlayerRef = ref(db, `players/${userId}`);
onValue(myPlayerRef, (snapshot) => {
    const data = snapshot.val();
    
    if (!data) {
        console.warn(`⚠️ [Diagnostic] ไม่พบข้อมูลใน Firebase (Path: players/${userId}) ระบบกำลังบังคับแสดงค่า '0 บุญ' และสร้างข้อมูลเริ่มต้นให้...`);
    } else {
        console.log("📥 [Diagnostic] โหลดข้อมูลจาก Firebase สำเร็จ:", data);
    }

    myMeritPoints = Number(data?.meritPoints) || 0;
    const sharePts = Number(data?.sharePoints) || 0;
    const hourPts = Number(data?.hourPoints) || 0;
    
    const meritDisplay = document.getElementById('total-merit-display');
    const shareDisplay = document.getElementById('share-merit-display');
    const hourDisplay = document.getElementById('hour-merit-display');

    if (meritDisplay) meritDisplay.innerText = `${myMeritPoints} บุญ`;
    if (shareDisplay) shareDisplay.innerText = sharePts;
    if (hourDisplay) hourDisplay.innerText = hourPts;

    // 🔴 แก้ไขการดึงป้ายคะแนนจาก ID ตรงๆ เพื่อหลีกเลี่ยงการถูกทับโดย innerHTML
    const navMeritBadge = document.getElementById('nav-merit-badge');
    if (navMeritBadge) {
        navMeritBadge.innerText = `✨ ${myMeritPoints} บุญ`;
        console.log(`✨ [Diagnostic] อัปเดตตัวเลขบนป้าย 'nav-merit-badge' เป็น: ${myMeritPoints} บุญ เรียบร้อย`);
    } else {
        console.error("❌ [Diagnostic Error] หาแท็ก 'nav-merit-badge' บนจอหลักไม่เจอ! ทำให้ไม่สามารถแสดงแต้มมุมซ้ายบนได้");
    }

    if (!data) {
        set(myPlayerRef, {
            meritPoints: 0,
            sharePoints: 0,
            hourPoints: 0
        }).catch(err => console.error("❌ [Firebase Error] ไม่สามารถบันทึกค่าเริ่มต้นได้:", err));
    }
}, (error) => {
    console.error("❌ [Firebase Connection Error] เกิดข้อผิดพลาดในการดึงข้อมูล:", error);
});

if (refId && refId !== userId) {
    const hasReferred = localStorage.getItem(`referred_${refId}`);
    if (!hasReferred) {
        update(ref(db, `players/${refId}`), {
            meritPoints: increment(1),
            sharePoints: increment(1) 
        }).then(() => {
            console.log("เพิ่มแต้มบุญให้ผู้แนะนำสำเร็จ!");
            localStorage.setItem(`referred_${refId}`, 'true'); 
        }).catch(err => console.error("Referral Update Error:", err));
    }
}

// ==========================================
// 🔴 ระบบสะสมชั่วโมงปฏิบัติธรรม (1 ชม. = 1 แต้ม)
// ==========================================
setInterval(() => {
    if (activeModule === meditationModule && !myPreviewAvatar) {
        update(ref(db, `players/${userId}`), {
            meritPoints: increment(1),
            hourPoints: increment(1)
        }).then(() => {
            console.log("ได้รับ 1 แต้มบุญจากการปฏิบัติธรรมครบ 1 ชั่วโมง");
        }).catch(err => console.error(err));
    }
}, 3600000);