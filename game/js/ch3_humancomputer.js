/* 第三章 · 人列计算机 —— 你是"秦一号"的一名门电路士兵 */
'use strict';
TB.Chapters = TB.Chapters || {};
TB.Chapters.computer = {
  id: 'computer',
  COLS: 78, ROWS: 24,
  STAGES: [
    { gate: '与门', rule: '两面输入都是黑旗（1），输出才举黑旗；否则举白旗。', n: 4, fn: (a, b) => a & b },
    { gate: '或门', rule: '只要有一面输入是黑旗，输出就举黑旗。', n: 4, fn: (a, b) => a | b },
    { gate: '非门', rule: '只有一路输入：黑旗举白旗，白旗举黑旗。', n: 3, single: true, fn: (a) => 1 - a },
    { gate: '异或门', rule: '两面输入旗色不同，举黑旗；相同，举白旗。', n: 5, fn: (a, b) => a ^ b }
  ],

  enter() {
    const S = this.scene, U = TB.Util, E = TB.Engine;
    this.phase = 'intro';
    this.stageIdx = 0; this.qInStage = 0; this.lives = 3;
    this.timer = 0; this.qActive = false; this.floatT = -1; this.cinT = -1; this.flicker = false;

    S.background = new THREE.Color(0x241a10);
    S.fog = new THREE.Fog(0x2c2014, 150, 900);
    const hemi = new THREE.HemisphereLight(0x8a7a60, 0x33261a, 0.7); S.add(hemi);
    this.sunLight = new THREE.DirectionalLight(0xffe8c0, 0.9);
    this.sunLight.position.set(-0.4, 1, 0.5);
    S.add(this.sunLight);
    S.add(E.makeSkyDome('#31251a', '#7a5a3a'));

    /* 黄土平原 */
    const terrain = E.makeTerrain(2400, 64, 10, (x, z) => {
      const v = U.clamp(0.5 + TB.Util.noise2(x * 0.5, z * 0.5) * 0.3, 0, 1);
      return { r: U.lerp(0.42, 0.58, v), g: U.lerp(0.34, 0.46, v), b: U.lerp(0.22, 0.3, v) };
    });
    S.add(terrain);

    /* 远景金字塔 */
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(60, 90, 4), new THREE.MeshLambertMaterial({ color: 0x241c14 }));
    pyr.position.set(0, 45, -260); pyr.rotation.y = Math.PI / 4;
    S.add(pyr); this.pyramid = pyr;

    /* 秦字大纛 */
    const bannerTex = U.canvasTexture(128, 256, (c, w, h) => {
      c.fillStyle = '#180d08'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#8a2f1c'; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16);
      c.fillStyle = '#c8a24a'; c.font = 'bold 92px serif'; c.textAlign = 'center';
      c.fillText('秦', w / 2, h / 2 + 34);
    });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(18, 34), new THREE.MeshBasicMaterial({ map: bannerTex, side: THREE.DoubleSide }));
    banner.position.set(0, 30, -120); S.add(banner);

    /* ---- 三千万秦军（实例化方阵） ---- */
    const N = this.COLS * this.ROWS;
    this.instData = [];
    for (let r = 0; r < this.ROWS; r++) for (let c = 0; c < this.COLS; c++) {
      this.instData.push({
        x: (c - this.COLS / 2) * 3.4 + U.rand(-0.5, 0.5),
        z: (r - this.ROWS / 2) * 4.6 + U.rand(-0.6, 0.6),
        ry: U.rand(-0.15, 0.15),
        spin: U.rand(-1.2, 1.2), rise: U.rand(0.7, 1.6)
      });
    }
    const dummy = new THREE.Object3D();
    this.bodies = new THREE.InstancedMesh(new THREE.ConeGeometry(0.55, 2.3, 6), new THREE.MeshLambertMaterial({ color: 0x6e5a44 }), N);
    this.poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 4), new THREE.MeshLambertMaterial({ color: 0x3a2c1e }), N);
    this.flags = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.15, 0.75), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), N);
    this.applyArmyMatrices(0);
    /* 随机黑白旗 */
    const col = new THREE.Color();
    for (let i = 0; i < N; i++) {
      col.set(Math.random() < 0.5 ? 0x111111 : 0xf2ede2);
      this.flags.setColorAt(i, col);
    }
    if (this.flags.instanceColor) this.flags.instanceColor.needsUpdate = true;
    S.add(this.bodies); S.add(this.poles); S.add(this.flags);

    /* 你的门电路（三个高亮士兵） */
    this.gate = new THREE.Group();
    const soldierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
    this.soldierRefs = [];
    const gateZ = this.ROWS / 2 * 4.6 + 14;
    [[-7, '入1'], [0, '你'], [7, '入2']].forEach(([gx, label]) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.6, 7), soldierMat);
      body.position.y = 1.8; g.add(body);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 4.4, 5), new THREE.MeshLambertMaterial({ color: 0x3a2c1e }));
      pole.position.set(0.7, 4.0, 0); g.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.3), new THREE.MeshBasicMaterial({ color: 0x777777, side: THREE.DoubleSide }));
      flag.position.set(1.8, 5.5, 0); flag.scale.setScalar(0.25);
      g.add(flag);
      g.position.set(gx, 0, gateZ);
      this.gate.add(g);
      this.soldierRefs.push({ g, flag, label });
    });
    S.add(this.gate);

    /* 信号脉冲光点 */
    this.pulse = E.makeGlowSprite('120,255,180', 14, 1);
    this.pulse.visible = false; S.add(this.pulse);
    this.pulseT = -1;

    /* 三日连珠太阳（隐藏） */
    this.triSuns = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(50, 18, 12), new THREE.MeshBasicMaterial({ color: 0xffb050, fog: false }));
      const g = E.makeGlowSprite('255,170,80', 620, 1);
      s.visible = g.visible = false;
      S.add(s); S.add(g);
      this.triSuns.push({ mesh: s, glow: g, targetX: (i - 1) * 900 });
    }

    /* 相机 */
    this.camBase = { theta: 0.0, phi: 1.32, dist: 46, target: new THREE.Vector3(0, 4, gateZ + 4) };
    this.applyCam();

    /* HUD */
    this.hud = TB.Engine.el('div', 'ch-hud left');
    this.hud.innerHTML = `
      <div class="panel">
        <div class="p-title">秦一号 · 人列计算机</div>
        <div class="row-line"><span>电路</span><b id="h-gate">—</b></div>
        <div class="row-line"><span>运算进度</span>
          <div class="tempbar small"><div id="h-prog" style="background:#7ec8ff"></div></div><b id="h-progt">0/16</b></div>
        <div class="row-line"><span>容错</span><b id="h-lives" class="red">●●●</b></div>
        <div class="timer-ring" id="h-timer"></div>
      </div>
      <div class="panel"><div class="p-title small">输入旗语</div>
        <div>黑旗 = 1 　白旗 = 0</div>
        <div id="h-inputs" style="margin-top:4px;color:#ffd9a0">等待输入信号 ……</div></div>`;
    this.btnBlack = TB.Engine.el('button', 'big-btn dark-flag', '举黑旗（1）');
    this.btnWhite = TB.Engine.el('button', 'big-btn light-flag', '举白旗（0）');
    this.btnBlack.onclick = () => this.answer(1);
    this.btnWhite.onclick = () => this.answer(0);
    this.btnBlack.style.display = this.btnWhite.style.display = 'none';

    this.totalQ = this.STAGES.reduce((s, x) => s + x.n, 0);
    this.doneQ = 0;

    this.tl.after(0.8, () => {
      TB.UI.say([
        { who: '《三体》游戏', text: '时间推进到战国时代。为了在乱纪元到来前算出太阳的轨道，有人提出了一个疯狂的构想。' },
        { who: '冯·诺依曼', text: '用三千万大军，组成一台计算机！士兵就是元件，旗帜就是电平——不需要任何技术，只需要纪律。' },
        { who: '秦始皇', text: '朕给你大军。但若算不出来，你们全部军法处置。' },
        { who: '《三体》游戏', text: '你，是这台"人列计算机"里的一名门电路士兵。你的旗子举错一次，整机就会死锁。' }
      ], () => this.startStage());
    });
  },

  applyArmyMatrices(floatT) {
    const dummy = new THREE.Object3D(), N = this.instData.length;
    for (let i = 0; i < N; i++) {
      const d = this.instData[i];
      let y = 1.15, rot = d.ry;
      if (floatT >= 0) { y += floatT * floatT * 6 * d.rise; rot += floatT * d.spin; }
      dummy.rotation.set(rot * 0.3, rot, rot * 0.2);
      dummy.position.set(d.x, y, d.z); dummy.updateMatrix();
      this.bodies.setMatrixAt(i, dummy.matrix);
      dummy.position.set(d.x + Math.sin(rot) * 0, y + 2.9 + (floatT >= 0 ? floatT * floatT * 6 * d.rise : 0) - (floatT >= 0 ? 0 : 0), d.z);
      dummy.updateMatrix();
      this.poles.setMatrixAt(i, dummy.matrix);
      dummy.position.set(d.x + 1.0, y + 4.4 + (floatT >= 0 ? floatT * floatT * 6 * d.rise : 0), d.z);
      dummy.updateMatrix();
      this.flags.setMatrixAt(i, dummy.matrix);
    }
    this.bodies.instanceMatrix.needsUpdate = true;
    this.poles.instanceMatrix.needsUpdate = true;
    this.flags.instanceMatrix.needsUpdate = true;
  },

  applyCam() {
    const c = this.camBase, E = TB.Engine;
    const sp = Math.sin(c.phi), cp = Math.cos(c.phi);
    this.camera.position.set(
      c.target.x + c.dist * sp * Math.sin(c.theta),
      c.target.y + c.dist * cp,
      c.target.z + c.dist * sp * Math.cos(c.theta)
    );
    this.camera.lookAt(c.target);
  },

  startStage() {
    const st = this.STAGES[this.stageIdx];
    this.qInStage = 0;
    document.getElementById('h-gate').textContent = st.gate;
    /* 规则讲解时隐藏答题按钮，避免遮挡对话框 */
    this.btnBlack.style.display = this.btnWhite.style.display = 'none';
    TB.UI.say([
      { who: '军令', text: `新电路接入：${st.gate}。${st.rule}` }
    ], () => { this.phase = 'quiz'; this.nextQuestion(); });
  },

  nextQuestion() {
    const st = this.STAGES[this.stageIdx];
    if (this.qInStage >= st.n) {
      this.stageIdx++;
      if (this.stageIdx >= this.STAGES.length) { this.startCinematic(); return; }
      this.startStage(); return;
    }
    this.qInStage++;
    const a = TB.Util.randInt(0, 1), b = st.single ? -1 : TB.Util.randInt(0, 1);
    this.curA = a; this.curB = b;
    const flagColor = (v) => v === -1 ? 0x555555 : (v ? 0x111111 : 0xf2ede2);
    this.soldierRefs[0].flag.material.color.set(flagColor(a));
    this.soldierRefs[2].flag.material.color.set(flagColor(b));
    this.soldierRefs[0].flag.scale.setScalar(a === -1 ? 0.05 : 1);
    this.soldierRefs[2].flag.scale.setScalar(b === -1 ? 0.05 : 1);
    this.soldierRefs[1].flag.material.color.set(0x777777);
    this.soldierRefs[1].flag.scale.setScalar(0.5);
    this.timer = 6.0; this.qActive = true;
    this.btnBlack.style.display = this.btnWhite.style.display = '';
    const inputsEl = document.getElementById('h-inputs');
    if (inputsEl) {
      const fstr = (v) => v === -1 ? '—' : (v ? '黑旗(1)' : '白旗(0)');
      inputsEl.textContent = `入1 ${fstr(a)}　入2 ${fstr(b)}`;
    }
    TB.Audio.tone(760, 0.06, 'square', 0.08);
  },

  answer(bit) {
    if (!this.qActive) return;
    this.qActive = false;
    const st = this.STAGES[this.stageIdx];
    const expect = st.fn(this.curA, this.curB);
    const you = this.soldierRefs[1];
    you.flag.material.color.set(bit ? 0x111111 : 0xf2ede2);
    you.flag.scale.setScalar(1);
    if (bit === expect) {
      this.doneQ++;
      TB.Audio.success();
      this.pulseT = 0; this.pulse.visible = true;
      this.pulse.position.set(-120, 5, TB.Util.rand(-40, 60));
      this.updateHud();
      this.tl.after(0.9, () => this.nextQuestion());
    } else {
      this.lives--;
      TB.Audio.fail(); TB.Engine.shakeAmt = 1.6;
      TB.UI.bigText('<span class="red">斩！</span>', 1300);
      const vg = TB.Engine.el('div', 'redflash');
      setTimeout(() => vg.remove(), 700);
      this.updateHud();
      if (this.lives <= 0) { this.quizFail(); return; }
      this.tl.after(1.1, () => this.nextQuestion());
    }
  },

  quizFail() {
    this.btnBlack.style.display = this.btnWhite.style.display = 'none';
    this.tl.after(1.2, () => {
      TB.UI.bigText('<span class="red">整机死锁</span>', 1800);
      const again = TB.Engine.el('div', 'center-panel');
      again.innerHTML = `<div class="cp-title">部件出错，运算中止</div><div class="cp-text">秦始皇下令：出错部件的士兵，斩。重新接入电路——这次不要出错。</div>`;
      const btn = TB.Engine.el('button', 'big-btn', '重新列阵');
      btn.onclick = () => {
        again.remove(); btn.remove();
        this.lives = 3; this.doneQ = 0; this.stageIdx = 0;
        this.updateHud(); this.startStage();
      };
    });
  },

  updateHud() {
    document.getElementById('h-progt').textContent = `${this.doneQ}/${this.totalQ}`;
    document.getElementById('h-prog').style.width = (this.doneQ / this.totalQ * 100) + '%';
    document.getElementById('h-lives').textContent = '●'.repeat(Math.max(0, this.lives));
  },

  startCinematic() {
    this.phase = 'cinematic';
    this.btnBlack.style.display = this.btnWhite.style.display = 'none';
    this.hud.style.display = 'none';
    TB.UI.letterbox(true);
    TB.UI.objective(null);
    this.cinT = 0; this.flicker = true;
    TB.Audio.drone(true);
    this.tl.after(2.5, () => TB.UI.bigText('秦一号 · 启动运算', 2400));
    this.tl.after(6.5, () => TB.UI.toast('主板：三千万秦军　系统：Three-Body 1.0', 3000));
    this.tl.after(11, () => TB.UI.bigText('轨道预测 —— 下一次日出，命中！', 2600));
    this.tl.after(15, () => {
      this.flicker = false;
      /* 全体旗子归位为白旗 */
      const col = new THREE.Color(0xf2ede2);
      for (let i = 0; i < this.flags.count; i++) this.flags.setColorAt(i, col);
      this.flags.instanceColor.needsUpdate = true;
      TB.UI.bigText('<span class="red">三日连珠</span>', 2800);
      TB.Audio.tone(90, 2.0, 'sawtooth', 0.2, 40);
      this.triSuns.forEach(s => { s.mesh.visible = s.glow.visible = true; });
      this.sunLight.intensity = 0.4;
      this.sunLight.color.set(0xff8860);
    });
    this.tl.after(18, () => { this.floatT = 0; TB.Engine.shakeAmt = 2; });
    this.tl.after(24, () => TB.UI.bigText('<span class="red">184号文明 · 行星解体</span>', 3000));
    this.tl.after(28, () => this.finishDialogs());
  },

  finishDialogs() {
    this.phase = 'aftermath';
    this.floatT = -1;
    TB.Audio.drone(false);
    TB.UI.say([
      { who: '冯·诺依曼', text: '运算没有失败——失败的是我们想用任何机器预测三颗恒星。这不是算力的问题，是数学本身没有答案。' },
      { who: '冯·诺依曼', text: '如果还有下一次……不要用人了，也不要用算盘。用电元件，做成真正的机器。' },
      { who: '《三体》游戏', text: '三体问题无解。在无数次毁灭与轮回之后，三体文明做出了最终决定——' },
      { who: '《三体》游戏', text: '放弃这颗行星，远征四光年外的家园。那里有一颗温柔的、唯一的太阳。' },
      { who: '旁白', text: '而在现实中的地球，另一场风暴正在酝酿——一支潜伏多年、人数庞大的"地球三体叛军"，与一艘名为"审判日"的巨轮……' }
    ], () => {
      TB.UI.fadeTo(true, 1000, () => {
        TB.UI.titleCard('第四章', '古 筝 行 动', 2800, () => TB.Game.next('computer'));
      });
    });
  },

  onKey(e) {
    if (this.phase === 'cinematic' && e.key === 'Escape') {
      this.tl.clear();
      this.flicker = false; this.floatT = -1;
      this.triSuns.forEach(s => { s.mesh.visible = s.glow.visible = true; });
      this.finishDialogs();
    }
    if (this.phase === 'quiz') {
      if (e.key === '0') this.answer(0);
      if (e.key === '1') this.answer(1);
    }
  },

  update(dt) {
    this.tl.update(dt);
    /* 计时环 */
    if (this.qActive) {
      this.timer -= dt;
      const ring = document.getElementById('h-timer');
      if (ring) {
        const pct = TB.Util.clamp(this.timer / 6, 0, 1) * 100;
        ring.style.background = `conic-gradient(#ff5a3a ${pct}%, transparent ${pct}%)`;
      }
      if (this.timer <= 0) { TB.Audio.fail(); this.answer(this.curA === 1 ? 0 : 1); } /* 超时=答错 */
    }
    /* 旗语闪烁 = 运算 */
    if (this.flicker && Math.random() < dt * 9) {
      const col = new THREE.Color();
      for (let k = 0; k < 130; k++) {
        const i = TB.Util.randInt(0, this.flags.count - 1);
        col.set(Math.random() < 0.5 ? 0x111111 : 0xf2ede2);
        this.flags.setColorAt(i, col);
      }
      this.flags.instanceColor.needsUpdate = true;
    }
    /* 信号脉冲飞行 */
    if (this.pulseT >= 0) {
      this.pulseT += dt;
      this.pulse.position.x += dt * 90;
      if (this.pulseT > 2.6) { this.pulseT = -1; this.pulse.visible = false; }
    }
    /* 电影运镜 */
    if (this.cinT >= 0) {
      this.cinT += dt;
      const p = TB.Util.clamp(this.cinT / 16, 0, 1);
      this.camBase.dist = TB.Util.lerp(46, 420, p * p);
      this.camBase.phi = TB.Util.lerp(1.32, 0.62, p);
      this.camBase.theta = Math.sin(this.cinT * 0.07) * 0.3;
      this.applyCam();
    }
    /* 三日连珠：三星排成一线缓缓升起 */
    if (this.triSuns[0].mesh.visible) {
      this.triSuns.forEach(s => {
        const targetY = 420;
        s.mesh.position.y = TB.Util.lerp(s.mesh.position.y || -100, targetY, dt * 0.5);
        s.mesh.position.set(s.targetX, s.mesh.position.y, -700);
        s.glow.position.copy(s.mesh.position);
      });
    }
    /* 失重漂浮 */
    if (this.floatT >= 0) {
      this.floatT += dt;
      this.applyArmyMatrices(this.floatT);
      this.pyramid.rotation.z += dt * 0.02;
    }
  }
};
