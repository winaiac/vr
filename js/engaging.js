import { ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

// --- State (ตัวแปรระบบ) ---
let firebaseDb = null;
let currentRoomId = null;
let currentUser = "กัลยาณมิตร";
let activeBots = [];
let botReactionInterval = null;
let toastTimeout = null;

// --- เพิ่มตัวแปร Global ใหม่ (ด้านบนสุดต่อจากตัวแปรระบบ) ---
window.currentZoneName = "ลานธรรม";

// ==========================================
// [ปรับแต่งได้: การตั้งค่าระบบจำกัดเวลาและข้อความ]
// ==========================================
const MAX_MESSAGES = 6;          // จำนวนข้อความสูงสุดที่จะให้ลอยอยู่บนหน้าจอ
const MSG_LIFETIME = 30000;      // ระยะเวลาที่ข้อความค้างบนจอ (30000 = 30 วินาที)
const COOLDOWN_EMOJI = 10000;    // คูลดาวน์สำหรับกดอิโมจิปุ่มฟิกซ์ (10000 = 10 วินาที)

// [ปรับแต่งได้: ตั้งเวลาคูลดาวน์สำหรับการพิมพ์ข้อความอิสระ (หน่วยเป็นมิลลิวินาที)]
// 👉 หากต้องการให้พิมพ์ได้ทุก 10 วินาที ให้ใส่เลข 10000
// 👉 หากต้องการกลับไปเป็น 1 ชั่วโมง ให้เปลี่ยนเป็น 3600000
const COOLDOWN_CUSTOM_MSG = 10000; 

// [ปรับแต่งได้: แก้ไขหรือเพิ่มปุ่มอิโมจิฟิกซ์ตรงนี้]
const reactionTypes = {
    'sathu': '🙏 สาธุ',
    'good': '👍 ดีมากเลย',
    'heart': '❤️ สุดยอดเลย'
};

// ==========================================
// ระบบแจ้งเตือน (In-App Toast)
// ==========================================
function showToast(message) {
    let toast = document.getElementById('in-app-toast');
    if (!toast) return;
    toast.innerHTML = message;
    toast.style.display = 'block';
    setTimeout(() => toast.style.opacity = 1, 10);
    
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.style.opacity = 0;
        setTimeout(() => toast.style.display = 'none', 300);
    }, 3500); 
}

// ==========================================
// ระบบจับเวลา Rate Limiting
// ==========================================
function canSendFixedEmoji() {
    const now = Date.now();
    const lastTime = localStorage.getItem('app_last_fixed_emoji') || 0;
    if (now - lastTime < COOLDOWN_EMOJI) { 
        showToast('⏳ คุณส่งถี่เกินไป กรุณารอสักครู่ (ทุก 10 วิ)'); 
        return false;
    }
    localStorage.setItem('app_last_fixed_emoji', now);
    return true;
}

function canSendCustomMessage() {
    const now = Date.now();
    const lastTime = localStorage.getItem('app_last_custom_msg') || 0;
    if (now - lastTime < COOLDOWN_CUSTOM_MSG) {
        // [คำแนะนำ]: โชว์ข้อความเตือนหากพยายามส่งก่อนกำหนด
        const remainSec = Math.ceil((COOLDOWN_CUSTOM_MSG - (now - lastTime)) / 1000);
        
        // ถ้าคูลดาวน์นานเป็นชั่วโมง ให้แจ้งเตือนแบบชั่วโมง
        if (COOLDOWN_CUSTOM_MSG >= 3600000) {
            showToast('⏳ พิมพ์ข้อความใหม่ได้ 1 ครั้งต่อ 1 ชั่วโมงครับ'); 
        } else {
            // ถ้าคูลดาวน์สั้น ให้แจ้งเตือนบอกจำนวนวินาทีที่เหลือ
            showToast(`⏳ กรุณารออีก ${remainSec} วินาที ค่อยพิมพ์ใหม่ครับ`);
        }
        return false;
    }
    localStorage.setItem('app_last_custom_msg', now);
    return true;
}

function isCustomMessageOnCooldown() {
    const lastTime = localStorage.getItem('app_last_custom_msg') || 0;
    return (Date.now() - lastTime < COOLDOWN_CUSTOM_MSG);
}

