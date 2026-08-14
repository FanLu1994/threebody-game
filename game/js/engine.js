/* ============================================================
 * 三体 · 红岸纪事 — 引擎核心 engine.js
 * 基于 Three.js r128，无外部资源，全部程序化生成
 * ============================================================ */
'use strict';
window.TB = window.TB || {};

/* ---------------- 工具 ---------------- */
TB.Util = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a, b) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(TB.Util.rand(a, b + 1)),
  pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
  deg: (d) => d * Math.PI / 180,
  canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  },
  /* 值噪声地形高度（叠加正弦，够用且稳定） */
  noise2(x, z) {
    return Math.sin(x * 0.011 + 1.7) * Math.cos(z * 0.013 + 0.6) * 1.0
         + Math.sin(x * 0.041 - 2.1) * Math.cos(z * 0.037 + 1.3) * 0.45
         + Math.sin(x * 0.107 + z * 0.093) * 0.18
         + Math.sin(x * 0.31 - z * 0.27) * 0.06;
  }
};

/* ---------------- 时间线（章节切换自动清理） ---------------- */
TB.Timeline = function () { this.items = []; };
TB.Timeline.prototype = {
  after(d, fn) { this.items.push({ t: d, fn, int: 0 }); },
  every(d, fn) { this.items.push({ t: d, fn, int: d }); },
  update(dt) {
    const done = [];
    for (const it of this.items) {
      it.t -= dt;
      while (it.t <= 0) {
        try { it.fn(); } catch (e) { console.error(e); }
        if (it.int > 0) it.t += it.int;
        else { done.push(it); break; }
      }
    }
    if (done.length) this.items = this.items.filter(i => !done.includes(i));
  },
  clear() { this.items = []; }
};

/* ---------------- 音频（WebAudio 合成，无外部文件） ---------------- */
TB.Audio = {
  ctx: null, master: null, muted: false, _droneNodes: null,
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(f = 440, d = 0.12, type = 'sine', vol = 0.18, slideTo = 0) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + d);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + d + 0.02);
  },
  noise(d = 0.4, vol = 0.25, cutoff = 1200) {
    if (this.muted || !this.ctx) return;
    const t0 = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * d);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = cutoff;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t0);
  },
  uiTick() { this.tone(660, 0.05, 'square', 0.05); },
  success() { this.tone(523, 0.1, 'sine', 0.15); setTimeout(() => this.tone(784, 0.16, 'sine', 0.15), 90); setTimeout(() => this.tone(1046, 0.22, 'sine', 0.12), 200); },
  fail() { this.tone(220, 0.3, 'sawtooth', 0.12, 110); },
  drone(on) {
    if (this.muted) on = false;
    if (!this.ctx) return;
    if (on && !this._droneNodes) {
      const g = this.ctx.createGain(); g.gain.value = 0.045;
      const flt = this.ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 240;
      const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
      const o2 = this.ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.7;
      o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(this.master);
      o1.start(); o2.start();
      this._droneNodes = { o1, o2, g };
    } else if (!on && this._droneNodes) {
      try { this._droneNodes.o1.stop(); this._droneNodes.o2.stop(); } catch (e) {}
      this._droneNodes = null;
    }
  }
};

