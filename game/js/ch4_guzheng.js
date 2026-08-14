/* 第四章 · 古筝行动 —— 纳米飞刃切割"审判日"号 */
'use strict';
TB.Chapters = TB.Chapters || {};
TB.Chapters.guzheng = {
  id: 'guzheng',
  SLICES: 36, SLICE_W: 6.1, SPEED: 26,

  enter() {
    const S = this.scene, U = TB.Util, E = TB.Engine;
    this.phase = 'intro';        /* intro -> sailing -> cutting -> drift -> collapse -> done */
    this.timeScale = 1; this.cutSet = new Set();
    this.xs = -560;

    S.background = new THREE.Color(0x2a3524);
    S.fog = new THREE.Fog(0x2e3a28, 200, 1500);
    const hemi = new THREE.HemisphereLight(0x9ab088, 0x1c2416, 0.75); S.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d0, 1.0);
    sun.position.set(-300, 400, 200); S.add(sun);
    S.add(E.makeSkyDome('#4a6a8a', '#c8b088'));

    /* 两岸大地（高于水面8m） */
    const bankMat = new THREE.MeshLambertMaterial({ color: 0x35502c });
    [-1, 1].forEach(side => {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(1600, 24, 500), bankMat);
      bank.position.set(0, -4, side * (75 + 250));
      S.add(bank);
      /* 岸壁 */
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1600, 20, 4), new THREE.MeshLambertMaterial({ color: 0x4a4438 }));
      wall.position.set(0, 0, side * 77);
      S.add(wall);
    });

    /* 丛林（实例化树木） */
    const treeN = 360;
    const canopies = new THREE.InstancedMesh(new THREE.ConeGeometry(4.5, 11, 6), new THREE.MeshLambertMaterial({ color: 0x2c4a24 }), treeN);
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.5, 0.7, 6, 5), new THREE.MeshLambertMaterial({ color: 0x40342a }), treeN);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < treeN; i++) {
      const x = U.rand(-700, 700), z = (Math.random() < 0.5 ? -1 : 1) * U.rand(88, 400), s = U.rand(0.7, 1.6);
      dummy.position.set(x, 8 + 8 * s, z); dummy.scale.setScalar(s); dummy.rotation.y = U.rand(0, 6); dummy.updateMatrix();
      canopies.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 8 + 3 * s, z); dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
    }
    S.add(canopies); S.add(trunks);

    /* 河水 */
    const waterGeo = new THREE.PlaneGeometry(1500, 150, 80, 8);
    waterGeo.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(waterGeo, new THREE.MeshPhongMaterial({ color: 0x1d3d46, shininess: 130, specular: 0x88aac0, transparent: true, opacity: 0.94 }));
    S.add(this.water);

    /* 钢柱与纳米丝 */
    const colMat = new THREE.MeshLambertMaterial({ color: 0x8a929c });
    for (let i = -2; i <= 2; i++) {
      [-1, 1].forEach(side => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 26, 8), colMat);
        col.position.set(i * 32, 8 + 13, side * 79);
        S.add(col);
      });
    }
    this.wireGroup = new THREE.Group(); S.add(this.wireGroup);
    for (let i = 0; i < 5; i++) {
      const wire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 150, 4),
        new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.35 })
      );
      wire.rotation.x = Math.PI / 2;
      wire.position.set(-64 + i * 32, 5 + (i % 3) * 4.5, 0);
      this.wireGroup.add(wire);
    }

    /* "审判日"号（36段切片，随时可以散架） */
    this.ship = new THREE.Group();
    this.slices = [];
    const hullMat = new THREE.MeshLambertMaterial({ color: 0x2b3a42 });
    const bottomMat = new THREE.MeshLambertMaterial({ color: 0x6e3a2c });
    const houseMat = new THREE.MeshLambertMaterial({ color: 0x8a949c });
    for (let i = 0; i < this.SLICES; i++) {
      const dx = (i - this.SLICES / 2 + 0.5) * this.SLICE_W;
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(this.SLICE_W - 0.12, 16, 26), hullMat);
      hull.position.y = 2; g.add(hull);
      const bottom = new THREE.Mesh(new THREE.BoxGeometry(this.SLICE_W - 0.12, 5, 26), bottomMat);
      bottom.position.y = -8.5; g.add(bottom);
      if (i > 10 && i < 26) {
        const h = 6 + Math.abs(Math.sin(i * 1.7)) * 12;
        const house = new THREE.Mesh(new THREE.BoxGeometry(this.SLICE_W - 0.5, h, 20), houseMat);
        house.position.y = 10 + h / 2; g.add(house);
      }
      if (i === 6) { /* 舰桥 */
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(this.SLICE_W - 0.3, 14, 18), houseMat);
        bridge.position.y = 17; g.add(bridge);
        const win = new THREE.Mesh(new THREE.PlaneGeometry(this.SLICE_W - 1.5, 5), new THREE.MeshBasicMaterial({ color: 0x9fd8ff }));
        win.position.set(0, 20, 9.2); g.add(win);
      }
      if (i === 20) { /* 烟囱 */
        const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 12, 8), new THREE.MeshLambertMaterial({ color: 0x333c44 }));
        funnel.position.y = 22; g.add(funnel);
      }
      g.position.set(dx, 0, 0);
      this.ship.add(g);
      this.slices.push({ g, dx, cut: false, vz: 0, rotV: 0 });
    }
    S.add(this.ship);
    this.ship.position.x = this.xs;

    /* 火花粒子 */
    this.burst = E.makeBurstSystem(600);
    S.add(this.burst.obj);

    /* 切割面提示光柱（淡） */
    this.curtain = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 160),
      new THREE.MeshBasicMaterial({ color: 0x66d8ff, transparent: true, opacity: 0.0, side: THREE.DoubleSide })
    );
    this.curtain.rotation.x = Math.PI / 2;
    this.curtain.rotation.z = Math.PI / 2;
    this.curtain.position.set(0, 8, 0);
    S.add(this.curtain);

    /* 相机 */
    this.camera.position.set(this.xs + 40, 30, 210);
    this.camera.lookAt(this.xs, 10, 0);

    /* HUD */
    this.hud = TB.Engine.el('div', 'ch-hud left');
    this.hud.innerHTML = `
      <div class="panel">
        <div class="p-title">古筝行动 · 巴拿马运河 · 盖拉德水道</div>
        <div class="row-line"><span>目标</span><b>"审判日"号 · 六万吨级</b></div>
        <div class="row-line"><span>距切割面</span><b id="g-dist">— m</b></div>
        <div class="row-line"><span>纳米丝</span><b>50根"飞刃" · 已预埋</b></div>
      </div>`;
    this.cutBtn = TB.Engine.el('button', 'big-btn danger pulse', '收紧纳米丝');
    this.cutBtn.style.display = 'none';
    this.cutBtn.onclick = () => this.doCut();

    this.tl.after(0.8, () => {
      TB.UI.objective('<b>行动目标</b>：在巨轮横穿纳米丝切割面时收紧，完整夺取船上的三体信息');
      TB.UI.say([
        { who: '旁白', text: '巴拿马运河，盖拉德水道最窄处。河面宽一百五十米，两岸立起了两排钢柱。' },
        { who: '史强', text: '五十根"飞刃"，比头发丝还细，强度却高得离谱。横在河面上，肉眼几乎看不见——像一张琴。' },
        { who: '常伟思', text: '"审判日"号上藏着地球三体组织的核心数据库。必须在他们销毁数据之前，让这艘船失去行动能力。' },
        { who: '旁白', text: '关键是时机：收紧太早，船艏会撞断纳米丝；太晚，舰桥里的数据舱就会安全越过切割面。' }
      ], () => {
        this.phase = 'sailing';
        this.cutBtn.style.display = '';
        this.cutBtn.disabled = true; /* 船艏距切割面200m内才可按下，防止接近阶段误点 */
        TB.UI.toast('等船身完全压上切割面……听我口令', 2600);
      });
    });
  },

  doCut() {
    if (this.phase !== 'sailing') return;
    const bow = this.xs + 110, mid = this.xs;
    if (bow < 8) {
      this.fail('收紧过早——船艏尚未进入切割面，高速撞上的船体绷断了纳米丝。警报声中，数据被远程销毁。');
    } else if (mid >= 2) {
      this.fail('收紧过晚——舰桥计算机区段已经安全越过切割面，伊文斯下令销毁了全部数据。');
    } else {
      this.phase = 'cutting';
      this.cutBtn.style.display = 'none';
      this.wireGroup.children.forEach(w => w.material.opacity = 0.85);
      this.curtain.material.opacity = 0.25;
      TB.Audio.tone(1200, 0.3, 'sine', 0.1, 2400);
      TB.UI.toast('纳米丝已收紧 —— 切割开始', 2400);
      TB.UI.objective('<b>切割进行中</b>……保持船速，等待船身完全通过');
    }
  },

  fail(msg) {
    this.phase = 'failed';
    this.cutBtn.style.display = 'none';
    TB.Audio.fail();
    const panel = TB.Engine.el('div', 'center-panel');
    panel.innerHTML = `<div class="cp-title">行动失败</div><div class="cp-text">${msg}</div>`;
    const btn = TB.Engine.el('button', 'big-btn', '重新部署行动');
    btn.onclick = () => {
      panel.remove(); btn.remove();
      TB.Engine.setChapter(TB.Chapters.guzheng); /* 整章重载（最稳妥） */
    };
  },

  update(dt) {
    this.tl.update(dt);
    const sdt = dt * this.timeScale;
    const U = TB.Util;

    /* 水面微波 */
    const wp = this.water.geometry.attributes.position;
    const t = performance.now() * 0.001;
    for (let i = 0; i < wp.count; i += 2) {
      wp.setY(i, Math.sin(wp.getX(i) * 0.06 + t * 1.4) * 0.5 + Math.cos(wp.getZ(i) * 0.15 + t) * 0.3);
    }
    wp.needsUpdate = true;

    if (this.phase === 'sailing' || this.phase === 'cutting') {
      this.xs += sdt * this.SPEED;
      this.ship.position.x = this.xs;
      const dist = document.getElementById('g-dist');
      if (dist) dist.textContent = Math.max(0, Math.round(-this.xs + 0)) + ' m';
      /* 接近阶段结束（船艏距切割面 < 200m）后才能按下收紧按钮 */
      if (this.phase === 'sailing' && this.cutBtn.disabled && this.xs > -310) {
        this.cutBtn.disabled = false;
        TB.Audio.tone(520, 0.12, 'square', 0.1);
        TB.UI.toast('目标进入切割区段', 1800);
      }

      /* 切割：每个切片经过切割面时留下切痕与火花 */
      if (this.phase === 'cutting') {
        for (const sl of this.slices) {
          if (!sl.cut && this.xs + sl.dx > 0) {
            sl.cut = true;
            this.burst.burst(this.xs + sl.dx, U.rand(2, 20), U.rand(-12, 12), 12, 1, 14, 0xcfe8ff);
            TB.Audio.tone(U.rand(1400, 2200), 0.05, 'square', 0.05);
          }
        }
        if (this.xs - 110 > 40) { /* 完全通过 */
          this.phase = 'drift';
          this.timeScale = 0.35;
          TB.Audio.noise(1.2, 0.3, 300);
          TB.UI.toast('动力系统损毁——船体正在失控漂移', 2600);
          this.tl.after(2.6 / 0.35 * 0.35, () => this.startCollapse());
        }
      }
      /* 相机跟随 */
      this.camera.position.set(this.xs + 46, 34, 215);
      this.camera.lookAt(this.xs, 10, 0);
    }

    if (this.phase === 'drift') {
      this.xs += sdt * this.SPEED * Math.max(0.2, 1 - (performance.now() - this._driftT0 || 0) * 0.001);
      if (!this._driftT0) this._driftT0 = performance.now();
      this.ship.position.x = this.xs;
      this.ship.position.z = U.lerp(this.ship.position.z, 26, sdt * 0.4);
      this.ship.rotation.y = U.lerp(this.ship.rotation.y, 0.1, sdt * 0.4);
      this.camera.position.set(this.xs + 10, 26, 235);
      this.camera.lookAt(this.xs, 8, 10);
    }

    if (this.phase === 'collapse') {
      this.collT += sdt;
      for (const sl of this.slices) {
        if (!sl.vz) { sl.vz = U.rand(6, 26) * (sl.dx < 0 ? -1 : 1) * 0.16 + U.rand(-3, 3); sl.rotV = U.rand(0.05, 0.3) * (Math.random() < 0.5 ? -1 : 1); }
        sl.g.position.z += sl.vz * sdt * 6;
        sl.g.position.y = Math.max(-1.5, sl.g.position.y - sdt * 1.2);
        sl.g.rotation.z += sl.rotV * sdt * (0.4 + Math.abs(sl.vz) * 0.05);
        if (Math.random() < sdt * 0.6) this.burst.burst(this.xs + sl.dx, 2, sl.g.position.z, 3, 2, 8, 0xbfe0e8);
      }
      if (this.collT > 6) { this.phase = 'done'; this.finish(); }
      this.camera.position.x += sdt * 4;
    }

    this.burst.update(sdt);
    /* 丝的微光 */
    if (this.phase === 'cutting') {
      this.wireGroup.children.forEach((w, i) => { w.material.opacity = 0.7 + Math.sin(t * 8 + i) * 0.25; });
      this.curtain.material.opacity = 0.18 + Math.sin(t * 5) * 0.08;
    }
  },

  startCollapse() {
    this.phase = 'collapse';
    this.collT = 0;
    this.timeScale = 0.6;
    TB.Engine.shakeAmt = 1.4;
    TB.Audio.noise(2.2, 0.35, 500);
    TB.UI.bigText('船体解体', 2200);
  },

  finish() {
    this.timeScale = 1;
    TB.UI.fadeTo(true, 1400, () => {
      TB.UI.letterbox(false);
      TB.UI.say([
        { who: '旁白', text: '巨轮像一副被推开的扑克牌，在河岸上散成四十多片切面光滑的薄片。行动成功了。' },
        { who: '旁白', text: '船上约28G的信息被完整截获——地球三体组织的全部秘密，第一次摊开在人类面前。' },
        { who: '旁白', text: '人们知道了三体舰队早已启航；也知道了那两颗先期抵达的、被称作"智子"的质子——人类的基础物理，已经被锁死。' },
        { who: '旁白', text: '而在解译出的通讯末尾，三体世界只给人类留下了一句话。' }
      ], () => {
        TB.UI.bigText('<span class="red" style="letter-spacing:0.4em">你们是虫子</span>', 3200, () => {
          TB.UI.fadeTo(true, 1200, () => {
            TB.UI.titleCard('终章', '虫 子 与 舰 队', 2800, () => TB.Game.next('guzheng'));
          });
        });
      });
    });
  }
};
