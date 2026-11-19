// สร้างคู่มือใช้งานโดยสรุป (ฉบับแยกจากเว็บ) เป็น Word (.docx) ที่แก้ไขได้ — แล้วแปลงเป็น PDF ด้วย LibreOffice
// รัน: node docs/standalone/build-standalone.cjs   (ต้องมี img/ ที่เตรียมไว้; ปรับข้อความใน CONTENT ด้านล่างได้โดยตรง)
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Footer, Header, AlignmentType, LevelFormat,
  HeadingLevel, BorderStyle, WidthType, ShadingType, PageNumber, PageBreak, ExternalHyperlink, TabStopType,
} = require('docx');

const FONT = 'Tahoma';
const W = 9638; // ความกว้างพื้นที่เขียน (A4 ขอบ 2 ซม.) หน่วย DXA
const C = { ink: '1F2937', muted: '6B7280', accent: '2F4A6B', line: 'D1D5DB', head: 'E5ECF4', tip: 'E6F4EA', tipLine: '2E7D32', warn: 'FFF4E0', warnLine: 'B26A00', soft: 'F3F4F6' };
const URL_APP = 'https://marnlop3-vcv.github.io/ttauto/';
const IMG = (n) => fs.readFileSync(path.join(__dirname, 'img', n + '.png'));
const dims = (n) => { const b = IMG(n); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };

// ---------- ตัวช่วย ----------
function runs(text, base = {}) {
  // **ตัวหนา**  และ `ปุ่ม/ข้อความบนจอ` (แสดงตัวหนาสีน้ำเงิน)
  const out = [];
  text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).forEach((s) => {
    if (!s) return;
    if (s.startsWith('**')) out.push(new TextRun({ text: s.slice(2, -2), bold: true, ...base }));
    else if (s.startsWith('`')) out.push(new TextRun({ text: s.slice(1, -1), bold: true, color: C.accent, ...base }));
    else out.push(new TextRun({ text: s, ...base }));
  });
  return out;
}
const P = (text, o = {}) => new Paragraph({ spacing: { after: 90, line: 300 }, ...o.p, children: runs(text, o.r) });
const H1 = (text, pageBreak = false) => new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: pageBreak, children: [new TextRun(text)] });
const H2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] });
const gap = (n = 80) => new Paragraph({ spacing: { after: n }, children: [] });

const lists = [];
function steps(items) {
  const ref = 'n' + lists.length;
  lists.push({
    reference: ref,
    levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 360 } }, run: { bold: true, color: C.accent } } }],
  });
  return items.map((t) => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 70, line: 300 }, children: runs(t) }));
}
const bullets = (items) => items.map((t) => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { after: 60, line: 300 }, children: runs(t) }));

const border = (c = C.line) => ({ style: BorderStyle.SINGLE, size: 4, color: c });
const borders = (c) => ({ top: border(c), bottom: border(c), left: border(c), right: border(c) });
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: none, bottom: none, left: none, right: none };

function table(head, rows, widths, opt = {}) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (t, i, isHead) => new TableCell({
    width: { size: widths[i], type: WidthType.DXA }, borders: borders(),
    shading: isHead ? { fill: C.head, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(t).split('\n').map((line) => new Paragraph({ spacing: { after: 20, line: 280 }, children: runs(line, { size: opt.size || 20, bold: isHead ? true : undefined }) })),
  });
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: head.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((t, i) => cell(t, i, false)) }))],
  });
}
function callout(kind, text) {
  const k = kind === 'warn' ? { fill: C.warn, line: C.warnLine, icon: '⚠ ' } : { fill: C.tip, line: C.tipLine, icon: '💡 ' };
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [W],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: W, type: WidthType.DXA },
      borders: { top: none, bottom: none, right: none, left: { style: BorderStyle.SINGLE, size: 24, color: k.line } },
      shading: { fill: k.fill, type: ShadingType.CLEAR, color: 'auto' }, margins: { top: 80, bottom: 80, left: 160, right: 140 },
      children: [new Paragraph({ spacing: { line: 290 }, children: runs(text, { size: 21 }) })],
    })] })],
  });
}
function image(name, widthPx, caption) {
  const d = dims(name);
  const out = [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 40 }, keepNext: !!caption,
    children: [new ImageRun({ type: 'png', data: IMG(name), transformation: { width: widthPx, height: Math.round((widthPx * d.h) / d.w) }, altText: { title: caption || name, description: caption || name, name } })] })];
  if (caption) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: [new TextRun({ text: caption, size: 18, color: C.muted, italics: true })] }));
  return out;
}
// ข้อความซ้าย + ภาพขวา (ไม่มีเส้นกรอบ)
function sideBySide(leftChildren, name, imgW, caption, leftW = 5500) {
  const rightW = W - leftW;
  const d = dims(name);
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [leftW, rightW],
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: leftW, type: WidthType.DXA }, borders: noBorders, margins: { right: 200 }, children: leftChildren }),
      new TableCell({ width: { size: rightW, type: WidthType.DXA }, borders: noBorders, children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: IMG(name), transformation: { width: imgW, height: Math.round((imgW * d.h) / d.w) }, altText: { title: caption, description: caption, name } })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: caption, size: 18, color: C.muted, italics: true })] }),
      ] }),
    ] })],
  });
}