/* ---------------- 引擎 ---------------- */
TB.Engine = {
  renderer: null, camera: null, scene: null,
  current: null, _trackedEls: [],
  shakeAmt: 0, clock0: performance.now(),

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 6000);
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    let stepping = false;
    const step = (now) => {
      if (stepping) return;
      stepping = true;
      try {
        const dt = Math.min(0.05, (now - this.clock0) / 1000);
        this.clock0 = now;
        if (this.current && this.current.update) this.current.update(dt);
        if (this.shakeAmt > 0.001) {
          this.shakeAmt *= Math.pow(0.02, dt);
          this.camera.position.x += TB.Util.rand(-1, 1) * this.shakeAmt;
          this.camera.position.y += TB.Util.rand(-1, 1) * this.shakeAmt;
        }
        if (this.scene) this.renderer.render(this.scene, this.camera);
      } finally { stepping = false; }
    };
    const loop = (now) => { requestAnimationFrame(loop); step(now); };
    requestAnimationFrame(loop);
    /* rAF 停摆（页面后台/最小化）时用低频心跳维持游戏时间线；只推进逻辑、不做渲染，
       避免隐藏状态下强制 WebGL 绘制导致渲染进程卡死 */
    setInterval(() => {
      const now = performance.now();
      if (now - this.clock0 > 400) {
        const dt = Math.min(0.05, (now - this.clock0) / 1000);
        this.clock0 = now;
        try {
          if (this.current && this.current.update) this.current.update(dt);
        } catch (e) { console.error(e); }
      }
    }, 250);
  },

  el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    document.getElementById('ui-root').appendChild(e);
    this._trackedEls.push(e);
    return e;
  },
  clearTracked() {
    for (const e of this._trackedEls) e.remove();
    this._trackedEls = [];
  },

  disposeScene(scene) {
    scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
          for (const k in m) if (m[k] && m[k].isTexture) m[k].dispose();
          m.dispose();
        });
      }
    });
  },

  setChapter(ch) {
    if (this.current && this.current.exit) this.current.exit();
    if (this.current && this.current.tl) this.current.tl.clear();
    if (this.current && this.current.dom) for (const d of this.current.dom) d.remove();
    if (this.scene) this.disposeScene(this.scene);
    TB.Audio.drone(false);
    this.clearTracked();
    this.scene = new THREE.Scene();
    this.current = ch;
    ch.scene = this.scene; ch.camera = this.camera;
    ch.tl = new TB.Timeline(); ch.dom = [];
    if (ch.enter) ch.enter();
  },

  /* ---------- 常用场景构件 ---------- */
  makeStars(n = 1500, radius = 3000) {
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().setFromSphericalCoords(radius, Math.acos(TB.Util.rand(-1, 1)), TB.Util.rand(0, Math.PI * 2));
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false }));
  },
  makeGlowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
    return TB.Util.canvasTexture(128, 128, (c, w, h) => {
      const g = c.createRadialGradient(64, 64, 2, 64, 64, 64);
      g.addColorStop(0, inner); g.addColorStop(0.35, inner.replace(',1)', ',0.55)')); g.addColorStop(1, outer);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
  },
  makeGlowSprite(color, scale = 30, opacity = 1) {
    const tex = this.makeGlowTexture(`rgba(${color},1)`, `rgba(${color},0)`);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity }));
    s.scale.set(scale, scale, 1);
    return s;
  },
  makeSkyDome(colorTop, colorBottom, radius = 4000) {
    const tex = TB.Util.canvasTexture(16, 256, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, colorTop); g.addColorStop(1, colorBottom);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    });
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, depthWrite: false, fog: false })
    );
  },
  /* 噪声地面（可着色） */
  makeTerrain(size = 1200, seg = 90, height = 60, colorFn) {
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = TB.Util.noise2(x, z) * height;
      pos.setY(i, h);
      const c = colorFn ? colorFn(x, z, h) : { r: 0.5, g: 0.5, b: 0.5 };
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  },
  /* 简易轨道相机 */
  makeOrbitCam(target, theta, phi, dist) {
    return {
      target: target.clone(), theta, phi, dist,
      apply(cam) {
        const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
        cam.position.set(
          this.target.x + this.dist * sp * Math.sin(this.theta),
          this.target.y + this.dist * cp,
          this.target.z + this.dist * sp * Math.cos(this.theta)
        );
        cam.lookAt(this.target);
      }
    };
  },
  /* 粒子爆发系统（水花/火花通用） */
  makeBurstSystem(count = 800) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0.9, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const sys = {
      obj: pts,
      burst(x, y, z, n, spread, up, color) {
        mat.color.set(color === undefined ? 0xffffff : color);
        let spawned = 0;
        for (let i = 0; i < count && spawned < n; i++) {
          if (life[i] > 0) continue;
          pos.set([x + TB.Util.rand(-spread, spread), y, z + TB.Util.rand(-spread, spread)], i * 3);
          vel.set([TB.Util.rand(-6, 6), TB.Util.rand(up * 0.4, up), TB.Util.rand(-6, 6)], i * 3);
          life[i] = TB.Util.rand(0.6, 1.4); spawned++;
        }
        geo.attributes.position.needsUpdate = true;
      },
      update(dt) {
        let any = false;
        for (let i = 0; i < count; i++) {
          if (life[i] <= 0) continue;
          any = true; life[i] -= dt;
          vel[i * 3 + 1] -= 25 * dt;
          pos[i * 3] += vel[i * 3] * dt;
          pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
          if (pos[i * 3 + 1] < 0) { pos[i * 3 + 1] = 0; vel[i * 3 + 1] *= -0.3; life[i] -= dt * 2; }
          if (life[i] <= 0) pos[i * 3 + 1] = -999;
        }
        if (any) geo.attributes.position.needsUpdate = true;
      }
    };
    return sys;
  }
};

