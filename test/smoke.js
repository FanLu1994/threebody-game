/* 冒烟测试：菜单可见性 */
const { chromium } = require('playwright-core');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && m.text().indexOf('404') < 0) errs.push(m.text()); });
  await page.goto('http://localhost:8641/index.html', { waitUntil: 'domcontentloaded' });
  await sleep(3500);
  await page.screenshot({ path: 'shots/smoke-menu.png' });
  const fadeOp = await page.evaluate(() => document.getElementById('fade').style.opacity || '1(default)');
  console.log('菜单遮罩透明度: ' + fadeOp + ' (应为0)');
  console.log('JS错误: ' + (errs.length ? errs.join('; ') : '无'));
  await browser.close();
})();
