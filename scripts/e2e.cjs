// ทดสอบ end-to-end ด้วย Playwright (ต้องรัน `npx vite preview --port 4173` ก่อน)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = process.env.OUT || '/tmp/e2e-out';
const SAMPLE = path.resolve(__dirname, '../sample-data');
const FIX = path.join(OUT, 'fixtures');
const ExcelJS = require('exceljs');
const log = (...a) => console.log('•', ...a);
const assert = (c, m) => { if (!c) { console.error('✗ FAIL:', m); process.exitCode = 1; } else log('ok:', m); };
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(FIX, { recursive: true });

// ไฟล์ทดสอบ Import: ใช้ทั้ง 3 รูปแบบ (xlsx / csv / json)
async function writeXlsx(file, rows) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('ข้อมูล'); rows.forEach((r) => ws.addRow(r)); await wb.xlsx.writeFile(file);
}
async function makeFixtures() {
  await writeXlsx(path.join(FIX, 'teachers.xlsx'), [['ชื่อครู', 'หน้าที่ (ครูสอนหลัก/ครูสอนร่วม)'],
    ['นางสมศรี ใจดี', 'ครูสอนหลัก'], ['นายประเสริฐ มั่นคง', 'ครูสอนหลัก'], ['นางสาวมาลี สุขใจ', 'ครูสอนหลัก'], ['นายวิชัย ทองดี', 'ครูสอนหลัก'], ['นางสาวพิมพ์ใจ ศรีสุข', 'ครูสอนร่วม']]);
  // CSV: BOM + ลำดับคอลัมน์สลับ + ช่องมีเครื่องหมายคำพูด/คอมมา
  fs.writeFileSync(path.join(FIX, 'groups.csv'), '\uFEFFชื่อกลุ่มเรียน,รหัสกลุ่มเรียน,สาขาวิชา\r\n"ปวช.1/1",06701,"การบัญชี, ภาคปกติ"\r\nปวช.1/2,6702,การตลาด\r\n');
  fs.writeFileSync(path.join(FIX, 'subjects.json'), JSON.stringify([
    { รหัสวิชา: '20001-1001', ชื่อวิชา: 'ภาษาไทย', จำนวนคาบต่อสัปดาห์: 2 }, { รหัสวิชา: '20000-1201', ชื่อวิชา: 'คณิตศาสตร์', จำนวนคาบต่อสัปดาห์: 3 },
    { รหัสวิชา: '30100-1001', ชื่อวิชา: 'การบัญชีเบื้องต้น', จำนวนคาบต่อสัปดาห์: 4 }]));
  fs.writeFileSync(path.join(FIX, 'buildings.json'), JSON.stringify({ buildings: [{ name: 'อาคาร 1', floors: 3, roomsPerFloor: 4 }, { name: 'อาคาร 2', floors: 2, roomsPerFloor: 3 }] }));
  await writeXlsx(path.join(FIX, 'special.xlsx'), [['ชื่อกรณีพิเศษ', 'จำนวนคาบ', 'เงื่อนไข', 'รหัสกลุ่มเรียนที่เกี่ยวข้อง (คั่นด้วย ,)', 'ชื่อครูที่เกี่ยวข้อง (คั่นด้วย ,)'],
    ['คาบกิจกรรม', '1', 'ทุกวันคาบที่ 1', '', ''], ['ชุมนุม', '2', 'วันพุธ คาบ 7', '06701,6702', ''], ['ประชุมครู', '2', 'วันอังคาร คาบ 1-2', '', 'นางสมศรี ใจดี']]);
  fs.writeFileSync(path.join(FIX, 'bad.csv'), 'foo,bar\n1,2\n');
  fs.writeFileSync(path.join(FIX, 'bad.json'), '{ "teachers": [ ');
  fs.writeFileSync(path.join(FIX, 'rows_bad.csv'), 'ชื่อครู,หน้าที่\nดี,ครูสอนหลัก\nเสีย,หัวหน้า\n,ครูสอนหลัก\n');
  fs.writeFileSync(path.join(FIX, 'old.xls'), 'x');
}

