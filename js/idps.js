// ==========================================
// ระบบ IDPS (ID & Profile Persistence System)
// ==========================================

// 1. ฟังก์ชันตรวจจับช่องทางการเข้าถึง (Channel Detection)
function detectChannelTag() {
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    // เช็คว่าเป็น In-App Browser ของ LINE หรือ Facebook หรือไม่
    if (ua.indexOf("Line") > -1) return "_ln";
    if (ua.indexOf("FBAV") > -1 || ua.indexOf("FBAN") > -1) return "_fb";
    return "_web"; // บราวเซอร์ปกติ (Chrome, Safari ฯลฯ)
}

// 2. ฟังก์ชันหลักสำหรับดึงหรือสร้างข้อมูลผู้ใช้ (ทำงานตอนเปิดเว็บ)
export function initIDPS(defaultBaseName = "กัลยาณมิตร") {
    const channelTag = detectChannelTag();

    // 2.1 ตรวจสอบหรือสร้าง User ID ประจำเครื่อง (ไม่ซ้ำกันแน่นอน)
    let userId = localStorage.getItem('app_user_id');
    if (!userId) {
        userId = 'u_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
        localStorage.setItem('app_user_id', userId);
    }

    // 2.2 ตรวจสอบหรือสร้างชื่อผู้ใช้
    let userName = localStorage.getItem('app_user_name');
    if (!userName) {
        const randomNum = Math.floor(Math.random() * 900) + 100;
        // ชื่อเริ่มต้นจะห้อยท้ายด้วย Tag เสมอ เช่น กัลยาณมิตร777_ln
        userName = `${defaultBaseName}${randomNum}${channelTag}`;
        localStorage.setItem('app_user_name', userName);
    }

    return { userId, userName, channelTag };
}

// 3. ฟังก์ชันเปลี่ยนชื่อ (จำกัด 1 ครั้งต่อวัน)
export function changeUserName(newName, channelTag) {
    const todayStr = new Date().toISOString().split('T')[0]; // ได้ฟอร์แมต YYYY-MM-DD
    const lastChangeDate = localStorage.getItem('app_last_name_change_date');

    // เช็คว่าวันนี้เคยเปลี่ยนไปแล้วหรือยัง
    if (lastChangeDate === todayStr) {
        return { 
            success: false, 
            message: "⏳ คุณได้เปลี่ยนชื่อในวันนี้ไปแล้ว กรุณาเปลี่ยนใหม่อีกครั้งในวันพรุ่งนี้ครับ" 
        };
    }

    // ป้องกันคนตั้งชื่อยาวเกินไป และบังคับห้อย Tag เสมอเพื่อกันสับสน
    let safeName = newName.substring(0, 15).trim(); 
    if (!safeName.endsWith(channelTag)) {
        safeName = `${safeName}${channelTag}`;
    }
    
    // บันทึกชื่อใหม่และวันที่ลงเครื่อง
    localStorage.setItem('app_user_name', safeName);
    localStorage.setItem('app_last_name_change_date', todayStr);

    return { 
        success: true, 
        message: "✨ เปลี่ยนชื่อสำเร็จเรียบร้อยครับ!",
        newName: safeName
    };
}