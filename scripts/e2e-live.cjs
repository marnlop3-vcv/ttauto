// ทดสอบเว็บที่เผยแพร่จริง (GitHub Pages) ด้วยเบราว์เซอร์จริง: node scripts/e2e-live.cjs [URL]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const URL_ROOT = (process.argv[2] || 'https://marnlop3-vcv.github.io/ttauto/').replace(/\/?$/, '/');
const OUT = process.env.OUT || '/tmp/e2e-live';
fs.mkdirSync(OUT, { recursive: true });
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(URL_ROOT);
const PROXY = IS_LOCAL ? null : (process.env.HTTPS_PROXY || process.env.https_proxy);
const log = (...a) => console.log('•', ...a);
let failed = 0;
const assert = (c, m) => { if (!c) { failed++; console.error('✗ FAIL:', m); process.exitCode = 1; } else log('ok:', m); };

(async () => {
  const browser = await chromium.launch(PROXY ? { proxy: { server: PROXY } } : {});
  const problems = [];
  const newUser = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true, ...opts });
    const page = await ctx.newPage();
    page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    page.on('console', (m) => m.type() === 'error' && problems.push('console: ' + m.text()));
    page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.url()}`));
    page.on('dialog', (d) => d.accept());
    return { ctx, page };
  };
  const pickSS = async (page, text) => {
    const inp = page.locator('.ss-input').first();
    await inp.click(); await inp.fill(text);
    await page.locator('.ss-opt', { hasText: text }).first().click();
  };

  // ===== 1) หน้าแรก =====
  const A = await newUser();
  const p = A.page;
  const t0 = Date.now();
  await p.goto(URL_ROOT, { waitUntil: 'load' });
  await p.getByRole('button', { name: 'เข้าสู่ระบบ' }).waitFor();
  log(`โหลดหน้าแรก ${Date.now() - t0} ms`);
  assert((await p.title()).includes('ระบบจัดตารางสอนอัตโนมัติ'), 'ชื่อหน้าเว็บถูกต้อง: ' + (await p.title()));
  await p.getByText('ยังไม่มีตารางเผยแพร่ในเว็บนี้').waitFor({ timeout: 20000 });
  assert(true, 'หน้าเข้าสู่ระบบ: แจ้ง "ยังไม่มีตารางเผยแพร่" (ไฟล์เผยแพร่เปล่าถูกอ่านได้ ไม่ใช่ error)');
  assert(await p.locator('link[rel=icon]').count() === 1, 'มี favicon');
  await p.screenshot({ path: `${OUT}/01-login.png` });

  // รหัสผิด / ไม่มีตารางเผยแพร่
  await p.getByLabel('รหัสผ่าน').fill('some-wrong-pass');
  await p.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await p.getByText(/ยังไม่มีตารางที่เผยแพร่ในเว็บนี้/).waitFor();
  assert(true, 'ใส่รหัสโดยยังไม่มีตารางเผยแพร่ -> แจ้งข้อความที่เข้าใจได้');

  // ===== 2) ผู้ดูแล: ข้อมูลตัวอย่างเล็ก + จัดตาราง (Web Worker บนโดเมนจริง) =====
  await p.getByRole('button', { name: /ใช้งานเป็นผู้ดูแล/ }).click();
  assert(await p.locator('.guide').getByText('เริ่มต้นใช้งาน').isVisible(), 'ผู้ดูแล: เห็นการ์ดเริ่มต้นใช้งาน');
  assert(await p.locator('.site-foot').innerText().then((t) => /v1\.5\.0/.test(t) && /MIT/.test(t)), 'ท้ายหน้า: เวอร์ชัน 1.5.0 และ MIT');
  await p.locator('.nav a', { hasText: 'กรอกข้อมูล' }).click();
  await p.getByRole('button', { name: /^เล็ก/ }).click();
  await p.locator('.nav a', { hasText: 'Dashboard' }).click();
  await p.getByLabel('เวลาประมวลผลสูงสุด').selectOption('5');
  await p.getByRole('button', { name: /จัดตารางอัตโนมัติ/ }).click();
  await p.getByText(/จัดตารางครบทุกคาบ/).waitFor({ timeout: 60000 });
  assert(true, 'ตัวอย่างเล็ก: จัดตารางครบทุกคาบบนเว็บจริง (Web Worker ทำงาน)');
  assert(await p.locator('td[colspan]').first().isVisible(), 'ตารางแสดงคาบติดกันรวมเป็นช่องเดียว');
  await p.screenshot({ path: `${OUT}/02-dashboard.png`, fullPage: true });

  // คู่มือ PDF จากลิงก์ท้ายหน้า
  const href = await p.locator('.site-foot a').first().getAttribute('href');
  const pdfRes = await p.request.get(new URL(href, p.url()).toString());
  const pdfBody = await pdfRes.body();
  assert(pdfRes.status() === 200 && pdfBody.slice(0, 4).toString() === '%PDF', `ลิงก์คู่มือ PDF ใช้ได้ (${Math.round(pdfBody.length / 1024)} KB)`);

  // Export
  const [d1] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.getByRole('button', { name: 'Export PDF' }).click()]);
  await d1.saveAs(`${OUT}/live.pdf`);
  assert(fs.readFileSync(`${OUT}/live.pdf`).slice(0, 4).toString() === '%PDF', 'Export PDF ได้ไฟล์ PDF จริง');
  const [d2] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.getByRole('button', { name: 'Export Excel (รายการนี้)' }).click()]);
  await d2.saveAs(`${OUT}/live.xlsx`);
  assert(fs.statSync(`${OUT}/live.xlsx`).size > 3000, 'Export Excel ได้ไฟล์');

  // ตัวอย่างกลางบนเว็บจริง
  await p.locator('.nav a', { hasText: 'กรอกข้อมูล' }).click();
  await p.getByRole('button', { name: /^กลาง/ }).click();
  await p.locator('.nav a', { hasText: 'Dashboard' }).click();
  await p.getByLabel('เวลาประมวลผลสูงสุด').selectOption('15');
  const tRun = Date.now();
  await p.getByRole('button', { name: /จัดตารางอัตโนมัติ/ }).click();
  await p.getByText(/จัดตารางครบทุกคาบ/).waitFor({ timeout: 90000 });
  log(`ตัวอย่างกลาง จัดเสร็จใน ${((Date.now() - tRun) / 1000).toFixed(1)} วินาที: ${await p.locator('.stat').first().innerText()}`);
  assert(true, 'ตัวอย่างกลาง (12 กลุ่ม): จัดครบทุกคาบ');

  // ===== 3) Import ไฟล์ CSV/JSON/XLSX จากโฟลเดอร์ตัวอย่างบนเว็บจริง =====
  await p.locator('.nav a', { hasText: 'กรอกข้อมูล' }).click();
  await p.getByRole('button', { name: 'ล้างข้อมูลทั้งหมด' }).click();
  await p.locator('.tabs button', { hasText: /^ตั้งค่าคาบเรียน$/ }).click();
  for (const d of ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์']) await p.getByLabel(d).check();
  await p.getByLabel('จำนวนคาบต่อวัน').fill('8');
  const times = ['08:30', '09:20', '10:10', '11:00', '11:50', '12:50', '13:40', '14:30', '15:20', '16:10'];
  const se = [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [8, 9]];
  const ti = p.locator('input[type=time]');
  for (let i = 0; i < 8; i++) { await ti.nth(i * 2).fill(times[se[i][0]]); await ti.nth(i * 2 + 1).fill(times[se[i][1]]); }
  await p.getByLabel('พักเที่ยงหลังคาบที่').selectOption('4');
  await p.getByRole('button', { name: 'บันทึกการตั้งค่า' }).click();
  const SAMPLE = '/home/user/timetable-app/sample-data/small';
  for (const [t, f, n] of [['ครู', 'teachers.csv', 9], ['กลุ่มเรียน', 'groups.json', 4], ['วิชาเรียน', 'subjects.xlsx', 6]]) {
    await p.locator('.tabs button', { hasText: new RegExp(`^${t}$`) }).click();
    await p.locator('input[type=file]').last().setInputFiles(path.join(SAMPLE, f));
    await p.getByText(`นำเข้าสำเร็จ ${n} รายการ`).waitFor();
    assert(true, `Import ${t} จาก ${path.extname(f)} ${n} รายการ (บนเว็บจริง)`);
  }

  // ===== 4) เผยแพร่ + นักเรียน/ครู (เข้ารหัสบนโดเมน https จริง) =====
  await p.locator('.nav a', { hasText: 'กรอกข้อมูล' }).click();
  await p.getByRole('button', { name: /^เล็ก/ }).click();
  await p.locator('.nav a', { hasText: 'Dashboard' }).click();
  await p.getByLabel('เวลาประมวลผลสูงสุด').selectOption('5');
  await p.getByRole('button', { name: /จัดตารางอัตโนมัติ/ }).click();
  await p.getByText(/จัดตารางครบทุกคาบ/).waitFor({ timeout: 60000 });
  await p.locator('.nav a', { hasText: 'เผยแพร่ตาราง' }).click();
  await p.getByPlaceholder('เช่น ภาคเรียนที่ 1/2569').fill('ทดสอบเว็บจริง');
  await p.getByRole('button', { name: 'สร้างรหัสให้' }).nth(0).click();
  await p.getByRole('button', { name: 'สร้างรหัสให้' }).nth(1).click();
  const SP = await p.getByLabel('รหัสสำหรับนักเรียน').inputValue();
  const TP = await p.getByLabel('รหัสสำหรับครู').inputValue();
  const tEnc = Date.now();
  const [d3] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), p.getByRole('button', { name: /สร้างไฟล์เผยแพร่/ }).click()]);
  const PUB = `${OUT}/published.enc.json`;
  await d3.saveAs(PUB);
  log(`สร้างไฟล์เผยแพร่ ${Date.now() - tEnc} ms ขนาด ${Math.round(fs.statSync(PUB).size / 1024)} KB`);
  const pubText = fs.readFileSync(PUB, 'utf8');
  assert(JSON.parse(pubText).v === 1 && !pubText.includes('ปวช.') && !pubText.includes('ทดสอบเว็บจริง'), 'ไฟล์เผยแพร่เข้ารหัสจริง (ไม่มีข้อความตารางอ่านได้)');
  assert(p.url().startsWith('https://') || IS_LOCAL, 'เว็บทำงานบน https/localhost (WebCrypto ใช้ได้)');

  const stu = await newUser();
  const S = stu.page;
  await S.goto(URL_ROOT);
  await S.locator('input[type=file]').setInputFiles(PUB);
  await S.getByText(/พบตารางที่เผยแพร่/).waitFor();
  await S.getByLabel('รหัสผ่าน').fill('wrong-pass-xxxx');
  await S.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await S.getByText('รหัสไม่ถูกต้อง').waitFor();
  assert(true, 'นักเรียน: รหัสผิด -> ไม่ผ่าน');
  await S.getByLabel('รหัสผ่าน').fill(SP.toLowerCase());
  const tDec = Date.now();
  await S.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await S.getByRole('heading', { level: 1, name: /ตารางเรียน/ }).waitFor({ timeout: 30000 });
  log(`ถอดรหัส+เข้าสู่ระบบ ${Date.now() - tDec} ms`);
  assert((await S.locator('.nav a').count()) === 1 && (await S.getByRole('button', { name: /จัดตาราง|ลบ|บันทึก/ }).count()) === 0, 'นักเรียน: ดูอย่างเดียว ไม่มีเมนู/ปุ่มแก้ไข');
  await pickSS(S, '6702');
  assert(/ปวช\.1\/2/.test(await S.locator('.grid-title').innerText()), 'นักเรียนเลือกห้อง 6702 ดูตารางได้');
  const [d4] = await Promise.all([S.waitForEvent('download', { timeout: 60000 }), S.getByRole('button', { name: 'Export PDF' }).click()]);
  await d4.saveAs(`${OUT}/student.pdf`);
  assert(fs.readFileSync(`${OUT}/student.pdf`).slice(0, 4).toString() === '%PDF', 'นักเรียน Export PDF ได้');
  await S.goto(URL_ROOT + '#/input');
  assert(await S.getByRole('heading', { level: 1, name: /ตารางเรียน/ }).isVisible() && !(await S.getByRole('heading', { level: 1, name: /กรอกข้อมูล/ }).isVisible()), 'นักเรียนพิมพ์ #/input เองแล้วยังเป็นมุมมองนักเรียน');
  assert(!(await S.evaluate(() => Object.keys(localStorage))).includes('timetable-app-v1'), 'เครื่องนักเรียนไม่มีข้อมูลผู้ดูแล (ข้อมูลไม่ปนกัน)');

  const tea = await newUser();
  const T = tea.page;
  await T.goto(URL_ROOT);
  await T.locator('input[type=file]').setInputFiles(PUB);
  await T.getByText(/พบตารางที่เผยแพร่/).waitFor();
  await T.getByLabel('รหัสผ่าน').fill(TP);
  await T.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await T.getByRole('heading', { level: 1, name: /ตารางสอน/ }).waitFor({ timeout: 30000 });
  assert(await T.getByText('เลือกครู').isVisible() && !(await T.getByText('เลือกกลุ่มเรียน').isVisible()), 'ครู: เห็นเฉพาะมุมมองครู');
  await T.screenshot({ path: `${OUT}/03-teacher.png`, fullPage: true });

  // ===== 5) มือถือ =====
  const mob = await newUser({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const M = mob.page;
  await M.goto(URL_ROOT);
  await M.getByRole('button', { name: 'เข้าสู่ระบบ' }).waitFor();
  const overflowLogin = await M.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflowLogin <= 2, `มือถือ: หน้าเข้าสู่ระบบไม่เลื่อนแนวนอน (เกิน ${overflowLogin}px)`);
  await M.screenshot({ path: `${OUT}/04-mobile-login.png` });
  await M.locator('input[type=file]').setInputFiles(PUB);
  await M.getByText(/พบตารางที่เผยแพร่/).waitFor();
  await M.getByLabel('รหัสผ่าน').fill(SP);
  await M.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await M.getByRole('heading', { level: 1, name: /ตารางเรียน/ }).waitFor({ timeout: 30000 });
  const overflowView = await M.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(overflowView <= 2, `มือถือ: มุมมองนักเรียนหน้าไม่เลื่อนแนวนอน (ตารางเลื่อนในกรอบของมันเอง) (เกิน ${overflowView}px)`);
  await M.screenshot({ path: `${OUT}/05-mobile-viewer.png`, fullPage: true });
  const geom = await M.evaluate(() => {
    const r = (sel) => { const e = document.querySelector(sel); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, r: b.right }; };
    return { vw: window.innerWidth, btn: r('.side-user button'), badge: r('.role-badge'), nav: r('.nav a'), title: r('.grid-title h2'), sum: r('.summary') };
  });
  const inView = (x) => x && x.l >= -1 && x.r <= geom.vw + 1;
  assert(inView(geom.btn) && inView(geom.badge), 'มือถือ: ปุ่ม "ออกจากระบบ" และป้ายบทบาทอยู่ในจอ');
  assert(inView(geom.nav), 'มือถือ: เมนูอยู่ในจอ');
  assert(inView(geom.title), 'มือถือ: ชื่อตารางอยู่ในจอ (เห็นโดยไม่ต้องเลื่อน)');
  assert(inView(geom.sum), 'มือถือ: กล่องสรุปคาบต่อสัปดาห์อยู่ในจอ');

  // ผู้ดูแลบนมือถือ (เมนู 3 รายการ)
  const mob2 = await newUser({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const M2 = mob2.page;
  await M2.goto(URL_ROOT);
  await M2.getByRole('button', { name: /ใช้งานเป็นผู้ดูแล/ }).click();
  await M2.screenshot({ path: `${OUT}/06-mobile-admin.png` });
  const g2 = await M2.evaluate(() => {
    const vw = window.innerWidth;
    const all = [...document.querySelectorAll('.nav a, .side-user button, .role-badge, .brand')].map((e) => e.getBoundingClientRect());
    return { vw, outside: all.filter((b) => b.left < -1 || b.right > vw + 1).length, total: all.length };
  });
  assert(g2.outside === 0, `มือถือ (ผู้ดูแล): เมนูทั้ง ${g2.total} รายการและปุ่มออกอยู่ในจอทั้งหมด`);

  // ===== ผลรวมปัญหาที่เจอ =====
  const uniq = [...new Set(problems)];
  uniq.forEach((x) => console.log('  ⚠', x));
  assert(uniq.length === 0, 'ไม่มี console error / page error / HTTP 4xx-5xx ตลอดการทดสอบ');
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