/* ---------------- UI（DOM 覆盖层） ---------------- */
TB.UI = {
  dialogEl: null, _dlgQueue: [], _dlgCb: null, _typing: false, _typeTimer: null, _fullText: '', _hideTimer: null,

  init() {
    this.dialogEl = document.getElementById('dialog');
    const d = this.dialogEl;
    d.addEventListener('click', () => this.advanceDialog());
    this._txtEl = d.querySelector('.txt');
    this._whoEl = d.querySelector('.who');
  },
  /* 对话队列：lines = [{who, text}, ...] */
  say(lines, cb) {
    this._dlgQueue = lines.slice();
    this._dlgCb = cb || null;
    this.dialogEl.classList.remove('hidden');
    this._next();
  },
  _next() {
    const item = this._dlgQueue.shift();
    if (!item) {
      this.dialogEl.classList.add('hidden');
      const cb = this._dlgCb; this._dlgCb = null;
      if (cb) cb();
      return;
    }
    this._whoEl.textContent = item.who || '';
    this._whoEl.style.display = item.who ? '' : 'none';
    this._fullText = item.text;
    this._txtEl.textContent = '';
    this._typing = true;
    this.dialogEl.querySelector('.hint').style.visibility = 'hidden';
    let i = 0;
    clearInterval(this._typeTimer);
    this._typeTimer = setInterval(() => {
      i++;
      this._txtEl.textContent = this._fullText.slice(0, i);
      if (i % 3 === 0) TB.Audio.tone(TB.Util.rand(700, 900), 0.015, 'square', 0.012);
      if (i >= this._fullText.length) {
        clearInterval(this._typeTimer); this._typing = false;
        this.dialogEl.querySelector('.hint').style.visibility = '';
      }
    }, 26);
  },
  advanceDialog() {
    if (this.dialogEl.classList.contains('hidden')) return;
    const now = performance.now();
    if (this._lastAdv && now - this._lastAdv < 80) return; /* 防止一次点击双推进 */
    this._lastAdv = now;
    if (this._typing) {
      clearInterval(this._typeTimer); this._typing = false;
      this._txtEl.textContent = this._fullText;
      this.dialogEl.querySelector('.hint').style.visibility = '';
    } else this._next();
  },
  /* 选项：options=[{label, value, danger}] */
  choice(title, options, cb) {
    const panel = document.getElementById('choice-panel');
    panel.innerHTML = `<div class="choice-title">${title}</div>`;
    panel.classList.remove('hidden');
    options.forEach(op => {
      const b = document.createElement('button');
      b.className = 'choice-btn' + (op.danger ? ' danger' : '');
      b.textContent = op.label;
      b.onclick = (e) => {
        e.stopPropagation();
        TB.Audio.uiTick();
        panel.classList.add('hidden');
        cb(op.value);
      };
      panel.appendChild(b);
    });
  },
  toast(text, ms = 2400) {
    const t = document.getElementById('toast');
    t.textContent = text; t.classList.add('show');
    clearTimeout(this._hideTimer);
    this._hideTimer = setTimeout(() => t.classList.remove('show'), ms);
  },
  objective(html) {
    const o = document.getElementById('objective');
    if (!html) { o.classList.add('hidden'); return; }
    o.innerHTML = html; o.classList.remove('hidden');
  },
  bigText(html, ms = 2000, cb) {
    const b = document.getElementById('bigtext');
    b.innerHTML = html; b.classList.add('show');
    setTimeout(() => { b.classList.remove('show'); if (cb) cb(); }, ms);
  },
  titleCard(main, sub, hold, cb) {
    const t = document.getElementById('titlecard');
    t.innerHTML = `<div class="tc-main">${main}</div><div class="tc-sub">${sub || ''}</div>`;
    t.classList.add('show');
    setTimeout(() => { t.classList.remove('show'); if (cb) cb(); }, hold);
  },
  fadeTo(black, durMs, cb) {
    const f = document.getElementById('fade');
    f.style.transition = `opacity ${durMs}ms ease`;
    f.style.opacity = black ? 1 : 0;
    if (cb) setTimeout(cb, durMs + 30);
  },
  letterbox(on) {
    document.getElementById('lb-top').classList.toggle('show', !!on);
    document.getElementById('lb-bottom').classList.toggle('show', !!on);
  },
  hudVisible(v) { document.getElementById('hud-zone').style.display = v ? '' : 'none'; }
};

/* ---------------- 输入路由 ---------------- */
TB.Input = {
  init(canvas) {
    this.canvas = canvas;
    canvas.addEventListener('pointerdown', e => {
      TB.Audio.ensure();
      if (TB.UI && TB.UI._typing) { TB.UI.advanceDialog(); }
      const ch = TB.Engine.current;
      if (ch && ch.onDown) ch.onDown(e);
    });
    canvas.addEventListener('pointermove', e => {
      const ch = TB.Engine.current;
      if (ch && ch.onMove) ch.onMove(e);
    });
    canvas.addEventListener('pointerup', e => {
      const ch = TB.Engine.current;
      if (ch && ch.onUp) ch.onUp(e);
    });
    window.addEventListener('keydown', e => {
      TB.Audio.ensure();
      if (e.key === ' ' || e.key === 'Enter') {
        if (TB.UI && !TB.UI.dialogEl.classList.contains('hidden')) { TB.UI.advanceDialog(); e.preventDefault(); return; }
      }
      const ch = TB.Engine.current;
      if (ch && ch.onKey) ch.onKey(e);
    });
  }
};
