import { ref, push, onChildAdded } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

// State
let firebaseDb = null;
let currentRoomId = null;
let currentUser = "กัลยาณมิตร";
let activeBots = [];
let botReactionInterval = null;

const reactionTypes = {
    'sathu': '🙏 สาธุ',
    'good': '👍 ดีมากเลย',
    'heart': '❤️ สุดยอดเลย'
};

// 1. สร้าง UI ปุ่มกดบนหน้าจอ (แบบรวมเป็นแคปซูลเดียว)
function createReactionUI() {
    const container = document.createElement('div');
    container.id = 'reaction-ui-container';
    container.style.position = 'absolute';
    container.style.bottom = 'clamp(30px, 4vh, 50px)'; 
    container.style.left = 'clamp(10px, 2vw, 20px)';  
    container.style.display = 'flex';
    container.style.flexDirection = 'row'; 
    container.style.zIndex = '999';
    container.style.pointerEvents = 'auto';

    // เปลี่ยนมาตั้งค่ากรอบและพื้นหลังให้ Container แทน (เพื่อให้เป็นแคปซูลเดียว)
    container.style.background = 'rgba(0, 0, 0, 0.5)';
    container.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    container.style.borderRadius = '30px'; // ขอบมนเป็นแคปซูล
    container.style.overflow = 'hidden'; // ป้องกันไม่ให้สีปุ่มตอนชี้เมาส์ล้นกรอบมน
    container.style.backdropFilter = 'blur(4px)';

    const entries = Object.entries(reactionTypes);
    entries.forEach(([key, text], index) => {
        const btn = document.createElement('button');
        btn.innerText = text;
        btn.style.background = 'transparent'; // ให้ปุ่มโปร่งใสเพื่อโชว์สีแคปซูล
        btn.style.color = '#fff';
        btn.style.border = 'none'; // ลบกรอบปุ่มแต่ละอันออก
        
        // ขีดเส้นคั่นบางๆ ระหว่างปุ่ม (ยกเว้นปุ่มสุดท้าย)
        if (index < entries.length - 1) {
            btn.style.borderRight = '1px solid rgba(255, 255, 255, 0.2)';
        }

        btn.style.padding = '8px 18px';
        btn.style.fontFamily = 'Sarabun, sans-serif';
        btn.style.fontSize = '14px';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'background 0.2s'; // เปลี่ยนแค่สีพื้นหลังตอน Hover ไม่ต้องซูมปุ่มเดี๋ยวกรอบแตก

        btn.onmouseover = () => {
            btn.style.background = 'rgba(255, 152, 0, 0.8)'; // สว่างขึ้นตอนชี้เมาส์
        };
        btn.onmouseout = () => {
            btn.style.background = 'transparent';
        };
        
        btn.onclick = () => sendReaction(text);
        
        container.appendChild(btn);
    });

    document.body.appendChild(container);
    
    // คอนเทนเนอร์สำหรับข้อความลอยขึ้น 
    const floatingContainer = document.createElement('div');
    floatingContainer.id = 'floating-reactions-container';
    floatingContainer.style.position = 'absolute';
    floatingContainer.style.bottom = '80px'; 
    floatingContainer.style.left = 'clamp(10px, 2vw, 20px)';
    floatingContainer.style.width = '300px'; 
    floatingContainer.style.height = '60vh'; // ยืดหยุ่นตามหน้าจอ
    floatingContainer.style.pointerEvents = 'none'; 
    floatingContainer.style.zIndex = '998';
    floatingContainer.style.overflow = 'hidden';
    document.body.appendChild(floatingContainer);
}

