// ถ่ายภาพหน้าจอจริงของแอปสำหรับคู่มือ พร้อมใส่หมายเลข/กรอบแดงชี้ปุ่ม
// ต้องรัน `npx vite preview --port 4173` ก่อน แล้ว: node scripts/make-shots.cjs
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, '../docs/shots');
fs.mkdirSync(OUT, { recursive: true });
const URL_ROOT = 'http://localhost:4173/#/';

/** ใส่กรอบแดง + วงกลมหมายเลขที่มุมซ้ายบนของ element */
async function mark(loc, n) {
  await loc.scrollIntoViewIfNeeded();
  await loc.evaluate((el, n) => {
    el.setAttribute('data-ann', '1');
    el.style.outline = '3px solid #e0533d';
    el.style.outlineOffset = '2px';
    const r = el.getBoundingClientRect();
    const b = document.createElement('div');
    b.className = '__ann';
    b.textContent = String(n);
    Object.assign(b.style, {
      position: 'absolute', left: `${r.left + window.scrollX - 12}px`, top: `${r.top + window.scrollY - 14}px`,
      width: '26px', height: '26px', lineHeight: '26px', borderRadius: '50%', background: '#e0533d', color: '#fff',
      fontWeight: '700', textAlign: 'center', fontSize: '15px', zIndex: '99999', boxShadow: '0 1px 3px rgba(0,0,0,.45)', fontFamily: 'Sarabun, sans-serif',
    });
    document.body.appendChild(b);
  }, n);
}
const clearMarks = (page) => page.evaluate(() => {
  document.querySelectorAll('.__ann').forEach((e) => e.remove());
  document.querySelectorAll('[data-ann]').forEach((e) => { e.style.outline = ''; e.style.outlineOffset = ''; e.removeAttribute('data-ann'); });
});
/** ถ่ายภาพบริเวณที่ครอบ locator ทั้งหมด (viewport สูงพอจึงไม่ต้องเลื่อนหน้า) */
async function shot(page, name, locs, pad = 16) {
  const rects = [];
  for (const l of locs) { await l.scrollIntoViewIfNeeded(); rects.push(await l.boundingBox()); }
  const x0 = Math.max(0, Math.min(...rects.map((r) => r.x)) - pad);
  const y0 = Math.max(0, Math.min(...rects.map((r) => r.y)) - pad);
  const x1 = Math.max(...rects.map((r) => r.x + r.width)) + pad;
  const y1 = Math.max(...rects.map((r) => r.y + r.height)) + pad;
  await page.screenshot({ path: `${OUT}/${name}.png`, clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  await clearMarks(page);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 2600 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('tt-session', JSON.stringify({ role: 'admin' })); } catch (e) {} });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept());
  const tab = (key) => p.goto(`${URL_ROOT}input?tab=${key}`).then(() => p.waitForTimeout(250));
  const ss = () => p.locator('.ss-input');

  // ---------- 1) ผู้ใช้ใหม่: การ์ดเริ่มต้น ----------
  await p.goto(URL_ROOT);
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload();
  await p.locator('.guide').waitFor();
  await mark(p.getByRole('button', { name: /ลองใช้ด้วยข้อมูลตัวอย่าง/ }), 1);
  await shot(p, 'guide-new', [p.locator('.guide')]);

  // ---------- 2) โหลดตัวอย่าง + จัดตาราง ----------
  await p.getByRole('button', { name: /ลองใช้ด้วยข้อมูลตัวอย่าง/ }).click();
  await p.waitForTimeout(300);
  await p.getByLabel('เวลาประมวลผลสูงสุด').selectOption('5');
  await p.getByRole('button', { name: /^⚙ จัดตารางอัตโนมัติ/ }).click();
  await p.getByText(/จัดตารางครบทุกคาบ/).waitFor({ timeout: 60000 });
  await ss().first().click(); await ss().first().fill('6701'); await p.locator('.ss-opt').first().click();
  await p.waitForTimeout(300);
  await mark(p.getByRole('button', { name: /^⚙ จัดตารางอัตโนมัติ/ }), 2);
  await mark(p.locator('.seg'), 3);
  await mark(p.getByRole('button', { name: 'Export PDF' }), 4);
  await shot(p, 'dash-result', [p.locator('.card').first(), p.locator('table.tt')]);

  // ---------- 3) ตั้งค่าคาบเรียน ----------
  await tab('settings');
  await p.addStyleTag({ content: 'table.data tbody tr:nth-child(n+4){display:none}' });
  await mark(p.locator('.form-row').first(), 1);
  await mark(p.getByLabel('จำนวนคาบต่อวัน'), 2);
  await mark(p.getByLabel('พักเที่ยงหลังคาบที่'), 3);
  await mark(p.locator('table.data').first(), 4);
  await mark(p.getByRole('button', { name: 'บันทึกการตั้งค่า' }), 5);
  await shot(p, 'settings', [p.locator('.card').nth(1)]);

  // ---------- 4) ครู: ฟอร์ม + Template + Import ----------
  await tab('teachers');
  await mark(p.locator('form.form-row').first(), 1);
  await mark(p.locator('.btn-group[aria-label="ดาวน์โหลด Template"]'), 2);
  await mark(p.getByRole('button', { name: /Import จากไฟล์/ }), 3);
  await shot(p, 'teachers', [p.locator('.card').nth(1)]);

  // ---------- 5) กำหนดการเรียน ----------
  await tab('assignments');
  await ss().nth(0).click(); await ss().nth(0).fill('บัญชี'); await p.locator('.ss-opt').first().click();
  await p.locator('.smulti').nth(0).locator('label', { hasText: 'สุนีย์' }).first().locator('input').check();
  await p.locator('.smulti').nth(2).locator('label', { hasText: '6701' }).first().locator('input').check();
  await p.locator('.smulti').nth(2).locator('label', { hasText: '6702' }).first().locator('input').check();
  await ss().nth(1).click(); await ss().nth(1).fill('อาคาร 1'); await p.locator('.ss-opt').first().click();
  await ss().nth(2).click(); await ss().nth(2).fill('101'); await p.locator('.ss-opt').first().click();
  await p.mouse.click(5, 5);
  await mark(ss().nth(0), 1);
  await mark(p.locator('.smulti').nth(0), 2);
  await mark(p.locator('.smulti').nth(2), 3);
  await mark(ss().nth(1), 4);
  await mark(p.locator('.radio-row'), 5);
  await mark(p.getByRole('button', { name: 'บันทึก', exact: true }), 6);
  await shot(p, 'assign', [p.locator('.card').nth(1)]);

  // ---------- 6) กรณีพิเศษ ----------
  await tab('special');
  await p.getByPlaceholder('เช่น คาบกิจกรรม').fill('ประชุมครู');
  await p.locator('.smulti').nth(1).locator('label', { hasText: 'นางสมศรี' }).first().locator('input').check();
  await p.locator('textarea').fill('วันอังคาร คาบ 1-2');
  await p.waitForTimeout(200);
  await mark(p.getByPlaceholder('เช่น คาบกิจกรรม'), 1);
  await mark(p.locator('textarea'), 2);
  await mark(p.locator('.msg.ok').first(), 3);
  const card = p.locator('.card').nth(1);
  await shot(p, 'special', [card.locator('form')]);
  // ตัดกลับไม่ให้ฟอร์มกรณีพิเศษค้าง (ไม่บันทึก)

  // ---------- 7) เผยแพร่ ----------
  await p.goto(`${URL_ROOT}publish`);
  await p.getByPlaceholder('เช่น ภาคเรียนที่ 1/2569').fill('ภาคเรียนที่ 1/2569');
  await p.getByRole('button', { name: 'สร้างรหัสให้' }).nth(0).click();
  await p.getByRole('button', { name: 'สร้างรหัสให้' }).nth(1).click();
  await mark(p.getByPlaceholder('เช่น ภาคเรียนที่ 1/2569'), 1);
  await mark(p.getByRole('button', { name: 'สร้างรหัสให้' }).nth(0), 2);
  await mark(p.getByRole('button', { name: /สร้างไฟล์เผยแพร่/ }), 3);
  await shot(p, 'publish', [p.locator('.card').nth(0).locator('.form-row').first(), p.locator('.card').nth(0).locator('.form-row').nth(1), p.getByRole('button', { name: /สร้างไฟล์เผยแพร่/ })]);
  const SP = await p.getByLabel('รหัสสำหรับนักเรียน').inputValue();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: /สร้างไฟล์เผยแพร่/ }).click()]);
  fs.mkdirSync(path.join(OUT, 'tmp'), { recursive: true });
  const PUB = path.join(OUT, 'tmp', 'published.enc.json');
  await dl.saveAs(PUB);

  // ---------- 8) มือถือของนักเรียน/ครู ----------
  const mctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const m = await mctx.newPage();
  await m.goto(URL_ROOT);
  await m.locator('input[type=file]').setInputFiles(PUB);
  await m.getByText(/พบตารางที่เผยแพร่/).waitFor();
  await m.getByLabel('รหัสผ่าน').fill(SP);
  await mark(m.locator('.login-more .link'), 1);
  await mark(m.getByLabel('รหัสผ่าน'), 2);
  await mark(m.getByRole('button', { name: 'เข้าสู่ระบบ' }), 3);
  await shot(m, 'm-login', [m.locator('.login-card')], 12);
  await m.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await m.getByRole('heading', { level: 1, name: /ตารางเรียน/ }).waitFor();
  await m.waitForTimeout(300);
  await mark(m.locator('.ss-input'), 4);
  await mark(m.getByRole('button', { name: 'Export PDF' }), 5);
  await shot(m, 'm-viewer', [m.locator('main.main > h1'), m.locator('.card').first()], 12);

  fs.rmSync(path.join(OUT, 'tmp'), { recursive: true, force: true });
  await browser.close();
  console.log('shots done:', fs.readdirSync(OUT).join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
