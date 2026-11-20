// ภาพหน้าจอจริงแบบ "ไม่มีป้ายหมายเลข" สำหรับสไลด์ฉบับเข้าใจง่าย -> docs/presentation/simple/shots/
// ต้องรัน `npx vite preview --port 4173` ก่อน แล้ว: node scripts/make-shots-clean.cjs
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.resolve(__dirname, '../docs/presentation/simple/shots');
fs.mkdirSync(OUT, { recursive: true });
const ROOT = 'http://localhost:4173/#/';

async function shot(p, name, locs, pad = 12) {
  const rects = [];
  for (const l of locs) { await l.scrollIntoViewIfNeeded(); rects.push(await l.boundingBox()); }
  const x0 = Math.max(0, Math.min(...rects.map((r) => r.x)) - pad), y0 = Math.max(0, Math.min(...rects.map((r) => r.y)) - pad);
  const x1 = Math.max(...rects.map((r) => r.x + r.width)) + pad, y1 = Math.max(...rects.map((r) => r.y + r.height)) + pad;
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  console.log('shot', name);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1250, height: 2600 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('tt-session', JSON.stringify({ role: 'admin' })); } catch (e) {} });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  const ss = () => p.locator('.ss-input');

  await p.goto(ROOT); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.getByRole('button', { name: /ลองใช้ด้วยข้อมูลตัวอย่าง/ }).click();
  await p.waitForTimeout(300);

  // กรอกข้อมูล: ครู
  await p.goto(`${ROOT}input?tab=teachers`);
  await p.waitForTimeout(300);
  await shot(p, 'input-teachers', [p.locator('.tabs'), p.locator('.card').nth(1)]);
  // กำหนดการเรียน (ฟอร์ม + ตาราง)
  await p.goto(`${ROOT}input?tab=assignments`);
  await p.waitForTimeout(300);
  await shot(p, 'input-assign', [p.locator('.tabs'), p.locator('.card').nth(2)]);

  // จัดตาราง
  await p.goto(ROOT);
  await p.getByLabel('เวลาประมวลผลสูงสุด').selectOption('5');
  await p.getByRole('button', { name: /^⚙ จัดตารางอัตโนมัติ/ }).click();
  await p.getByText(/จัดตารางครบทุกคาบ/).waitFor({ timeout: 60000 });
  await ss().first().click(); await ss().first().fill('6701'); await p.locator('.ss-opt').first().click();
  await p.waitForTimeout(400);
  await shot(p, 'dash-result', [p.locator('.card').filter({ hasText: 'แสดงตารางของ' }).first(), p.locator('table.tt')]);
  await shot(p, 'dash-grid', [p.locator('table.tt')]);
  await shot(p, 'dash-status', [p.locator('.card').filter({ hasText: 'แสดงตารางของ' }).first()]);

  // เผยแพร่
  await p.goto(`${ROOT}publish`);
  await p.getByPlaceholder('เช่น ภาคเรียนที่ 1/2569').fill('ภาคเรียนที่ 1/2569');
  await p.getByRole('button', { name: 'สร้างรหัสให้' }).nth(0).click();
  await p.getByRole('button', { name: 'สร้างรหัสให้' }).nth(1).click();
  const c0 = p.locator('.card').nth(0);
  await shot(p, 'publish', [c0.locator('.form-row').first(), c0.locator('.form-row').nth(1), p.getByRole('button', { name: /สร้างไฟล์เผยแพร่/ })]);
  const SP = await p.getByLabel('รหัสสำหรับนักเรียน').inputValue();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /สร้างไฟล์เผยแพร่/ }).click()]);
  fs.mkdirSync(path.join(OUT, 'tmp'), { recursive: true });
  const PUB = path.join(OUT, 'tmp', 'published.enc.json');
  await dl.saveAs(PUB);

  // มือถือของนักเรียน
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  await m.goto(ROOT);
  await m.locator('input[type=file]').setInputFiles(PUB);
  await m.getByText(/พบตารางที่เผยแพร่/).waitFor();
  await m.getByLabel('รหัสผ่าน').fill(SP);
  await m.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await m.getByRole('heading', { level: 1, name: /ตารางเรียน/ }).waitFor();
  await m.waitForTimeout(400);
  await m.screenshot({ path: `${OUT}/phone-viewer.png`, clip: { x: 0, y: 0, width: 390, height: 780 } });
  console.log('shot phone-viewer');
  fs.rmSync(path.join(OUT, 'tmp'), { recursive: true, force: true });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