// ==========================================
// โครงสร้าง UI (ปุ่มกด และ ช่องพิมพ์)
// ==========================================
function createReactionUI() {
    const masterContainer = document.createElement('div');
    masterContainer.id = 'chat-master-container';
    masterContainer.style.cssText = `
        position: absolute; bottom: clamp(30px, 4vh, 50px); left: clamp(10px, 2vw, 20px);
        display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
        z-index: 999; pointer-events: none;
    `;
    document.body.appendChild(masterContainer);

    const floatingContainer = document.createElement('div');
    floatingContainer.id = 'floating-reactions-container';
    floatingContainer.style.cssText = `
        display: flex; flex-direction: column; justify-content: flex-end; gap: 6px;
        height: 280px; width: 350px; pointer-events: none; padding-left: 5px;
    `;
    masterContainer.appendChild(floatingContainer);

    const toast = document.createElement('div');
    toast.id = 'in-app-toast';
    toast.style.cssText = `
        background: rgba(211, 47, 47, 0.95); border: 1px solid #ff5252; border-radius: 12px;
        padding: 6px 15px; color: #ffffff; font-family: 'Sarabun', sans-serif; font-size: 13px; font-weight: bold;
        opacity: 0; display: none; transition: opacity 0.3s; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    `;
    masterContainer.appendChild(toast);

    const controlsWrapper = document.createElement('div');
    controlsWrapper.id = 'reaction-ui-container';
    controlsWrapper.style.cssText = `display: flex; flex-direction: column; gap: 6px; pointer-events: auto;`;
    masterContainer.appendChild(controlsWrapper);

    // --- ส่วนที่ 4.1: ช่องพิมพ์ข้อความ ---
    const customInputContainer = document.createElement('div');
    customInputContainer.id = 'custom-input-container';
    customInputContainer.style.cssText = `
        display: ${isCustomMessageOnCooldown() ? 'none' : 'flex'}; 
        align-items: center; background: rgba(0, 0, 0, 0.75); border: 1px solid rgba(0, 255, 204, 0.4);
        border-radius: 20px; padding: 4px 10px; backdrop-filter: blur(4px); box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    `;

    const inputMsg = document.createElement('input');
    inputMsg.type = 'text'; 
    inputMsg.maxLength = 50; 
    inputMsg.placeholder = 'ข้อความอธิษฐาน (50 ตัวอักษร)...'; 
    inputMsg.style.cssText = `background: transparent; border: none; color: #00ffcc; padding: 6px; font-family: 'Sarabun', sans-serif; font-size: 14px; width: 220px; outline: none;`;

    const sendBtn = document.createElement('button');
    sendBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="white" style="margin-right: 2px;"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
    sendBtn.style.cssText = `background: #0084ff; border: none; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.1s; margin-left: 5px;`;
    sendBtn.onmousedown = () => sendBtn.style.transform = 'scale(0.9)';
    sendBtn.onmouseup = () => sendBtn.style.transform = 'scale(1)';

    sendBtn.onclick = () => {
        const text = inputMsg.value.trim();
        if (!text) return;
        
        if (canSendCustomMessage()) {
            sendReaction(`✨ ${text}`, true); 
            inputMsg.value = '';
            
            // [ปรับแต่งได้: ซ่อนกล่องพิมพ์ และสั่งให้กลับมาแสดงผลใหม่ตามเวลาคูลดาวน์]
            customInputContainer.style.display = 'none'; 
            
            setTimeout(() => {
                customInputContainer.style.display = 'flex'; // เด้งกลับมาอัตโนมัติ
            }, COOLDOWN_CUSTOM_MSG);
        }
    };
    inputMsg.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendBtn.onclick(); });

    customInputContainer.appendChild(inputMsg);
    customInputContainer.appendChild(sendBtn);
    controlsWrapper.appendChild(customInputContainer);

    // --- ส่วนที่ 4.2: แคปซูลปุ่มอิโมจิฟิกซ์ ---
    const emojiContainer = document.createElement('div');
    emojiContainer.style.cssText = `display: flex; background: rgba(0, 0, 0, 0.65); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 30px; overflow: hidden; backdrop-filter: blur(4px); box-shadow: 0 4px 10px rgba(0,0,0,0.3);`;
    
    Object.entries(reactionTypes).forEach(([key, text], index) => {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.cssText = `background: transparent; border: none; color: #fff; border-right: ${index < 2 ? '1px solid rgba(255, 255, 255, 0.2)' : 'none'}; padding: 8px 16px; font-family: 'Sarabun', sans-serif; font-size: 14px; cursor: pointer; transition: background 0.2s;`;
        btn.onmouseover = () => btn.style.background = 'rgba(255, 152, 0, 0.8)'; 
        btn.onmouseout = () => btn.style.background = 'transparent';
        btn.onclick = () => { if (canSendFixedEmoji()) sendReaction(text, false); };
        emojiContainer.appendChild(btn);
    });
    controlsWrapper.appendChild(emojiContainer);
}

