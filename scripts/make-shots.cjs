// ถ่ายภาพหน้าจอจริงของแอปสำหรับคู่มือ (ต้องรัน `npx vite preview --port 4173` ก่อน)
const { chromium } = require('playwright');
const path = require('path');
const OUT = path.resolve(__dirname, '../docs/shots');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 2 });
  page.on('dialog', (d) => d.accept());
  await page.addInitScript(() => { try { sessionStorage.setItem('tt-session', JSON.stringify({ role: 'admin' })); } catch (e) {} });
  const tab = (t) => page.locator('.tabs button', { hasText: new RegExp(`^${t}$`) }).click();
  await page.goto('http://localhost:4173/#/input');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('tt-notice-v1', '1'); });
  await page.reload();
  await page.addStyleTag({ content: '.site-foot{display:none}' });
  await page.getByRole('button', { name: /^เล็ก/ }).click();

  await tab('ตั้งค่าคาบเรียน');
  await page.locator('.card').nth(1).screenshot({ path: `${OUT}/settings.png` });

  await tab('ครู');
  await page.locator('.card').nth(1).screenshot({ path: `${OUT}/teachers.png` });

  await tab('กรณีพิเศษ');
  await page.getByPlaceholder('เช่น คาบกิจกรรม').fill('ประชุมครู');
  await page.locator('.smulti').nth(1).locator('label', { hasText: 'นางสมศรี' }).first().locator('input').check();
  await page.locator('textarea').fill('วันอังคาร คาบ 1-2');
  await page.locator('.card').nth(1).screenshot({ path: `${OUT}/special.png` });

  await tab('กำหนดการเรียน');
  const ss = page.locator('.ss-input');
  await ss.nth(0).click(); await ss.nth(0).fill('บัญชี'); await page.locator('.ss-opt').first().click();
  await page.locator('.smulti').nth(0).locator('label', { hasText: 'สุนีย์' }).first().locator('input').check();
  await page.locator('.smulti').nth(2).locator('label', { hasText: '6701' }).first().locator('input').check();
  await page.locator('.smulti').nth(2).locator('label', { hasText: '6702' }).first().locator('input').check();
  await ss.nth(1).click(); await ss.nth(1).fill('อาคาร 1'); await page.locator('.ss-opt').first().click();
  await ss.nth(2).click(); await ss.nth(2).fill('101'); await page.locator('.ss-opt').first().click();
  await page.locator('.card').nth(1).screenshot({ path: `${OUT}/assign.png` });

  await page.locator('.nav a', { hasText: 'Dashboard' }).click();
  await page.getByLabel('เวลาประมวลผลสูงสุด').selectOption('5');
  await page.getByRole('button', { name: /จัดตารางอัตโนมัติ/ }).click();
  await page.getByText(/วางแล้ว/).waitFor({ timeout: 30000 });
  await page.locator('.ss-input').first().click();
  await page.locator('.ss-input').first().fill('6701');
  await page.locator('.ss-opt').first().click();
  await page.waitForTimeout(300);
  await page.locator('main.main').screenshot({ path: `${OUT}/dashboard.png` });

  // ---- เผยแพร่ + หน้าเข้าสู่ระบบ + มุมมองนักเรียน ----
  const fs = require('fs');
  await page.locator('.nav a', { hasText: 'เผยแพร่ตาราง' }).click();
  await page.getByPlaceholder('เช่น ภาคเรียนที่ 1/2569').fill('ภาคเรียนที่ 1/2569');
  await page.getByRole('button', { name: 'สร้างรหัสให้' }).nth(0).click();
  await page.getByRole('button', { name: 'สร้างรหัสให้' }).nth(1).click();
  const SP = await page.getByLabel('รหัสสำหรับนักเรียน').inputValue();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /สร้างไฟล์เผยแพร่/ }).click()]);
  fs.mkdirSync(path.join(OUT, 'tmp'), { recursive: true });
  await dl.saveAs(path.join(OUT, 'tmp', 'published.enc.json'));
  await page.getByText(/ข้อความแจ้งผู้ดู/).waitFor();
  await page.locator('.card').nth(0).screenshot({ path: `${OUT}/publish.png` });

  const ctx2 = await browser.newContext({ viewport: { width: 1700, height: 1000 }, deviceScaleFactor: 2 });
  const p2 = await ctx2.newPage();
  await p2.goto('http://localhost:4173/#/');
  await p2.addStyleTag({ content: '.site-foot{display:none}' });
  await p2.locator('input[type=file]').setInputFiles(path.join(OUT, 'tmp', 'published.enc.json'));
  await p2.getByLabel('รหัสผ่าน').fill(SP);
  await p2.locator('.login-card').screenshot({ path: `${OUT}/login.png` });
  await p2.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await p2.getByRole('heading', { level: 1, name: /ตารางเรียน/ }).waitFor();
  await p2.waitForTimeout(300);
  await p2.locator('main.main').screenshot({ path: `${OUT}/viewer.png` });
  fs.rmSync(path.join(OUT, 'tmp'), { recursive: true, force: true });
  await browser.close();
  console.log('shots done');
})();