// ---------- เนื้อหา (แก้ข้อความในส่วนนี้ได้ แล้วรัน node docs/standalone/build-standalone.cjs) ----------
const body = [];
const add = (...x) => x.flat().forEach((e) => body.push(e));

const link = () => new Paragraph({ spacing: { before: 60, after: 100 }, children: [new ExternalHyperlink({ link: URL_APP, children: [new TextRun({ text: URL_APP, bold: true, size: 26, color: '1155CC', underline: {} })] })] });
// ภาพ 2 ภาพเคียงกัน พร้อมคำบรรยายใต้ภาพ
function twoImages(a, capA, b, capB, imgW) {
  const half = W / 2;
  const cell = (name, cap) => {
    const d = dims(name);
    return new TableCell({ width: { size: half, type: WidthType.DXA }, borders: noBorders, children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: IMG(name), transformation: { width: imgW, height: Math.round((imgW * d.h) / d.w) }, altText: { title: cap, description: cap, name } })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: cap, size: 18, color: C.muted, italics: true })] }),
    ] });
  };
  return new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [half, half], rows: [new TableRow({ cantSplit: true, children: [cell(a, capA), cell(b, capB)] })] });
}

add(
  new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'ระบบจัดตารางสอนอัตโนมัติ', size: 44, bold: true, color: C.accent })] }),
  new Paragraph({ spacing: { after: 160 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.accent, space: 6 } }, children: [new TextRun({ text: 'คู่มือการใช้งานโดยสรุป — ตั้งแต่เปิดลิงก์จนถึงแจกตารางให้ผู้อื่น', size: 26, color: C.ink })] }),

  // ----- 1 -----
  H1('1. เปิดลิงก์'),
  sideBySide([
    P('เปิดลิงก์นี้ในเบราว์เซอร์ (Chrome, Edge หรือ Safari) บนคอมพิวเตอร์หรือมือถือ'),
    link(),
    P('จะขึ้นหน้าเว็บตามภาพ — เป็น **หน้าเข้าสู่ระบบ** ไม่ต้องติดตั้งโปรแกรมและไม่ต้องสมัครสมาชิก'),
    P('💡 จัดตารางควรใช้คอมพิวเตอร์ ส่วนดูตารางใช้มือถือได้', { r: { size: 20, color: C.muted } }),
  ], 'q1-open', 205, 'หน้าแรกของเว็บ', 5900),

  // ----- 2 -----
  H1('2. เลือกวิธีเข้าใช้งาน'),
  P('เลือกตามสิ่งที่คุณมี (หมายเลขตรงกับภาพซ้าย):'),
  ...bullets([
    '**①** ต้องการ **จัดตารางสอนเอง** → กด `ใช้งานเป็นผู้ดูแล (จัดตารางเอง)` แล้วไปข้อ 3',
    '**②** มี **ไฟล์ตารางจากผู้ดูแล** (ชื่อ published.enc.json) → กด `มีไฟล์ตารางที่ได้รับ…? เลือกไฟล์` แล้วเลือกไฟล์ จะขึ้น "✔ พบตารางที่เผยแพร่"',
    '**③** ใส่ **รหัสผ่าน** ที่ได้รับ (นักเรียนใช้รหัสนักเรียน ครูใช้รหัสครู) แล้วกด `เข้าสู่ระบบ` (ภาพขวา)',
  ]),
  twoImages('q2-login', 'ภาพซ้าย: ตัวเลือกเข้าสู่ระบบ', 'q2-file', 'ภาพขวา: หลังเลือกไฟล์และใส่รหัส', 205),
  gap(40),
  callout('tip', 'ผู้ดูแลวางไฟล์บนเว็บไว้แล้ว: ไม่ต้องเลือกไฟล์ ใส่รหัสได้เลย • ได้ไฟล์ทางไลน์บนมือถือ: บันทึกไฟล์ลงเครื่องก่อน (วิธีดูในหน้าเว็บ)'),

  // ----- 3 -----
  H1('3. กำหนดคาบเรียน'),
  sideBySide([
    P('เมื่อเข้ามาแล้ว เริ่มจากเมนู `กรอกข้อมูล` › แท็บ `ตั้งค่าคาบเรียน` (ต้องทำก่อนอย่างอื่น):'),
    ...steps([
      'ติ๊ก **วันที่เปิดสอน** (①)',
      'ใส่ **จำนวนคาบต่อวัน** (②) ตารางเวลาขึ้นให้ตามจำนวน',
      'เลือก **พักเที่ยงหลังคาบที่** เท่าไร (③)',
      'ใส่ **เวลาเริ่ม–จบ** ของทุกคาบ (④)',
      'กด `บันทึกการตั้งค่า` (⑤) ขึ้นข้อความสีเขียว "บันทึกการตั้งค่าแล้ว"',
    ]),
  ], 'settings', 300, 'หน้าตั้งค่าคาบเรียน (ภาพแสดงเวลาบางคาบ)', 5000),

  // ----- 4 -----
  H1('4. ใส่ข้อมูลครู กลุ่มเรียน (นักเรียน) วิชา และอาคาร'),
  P('ที่เมนู `กรอกข้อมูล` มีแท็บ ① `ครู` ② `กลุ่มเรียน` (ห้อง/กลุ่มนักเรียน) ③ `วิชาเรียน` ④ `ห้องเรียน` (อาคาร) ทุกแท็บใช้วิธีเดียวกัน เลือกอย่างใดอย่างหนึ่ง:'),
  ...bullets([
    '**พิมพ์ทีละรายการ** (⑤) แล้วกดปุ่มเพิ่ม — เหมาะกับข้อมูลไม่เยอะ',
    '**นำเข้าจากไฟล์** (⑥) กด `Template` เลือก Excel เพื่อโหลดไฟล์ตัวอย่างไปกรอก แล้วกด `Import จากไฟล์` — เหมาะกับข้อมูลเยอะ',
  ]),
  ...image('q4-teachers', 520, 'แท็บ "ครู": แถบแท็บ ① – ④, ช่องกรอก ⑤, ปุ่ม Template/Import ⑥'),
  ...image('q4-buildings', 520, 'แท็บ "ห้องเรียน": ใส่ชื่ออาคาร จำนวนชั้น จำนวนห้องต่อชั้น (ระบบสร้างเลขห้องให้เอง)'),
  callout('tip', 'ครู: เลือกหน้าที่ "ครูสอนหลัก" หรือ "ครูสอนร่วม" • กลุ่มเรียน: รหัส ชื่อ สาขา • วิชา: รหัส ชื่อ จำนวนคาบต่อสัปดาห์ • ถ้ากรอกผิด ให้กด `ลบ` แล้วเพิ่มใหม่'),

  // ----- 5 -----
  H1('5. เพิ่มกรณีพิเศษ (ถ้ามี)', true),
  sideBySide([
    P('คาบที่ต้องมีเวลาตายตัว เช่น กิจกรรม ชุมนุม ประชุมครู ระบบวางให้ก่อนวิชาอื่น ที่แท็บ `กรณีพิเศษ`:'),
    ...steps([
      'ตั้งชื่อ เช่น **ชุมนุม** (①) และใส่จำนวนคาบ',
      'พิมพ์เงื่อนไขเป็นภาษาไทย (②) เช่น **วันพุธ คาบ 3**',
      'ดูแถบเขียว "ระบบเข้าใจว่า: พุธ • คาบ 3" (③) ว่าตรงกับที่ต้องการ',
      'กด `เพิ่มกรณีพิเศษ` (④)',
    ]),
    P('ตัวอย่างเงื่อนไขอื่น: `ทุกวันคาบที่ 1` • `วันศุกร์ ช่วงบ่าย` • `จันทร์-ศุกร์ คาบสุดท้าย` • หลายเงื่อนไขคั่นด้วย `;`', { r: { size: 20 } }),
    P('ไม่เลือกกลุ่มเรียนหรือครู = ใช้กับทุกคน', { r: { size: 20, color: C.muted } }),
  ], 'q5-special', 250, 'แท็บ "กรณีพิเศษ"', 5400),

  // ----- 6 -----
  H1('6. กำหนดการเรียน (เพื่อกำหนดคาบเรียน)'),
  sideBySide([
    P('บอกระบบว่า **"วิชานี้ กลุ่มนี้ เรียนกับครูคนนี้ ในห้องนี้"** — 1 รายการต่อ 1 วิชา ต้องทำให้ครบทุกวิชาของทุกกลุ่ม ที่แท็บ `กำหนดการเรียน`:'),
    ...steps([
      'เลือก **วิชา** (พิมพ์ค้นหาได้)',
      'เลือก **ครูสอนหลัก** (และครูสอนร่วม ถ้ามี)',
      'เลือก **กลุ่มเรียน** (หลายกลุ่มได้ ถ้าเรียนพร้อมกัน)',
      'เลือก **อาคาร** และ **ห้อง**',
      'เลือก **เรียนรวมกัน** (หลายกลุ่มเวลา/ห้องเดียวกัน) หรือ **แยกเรียน**',
      'กด `บันทึก` แล้วทำรายการต่อไปจนครบ',
    ]),
  ], 'assign', 270, 'แท็บ "กำหนดการเรียน"', 5400),

  // ----- 7 -----
  H1('7. เลือกเวลาแล้วกดจัดตาราง', true),
  ...steps([
    'ไปที่เมนู **Dashboard**',
    'เลือก **เวลาประมวลผลสูงสุด** (①) — ยิ่งนาน ตารางยิ่งสวย (ข้อมูลน้อยเลือก 5–15 วินาทีพอ)',
    'กด `⚙ จัดตารางอัตโนมัติ` (②) รอจนขึ้นแถบเขียว **"จัดตารางครบทุกคาบ"** (③)',
    'เลือกดูตารางตาม **ครู / กลุ่มเรียน / อาคาร** (④) แล้วกด `Export PDF` หรือ `Export Excel` เพื่อเก็บเป็นไฟล์',
  ]),
  ...image('q7-run', 520, 'หน้า Dashboard หลังจัดตารางเสร็จ'),
  callout('warn', 'ถ้าขึ้นกล่องสีแดง "จัดไม่ได้ N คาบ" ให้อ่านสาเหตุ (เช่น ครูมีคาบว่างไม่พอ) แก้ข้อมูลแล้วกดจัดใหม่ • จัดใหม่ทุกครั้งตารางอาจต่างจากเดิม จึงไม่ควรจัดใหม่หลังประกาศตารางแล้ว'),

  // ----- 8 -----
  H1('8. เผยแพร่ตาราง'),
  P('เมื่อจัดตารางเสร็จ ไปที่เมนู `เผยแพร่ตาราง` เพื่อสร้างไฟล์ให้นักเรียนและครูดู (ดูได้อย่างเดียว แก้ไม่ได้):'),
  ...steps([
    'ตั้ง **ชื่อชุดตาราง** (①) เช่น ภาคเรียนที่ 1/2569',
    'กำหนด **รหัสนักเรียน** (②) และ **รหัสครู** (③) — แยกกันและต้องไม่เหมือนกัน กด `สร้างรหัสให้` เพื่อให้ระบบสุ่มรหัสที่คาดเดายาก',
    '**จดรหัสไว้** (ระบบไม่เก็บ ลืมแล้วกู้คืนไม่ได้) แล้วกด `🔐 สร้างไฟล์เผยแพร่` (④) จะได้ไฟล์ **published.enc.json** ดาวน์โหลดลงเครื่อง',
  ]),
  ...image('q8-publish', 520, 'หน้าเผยแพร่ตาราง'),

  // ----- 9 -----
  H1('9. ปล่อยไฟล์ให้ผู้อื่นดาวน์โหลดและใช้งาน'),
  P('หลังสร้างไฟล์ หน้าเดิมจะมี **ข้อความแจ้งผู้ดู** (ลิงก์ + รหัส) ให้กด `คัดลอกข้อความนักเรียน` (①) / `คัดลอกข้อความครู` (②) แล้วส่งให้ **แยกกลุ่ม** (อย่าส่งรหัสครูให้นักเรียน) ส่วนไฟล์ให้เลือกทางใดทางหนึ่ง:'),
  ...bullets([
    '**ทาง A วางบนเว็บ (แนะนำ):** GitHub › รีโพของคุณ › โฟลเดอร์ `public` › `published` › `Add file` › `Upload files` ลากไฟล์ published.enc.json มาวาง (ชื่อต้องตรง) › `Commit changes` รอ 1–2 นาที ผู้ดูแค่เปิดลิงก์แล้วใส่รหัส',
    '**ทาง B ส่งไฟล์โดยตรง:** ส่ง published.enc.json ทางไลน์/อีเมลเป็น "ไฟล์" (ไม่ใช่รูป) ผู้รับทำตาม **ข้อ 2** (เลือกไฟล์ → ใส่รหัส)',
  ]),
  ...image('q9-share', 520, 'ข้อความแจ้งผู้ดู พร้อมปุ่มคัดลอก'),
  callout('warn', 'ตารางจะเปลี่ยนเมื่อคุณเผยแพร่ไฟล์ใหม่เท่านั้น • รหัสเป็นรหัสร่วมของทั้งกลุ่ม ถ้ารหัสหลุดให้ตั้งรหัสใหม่และเผยแพร่ใหม่ • ควรกด `สำรองข้อมูล (JSON)` ที่เมนู กรอกข้อมูล เก็บไว้ เพราะข้อมูลอยู่ในเบราว์เซอร์ของเครื่องนี้เท่านั้น'),

  // ----- 10 -----
  H1('10. คู่มือเพิ่มเติม'),
  P('ดูคู่มือฉบับเต็มได้ในเว็บ ที่เมนู **"วิธีใช้"** (แถบซ้ายมือ) มีขั้นตอนละเอียด 12 หัวข้อ ตารางแก้ปัญหา คำศัพท์ และถามตอบ'),
);

