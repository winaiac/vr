import * as THREE from 'three';

// ==========================================
// 1. ฟังก์ชันสร้างข้อความบน Canvas (เสื้อ/ดวงจิต)
// ==========================================
function createNameTexture(nameText, baseColor, isOrb = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; 
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    const textColors = ['#ff0000', '#0000ff'];
    const selectedTextColor = textColors[Math.floor(Math.random() * textColors.length)];

    if (isOrb) {
        ctx.clearRect(0, 0, 1024, 256);
        ctx.fillStyle = '#ffffff'; 
        ctx.shadowColor = '#00ffcc'; 
        ctx.shadowBlur = 15;
    } else {
        ctx.fillStyle = `#${baseColor.toString(16).padStart(6, '0')}`;
        ctx.fillRect(0, 0, 1024, 256);
        
        ctx.fillStyle = selectedTextColor;       
        ctx.strokeStyle = '#ffffff';     
        ctx.lineWidth = 6;               
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)'; 
        ctx.shadowBlur = 8;              
        ctx.shadowOffsetX = 3;           
        ctx.shadowOffsetY = 3;           
    }
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let frontText = nameText;
    if (nameText.startsWith("กัลยาณมิตร")) {
        frontText = nameText.substring(10).trim(); 
        if (frontText === "") frontText = "G"; 
    } else {
        frontText = nameText.substring(0, 5).trim();
    }
    
    ctx.font = 'bold 80px Sarabun, sans-serif'; 
    if (!isOrb) ctx.strokeText(frontText, 256, 128); 
    ctx.fillText(frontText, 256, 128); 

    if (nameText.startsWith("กัลยาณมิตร")) {
        const line1 = "กัลยาณมิตร";
        const line2 = nameText.substring(10);
        
        ctx.font = 'bold 50px Sarabun, sans-serif';
        if (!isOrb) ctx.strokeText(line1, 768, 100);
        ctx.fillText(line1, 768, 100); 
        
        ctx.font = 'bold 60px Sarabun, sans-serif';
        if (!isOrb) ctx.strokeText(line2, 768, 165);
        ctx.fillText(line2, 768, 165); 
    } else {
        let fontSize = 70;
        if (nameText.length > 8) fontSize = 55;
        if (nameText.length > 12) fontSize = 45;
        
        ctx.font = `bold ${fontSize}px Sarabun, sans-serif`;
        if (!isOrb) ctx.strokeText(nameText, 768, 128);
        ctx.fillText(nameText, 768, 128); 
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true; 
    return texture;
}

