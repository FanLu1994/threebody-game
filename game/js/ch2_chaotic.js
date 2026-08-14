/* 第二章 · 乱纪元 —— "三体"游戏：观飞星、脱水与浸泡的生存轮回 */
'use strict';
TB.Chapters = TB.Chapters || {};

/* 昼夜脚本：type: stable / hot / cold */
TB.Chapters.chaos = {
  id: 'chaos',
  DAYS: [
    { type: 'stable', dur: 15 },
    { type: 'stable', dur: 12 },
    { type: 'hot', dur: 13 },
    { type: 'stable', dur: 11 },
    { type: 'cold', dur: 16 },
    { type: 'hot', dur: 10 },
    { type: 'cold', dur: 13 }
  ],

  enter() {
    const S = this.scene, U = TB.Util, E = TB.Engine;
    this.civNum = 183;
    this.dayIdx = -1; this.dayT = 0; this.phase = 'intro'; /* intro -> play -> finale -> dead */
    this.pop = 5000; this.dehydrated = false; this.progress = 0; this.temp = 18;
    this.dayState = null; this.warningDone = false;

    S.background = new THREE.Color(0x0d0a12);
    S.fog = new THREE.FogExp2(0x241a12, 0.0016);
    S.add(new THREE.HemisphereLight(0x556677, 0x1a1210, 0.5));
    this.hemi = S.children[0];
    this.sunLight = new THREE.DirectionalLight(0xffe0b0, 0.8);
    this.sunLight.position.set(1, 2, 1);
    S.add(this.sunLight);
    S.add(E.makeSkyDome('#0d0a12', '#2a1a10'));
    const stars = E.makeStars(600, 3300);
    stars.material.transparent = true; stars.material.opacity = 0.25;
    S.add(stars); this.stars = stars;

    /* 荒漠地形 */
    const terrain = E.makeTerrain(3000, 80, 26, (x, z, h) => {
      const v = U.clamp(h / 26 * 0.5 + 0.5, 0, 1);
      return { r: U.lerp(0.30, 0.55, v), g: U.lerp(0.20, 0.38, v), b: U.lerp(0.12, 0.22, v) };
    });
    S.add(terrain); this.terrain = terrain;

    /* 金字塔（黑色，四面） */
    const pyr = new THREE.Mesh(
      new THREE.ConeGeometry(46, 78, 4),
      new THREE.MeshLambertMaterial({ color: 0x17131c })
    );
    pyr.position.set(0, 39, -130); pyr.rotation.y = Math.PI / 4;
    S.add(pyr); this.pyramid = pyr;
    const gate = new THREE.Mesh(new THREE.PlaneGeometry(10, 14), new THREE.MeshBasicMaterial({ color: 0xff8c3a }));
    gate.position.set(0, 8, -86); S.add(gate); this.gate = gate;

    /* 干仓 */
    const barnMat = new THREE.MeshLambertMaterial({ color: 0x4a4038 });
    for (let i = 0; i < 3; i++) {
      const barn = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 10), barnMat);
      barn.position.set(-60 + i * 60, 4, -40);
      S.add(barn);
    }

    /* 人群（实例化） */
    const N = 240;
    this.peopleData = [];
    for (let i = 0; i < N; i++) {
      const a = U.rand(0, Math.PI * 2), r = 12 + Math.pow(Math.random(), 0.6) * 55;
      this.peopleData.push({ x: Math.sin(a) * r - 10, z: -60 + Math.cos(a) * r * 0.7, ry: U.rand(0, Math.PI * 2) });
    }
    const dummy = new THREE.Object3D();
    const bodyGeo = new THREE.ConeGeometry(0.55, 2.1, 6);
    const people = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0x8a7a5c }), N);
    const bundleGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.6, 6);
    const bundles = new THREE.InstancedMesh(bundleGeo, new THREE.MeshLambertMaterial({ color: 0xb09a6e }), N);
    for (let i = 0; i < N; i++) {
      const d = this.peopleData[i];
      dummy.position.set(d.x, 1.05, d.z); dummy.rotation.set(0, d.ry, 0); dummy.updateMatrix();
      people.setMatrixAt(i, dummy.matrix);
      dummy.position.set(d.x + 4, 0.35, d.z + 6); dummy.rotation.set(0, d.ry, Math.PI / 2); dummy.updateMatrix();
      bundles.setMatrixAt(i, dummy.matrix);
    }
    people.count = N; bundles.count = 0;
    S.add(people); S.add(bundles);
    this.people = people; this.bundles = bundles;

    /* 太阳与飞星 */
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(46, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd070, fog: false }));
    this.sunGlow = E.makeGlowSprite('255,190,90', 500, 0.95);
    S.add(this.sun); S.add(this.sunGlow); this.setSunVisible(false);
    this.flyStars = [];
    for (let i = 0; i < 3; i++) {
      const fs = E.makeGlowSprite('200,220,255', 26, 1);
      fs.visible = false; S.add(fs); this.flyStars.push(fs);
    }

    /* 相机 */
    this.orbit = E.makeOrbitCam(new THREE.Vector3(-10, 8, -60), 0.3, 1.35, 240);
    this.orbit.apply(this.camera);

    /* HUD */
    this.hud = TB.Engine.el('div', 'ch-hud left');
    this.hud.innerHTML = `
      <div class="panel">
        <div class="p-title" id="c-civ">第183号文明 · 中世纪层次</div>
        <div class="row-line"><span>昼夜</span><b id="c-day">—</b><span class="gap"></span><span>天象</span><b id="c-sky">—</b></div>
        <div class="row-line"><span>人口</span><b id="c-pop">5000</b></div>
        <div class="row-line"><span>温度</span>
          <div class="tempbar"><div id="c-tempfill"></div><div class="zone"></div></div><b id="c-temp">18°C</b></div>
        <div class="row-line"><span>文明发展</span>
          <div class="tempbar small"><div id="c-progfill" style="background:#7ec8ff"></div></div><b id="c-prog">0%</b></div>
      </div>
      <div class="panel sky-legend">
        <div class="p-title small">飞星观测口诀</div>
        <div>一或两颗飞星 —— 太阳尚远</div>
        <div>三颗飞星 —— 长夜将至</div>
        <div>飞星不动 —— 至凶之兆</div>
      </div>`;
    this.btnDry = TB.Engine.el('button', 'big-btn warn', '脱 水');
    this.btnSoak = TB.Engine.el('button', 'big-btn', '浸 泡');
    this.btnDry.style.left = 'calc(50% - 170px)';
    this.btnSoak.style.left = 'calc(50% + 170px)';
    this.btnDry.onclick = () => this.dehydrate();
    this.btnSoak.onclick = () => this.soak();
    this.btnDry.style.display = this.btnSoak.style.display = 'none'; /* 对话期间隐藏，避免遮挡 */

    /* 开场 */
    this.tl.after(0.6, () => {
      TB.UI.say([
        { who: '《三体》游戏', text: '欢迎来到三体世界。这里有一切都不可预测的昼与夜——乱纪元与恒纪元毫无规律地交替。' },
        { who: '《三体》游戏', text: '文明在乱纪元里脱水休眠，像卷起的干燥纤维；在恒纪元里浸泡复苏，继续生长。' },
        { who: '《三体》游戏', text: '学会观测飞星。它们是远方的太阳——三颗齐现，长夜将至；飞星不动，灾祸临头。' },
        { who: '《三体》游戏', text: '现在，请带领第183号文明，活过接下来的七个昼夜。' }
      ], () => { this.nextDay(); });
    });
  },

  setSunVisible(v) { this.sun.visible = v; this.sunGlow.visible = v; },

  nextDay() {
    this.dayIdx++;
    if (this.dayIdx >= this.DAYS.length) { this.startFinale(); return; }
    const d = this.DAYS[this.dayIdx];
    this.dayState = d; this.dayT = 0; this.warningDone = false;
    this.phase = 'play';
    this.btnDry.style.display = this.btnSoak.style.display = '';
    const labels = { stable: '恒纪元 · 日出正常', hot: '乱纪元 · 异常天象', cold: '乱纪元 · 长夜' };
    const names = { stable: '恒纪元', hot: '烈焰将至', cold: '长夜将至' };
    TB.UI.toast(`第 ${this.dayIdx + 1} 昼夜 · ${names[d.type]}`, 2600);
    document.getElementById('c-day').textContent = `${this.dayIdx + 1} / ${this.DAYS.length}`;
    if (d.type === 'stable') {
      this.setSunVisible(true);
      this.sun.material.color.set(0xffd070);
      this.sunGlow.scale.setScalar(500);
      this.flyStars.forEach((fs, i) => { fs.visible = i < 2; });
      document.getElementById('c-sky').textContent = '1颗飞星';
    } else if (d.type === 'hot') {
      this.setSunVisible(false);
      this.flyStars.forEach((fs, i) => {
        fs.visible = i === 0;
        fs.scale.setScalar(40); /* 飞星不动 —— 又大又亮 */
      });
      document.getElementById('c-sky').textContent = '飞星不动！';
    } else {
      this.setSunVisible(false);
      this.flyStars.forEach(fs => { fs.visible = true; fs.scale.setScalar(26); });
      document.getElementById('c-sky').textContent = '3颗飞星';
    }
    TB.Audio.tone(d.type === 'stable' ? 520 : 240, 0.25, d.type === 'stable' ? 'sine' : 'sawtooth', 0.12);
  },

  dehydrate() {
    if (this.dehydrated || this.phase !== 'play') return;
    this.dehydrated = true;
    TB.Audio.noise(0.5, 0.12, 900);
    TB.UI.toast('全文明脱水。干燥的躯体被收入干仓，等待恒纪元。');
    this.refreshPeople();
  },
  soak() {
    if (!this.dehydrated || this.phase !== 'play') return;
    if (this.temp < -2 || this.temp > 42) {
      TB.UI.toast('湖水还在致命的温度区间，现在浸泡就是死亡。', 2000);
      TB.Audio.fail();
      return;
    }
    this.dehydrated = false;
    TB.Audio.success();
    TB.UI.toast('浸泡完成——文明在湖水中复苏。');
    this.refreshPeople();
  },
  refreshPeople() {
    const ratio = TB.Util.clamp(this.pop / 5000, 0, 1);
    this.people.count = Math.round(this.peopleData.length * ratio);
    this.bundles.count = this.dehydrated ? (this.peopleData.length - this.people.count) : 0;
  },

  startFinale() {
    const S = this.scene, E = TB.Engine;
    this.phase = 'finale';
    this.btnDry.style.display = 'none'; this.btnSoak.style.display = 'none';
    TB.UI.objective(null);
    this.setSunVisible(false);
    this.flyStars.forEach(fs => fs.visible = false);
    /* 三颗太阳 */
    this.triSuns = [];
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(60, 20, 14), new THREE.MeshBasicMaterial({ color: i === 1 ? 0xff8050 : 0xffc860, fog: false }));
      const g = E.makeGlowSprite(i === 1 ? '255,110,60' : '255,200,100', 700, 1);
      S.add(s); S.add(g);
      this.triSuns.push({ mesh: s, glow: g, a: i * Math.PI * 2 / 3 });
    }
    this.finaleT = 0;
    TB.Audio.drone(true);
    TB.UI.bigText('<span class="red">三日凌空</span>', 2600);
    this.tl.after(3.2, () => {
      TB.UI.say([
        { who: '旁白', text: '三颗太阳同时升上了地平线，像一台缓缓转动的死亡风扇。' },
        { who: '《三体》游戏', text: `第${this.civNum}号文明，在三日凌空中毁灭了。该文明的进化层次：中世纪。` },
        { who: '《三体》游戏', text: '这个游戏想告诉你的一切，此刻揭晓——这里是一个拥有三颗恒星的世界。三体问题，在数学上不可解。' },
        { who: '《三体》游戏', text: '三体文明的出路只有一个：飞向四光年外，那颗只有一个太阳、永远稳定的行星。' },
        { who: '《三体》游戏', text: '那颗行星，叫做地球。' }
      ], () => {
        TB.UI.fadeTo(true, 1000, () => {
          TB.UI.titleCard('第三章', '人 列 计 算 机', 2800, () => TB.Game.next('chaos'));
        });
      });
    });
  },

  dieOut() {
    this.phase = 'dead';
    this.pop = 0; this.refreshPeople();
    this.btnDry.style.display = 'none'; this.btnSoak.style.display = 'none';
    TB.Audio.fail();
    this.civNum++;
    TB.UI.bigText('<span class="red">文明毁灭</span>', 2200);
    this.tl.after(2.4, () => {
      const again = TB.Engine.el('div', 'center-panel');
      again.innerHTML = `<div class="cp-title">第${this.civNum - 1}号文明消亡了</div>
        <div class="cp-text">乱纪元毫无规律。但游戏允许轮回——文明将再次萌发。</div>`;
      const btn = TB.Engine.el('button', 'big-btn', '第' + this.civNum + '号文明 · 重新开始');
      btn.onclick = () => {
        again.remove(); btn.remove();
        this.pop = 5000; this.dehydrated = false; this.progress = 0; this.temp = 18;
        this.dayIdx = -1; this.refreshPeople();
        document.getElementById('c-civ').textContent = `第${this.civNum}号文明 · 中世纪层次`;
        this.btnDry.style.display = ''; this.btnSoak.style.display = '';
        this.nextDay();
      };
    });
  },

  update(dt) {
    this.tl.update(dt);
    const S = this.scene, U = TB.Util;

    /* 昼夜推进 */
    if (this.phase === 'play' && this.dayState) {
      this.dayT += dt;
      const d = this.dayState, p = TB.Util.clamp(this.dayT / d.dur, 0, 1);
      let target = 22;
      if (d.type === 'stable') {
        const theta = U.lerp(2.7, 0.45, p), el = Math.sin(p * Math.PI) * 0.85 + 0.04;
        const dir = new THREE.Vector3(Math.sin(theta) * Math.cos(el), Math.sin(el), Math.cos(theta) * Math.cos(el));
        this.sun.position.copy(dir).multiplyScalar(2400);
        this.sunGlow.position.copy(this.sun.position);
        target = 14 + Math.sin(p * Math.PI) * 14;
      } else if (d.type === 'hot') {
        if (!this.warningDone && p > 0.25) {
          this.warningDone = true;
          TB.UI.toast('飞星不动——巨日正在逼近！脱水！', 2200);
          TB.Audio.tone(150, 0.5, 'sawtooth', 0.18); TB.Engine.shakeAmt = 1.2;
        }
        if (p > 0.35) {
          this.setSunVisible(true);
          this.sun.material.color.set(0xff5030);
          this.sunGlow.material.color.set(0xffffff);
          this.sunGlow.scale.setScalar(1500);
          const theta = U.lerp(2.5, 0.6, (p - 0.35) / 0.65), el = Math.sin((p - 0.35) / 0.65 * Math.PI) * 0.3 + 0.06;
          const dir = new THREE.Vector3(Math.sin(theta) * Math.cos(el), Math.sin(el), Math.cos(theta) * Math.cos(el));
          this.sun.position.copy(dir).multiplyScalar(2000);
          this.sunGlow.position.copy(this.sun.position);
          this.sun.scale.setScalar(2.6);
        }
        target = 20 + Math.max(0, (p - 0.3)) * 140;
      } else { /* cold */
        if (!this.warningDone && p > 0.2) {
          this.warningDone = true;
          TB.UI.toast('三颗飞星显现——漫长的严寒长夜！脱水！', 2200);
          TB.Audio.tone(190, 0.5, 'sawtooth', 0.18);
        }
        target = 15 - Math.max(0, (p - 0.25)) * 120;
        this.stars.material.opacity = 0.9;
      }
      if (d.type !== 'cold') this.stars.material.opacity = TB.Util.lerp(this.stars.material.opacity, 0.25, dt * 2);
      this.temp = U.lerp(this.temp, target, TB.Util.clamp(dt * 0.28, 0, 1));

      /* 生存判定 */
      const lethal = this.temp > 46 || this.temp < -8;
      if (lethal && !this.dehydrated) {
        this.pop -= 300 * dt;
        if (Math.random() < dt * 6) TB.Audio.noise(0.1, 0.05, 500);
        if (this.pop <= 0) { this.pop = 0; this.refreshPeople(); this.dieOut(); }
      }
      const comfy = this.temp > 0 && this.temp < 38 && !this.dehydrated;
      if (comfy) this.progress = Math.min(100, this.progress + dt * 6.5);

      /* HUD 刷新 */
      const tf = document.getElementById('c-tempfill');
      if (tf) {
        const ratio = TB.Util.clamp((this.temp + 60) / 160, 0, 1);
        tf.style.width = (ratio * 100) + '%';
        tf.style.background = this.temp > 46 ? '#ff5030' : this.temp < -8 ? '#6ab0ff' : '#9fd488';
        document.getElementById('c-temp').textContent = Math.round(this.temp) + '°C';
        document.getElementById('c-pop').textContent = Math.max(0, Math.round(this.pop));
        document.getElementById('c-prog').textContent = Math.round(this.progress) + '%';
        document.getElementById('c-progfill').style.width = this.progress + '%';
      }
      if (this.temp > 46 || this.temp < -8) {
        if (!this.dehydrated && Math.floor(this.dayT * 2) % 4 === 0) this.refreshPeople();
      } else if (!this._wasComfy) this.refreshPeople();
      this._wasComfy = comfy;

      if (p >= 1) { /* 短暂黑夜过渡 */
        this.phase = 'nightgap'; this.setSunVisible(false);
        this.flyStars.forEach(fs => fs.visible = false);
        this.tl.after(2.2, () => this.nextDay());
      }
    }
    if (this.phase === 'nightgap') {
      this.temp = U.lerp(this.temp, -5, dt * 0.4);
      this.stars.material.opacity = 0.95;
    }

    /* 三日凌空演出 */
    if (this.phase === 'finale' && this.triSuns) {
      this.finaleT += dt;
      const rise = TB.Util.clamp(this.finaleT / 6, 0, 1);
      const R = 700 + Math.sin(this.finaleT * 0.25) * 60;
      this.triSuns.forEach(s => {
        const a = s.a + this.finaleT * 0.12;
        const x = -10 + Math.cos(a) * R * 0.8, z = -130 + Math.sin(a) * R * 0.5;
        const y = U.lerp(-150, 900, rise);
        s.mesh.position.set(x, y, z);
        s.glow.position.copy(s.mesh.position);
      });
      this.temp = U.lerp(this.temp, 300, dt * 0.3);
      this.terrain.material.emissive = new THREE.Color(0x330b05);
      this.people.count = Math.max(0, Math.round(this.people.count - dt * 40));
      this.bundles.count = Math.max(0, Math.round(this.bundles.count - dt * 40));
      this.sunLight.intensity = 1.6;
      this.scene.fog.color.set(0x481408);
    }

    /* 相机呼吸 */
    this.orbit.theta += dt * 0.012;
    if (this.phase !== 'finale') this.orbit.apply(this.camera);
    else {
      this.camera.position.set(-10, 40, 180);
      this.camera.lookAt(0, 300, -130);
    }
  }
};
