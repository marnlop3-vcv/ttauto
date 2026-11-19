// ภาพประกอบสำหรับ "คู่มือใช้งานโดยสรุป" (docs/standalone) — ต้องรัน `npx vite preview --port 4173` ก่อน
// ใช้: node scripts/make-shots-quick.cjs   -> docs/standalone/raw/*.png (แล้วรัน docs/standalone/prepare-images.py ย่อขนาด)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../docs/standalone/raw');
fs.mkdirSync(OUT, { recursive: true });
const ROOT = 'http://localhost:4173/#/';

async function mark(loc, n) {
  await loc.scrollIntoViewIfNeeded();
  await loc.evaluate((el, n) => {
    el.setAttribute('data-ann', '1');
    el.style.outline = '3px solid #e0533d'; el.style.outlineOffset = '2px';
    const r = el.getBoundingClientRect();
    const b = document.createElement('div'); b.className = '__ann'; b.textContent = String(n);
    Object.assign(b.style, { position: 'absolute', left: `${r.left + window.scrollX - 12}px`, top: `${r.top + window.scrollY - 14}px`, width: '26px', height: '26px', lineHeight: '26px', borderRadius: '50%', background: '#e0533d', color: '#fff', fontWeight: '700', textAlign: 'center', fontSize: '15px', zIndex: '99999', boxShadow: '0 1px 3px rgba(0,0,0,.45)' });
    document.body.appendChild(b);
  }, n);
}
const clear = (p) => p.evaluate(() => {
  document.querySelectorAll('.__ann').forEach((e) => e.remove());
  document.querySelectorAll('[data-ann]').forEach((e) => { e.style.outline = ''; e.style.outlineOffset = ''; e.removeAttribute('data-ann'); });
});
async function shot(p, name, locs, pad = 16) {
  const rects = [];
  for (const l of locs) { await l.scrollIntoViewIfNeeded(); rects.push(await l.boundingBox()); }
  const x0 = Math.max(0, Math.min(...rects.map((r) => r.x)) - pad), y0 = Math.max(0, Math.min(...rects.map((r) => r.y)) - pad);
  const x1 = Math.max(...rects.map((r) => r.x + r.width)) + pad, y1 = Math.max(...rects.map((r) => r.y + r.height)) + pad;
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  await clear(p);
  console.log('shot', name);
}

