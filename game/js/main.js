/* 主入口：菜单、章节流程、解锁存档 */
'use strict';
TB.Game = {
  ORDER: ['prologue', 'redcoast', 'chaos', 'computer', 'guzheng', 'finale'],
  META: {
    prologue: { n: '序章', t: '疯狂年代', d: '1967—1969 · 叙事' },
    redcoast: { n: '第一章', t: '红岸', d: '校准天线 · 发射 · 抉择' },
    chaos:    { n: '第二章', t: '乱纪元', d: '观飞星 · 脱水与浸泡' },
    computer: { n: '第三章', t: '人列计算机', d: '门电路士兵 · 逻辑运算' },
    guzheng:  { n: '第四章', t: '古筝行动', d: '纳米丝 · 切割时机' },
    finale:   { n: '终章', t: '虫子与舰队', d: '麦田与启航' }
  },

  unlocked() {
    const v = parseInt(localStorage.getItem('tb3_unlocked') || '0', 10);
    return v;
  },
  unlock(id) {
    const i = this.ORDER.indexOf(id);
    if (i >= 0 && this.unlocked() < i + 1) localStorage.setItem('tb3_unlocked', String(i + 1));
  },

  goto(id) {
    TB.UI.fadeTo(true, 700, () => {
      document.getElementById('menu').classList.add('hidden');
      TB.Engine.setChapter(TB.Chapters[id]);
      this.unlock(id);
      TB.UI.fadeTo(false, 900);
    });
  },
  next(afterId) {
    const i = this.ORDER.indexOf(afterId);
    this.unlock(afterId);
    const nid = this.ORDER[Math.min(i + 1, this.ORDER.length - 1)];
    this.goto(nid);
  },
  toMenu() {
    TB.UI.fadeTo(true, 700, () => {
      TB.Engine.setChapter(TB.Chapters._menu);
      document.getElementById('menu').classList.remove('hidden');
      TB.UI.letterbox(false);
      TB.UI.objective(null);
      this.refreshChapterSelect();
      TB.UI.fadeTo(false, 900);
    });
  },
  refreshChapterSelect() {
    const grid = document.getElementById('chapter-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const ul = this.unlocked();
    this.ORDER.forEach((id, i) => {
      const m = this.META[id];
      const locked = i > ul;
      const b = document.createElement('button');
      b.className = 'chapter-card' + (locked ? ' locked' : '');
      b.innerHTML = `<div class="cc-n">${m.n}</div><div class="cc-t">${m.t}</div><div class="cc-d">${locked ? '未解锁' : m.d}</div>`;
      if (!locked) b.onclick = () => {
        TB.Audio.uiTick();
        document.getElementById('chapter-panel').classList.add('hidden');
        TB.Game.goto(id);
      };
      grid.appendChild(b);
    });
  }
};

/* ---------------- 主菜单 3D 场景（三颗太阳） ---------------- */
TB.Chapters._menu = {
  id: '_menu',
  enter() {
    const S = this.scene, E = TB.Engine, U = TB.Util;
    S.background = new THREE.Color(0x03040a);
    S.add(E.makeStars(1800, 3600));
    this.suns = [];
    const cfg = [[0xff7a40, 340], [0xffc060, 240], [0xd0e8ff, 130]];
    cfg.forEach(([c, size], i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(size / 6, 18, 12), new THREE.MeshBasicMaterial({ color: c, fog: false }));
      const g = E.makeGlowSprite('255,190,120', size, 0.9);
      S.add(m); S.add(g);
      this.suns.push({ m, g, a: i * Math.PI * 2 / 3, r: 900 + i * 200 });
    });
    /* 一颗孤独的行星 */
    this.planet = new THREE.Mesh(
      new THREE.SphereGeometry(26, 20, 14),
      new THREE.MeshLambertMaterial({ color: 0x3a5a7a, emissive: 0x0a1420 })
    );
    S.add(this.planet);
    this.t = 0;
    this.camera.position.set(0, 0, 150);
  },
  update(dt) {
    this.t += dt;
    this.suns.forEach(s => {
      const a = s.a + this.t * 0.06;
      s.m.position.set(Math.cos(a) * s.r, Math.sin(a * 1.3) * 180, Math.sin(a) * s.r - 600);
      s.g.position.copy(s.m.position);
    });
    const pa = this.t * 0.18;
    this.planet.position.set(Math.cos(pa) * 420, Math.sin(pa * 0.7) * 40, Math.sin(pa) * 420 - 200);
    this.camera.position.x = Math.sin(this.t * 0.05) * 30;
    this.camera.lookAt(0, 0, -500);
  }
};

/* ---------------- 启动 ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('scene');
  TB.UI.init();
  TB.Input.init(canvas);
  TB.Engine.init(canvas);
  TB.Engine.setChapter(TB.Chapters._menu);
  TB.UI.fadeTo(false, 1200); /* 揭开初始黑幕，显示主菜单 */

  /* 菜单按钮 */
  document.getElementById('btn-start').onclick = () => {
    TB.Audio.uiTick();
    TB.Game.goto('prologue');
  };
  document.getElementById('btn-chapters').onclick = () => {
    TB.Audio.uiTick();
    TB.Game.refreshChapterSelect();
    document.getElementById('chapter-panel').classList.remove('hidden');
  };
  document.getElementById('btn-help').onclick = () => {
    TB.Audio.uiTick();
    document.getElementById('help-panel').classList.remove('hidden');
  };
  document.getElementById('btn-mute').onclick = (e) => {
    TB.Audio.muted = !TB.Audio.muted;
    if (TB.Audio.muted) TB.Audio.drone(false);
    e.target.textContent = TB.Audio.muted ? '音效：关' : '音效：开';
  };
  document.querySelectorAll('.close-panel').forEach(b => b.onclick = () => {
    b.closest('.modal').classList.add('hidden');
  });

  /* 允许点击对话外的空白处推进对话 */
  document.getElementById('app').addEventListener('pointerdown', () => {
    if (!TB.UI.dialogEl.classList.contains('hidden')) TB.UI.advanceDialog();
  }, true);
});
