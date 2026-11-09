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
import { loadMyAvatarColors, generateRandomColors, updateSharePreview, initShareSystem } from './setting.js';
import { initIDPS, changeUserName } from './idps.js';
// 🔴 นำเข้าฟังก์ชันสร้างหิ่งห้อย
import { createFireflies, updateFireflies } from './fireflies.js';

const { userId, userName, channelTag } = initIDPS("กัลยาณมิตร");
let currentUserName = userName;

function updateUserProfileBtn(isRealmMode = false) {
    const userProfileBtn = document.getElementById('user-profile-btn'); 
    const nameSpan = document.getElementById('nav-user-name');
    const settingsIcon = document.getElementById('nav-settings-icon');

    if (nameSpan) {
        nameSpan.innerText = currentUserName;
    }

    if (userProfileBtn) {
        if (isRealmMode) {
            userProfileBtn.style.pointerEvents = 'none'; 
            if (settingsIcon) settingsIcon.style.display = 'none';
        } else {
            userProfileBtn.style.pointerEvents = 'auto'; 
            if (settingsIcon) settingsIcon.style.display = 'inline';
        }
    }
}
setTimeout(() => updateUserProfileBtn(), 500); 

const otherPlayers = {}; 
let myAvatarState = 'SIT'; 
let myIsOrbMode = false;
let myOrbColor = 0x00e5ff;
let myMeritPoints = 0; 
let isPreviewingAura = false; 

let myAvatarColors = loadMyAvatarColors();

const nameModal = document.getElementById('name-change-modal');
const newNameInput = document.getElementById('new-name-input');
const cancelNameBtn = document.getElementById('cancel-name-btn');
const nameModalMsg = document.getElementById('name-modal-msg');

const previewScene = new THREE.Scene();
const previewCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
previewCamera.position.set(0, 0, 0);

let myPreviewAvatar = null; 
let previewLight = null; 
let previewFloor = null; 
let previewGroundFog = null; // 🔴 ตัวแปรเก็บหมอกหน้าตั้งค่า
let previewFireflies = null; // 🔴 ตัวแปรเก็บหิ่งห้อยหน้าตั้งค่า
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
    
    // ==========================================
    // 🌿 คำนวณเวลาจริงแบบเดียวกับลานธรรม
    // ==========================================
    const currentHour = new Date().getHours();
    const isNight = currentHour >= 18 || currentHour < 6; 

    // พื้นหลังและหมอกตามเวลา
    const texLoader = new THREE.TextureLoader();
    texLoader.load('textures/trees.jpg', (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        previewScene.background = texture;
        previewScene.environment = texture;
        // 🔴 หรี่แสงพื้นหลังถ้าเป็นกลางคืน
        if (previewScene.backgroundIntensity !== undefined) {
            previewScene.backgroundIntensity = isNight ? 0.15 : 1.0;
        }
    });
    
    previewScene.fog = new THREE.FogExp2(isNight ? 0x08152b : 0xa3c4d1, isNight ? 0.05 : 0.015);

    // ==========================================
    // 🌿 จัดแสงบรรยากาศ กลางวัน/กลางคืน
    // ==========================================
    previewLight = new THREE.Group(); 
    const aLight = new THREE.AmbientLight(isNight ? 0x2a3b5c : 0xffffff, isNight ? 0.6 : 0.8);
    const pLight = new THREE.PointLight(0xffcc80, isNight ? 1.0 : 1.5, 15);
    pLight.position.set(0, 4, -2); 
    const moonLight = new THREE.DirectionalLight(0x4a8df8, isNight ? 1.2 : 0.0);
    moonLight.position.set(5, 10, 5);
    
    // ไฟส่องหน้า (เพื่อความชัดเจนตอนตั้งค่า)
    const faceLight = new THREE.DirectionalLight(0xffffff, isNight ? 0.8 : 1.2);
    faceLight.position.set(0, 1, 3);
    
    previewLight.add(aLight, pLight, moonLight, faceLight);
    
    // ==========================================
    // 🍃 พื้นดินลานธรรม + หมอกเอื่อยๆ
    // ==========================================
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 1024; floorCanvas.height = 1024;
    const floorCtx = floorCanvas.getContext('2d');
    const floorGrad = floorCtx.createRadialGradient(512, 512, 200, 512, 512, 500);
    floorGrad.addColorStop(0, '#4a2e18');   
    floorGrad.addColorStop(0.6, '#2e1c0e'); 
    floorGrad.addColorStop(1, '#050301');   
    floorCtx.fillStyle = floorGrad; floorCtx.fillRect(0, 0, 1024, 1024);
    floorCtx.fillStyle = 'rgba(0,0,0,0.15)';
    for(let i=0; i<15000; i++) { floorCtx.fillRect(Math.random()*1024, Math.random()*1024, 2, 2); }
    
    const floorTexture = new THREE.CanvasTexture(floorCanvas);
    floorTexture.colorSpace = THREE.SRGBColorSpace;

    previewFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(25, 25), 
        new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.9 })
    );
    previewFloor.rotation.x = -Math.PI / 2;
    previewFloor.position.y = avatarY - 0.05; 
    
    previewScene.add(previewFloor);

    // 🔴 ดึงหมอกของลานธรรมมาใส่ในหน้าพรีวิวด้วย
    if (window.groundFogMat) {
        previewGroundFog = new THREE.Mesh(new THREE.PlaneGeometry(25, 25), window.groundFogMat);
        previewGroundFog.rotation.x = -Math.PI / 2;
        previewGroundFog.position.y = avatarY + 0.1; 
        previewScene.add(previewGroundFog);
    }

    // 🔴 ดึงหิ่งห้อยมาใส่ (โชว์เฉพาะกลางคืน)
    previewFireflies = createFireflies();
    previewFireflies.visible = isNight;
    previewScene.add(previewFireflies);

    previewScene.add(myPreviewAvatar);
    previewScene.add(previewLight);

    updateSharePreview(false);
}

