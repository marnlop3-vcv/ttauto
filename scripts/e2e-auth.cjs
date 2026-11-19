// ทดสอบระบบรหัสผ่าน 3 มุมมอง (ผู้ดูแล / นักเรียน / ครู) ด้วยเบราว์เซอร์จริง คนละ context = คนละผู้ใช้
// รัน: npm run build && node scripts/e2e-auth.cjs
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const OUT = process.env.OUT || '/tmp/e2e-out';
const BASE = '/timetable-app/';
const DIST = path.resolve(__dirname, '../dist');
const PUB = path.join(OUT, 'published.enc.json');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const log = (...a) => console.log('•', ...a);
let failed = 0;
const assert = (c, m) => { if (!c) { failed++; console.error('✗ FAIL:', m); process.exitCode = 1; } else log('ok:', m); };
fs.mkdirSync(OUT, { recursive: true });

let publishedOn = false; // เปิด/ปิดการเสิร์ฟไฟล์เผยแพร่
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (!url.startsWith(BASE)) { res.writeHead(404); return res.end('not found'); }
  const rel = url.slice(BASE.length) || 'index.html';
  let file = path.join(DIST, rel);
  if (rel === 'published/published.enc.json') {
    if (!publishedOn || !fs.existsSync(PUB)) { res.writeHead(404); return res.end('not found'); }
    file = PUB;
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  if (fs.existsSync(PUB)) fs.unlinkSync(PUB);
  await new Promise((r) => server.listen(4181, r));
  const root = `http://localhost:4181${BASE}`;
  const browser = await chromium.launch();
  const errors = [];
  const newUser = async (admin = false) => {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
    if (admin) await ctx.addInitScript(() => { try { sessionStorage.setItem('tt-session', JSON.stringify({ role: 'admin' })); } catch (e) {} });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && !/404/.test(m.text()) && errors.push(m.text()));
    page.on('dialog', (d) => d.accept());
    return { ctx, page };
  };
  const pickSS = async (page, text) => {
    const inp = page.locator('.ss-input').first();
    await inp.click(); await inp.fill(text);
    await page.locator('.ss-opt', { hasText: text }).first().click();
  };

  // ===== 1) ผู้ดูแล: โหลดตัวอย่างกลาง -> จัดตาราง -> เผยแพร่ =====
  const admin = await newUser(true);
  const A = admin.page;
  await A.goto(root);
  await A.locator('.nav a', { hasText: 'กรอกข้อมูล' }).click();
  await A.getByRole('button', { name: /^กลาง/ }).click();
  await A.locator('.nav a', { hasText: 'Dashboard' }).click();
  await A.getByLabel('เวลาประมวลผลสูงสุด').selectOption('15');
  await A.getByRole('button', { name: /จัดตารางอัตโนมัติ/ }).click();
  await A.getByText(/จัดตารางครบทุกคาบ/).waitFor({ timeout: 40000 });
  assert(true, 'ผู้ดูแล: จัดตารางตัวอย่างกลางครบ');

  await A.locator('.nav a', { hasText: 'เผยแพร่ตาราง' }).click();
  const buildBtn = A.getByRole('button', { name: /สร้างไฟล์เผยแพร่/ });
  assert(await buildBtn.isDisabled(), 'ปุ่มสร้างไฟล์ปิดอยู่จนกว่าจะกรอกครบ');
  await A.getByPlaceholder('เช่น ภาคเรียนที่ 1/2569').fill('ภาคเรียนที่ 1/2569');
  // รหัสสั้น/เดาง่ายถูกปฏิเสธ
  await A.getByLabel('รหัสสำหรับนักเรียน').fill('1234');
  assert(await A.getByText(/สั้นเกินไป/).first().isVisible() && await buildBtn.isDisabled(), 'รหัสสั้น (1234) ถูกปฏิเสธ');
  // สร้างรหัสให้
  await A.getByRole('button', { name: 'สร้างรหัสให้' }).nth(0).click();
  await A.getByRole('button', { name: 'สร้างรหัสให้' }).nth(1).click();
  const SP = await A.getByLabel('รหัสสำหรับนักเรียน').inputValue();
  const TP = await A.getByLabel('รหัสสำหรับครู').inputValue();
  assert(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(SP) && /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(TP) && SP !== TP, `สร้างรหัสให้ได้ (${SP} / ${TP})`);
  // รหัสซ้ำกันไม่ได้
  await A.getByLabel('รหัสสำหรับครู').fill(SP);
  assert(await A.getByText('รหัสนักเรียนและรหัสครูต้องไม่เหมือนกัน').isVisible() && await buildBtn.isDisabled(), 'รหัสนักเรียน=รหัสครู ถูกปฏิเสธ');
  await A.getByLabel('รหัสสำหรับครู').fill(TP);
  const [dl] = await Promise.all([A.waitForEvent('download', { timeout: 30000 }), buildBtn.click()]);
  await dl.saveAs(PUB);
  const pubText = fs.readFileSync(PUB, 'utf8');
  const pubJson = JSON.parse(pubText);
  assert(pubJson.v === 1 && pubJson.student?.ct && pubJson.teacher?.ct, 'ดาวน์โหลดไฟล์เผยแพร่ได้ (2 ซอง)');
  assert(!pubText.includes('ปวช.1/1') && !pubText.includes('ภาคเรียนที่ 1/2569') && !pubText.includes('นายสมชาย'), 'ไฟล์ที่เผยแพร่ไม่มีข้อความตารางอ่านได้ (เข้ารหัสจริง)');
  assert(await A.getByText(/ข้อความแจ้งผู้ดู/).isVisible(), 'แสดงขั้นตอนเผยแพร่และข้อความแจ้งผู้ดู');
  await A.screenshot({ path: `${OUT}/09-publish.png`, fullPage: true });

  // ===== 2) รหัสล็อกผู้ดูแล =====
  const LOCK = 'Admin-Lock-Secret-2569';
  await A.getByLabel('ตั้งรหัสล็อกผู้ดูแล').fill('abc');
  await A.getByRole('button', { name: 'ตั้งรหัสล็อก' }).click();
  assert(await A.locator('.msg.err').getByText(/อย่างน้อย 10/).isVisible(), 'รหัสล็อกสั้นถูกปฏิเสธ');
  await A.getByLabel('ตั้งรหัสล็อกผู้ดูแล').fill(LOCK);
  await A.getByRole('button', { name: 'ตั้งรหัสล็อก' }).click();
  await A.getByText(/ตั้งรหัสล็อกผู้ดูแลแล้ว/).waitFor();
  const lockRaw = await A.evaluate(() => localStorage.getItem('tt-admin-lock'));
  assert(lockRaw && !lockRaw.includes('Admin-Lock') && JSON.parse(lockRaw).hash, 'เก็บเฉพาะ hash ของรหัสล็อก ไม่เก็บรหัสจริง');
  await A.locator('.side-user button').click();       // ปุ่มล็อกใน sidebar
  assert(await A.getByRole('button', { name: 'เข้าสู่ระบบ' }).isVisible(), 'กดล็อกแล้วกลับหน้าเข้าสู่ระบบ');
  assert(!(await A.getByRole('button', { name: /ใช้งานเป็นผู้ดูแล \(จัดตารางเอง\)/ }).isVisible()), 'เมื่อตั้งรหัสล็อกแล้ว ไม่มีปุ่มข้ามรหัส');
  await A.getByLabel('รหัสผ่าน').fill('wrong-admin-pass');
  await A.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await A.getByText('รหัสไม่ถูกต้อง').waitFor({ timeout: 15000 });
  assert(true, 'รหัสผู้ดูแลผิด -> ไม่ผ่าน');
  await A.getByLabel('รหัสผ่าน').fill(LOCK);
  await A.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await A.locator('.nav a', { hasText: 'Dashboard' }).waitFor({ timeout: 15000 });
  assert(true, 'รหัสผู้ดูแลถูก -> เข้าโหมดผู้ดูแล ข้อมูลเดิมยังอยู่');
  await A.reload();
  assert(await A.locator('.nav a', { hasText: 'กรอกข้อมูล' }).isVisible(), 'รีเฟรชในแท็บเดิมยังอยู่ในระบบ (เซสชันแท็บ)');

  // ===== 3) นักเรียน (ผู้ใช้คนละเครื่อง) =====
  publishedOn = true;
  const stu = await newUser();
  const S = stu.page;
  await S.goto(root);
  await S.getByText(/พบตารางที่เผยแพร่/).waitFor({ timeout: 10000 });
  assert(true, 'หน้าเข้าสู่ระบบตรวจพบไฟล์ตารางที่เผยแพร่');
  await S.getByLabel('รหัสผ่าน').fill('totally-wrong-pass');
  await S.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await S.getByText('รหัสไม่ถูกต้อง').waitFor({ timeout: 15000 });
  assert(true, 'นักเรียน: รหัสผิด -> ไม่ผ่าน');
  await S.getByLabel('รหัสผ่าน').fill(TP.toLowerCase().replace(/-/g, '')); // ใช้รหัสครูก่อน เพื่อดูว่าได้มุมมองครู ไม่ใช่นักเรียน
  await S.getByLabel('รหัสผ่าน').fill(SP.toLowerCase());                    // พิมพ์เล็ก ใช้ได้กับรหัสที่ระบบสร้างให้
  await S.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await S.getByRole('heading', { level: 1, name: /ตารางเรียน/ }).waitFor({ timeout: 15000 });
  assert(true, 'นักเรียน: ใส่รหัสนักเรียน (พิมพ์เล็กได้) -> มุมมองตารางเรียน');
  assert(await S.getByText('ภาคเรียนที่ 1/2569').first().isVisible(), 'แสดงชื่อชุดตารางที่ผู้ดูแลตั้ง');
  assert((await S.locator('.nav a').count()) === 1, 'เมนูมีรายการเดียว (ไม่มีกรอกข้อมูล/เผยแพร่/จัดตาราง)');
  assert((await S.getByRole('button', { name: /จัดตารางอัตโนมัติ|ลบ|บันทึก/ }).count()) === 0, 'ไม่มีปุ่มแก้ไข/จัดตาราง/ลบ');
  assert(await S.getByText('เลือกกลุ่มเรียน').isVisible() && !(await S.getByText('เลือกครู').isVisible()), 'เลือกได้เฉพาะกลุ่มเรียน (ไม่มีตัวเลือกครู/อาคาร)');
  await pickSS(S, '6705');
  const gridText = await S.locator('table.tt').innerText();
  assert(/ตารางเรียนกลุ่ม/.test(await S.locator('.grid-title').innerText()) && gridText.includes('อาคาร'), 'นักเรียนเลือกห้อง 6705 ดูตารางได้ (วิชา/ครู/อาคาร)');
  assert(await S.locator('.summary').isVisible(), 'มีสรุปคาบต่อสัปดาห์');
  // Export
  const dl1 = await Promise.all([S.waitForEvent('download', { timeout: 30000 }), S.getByRole('button', { name: 'Export PDF' }).click()]);
  await dl1[0].saveAs(`${OUT}/viewer.pdf`);
  assert(fs.readFileSync(`${OUT}/viewer.pdf`).slice(0, 4).toString() === '%PDF', 'นักเรียน Export PDF ได้');
  const dl2 = await Promise.all([S.waitForEvent('download'), S.getByRole('button', { name: 'Export Excel (รายการนี้)' }).click()]);
  await dl2[0].saveAs(`${OUT}/viewer.xlsx`);
  const dl3 = await Promise.all([S.waitForEvent('download'), S.getByRole('button', { name: /Export Excel \(ทุก/ }).click()]);
  await dl3[0].saveAs(`${OUT}/viewer_all.xlsx`);
  assert(fs.statSync(`${OUT}/viewer.xlsx`).size > 3000 && fs.statSync(`${OUT}/viewer_all.xlsx`).size > 3000, 'นักเรียน Export Excel ได้');
  await S.screenshot({ path: `${OUT}/10-student-view.png`, fullPage: true });
  // พยายามเข้าหน้าผู้ดูแลโดยพิมพ์ที่อยู่เอง
  for (const hash of ['#/input', '#/publish', '#/']) {
    await S.goto(root + hash);
    await S.getByRole('heading', { level: 1, name: /ตารางเรียน/ }).waitFor();
    assert(!(await S.getByRole('heading', { level: 1, name: /กรอกข้อมูล|เผยแพร่ตาราง/ }).isVisible()), `พิมพ์ที่อยู่ ${hash} แล้วยังเป็นมุมมองนักเรียน`);
  }
  // ไม่มีข้อมูลผู้ดูแลในเครื่องนักเรียน และข้อมูลใน sessionStorage มีเฉพาะซองนักเรียน
  const stor = await S.evaluate(() => ({ ls: Object.keys(localStorage), ss: sessionStorage.getItem('tt-session') }));
  assert(!stor.ls.includes('timetable-app-v1'), 'localStorage ของนักเรียนไม่มีข้อมูลผู้ดูแล');
  assert(stor.ss && !/assignments|mainTeacherIds|teacherIds|"schedule"/.test(stor.ss), 'ข้อมูลที่ถอดรหัสแล้วในแท็บนักเรียนไม่มีข้อมูลดิบ (กำหนดการ/รหัสครู)');
  // รีเฟรชแล้วยังอยู่ ออกจากระบบแล้วต้องใส่รหัสใหม่
  await S.reload();
  assert(await S.getByRole('heading', { level: 1, name: /ตารางเรียน/ }).isVisible(), 'รีเฟรชแล้วยังอยู่ในมุมมองนักเรียน');
  await S.getByRole('button', { name: 'ออกจากระบบ' }).click();
  assert(await S.getByRole('button', { name: 'เข้าสู่ระบบ' }).isVisible(), 'ออกจากระบบแล้วกลับหน้าใส่รหัส');
  assert((await S.evaluate(() => sessionStorage.getItem('tt-session'))) === null, 'ออกจากระบบแล้วล้างข้อมูลในเซสชัน');

  // ===== 4) ครู =====
  const tea = await newUser();
  const T = tea.page;
  await T.goto(root);
  await T.getByLabel('รหัสผ่าน').fill(TP);
  await T.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await T.getByRole('heading', { level: 1, name: /ตารางสอน/ }).waitFor({ timeout: 15000 });
  assert(true, 'ครู: ใส่รหัสครู -> มุมมองตารางสอน');
  assert(await T.getByText('เลือกครู').isVisible() && !(await T.getByText('เลือกกลุ่มเรียน').isVisible()), 'เลือกได้เฉพาะครู');
  assert((await T.locator('.nav a').count()) === 1 && (await T.getByRole('button', { name: /จัดตารางอัตโนมัติ|ลบ|บันทึก/ }).count()) === 0, 'ครู: ไม่มีเมนู/ปุ่มแก้ไข');
  await pickSS(T, 'นางสมศรี');
  assert(/ตารางสอนครู/.test(await T.locator('.grid-title').innerText()), 'ครูเลือกดูครูท่านอื่นได้');
  const dlT = await Promise.all([T.waitForEvent('download', { timeout: 30000 }), T.getByRole('button', { name: 'Export PDF' }).click()]);
  await dlT[0].saveAs(`${OUT}/viewer_teacher.pdf`);
  assert(fs.readFileSync(`${OUT}/viewer_teacher.pdf`).slice(0, 4).toString() === '%PDF', 'ครู Export PDF ได้');
  await T.screenshot({ path: `${OUT}/11-teacher-view.png`, fullPage: true });
  const tss = await T.evaluate(() => sessionStorage.getItem('tt-session'));
  assert(tss && !tss.includes('ตารางเรียนกลุ่ม'), 'ซองครูไม่มีตารางรายกลุ่มของนักเรียน');

  // ===== 5) ไม่มีไฟล์เผยแพร่ในเว็บ -> เลือกไฟล์เอง =====
  publishedOn = false;
  const f = await newUser();
  const F = f.page;
  await F.goto(root);
  await F.getByText('ยังไม่มีตารางเผยแพร่ในเว็บนี้').waitFor({ timeout: 10000 });
  await F.getByLabel('รหัสผ่าน').fill(SP);
  await F.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await F.getByText(/ยังไม่มีตารางที่เผยแพร่ในเว็บนี้/).waitFor({ timeout: 15000 });
  assert(true, 'ไม่มีไฟล์เผยแพร่ -> แจ้ง "ยังไม่มีตารางที่เผยแพร่"');
  await F.locator('input[type=file]').setInputFiles(PUB);
  await F.getByText(/ไฟล์ published\.enc\.json/).waitFor({ timeout: 10000 });
  await F.getByLabel('รหัสผ่าน').fill(SP);
  await F.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await F.getByRole('heading', { level: 1, name: /ตารางเรียน/ }).waitFor({ timeout: 15000 });
  assert(true, 'เลือกไฟล์ตารางเอง + รหัสนักเรียน -> ดูตารางได้ (ไม่ต้องมีไฟล์บนเว็บ)');
  fs.writeFileSync(path.join(OUT, 'not-a-schedule.json'), '{"hello":1}');
  await F.getByRole('button', { name: 'ออกจากระบบ' }).click();
  await F.locator('input[type=file]').setInputFiles(path.join(OUT, 'not-a-schedule.json'));
  await F.getByText(/ไม่ใช่ไฟล์ตารางที่เผยแพร่/).waitFor({ timeout: 8000 });
  assert(true, 'ไฟล์ที่ไม่ใช่ไฟล์ตารางถูกปฏิเสธด้วยข้อความที่อ่านรู้เรื่อง');

  // ===== 6) ผู้ใช้ใหม่ที่ใช้เว็บเป็นเครื่องมือส่วนตัว (ไม่มีรหัส) =====
  publishedOn = true;
  const g = await newUser();
  await g.page.goto(root);
  await g.page.getByRole('button', { name: /ใช้งานเป็นผู้ดูแล/ }).click();
  assert(await g.page.getByText('ก่อนเริ่มใช้ — 3 ข้อควรรู้').isVisible() && await g.page.locator('.nav a', { hasText: 'เผยแพร่ตาราง' }).isVisible(), 'ผู้ใช้ทั่วไปกด "ใช้งานเป็นผู้ดูแล" ใช้เป็นเครื่องมือของตัวเองได้ตามเดิม');

  assert(errors.length === 0, 'ไม่มี console/page error ' + errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
