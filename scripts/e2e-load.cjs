// ทดสอบ "ตรวจภาระก่อนจัดตาราง": เตือนเมื่อครู/กลุ่มเรียนต้องใช้คาบเกินช่องว่าง (ก่อนกดจัด)
// รัน: node scripts/e2e-load.cjs [URL]  (ค่าเริ่มต้น http://localhost:4173/ ต้องรัน `npx vite preview --port 4173` ก่อน)
const { chromium } = require('playwright');
const ROOT = (process.argv[2] || 'http://localhost:4173/').replace(/\/?$/, '/');
let failed = 0;
const assert = (c, m) => { if (!c) { failed++; console.error('✗ FAIL:', m); process.exitCode = 1; } else console.log('• ok:', m); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 2200 } });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('tt-session', JSON.stringify({ role: 'admin' })); } catch (e) {} });
  const p = await ctx.newPage();
  p.setDefaultTimeout(30000);
  const problems = [];
  p.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  p.on('console', (m) => m.type() === 'error' && problems.push('console: ' + m.text()));
  p.on('dialog', (d) => d.accept());
  const ss = () => p.locator('.ss-input');
  const pick = async (n, text) => { await ss().nth(n).click(); await ss().nth(n).fill(text); await p.locator('.ss-opt').first().click(); };

  await p.goto(ROOT + '#/');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  assert((await p.locator('.load-check').count()) === 0, 'ยังไม่มีกำหนดการเรียน -> ไม่แสดงการ์ดตรวจข้อมูล');
  await p.getByRole('button', { name: /ลองใช้ด้วยข้อมูลตัวอย่าง/ }).click();
  await p.locator('.load-check').waitFor();
  assert(await p.locator('.load-check .msg.ok').isVisible(), 'ข้อมูลตัวอย่าง: แสดง ✔ ไม่พบปัญหา');

  // เพิ่มวิชา 40 คาบ ให้ครูสมศรี + กลุ่ม 6701 (เกินแน่นอน)
  await p.goto(ROOT + '#/input?tab=subjects');
  await p.getByPlaceholder('เช่น 20001-1001').fill('HEAVY-1');
  await p.getByPlaceholder('เช่น ภาษาไทย').fill('วิชาหนัก');
  await p.getByRole('spinbutton', { name: 'จำนวนคาบต่อสัปดาห์' }).fill('40');
  await p.getByRole('button', { name: 'เพิ่มวิชาเรียน' }).click();
  await p.goto(ROOT + '#/input?tab=assignments');
  await pick(0, 'วิชาหนัก');
  await p.locator('.smulti').nth(0).locator('label', { hasText: 'สมศรี' }).first().locator('input').check();
  await p.locator('.smulti').nth(2).locator('label', { hasText: '6701' }).first().locator('input').check();
  await pick(1, 'อาคาร 1'); await pick(2, '101');
  await p.getByRole('button', { name: 'บันทึก', exact: true }).click();

  await p.goto(ROOT + '#/');
  const err = p.locator('.load-check .msg.err');
  await err.waitFor();
  const t = await err.innerText();
  assert(t.includes('จัดให้ครบทุกคาบไม่ได้แน่นอน'), 'แสดงกล่องแดง "จัดให้ครบทุกคาบไม่ได้แน่นอน" ก่อนกดจัด');
  assert(/ครู นางสมศรี ใจดี: ต้องสอน \d+ คาบ\/สัปดาห์ แต่มีช่องว่างได้ \d+ คาบ \(เกิน \d+ คาบ/.test(t), 'ระบุชื่อครู จำนวนคาบที่ต้องสอน ช่องว่างที่มี และจำนวนที่เกิน');
  assert(/เฉลี่ย [\d.]+ คาบ\/วัน จากที่มี \d+ คาบ\/วัน/.test(t), 'บอกค่าเฉลี่ยคาบต่อวันเทียบกับคาบที่มีต่อวัน');
  assert(/กลุ่มเรียน 6701 ปวช\.1\/1: ต้องเรียน/.test(t), 'กลุ่มเรียนที่เกินก็ถูกจับด้วย');
  await p.locator('.load-check details summary').click();
  assert((await p.locator('.load-check details table tbody tr').count()) >= 5, 'ตารางภาระที่หนักที่สุดแสดงรายการ');

  // กดจัดได้ตามปกติ (ไม่ถูกบล็อก) แล้วระบบรายงานสาเหตุที่จัดไม่ได้ตามเดิม
  await p.getByLabel('เวลาประมวลผลสูงสุด').selectOption('5');
  await p.getByRole('button', { name: /^⚙ จัดตารางอัตโนมัติ/ }).click();
  await p.locator('.msg.err', { hasText: 'จัดไม่ได้' }).first().waitFor({ timeout: 60000 });
  assert(true, 'กดจัดแล้ว ระบบจัดเท่าที่ได้และรายงานคาบที่จัดไม่ได้พร้อมสาเหตุ');

  const uniq = [...new Set(problems)];
  uniq.forEach((x) => console.log('  ⚠', x));
  assert(uniq.length === 0, 'ไม่มี console error / page error');
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