function hidePreviewAvatar() {
    if (myPreviewAvatar) previewScene.remove(myPreviewAvatar);
    if (previewLight) previewScene.remove(previewLight);
    if (previewFloor) previewScene.remove(previewFloor); 
    if (previewGroundFog) previewScene.remove(previewGroundFog); // 🔴 ลบหมอก
    if (previewFireflies) previewScene.remove(previewFireflies); // 🔴 ลบหิ่งห้อย
    
    myPreviewAvatar = null;
    previewLight = null;
    previewFloor = null;
    previewGroundFog = null;
    previewFireflies = null;
    
    previewScene.background = null;
    previewScene.environment = null;
    previewScene.fog = null;
    
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
    myAvatarColors = generateRandomColors(targetGender); 
    
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
    updateSharePreview(currentUserName, userId, myAvatarColors.gender, false);
}

const btnGenMale = document.getElementById('btn-gen-male');
if (btnGenMale) btnGenMale.addEventListener('click', () => generateRandomAppearance('M'));

const btnGenFemale = document.getElementById('btn-gen-female');
if (btnGenFemale) btnGenFemale.addEventListener('click', () => generateRandomAppearance('F'));

cancelNameBtn.addEventListener('click', () => {
    const newName = newNameInput.value.trim();
    const rawCurrentName = currentUserName.replace(channelTag, '');
    
    if (newName && newName !== rawCurrentName) {
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
    } else {
        hidePreviewAvatar(); 
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
let lastFirebaseSync = 0; 

renderer.setAnimationLoop(() => {
    
    const nowSync = Date.now();
    if (nowSync - lastFirebaseSync > 1000) {
        updateMyPositionToFirebase();
        lastFirebaseSync = nowSync;
    }

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

        // 🔴 สั่งอัปเดตแอนิเมชันของหมอกและหิ่งห้อยตอนอยู่ในหน้าตั้งค่า
        if (window.groundFogMat) {
            window.groundFogMat.uniforms.time.value += 0.015;
        }
        updateFireflies();

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
// เริ่มระบบปุ่มแชร์และคัดลอกไวรัล 
// ==========================================
initShareSystem(
    () => currentUserName,
    userId,
    () => myAvatarColors.gender
);

const auraBtn = document.getElementById('preview-aura-btn');
if (auraBtn) {
    auraBtn.addEventListener('click', () => {
        isPreviewingAura = !isPreviewingAura;
        auraBtn.innerText = isPreviewingAura ? "🛑 ปิดพรีวิวออร่า" : "✨ พรีวิวร่างออร่า";
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
// 🔍 ระบบดึงคะแนน Firebase + Client-Side Flash
// ==========================================
console.log("🔍 [Diagnostic] เริ่มเชื่อมต่อฐานข้อมูลแต้มบุญสำหรับ User ID:", userId);

let myTotalMeditationMinutes = 0; 
let localTotalSeconds = 0; 
let localSharePts = 0;
let isDataLoaded = false;

const myPlayerRef = ref(db, `players/${userId}`);
onValue(myPlayerRef, (snapshot) => {
    const data = snapshot.val();
    
    if (!data) {
        set(myPlayerRef, {
            meritPoints: 0, sharePoints: 0, hourPoints: 0, meditationMinutes: 0
        }).catch(err => console.error("❌ [Firebase Error]", err));
        return;
    }

    localSharePts = Number(data.sharePoints) || 0;
    const minPts = Number(data.meditationMinutes) || 0;
    const hourPts = Number(data.hourPoints) || 0;
    
    myTotalMeditationMinutes = (hourPts * 60) + minPts;
    const dbTotalSeconds = myTotalMeditationMinutes * 60;
    
    if (!isDataLoaded || Math.abs(localTotalSeconds - dbTotalSeconds) > 120) {
        localTotalSeconds = dbTotalSeconds;
        isDataLoaded = true;
    }

    const shareDisplay = document.getElementById('share-merit-display');
    if (shareDisplay) shareDisplay.innerText = localSharePts;
});

setInterval(() => {
    localTotalSeconds++; 
    
    const calculatedMerit = localSharePts + (localTotalSeconds / 3600);
    myMeritPoints = calculatedMerit; 
    
    const meritDisplay = document.getElementById('total-merit-display');
    const navMeritBadge = document.getElementById('nav-merit-badge');
    
    if (meritDisplay) meritDisplay.innerText = `${calculatedMerit.toFixed(4)} บุญ`; 
    if (navMeritBadge) navMeritBadge.innerText = `✨ ${calculatedMerit.toFixed(2)} บุญ`; 
    
    const hourDisplay = document.getElementById('hour-merit-display');
    if (hourDisplay) {
        const hrs = Math.floor(localTotalSeconds / 3600);
        const mins = Math.floor((localTotalSeconds % 3600) / 60);
        const secs = localTotalSeconds % 60;
        
        const hStr = String(hrs).padStart(2, '0');
        const mStr = String(mins).padStart(2, '0');
        const sStr = String(secs).padStart(2, '0');
        
        hourDisplay.innerHTML = `${hStr}:${mStr}:<span style="color:#00ffcc;">${sStr}</span>`;
    }
}, 1000);

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

setInterval(() => {
    update(ref(db, `players/${userId}`), {
        meditationMinutes: increment(1),
        meritPoints: increment(1 / 60) 
    }).catch(err => console.error("Firebase Update Error:", err));
}, 60000);