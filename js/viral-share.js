// js/viral-share.js

const greetings = [
    "สวัสดีกัลยาณมิตรทุกท่าน{p} 🙏",
    "ทักทายสายบุญทุกท่าน{p} ✨",
    "วันนี้นำสิ่งดีๆ และความสงบมาฝาก{p} 🌿",
    "สวัสดี{p} ใครที่กำลังมองหาที่พักใจ เชิญทางนี้เลย 🤍",
    "แวะเอาบุญมาฝาก และชวนมาทำสมาธิด้วยกัน{p} 🧘‍♂️"
];

const intros = [
    "{pronoun}ชื่อ {name} นะ{pa}",
    "นี่ {name} เอง{p}",
    "{pronoun} {name} อยากมาแชร์ประสบการณ์ดีๆ",
    "{name} เพิ่งไปเจอของดีมา เลยอยากบอกต่อ{p}"
];

const hooks = [
    "ตอนนี้{pronoun}กำลังใช้งาน 'ลานปฏิบัติธรรมออนไลน์ 3D' อยู่ มันสงบและสมจริงมากๆ เหมือนได้ไปนั่งที่วัดจริงๆ เลย",
    "ใครจะไปคิดว่าเราสามารถเดินชมนิทรรศการ 31 ภพภูมิ และทำสมาธิในโลกเสมือนจริง (VR) ผ่านมือถือได้แล้ว!",
    "อยากชวนทุกคนมาลองเปิดประสบการณ์ใหม่ ทำสมาธิเจริญสติแบบ 360 องศา สวยงามและร่มเย็นมาก{p}",
    "ช่วงนี้ใครเครียดๆ ลองเข้ามาเดินเล่นในวิหารธรรมออนไลน์ดูนะ{pa} มีเสียงธรรมะบรรยาย ช่วยให้ใจนิ่งขึ้นเยอะเลย"
];

const quotes = [
    "💡 'ใจที่สงบ คือร่มเงาที่ร่มเย็นที่สุด'",
    "💡 'หยุดคิดจิตสงบ พบความสุขที่แท้จริง'",
    "💡 'เทคโนโลยีเชื่อมโลก ธรรมะเชื่อมใจ'",
    "💡 'แค่หลับตาทำสมาธิ โลกที่วุ่นวายก็เปลี่ยนไป'",
    "💡 'บุญกุศลอยู่ที่ใจ ทำได้ทุกที่ทุกเวลา'"
];

const hashtagSets = [
    "#สมาธิออนไลน์ #วิหารธรรมVR #ธรรมะบำบัด",
    "#31ภพภูมิ #สายบุญ #ทำบุญยุคดิจิทัล",
    "#WebXR #โลกเสมือนจริง #สงบจิตสงบใจ",
    "#เจริญสติ #ธรรมะจัดสรร #VRสมาธิ"
];

function getRandom(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// ฟังก์ชันหลักสร้างข้อความ โดยรับ พารามิเตอร์: ชื่อ, ลิงก์ และ เพศ
export function generateViralShareText(userName, link, gender) {
    // กำหนดคำลงท้ายตามเพศ (M = ชาย, F = หญิง)
    const p = (gender === 'F') ? 'ค่ะ' : 'ครับ';
    const pa = (gender === 'F') ? 'คะ' : 'ครับ';
    const pronoun = (gender === 'F') ? 'ฉัน' : 'ผม';

    // สุ่มส่วนประกอบและแทนที่คำสั่ง {p}, {pa}, {pronoun}, {name}
    let greeting = getRandom(greetings).replace(/{p}/g, p).replace(/{pa}/g, pa).replace(/{pronoun}/g, pronoun);
    let intro = getRandom(intros).replace(/{name}/g, userName).replace(/{p}/g, p).replace(/{pa}/g, pa).replace(/{pronoun}/g, pronoun);
    let hook = getRandom(hooks).replace(/{p}/g, p).replace(/{pa}/g, pa).replace(/{pronoun}/g, pronoun);
    let quote = getRandom(quotes);
    let hashtags = getRandom(hashtagSets);

    // ประกอบข้อความทั้งหมดเข้าด้วยกัน
    return `${greeting}\n\n${intro} ${hook}\n\n${quote}\n\n👇 ลองเข้ามาสัมผัสด้วยตัวเองได้ที่ลิ้งค์นี้เลย${p}:\n${link}\n\n${hashtags}`;
}