import { generateViralShareText } from './viral-share.js';

// ==========================================
// 🎨 1. คลังสีและข้อมูลอวตาร
// ==========================================
export const skinPalettes = [
    { color: 0xffdfc4, emissive: 0x8a6b51 },
    { color: 0xf0d5b6, emissive: 0x8a6b51 },
    { color: 0xd2a171, emissive: 0x6b4c31 },
    { color: 0x8d5524, emissive: 0x3d230e },
    { color: 0x4a2a18, emissive: 0x1a0f0a }
];
export const hairColors = [0x111111, 0x2b1d14, 0x4a3123, 0xccaa55, 0x8c3310, 0xdddddd];
export const shirtColors = [0xffffff, 0xffffff, 0xf5f5dc, 0xcce0ff, 0xd4f0d4, 0xffe6e6, 0xdddddd];
export const pantsColors = [0xffffff, 0xffffff, 0x333333, 0x555555, 0x8b5a2b, 0x2c3e50];

// ดึงสีอวตารจากเครื่องผู้ใช้
export function loadMyAvatarColors() {
    let colors = JSON.parse(localStorage.getItem('myAvatarColors'));
    if (!colors || !colors.gender) {
        colors = generateRandomColors('M'); // ค่าเริ่มต้นถ้าไม่มี
    }
    return colors;
}

// สุ่มสีอวตารใหม่
export function generateRandomColors(targetGender) {
    const colors = {
        skin: skinPalettes[Math.floor(Math.random() * skinPalettes.length)],
        hair: hairColors[Math.floor(Math.random() * hairColors.length)],
        shirt: shirtColors[Math.floor(Math.random() * shirtColors.length)],
        pants: pantsColors[Math.floor(Math.random() * pantsColors.length)],
        isLongHair: targetGender === 'F' ? (Math.random() > 0.3) : (Math.random() > 0.7),
        gender: targetGender
    };
    localStorage.setItem('myAvatarColors', JSON.stringify(colors));
    return colors;
}

// ==========================================
// 🔗 2. ระบบแชร์และคัดลอกลิงก์
// ==========================================
let regenTimestamps = [];
const MAX_REGEN_PER_MIN = 12;

export function updateSharePreview(userName, userId, gender, checkLimit = true) {
    const shareInput = document.getElementById('share-link-input');
    if (shareInput && !shareInput.value.includes(userId)) {
        shareInput.value = `https://winaiac.github.io/vr/?ref=${userId}`;
    }
    
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
    
    const link = shareInput ? shareInput.value : '';
    const viralMessage = generateViralShareText(userName, link, gender);
    const previewEl = document.getElementById('share-text-preview');
    if (previewEl) previewEl.value = viralMessage;
}

// ตั้งค่าปุ่มแชร์
export function initShareSystem(getCurrentUserName, userId, getCurrentGender) {
    const regenBtn = document.getElementById('regen-share-btn');
    if (regenBtn) {
        regenBtn.addEventListener('click', () => {
            updateSharePreview(getCurrentUserName(), userId, getCurrentGender(), true);
        });
    }

    const copyBtn = document.getElementById('copy-link-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const previewEl = document.getElementById('share-text-preview');
            if (previewEl) {
                previewEl.select();
                navigator.clipboard.writeText(previewEl.value).then(showCopySuccess).catch(err => {
                    document.execCommand('copy'); showCopySuccess();
                });
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
}