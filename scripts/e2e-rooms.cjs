// ทดสอบ "วิชาเสรี": กำหนดการเรียนเลือกได้หลายห้อง/หลายอาคารพร้อมกัน
// รัน: node scripts/e2e-rooms.cjs [URL]  (ค่าเริ่มต้น http://localhost:4173/ ต้องรัน `npx vite preview --port 4173` ก่อน)
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
  await p.getByRole('button', { name: /ลองใช้ด้วยข้อมูลตัวอย่าง/ }).click();
  await p.waitForFunction(() => document.querySelectorAll('.guide .gs.done').length === 3);

  // เพิ่มวิชาเสรี 3 คาบ
  await p.goto(ROOT + '#/input?tab=subjects');
  await p.getByPlaceholder('เช่น 20001-1001').fill('FREE-01');
  await p.getByPlaceholder('เช่น ภาษาไทย').fill('วิชาเสรี');
  await p.getByRole('spinbutton', { name: 'จำนวนคาบต่อสัปดาห์' }).fill('3');
  await p.getByRole('button', { name: 'เพิ่มวิชาเรียน' }).click();

  // กำหนดการเรียน: 2 ครู 2 กลุ่ม แยกไป 2 อาคาร
  await p.goto(ROOT + '#/input?tab=assignments');
  // ปุ่ม "เลือกทั้งหมด": กลุ่มเรียน (ตัวอย่างเล็ก 4 กลุ่ม)
  const grpBox = p.locator('.smulti').nth(2);
  await grpBox.getByRole('button', { name: 'เลือกทั้งหมด (4)' }).click();
  assert((await grpBox.locator('.sm-chips .chip').count()) === 4, 'ปุ่ม "เลือกทั้งหมด (4)" เลือกครบ 4 กลุ่มโดยไม่ต้องพิมพ์ค้นหา');
  await grpBox.getByRole('button', { name: 'ล้างที่เลือก' }).click();
  assert((await grpBox.locator('.sm-chips .chip').count()) === 0, '"ล้างที่เลือก" ล้างหมด');
  await grpBox.locator('input.sm-search').fill('6701');
  await grpBox.getByRole('button', { name: /เลือกทั้งหมดที่ค้นเจอ \(1\)/ }).click();
  assert((await grpBox.locator('.sm-chips .chip').count()) === 1, 'พิมพ์ค้นหา "6701" แล้วเลือกที่ค้นเจอ ได้เฉพาะ 1 กลุ่ม');
  await grpBox.locator('input.sm-search').fill('');
  await grpBox.getByRole('button', { name: /เลือกทั้งหมด \(4\)/ }).click();
  assert((await grpBox.locator('.sm-chips .chip').count()) === 4, 'เลือกทั้งหมดต่อจากที่เลือกไว้ ไม่ซ้ำ (รวม 4)');
  await grpBox.getByRole('button', { name: 'ล้างที่เลือก' }).click();
  await pick(0, 'เสรี');
  await p.locator('.smulti').nth(0).locator('label', { hasText: 'สมศรี' }).first().locator('input').check();
  await p.locator('.smulti').nth(0).locator('label', { hasText: 'ประเสริฐ' }).first().locator('input').check();
  await p.locator('.smulti').nth(2).locator('label', { hasText: '6701' }).first().locator('input').check();
  await p.locator('.smulti').nth(2).locator('label', { hasText: '6702' }).first().locator('input').check();
  await pick(1, 'อาคาร 1'); await pick(2, '101');
  await p.getByRole('button', { name: '＋ เพิ่มห้อง' }).click();
  assert((await p.locator('.sm-chips[aria-label="ห้องที่เลือกไว้"] .chip').count()) === 1, 'เพิ่มห้องแรกแล้วขึ้นชิป 1 ห้อง');
  await pick(1, 'อาคาร 2'); await pick(2, '203');
  await p.getByRole('button', { name: '＋ เพิ่มห้อง' }).click();
  const chips = await p.locator('.sm-chips[aria-label="ห้องที่เลือกไว้"] .chip').allInnerTexts();
  assert(chips.length === 2 && chips[0].includes('อาคาร 1 ห้อง 101') && chips[1].includes('อาคาร 2 ห้อง 203'), `ชิปห้อง: ${chips.map((c) => c.replace('×', '').trim()).join(' | ')}`);
  // เพิ่มห้องซ้ำ -> ปฏิเสธ
  await pick(1, 'อาคาร 2'); await pick(2, '203');
  await p.getByRole('button', { name: '＋ เพิ่มห้อง' }).click();
  assert(await p.getByText('ห้องนี้เลือกไว้แล้ว').isVisible(), 'เพิ่มห้องซ้ำ -> แจ้งว่าเลือกไว้แล้ว');
  assert((await p.locator('.sm-chips[aria-label="ห้องที่เลือกไว้"] .chip').count()) === 2, 'ห้องซ้ำไม่ถูกเพิ่ม');
  // เอาห้องออกแล้วใส่กลับ (ทดสอบปุ่ม ×)
  await p.locator('.sm-chips[aria-label="ห้องที่เลือกไว้"] .chip').nth(1).locator('button.x').click();
  assert((await p.locator('.sm-chips[aria-label="ห้องที่เลือกไว้"] .chip').count()) === 1, 'กด × เอาห้องออกได้');
  await pick(1, 'อาคาร 2'); await pick(2, '203'); // ไม่กด "เพิ่มห้อง" — ปุ่มบันทึกต้องนับห้องที่เลือกค้างให้
  await p.getByRole('button', { name: 'บันทึก', exact: true }).click();
  assert(await p.getByText(/ใช้ 2 ห้องพร้อมกัน/).isVisible(), 'บันทึกแล้วแจ้ง "ใช้ 2 ห้องพร้อมกัน" (นับห้องที่เลือกค้างในช่องให้ด้วย)');
  const row = p.locator('table.data tbody tr', { hasText: 'วิชาเสรี' }).first();
  const rowText = await row.innerText();
  assert(rowText.includes('อาคาร 1 ห้อง 101') && rowText.includes('อาคาร 2 ห้อง 203') && rowText.includes('2 ห้องพร้อมกัน'), 'ตารางสรุปแสดงทั้งสองอาคาร + ป้าย "2 ห้องพร้อมกัน"');

  // จัดตาราง
  await p.goto(ROOT + '#/');
  await p.getByLabel('เวลาประมวลผลสูงสุด').selectOption('5');
  await p.getByRole('button', { name: /^⚙ จัดตารางอัตโนมัติ/ }).click();
  await p.getByText(/จัดตารางครบทุกคาบ/).waitFor({ timeout: 60000 });
  assert(true, 'จัดตารางครบทุกคาบ (รวมวิชาเสรี) ไม่ชน');

  const gridText = async () => (await p.locator('table.tt').innerText());
  // มุมมองกลุ่ม 6701
  await ss().first().click(); await ss().first().fill('6701'); await p.locator('.ss-opt').first().click();
  const g = await gridText();
  assert(g.includes('วิชาเสรี') && g.includes('อาคาร 1 ห้อง 101') && g.includes('อาคาร 2 ห้อง 203'), 'มุมมองกลุ่ม: ช่องวิชาเสรีแสดงทั้ง อาคาร 1 ห้อง 101 และ อาคาร 2 ห้อง 203 พร้อมกัน');
  assert(g.includes('สมศรี') && g.includes('ประเสริฐ'), 'มุมมองกลุ่ม: แสดงครูทั้ง 2 คนในช่องเดียวกัน');
  // มุมมองอาคาร
  await p.locator('.seg button', { hasText: 'อาคาร' }).click();
  await ss().first().click(); await ss().first().fill('อาคาร 2'); await p.locator('.ss-opt').first().click();
  const b2 = await gridText();
  assert(b2.includes('วิชาเสรี [203]') && b2.includes('ใช้พร้อมกับ อาคาร 1 ห้อง 101'), 'มุมมองอาคาร 2: เห็นวิชาเสรีที่ห้อง 203 และบอกว่าใช้พร้อมกับ อาคาร 1');
  await ss().first().click(); await ss().first().fill('อาคาร 1'); await p.locator('.ss-opt').first().click();
  const b1 = await gridText();
  assert(b1.includes('วิชาเสรี [101]') && b1.includes('ใช้พร้อมกับ อาคาร 2 ห้อง 203'), 'มุมมองอาคาร 1: เห็นวิชาเสรีที่ห้อง 101 และบอกว่าใช้พร้อมกับ อาคาร 2');
  // ตำแหน่งเวลาตรงกัน: คาบของวิชาเสรีในอาคาร 1 = ในอาคาร 2
  const pos = async () => p.evaluate(() => [...document.querySelectorAll('table.tt tbody tr')].map((tr, r) => [...tr.children].map((td, c) => (td.textContent || '').includes('วิชาเสรี') ? `${r}:${c}` : null).filter(Boolean)).flat().join(','));
  const pos1 = await pos();
  await ss().first().click(); await ss().first().fill('อาคาร 2'); await p.locator('.ss-opt').first().click();
  const pos2 = await pos();
  assert(pos1 !== '' && pos1 === pos2, `ช่องเวลาของวิชาเสรีตรงกันทั้งสองอาคาร (${pos1})`);

  // ลบอาคาร 2: กำหนดการวิชาเสรียังอยู่ด้วยห้องของอาคาร 1
  await p.goto(ROOT + '#/input?tab=buildings');
  const bRow = p.locator('table.data tbody tr', { hasText: 'อาคาร 2' }).first();
  await bRow.getByRole('button', { name: /ลบ/ }).click();
  await p.goto(ROOT + '#/input?tab=assignments');
  const rt = await p.locator('table.data tbody tr', { hasText: 'วิชาเสรี' }).first().innerText();
  assert(rt.includes('อาคาร 1 ห้อง 101') && !rt.includes('อาคาร 2 ห้อง 203') && !rt.includes('ห้องพร้อมกัน'), 'ลบอาคาร 2 แล้ว วิชาเสรียังอยู่ ใช้ห้องของอาคาร 1 ต่อ');

  const uniq = [...new Set(problems)];
  uniq.forEach((x) => console.log('  ⚠', x));
  assert(uniq.length === 0, 'ไม่มี console error / page error');
  await browser.close();
  console.log(failed ? `\n${failed} FAILED` : '\nALL PASSED');
})().catch((e) => { console.error(e); process.exit(1); });
