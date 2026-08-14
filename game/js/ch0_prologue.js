/* 序章 · 疯狂年代 —— 叙事过场 */
'use strict';
TB.Chapters = TB.Chapters || {};
TB.Chapters.prologue = {
  id: 'prologue',
  enter() {
    const S = this.scene, U = TB.Util;
    S.background = new THREE.Color(0x0a0507);
    S.fog = new THREE.FogExp2(0x0a0507, 0.018);

    S.add(new THREE.HemisphereLight(0x3a2a2a, 0x0a0808, 0.5));
    const spot = new THREE.SpotLight(0xcfd8ff, 1.2, 200, TB.Util.deg(24), 0.5, 1.5);
    spot.position.set(0, 60, 20);
    S.add(spot);

    /* 黑色地面 */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshLambertMaterial({ color: 0x14100f })
    );
    ground.rotation.x = -Math.PI / 2;
    S.add(ground);

    /* 残破的旗帜（斜插在黑暗里） */
    const flagTex = U.canvasTexture(256, 160, (c, w, h) => {
      c.fillStyle = '#7a1210'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = 0; i < 40; i++) c.fillRect(U.rand(0, w), U.rand(0, h), U.rand(2, 20), U.rand(1, 4));
      c.fillStyle = 'rgba(255,220,160,0.12)'; c.font = 'bold 46px serif';
      c.fillText('革', 40, 70); c.fillText('命', 40, 130);
    });
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 14),
      new THREE.MeshLambertMaterial({ map: flagTex, side: THREE.DoubleSide, transparent: true })
    );
    flag.position.set(0, 10, -6); flag.rotation.y = 0.4; flag.rotation.z = 0.06;
    S.add(flag);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 24), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    pole.position.set(-13.2, 11, -6); S.add(pole);

    /* 上升的火星粒子 */
    const n = 500, pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      pos.set([U.rand(-90, 90), U.rand(0, 70), U.rand(-90, 20)], i * 3);
      vel.push({ x: U.rand(-0.4, 0.4), y: U.rand(0.8, 2.4) });
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.embers = new THREE.Points(pg, new THREE.PointsMaterial({
      color: 0xff5a2a, size: 1.1, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    S.add(this.embers);
    this.emberVel = vel;

    this.cam = { t: 0 };
    this.camera.position.set(26, 14, 42);
    this.camera.lookAt(0, 10, 0);

    /* 开场白 */
    this.tl.after(1.2, () => {
      TB.UI.letterbox(true);
      TB.UI.say([
        { who: '旁白', text: '1967年，一个疯狂年代的雨夜。清华大学的物理教师叶哲泰，因为拒绝否认相对论与宇宙大爆炸理论，在批斗会上被自己的学生夺去了生命。' },
        { who: '旁白', text: '人群里，他的女儿叶文洁目睹了全过程。绝望，像一粒被雨水打湿的种子，落进了她心里的深处。' },
        { who: '旁白', text: '两年后，她在大兴安岭的生产建设兵团读到了《寂静的春天》——人类文明的狂妄，第一次以另一种面目出现在她眼前。' },
        { who: '旁白', text: '诬陷、批斗、冷冻的禁闭室……这个文明一次次地伤害她，也让她逐渐确信一件事：仅靠人类自身，无法约束人类的疯狂。' },
        { who: '叶文洁（内心）', text: '如果……有一个更高等的文明，来接管这个世界呢？' },
        { who: '旁白', text: '命运很快给了她机会——大兴安岭深处，一座代号"红岸"的绝密基地，需要一名天体物理专业人员。' }
      ], () => {
        TB.UI.titleCard('第一章', '红 岸', 2600, () => TB.Game.next('prologue'));
      });
    });
  },
  update(dt) {
    this.tl.update(dt);
    this.cam.t += dt;
    this.camera.position.x = 26 + Math.sin(this.cam.t * 0.1) * 4;
    this.camera.position.y = 14 + Math.sin(this.cam.t * 0.13) * 1.5;
    this.camera.lookAt(0, 10, 0);
    const p = this.embers.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + this.emberVel[i].y * dt;
      if (y > 75) y = 0;
      p.setY(i, y);
      p.setX(i, p.getX(i) + this.emberVel[i].x * dt);
    }
    p.needsUpdate = true;
  }
};