// ==========================================
// อัปเดตความโปร่งใสของข้อความที่อยู่บนสุด (เก่าสุด)
// ==========================================
function updateFeedFading() {
    const container = document.getElementById('floating-reactions-container');
    if (!container) return;
    const children = container.children;
    
    while (children.length > MAX_MESSAGES) {
        container.removeChild(children[0]);
    }

    for (let i = 0; i < children.length; i++) {
        children[i].style.opacity = '1'; 
    }
    
    if (children.length >= MAX_MESSAGES - 1) {
        children[0].style.opacity = '0.3'; 
        children[1].style.opacity = '0.7'; 
    } else if (children.length === MAX_MESSAGES - 2) {
        children[0].style.opacity = '0.5';
    }
}

// ==========================================
// การแสดงผลข้อความลอย (ฟีดแชท)
// ==========================================
function showFloatingReaction(text, senderName, isCustom = false) {
    const container = document.getElementById('floating-reactions-container');
    if (!container) return;

    const el = document.createElement('div');
    const nameColor = isCustom ? '#00ffcc' : '#ff9800'; 
    el.innerHTML = `<span>${text}</span><span style="color: ${nameColor}; font-weight: bold; margin-left: 8px; font-size: 13px;"> - ${senderName}</span>`;
    
    el.style.cssText = `
        background: rgba(0, 0, 0, 0.7); color: #fff; padding: 6px 14px;
        border-radius: 20px; border-left: 3px solid ${nameColor};
        font-family: 'Sarabun', sans-serif; font-size: 14px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8); backdrop-filter: blur(4px);
        opacity: 0; transform: translateY(10px); transition: all 0.4s ease; align-self: flex-start;
        display: flex; align-items: center;
    `;
    container.appendChild(el); 

    requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0px)';
        updateFeedFading();
    });

    setTimeout(() => { 
        if (el.parentNode) {
            el.style.opacity = '0'; 
            setTimeout(() => {
                if (el.parentNode) {
                    el.remove();
                    updateFeedFading(); 
                }
            }, 400); 
        }
    }, MSG_LIFETIME); 
}

// ==========================================
// ส่งข้อมูลเข้าฐานข้อมูล Firebase
// ==========================================
// --- แก้ไขฟังก์ชัน sendReaction ---
// ค้นหาฟังก์ชัน: function sendReaction(reactionText, isCustom = false)
// แล้วแก้ไขให้เป็น:

function sendReaction(reactionText, isCustom = false) {
    // แนบชื่อห้องต่อท้ายชื่อผู้ใช้
    const taggedName = `${currentUser} (${window.currentZoneName})`; 

    // แสดงข้อความแชทบนจอ (ใช้ชื่อที่ต่อท้ายด้วยห้องแล้ว)
    showFloatingReaction(reactionText, taggedName, isCustom);
    
    if (firebaseDb && currentRoomId) {
        push(ref(firebaseDb, `rooms/${currentRoomId}/reactions`), { 
            text: reactionText, 
            sender: taggedName, // ส่งชื่อที่ต่อท้ายด้วยห้องขึ้น Firebase
            isCustom: isCustom, 
            timestamp: Date.now() 
        });
    }
}

// ==========================================
// ระบบ AI Bots สุ่มกดความรู้สึก
// ==========================================
function startBotReactions() {
    if (botReactionInterval) clearTimeout(botReactionInterval);
    function triggerBot() {
        if (activeBots.length > 0) {
            const keys = Object.keys(reactionTypes);
            showFloatingReaction(reactionTypes[keys[Math.floor(Math.random() * keys.length)]], activeBots[Math.floor(Math.random() * activeBots.length)], false);
        }
        botReactionInterval = setTimeout(triggerBot, Math.floor(Math.random() * 10000) + 15000);
    }
    botReactionInterval = setTimeout(triggerBot, 5000);
}

// ==========================================
// Exports สำหรับให้ไฟล์อื่นเรียกใช้
// ==========================================
export function initEngagingSystem(db, userName) {
    firebaseDb = db; currentUser = userName; createReactionUI();
}

export function updateEngagingContext(roomId, botNamesList) {
    currentRoomId = roomId; activeBots = botNamesList; 
    if (firebaseDb && currentRoomId) {
        const now = Date.now();
        onChildAdded(ref(firebaseDb, `rooms/${currentRoomId}/reactions`), (snapshot) => {
            const data = snapshot.val();
            
            // 🔍 [แก้ไขจุดนี้]: เปลี่ยนมาเช็คว่า sender ไม่ได้ขึ้นต้นด้วยชื่อของเรา
            if (data.timestamp >= now && !data.sender.startsWith(currentUser)) {
                showFloatingReaction(data.text, data.sender, data.isCustom);
            }
        });
    }
    startBotReactions();
}

export function toggleReactionUI(isVisible) {
    const container = document.getElementById('reaction-ui-container');
    if (container) container.style.display = isVisible ? 'flex' : 'none';
}