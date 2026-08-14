/* 终章 · 虫子与舰队 —— 麦田里的启示 / 三体舰队启航 */
'use strict';
TB.Chapters = TB.Chapters || {};
TB.Chapters.finale = {
  id: 'finale',

  enter() {
    const S = this.scene, U = TB.Util, E = TB.Engine;
    this.phase = 'field'; this.t2 = 0;

    S.background = new THREE.Color(0x3a2c1a);
    S.fog = new THREE.Fog(0x4a3820, 120, 1200);
    S.add(new THREE.HemisphereLight(0xffd9a0, 0x33260f, 0.85));
    const sun = new THREE.DirectionalLight(0xffb870, 1.1);
    sun.position.set(-400, 180, 100); S.add(sun);
    S.add(E.makeSkyDome('#5a4a66', '#e8a860'));

    /* ---- 麦田 ---- */
    this.fieldGroup = new THREE.Group(); S.add(this.fieldGroup);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(2200, 2200), new THREE.MeshLambertMaterial({ color: 0x5a4a22 }));
    ground.rotation.x = -Math.PI / 2; this.fieldGroup.add(ground);

    const N = 2600, dummy = new THREE.Object3D();
    this.wheat = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.5, 2.2),
      new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
      N
    );
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const x = U.rand(-260, 260), z = U.rand(-300, 120);
      dummy.position.set(x, 1.1, z);
      dummy.rotation.set(0, U.rand(0, Math.PI), U.rand(-0.1, 0.1));
      dummy.updateMatrix();
      this.wheat.setMatrixAt(i, dummy.matrix);
      const g = U.rand(0.5, 0.9);
      col.setRGB(g, g * U.rand(0.72, 0.85), g * 0.32);
      this.wheat.setColorAt(i, col);
    }
    if (this.wheat.instanceColor) this.wheat.instanceColor.needsUpdate = true;
    this.fieldGroup.add(this.wheat);

    /* 蝗群 */
    const LN = 800;
    this.locustBase = [];
    const lpos = new Float32Array(LN * 3);
    for (let i = 0; i < LN; i++) {
      const b = { x: U.rand(-200, 200), y: U.rand(3, 30), z: U.rand(-250, 60), p: U.rand(0, 100) };
      this.locustBase.push(b);
      lpos.set([b.x, b.y, b.z], i * 3);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lpos, 3));
    this.locusts = new THREE.Points(lg, new THREE.PointsMaterial({ color: 0x1c1408, size: 1.5 }));
    this.fieldGroup.add(this.locusts);

    /* 远处落日 */
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(80, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffb060, fog: false }));
    sunMesh.position.set(-1400, 120, -500);
    this.fieldGroup.add(sunMesh);
    const glow = E.makeGlowSprite('255,170,90', 800, 0.95);
    glow.position.copy(sunMesh.position);
    this.fieldGroup.add(glow);

    this.camera.position.set(0, 16, 160);
    this.camera.lookAt(0, 12, -100);

    /* ---- 舰队场景（隐藏，稍后切换） ---- */
    this.spaceGroup = new THREE.Group(); this.spaceGroup.visible = false; S.add(this.spaceGroup);
    this.spaceGroup.add(E.makeStars(2200, 3800));
    const sunsCfg = [[-900, 500, -2600, 0xffa050, 300], [500, 700, -2800, 0xff6040, 240], [1200, 300, -2400, 0xfff0d0, 160]];
    sunsCfg.forEach(([x, y, z, c, s]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(s / 8, 12, 10), new THREE.MeshBasicMaterial({ color: c, fog: false }));
      m.position.set(x, y, z); this.spaceGroup.add(m);
      const gl = E.makeGlowSprite('255,180,110', s * 2.2, 1);
      gl.position.copy(m.position); this.spaceGroup.add(gl);
    });
    /* 目标星：太阳 */
    this.targetStar = E.makeGlowSprite('180,220,255', 120, 1);
    this.targetStar.position.set(3200, 60, 0);
    this.spaceGroup.add(this.targetStar);

    const FN = 900;
    this.fleet = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(2.6),
      new THREE.MeshBasicMaterial({ color: 0x9ab8d0 }),
      FN
    );
    const fd = new THREE.Object3D();
    this.fleetData = [];
    for (let i = 0; i < FN; i++) {
      const gx = i % 45, gy = Math.floor(i / 45);
      const d = { x: -400 + gx * 18 + U.rand(-4, 4), y: (gy - 10) * 12 + U.rand(-3, 3), z: U.rand(-40, 40) };
      this.fleetData.push(d);
      fd.position.set(d.x, d.y, d.z);
      fd.rotation.set(0, 0, Math.PI / 2); /* 长轴指向 +x（航向） */
      fd.scale.set(0.35, 1, 1);
      fd.updateMatrix();
      this.fleet.setMatrixAt(i, fd.matrix);
    }
    this.spaceGroup.add(this.fleet);
    /* 引擎光点 */
    const epos = new Float32Array(FN * 3);
    this.fleetData.forEach((d, i) => epos.set([d.x - 3, d.y, d.z], i * 3));
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(epos, 3));
    this.engines = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0x7fd8ff, size: 1.4, transparent: true, opacity: 0.9 }));
    this.spaceGroup.add(this.engines);

    /* 对白 */
    this.tl.after(0.8, () => {
      TB.UI.letterbox(true);
      TB.UI.say([
        { who: '旁白', text: '物理学不存在了；智子锁死了人类的科学。汪淼与丁仪在酒桌上万念俱灰。' },
        { who: '旁白', text: '这时，史强把他们拽上了车，一路开到华北平原的麦田边。蝗灾正在这里蔓延。' },
        { who: '史强', text: '看看它们。跟咱们相比，蝗虫跟人类的差距，比人类跟三体的差距只大不小。' },
        { who: '史强', text: '几千年了，人类用尽毒剂、天敌、火与水……可你们谁见过蝗虫灭绝？' },
        { who: '史强', text: '把人类看成虫子的那些家伙，忘了一件事——虫子从来没有被真正战胜过。' },
        { who: '旁白', text: '麦浪起伏。两个人的心里，有什么东西重新亮了起来。' }
      ], () => {
        TB.UI.fadeTo(true, 1200, () => this.toSpace());
      });
    });
  },

  toSpace() {
    this.phase = 'space';
    this.scene.fog = null;
    this.scene.background = new THREE.Color(0x020308);
    this.fieldGroup.visible = false;
    this.spaceGroup.visible = true;
    this.camera.position.set(-620, 30, 260);
    this.camera.lookAt(600, 0, 0);
    TB.Audio.drone(true);
    this.tl.after(1.0, () => {
      TB.UI.say([
        { who: '旁白', text: '同一时刻。半人马座三星的深处，一千艘恒星际战舰组成庞大的矩形编队，航向太阳系。' },
        { who: '旁白', text: '它们以核聚变之火加速，巡航速度约为光速的百分之一。四光年的航程，需要飞行四百五十年。' },
        { who: '旁白', text: '四百五十年后，它们将抵达那颗蓝色行星。而此刻的地球，才刚刚知道这一切。' }
      ], () => {
        TB.UI.bigText('距离三体舰队抵达地球<br><span class="huge">450 年</span>', 4200, () => {
          TB.UI.say([
            { who: '旁白', text: '危机纪元开始了。这是人类与三体的故事的第一幕。' },
            { who: '叶文洁', text: '这是人们的落日……也是人们的黎明。' }
          ], () => this.credits());
        });
      });
    });
  },

  credits() {
    TB.UI.letterbox(false);
    TB.Audio.drone(false);
    const c = TB.Engine.el('div', 'credits');
    c.innerHTML = `
      <div class="cr-title">三体 · 第一部 · 完</div>
      <div class="cr-line">同人互动游戏 · 剧情改编自刘慈欣《三体》三部曲</div>
      <div class="cr-line">引擎 Three.js · 全部场景与音效为程序化生成</div>
      <div class="cr-line dim">—— 危机纪元，待续 ——</div>`;
    const again = TB.Engine.el('button', 'big-btn', '再看一遍结局');
    again.style.marginRight = '12px';
    again.onclick = () => { c.remove(); again.remove(); menu.remove(); TB.Engine.setChapter(TB.Chapters.finale); };
    const menu = TB.Engine.el('button', 'big-btn', '返回主菜单');
    menu.onclick = () => TB.Game.toMenu();
  },

  update(dt) {
    this.tl.update(dt);
    this.t2 += dt;
    if (this.phase === 'field') {
      /* 麦浪与风 */
      this.wheat.rotation.z = Math.sin(this.t2 * 0.6) * 0.012;
      const lp = this.locusts.geometry.attributes.position;
      for (let i = 0; i < lp.count; i++) {
        const b = this.locustBase[i];
        lp.setXYZ(i,
          b.x + Math.sin(this.t2 * 1.8 + b.p) * 6 + this.t2 * 2,
          b.y + Math.sin(this.t2 * 3.1 + b.p * 2) * 2.5,
          b.z + Math.cos(this.t2 * 2.2 + b.p) * 6);
        if (lp.getX(i) > 240) b.x -= 460;
      }
      lp.needsUpdate = true;
      this.camera.position.x = Math.sin(this.t2 * 0.05) * 30;
      this.camera.lookAt(0, 14, -110);
    } else if (this.phase === 'space') {
      const m = this.fleetData;
      this.fleet.position.x += dt * 26;
      this.engines.position.x += dt * 26;
      if (this.fleet.position.x > 900) { this.fleet.position.x = -400; this.engines.position.x = -403; }
      this.camera.position.x = -620 + Math.sin(this.t2 * 0.04) * 60;
      this.camera.lookAt(600, 0, 0);
    }
  }
};
