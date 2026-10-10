// config.js
export const appConfig = {
    // -----------------------------------
    // 1. ตั้งค่าวิดีโอ YouTube
    // -----------------------------------
    youtube: {
        standbyUrl: "https://www.youtube.com/embed/ST6FSkpYrGs",
        morningUrl: "https://www.youtube.com/embed/OnwLu4x0WOA",
        eveningUrl: "https://www.youtube.com/embed/pPZ20jq8UaU",
        
        // เวลาออกอากาศ (คำนวณเป็นนาที: เช่น 04:00 คือ 4 * 60 = 240)
        morningStart: 240,   // 04:00 น.
        morningEnd: 330,     // 05:30 น.
        eveningStart: 1080,  // 18:00 น.
        eveningEnd: 1170     // 19:30 น.
    },

    // -----------------------------------
    // 2. ข้อมูลบอร์ดประชาสัมพันธ์ (กระดานสะพานบุญ)
    // -----------------------------------
    prBoard: {
        title: "📢 กระดานสะพานบุญ",
        
        scheduleTitle: "📺 ตารางออกอากาศ (เสียงสวดมนต์)",
        scheduleLines: [
            "• ทำวัตรเช้า  : 04:00 - 05:30 น.",
            "• ทำวัตรเย็น  : 18:00 - 19:30 น.",
            "• นอกเวลา  : เสียงสแตนด์บาย (วัดท่าซุง)"
        ],

        contactTitle: "📌 พื้นที่ฝากข่าวบอกบุญ",
        contactLines: [
            "หากกัลยาณมิตรท่านใดมีความประสงค์",
            "ต้องการประชาสัมพันธ์โครงการเพื่อพระพุทธศาสนา",
            "สามารถติดต่อแอดมินเพื่อขอลงประกาศได้ ฟรี!"
        ],

        contactBoxTitle: "💬 ติดต่อแอดมิน (Line ID / เบอร์โทร)",
        contactPhone: "0926533228"
    }
};