/* 第一章 · 红岸 —— 天线校准 / 太阳增益发射 / 八年后的警告与抉择 */
'use strict';
TB.Chapters = TB.Chapters || {};
TB.Chapters.redcoast = {
  id: 'redcoast',
  az: 0.7, el: 0.95,                 /* 天线方位 / 俯仰（弧度） */
  dragging: false, aligned: false, alignHold: 0, locked: false,
  phase: 'calibrate',                 /* calibrate -> transmit -> night -> choice -> end */

  enter() {
    const S = this.scene, U = TB.Util, E = TB.Engine;
    this.sunDir = new THREE.Vector3(-0.92, 0.17, -0.35).normalize();
    this.sunAz = Math.atan2(this.sunDir.x, this.sunDir.z);
    this.sunEl = Math.asin(this.sunDir.y);

    S.background = new THREE.Color(0x1a2233);
    S.fog = new THREE.Fog(0x2a3448, 120, 1600);
    S.add(new THREE.HemisphereLight(0x8899cc, 0x223322, 0.75));
    const sunLight = new THREE.DirectionalLight(0xffd9a0, 1.05);
    sunLight.position.copy(this.sunDir).multiplyScalar(500);
    S.add(sunLight);

    S.add(E.makeSkyDome('#0e1626', '#7a6a55'));
    const stars = E.makeStars(900, 3400);
    stars.material.opacity = 0.5; stars.material.transparent = true;
    S.add(stars);

    /* 雪峰地形 */
    const terrain = E.makeTerrain(2600, 96, 85, (x, z, h) => {
      const snow = U.clamp(h / 55, 0, 1);
      const r = U.lerp(0.16, 0.86, snow), g = U.lerp(0.17, 0.9, snow), b = U.lerp(0.18, 0.95, snow);
      return { r, g, b };
    });
    /* 峰顶平台 */
    const tp = terrain.geometry.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), z = tp.getZ(i);
      if (Math.abs(x) < 55 && Math.abs(z) < 55) tp.setY(i, U.lerp(tp.getY(i), 34, 1 - Math.max(Math.abs(x), Math.abs(z)) / 55));
    }
    terrain.geometry.computeVertexNormals();
    S.add(terrain);

    /* 基地建筑群 */
    const bmat = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffcf7a });
    const addBuilding = (x, z, w, h, d, ry) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bmat);
      b.position.set(x, 34 + h / 2, z); b.rotation.y = ry; S.add(b);
      for (let i = 0; i < 4; i++) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), winMat);
        win.position.set(x + U.rand(-w / 3, w / 3), 34 + h * U.rand(0.4, 0.8), z + d / 2 + 0.05);
        S.add(win);
      }
      return b;
    };
    addBuilding(58, -20, 26, 10, 14, 0.2);
    addBuilding(46, 26, 16, 7, 12, -0.3);
    addBuilding(-52, 40, 12, 6, 10, 0.5);

    /* 巨型抛物面天线 */
    this.dishGroup = new THREE.Group();
    this.dishGroup.position.set(0, 34, 0);
    S.add(this.dishGroup);
    const pivot = new THREE.Group(); this.dishPivot = pivot; this.dishGroup.add(pivot);
    /* 抛物面：开口朝 +Z */
    const pts = [];
    for (let r = 0; r <= 22; r += 1.2) pts.push(new THREE.Vector2(r, r * r * 0.016));
    const dishGeo = new THREE.LatheGeometry(pts, 48);
    dishGeo.rotateX(Math.PI / 2); /* 使开口朝 +Z */
    dishGeo.rotateY(0);
    const dish = new THREE.Mesh(dishGeo, new THREE.MeshLambertMaterial({ color: 0xd8dde2, side: THREE.DoubleSide }));
    pivot.add(dish);
    /* 馈源支架 */
    const strutMat = new THREE.MeshLambertMaterial({ color: 0x666e78 });
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 24), strutMat);
      strut.position.set(Math.sin(a) * 10, Math.cos(a) * 10, 6);
      strut.lookAt(new THREE.Vector3(0, 0, 20));
      strut.rotateX(Math.PI / 2);
      pivot.add(strut);
    }
    const feed = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 3, 12), new THREE.MeshLambertMaterial({ color: 0x39424e }));
    feed.rotation.x = Math.PI / 2; feed.position.z = 19;
    pivot.add(feed);
    /* 转台 */
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 5, 9, 12), strutMat);
    mount.position.y = -4; this.dishGroup.add(mount);

    /* 太阳 */
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffb257, fog: false }));
    this.sunMesh.position.copy(this.sunDir).multiplyScalar(2900);
    S.add(this.sunMesh);
    this.sunGlow = E.makeGlowSprite('255,150,60', 950, 0.9);
    this.sunGlow.position.copy(this.sunMesh.position);
    S.add(this.sunGlow);

    /* 发射光束（隐藏） */
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 5, 2600, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.beam.visible = false;
    S.add(this.beam);

    /* 相机 */
    this.orbit = E.makeOrbitCam(new THREE.Vector3(0, 44, 0), 1.42, 1.12, 150);
    this.orbit.apply(this.camera);

    /* ---- HUD ---- */
    this.hud = TB.Engine.el('div', 'ch-hud');
    this.hud.innerHTML = `
      <div class="panel">
        <div class="p-title">红岸 · 发射控制</div>
        <div class="row"><span>方位</span><div class="gauge"><div class="marker" id="g-az"></div><div class="goal"></div></div></div>
        <div class="row"><span>俯仰</span><div class="gauge"><div class="marker" id="g-el"></div><div class="goal"></div></div></div>
        <div class="gain">太阳增益 <b id="g-val">—</b></div>
        <div class="hint-line" id="g-hint">按住拖动画面，转动天线对准西沉的太阳</div>
      </div>`;
    this.txBtn = TB.Engine.el('button', 'big-btn danger pulse', '发 射');
    this.txBtn.style.display = 'none';
    this.txBtn.onclick = () => { if (this.phase === 'calibrate' && this.aligned) this.doTransmit(); };

    this.applyDish();
    this.tl.after(0.8, () => {
      TB.UI.letterbox(false);
      TB.UI.objective('<b>1971年 · 大兴安岭 · 红岸基地</b><br>将发射天线对准西沉的太阳');
      TB.UI.say([
        { who: '旁白', text: '雷达峰之巅。巨大的天线在寒风中微微颤动，像一只向苍穹张开的手掌。' },
        { who: '叶文洁', text: '太阳，是一面能量的镜面。只要频率合适，它就会把射向它的电波放大近一亿倍，再反射向整个宇宙。' },
        { who: '旁白', text: '借着发射机检修的机会，叶文洁要把一次不在任何日志里的发射，对准正在西沉的太阳。' }
      ]);
    });
  },

  applyDish() {
    this.dishGroup.rotation.y = this.az;
    this.dishPivot.rotation.x = -this.el;
    const cos = TB.Util.clamp(Math.cos(this.az - this.sunAz), -1, 1);
    this.align = Math.max(0, cos) * Math.max(0, Math.cos(this.el - this.sunEl));
  },

  boresight() {
    return new THREE.Vector3(Math.sin(this.az) * Math.cos(this.el), Math.sin(this.el), Math.cos(this.az) * Math.cos(this.el));
  },

  onDown(e) { if (!this.locked) { this.dragging = true; this.lastX = e.clientX; this.lastY = e.clientY; } },
  onUp(e) { this.dragging = false; },
  onMove(e) {
    if (!this.dragging || this.locked) return;
    const dx = (e.clientX !== undefined ? e.clientX : 0) - (this.lastX || e.clientX);
    const dy = (e.clientY !== undefined ? e.clientY : 0) - (this.lastY || e.clientY);
    this.lastX = e.clientX; this.lastY = e.clientY;
    this.az -= dx * 0.004;
    this.el = TB.Util.clamp(this.el + dy * 0.003, 0.03, 1.45);
    this.applyDish();
  },

  update(dt) {
    this.tl.update(dt);
    this.orbit.theta += Math.sin(performance.now() * 0.00008) * 0.00012;
    if (this.phase === 'calibrate') this.orbit.apply(this.camera);

    /* 对准判定 */
    if (this.phase === 'calibrate') {
      const azEl = document.getElementById('g-az'), elEl = document.getElementById('g-el'), vEl = document.getElementById('g-val');
      if (azEl) {
        let d = this.az - this.sunAz;
        while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        azEl.style.left = (50 + TB.Util.clamp(d / 1.2, -1, 1) * 48) + '%';
        elEl.style.left = (50 + TB.Util.clamp((this.el - this.sunEl) / 1.2, -1, 1) * 48) + '%';
        const gain = Math.pow(this.align, 10) * 1.2;
        vEl.textContent = this.align > 0.55 ? ('× ' + (gain * 1e8 / 1e8).toFixed(3) + ' 亿') : '增益过低';
      }
      if (this.align > 0.982) {
        this.alignHold += dt;
        if (this.alignHold > 1.4 && !this.aligned) {
          this.aligned = true;
          TB.Audio.success();
          TB.UI.toast('能量镜面增益达到峰值 —— 可以发射了');
          this.txBtn.style.display = '';
          document.getElementById('g-hint').textContent = '增益锁定。按下发射键。';
        }
      } else if (!this.aligned) {
        this.alignHold = Math.max(0, this.alignHold - dt * 0.7);
      }
    }
    /* 光束动画 */
    if (this.beam.visible) {
      this.beam.material.opacity = Math.min(this.beamTarget || 0, this.beam.material.opacity + dt * 0.8);
    }
    this.sunGlow.scale.setScalar(950 + Math.sin(performance.now() * 0.001) * 40 + (this.sunPulse || 0));
  },

  doTransmit() {
    this.phase = 'transmit';
    this.locked = true;
    this.txBtn.style.display = 'none';
    TB.UI.objective(null);
    const dir = this.boresight();
    /* 光束：从馈源指向太阳 */
    this.beam.position.copy(this.dishGroup.position).add(dir.clone().multiplyScalar(1300));
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.beam.visible = true; this.beamTarget = 0.85; this.beam.material.opacity = 0;
    this.sunPulse = 0;
    TB.Audio.noise(1.6, 0.3, 600);
    TB.Audio.tone(120, 1.5, 'sine', 0.2, 60);

    let pulses = 0;
    this.tl.every(0.4, () => { pulses++; this.sunPulse = 60 * Math.sin(pulses * 1.3); if (pulses > 8) this.sunPulse = 0; });

    this.tl.after(2.2, () => {
      TB.UI.say([
        { who: '叶文洁', text: '发射了。这束电波掠过太阳，将被能量镜面放大上亿倍，飞向未知的宇宙深处。' },
        { who: '旁白', text: '这次发射没有写入任何日志。世界上只有一个人知道它真正的含义。' },
        { who: '旁白', text: '没有人想到——八年之后，它回来了。' }
      ], () => {
        TB.UI.fadeTo(true, 1200, () => {
          TB.UI.titleCard('八年之后', '1979年 · 一个值夜班的凌晨', 2800, () => this.toNight());
        });
      });
    });
  },

  toNight() {
    /* 切换为深夜场景 */
    const S = this.scene;
    S.background = new THREE.Color(0x05070f);
    S.fog = new THREE.Fog(0x0a0f1c, 100, 1400);
    this.sunMesh.visible = false; this.sunGlow.visible = false; this.beam.visible = false;
    const stars = S.children.find(c => c.isPoints);
    if (stars) { stars.material.opacity = 1; }
    this.hud.style.display = 'none';
    this.camera.position.set(40, 50, 90);
    this.camera.lookAt(0, 44, 0);

    /* 接收终端 */
    const term = TB.Engine.el('div', 'terminal');
    term.innerHTML = `
      <div class="t-bar">红岸 · 深空监听终端 v2.1</div>
      <div class="t-body" id="t-body"></div>`;
    this.phase = 'night';
    const lines = [
      ['>> 捕获异常信号 …… 频率：1420 MHz 附近', 0],
      ['>> 多普勒修正 …… 来源：半人马座三星方向', 300],
      ['>> 距离估算：约 4 光年', 260],
      ['>> 启动自解译系统 …… 完成', 400],
      ['>> 信息识别度：AAAAA', 300],
      ['>> —— 以下为译出的正文 ——', 500]
    ];
    const body = document.getElementById('t-body');
    let acc = 600;
    lines.forEach(([txt, d]) => {
      acc += d;
      this.tl.after(acc / 1000, () => {
        const p = document.createElement('div'); p.textContent = txt; body.appendChild(p);
        TB.Audio.tone(880, 0.04, 'square', 0.05);
      });
    });
    this.tl.after((acc + 900) / 1000, () => {
      const warn = document.createElement('div');
      warn.className = 't-warn'; warn.textContent = '不要回答。不要回答。不要回答。';
      body.appendChild(warn);
      TB.Audio.tone(160, 0.6, 'sawtooth', 0.15);
    });
    this.tl.after((acc + 3200) / 1000, () => {
      TB.UI.say([
        { who: '旁白', text: '警告来自三体世界一座编号1379的监听站。发信人自称是一名和平主义者。' },
        { who: '监听员（译文）', text: '这颗行星正处在三颗恒星造成的乱纪元里，毁灭只是时间问题。我的文明渴望新的家园。' },
        { who: '监听员（译文）', text: '只要你们不回答，发射源就无法被定位，你们的世界就是安全的。一旦回答——入侵就会开始。' },
        { who: '旁白', text: '监控室里空无一人。屏幕的荧光落在叶文洁脸上。人类的命运，此刻悬在她的指尖上。' }
      ], () => this.makeChoice());
    });
  },

  makeChoice() {
    TB.UI.choice('这个夜晚，你（叶文洁）将如何抉择？', [
      { label: '按下发射键 · 回答他们', value: 'answer', danger: true },
      { label: '保持沉默 · 关闭机器', value: 'silence' }
    ], v => v === 'answer' ? this.answerPath() : this.silencePath());
  },

  answerPath() {
    const S = this.scene;
    termHide();
    function termHide() { const t = document.querySelector('.terminal'); if (t) t.remove(); }
    /* 天线转向初升的太阳（东方） */
    const eastDir = new THREE.Vector3(0.85, 0.14, 0.5).normalize();
    this.sunMesh.position.copy(eastDir).multiplyScalar(2900);
    this.sunMesh.material.color.set(0xffd08a);
    this.sunMesh.visible = true;
    this.sunGlow.position.copy(this.sunMesh.position);
    this.sunGlow.visible = true;
    this.sunDir = eastDir;
    this.sunAz = Math.atan2(eastDir.x, eastDir.z);
    this.sunEl = Math.asin(eastDir.y);
    this.az = this.sunAz; this.el = this.sunEl;
    this.applyDish();
    this.camera.position.set(-30, 46, -80);
    this.camera.lookAt(0, 44, 0);

    const beam = this.beam;
    beam.position.copy(this.dishGroup.position).add(this.boresight().multiplyScalar(1300));
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.boresight());
    beam.visible = true; beam.material.opacity = 0; this.beamTarget = 0.9;
    TB.Audio.noise(1.2, 0.25, 800);

    this.tl.after(2.0, () => {
      TB.UI.say([
        { who: '叶文洁', text: '来吧。到这个世界来。让我成为你们的引路人——我的文明已经无力解决自己的问题。' },
        { who: '旁白', text: '回答发出去了。按下的时间不到三秒，却为地球招来了一支四光年外的舰队。' },
        { who: '旁白', text: '此刻，半人马座三星。一千艘恒星际战舰启航，目标：太阳系。预计航程——四百五十年。' }
      ], () => {
        TB.UI.titleCard('第一章 · 完', '红岸往事，就此埋进大兴安岭的雪里', 3000, () => TB.Game.next('redcoast'));
      });
    });
  },

  silencePath() {
    const t = document.querySelector('.terminal'); if (t) t.remove();
    this.beam.visible = false;
    TB.UI.say([
      { who: '旁白', text: '机器被关掉了。屏幕暗下去，宇宙重新归于寂静。' },
      { who: '旁白', text: '但历史没有如果。在真正的时空里，那个被时代伤透了心的女人，最终按下了发射键。' }
    ], () => {
      TB.UI.titleCard('平行结局', '沉默的地球', 2400, () => {
        TB.UI.choice('重返1979年的那个夜晚吗？', [
          { label: '重新抉择', value: 'retry' },
          { label: '返回主菜单', value: 'menu' }
        ], v => v === 'retry' ? this.makeChoice() : TB.Game.toMenu());
      });
    });
  }
};
