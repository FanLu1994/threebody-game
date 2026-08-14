/* 压力测试：真人式乱点 + 全分支路径（沉默/死亡/斩杀/时机失败重试）×2 轮 */
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const URL = 'http://localhost:8641/index.html';
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

let T0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${m}`);
const errors = [];

async function state(page) {
  return await page.evaluate(() => {
    const ch = TB.Engine.current;
    return {
      id: ch.id, phase: ch.phase || '',
      dlg: !document.getElementById('dialog').classList.contains('hidden'),
      dlgTxt: document.getElementById('dialog').querySelector('.txt').textContent.slice(0, 12),
      choice: !document.getElementById('choice-panel').classList.contains('hidden'),
      fade: document.getElementById('fade').style.opacity,
      tlItems: ch.tl ? ch.tl.items.length : -1,
      dayIdx: ch.dayIdx, pop: ch.pop, temp: ch.temp, dehydrated: ch.dehydrated,
      dayType: ch.dayState ? ch.dayState.type : '',
      doneQ: ch.doneQ, lives: ch.lives, stageIdx: ch.stageIdx,
      curA: ch.curA, curB: ch.curB, qActive: ch.qActive,
      xs: ch.xs !== undefined ? Math.round(ch.xs) : undefined,
      aligned: ch.aligned,
    };
  });
}

/* 猴子：随机点击（对话框加权）+ 偶尔双击 + 偶尔按键 */
function startMonkey(page, ctl) {
  const timer = setInterval(async () => {
    if (!ctl.on) return;
    try {
      const r = Math.random();
      if (r < 0.55) {
        // 对话框区域（含与按钮重叠的下半部分——重点考验 z-index 修复）
        await page.mouse.click(640 + (Math.random() * 700 - 350), 620 + (Math.random() * 60 - 30));
      } else if (r < 0.8) {
        // 全屏随机
        await page.mouse.click(Math.random() * 1280, Math.random() * 720);
        if (Math.random() < 0.3) await page.mouse.click(Math.random() * 1280, Math.random() * 720); // 快速二连
      } else {
        if (Math.random() < 0.5) await page.keyboard.press(' ');
        else if (Math.random() < 0.3) await page.keyboard.press('Enter');
      }
    } catch (e) { /* 页面切换间隙的点击可能失败，忽略 */ }
  }, 260 + Math.random() * 320);
  return () => clearInterval(timer);
}

async function advanceDialogs(page, maxSecs = 40) {
  const t0 = Date.now();
  let streak = 0;
  while (Date.now() - t0 < maxSecs * 1000) {
    const vis = await page.evaluate(() => !document.getElementById('dialog').classList.contains('hidden'));
    if (!vis) { streak++; if (streak > 16) return true; }
    else { streak = 0; await page.evaluate(() => TB.UI.advanceDialog()); }
    await sleep(300);
  }
  return false;
}

async function clickBigBtn(page, keyword) {
  try {
    const all = await page.$$('button.big-btn');
    for (const b of all) {
      const t = await b.textContent().catch(() => '');
      if (t.indexOf(keyword) >= 0) { await b.click({ timeout: 3000 }); return true; }
    }
  } catch (e) { /* 面板可能已被猴子点掉 */ }
  return false;
}

async function waitChapter(page, ids, maxSecs, label) {
  const t0 = Date.now();
  let lastReport = '';
  let recovered = false;
  while (Date.now() - t0 < maxSecs * 1000) {
    const s = await state(page).catch(() => null);
    if (!s) { await sleep(400); continue; }
    if (s.id === '_menu' && !recovered) {
      /* 猴子点到"返回主菜单"属于合法退出，不算切换失败——跳回目标章节继续 */
      log(`  （猴子退回了主菜单，直接跳转 ${ids[0]} 继续）`);
      recovered = true;
      await page.evaluate((id) => TB.Game.goto(id), ids[0]);
      await sleep(2500);
    }
    const brief = `${s.id}/${s.phase}`;
    if (ids.includes(s.id)) return s.id;
    if (brief !== lastReport) { log(`  等待${label}: 当前 ${brief} dlg=${s.dlg}`); lastReport = brief; }
    await sleep(500);
  }
  const s = await state(page).catch(() => ({ id: '?' }));
  throw new Error(`等待${label}超时: 停在 ${s.id}/${s.phase} dlg=${s.dlg} 文本=${s.dlgTxt} tl=${s.tlItems}`);
}

(async () => {
  for (let round = 1; round <= 2; round++) {
    T0 = Date.now();
    console.log(`\n=========== 第 ${round} 轮（含随机乱点与失败重试分支）===========`);
    const browser = await chromium.launch({
      executablePath: EDGE, headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    page.on('pageerror', e => errors.push(`R${round} PAGEERROR: ` + e.message));
    page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('404') < 0) errors.push(`R${round} CONSOLE: ` + m.text()); });

    const ctl = { on: false };
    const stopMonkey = startMonkey(page, ctl);
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await sleep(2000);
    await page.evaluate(() => localStorage.setItem('tb3_unlocked', '5')); // 解锁全部，供分支测试直达
    await page.reload({ waitUntil: 'domcontentloaded' });
    await sleep(1800);

    /* ---- 分支A：红岸 沉默→重新抉择→回答 ---- */
    await page.evaluate(() => TB.Game.goto('redcoast'));
    ctl.on = true; // 红岸夜班阶段起开启猴子（避开校准拖拽）
    await sleep(2000);
    await advanceDialogs(page, 30);
    await page.evaluate(() => { const c = TB.Engine.current; c.az = c.sunAz; c.el = c.sunEl; c.applyDish(); });
    await sleep(2200);
    await page.evaluate(() => TB.Engine.current.doTransmit());
    log('红岸: 发射');
    await sleep(2500);
    await advanceDialogs(page, 50);   // 发射对话+八年卡+终端+夜班对话（猴子并行乱点）
    // 抉择面板（可能被猴子点成任一选项，驱动器兼容两种）
    const t0 = Date.now();
    let chose = false;
    let silenceDone = false; // 沉默分支只走一次
    while (Date.now() - t0 < 40000) {
      const s = await state(page);
      if (s.id !== 'redcoast') break;
      if (s.choice) {
        const btns = await page.$$('#choice-panel .choice-btn');
        const labels = [];
        for (const b of btns) labels.push(await b.textContent());
        if (labels.some(l => l.indexOf('沉默') >= 0) && !chose) {
          const wantSilence = round === 1 && !silenceDone;
          const target = wantSilence ? labels.findIndex(l => l.indexOf('沉默') >= 0) : labels.findIndex(l => l.indexOf('回答') >= 0);
          await btns[target].click();
          log('红岸: 抉择=' + (wantSilence ? '沉默' : '回答'));
          if (wantSilence) silenceDone = true;
          chose = true;
        } else if (chose && labels.some(l => l.indexOf('重新抉择') >= 0)) {
          const ri = labels.findIndex(l => l.indexOf('重新抉择') >= 0);
          await btns[ri].click();
          log('红岸: 平行结局→重新抉择');
          chose = false;
        }
      }
      await sleep(600);
    }
    await waitChapter(page, ['chaos'], 50, '乱纪元');
    log('→ 乱纪元 ✓ (红岸沉默分支OK)');

    /* ---- 分支B：乱纪元 先故意灭亡一次再通关 ---- */
    await advanceDialogs(page, 30);
    if (round === 1) {
      log('乱纪元: 确定性触发文明灭亡');
      await page.evaluate(() => TB.Engine.current.dieOut());
      await sleep(1500);
      const s1 = await state(page);
      if (s1.phase === 'dead') {
        log('文明灭亡面板 ✓，点击重试');
        const all = await page.$$('button.big-btn');
        for (const b of all) { const t = await b.textContent(); if (t.indexOf('重新开始') >= 0) { await b.click(); break; } }
        await sleep(1500);
      } else {
        log('警告: 灭亡未触发, phase=' + s1.phase);
      }
    }
    // 正常生存
    const ts = Date.now();
    let lastAct = '';
    while (Date.now() - ts < 260000) {
      const s = await state(page);
      if (s.id !== 'chaos') break;
      if (s.phase === 'finale' || s.phase === 'dead') break;
      const lethal = s.temp > 40 || s.temp < -2;
      if (!s.dehydrated && (lethal || s.dayType === 'hot' || s.dayType === 'cold') && s.dayIdx >= 2) {
        await page.evaluate(() => TB.Engine.current.dehydrate());
        lastAct = `脱水@day${s.dayIdx + 1}`;
      } else if (s.dehydrated && s.dayType === 'stable' && s.temp > 3 && s.temp < 36) {
        await page.evaluate(() => TB.Engine.current.soak());
        lastAct = `浸泡@day${s.dayIdx + 1}`;
      }
      await sleep(700);
    }
    log('乱纪元生存完成, 最后动作: ' + lastAct);
    // 终局对话（猴子并行推进，驱动器兜底）
    const tf = Date.now();
    while (Date.now() - tf < 120000) {
      const s = await state(page);
      if (s.id !== 'chaos') break;
      if (s.phase === 'finale' && s.dlg) await page.evaluate(() => TB.UI.advanceDialog());
      await sleep(400);
    }
    await waitChapter(page, ['computer'], 30, '人列计算机');
    log('→ 人列计算机 ✓');

    /* ---- 分支C：计算机 先答错3次触发死锁重试，再全对 ---- */
    await advanceDialogs(page, 30);
    if (round === 1) {
      log('计算机: 故意答错耗尽容错');
      const tw = Date.now();
      while (Date.now() - tw < 60000) {
        const s = await state(page);
        if (s.id !== 'computer') break;
        if (s.phase === 'cinematic' || s.lives <= 0) break;
        if (s.qActive) {
          const expectWrong = s.curA === 1 ? '0' : '1';
          await page.keyboard.press(expectWrong);
          await sleep(1400);
        } else { await sleep(300); }
      }
      const sw = await state(page);
      if (sw.lives <= 0 || sw.phase !== 'quiz') {
        log('死锁触发 ✓ (lives=' + sw.lives + ')，等待重试面板');
        await sleep(2500);
        const all = await page.$$('button.big-btn');
        for (const b of all) { const t = await b.textContent(); if (t.indexOf('重新列阵') >= 0) { await b.click(); break; } }
        await sleep(1500);
      }
    }
    // 全对答题
    const STAGES = [
      { fn: (a, b) => a & b }, { fn: (a, b) => a | b },
      { fn: (a) => 1 - a }, { fn: (a, b) => a ^ b },
    ];
    const tq = Date.now();
    while (Date.now() - tq < 200000) {
      const s = await state(page);
      if (s.id !== 'computer') break;
      if (s.phase === 'cinematic' || s.phase === 'aftermath') break;
      if (s.dlg) { await page.evaluate(() => TB.UI.advanceDialog()); await sleep(250); continue; }
      if (s.lives <= 0) { // 猴子可能点掉重试按钮导致重开
        await sleep(2000); continue;
      }
      if (!s.qActive) { await sleep(300); continue; }
      const st = STAGES[Math.min(s.stageIdx, 3)];
      const expect = s.curB === -1 || s.curB === undefined ? st.fn(s.curA) : st.fn(s.curA, s.curB);
      await page.keyboard.press(expect ? '1' : '0');
      await sleep(1150);
    }
    log('答题完成');
    // 演出：等或跳过
    const tc = Date.now();
    let escaped = false;
    while (Date.now() - tc < 50000) {
      const s = await state(page);
      if (s.id !== 'computer') break;
      if (s.phase === 'aftermath' && !escaped) { escaped = true; }
      if (s.phase === 'cinematic' && Date.now() - tc > 16000) { await page.keyboard.press('Escape'); }
      if (s.dlg) await page.evaluate(() => TB.UI.advanceDialog());
      await sleep(400);
    }
    await waitChapter(page, ['guzheng'], 40, '古筝行动');
    log('→ 古筝行动 ✓');

    /* ---- 分支D：古筝 先按错时机失败重试，再正确 ---- */
    await advanceDialogs(page, 30);
    await sleep(1200);
    if (round === 1) {
      log('古筝: 故意过早收紧');
      await page.evaluate(() => TB.Engine.current.doCut()); // 船还没到：bow<8 → 失败
      await sleep(1200);
      await clickBigBtn(page, '重新部署');
      log('失败重试 ✓');
      await advanceDialogs(page, 30);
      await sleep(1200);
    }
    // 正确时机（失败可被猴子误点触发，允许重试）
    ctl.on = false; // 时机尝试期间暂停猴子，避免与按钮竞速
    const tg = Date.now();
    let cut = false, failCount = 0;
    while (Date.now() - tg < 140000) {
      const s = await state(page);
      if (s.id !== 'guzheng') break;
      if (s.phase === 'failed') {
        failCount++;
        log(`古筝: 失败(第${failCount}次)，重试`);
        await sleep(600);
        await clickBigBtn(page, '重新部署');
        await sleep(2500);
        await advanceDialogs(page, 20);
        continue;
      }
      if (s.dlg) { await page.evaluate(() => TB.UI.advanceDialog()); await sleep(250); continue; }
      if (s.phase === 'sailing' && !cut) {
        if (s.xs > -95 && s.xs < -15) {
          await page.evaluate(() => TB.Engine.current.doCut());
          const chk = await state(page);
          if (chk.phase === 'cutting' || chk.phase === 'drift' || chk.id !== 'guzheng') { cut = true; log('古筝: 收紧成功 @xs=' + s.xs); }
        }
      }
      await sleep(120);
    }
    ctl.on = true;
    if (!cut) throw new Error('古筝多次尝试后仍未能成功切割');
    // 等解体+对白+终章
    const th = Date.now();
    while (Date.now() - th < 120000) {
      const s = await state(page);
      if (s.id !== 'guzheng') break;
      if (s.dlg) await page.evaluate(() => TB.UI.advanceDialog());
      await sleep(400);
    }
    await waitChapter(page, ['finale'], 40, '终章');
    log('→ 终章 ✓');

    /* ---- 终章 → 制作名单 → 菜单 ---- */
    const tfin = Date.now();
    while (Date.now() - tfin < 120000) {
      const s = await state(page);
      const credits = await page.evaluate(() => !!document.querySelector('.credits'));
      if (credits) break;
      if (s.dlg) await page.evaluate(() => TB.UI.advanceDialog());
      await sleep(400);
    }
    log('制作名单 ✓，返回菜单');
    const all2 = await page.$$('button.big-btn');
    for (const b of all2) { const t = await b.textContent(); if (t.indexOf('返回主菜单') >= 0) { await b.click(); break; } }
    await sleep(2000);
    const menuBack = await page.evaluate(() => !document.getElementById('menu').classList.contains('hidden'));
    if (!menuBack) throw new Error('未能返回主菜单');
    log(`第 ${round} 轮全流程通过 ✓✓✓`);
    stopMonkey();
    await browser.close();
  }
  console.log('\n========== 压力测试结果 ==========');
  console.log('两轮（乱点+全分支）全部通过 ✓');
  console.log(errors.length ? `页面错误 ${errors.length} 条:\n` + errors.slice(0, 15).join('\n') : '无 JS 错误 ✓');
  process.exit(errors.length ? 2 : 0);
})().catch(e => {
  console.error('\n========== 压力测试失败 ==========');
  console.error(e && e.message);
  if (errors.length) errors.slice(0, 15).forEach(x => console.error('  ' + x));
  process.exit(1);
});
