import * as THREE from 'three';

export function createMeditatorAvatar() {
    const group = new THREE.Group();

    // ==========================================
    // 1. ชุดสี (Palettes) สำหรับฆราวาส (ประชาชนทั่วไป)
    // ==========================================
    
    const skinPalettes = [
        { color: 0xffdfc4, emissive: 0x8a6b51 }, // ฝรั่ง / ผิวขาวอมชมพู
        { color: 0xf0d5b6, emissive: 0x8a6b51 }, // เอเชีย / ขาวเหลือง
        { color: 0xd2a171, emissive: 0x6b4c31 }, // ไทย / ผิวสองสี
        { color: 0x8d5524, emissive: 0x3d230e }, // ลาติน / ผิวแทนเข้ม
        { color: 0x4a2a18, emissive: 0x1a0f0a }  // แอฟริกัน / ผิวเข้มมาก
    ];
    
    const hairColors = [
        0x111111, // ดำเข้ม
        0x2b1d14, // น้ำตาลเข้ม
        0x4a3123, // น้ำตาลอ่อน
        0xccaa55, // บลอนด์ทอง
        0x8c3310, // แดง/ออเบิร์น
        0xdddddd  // สีดอกเลา/เทาขาว
    ];

    // สีเสื้อ: เน้นชุดขาวปฏิบัติธรรม และชุดสีสุภาพ (ลบสีจีวรออก)
    const shirtColors = [
        0xffffff, 0xffffff, 0xffffff, // โอกาสได้ชุดขาวเยอะที่สุด
        0xf5f5dc, // เบจ/ครีม
        0xcce0ff, // ฟ้าอ่อน
        0xd4f0d4, // เขียวพาสเทล
        0xffe6e6, // ชมพูอ่อน
        0xdddddd  // เทาอ่อน
    ];

    // สีกางเกง: ชุดขาว และสีกางเกงทั่วไป (ลบสีจีวรออก)
    const pantsColors = [
        0xffffff, 0xffffff, 0xffffff, // ชุดขาวเข้าชุด
        0x333333, // ดำ
        0x555555, // เทาเข้ม
        0x8b5a2b, // น้ำตาล
        0x2c3e50  // กรมท่า
    ];

    // ==========================================
    // 2. สุ่มเลือกสีสำหรับบอทฆราวาส
    // ==========================================
    const mySkin = skinPalettes[Math.floor(Math.random() * skinPalettes.length)];
    const myHair = hairColors[Math.floor(Math.random() * hairColors.length)];
    const myShirt = shirtColors[Math.floor(Math.random() * shirtColors.length)];
    const myPants = pantsColors[Math.floor(Math.random() * pantsColors.length)];
    
    const skinMat = new THREE.MeshStandardMaterial({ 
        color: mySkin.color, emissive: mySkin.emissive, emissiveIntensity: 0.3, roughness: 0.5, metalness: 0.1 
    });
    
    const shirtMat = new THREE.MeshStandardMaterial({ 
        color: myShirt, emissive: myShirt, emissiveIntensity: 0.15, roughness: 0.8, metalness: 0.0 
    });

    const pantsMat = new THREE.MeshStandardMaterial({ 
        color: myPants, emissive: myPants, emissiveIntensity: 0.1, roughness: 0.9, metalness: 0.0 
    });

    const hairMat = new THREE.MeshStandardMaterial({
        color: myHair, roughness: 0.9, metalness: 0.0
    });

    // ==========================================
    // 3. ประกอบร่างโมเดล
    // ==========================================

    const pelvisGeo = new THREE.SphereGeometry(0.28, 32, 16);
    const pelvis = new THREE.Mesh(pelvisGeo, pantsMat);
    pelvis.scale.set(1.3, 0.4, 1.0);
    pelvis.position.set(0, 0.12, 0.05);
    group.add(pelvis);

    const kneeGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const leftKnee = new THREE.Mesh(kneeGeo, pantsMat);
    leftKnee.position.set(-0.28, 0.08, 0.12);
    leftKnee.scale.set(1.0, 0.7, 1.0);
    group.add(leftKnee);
    
    const rightKnee = new THREE.Mesh(kneeGeo, pantsMat);
    rightKnee.position.set(0.28, 0.08, 0.12);
    rightKnee.scale.set(1.0, 0.7, 1.0);
    group.add(rightKnee);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.30, 16), shirtMat);
    torso.position.set(0, 0.31, 0);
    group.add(torso);

    const shoulderGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const leftShoulder = new THREE.Mesh(shoulderGeo, shirtMat);
    leftShoulder.position.set(-0.14, 0.42, 0);
    group.add(leftShoulder);
    
    const rightShoulder = new THREE.Mesh(shoulderGeo, shirtMat);
    rightShoulder.position.set(0.14, 0.42, 0);
    group.add(rightShoulder);

    const upperArmGeo = new THREE.CapsuleGeometry(0.035, 0.14, 4, 8);
    const leftUpperArm = new THREE.Mesh(upperArmGeo, shirtMat);
    leftUpperArm.position.set(-0.15, 0.32, 0.02);
    leftUpperArm.rotation.z = -0.15; leftUpperArm.rotation.x = 0.15; 
    group.add(leftUpperArm);

    const rightUpperArm = new THREE.Mesh(upperArmGeo, shirtMat);
    rightUpperArm.position.set(0.15, 0.32, 0.02);
    rightUpperArm.rotation.z = 0.15; rightUpperArm.rotation.x = 0.15;
    group.add(rightUpperArm);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.08, 16), skinMat);
    neck.position.set(0, 0.48, 0);
    group.add(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 32), skinMat);
    head.position.set(0, 0.58, 0);
    group.add(head);

    const lowerArmGeo = new THREE.CapsuleGeometry(0.03, 0.15, 4, 8);
    const leftLowerArm = new THREE.Mesh(lowerArmGeo, skinMat);
    leftLowerArm.position.set(-0.08, 0.20, 0.13);
    leftLowerArm.rotation.z = -1.0; leftLowerArm.rotation.x = 1.2;  
    group.add(leftLowerArm);

    const rightLowerArm = new THREE.Mesh(lowerArmGeo, skinMat);
    rightLowerArm.position.set(0.08, 0.20, 0.13);
    rightLowerArm.rotation.z = 1.0; rightLowerArm.rotation.x = 1.2;
    group.add(rightLowerArm);

    const handGeo = new THREE.SphereGeometry(0.04, 16, 16);
    const hands = new THREE.Mesh(handGeo, skinMat); 
    hands.scale.set(1.5, 0.5, 1.0); 
    hands.position.set(0, 0.17, 0.18);
    group.add(hands);

    // บังคับให้ทุกคนมีผม (ฆราวาส)
    const hairGeo = new THREE.SphereGeometry(0.115, 32, 16, 0, Math.PI * 2, 0, Math.PI / 1.7);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 0.58, 0);
    hair.rotation.x = -0.15; 
    hair.rotation.z = (Math.random() - 0.5) * 0.2; 
    group.add(hair);

    group.rotation.y = Math.PI;

    return group;
}