// ==========================================
// 2. ฟังก์ชันหลักสร้างอวตาร
// ==========================================
export function createMeditatorAvatar(userName = "กัลยาณมิตร", customColors = null) {
    const group = new THREE.Group();
    group.userData = { 
        state: 'SIT', 
        isOrbMode: false,
        userName: userName,
        shirtColorHex: 0xffffff,
        customColors: null
    }; 

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

    const mySkin = (customColors && customColors.skin) ? customColors.skin : skinPalettes[Math.floor(Math.random() * skinPalettes.length)];
    const myHair = (customColors && customColors.hair) ? customColors.hair : hairColors[Math.floor(Math.random() * hairColors.length)];
    const myShirt = (customColors && customColors.shirt) ? customColors.shirt : shirtColors[Math.floor(Math.random() * shirtColors.length)];
    const myPants = (customColors && customColors.pants) ? customColors.pants : pantsColors[Math.floor(Math.random() * pantsColors.length)];
    
    const myIsLongHair = (customColors && customColors.isLongHair !== undefined) ? customColors.isLongHair : (Math.random() > 0.5);
    
    group.userData.customColors = { skin: mySkin, hair: myHair, shirt: myShirt, pants: myPants, isLongHair: myIsLongHair };

    group.userData.shirtColorHex = myShirt; 
    group.userData.skinMat = new THREE.MeshStandardMaterial({ color: mySkin.color, emissive: mySkin.emissive, emissiveIntensity: 0.3, roughness: 0.5 });
    group.userData.hairMat = new THREE.MeshStandardMaterial({ color: myHair, roughness: 0.9 });
    group.userData.pantsMat = new THREE.MeshStandardMaterial({ color: myPants, emissive: myPants, emissiveIntensity: 0.1, roughness: 0.9 });
    group.userData.shirtMatPlain = new THREE.MeshStandardMaterial({ color: myShirt, emissive: myShirt, emissiveIntensity: 0.15, roughness: 0.8 });

    const nameTexture = createNameTexture(userName, myShirt);
    group.userData.shirtMatNamed = new THREE.MeshStandardMaterial({ 
        color: myShirt, emissive: myShirt, emissiveIntensity: 0.15, roughness: 0.8, map: nameTexture 
    });

    const humanBodyGroup = new THREE.Group();
    humanBodyGroup.name = "humanBodyGroup";
    group.add(humanBodyGroup);

    // --- ช่วงล่าง (ท่านั่ง) ---
    const lowerBodySit = new THREE.Group();
    lowerBodySit.name = "lowerBodySit";
    
    const pelvisSit = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 16), group.userData.pantsMat);
    pelvisSit.scale.set(1.3, 0.4, 1.0);
    pelvisSit.position.set(0, 0.12, 0.05);
    lowerBodySit.add(pelvisSit);

    const leftKneeSit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), group.userData.pantsMat);
    leftKneeSit.position.set(-0.28, 0.08, 0.12);
    leftKneeSit.scale.set(1.0, 0.7, 1.0);
    lowerBodySit.add(leftKneeSit);
    
    const rightKneeSit = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 16), group.userData.pantsMat);
    rightKneeSit.position.set(0.28, 0.08, 0.12);
    rightKneeSit.scale.set(1.0, 0.7, 1.0);
    lowerBodySit.add(rightKneeSit);
    
    humanBodyGroup.add(lowerBodySit);

    // --- ช่วงล่าง (ท่ายืน) ---
    const lowerBodyStand = new THREE.Group();
    lowerBodyStand.name = "lowerBodyStand";
    lowerBodyStand.visible = false; 

    const pelvisStand = new THREE.Mesh(new THREE.SphereGeometry(0.18, 32, 16), group.userData.pantsMat);
    pelvisStand.scale.set(1.1, 0.5, 0.9); 
    pelvisStand.position.set(0, 0.28, 0); 
    lowerBodyStand.add(pelvisStand);

    const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 16, 16), group.userData.pantsMat);
    leftLeg.position.set(-0.08, 0.15, 0); 
    lowerBodyStand.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 16, 16), group.userData.pantsMat);
    rightLeg.position.set(0.08, 0.15, 0); 
    lowerBodyStand.add(rightLeg);

    humanBodyGroup.add(lowerBodyStand);

    // --- ลำตัว ---
    const upperBodyGroup = new THREE.Group();
    upperBodyGroup.name = "upperBodyGroup";
    humanBodyGroup.add(upperBodyGroup);

    const torsoGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.30, 32);
    const uvs = torsoGeo.attributes.uv.array;
    for ( let i = 0; i < uvs.length; i += 2 ) {
        uvs[ i ] = ( uvs[ i ] + 0.25 ) % 1; 
    }
    const torso = new THREE.Mesh(torsoGeo, group.userData.shirtMatNamed);
    torso.position.set(0, 0.31, 0);
    torso.rotation.y = Math.PI; 
    upperBodyGroup.add(torso);

    // --- แขน ---
    const armsGroup = new THREE.Group();
    armsGroup.name = "armsGroup";
    upperBodyGroup.add(armsGroup);

    const leftShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), group.userData.shirtMatPlain);
    leftShoulder.position.set(-0.16, 0.40, 0);
    armsGroup.add(leftShoulder);
    
    const rightShoulder = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), group.userData.shirtMatPlain);
    rightShoulder.position.set(0.16, 0.40, 0);
    armsGroup.add(rightShoulder);

    const leftArmFull = new THREE.Group();
    leftArmFull.name = "leftArmFull";
    leftArmFull.position.set(-0.16, 0.40, 0); 
    armsGroup.add(leftArmFull);

    const leftUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.15, 8, 16), group.userData.shirtMatPlain);
    leftUpperArm.position.set(0, -0.09, 0);
    leftArmFull.add(leftUpperArm);

    const leftLowerArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.15, 8, 16), group.userData.skinMat);
    leftLowerArm.position.set(0, -0.24, 0); 
    leftArmFull.add(leftLowerArm);

    const leftHand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), group.userData.skinMat); 
    leftHand.scale.set(1.0, 1.2, 0.5); 
    leftHand.position.set(0, -0.34, 0); 
    leftArmFull.add(leftHand);

    const rightArmFull = new THREE.Group();
    rightArmFull.name = "rightArmFull";
    rightArmFull.position.set(0.16, 0.40, 0); 
    armsGroup.add(rightArmFull);

    const rightUpperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.15, 8, 16), group.userData.shirtMatPlain);
    rightUpperArm.position.set(0, -0.09, 0);
    rightArmFull.add(rightUpperArm);

    const rightLowerArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.15, 8, 16), group.userData.skinMat);
    rightLowerArm.position.set(0, -0.24, 0);
    rightArmFull.add(rightLowerArm);

    const rightHand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), group.userData.skinMat); 
    rightHand.scale.set(1.0, 1.2, 0.5); 
    rightHand.position.set(0, -0.34, 0);
    rightArmFull.add(rightHand);

    setArmPostureSit(leftArmFull, rightArmFull);

    // --- หัว ---
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.06, 16), group.userData.skinMat);
    neck.position.set(0, 0.48, 0);
    upperBodyGroup.add(neck);

    const headGroup = new THREE.Group();
    headGroup.name = "headGroup";
    headGroup.position.set(0, 0.58, 0);
    upperBodyGroup.add(headGroup);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 32, 32), group.userData.skinMat);
    headGroup.add(head);

    // ==========================================
    // [อัปเดต] ดวงตาแบบมีม่านตาสีสัน (แก้ระยะ Z ป้องกันตาจม 100%)
    const scleraMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }); 
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 }); 
    const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); 

    // สุ่มสีม่านตา (ฟ้า, เขียว, น้ำตาล)
    const eyeColors = [0x2c6b9e, 0x4a7c59, 0x5c3a21]; 
    const myEyeColor = eyeColors[Math.floor(Math.random() * eyeColors.length)];
    const irisMat = new THREE.MeshBasicMaterial({ color: myEyeColor });

    const scleraGeo = new THREE.SphereGeometry(0.012, 16, 16);    
    const irisGeo = new THREE.SphereGeometry(0.008, 16, 16);     
    const pupilGeo = new THREE.SphereGeometry(0.005, 16, 16);    
    const catchlightGeo = new THREE.SphereGeometry(0.0015, 8, 8); 

    function createDetailedEye(name, posX, rotY) {
        const eyeGroup = new THREE.Group();
        eyeGroup.name = name;
        
        eyeGroup.position.set(posX, 0.01, 0.103); 
        eyeGroup.rotation.y = rotY;
        eyeGroup.scale.set(1.2, 1.0, 0.15); 

        // 1. ตาขาว (จุดสูงสุดของความโค้งจะอยู่ที่ Z = 0.012)
        const sclera = new THREE.Mesh(scleraGeo, scleraMat);
        eyeGroup.add(sclera);

        // 2. ม่านตาสี (ดัน Z ออกมาที่ 0.011 เพื่อให้ทะลุผิวตาขาวขึ้นมา)
        const iris = new THREE.Mesh(irisGeo, irisMat);
        iris.position.set(0, 0, 0.011);
        iris.scale.set(1, 1, 0.3); 
        eyeGroup.add(iris);

        // 3. ตาดำ (ดัน Z ออกมาที่ 0.012 เพื่อให้ทับบนม่านตาอีกชั้น)
        const pupil = new THREE.Mesh(pupilGeo, pupilMat);
        pupil.position.set(0, 0, 0.012); 
        pupil.scale.set(1, 1, 0.3); 
        eyeGroup.add(pupil);

        // 4. ประกายตา (ดัน Z ออกมาที่ 0.013 ให้ลอยอยู่หน้าสุด)
        const catchlight = new THREE.Mesh(catchlightGeo, catchlightMat);
        catchlight.position.set(-0.003, 0.003, 0.013); 
        catchlight.scale.set(1, 1, 0.5);
        eyeGroup.add(catchlight);

        return eyeGroup;
    }

    const leftEye = createDetailedEye("leftEye", -0.04, -0.25);
    headGroup.add(leftEye);
    
    const rightEye = createDetailedEye("rightEye", 0.04, 0.25);
    headGroup.add(rightEye);
    // ==========================================

    const noseGeo = new THREE.ConeGeometry(0.015, 0.04, 16);
    const nose = new THREE.Mesh(noseGeo, group.userData.skinMat);
    nose.position.set(0, -0.01, 0.11);
    nose.rotation.x = Math.PI / 8;
    headGroup.add(nose);

    const lipMat = new THREE.MeshStandardMaterial({ color: 0x994444, roughness: 0.7 });
    const lipGeo = new THREE.CapsuleGeometry(0.005, 0.025, 4, 8);

    const mouth = new THREE.Mesh(lipGeo, lipMat);
    mouth.name = "mouth"; 
    mouth.position.set(0, -0.05, 0.10);
    mouth.rotation.z = Math.PI / 2;
    headGroup.add(mouth);

    const earGeo = new THREE.SphereGeometry(0.02, 16, 16);
    const leftEar = new THREE.Mesh(earGeo, group.userData.skinMat);
    leftEar.position.set(-0.11, 0, 0);
    leftEar.scale.set(0.5, 1.2, 0.8);
    headGroup.add(leftEar);
    
    const rightEar = new THREE.Mesh(earGeo, group.userData.skinMat);
    rightEar.position.set(0.11, 0, 0);
    rightEar.scale.set(0.5, 1.2, 0.8);
    headGroup.add(rightEar);

    const hairGeo = new THREE.SphereGeometry(0.115, 32, 16, 0, Math.PI * 2, 0, Math.PI / 1.9);
    const hair = new THREE.Mesh(hairGeo, group.userData.hairMat);
    hair.rotation.x = -0.15; 
    hair.position.y = 0.02; 
    headGroup.add(hair);

    if (myIsLongHair) {
        const longHairGeo = new THREE.CapsuleGeometry(0.08, 0.22, 16, 16);
        const longHair = new THREE.Mesh(longHairGeo, group.userData.hairMat);
        longHair.position.set(0, -0.14, -0.09); 
        longHair.rotation.x = -0.05; 
        headGroup.add(longHair);
    }

    // --- โหมดดวงจิต (Orb Mode) ---
    const orbGroup = new THREE.Group();
    orbGroup.name = "orbGroup";
    orbGroup.visible = false;
    group.add(orbGroup);

    const orbCoreMat = new THREE.MeshPhysicalMaterial({ 
        color: 0x88ccff, 
        emissive: 0x88ccff, 
        emissiveIntensity: 0.2, 
        transparent: true, 
        opacity: 0.5, 
        transmission: 0.9, 
        roughness: 0.1, 
        metalness: 0.1,
        ior: 1.5, 
        thickness: 0.5
    });
    const orbCore = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 32), orbCoreMat);
    orbCore.position.set(0, 0.3, 0);
    orbCore.name = "orbCore";
    orbGroup.add(orbCore);

    const orbNameTexture = createNameTexture(userName, 0xffffff, true);
    const orbNameMat = new THREE.SpriteMaterial({ 
        map: orbNameTexture, 
        transparent: true,
        depthTest: false 
    });
    
    orbNameTexture.repeat.set(0.5, 1);
    orbNameTexture.offset.set(0.5, 0); 
    
    const orbNameSprite = new THREE.Sprite(orbNameMat);
    orbNameSprite.scale.set(0.8, 0.2, 1); 
    orbNameSprite.position.set(0, 0.65, 0); 
    orbGroup.add(orbNameSprite);

    // ==========================================
    // [อัปเดต] ฝังระบบกระพริบตาอัตโนมัติ (Self-Blinking)
    group.userData.nextBlinkTime = Date.now() + Math.random() * 3000;
    group.userData.blinkEndTime = 0;
    group.userData.isBlinking = false;

    group.update = function() {
        if (group.userData.isOrbMode) return; 

        const now = Date.now();
        if (now > group.userData.nextBlinkTime) {
            group.userData.isBlinking = true;
            group.userData.blinkEndTime = now + 150; 
            group.userData.nextBlinkTime = now + 2000 + Math.random() * 4000; 
        }
        if (now > group.userData.blinkEndTime) {
            group.userData.isBlinking = false;
        }

        const targetScaleY = group.userData.isBlinking ? 0.1 : 1.0;
        if (leftEye) leftEye.scale.y += (targetScaleY - leftEye.scale.y) * 0.3;
        if (rightEye) rightEye.scale.y += (targetScaleY - rightEye.scale.y) * 0.3;
    };
    // ==========================================

    group.rotation.y = Math.PI;
    return group;
}