(async () => {
  const browser = await chromium.launch();
  // ---------- ผู้ดูแล: เตรียมข้อมูลตัวอย่าง + จัดตาราง + สร้างไฟล์เผยแพร่ ----------
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 2600 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('tt-session', JSON.stringify({ role: 'admin' })); } catch (e) {} });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  const tab = (key) => p.goto(`${ROOT}input?tab=${key}`).then(() => p.waitForTimeout(250));

  await p.goto(ROOT); await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.getByRole('button', { name: /ลองใช้ด้วยข้อมูลตัวอย่าง/ }).click();
  await p.waitForTimeout(300);

  // 4) แท็บข้อมูล: แถบแท็บ + ฟอร์มครู / ฟอร์มอาคาร
  await tab('teachers');
  const tabs = p.locator('.tabs');
  await mark(tabs.getByRole('button', { name: 'ครู', exact: true }), 1);
  await mark(tabs.getByRole('button', { name: 'กลุ่มเรียน', exact: true }), 2);
  await mark(tabs.getByRole('button', { name: 'วิชาเรียน', exact: true }), 3);
  await mark(tabs.getByRole('button', { name: 'ห้องเรียน', exact: true }), 4);
  await mark(p.locator('form.form-row').first(), 5);
  await mark(p.getByRole('button', { name: /Import จากไฟล์/ }), 6);
  await shot(p, 'q4-teachers', [tabs, p.locator('.card').nth(1)]);
  await tab('buildings');
  await mark(p.locator('form.form-row').first(), 1);
  await shot(p, 'q4-buildings', [p.locator('.tabs'), p.locator('.card').nth(1).locator('form')], 5);

  // 5) กรณีพิเศษ: วันพุธ คาบ 3
  await tab('special');
  await p.getByPlaceholder('เช่น คาบกิจกรรม').fill('ชุมนุม');
  await p.locator('textarea').fill('วันพุธ คาบ 3');
  await p.waitForTimeout(200);
  await mark(p.getByPlaceholder('เช่น คาบกิจกรรม'), 1);
  await mark(p.locator('textarea'), 2);
  await mark(p.locator('.msg.ok').first(), 3);
  await mark(p.getByRole('button', { name: 'เพิ่มกรณีพิเศษ' }).first(), 4);
  const f = p.locator('.card').nth(1).locator('form');
  await shot(p, 'q5-special', [f.getByText('ชื่อกรณีพิเศษ'), f.getByText('เงื่อนไข (พิมพ์เป็นภาษาไทย)'), p.locator('.msg.ok').first(), p.getByRole('button', { name: 'เพิ่มกรณีพิเศษ' }).first()], 30);

  // 7) จัดตาราง
  await p.goto(ROOT);
  await p.getByLabel('เวลาประมวลผลสูงสุด').selectOption('5');
  await p.getByRole('button', { name: /^⚙ จัดตารางอัตโนมัติ/ }).click();
  await p.getByText(/จัดตารางครบทุกคาบ/).waitFor({ timeout: 60000 });
  await p.waitForTimeout(300);
  await mark(p.getByLabel('เวลาประมวลผลสูงสุด'), 1);
  await mark(p.getByRole('button', { name: /^⚙ จัดตารางอัตโนมัติ/ }), 2);
  await mark(p.locator('.msg.ok').first(), 3);
  await mark(p.locator('.seg'), 4);
  await shot(p, 'q7-run', [p.locator('.card').filter({ hasText: 'แสดงตารางของ' }).first()]);

  // 8) เผยแพร่
  await p.goto(`${ROOT}publish`);
  await p.getByPlaceholder('เช่น ภาคเรียนที่ 1/2569').fill('ภาคเรียนที่ 1/2569');
  await p.getByRole('button', { name: 'สร้างรหัสให้' }).nth(0).click();
  await p.getByRole('button', { name: 'สร้างรหัสให้' }).nth(1).click();
  const c0 = p.locator('.card').nth(0);
  await mark(p.getByPlaceholder('เช่น ภาคเรียนที่ 1/2569'), 1);
  await mark(p.getByLabel('รหัสสำหรับนักเรียน'), 2);
  await mark(p.getByLabel('รหัสสำหรับครู'), 3);
  await mark(p.getByRole('button', { name: /สร้างไฟล์เผยแพร่/ }), 4);
  await shot(p, 'q8-publish', [c0.locator('.form-row').first(), c0.locator('.form-row').nth(1), p.getByRole('button', { name: /สร้างไฟล์เผยแพร่/ })]);
  const SP = await p.getByLabel('รหัสสำหรับนักเรียน').inputValue();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /สร้างไฟล์เผยแพร่/ }).click()]);
  fs.mkdirSync(path.join(OUT, 'tmp'), { recursive: true });
  const PUB = path.join(OUT, 'tmp', 'published.enc.json');
  await dl.saveAs(PUB);
  await p.getByRole('heading', { level: 2, name: /2\) นำไฟล์ไปเผยแพร่/ }).waitFor();

  // 9) ข้อความแจก + ปุ่มคัดลอก (แทนที่ลิงก์ localhost ด้วยลิงก์เว็บจริงเฉพาะในภาพ)
  await p.evaluate(() => document.querySelectorAll('.codeblock').forEach((e) => { e.textContent = e.textContent.split(location.origin + '/').join('https://marnlop3-vcv.github.io/ttauto/'); }));
  await mark(p.getByRole('button', { name: 'คัดลอกข้อความนักเรียน' }), 1);
  await mark(p.getByRole('button', { name: 'คัดลอกข้อความครู' }), 2);
  const h3 = p.getByRole('heading', { level: 3, name: /ข้อความแจ้งผู้ดู/ });
  await shot(p, 'q9-share', [h3, p.locator('.cols').first()], 6);

  // ---------- ผู้ใช้ทั่วไป: หน้าเข้าสู่ระบบ ----------
  const uctx = await browser.newContext({ viewport: { width: 1100, height: 1500 }, deviceScaleFactor: 2 });
  const u = await uctx.newPage();
  await u.goto(ROOT);
  await u.getByRole('button', { name: /ใช้งานเป็นผู้ดูแล/ }).waitFor();
  await u.waitForTimeout(500);
  const card = u.locator('.login-card');
  await shot(u, 'q1-open', [card], 24);                       // ภาพหน้าเว็บ ไม่มีป้าย
  await mark(u.getByRole('button', { name: /ใช้งานเป็นผู้ดูแล/ }), 1);
  await mark(u.locator('.login-more .link'), 2);
  await mark(u.getByLabel('รหัสผ่าน'), 3);
  await shot(u, 'q2-login', [card], 24);                      // ภาพอธิบายตัวเลือกเข้าสู่ระบบ
  await u.locator('input[type=file]').setInputFiles(PUB);
  await u.getByText(/พบตารางที่เผยแพร่/).waitFor();
  await u.getByLabel('รหัสผ่าน').fill(SP);
  await u.getByRole('button', { name: 'แสดง' }).click();
  await mark(u.locator('.login-status'), 1);
  await mark(u.getByLabel('รหัสผ่าน'), 2);
  await mark(u.getByRole('button', { name: 'เข้าสู่ระบบ' }), 3);
  await shot(u, 'q2-file', [card], 24);                       // ภาพหลังเลือกไฟล์ + ใส่รหัส

  fs.rmSync(path.join(OUT, 'tmp'), { recursive: true, force: true });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