function showFloatingReaction(text, senderName) {
    const container = document.getElementById('floating-reactions-container');
    if (!container) return;

    const el = document.createElement('div');
    el.innerText = `${text} - ${senderName}`;
    
    el.style.position = 'absolute';
    el.style.bottom = '0px';
    
    // สุ่มตำแหน่งซ้ายขวานิดหน่อยให้ดูเป็นธรรมชาติ ไม่ซ้อนกันตรงๆ
    const randomOffset = Math.floor(Math.random() * 50); 
    el.style.left = `${randomOffset}px`;
    
    el.style.background = 'rgba(0, 0, 0, 0.4)';
    el.style.color = '#fff';
    el.style.padding = '6px 14px';
    el.style.borderRadius = '20px';
    el.style.fontFamily = 'Sarabun, sans-serif';
    el.style.fontSize = '14px';
    el.style.fontWeight = 'bold';
    el.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    el.style.border = '1px solid rgba(255,255,255,0.2)';
    el.style.backdropFilter = 'blur(4px)';
    
    el.style.transition = 'transform 3s ease-out, opacity 3s ease-out';
    el.style.transform = 'translateY(0px) scale(0.5)';
    el.style.opacity = '0';
    
    container.appendChild(el);

    // บังคับให้เบราว์เซอร์รับรู้จุดเริ่มต้นก่อน (Force Reflow) แก้ปัญหาบอทวาร์ปไม่ยอมค่อยๆ ลอย
    void el.offsetWidth; 

    // คำนวณระยะลอยขึ้นอัตโนมัติ (ให้ลอยขึ้นไป 40% ของความสูงหน้าจอ แต่สูงสุดไม่เกิน 350px)
    const floatDistance = Math.min(350, window.innerHeight * 0.4);

    requestAnimationFrame(() => {
        el.style.transform = `translateY(-${floatDistance}px) scale(1.1)`;
        el.style.opacity = '1';
        setTimeout(() => { el.style.opacity = '0'; }, 2000); 
    });

    setTimeout(() => { el.remove(); }, 3000); // ลบทิ้งกันรก DOM
}

function sendReaction(reactionText) {
    // 1. โชว์ของตัวเองขึ้นจอก่อนเลยจะได้รู้สึกว่าระบบทำงานไว
    showFloatingReaction(reactionText, currentUser);
    
    // 2. ส่งไปบอกคนอื่นในห้องผ่าน Firebase
    if (firebaseDb && currentRoomId) {
        const refPath = ref(firebaseDb, `rooms/${currentRoomId}/reactions`);
        push(refPath, { text: reactionText, sender: currentUser, timestamp: Date.now() });
    }
}

function startBotReactions() {
    if (botReactionInterval) clearTimeout(botReactionInterval);
    
    // ระบบสุ่มให้บอทมากดอิโมจิ
    function triggerBot() {
        if (activeBots.length > 0) {
            const randomBot = activeBots[Math.floor(Math.random() * activeBots.length)];
            const keys = Object.keys(reactionTypes);
            const randomReaction = reactionTypes[keys[Math.floor(Math.random() * keys.length)]];
            showFloatingReaction(randomReaction, randomBot);
        }
        // สุ่มเวลาครั้งถัดไปให้อยู่ระหว่าง 5 - 15 วินาที
        const nextTime = Math.floor(Math.random() * 10000) + 5000;
        botReactionInterval = setTimeout(triggerBot, nextTime);
    }
    
    // เริ่มทำงานครั้งแรกหลังจากเข้าห้อง 5 วินาที
    botReactionInterval = setTimeout(triggerBot, 5000);
}

// --- ฟังก์ชันที่เปิดให้ไฟล์อื่น (main.js, ฯลฯ) ดึงไปใช้งาน ---

export function initEngagingSystem(db, userName) {
    firebaseDb = db;
    currentUser = userName;
    createReactionUI();
}

export function updateEngagingContext(roomId, botNamesList) {
    currentRoomId = roomId;
    activeBots = botNamesList; // อัปเดตรายชื่อบอทเพื่อให้ระบบ AI สุ่มเลือกมาพิมพ์
    
    if (firebaseDb && currentRoomId) {
        const refPath = ref(firebaseDb, `rooms/${currentRoomId}/reactions`);
        const now = Date.now();
        onChildAdded(refPath, (snapshot) => {
            const data = snapshot.val();
            // ถ้ามีคนกดและไม่ใช่ตัวเราเองกด ให้โชว์ลอยขึ้นมา
            if (data.timestamp >= now && data.sender !== currentUser) {
                showFloatingReaction(data.text, data.sender);
            }
        });
    }
    // เมื่อเปลี่ยนห้อง หรือเข้าห้อง ให้รีเซ็ตเวลาบอทใหม่
    startBotReactions();
}

export function toggleReactionUI(isVisible) {
    const container = document.getElementById('reaction-ui-container');
    if (container) {
        container.style.display = isVisible ? 'flex' : 'none';
    }
}