// ==========================================
// 3. ฟังก์ชันสลับท่าทางและโหมด
// ==========================================

function setArmPostureSit(leftArm, rightArm) {
    leftArm.rotation.set(-0.2, 0, -0.1); 
    leftArm.children[1].rotation.set(-1.2, 0.9, 0); 
    leftArm.children[1].position.set(0, -0.19, 0.1); 
    leftArm.children[2].rotation.set(-1.5, 0.9, 0); 
    leftArm.children[2].position.set(0, -0.26, 0.12); 
    
    rightArm.rotation.set(-0.2, 0, 0.1);
    rightArm.children[1].rotation.set(-1.2, 0.9, 0); 
    rightArm.children[1].position.set(0, -0.19, 0.1); 
    rightArm.children[2].rotation.set(-0.8, -0.4, 0); 
    rightArm.children[2].position.set(0, -0.26, 0.12); 
}

function setArmPostureStand(leftArm, rightArm) {
    leftArm.rotation.set(0, 0, -0.1); 
    leftArm.children[1].rotation.set(0, 0, 0); 
    leftArm.children[1].position.set(0, -0.24, 0); 
    leftArm.children[2].rotation.set(0, 0, 0);
    leftArm.children[2].position.set(0, -0.34, 0); 
    
    rightArm.rotation.set(0, 0, 0.1); 
    rightArm.children[1].rotation.set(0, 0, 0); 
    rightArm.children[1].position.set(0, -0.24, 0); 
    rightArm.children[2].rotation.set(0, 0, 0);
    rightArm.children[2].position.set(0, -0.34, 0); 
}