(async () => {
  await makeFixtures();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('tt-session', JSON.stringify({ role: 'admin' })); } catch (e) {} }); // ข้ามหน้าเข้าสู่ระบบ
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());

  const nav = (t) => page.locator('.nav a', { hasText: t }).click();
  const tab = (t) => page.locator('.tabs button', { hasText: new RegExp(`^${t}$`) }).click();
  // เลือกค่าจากช่องค้นหา: พิมพ์แล้วคลิกตัวเลือก
  const ssPick = async (loc, text) => {
    await loc.click();
    await loc.fill(text);
    await page.locator('.ss-opt', { hasText: text }).first().click();
  };
  const smCheck = (idx, name) => page.locator('.smulti').nth(idx).locator('label', { hasText: name }).first().locator('input').check();

  const runSchedule = async (sec = 5) => {
    await page.getByLabel('เวลาประมวลผลสูงสุด').selectOption(String(sec));
    await page.getByRole('button', { name: /จัดตารางอัตโนมัติ/ }).click();
    await page.getByText(/วางแล้ว/).waitFor({ timeout: (sec + 25) * 1000 });
  };
  // ช่องที่ถูกครอบโดยรายการที่มีข้อความ (คำนึงถึง colspan และคอลัมน์พักเที่ยง)
  const coveredCols = (text) => page.evaluate((t) => {
    const out = [];
    document.querySelectorAll('table.tt tbody tr').forEach((r, ri) => {
      let col = 0;
      r.querySelectorAll('td').forEach((td) => {
        const span = td.colSpan || 1;
        if (!td.classList.contains('lunch') && td.innerText.includes(t)) for (let k = 0; k < span; k++) out.push(`${ri}-${col + k}`);
        col += span;
      });
    });
    return out;
  }, text);

  await page.goto('http://localhost:4173/#/');
  assert(await page.locator('.guide').getByText('เริ่มต้นใช้งาน').isVisible() && await page.locator('.guide').getByText('ทำแล้ว 0/4').isVisible(), 'Dashboard ผู้ใช้ใหม่: การ์ดเริ่มต้นใช้งาน (ทำแล้ว 0/4)');

  // ---- ตั้งค่าคาบ ----
  await nav('กรอกข้อมูล');
  for (const d of ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์']) await page.getByLabel(d).check();
  await page.getByLabel('จำนวนคาบต่อวัน').fill('8');
  const times = ['08:30', '09:20', '10:10', '11:00', '11:50', '12:50', '13:40', '14:30', '15:20', '16:10'];
  const se = [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [7, 8], [8, 9]];
  const ti = page.locator('input[type=time]');
  for (let i = 0; i < 8; i++) { await ti.nth(i * 2).fill(times[se[i][0]]); await ti.nth(i * 2 + 1).fill(times[se[i][1]]); }
  await page.getByLabel('พักเที่ยงหลังคาบที่').selectOption('4');
  await page.getByRole('button', { name: 'บันทึกการตั้งค่า' }).click();
  assert(await page.getByText('บันทึกการตั้งค่าแล้ว').isVisible(), 'บันทึกการตั้งค่าคาบ');

  // ---- Import Excel ----
  const imports = [['ครู', 'teachers.xlsx', 5], ['กลุ่มเรียน', 'groups.csv', 2], ['วิชาเรียน', 'subjects.json', 3], ['ห้องเรียน', 'buildings.json', 2]];
  for (const [t, file, n] of imports) {
    await tab(t);
    await page.locator('input[type=file]').last().setInputFiles(path.join(FIX, file));
    await page.getByText(`นำเข้าสำเร็จ ${n} รายการ`).waitFor({ timeout: 8000 });
    assert(true, `Import ${t} จากไฟล์ ${path.extname(file)} ${n} รายการ`);
  }

  await tab('กลุ่มเรียน');
  assert(await page.locator('table.data').getByText('06701').isVisible(), 'CSV: รหัสนำหน้าศูนย์ (06701) คงเป็นข้อความ + คอลัมน์สลับลำดับอ่านถูก');
  assert(await page.locator('table.data').getByText('การบัญชี, ภาคปกติ').isVisible(), 'CSV: ช่องที่มีคอมมาในเครื่องหมายคำพูดอ่านถูก');
  await tab('วิชาเรียน');
  await page.getByPlaceholder('เช่น 20001-1001').fill('ART1');
  await page.getByPlaceholder('เช่น ภาษาไทย').fill('ศิลปะ');
  await page.getByRole('spinbutton', { name: 'จำนวนคาบต่อสัปดาห์' }).fill('2');
  await page.getByRole('button', { name: 'เพิ่มวิชาเรียน' }).click();
  assert(await page.getByText(/เพิ่มวิชาเรียน "ART1" เรียบร้อย/).isVisible(), 'เพิ่มวิชาศิลปะ');

  // ---- ข้อ 1: ครูชื่อเดียวกันคนละหน้าที่ ----
  await tab('ครู');
  await page.getByPlaceholder('เช่น นางสมศรี ใจดี').fill('นางสมศรี ใจดี');
  await page.locator('form select').selectOption('ครูสอนร่วม');
  await page.getByRole('button', { name: 'เพิ่มครู' }).click();
  assert(await page.getByText(/เพิ่มครู "นางสมศรี ใจดี \(ครูสอนร่วม\)" เรียบร้อย/).isVisible(), 'ข้อ1: ชื่อซ้ำแต่คนละหน้าที่ เพิ่มได้');
  await page.getByPlaceholder('เช่น นางสมศรี ใจดี').fill('นางสมศรี ใจดี');
  await page.getByRole('button', { name: 'เพิ่มครู' }).click();
  assert(await page.getByText(/มีอยู่ในระบบแล้ว/).isVisible(), 'ข้อ1: ชื่อเดียวกัน+หน้าที่เดียวกัน ยังถูกกันซ้ำ');
  // import ซ้ำ
  await page.locator('input[type=file]').last().setInputFiles(path.join(FIX, 'teachers.xlsx'));
  await page.getByText(/นำเข้าสำเร็จ 0 รายการ/).waitFor({ timeout: 8000 });
  assert(true, 'Import ซ้ำถูกข้าม');
  // ไฟล์เสีย: แจ้ง error ภาษาไทย ไม่ crash
  for (const [f, re, label] of [['bad.csv', /หัวตารางไม่ตรง/, 'CSV หัวตารางไม่ตรง'], ['bad.json', /อ่าน JSON ไม่ได้/, 'JSON เสีย'], ['old.xls', /ไม่รองรับไฟล์ \.xls/, 'ไฟล์ .xls เก่า']]) {
    await page.locator('input[type=file]').last().setInputFiles(path.join(FIX, f));
    await page.locator('.msg.err', { hasText: re }).waitFor({ timeout: 8000 });
    assert(true, `Import ${label} -> แจ้ง error`);
  }
  await page.locator('input[type=file]').last().setInputFiles(path.join(FIX, 'rows_bad.csv'));
  await page.getByText(/นำเข้าสำเร็จ 1 รายการ/).waitFor({ timeout: 8000 });
  assert((await page.locator('.msg li').allInnerTexts()).join('|').includes('แถว 3') && (await page.locator('.msg li').allInnerTexts()).join('|').includes('แถว 4'), 'CSV บางแถวผิด: นำเข้าแถวที่ถูก + รายงานเลขแถวที่ผิด (แถว 3, 4)');
  // ลบครู "ดี" ที่เพิ่งนำเข้า เพื่อไม่ให้กระทบขั้นตอนถัดไป
  await page.locator('table.data tbody tr', { has: page.getByRole('cell', { name: 'ดี', exact: true }) }).getByRole('button', { name: 'ลบ' }).click();
  // ดาวน์โหลด Template ทั้ง 3 รูปแบบ
  for (const [fmt, ext] of [['CSV', 'csv'], ['JSON', 'json'], ['Excel', 'xlsx']]) {
    const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('.btn-group[aria-label="ดาวน์โหลด Template"]').getByRole('button', { name: fmt, exact: true }).click()]);
    await dl2.saveAs(`${OUT}/tpl_${ext}.${ext}`);
  }
  const tplCsv = fs.readFileSync(`${OUT}/tpl_csv.csv`, 'utf8');
  assert(tplCsv.startsWith('\uFEFF') && tplCsv.includes('ชื่อครู'), 'Template CSV (UTF-8 BOM + หัวตาราง)');
  const tplJson = JSON.parse(fs.readFileSync(`${OUT}/tpl_json.json`, 'utf8'));
  assert(Array.isArray(tplJson.teachers) && tplJson.teachers.length === 0 && Array.isArray(tplJson['_ตัวอย่าง']), 'Template JSON (รายการว่าง + ตัวอย่างในคีย์ _ตัวอย่าง)');

  // ---- กรณีพิเศษ ----
  await tab('กรณีพิเศษ');
  await page.locator('input[type=file]').last().setInputFiles(path.join(FIX, 'special.xlsx'));
  await page.getByText('นำเข้าสำเร็จ 3 รายการ').waitFor();
  assert(await page.locator('table.data').getByText('ครู นางสมศรี ใจดี').first().isVisible(), 'ข้อ2: Import กรณีพิเศษที่ระบุครูได้');
  // เพิ่มผ่านฟอร์ม: ครูคนหนึ่ง + กลุ่มหนึ่ง ประชุมวันพฤหัส
  await page.getByPlaceholder('เช่น คาบกิจกรรม').fill('ประชุมเฉพาะ');
  await smCheck(0, '6702');
  await page.locator('.smulti').nth(1).locator('.sm-search').fill('วิชัย');
  assert((await page.locator('.smulti').nth(1).locator('.checklist label').count()) === 1, 'ข้อ3: ค้นหาครูในกรณีพิเศษกรองรายการ');
  await smCheck(1, 'นายวิชัย');
  await page.locator('textarea').fill('วันพฤหัสบดี คาบ 3-4');
  assert(await page.getByText(/ระบบเข้าใจว่า/).isVisible(), 'พรีวิวการแปลงเงื่อนไขภาษาไทย');
  await page.getByRole('button', { name: 'เพิ่มกรณีพิเศษ' }).click();
  assert(await page.getByText('เพิ่มกรณีพิเศษ "ประชุมเฉพาะ" เรียบร้อย').isVisible(), 'ข้อ2: เพิ่มกรณีพิเศษเลือกครู+กลุ่มได้');
  await page.locator('textarea').fill('ทุกวันคาบที่ 99');
  assert(await page.locator('.msg.err').first().isVisible(), 'เงื่อนไขผิดแจ้ง error');
  await page.screenshot({ path: `${OUT}/02-special.png`, fullPage: true });

  // ---- กำหนดการเรียน (ค้นหาได้ทุกหัวข้อ) ----
  await tab('กำหนดการเรียน');
  const ss = page.locator('.ss-input');
  const add = async (subj, mains, cos, groups, bld, room) => {
    await ssPick(ss.nth(0), subj);
    for (const m of mains) await smCheck(0, m);
    for (const c of cos) await smCheck(1, c);
    for (const g of groups) await smCheck(2, g);
    await ssPick(ss.nth(1), bld);
    await ssPick(ss.nth(2), room);
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  };
  // ทดสอบพิมพ์ค้นหา: ครูสอนหลัก
  await page.locator('.smulti').nth(0).locator('.sm-search').fill('มาลี');
  assert((await page.locator('.smulti').nth(0).locator('.checklist label').count()) === 1, 'ข้อ3: ค้นหาครูสอนหลักได้');
  await page.locator('.smulti').nth(0).locator('.sm-search').fill('');
  await ss.nth(0).click(); await ss.nth(0).fill('บัญชี');
  assert((await page.locator('.ss-opt').count()) === 1, 'ข้อ3: ค้นหาวิชาได้');
  await ss.nth(0).fill('');
  await page.keyboard.press('Escape');
  await add('ภาษาไทย', ['นางสมศรี'], [], ['6701', '6702'], 'อาคาร 1', '101');
  await add('คณิตศาสตร์', ['นายประเสริฐ'], ['พิมพ์ใจ'], ['6701'], 'อาคาร 1', '102');
  await add('การบัญชีเบื้องต้น', ['มาลี'], [], ['6702'], 'อาคาร 2', '101');
  await add('การบัญชีเบื้องต้น', ['มาลี'], [], ['6701'], 'อาคาร 2', '101'); // วิชา/ครู/ห้องเดียวกัน -> รวมสอน
  // เลือก "แยกเรียน" ตั้งแต่กำหนดการเรียน: ศิลปะ 2 กลุ่ม ครูเดียว ห้องเดียว
  await page.locator('.radio', { hasText: 'แยกเรียน' }).click();
  await add('ศิลปะ', ['วิชัย'], [], ['6701', '6702'], 'อาคาร 1', '201');
  assert((await page.locator('table.data tbody tr').count()) === 5, 'บันทึกกำหนดการเรียน 5 รายการ (ผ่านช่องค้นหา)');
  assert(await page.locator('table.data').getByText('แยกเรียน').first().isVisible(), 'ตารางสรุปแสดง "แยกเรียน"');
  assert(await page.locator('table.data').getByText('เรียนรวมกัน').first().isVisible(), 'ตารางสรุปแสดง "เรียนรวมกัน"');
  await page.screenshot({ path: `${OUT}/03-assignments.png`, fullPage: true });

  // ---- จัดตาราง ----
  await nav('Dashboard');
  // ทดสอบปุ่มหยุด (ตั้ง 60 วินาที แล้วกดหยุดกลางคัน)
  await page.getByLabel('เวลาประมวลผลสูงสุด').selectOption('60');
  await page.getByRole('button', { name: /จัดตารางอัตโนมัติ/ }).click();
  await page.getByText(/กำลังจัดตารางและปรับให้สวยขึ้น/).waitFor({ timeout: 5000 });
  await page.waitForTimeout(1500);
  assert(await page.locator('.progress').isVisible(), 'แสดงแถบความคืบหน้าระหว่างประมวลผล');
  await page.screenshot({ path: `${OUT}/04a-running.png`, fullPage: true });
  await page.getByRole('button', { name: /หยุดและใช้ผลที่ดีที่สุด/ }).click();
  await page.getByText(/จัดตารางครบทุกคาบ/).waitFor({ timeout: 15000 });
  assert(true, 'กดหยุดแล้วได้ผลที่ดีที่สุด (Web Worker ทำงาน)');
  assert(await page.getByText(/คาบว่างคั่น นักเรียน \d+ → \d+/).first().isVisible(), 'แสดงตัวชี้วัดคาบว่างคั่น ก่อน/หลังปรับให้ดีขึ้น');
  assert(await page.getByText('รวมสอนพร้อมกัน 1 รายการ').isVisible(), 'รวมเรียนพร้อมกัน (วิชา/ครู/ห้องเดียวกัน + เลือกเรียนรวม) 1 รายการ');
  await runSchedule(5); // รันเต็มตามเวลา/จบก่อนเมื่อไม่ดีขึ้น
  await ssPick(page.locator('.ss-input').first(), '6702');
  await page.screenshot({ path: `${OUT}/04-dashboard-group.png`, fullPage: true });
  const g2 = await page.locator('table.tt').innerText();
  assert(g2.includes('การบัญชีเบื้องต้น') && g2.includes('นางสาวมาลี') && g2.includes('อาคาร 2'), 'ตารางกลุ่มเรียนแสดง วิชา/ครู/อาคาร');
  assert(g2.includes('คาบกิจกรรม') && g2.includes('ประชุมเฉพาะ'), 'กรณีพิเศษ (ทุกคน + เฉพาะกลุ่ม) ถูกวางในตาราง');

  // รวมเรียน: กลุ่ม 6701 และ 6702 ต้องมีบัญชีเวลาเดียวกัน
  await ssPick(page.locator('.ss-input').first(), '6701');
  const a = (await coveredCols('การบัญชีเบื้องต้น')).join(',');
  const colspan4 = await page.evaluate(() => [...document.querySelectorAll('table.tt td[colspan="4"]')].some((td) => td.innerText.includes('การบัญชีเบื้องต้น')));
  assert(colspan4, 'วิชา 4 คาบ = ช่วงติดกัน รวมเป็นช่องเดียว (colspan=4) ในตาราง UI');
  assert(await page.locator('.span-tag', { hasText: '4 คาบติดกัน' }).first().isVisible(), 'ช่องที่รวมแสดงป้าย "4 คาบติดกัน"');
  const sum6701 = await page.locator('.summary').innerText();
  assert(/การบัญชีเบื้องต้น\s*4 คาบ/.test(sum6701) && /ศิลปะ\s*2 คาบ/.test(sum6701), 'Dashboard กลุ่มเรียนมีสรุปคาบต่อสัปดาห์แยกตามวิชา');
  const art1 = await coveredCols('ศิลปะ');
  await ssPick(page.locator('.ss-input').first(), '6702');
  const b = (await coveredCols('การบัญชีเบื้องต้น')).join(',');
  const art2 = await coveredCols('ศิลปะ');
  assert(a && a === b, `เรียนรวม: บัญชีของ 2 กลุ่มสอนเวลาเดียวกัน (${a})`);
  assert(art1.length === 2 && art2.length === 2 && art1.every((x) => !art2.includes(x)), `แยกเรียน: ศิลปะของ 2 กลุ่มคนละเวลา (${art1} | ${art2})`);
  const artSpan = await page.evaluate(() => [...document.querySelectorAll('table.tt td[colspan="2"]')].some((td) => td.innerText.includes('ศิลปะ')));
  assert(artSpan, 'วิชา 2 คาบ (แยกเรียน) ติดกันเป็นช่องเดียว (colspan=2)');

  // มุมมองครู: ครูชื่อเดียวกัน 2 หน้าที่ รวมเป็นรายการเดียว และเห็นประชุม
  await page.locator('.seg button', { hasText: 'ครู' }).click();
  await ssPick(page.locator('.ss-input').first(), 'นางสมศรี');
  await page.screenshot({ path: `${OUT}/05-dashboard-teacher.png`, fullPage: true });
  const tText = await page.locator('table.tt').innerText();
  assert(tText.includes('ประชุมครู') && tText.includes('ภาษาไทย'), 'ข้อ2: ตารางครูแสดงกรณีพิเศษเฉพาะครู + วิชาที่สอน');
  assert(/ภาษาไทย\s*2 คาบ/.test(await page.locator('.summary').innerText()), 'Dashboard ครูมีสรุปคาบสอนต่อสัปดาห์');
  await page.locator('.ss-input').first().click();
  await page.locator('.ss-input').first().fill('นางสมศรี');
  assert((await page.locator('.ss-opt').count()) === 1, 'ข้อ1: มุมมองครูรวมชื่อซ้ำเป็นรายการเดียว');
  await page.keyboard.press('Escape');

  // มุมมองอาคาร
  await page.locator('.seg button', { hasText: 'อาคาร' }).click();
  await ssPick(page.locator('.ss-input').first(), 'อาคาร 2');
  await page.screenshot({ path: `${OUT}/06-dashboard-building.png`, fullPage: true });
  assert(/\[\d{3}\]/.test(await page.locator('table.tt').innerText()), 'ตารางอาคารแสดงรหัสห้อง');
  assert(/ห้อง 101\s*\d+ คาบ/.test(await page.locator('.summary').innerText()), 'Dashboard อาคารมีสรุปคาบต่อสัปดาห์แยกตามห้อง');

  // ---- Export ----
  await page.locator('.seg button', { hasText: 'กลุ่มเรียน' }).click();
  let [d1] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.getByRole('button', { name: 'Export PDF' }).click()]);
  await d1.saveAs(`${OUT}/out.pdf`);
  assert(fs.readFileSync(`${OUT}/out.pdf`).slice(0, 4).toString() === '%PDF', 'Export PDF ได้ไฟล์ PDF จริง');
  let [d2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export Excel (รายการนี้)' }).click()]);
  await d2.saveAs(`${OUT}/out.xlsx`);
  let [d3] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Export Excel \(ทุก/ }).click()]);
  await d3.saveAs(`${OUT}/out_all.xlsx`);
  assert(fs.statSync(`${OUT}/out.xlsx`).size > 3000 && fs.statSync(`${OUT}/out_all.xlsx`).size > 3000, 'Export Excel ได้ไฟล์');

  // ---- รีเฟรช / ข้อมูลเดิม (migrate) ----
  await page.reload();
  assert(await page.locator('table.tt').isVisible(), 'รีเฟรชแล้วข้อมูลและตารางยังอยู่');

  // ---- ข้อมูลตัวอย่าง 3 ขนาด (โหลดจากปุ่ม แล้วจัดตารางผ่าน Worker) ----
  for (const [label, groups, sec] of [['เล็ก', 4, 5], ['กลาง', 12, 15], ['ใหญ่', 30, 30]]) {
    await nav('กรอกข้อมูล');
    await page.getByRole('button', { name: new RegExp(`^${label} \\(${groups} กลุ่ม\\)`) }).click();
    await tab('กลุ่มเรียน');
    assert(await page.getByText(`กลุ่มเรียนที่มีอยู่ในระบบ (${groups})`).isVisible(), `ตัวอย่างขนาด${label}: ${groups} กลุ่มเรียน`);
    await nav('Dashboard');
    await runSchedule(sec);
    const stat = await page.locator('.stat').first().innerText();
    log(`ตัวอย่าง${label}:`, stat);
    assert(await page.getByText(/จัดตารางครบทุกคาบ/).isVisible(), `ตัวอย่างขนาด${label} จัดครบทุกคาบ`);
    assert(await page.getByText(/รวมสอนพร้อมกัน \d+ รายการ/).first().isVisible(), `ตัวอย่างขนาด${label} มีรายการรวมเรียน`);
    await page.screenshot({ path: `${OUT}/07-sample-${label === 'เล็ก' ? 'small' : label === 'กลาง' ? 'medium' : 'large'}.png`, fullPage: true });
  }
  // ---- กู้คืน dataset.json (ชุดสมบูรณ์รวมกำหนดการเรียน) ----
  await nav('กรอกข้อมูล');
  await page.locator('input[type=file][accept=".json"]').setInputFiles(path.join(SAMPLE, 'medium', 'dataset.json'));
  await tab('กลุ่มเรียน');
  assert(await page.getByText('กลุ่มเรียนที่มีอยู่ในระบบ (12)').isVisible(), 'กู้คืน dataset.json (ขนาดกลาง) ได้ 12 กลุ่ม');
  await tab('กำหนดการเรียน');
  assert(await page.getByText('กำหนดการเรียนที่มีอยู่ในระบบ (108)').isVisible(), 'กู้คืน dataset.json ได้กำหนดการเรียนครบ (108 รายการ)');
  // ---- Import ไฟล์ตัวอย่างในโฟลเดอร์ sample-data (csv/json/xlsx ขนาดกลาง) ----
  await nav('กรอกข้อมูล');
  await page.getByRole('button', { name: 'ล้างข้อมูลทั้งหมด' }).click();
  await tab('ตั้งค่าคาบเรียน');
  for (const d of ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์']) await page.getByLabel(d).check();
  await page.getByLabel('จำนวนคาบต่อวัน').fill('8');
  const ti2 = page.locator('input[type=time]');
  for (let i = 0; i < 8; i++) { await ti2.nth(i * 2).fill(times[se[i][0]]); await ti2.nth(i * 2 + 1).fill(times[se[i][1]]); }
  await page.getByLabel('พักเที่ยงหลังคาบที่').selectOption('4');
  await page.getByRole('button', { name: 'บันทึกการตั้งค่า' }).click();
  const med = [['ครู', 'teachers.json', 24], ['กลุ่มเรียน', 'groups.csv', 12], ['วิชาเรียน', 'subjects.xlsx', 9], ['ห้องเรียน', 'buildings.csv', 3], ['กรณีพิเศษ', 'special_cases.json', 3]];
  for (const [t, f, n] of med) {
    await tab(t);
    await page.locator('input[type=file]').last().setInputFiles(path.join(SAMPLE, 'medium', f));
    await page.getByText(`นำเข้าสำเร็จ ${n} รายการ`).waitFor({ timeout: 10000 });
    assert(true, `sample-data/medium/${f}: Import ${t} ${n} รายการ`);
  }
  await page.setViewportSize({ width: 390, height: 800 });
  await page.screenshot({ path: `${OUT}/08-mobile.png` });

  assert(errors.length === 0, 'ไม่มี console/page error ' + errors.slice(0, 3).join(' | '));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
