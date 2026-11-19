// จำลองการเผยแพร่บน GitHub Pages: เสิร์ฟ dist ที่ซับโฟลเดอร์ /timetable-app/ แล้วทดสอบด้วยเบราว์เซอร์จริง
// รัน: npm run build && node scripts/smoke-subpath.cjs
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = '/timetable-app/';
const DIST = path.resolve(__dirname, '../dist');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) { console.error('✗ FAIL:', m); process.exitCode = 1; } else log('ok:', m); };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/timetable-app') { res.writeHead(301, { Location: BASE }); return res.end(); }
  if (!url.startsWith(BASE)) { res.writeHead(404); return res.end('not found'); }
  let rel = url.slice(BASE.length) || 'index.html';
  const file = path.join(DIST, rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(4180, r));
  const root = `http://localhost:4180${BASE}`;
  const browser = await chromium.launch();
  const errors = [];
  const newUser = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } }); // แต่ละ context = เบราว์เซอร์/ผู้ใช้คนละคน (localStorage แยกกัน)
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('dialog', (d) => d.accept());
    page.on('response', (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
    return { ctx, page };
  };

  // ---------- ผู้ใช้ A ----------
  const A = await newUser();
  await A.page.goto(root);
  assert(await A.page.getByRole('button', { name: 'เข้าสู่ระบบ' }).isVisible(), 'ผู้ใช้ใหม่เห็นหน้าเข้าสู่ระบบ');
  await A.page.getByRole('button', { name: /ใช้งานเป็นผู้ดูแล/ }).click();
  assert(await A.page.locator('.guide').isVisible(), 'ผู้ใช้ใหม่เห็นการ์ดเริ่มต้นใช้งาน');
  assert(await A.page.locator('.site-foot').getByText(/MIT/).isVisible(), 'ท้ายหน้ามีเวอร์ชัน/สัญญาอนุญาต');
  await A.page.reload();
  await A.page.locator('.guide').getByRole('button', { name: /ย่อ/ }).click();
  await A.page.reload();
  assert(await A.page.locator('.guide-bar').isVisible() && !(await A.page.locator('.guide').isVisible()), 'ย่อการ์ดนำทางแล้วจำไว้ รีเฟรชยังย่ออยู่');

  await A.page.locator('.nav a', { hasText: 'กรอกข้อมูล' }).click();
  await A.page.getByRole('button', { name: /^เล็ก/ }).click();
  await A.page.locator('.nav a', { hasText: 'Dashboard' }).click();
  await A.page.getByLabel('เวลาประมวลผลสูงสุด').selectOption('5');
  await A.page.getByRole('button', { name: /จัดตารางอัตโนมัติ/ }).click();
  await A.page.getByText(/จัดตารางครบทุกคาบ/).waitFor({ timeout: 30000 });
  assert(true, 'ที่ซับโฟลเดอร์ /timetable-app/: โหลดข้อมูลตัวอย่างและจัดตารางผ่าน Web Worker สำเร็จ');

  // คู่มือ PDF และไอคอนโหลดได้
  const hrefPdf = await A.page.locator('.site-foot a').first().getAttribute('href');
  const pdf = await A.page.request.get(new URL(hrefPdf, A.page.url()).toString());
  assert(pdf.status() === 200 && (await pdf.body()).slice(0, 4).toString() === '%PDF', `ลิงก์คู่มือ PDF ใช้ได้ (${hrefPdf})`);
  const fav = await A.page.request.get(root + 'favicon.svg');
  assert(fav.status() === 200, 'favicon โหลดได้');

  // ---------- ผู้ใช้ B (คนละเบราว์เซอร์) ต้องไม่เห็นข้อมูลของ A ----------
  const B = await newUser();
  await B.page.goto(root);
  await B.page.getByRole('button', { name: /ใช้งานเป็นผู้ดูแล/ }).click();
  await B.page.locator('.nav a', { hasText: 'กรอกข้อมูล' }).click();
  await B.page.locator('.tabs button', { hasText: /^กลุ่มเรียน$/ }).click();
  assert(await B.page.getByText('กลุ่มเรียนที่มีอยู่ในระบบ (0)').isVisible(), 'ผู้ใช้ B (เบราว์เซอร์อื่น) เห็นข้อมูลว่าง — ไม่ปนกับของ A');
  await B.page.locator('.nav a', { hasText: 'Dashboard' }).click();
  assert(await B.page.locator('.guide').getByText('ทำแล้ว 0/4').isVisible(), 'Dashboard ของ B ยังไม่มีตาราง (การ์ดเริ่มต้น 0/4)');
  // และ A ยังมีข้อมูลเดิม
  await A.page.locator('.nav a', { hasText: 'กรอกข้อมูล' }).click();
  await A.page.locator('.tabs button', { hasText: /^กลุ่มเรียน$/ }).click();
  assert(await A.page.getByText('กลุ่มเรียนที่มีอยู่ในระบบ (4)').isVisible(), 'ข้อมูลของ A ยังอยู่ครบ (4 กลุ่ม)');

  assert(errors.length === 0, 'ไม่มี error / HTTP 4xx-5xx ' + errors.slice(0, 3).join(' | '));
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