export function switchAvatarPosture(group, isStanding) {
    if (!group || group.userData.isOrbMode) return; 

    const lowerBodySit = group.getObjectByName("lowerBodySit");
    const lowerBodyStand = group.getObjectByName("lowerBodyStand");
    const upperBodyGroup = group.getObjectByName("upperBodyGroup");
    const leftArmFull = group.getObjectByName("leftArmFull");
    const rightArmFull = group.getObjectByName("rightArmFull");

    if (isStanding) {
        group.userData.state = 'STAND';
        if (lowerBodySit) lowerBodySit.visible = false;
        if (lowerBodyStand) lowerBodyStand.visible = true;
        if (upperBodyGroup) upperBodyGroup.position.y = 0.19; 
        if (leftArmFull && rightArmFull) setArmPostureStand(leftArmFull, rightArmFull);
    } else {
        group.userData.state = 'SIT';
        if (lowerBodySit) lowerBodySit.visible = true;
        if (lowerBodyStand) lowerBodyStand.visible = false;
        if (upperBodyGroup) upperBodyGroup.position.y = 0;
        if (leftArmFull && rightArmFull) setArmPostureSit(leftArmFull, rightArmFull);
    }
}

export function switchAvatarToOrb(group, realmColorHex, isOrbMode) {
    if (!group) return;
    
    group.userData.isOrbMode = isOrbMode;
    const humanBodyGroup = group.getObjectByName("humanBodyGroup");
    const orbGroup = group.getObjectByName("orbGroup");
    const orbCore = group.getObjectByName("orbCore");

    if (isOrbMode) {
        if (humanBodyGroup) humanBodyGroup.visible = false;
        if (orbGroup) orbGroup.visible = true;
        
        if (orbCore && realmColorHex) {
            orbCore.material.color.setHex(realmColorHex);
            orbCore.material.emissive.setHex(realmColorHex);
        }
    } else {
        if (humanBodyGroup) humanBodyGroup.visible = true;
        if (orbGroup) orbGroup.visible = false;
        
        switchAvatarPosture(group, group.userData.state === 'STAND');
    }
}