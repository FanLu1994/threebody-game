/* 三体游戏 · 全流程自动化测试（无头 Edge + playwright-core） */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const URL = 'http://localhost:8641/index.html';
const SHOT_DIR = path.join(__dirname, 'shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

const errors = [];
const log = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${m}`);
let T0 = Date.now();

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') });
  log('截图 ' + name);
}

async function state(page) {
  return await page.evaluate(() => {
    const ch = TB.Engine.current;
    return {
      id: ch.id,
      phase: ch.phase || '',
      dayIdx: ch.dayIdx, pop: ch.pop, temp: ch.temp, dehydrated: ch.dehydrated,
      dayType: ch.dayState ? ch.dayState.type : '',
      progress: ch.progress,
      doneQ: ch.doneQ, lives: ch.lives, gate: document.getElementById('h-gate') ? document.getElementById('h-gate').textContent : '',
      inputs: ch.curA !== undefined ? `A=${ch.curA} B=${ch.curB}` : '',
      stageIdx: ch.stageIdx,
      xs: ch.xs !== undefined ? Math.round(ch.xs) : undefined,
      aligned: ch.aligned, align: ch.align,
      az: ch.az, el: ch.el,
    };
  });
}

async function advanceDialogs(page, maxSecs = 30) {
  const t0 = Date.now();
  let invisibleStreak = 0;
  while (Date.now() - t0 < maxSecs * 1000) {
    const visible = await page.evaluate(() => !document.getElementById('dialog').classList.contains('hidden'));
    if (!visible) {
      invisibleStreak++;
      if (invisibleStreak > 18) return true; // 持续6秒无对话才结束
    } else {
      invisibleStreak = 0;
      await page.evaluate(() => TB.UI.advanceDialog());
    }
    await sleep(330);
  }
  return false;
}

async function waitChapter(page, id, maxSecs = 60) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxSecs * 1000) {
    const cur = await page.evaluate(() => TB.Engine.current.id);
    if (cur === id) return true;
    await sleep(400);
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EDGE,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1380,820'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await sleep(2000);
  log('页面加载完成');
  await shot(page, '01-menu');

  /* ---- 序章 ---- */
  await page.click('#btn-start');
  log('点击开始游戏');
  await sleep(2500);
  await advanceDialogs(page, 40);
  await shot(page, '02-prologue');
  if (!(await waitChapter(page, 'redcoast', 20))) throw new Error('未进入红岸章节');
  log('进入红岸章节 ✓');
  await advanceDialogs(page, 40);

  /* ---- 红岸：对准天线 ---- */
  await page.evaluate(() => {
    const ch = TB.Engine.current;
    ch.az = ch.sunAz; ch.el = ch.sunEl; ch.applyDish();
  });
  await sleep(2200); // 对准保持1.4s
  const st = await state(page);
  log(`红岸对准: aligned=${st.aligned} align=${st.align.toFixed(3)}`);
  await shot(page, '03-redcoast-aligned');
  if (!st.aligned) throw new Error('天线未能对准');
  await page.click('button.big-btn.danger'); // 发射
  log('按下发射键');
  await sleep(3000);
  await shot(page, '04-redcoast-beam');
  await advanceDialogs(page, 40);
  await sleep(4200); // 八年后标题卡
  await sleep(5000); // 终端打字
  await shot(page, '05-terminal');
  await advanceDialogs(page, 40);
  // 抉择：回答
  await page.click('.choice-btn.danger');
  log('抉择：回答');
  await sleep(2500);
  await shot(page, '06-answer');
  await advanceDialogs(page, 40);
  if (!(await waitChapter(page, 'chaos', 25))) throw new Error('未进入乱纪元章节');
  log('进入乱纪元章节 ✓');

  /* ---- 乱纪元：生存 ---- */
  await advanceDialogs(page, 40);
  const chaosStart = Date.now();
  let lastAction = '';
  while (Date.now() - chaosStart < 240000) {
    const s = await state(page);
    if (s.id !== 'chaos') break;
    if (s.phase === 'finale' || s.phase === 'dead') break;
    const lethal = s.temp > 40 || s.temp < -2;
    if (!s.dehydrated && (lethal || s.dayType === 'hot' || s.dayType === 'cold')) {
      if (s.dayIdx >= 2 || lethal) { // 第3天起才需要脱水
        await page.click('button.big-btn.warn');
        lastAction = `脱水@day${s.dayIdx + 1} ${Math.round(s.temp)}°C`;
        continue;
      }
    }
    if (s.dehydrated && s.dayType === 'stable' && s.temp > 3 && s.temp < 36) {
      await page.evaluate(() => TB.Engine.current.soak());
      lastAction = `浸泡@day${s.dayIdx + 1}`;
      continue;
    }
    await sleep(700);
  }
  log('乱纪元生存结束, 最后动作: ' + lastAction);
  const s2 = await state(page);
  log(`状态: phase=${s2.phase} day=${s2.dayIdx + 1} pop=${Math.round(s2.pop)} 进化=${Math.round(s2.progress)}%`);
  await shot(page, '07-chaos-endgame');
  // 推进终局对话（等出现）
  const tFin = Date.now();
  while (Date.now() - tFin < 60000) {
    const vis = await page.evaluate(() => !document.getElementById('dialog').classList.contains('hidden'));
    const s = await state(page);
    if (s.id !== 'chaos') break;
    if (vis) break;
    await sleep(500);
  }
  await advanceDialogs(page, 40);
  await shot(page, '08-chaos-finale');
  if (!(await waitChapter(page, 'computer', 20))) throw new Error('未进入人列计算机章节');
  log('进入人列计算机章节 ✓');

  /* ---- 人列计算机：答题 ---- */
  await advanceDialogs(page, 40);
  const STAGES = [
    { name: '与门', fn: (a, b) => a & b },
    { name: '或门', fn: (a, b) => a | b },
    { name: '非门', fn: (a) => 1 - a },
    { name: '异或门', fn: (a, b) => a ^ b },
  ];
  const quizStart = Date.now();
  let quizDone = false, wrongAllowed = 0;
  while (Date.now() - quizStart < 180000) {
    const s = await state(page);
    if (s.id !== 'computer') { quizDone = true; break; }
    if (s.phase === 'cinematic') { quizDone = true; break; }
    const dlgVis = await page.evaluate(() => !document.getElementById('dialog').classList.contains('hidden'));
    if (dlgVis) { await advanceDialogs(page, 15); continue; }
    const stage = STAGES[s.stageIdx];
    if (!stage) { await sleep(500); continue; }
    const inputStr = await page.evaluate(() => document.getElementById('h-inputs').textContent);
    const mA = inputStr.indexOf('入1 黑旗') >= 0 ? 1 : 0;
    const hasB = inputStr.indexOf('入2 —') < 0;
    const mB = hasB ? (inputStr.indexOf('入2 黑旗') >= 0 ? 1 : 0) : -1;
    if (inputStr.indexOf('等待') >= 0) { await sleep(300); continue; }
    const expect = mB === -1 ? stage.fn(mA) : stage.fn(mA, mB);
    await page.keyboard.press(expect ? '1' : '0');
    await sleep(1150);
  }
  log(`答题阶段结束 quizDone=${quizDone}`);
  await shot(page, '09-computer-quiz-end');
  // 演出：等待或跳过（先等12秒截图，再Esc）
  await sleep(6000);
  await shot(page, '10-computer-cinematic');
  await sleep(10000);
  await shot(page, '11-computer-suns');
  await page.keyboard.press('Escape'); // 跳到结局对话
  log('Esc 跳过演出');
  await advanceDialogs(page, 40);
  if (!(await waitChapter(page, 'guzheng', 20))) throw new Error('未进入古筝行动章节');
  log('进入古筝行动章节 ✓');

  /* ---- 古筝行动 ---- */
  await advanceDialogs(page, 40);
  await sleep(1500);
  await shot(page, '12-guzheng-canal');
  const cutStart = Date.now();
  let cutDone = false;
  while (Date.now() - cutStart < 90000) {
    const s = await state(page);
    if (s.id !== 'guzheng') { cutDone = true; break; }
    if (s.phase === 'failed') throw new Error('古筝行动失败: 时机错误');
    if (s.phase === 'sailing') {
      const xs = s.xs;
      if (xs > -95 && xs < -10) {
        await page.click('button.big-btn.danger');
        log(`收紧纳米丝 @xs=${xs}`);
        cutDone = true;
        break;
      }
    }
    await sleep(150);
  }
  if (!cutDone) throw new Error('未能执行切割');
  await sleep(3500);
  await shot(page, '13-guzheng-cutting');
  // 等待解体完成
  const collT = Date.now();
  while (Date.now() - collT < 60000) {
    const s = await state(page);
    if (s.id !== 'guzheng') break;
    if (s.phase === 'done' || s.phase === undefined) break;
    await sleep(800);
  }
  await shot(page, '14-guzheng-collapse');
  await sleep(3000);
  await advanceDialogs(page, 40);
  await sleep(4000); // 你们是虫子
  await shot(page, '15-bugs-message');
  if (!(await waitChapter(page, 'finale', 20))) throw new Error('未进入终章');
  log('进入终章 ✓');

  /* ---- 终章 ---- */
  await advanceDialogs(page, 60);
  await sleep(2000);
  await shot(page, '16-finale-field');
  // 等待切到太空
  const spT = Date.now();
  while (Date.now() - spT < 60000) {
    const s = await state(page);
    if (s.phase === 'space') break;
    await sleep(500);
  }
  log('舰队场景');
  await sleep(2500);
  await shot(page, '17-finale-fleet');
  await advanceDialogs(page, 60);
  await sleep(4600); // 450年大字
  await advanceDialogs(page, 60);
  await sleep(1500);
  await shot(page, '18-credits');
  const creditsVisible = await page.evaluate(() => !!document.querySelector('.credits'));
  log('制作名单显示: ' + creditsVisible);
  // 返回主菜单
  const menuBtns = await page.$$('button.big-btn');
  for (const b of menuBtns) {
    const t = await b.textContent();
    if (t.indexOf('返回主菜单') >= 0) { await b.click(); break; }
  }
  await sleep(2500);
  await shot(page, '19-back-to-menu');
  const menuBack = await page.evaluate(() => !document.getElementById('menu').classList.contains('hidden'));
  log('返回主菜单: ' + menuBack);

  console.log('\n========== 测试结果 ==========');
  console.log('全流程通过 ✓');
  if (errors.length) {
    console.log('页面错误(' + errors.length + '):');
    errors.slice(0, 20).forEach(e => console.log('  ' + e));
  } else {
    console.log('无 JS 错误 ✓');
  }
  await browser.close();
})().catch(e => {
  console.error('\n========== 测试失败 ==========');
  console.error(e && e.message);
  if (errors.length) errors.slice(0, 20).forEach(x => console.error('  ' + x));
  process.exit(1);
});
