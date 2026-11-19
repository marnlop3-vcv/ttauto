// ทดสอบประสบการณ์ผู้ใช้ใหม่: ตัวนำทางเริ่มต้นใช้งาน, ลิงก์ลัด, หน้าวิธีใช้, คำแนะนำหน้าเข้าสู่ระบบ, ช่องเลือกไฟล์, มือถือ
// รัน: node scripts/e2e-onboarding.cjs [URL]   (ค่าเริ่มต้น http://localhost:4173/ ต้องรัน `npx vite preview --port 4173` ก่อน)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
const OUT = process.env.OUT || '/tmp/e2e-onboarding';
fs.mkdirSync(OUT, { recursive: true });
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(ROOT);
const PROXY = IS_LOCAL ? null : (process.env.HTTPS_PROXY || process.env.https_proxy);
const log = (...a) => console.log('•', ...a);
let failed = 0;
const assert = (c, m) => { if (!c) { failed++; console.error('✗ FAIL:', m); process.exitCode = 1; } else log('ok:', m); };

(async () => {
  const browser = await chromium.launch(PROXY ? { proxy: { server: PROXY } } : {});
  const problems = [];
  const mk = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, ...opts });
    const page = await ctx.newPage();
    page.setDefaultTimeout(45000);
    page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    page.on('console', (m) => m.type() === 'error' && problems.push('console: ' + m.text()));
    page.on('response', (r) => r.status() >= 400 && problems.push(`HTTP ${r.status()} ${r.url()}`));
    page.on('dialog', (d) => d.accept());
    return { ctx, page };
  };

  const { page: p, ctx } = await mk();
  await p.goto(ROOT);

  // ===== 1) หน้าเข้าสู่ระบบ: คำแนะนำ + ช่องเลือกไฟล์ =====
  await p.getByRole('button', { name: 'เข้าสู่ระบบ' }).waitFor();
  for (const [sum, expect] of [['วิธีดูตาราง (3 ขั้น)', 'ใส่รหัสที่ได้รับ'], ['ได้รับ "ไฟล์ตาราง" ทางไลน์หรืออีเมล', 'บันทึกไปยังไฟล์'], ['ใส่รหัสแล้วขึ้น "รหัสไม่ถูกต้อง"', 'ใช้สลับกันไม่ได้'.slice(0, 0) + 'รหัสนักเรียน']]) {
    const d = p.locator('.viewer-help details', { has: p.locator('summary', { hasText: sum.slice(0, 12) }) });
    await d.locator('summary').click();
    assert((await d.innerText()).includes(expect), `หน้าเข้าสู่ระบบ: กางหัวข้อ "${sum}" แล้วเห็นคำแนะนำ`);
  }
  assert((await p.locator('input[type=file]').getAttribute('accept')) === null, 'ช่องเลือกไฟล์ไม่กรองนามสกุล (ไฟล์จากไลน์เลือกได้)');
  const looksValid = { v: 1, publishedAt: Date.now(), student: { salt: 'AA==', iv: 'AA==', ct: 'AA==', iter: 600000, z: 0 }, teacher: { salt: 'AA==', iv: 'AA==', ct: 'AA==', iter: 600000, z: 0 } };
  fs.writeFileSync(path.join(OUT, 'from-line.txt'), JSON.stringify(looksValid));
  fs.writeFileSync(path.join(OUT, 'junk.bin'), 'not a schedule');
  await p.locator('input[type=file]').setInputFiles(path.join(OUT, 'junk.bin'));
  await p.getByText(/อ่านไฟล์ไม่ได้|ไม่ใช่ไฟล์ตาราง/).first().waitFor();
  assert(true, 'ไฟล์ที่ไม่ใช่ไฟล์ตาราง -> ข้อความปฏิเสธที่อ่านรู้เรื่อง');
  await p.locator('input[type=file]').setInputFiles(path.join(OUT, 'from-line.txt'));
  await p.getByText(/พบตารางที่เผยแพร่ \(ไฟล์ from-line\.txt\)/).waitFor();
  assert(true, 'ไฟล์นามสกุล .txt ที่เนื้อหาถูกต้อง ถูกรับ (ตรวจเนื้อหา ไม่ตรวจนามสกุล)');
  const links = await p.locator('.site-foot a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  assert(links.includes('./timetable-user-manual.pdf') && links.includes('./viewer-guide.pdf'), 'ท้ายหน้ามีลิงก์คู่มือ 2 ฉบับ');
  for (const l of links) {
    const r = await p.request.get(new URL(l, p.url()).toString());
    const body = await r.body();
    assert(r.status() === 200 && body.slice(0, 4).toString() === '%PDF', `ลิงก์ ${l} เปิดได้เป็น PDF (${Math.round(body.length / 1024)} KB)`);
  }

  // ===== 2) ผู้ดูแลใหม่: การ์ดเริ่มต้น =====
  await p.reload();
  await p.getByRole('button', { name: /ใช้งานเป็นผู้ดูแล/ }).click();
  const guide = p.locator('.guide');
  await guide.waitFor();
  assert((await guide.locator('.gs').count()) === 5, 'การ์ดมี 5 ขั้น (4 ขั้นบังคับ + เผยแพร่ไม่บังคับ)');
  assert(await guide.getByText('ทำแล้ว 0/4').isVisible() && (await guide.locator('.gs.done').count()) === 0, 'ผู้ใช้ใหม่: ทำแล้ว 0/4 ยังไม่มีขั้นที่ติ๊ก');
  assert(await guide.locator('.gs.current').innerText().then((t) => t.includes('ตั้งค่าคาบเรียน') && t.includes('ขั้นถัดไป')), 'ขั้นถัดไปคือ "ตั้งค่าคาบเรียน"');
  assert(await guide.getByRole('button', { name: /ลองใช้ด้วยข้อมูลตัวอย่าง/ }).isVisible(), 'มีปุ่ม "ลองใช้ด้วยข้อมูลตัวอย่าง"');
  assert(await guide.getByText('ควรรู้ก่อนเริ่ม (3 ข้อ)').isVisible() && await guide.getByText(/เก็บเฉพาะในเบราว์เซอร์เครื่องนี้/).isVisible(), 'ผู้ใช้ใหม่เห็นข้อควรรู้ 3 ข้อ (กางอยู่)');
  await p.screenshot({ path: `${OUT}/01-guide-new.png`, fullPage: true });

  // ===== 3) ลิงก์ลัดไปแท็บที่ถูกต้อง =====
  const tabOn = async () => (await p.locator('.tabs button.on').innerText()).trim();
  await guide.getByRole('link', { name: 'ไปตั้งค่า' }).click();
  assert((await tabOn()) === 'ตั้งค่าคาบเรียน' && p.url().includes('tab=settings'), 'ปุ่ม "ไปตั้งค่า" เปิดแท็บ ตั้งค่าคาบเรียน (#/input?tab=settings)');
  await p.locator('.nav a', { hasText: 'Dashboard' }).click();
  await p.locator('.gs-sub', { hasText: 'ครู' }).first().click();
  assert((await tabOn()) === 'ครู', 'ชิป "＋ ครู" เปิดแท็บ ครู');
  await p.locator('.tabs button', { hasText: /^วิชาเรียน$/ }).click();
  assert((await tabOn()) === 'วิชาเรียน' && p.url().includes('tab=subjects'), 'กดแท็บเอง -> ที่อยู่อัปเดตตาม');
  await p.locator('.nav a', { hasText: 'Dashboard' }).click();
  await p.locator('.gs-sub', { hasText: 'กลุ่มเรียน' }).first().click();
  assert((await tabOn()) === 'กลุ่มเรียน', 'ลิงก์ลัดทำงานซ้ำได้หลังเปลี่ยนแท็บเอง');
  await p.locator('.nav a', { hasText: 'Dashboard' }).click();

  // ===== 4) ย่อ/ขยาย จำค่า =====
  await guide.getByRole('button', { name: /ย่อ/ }).click();
  assert(await p.locator('.guide-bar').getByText('ทำแล้ว 0/4').isVisible(), 'ย่อการ์ด -> แถบสั้น "ทำแล้ว 0/4"');
  await p.reload();
  assert(await p.locator('.guide-bar').isVisible(), 'รีเฟรชแล้วยังย่ออยู่ (จำค่า)');
  await p.locator('.guide-bar').getByRole('button', { name: /แสดงขั้นตอน/ }).click();
  await p.locator('.guide').waitFor();
  assert(true, 'กด "แสดงขั้นตอน" ขยายกลับ');

  // ===== 5) ลองใช้ตัวอย่าง -> ติ๊ก 1-3 -> จัดตาราง -> ติ๊ก 4 =====
  await p.locator('.guide').getByRole('button', { name: /ลองใช้ด้วยข้อมูลตัวอย่าง/ }).click();
  await p.waitForFunction(() => document.querySelectorAll('.guide .gs.done').length === 3);
  assert(await p.locator('.guide').getByText('ทำแล้ว 3/4').isVisible(), 'โหลดตัวอย่างแล้ว ขั้น 1–3 ติ๊กถูก (3/4)');
  assert(await p.locator('.guide .gs.current').innerText().then((t) => t.includes('จัดตารางอัตโนมัติ') && t.includes('ขั้นถัดไป')), 'ขั้นถัดไปเปลี่ยนเป็น "จัดตารางอัตโนมัติ"');
  assert(!(await p.getByRole('button', { name: /ลองใช้ด้วยข้อมูลตัวอย่าง/ }).isVisible()), 'ปุ่มลองใช้หายไปเมื่อมีข้อมูลแล้ว');
  await p.getByLabel('เวลาประมวลผลสูงสุด').selectOption('5');
  await p.locator('.guide').getByRole('button', { name: 'จัดตารางเลย' }).click();
  await p.locator('.guide-done').waitFor({ timeout: 60000 });
  assert(await p.getByText(/จัดตารางครบทุกคาบ/).isVisible(), 'กด "จัดตารางเลย" ในการ์ด -> จัดตารางสำเร็จ');
  assert(await p.locator('.guide-done').getByText('ทุกขั้นพร้อมแล้ว').isVisible() && !(await p.locator('.guide').isVisible()), 'ครบทุกขั้น -> การ์ดเปลี่ยนเป็นแถบ "ทุกขั้นพร้อมแล้ว" ชวนเผยแพร่');
  await p.screenshot({ path: `${OUT}/02-guide-done.png`, fullPage: true });
  await p.locator('.guide-done').getByRole('link', { name: 'ไปเผยแพร่ตาราง' }).click();
  await p.getByRole('heading', { level: 1, name: 'เผยแพร่ตาราง' }).waitFor();
  assert(true, 'ปุ่ม "ไปเผยแพร่ตาราง" พาไปหน้าเผยแพร่');
  await p.locator('.nav a', { hasText: 'Dashboard' }).click();
  await p.locator('.guide-done').getByRole('button', { name: 'ปิด' }).click();
  await p.reload();
  assert(!(await p.locator('.guide-done').isVisible()) && !(await p.locator('.guide').isVisible()), 'ปิดแถบแล้วรีเฟรช ไม่ขึ้นอีก (จำค่า)');

  // ===== 6) แก้ข้อมูลหลังจัดตาราง -> การ์ดกลับมาบอกให้จัดใหม่ =====
  await p.locator('.nav a', { hasText: 'กรอกข้อมูล' }).click();
  await p.locator('.tabs button', { hasText: /^ครู$/ }).click();
  await p.getByPlaceholder('เช่น นางสมศรี ใจดี').fill('ครูใหม่ ทดสอบ');
  await p.getByRole('button', { name: 'เพิ่มครู' }).click();
  await p.locator('.nav a', { hasText: 'Dashboard' }).click();
  await p.locator('.guide').waitFor();
  assert(await p.locator('.guide .gs.current').innerText().then((t) => t.includes('จัดตารางอัตโนมัติ') && t.includes('จัดใหม่')), 'แก้ข้อมูลหลังจัดตาราง -> การ์ดกลับมา ขั้น 4 บอกให้ "จัดใหม่"');

  // ===== 7) หน้า "วิธีใช้" =====
  await p.locator('.nav a', { hasText: 'วิธีใช้' }).click();
  await p.getByRole('heading', { level: 1, name: 'วิธีใช้' }).waitFor();
  for (const h of ['ลองใช้ใน 5 นาที', 'ใช้กับโรงเรียนจริง', 'คำศัพท์ที่ควรรู้', 'ถามตอบ', 'คู่มือฉบับ PDF']) {
    assert(await p.getByRole('heading', { level: 2, name: new RegExp(h) }).isVisible(), `หน้าวิธีใช้: มีหัวข้อ "${h}"`);
  }
  assert((await p.locator('.help-faq').count()) >= 8, `ถามตอบ ${await p.locator('.help-faq').count()} ข้อ`);
  const faq = p.locator('.help-faq').first();
  await faq.locator('summary').click();
  assert(await faq.locator('p').isVisible(), 'กดข้อถามตอบแล้วเห็นคำตอบ');
  assert(await p.getByText('กำหนดการเรียน', { exact: true }).first().isVisible(), 'มีคำศัพท์ "กำหนดการเรียน"');
  await p.screenshot({ path: `${OUT}/03-help.png`, fullPage: true });

  // ===== 8) มือถือ: การ์ดไม่ล้นจอ =====
  const m = await mk({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await m.page.goto(ROOT);
  await m.page.getByRole('button', { name: /ใช้งานเป็นผู้ดูแล/ }).click();
  await m.page.locator('.guide').waitFor();
  const g = await m.page.evaluate(() => {
    const vw = window.innerWidth;
    const bad = [...document.querySelectorAll('.guide .btn, .guide .gs-title, .guide .gs-mark, .side-user button')].filter((e) => { const b = e.getBoundingClientRect(); return b.left < -1 || b.right > vw + 1; }).length;
    return { over: document.documentElement.scrollWidth - vw, bad };
  });
  assert(g.over <= 2 && g.bad === 0, `มือถือ: การ์ดเริ่มต้นไม่ล้นจอ (เกิน ${g.over}px, องค์ประกอบหลุดจอ ${g.bad})`);
  await m.page.screenshot({ path: `${OUT}/04-mobile-guide.png`, fullPage: true });
  await m.page.locator('.nav a', { hasText: 'วิธีใช้' }).click();
  await m.page.getByRole('heading', { level: 1, name: 'วิธีใช้' }).waitFor();
  const over2 = await m.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(over2 <= 2, `มือถือ: หน้าวิธีใช้ไม่เลื่อนแนวนอน (เกิน ${over2}px)`);

  const uniq = [...new Set(problems)];
  uniq.forEach((x) => console.log('  ⚠', x));
  assert(uniq.length === 0, 'ไม่มี console error / page error / HTTP 4xx-5xx');
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