const doc = new Document({
  creator: 'ระบบจัดตารางสอนอัตโนมัติ', title: 'คู่มือการใช้งานโดยสรุป — ระบบจัดตารางสอนอัตโนมัติ', description: 'คู่มือฉบับแก้ไขได้',
  styles: {
    default: { document: { run: { font: FONT, size: 22, color: C.ink } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 30, bold: true, color: C.accent },
        paragraph: { spacing: { before: 300, after: 120 }, keepNext: true, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.line, space: 3 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 25, bold: true, color: C.ink },
        paragraph: { spacing: { before: 200, after: 90 }, keepNext: true, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 460, hanging: 280 } } } }] },
    ...lists,
  ] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
    footers: { default: new Footer({ children: [new Paragraph({
      tabStops: [{ type: TabStopType.RIGHT, position: W }],
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 4 } },
      children: [new TextRun({ text: 'คู่มือการใช้งานโดยสรุป — ระบบจัดตารางสอนอัตโนมัติ v1.6', size: 17, color: C.muted }),
        new TextRun({ text: '\tหน้า ', size: 17, color: C.muted }), new TextRun({ children: [PageNumber.CURRENT], size: 17, color: C.muted }),
        new TextRun({ text: ' / ', size: 17, color: C.muted }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 17, color: C.muted })],
    })] }) },
    children: body,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(__dirname, 'timetable-quick-guide-editable.docx');
  fs.writeFileSync(out, buf);
  console.log('wrote', out, Math.round(buf.length / 1024) + ' KB');
});
