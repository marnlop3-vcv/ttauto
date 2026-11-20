// สไลด์ "ฉบับเข้าใจง่าย" สำหรับคนทั่วไป (15 หน้า) — รัน: NODE_PATH=/home/user/tools/node_modules node docs/presentation/simple/build-slides-simple.cjs
// ตัวเลขอ่านจาก ../results.json ; ภาพหน้าจอจริงอยู่ใน shots/ (scripts/make-shots-clean.cjs)
const path = require('path');
const TOOLS = process.env.TOOLS_DIR || '/home/user/tools/node_modules';
const tr = (m) => require(path.join(TOOLS, m));
const pptxgen = tr('pptxgenjs');
const fs = require('fs');
const React = tr('react');
const RDS = tr('react-dom/server');
const sharp = tr('sharp');
const fa = tr('react-icons/fa');
const { applyTheme } = require('/root/.claude/skills/synced/d63f663c-ccca-4192-8114-cee7ae67c851_a4eb7145-75ad-4c41-a6a7-b62f49159b10/pptx/scripts/apply_theme.js');

const R = JSON.parse(fs.readFileSync(path.join(__dirname, '../results.json'), 'utf8'));
const SHOT = (n) => path.join(__dirname, 'shots', n + '.png');
const OUTFILE = path.join(__dirname, 'timetable-simple.pptx');
const URL_APP = 'https://marnlop3-vcv.github.io/ttauto/';

// ---------- ตัวเลขจริง ----------
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const L = R.runs.filter((r) => r.size === 'large');
const big = {
  periods: L[0].periodsTotal, groups: L[0].groups, sec: Math.round(avg(L.map((r) => r.totalSec))), conflicts: Math.max(...L.map((r) => r.conflicts)),
  placed: Math.min(...L.map((r) => r.placed)), gB: avg(L.map((r) => r.before.groupGaps)), gA: avg(L.map((r) => r.after.groupGaps)),
};
big.cut = Math.round((1 - big.gA / big.gB) * 100);
console.log(JSON.stringify(big));

const THEME = {
  name: 'TimetableSimple', headFontFace: 'Tahoma', bodyFontFace: 'Tahoma',
  colors: { dk1: '1B2A41', lt1: 'FFFFFF', dk2: '0F6E8C', lt2: 'E8F4F8', accent1: '0F6E8C', accent2: 'F26B5B', accent3: '3DAE7C', accent4: 'F5B83D', accent5: '4FA3D9', accent6: '8794A6', hlink: '0F6E8C', folHlink: '6B7280' },
};
const HEX = THEME.colors;
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.theme = { headFontFace: 'Tahoma', bodyFontFace: 'Tahoma' };
pres.title = 'ระบบจัดตารางสอนอัตโนมัติ — ฉบับเข้าใจง่าย';
pres.author = 'ระบบจัดตารางสอนอัตโนมัติ';
const C = pres.SchemeColor;
const SH = pres.shapes;
const TEAL = HEX.accent1, CORAL = HEX.accent2, GREEN = HEX.accent3, AMBER = HEX.accent4, SKY = HEX.accent5, GRAY = HEX.accent6, SOFT = HEX.lt2, INK = HEX.dk1;

pres.defineSlideMaster({ title: 'COVER', background: { color: TEAL }, objects: [] });
pres.defineSlideMaster({
  title: 'CONTENT', background: { color: 'F6FAFC' },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.3, w: 12.1, h: 1.0, fontSize: 32, bold: true, color: C.text2, valign: 'middle', align: 'left', fontFace: 'Tahoma', margin: 0 }, text: '' } },
    { text: { text: 'ระบบจัดตารางสอนอัตโนมัติ', options: { x: 0.6, y: 7.05, w: 5, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: 12.1, y: 7.05, w: 0.6, h: 0.3, fontSize: 10, color: C.accent6, align: 'right' },
});

// ---------- ตัวช่วย ----------
async function icon(name, color, size = 256) {
  const svg = RDS.renderToStaticMarkup(React.createElement(fa[name], { color: '#' + color, size: String(size) }));
  return 'image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
}
const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.1, blur: 8, offset: 2, angle: 90 });
const T = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, valign: 'middle', fontFace: 'Tahoma', ...o });
function card(s, x, y, w, h, o = {}) {
  s.addShape(SH.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: o.r ?? 0.16, fill: { color: o.fill ?? C.background1 }, line: o.line ? { color: o.line, width: o.lw ?? 1.5 } : { color: o.fill ?? C.background1, width: 0 }, shadow: o.noShadow ? undefined : shadow(), objectName: o.name });
}
async function iconCircle(s, name, x, y, d, bg, fg = 'FFFFFF') {
  s.addShape(SH.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0 } });
  const p = d * 0.26;
  s.addImage({ data: await icon(name, fg), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: name });
}
function numCircle(s, n, x, y, d, bg) {
  s.addShape(SH.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0 } });
  T(s, String(n), { x, y, w: d, h: d, align: 'center', fontSize: Math.round(d * 30), bold: true, color: C.background1 });
}
const arrow = (s, x1, y1, x2, y2, color = GRAY, w = 2.5) => s.addShape(SH.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, line: { color, width: w, endArrowType: 'triangle' } });
const line = (s, x1, y1, x2, y2, color = GRAY, w = 2.5) => s.addShape(SH.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, line: { color, width: w } });
function blobs(s, dark = false) { // วงกลมจางๆ ที่มุม (ลวดลายประกอบ)
  const c = dark ? '1C86A6' : 'DCEEF6';
  s.addShape(SH.OVAL, { x: -1.2, y: 5.7, w: 3.2, h: 3.2, fill: { color: c, transparency: dark ? 40 : 30 }, line: { color: c, width: 0 } });
  s.addShape(SH.OVAL, { x: 11.5, y: -1.4, w: 3.4, h: 3.4, fill: { color: c, transparency: dark ? 40 : 30 }, line: { color: c, width: 0 } });
}
function miniGrid(s, x, y, cols, rows, cell, gap, cells) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = cells[r * cols + c];
    const o = typeof v === 'string' ? { fill: v } : v || { fill: 'E3EAF3' };
    s.addShape(SH.ROUNDED_RECTANGLE, { x: x + c * (cell + gap), y: y + r * (cell * 0.78 + gap), w: cell, h: cell * 0.78, rectRadius: 0.05, fill: { color: o.fill ?? 'E3EAF3' }, line: o.line ? { color: o.line, width: 2.25 } : { color: o.fill ?? 'E3EAF3', width: 0 } });
    if (o.text) T(s, o.text, { x: x + c * (cell + gap), y: y + r * (cell * 0.78 + gap), w: cell, h: cell * 0.78, align: 'center', fontSize: o.fs ?? 13, bold: true, color: o.color ?? INK });
  }
}
const tag = (s, text, x, y, w, col = TEAL) => { // ป้ายศัพท์เทคนิคเล็กๆ
  s.addShape(SH.ROUNDED_RECTANGLE, { x, y, w, h: 0.34, rectRadius: 0.17, fill: { color: 'FFFFFF' }, line: { color: col, width: 1.25 } });
  T(s, text, { x, y, w, h: 0.34, align: 'center', fontSize: 11, color: col, bold: true });
};

(async () => {
  // ================= 1) ปก =================
  {
    const s = pres.addSlide({ masterName: 'COVER' });
    blobs(s, true);
    T(s, [{ text: 'ตารางเรียนที่ลงตัว', options: { breakLine: true } }, { text: 'ในไม่กี่วินาที', options: { color: 'FFE08A' } }], { x: 0.7, y: 1.5, w: 6.6, h: 2.4, fontSize: 52, bold: true, color: C.background1, valign: 'top' });
    T(s, 'ระบบจัดตารางสอนอัตโนมัติ\nเว็บที่ช่วยจัดตารางให้โรงเรียน โดยครู ห้อง และนักเรียนไม่ชนกัน', { x: 0.7, y: 4.2, w: 6.3, h: 1.3, fontSize: 22, color: 'D6EEF6', valign: 'top' });
    T(s, [{ text: URL_APP.replace('https://', ''), options: { hyperlink: { url: URL_APP }, color: 'FFFFFF', bold: true } }], { x: 0.7, y: 6.1, w: 6.5, h: 0.5, fontSize: 18 });
    card(s, 7.6, 1.2, 5.1, 5.1, { name: 'coverShot' });
    s.addImage({ path: SHOT('dash-result'), x: 7.75, y: 1.35, w: 4.8, h: 4.8 * (1814 / 1992), altText: 'ตารางสอนที่ระบบจัดให้' });
    T(s, 'ภาพจากระบบจริง', { x: 7.6, y: 5.8, w: 5.1, h: 0.4, align: 'center', fontSize: 13, color: GRAY });
    s.addNotes('สวัสดีครับ/ค่ะ วันนี้จะเล่าว่าผมทำอะไร: เว็บที่ช่วยจัดตารางเรียนของโรงเรียนให้อัตโนมัติ ตารางที่เห็นด้านขวาเป็นภาพจากระบบจริง เนื้อหามี 3 ส่วนง่ายๆ: ทำไมต้องมี → ระบบคิดอย่างไร → ได้อะไรจากระบบ ไม่ต้องรู้เรื่องคอมพิวเตอร์มาก่อนก็เข้าใจได้');
  }

  // ================= 2) ปัญหา: ก้างปลา =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('ปัญหา: จัดตารางสอนด้วยมือยากกว่าที่คิด', { placeholder: 'title' });
    // หัวปลา
    s.addShape(SH.OVAL, { x: 0.6, y: 2.55, w: 3.6, h: 2.5, fill: { color: C.background1 }, line: { color: TEAL, width: 3 }, shadow: shadow() });
    T(s, [{ text: 'จัดตารางด้วยมือ', options: { bold: true, fontSize: 20, color: C.text2, breakLine: true } }, { text: 'ซับซ้อน ผิดพลาดง่าย\nกระทบครูและนักเรียน', options: { fontSize: 15, color: INK } }], { x: 0.85, y: 2.7, w: 3.1, h: 2.2, align: 'center', paraSpaceAfter: 6 });
    // กระดูกสันหลัง
    s.addShape(SH.LINE, { x: 4.2, y: 3.8, w: 8.4, h: 0, line: { color: TEAL, width: 5 } });
    const causes = [
      { ic: 'FaHourglassHalf', t: 'ใช้เวลานาน', d: 'ต้องไล่วางทีละคาบ หลายร้อยคาบ', x: 4.7, top: true, col: TEAL },
      { ic: 'FaExclamationTriangle', t: 'ชนกันง่าย', d: 'ครูคนเดียวอยู่สองห้อง หรือห้องเดียวมีสองกลุ่ม', x: 8.6, top: true, col: CORAL },
      { ic: 'FaRandom', t: 'แก้ทีหนึ่ง พังอีกที', d: 'ขยับจุดเดียว อีกจุดชนทันที', x: 4.7, top: false, col: AMBER },
      { ic: 'FaListUl', t: 'เงื่อนไขเยอะ', d: 'คาบกิจกรรม พักเที่ยง วิชาที่ต้องเรียนติดกัน', x: 8.6, top: false, col: GREEN },
    ];
    for (const c of causes) {
      const y = c.top ? 1.5 : 5.0, h = 1.55, w = 3.6;
      card(s, c.x, y, w, h, { name: 'cause' });
      await iconCircle(s, c.ic, c.x + 0.2, y + 0.2, 0.7, c.col, c.col === AMBER ? INK : 'FFFFFF');
      T(s, c.t, { x: c.x + 1.05, y: y + 0.18, w: w - 1.2, h: 0.7, fontSize: 18, bold: true, color: C.text2 });
      T(s, c.d, { x: c.x + 0.2, y: y + 0.95, w: w - 0.4, h: 0.55, fontSize: 14, color: '4B5563', valign: 'top' });
      // ก้างเชื่อมกับกระดูกสันหลัง
      if (c.top) line(s, c.x + w / 2, y + h, c.x + w / 2 + 0.55, 3.8, TEAL, 3);
      else line(s, c.x + w / 2, y, c.x + w / 2 + 0.55, 3.8, TEAL, 3);
    }
    s.addNotes('ปัญหาของการจัดตารางด้วยมือ มี 4 อย่าง: ใช้เวลานาน เพราะต้องวางทีละคาบ ชนกันง่าย เช่นครูคนเดียวถูกจัดให้อยู่สองห้องพร้อมกัน แก้จุดหนึ่งแล้วไปทำให้อีกจุดพัง และมีเงื่อนไขเยอะ เช่น คาบกิจกรรม พักเที่ยง วิชาที่ต้องเรียนติดกัน ผลคือครูและนักเรียนได้ตารางที่ไม่ลงตัว');
  }

  // ================= 3) ลองนึกภาพ =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('ลองนึกภาพ: เหมือนจัดของลงกระเป๋าที่เต็มทุกช่อง', { placeholder: 'title' });
    // กระเป๋า
    s.addShape(SH.ROUNDED_RECTANGLE, { x: 0.6, y: 1.65, w: 6.4, h: 4.9, rectRadius: 0.25, fill: { color: 'FFFFFF' }, line: { color: TEAL, width: 4 }, shadow: shadow() });
    s.addShape(SH.ROUNDED_RECTANGLE, { x: 2.8, y: 1.35, w: 2.0, h: 0.5, rectRadius: 0.15, fill: { color: TEAL }, line: { color: TEAL, width: 0 } });
    const pal = [SKY, GREEN, AMBER, CORAL, SKY, GREEN, TEAL, AMBER];
    const cells = [];
    for (let r = 0; r < 7; r++) for (let c = 0; c < 8; c++) cells.push((r * 5 + c * 3) % 7 === 0 ? null : pal[(r * 3 + c * 2) % pal.length]);
    miniGrid(s, 0.9, 2.05, 8, 7, 0.64, 0.1, cells.map((c) => c || 'E3EAF3'));
    T(s, 'ช่องในตาราง (วัน × คาบ)', { x: 0.6, y: 6.6, w: 6.4, h: 0.35, align: 'center', fontSize: 14, color: GRAY });
    // คำอธิบาย
    const rows = [
      ['ของแต่ละชิ้น', '= วิชาที่ต้องเรียน (บางวิชาใช้หลายคาบติดกัน)', SKY],
      ['ที่ว่างในกระเป๋า', '= ช่องเวลาในตาราง เช่น วันจันทร์ คาบ 3', GREEN],
      ['กติกา', '= ห้ามวางทับกัน ครู ห้อง และนักเรียนอยู่ได้ทีละที่', CORAL],
    ];
    rows.forEach(([a, b, col], i) => {
      const y = 1.65 + i * 1.05;
      s.addShape(SH.ROUNDED_RECTANGLE, { x: 7.5, y, w: 0.22, h: 0.85, rectRadius: 0.08, fill: { color: col }, line: { color: col, width: 0 } });
      T(s, [{ text: a + ' ', options: { bold: true, color: C.text2, fontSize: 19 } }, { text: b, options: { color: INK, fontSize: 16 } }], { x: 7.9, y, w: 4.8, h: 0.85 });
    });
    card(s, 7.5, 4.9, 5.2, 1.65, { fill: 'FFF4E0', noShadow: true, line: AMBER });
    T(s, [{ text: `${big.periods} ชิ้น`, options: { fontSize: 36, bold: true, color: CORAL } }, { text: ` ต้องวางให้ลงตัว`, options: { fontSize: 18, color: INK, breakLine: true } }, { text: `(ตัวอย่าง ${big.groups} ห้องเรียน) วิธีวางที่เป็นไปได้ มีมากเกิน 10 ยกกำลัง 1,000`, options: { fontSize: 14, color: '4B5563' } }], { x: 7.75, y: 4.95, w: 4.8, h: 1.55, paraSpaceAfter: 2 });
    s.addNotes(`ลองนึกภาพกระเป๋าเดินทางที่ต้องใส่ของให้พอดี ของแต่ละชิ้นคือวิชา ที่ว่างคือช่องเวลาในตาราง และกติกาคือห้ามวางทับกัน ตัวอย่างโรงเรียน ${big.groups} ห้องเรียน มี ${big.periods} คาบต้องวาง จำนวนวิธีวางที่เป็นไปได้มากกว่า 10 ยกกำลัง 1,000 (เป็นตัวเลขโดยประมาณเพื่อให้เห็นขนาด) คนลองทุกแบบไม่ไหวแน่นอน`);
  }

  // ================= 4) แนวทางแก้ไข 5 ขั้น =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('แนวทางแก้ไข: ให้คอมพิวเตอร์ช่วยคิด 5 ขั้นตอน', { placeholder: 'title' });
    const steps = [
      ['FaKeyboard', 'ใส่ข้อมูล', 'ครู ห้องเรียน วิชา อาคาร พิมพ์เอง หรือนำเข้า Excel', TEAL],
      ['FaBalanceScale', 'ตั้งกติกา', 'ห้ามชน เวลาที่ล็อกไว้\nวิชาที่ต้องเรียนติดกัน', AMBER],
      ['FaCogs', 'ให้คอมพิวเตอร์\nลองจัด', 'จัดร่างแรก แล้วค่อยๆ\nปรับให้ดีขึ้น', SKY],
      ['FaTools', 'ซ่อมจุดขัดแย้ง', 'วางไม่ลง? ระบบบอกสาเหตุ ให้แก้ข้อมูลแล้วจัดใหม่', CORAL],
      ['FaCheckCircle', 'ได้ตารางพร้อมใช้', 'ดูตามครู ห้อง อาคาร\nส่งออก PDF / Excel', GREEN],
    ];
    const w = 2.25, gap = 0.2;
    for (let i = 0; i < 5; i++) {
      const [ic, t, d, col] = steps[i], x = 0.6 + i * (w + gap), y = 1.7;
      card(s, x, y, w, 3.6, { name: 'step' + i });
      numCircle(s, i + 1, x + 0.15, y + 0.15, 0.5, col === AMBER ? 'D99A1F' : col);
      await iconCircle(s, ic, x + w / 2 - 0.45, y + 0.55, 0.9, col, col === AMBER ? INK : 'FFFFFF');
      T(s, t, { x: x + 0.1, y: y + 1.6, w: w - 0.2, h: 0.85, align: 'center', fontSize: 17, bold: true, color: C.text2 });
      T(s, d, { x: x + 0.12, y: y + 2.5, w: w - 0.24, h: 1.0, align: 'center', fontSize: 14, color: '4B5563', valign: 'top' });
      if (i < 4) arrow(s, x + w + 0.01, y + 1.8, x + w + gap - 0.01, y + 1.8, TEAL);
    }
    card(s, 0.6, 5.65, 12.1, 0.95, { fill: 'D9F0E5', noShadow: true, line: GREEN });
    T(s, [{ text: 'ทั้งหมดทำในหน้าเว็บ ', options: { bold: true, color: '1F7A50' } }, { text: 'เปิดลิงก์ก็ใช้ได้ ไม่ต้องติดตั้งโปรแกรม และไม่ต้องสมัครสมาชิก', options: { color: INK } }], { x: 0.9, y: 5.65, w: 11.5, h: 0.95, fontSize: 18 });
    s.addNotes('แนวทางแก้คือให้คอมพิวเตอร์ช่วยคิด 5 ขั้น: หนึ่ง ใส่ข้อมูล สอง ตั้งกติกา เช่นห้ามชน สาม ให้คอมพิวเตอร์ลองจัดตาราง สี่ ถ้ามีจุดที่วางไม่ลง ระบบบอกสาเหตุให้เรากลับไปแก้ข้อมูล ห้า ได้ตารางพร้อมใช้ ส่งออกเป็น PDF หรือ Excel ได้ ทั้งหมดทำในหน้าเว็บ ไม่ต้องติดตั้งอะไร');
  }

  // ================= 5) กติกาที่ระบบรักษา =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('กติกาที่ระบบรักษา: ห้ามชน ตามเงื่อนไข และให้สวย', { placeholder: 'title' });
    const cols = [
      { col: CORAL, head: 'ห้ามชน — ต้องผ่านเสมอ', items: [['FaChalkboardTeacher', 'ครู', 'อยู่ได้ทีละห้อง'], ['FaUsers', 'กลุ่มเรียน', 'เรียนได้ทีละวิชา'], ['FaDoorOpen', 'ห้องเรียน', 'ใช้ได้ทีละกลุ่ม']] },
      { col: AMBER, head: 'ต้องเป็นไปตามเงื่อนไข', items: [['FaLock', 'เวลาตายตัว', 'เช่น คาบกิจกรรม ประชุมครู'], ['FaLink', 'เรียนติดกัน', 'ช่วงละไม่เกิน 4 คาบ\n(5 คาบ = 3+2)'], ['FaUtensils', 'พักเที่ยง', 'ไม่คร่อมช่วงพัก']] },
      { col: GREEN, head: 'อยากให้สวย — ยิ่งดียิ่งดี', items: [['FaCompress', 'คาบว่างน้อย', 'ไม่ให้ว่างคั่นกลางวัน'], ['FaBatteryHalf', 'ครูไม่เหนื่อยเกิน', 'ไม่สอนติดกันนานเกิน'], ['FaCalendarAlt', 'กระจายวัน', 'วิชาเดียวกันอยู่คนละวัน']] },
    ];
    for (let i = 0; i < 3; i++) {
      const c = cols[i], x = 0.6 + i * 4.1, w = 3.9;
      card(s, x, 1.55, w, 5.2, { name: 'rule' + i });
      s.addShape(SH.ROUNDED_RECTANGLE, { x, y: 1.55, w, h: 0.85, rectRadius: 0.16, fill: { color: c.col }, line: { color: c.col, width: 0 } });
      T(s, c.head, { x: x + 0.2, y: 1.55, w: w - 0.4, h: 0.85, align: 'center', fontSize: 18, bold: true, color: c.col === AMBER ? INK : 'FFFFFF' });
      for (let j = 0; j < 3; j++) {
        const [ic, a, b] = c.items[j], y = 2.65 + j * 1.35;
        await iconCircle(s, ic, x + 0.25, y, 0.75, c.col, c.col === AMBER ? INK : 'FFFFFF');
        T(s, [{ text: a, options: { bold: true, fontSize: 17, color: C.text2, breakLine: true } }, { text: b, options: { fontSize: 14, color: '4B5563' } }], { x: x + 1.2, y: y - 0.05, w: w - 1.4, h: 0.9, paraSpaceAfter: 2 });
      }
    }
    s.addNotes('กติกามี 3 ระดับ ระดับแรกห้ามชนเด็ดขาด คือครู กลุ่มเรียน และห้อง ต่างอยู่ได้ทีละที่ ระดับสองคือเงื่อนไข เช่นคาบกิจกรรมที่ล็อกเวลาไว้ วิชาที่ต้องเรียนติดกันช่วงละไม่เกิน 4 คาบ ถ้าวิชามี 5 คาบ ระบบแบ่งเป็น 3 กับ 2 และไม่ข้ามพักเที่ยง ระดับสามคือความสวย เช่นให้คาบว่างคั่นกลางวันน้อยที่สุด ครูไม่ต้องสอนติดกันนานเกินไป');
  }

  // ================= 6) หลักการ 3 ขั้น =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('ระบบคิดอย่างไร: 3 ขั้นต่อกัน — เร็ว → ครบ → สวย', { placeholder: 'title' });
    const st = [
      { col: SKY, ic: 'FaBolt', n: 'เร็ว', t: 'จัดร่างแรกให้ครบ', a: 'เหมือนใส่ของชิ้นใหญ่ลงกระเป๋าก่อน แล้วเอาชิ้นเล็กใส่ตามช่องที่เหลือ', tech: 'Greedy' },
      { col: AMBER, ic: 'FaTools', n: 'ครบ', t: 'ซ่อมชิ้นที่ใส่ไม่ลง', a: 'ขยับของที่ขวางออก ใส่ชิ้นนี้ลง แล้วหาที่ใหม่ให้ของที่ขยับ', tech: 'Ejection Chain + Tabu' },
      { col: GREEN, ic: 'FaMagic', n: 'สวย', t: 'ขัดเกลาให้ดีที่สุด', a: 'ลองสลับ-ย้ายทีละนิดหลายล้านครั้ง เก็บแบบที่ดีที่สุดไว้', tech: 'Simulated Annealing' },
    ];
    for (let i = 0; i < 3; i++) {
      const c = st[i], x = 0.6 + i * 4.1, w = 3.9;
      card(s, x, 1.55, w, 4.6, { name: 'three' + i });
      numCircle(s, i + 1, x + 0.2, 1.75, 0.55, c.col === AMBER ? 'D99A1F' : c.col);
      T(s, c.n, { x: x + 2.4, y: 1.7, w: 1.3, h: 0.65, align: 'right', fontSize: 28, bold: true, color: c.col === AMBER ? 'B26A00' : c.col });
      await iconCircle(s, c.ic, x + w / 2 - 0.55, 2.5, 1.1, c.col, c.col === AMBER ? INK : 'FFFFFF');
      T(s, c.t, { x: x + 0.2, y: 3.8, w: w - 0.4, h: 0.6, align: 'center', fontSize: 19, bold: true, color: C.text2 });
      T(s, c.a, { x: x + 0.25, y: 4.45, w: w - 0.5, h: 1.1, align: 'center', fontSize: 15, color: '4B5563', valign: 'top' });
      tag(s, c.tech, x + w / 2 - 1.25, 5.65, 2.5, c.col === AMBER ? 'B26A00' : c.col);
      if (i < 2) arrow(s, x + w + 0.02, 3.4, x + w + 0.2 - 0.02, 3.4, TEAL, 3);
    }
    T(s, 'ป้ายเล็กๆ คือชื่อเรียกทางเทคนิค (เผื่อมีคนสนใจ)', { x: 0.6, y: 6.3, w: 12.1, h: 0.4, align: 'center', fontSize: 13, color: GRAY });
    s.addNotes('หัวใจของระบบคือ 3 ขั้นต่อกัน ขั้นแรกจัดร่างแรกให้เร็ว เหมือนใส่ของชิ้นใหญ่ลงกระเป๋าก่อน ขั้นสองซ่อมชิ้นที่ใส่ไม่ลง ด้วยการขยับของที่ขวางออกแล้วหาที่ใหม่ให้ ขั้นสามขัดเกลาให้สวยด้วยการลองสลับย้ายทีละนิดหลายล้านครั้ง ชื่อทางเทคนิคของแต่ละขั้นอยู่ในป้ายเล็กๆ ไม่ต้องจำก็ได้ จำแค่ เร็ว ครบ สวย');
  }

  // ================= 7) ซูมขั้น 1-2 =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('ซูมเข้า: ชิ้นใหญ่ลงก่อน และถ้าไม่มีที่ ก็ขยับของที่ขวาง', { placeholder: 'title' });
    // ซ้าย: เรียงชิ้นใหญ่ก่อน
    card(s, 0.6, 1.55, 5.6, 5.1, { name: 'z1' });
    numCircle(s, 1, 0.85, 1.75, 0.5, SKY);
    T(s, 'ชิ้นใหญ่ลงก่อน', { x: 1.5, y: 1.75, w: 4.4, h: 0.5, fontSize: 20, bold: true, color: C.text2 });
    T(s, 'ชิ้นที่ยาก = ใช้หลายคาบติดกัน และต้องรอหลายคนว่างพร้อมกัน จึงวางก่อน', { x: 0.85, y: 2.4, w: 5.1, h: 0.8, fontSize: 15, color: '4B5563', valign: 'top' });
    [['การบัญชี', 4, NAVYC()], ['คณิตศาสตร์', 3, SKY], ['ภาษาไทย', 2, SKY], ['พลศึกษา', 1, SKY]].forEach(([n, k, col], i) => {
      const y = 3.4 + i * 0.7;
      T(s, n, { x: 0.85, y, w: 1.7, h: 0.6, fontSize: 15, color: INK });
      for (let j = 0; j < k; j++) s.addShape(SH.ROUNDED_RECTANGLE, { x: 2.65 + j * 0.76, y: y + 0.02, w: 0.7, h: 0.56, rectRadius: 0.08, fill: { color: col }, line: { color: col, width: 0 } });
      T(s, `${k} คาบ`, { x: 2.65 + k * 0.76 + 0.08, y, w: 1.0, h: 0.6, fontSize: 14, bold: true, color: C.text2 });
    });
    T(s, 'แล้ววางลงช่องที่ไม่ชน และทำให้ตารางเสียน้อยที่สุด', { x: 0.85, y: 6.45, w: 5.1, h: 0.01, fontSize: 1, color: 'FFFFFF' });
    T(s, 'แล้ววางลงช่องที่ไม่ชน และทำให้ตารางเสียน้อยที่สุด', { x: 0.85, y: 6.2, w: 5.1, h: 0.4, fontSize: 14, bold: true, color: C.text2 });
    // ขวา: ไล่ชิ้นที่ขวาง
    card(s, 6.5, 1.55, 6.2, 5.1, { name: 'z2' });
    numCircle(s, 2, 6.75, 1.75, 0.5, AMBER);
    T(s, 'ไม่มีที่ว่าง? ขยับของที่ขวางออก', { x: 7.4, y: 1.75, w: 5.1, h: 0.5, fontSize: 20, bold: true, color: C.text2 });
    const F = SKY;
    const frames = [
      ['ช่องเต็ม', [F, F, F, F, F, F], 'ชิ้นใหม่'],
      ['ย้ายชิ้นที่ขวางออก', [F, F, { fill: 'FFFFFF', line: CORAL }, F, F, F], null],
      ['วางชิ้นใหม่ลงแทน', [F, F, { fill: AMBER, text: 'ใหม่' }, F, F, F], 'รอ'],
      ['ชิ้นที่ถูกย้าย หาที่ใหม่', [F, F, { fill: AMBER, text: 'ใหม่' }, F, { fill: GREEN, text: '✓' }, F], null],
    ];
    frames.forEach(([cap, cells, ex], i) => {
      const x = 6.75 + (i % 2) * 2.95, y = 2.5 + Math.floor(i / 2) * 1.55;
      miniGrid(s, x, y, 3, 2, 0.5, 0.08, cells.map((c) => (typeof c === 'string' ? { fill: c } : c)));
      T(s, cap, { x: x - 0.05, y: y + 0.95, w: 2.7, h: 0.4, fontSize: 13, bold: true, color: C.text2, valign: 'top' });
    });
    card(s, 6.75, 5.65, 5.7, 0.8, { fill: 'FFF4E0', noShadow: true, line: AMBER });
    T(s, [{ text: 'กันวนลูป: ', options: { bold: true, color: 'B26A00' } }, { text: 'ของที่เพิ่งขยับ จะไม่ถูกขยับซ้ำทันที (Tabu)', options: { color: INK } }], { x: 6.95, y: 5.65, w: 5.4, h: 0.8, fontSize: 15 });
    s.addNotes('ซูมเข้าสองขั้นแรก ขั้นแรกเรียงชิ้นที่ยากก่อน ยากคือใช้หลายคาบติดกันและต้องรอหลายคนว่างพร้อมกัน เช่นวิชาบัญชีสี่คาบ ลงก่อนพละหนึ่งคาบ แล้วค่อยวางลงช่องที่ไม่ชน ขั้นสองถ้าชิ้นไหนไม่มีที่ ระบบไม่ยอมแพ้ ดูว่าช่องไหนมีของขวางน้อยที่สุด ขยับของนั้นออกไปก่อน วางชิ้นใหม่ แล้วหาที่ใหม่ให้ชิ้นที่ถูกขยับ ถ้าไปขวางอีกก็ขยับต่อเป็นทอดๆ และจดไว้ว่าชิ้นไหนเพิ่งขยับ ไม่ขยับซ้ำทันที จะได้ไม่วนไปมา');
  }

  // ================= 8) ซูมขั้น 3 =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('ซูมเข้า: ขัดเกลาให้สวย ด้วยการลองขยับทีละนิด', { placeholder: 'title' });
    // กราฟอุณหภูมิ
    T(s, 'ช่วงแรกกล้าลอง ช่วงหลังเลือกเฉพาะที่ดีขึ้น', { x: 0.6, y: 1.5, w: 4.7, h: 0.5, fontSize: 16, bold: true, color: C.text2 });
    const labels = [], vals = [];
    for (let i = 0; i <= 10; i++) { labels.push(String(i * 10)); vals.push(+(2.0 * Math.pow(0.03 / 2.0, i / 10)).toFixed(2)); }
    s.addChart(pres.charts.LINE, [{ name: 'ความกล้าลอง', labels, values: vals }], {
      x: 0.5, y: 2.0, w: 4.9, h: 3.5, chartColors: [CORAL], lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 6,
      catAxisLabelColor: GRAY, valAxisLabelColor: GRAY, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11, catAxisLabelFontFace: 'Tahoma', valAxisLabelFontFace: 'Tahoma',
      valGridLine: { color: 'E1E7EF', size: 0.75 }, catGridLine: { style: 'none' }, showLegend: false, valAxisHidden: true, valAxisMaxVal: 2.2, valAxisMinVal: 0,
      showCatAxisTitle: true, catAxisTitle: 'เวลาที่ผ่านไป (%)', catAxisTitleFontSize: 11, catAxisTitleColor: GRAY, catAxisTitleFontFace: 'Tahoma',
    });
    T(s, [{ text: 'ร้อน ', options: { bold: true, color: CORAL } }, { text: 'ยอมลองแบบที่แย่ลงนิดหน่อย', options: { breakLine: true } }, { text: 'เย็น ', options: { bold: true, color: TEAL } }, { text: 'รับเฉพาะแบบที่ดีขึ้น' }], { x: 0.6, y: 5.55, w: 4.7, h: 0.9, fontSize: 15, color: INK, valign: 'top', paraSpaceAfter: 3 });
    tag(s, 'Simulated Annealing = การอบโลหะ', 0.6, 6.55, 3.4);
    // ขยับ 3 แบบ
    T(s, 'ลองขยับ 3 แบบ', { x: 5.8, y: 1.5, w: 3.4, h: 0.5, fontSize: 16, bold: true, color: C.text2 });
    const moves = [['FaArrowsAlt', 'ย้ายไปช่องอื่น', SKY], ['FaArrowsAltH', 'เลื่อนไปใกล้ๆ 1–3 คาบ', AMBER], ['FaExchangeAlt', 'สลับที่กับชิ้นอื่น', GREEN]];
    for (let i = 0; i < 3; i++) {
      const y = 2.05 + i * 1.45;
      card(s, 5.8, y, 3.5, 1.25, { name: 'mv' + i });
      await iconCircle(s, moves[i][0], 6.0, y + 0.22, 0.8, moves[i][2], moves[i][2] === AMBER ? INK : 'FFFFFF');
      T(s, moves[i][1], { x: 7.0, y, w: 2.2, h: 1.25, fontSize: 16, color: INK, bold: true });
    }
    // กติกาเหล็ก
    T(s, 'กติกาข้อนี้ไม่มีผ่อนผัน', { x: 9.7, y: 1.5, w: 3.0, h: 0.5, fontSize: 16, bold: true, color: C.text2 });
    card(s, 9.7, 2.05, 3.0, 4.35, { name: 'rules', fill: 'D9F0E5', noShadow: true, line: GREEN });
    T(s, [
      { text: '✔ ไม่ชนเลยตลอดทาง', options: { bold: true, breakLine: true } },
      { text: 'ขยับแล้วชน = ยกเลิกทันที', options: { fontSize: 14, color: '4B5563', breakLine: true } },
      { text: ' ', options: { fontSize: 8, breakLine: true } },
      { text: '✔ จำแบบที่ดีที่สุดไว้', options: { bold: true, breakLine: true } },
      { text: 'หยุดเมื่อไรก็ได้ผลดีที่สุดเท่าที่หาได้', options: { fontSize: 14, color: '4B5563', breakLine: true } },
      { text: ' ', options: { fontSize: 12, breakLine: true } },
      { text: '✔ หยุดเองเมื่อไม่ดีขึ้นอีก', options: { bold: true, breakLine: true } },
      { text: 'ไม่เสียเวลารอเปล่าๆ', options: { fontSize: 14, color: '4B5563' } },
    ], { x: 9.9, y: 2.2, w: 2.65, h: 4.0, fontSize: 17, color: '1F7A50', valign: 'top' });
    s.addNotes('ขั้นสุดท้ายขัดเกลาให้สวย ระบบลองขยับทีละนิดหลายล้านครั้ง มี 3 แบบ ย้ายไปช่องอื่น เลื่อนไปใกล้ๆ หรือสลับที่กับชิ้นอื่น ถ้าขยับแล้วดีขึ้นก็เก็บไว้ ถ้าแย่ลงนิดหน่อย ช่วงแรกยังยอมลอง เพราะบางทีต้องถอยหนึ่งก้าวถึงจะเจอทางที่ดีกว่า เหมือนการอบโลหะที่เริ่มจากร้อนแล้วค่อยๆ เย็นลง สำคัญคือทุกการขยับห้ามชนเด็ดขาด และระบบจำแบบที่ดีที่สุดไว้ตลอด');
  }

  // ================= 9) ผังงาน =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('ขั้นตอนการทำงานของระบบ (ผังงาน)', { placeholder: 'title' });
    const box = (x, y, w, h, text, col, o = {}) => {
      s.addShape(o.pill ? SH.ROUNDED_RECTANGLE : SH.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: o.pill ? h / 2 : 0.12, fill: { color: col }, line: { color: col, width: 0 }, shadow: shadow() });
      T(s, text, { x: x + 0.08, y, w: w - 0.16, h, align: 'center', fontSize: o.fs ?? 15, bold: true, color: o.dark ? INK : 'FFFFFF' });
    };
    const Y1 = 1.75, H1 = 0.95;
    box(0.6, Y1, 1.3, H1, 'เริ่ม', GREEN, { pill: true });
    box(2.35, Y1, 2.3, H1, 'กรอก / นำเข้าข้อมูล\nครู วิชา ห้อง', TEAL);
    box(5.1, Y1, 2.0, H1, 'ตั้งค่า\nวันและคาบเรียน', TEAL);
    box(7.55, Y1, 2.5, H1, 'กำหนดการเรียน\n+ กรณีพิเศษ', TEAL);
    box(10.5, Y1, 2.2, H1, 'กดปุ่ม\n"จัดตารางอัตโนมัติ"', SKY);
    [[1.9, 2.35], [4.65, 5.1], [7.1, 7.55], [10.05, 10.5]].forEach(([a, b]) => arrow(s, a + 0.02, Y1 + H1 / 2, b - 0.02, Y1 + H1 / 2, GRAY));
    arrow(s, 11.6, Y1 + H1 + 0.02, 11.6, 3.25, GRAY);
    // ตัดสินใจ
    s.addShape(SH.DIAMOND, { x: 10.2, y: 3.3, w: 2.8, h: 1.7, fill: { color: AMBER }, line: { color: AMBER, width: 0 }, shadow: shadow() });
    T(s, 'ครบทุกคาบ\nไหม?', { x: 10.4, y: 3.3, w: 2.4, h: 1.7, align: 'center', fontSize: 16, bold: true, color: INK });
    // ครบ
    arrow(s, 10.18, 4.15, 9.45, 4.15, GREEN, 3);
    T(s, 'ครบ', { x: 9.4, y: 3.75, w: 0.8, h: 0.35, align: 'center', fontSize: 14, bold: true, color: '1F7A50' });
    box(6.95, 3.75, 2.5, 0.8, 'ดูตาราง\nส่งออก PDF / Excel', GREEN);
    arrow(s, 6.93, 4.15, 6.4, 4.15, GREEN, 3);
    box(3.9, 3.75, 2.5, 0.8, 'เผยแพร่ให้นักเรียน/ครู\n(ถ้าต้องการ)', GREEN, { fs: 14 });
    arrow(s, 3.88, 4.15, 2.75, 4.15, GREEN, 3);
    box(1.45, 3.75, 1.3, 0.8, 'จบ', CORAL, { pill: true });
    // ไม่ครบ
    arrow(s, 11.6, 5.02, 11.6, 5.65, CORAL, 3);
    T(s, 'ไม่ครบ', { x: 11.7, y: 5.12, w: 1.0, h: 0.4, fontSize: 14, bold: true, color: CORAL });
    box(10.2, 5.7, 2.5, 0.95, 'ดูสาเหตุที่วางไม่ลง\nแล้วแก้ข้อมูล', CORAL, { fs: 14 });
    line(s, 12.7, 6.18, 13.05, 6.18, CORAL, 3);
    line(s, 13.05, 6.18, 13.05, 2.22, CORAL, 3);
    arrow(s, 13.05, 2.22, 12.72, 2.22, CORAL, 3);
    T(s, 'แก้ข้อมูลแล้วกดจัดใหม่ได้เลย', { x: 5.0, y: 5.7, w: 4.5, h: 0.95, fontSize: 15, color: '4B5563', align: 'right' });
    s.addNotes('ผังงานของระบบ เริ่มจากกรอกหรือนำเข้าข้อมูลครู วิชา ห้อง จากนั้นตั้งค่าวันและคาบเรียน ใส่กำหนดการเรียนกับกรณีพิเศษ แล้วกดปุ่มจัดตาราง ระบบจะตรวจว่าวางครบทุกคาบไหม ถ้าครบก็ดูตาราง ส่งออก หรือเผยแพร่ให้นักเรียนและครู ถ้าไม่ครบ ระบบบอกสาเหตุ เช่นครูมีคาบว่างไม่พอ ให้เราแก้ข้อมูลแล้วกดจัดใหม่');
  }

  // ================= 10) เทคโนโลยี (ภาษาง่าย) =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('ภาพรวมเทคโนโลยี: เรียบง่าย ใช้งานได้ทันที', { placeholder: 'title' });
    const cards = [
      ['FaGlobe', 'เว็บในเบราว์เซอร์', 'เปิดลิงก์ก็ใช้ได้ทั้งคอมพิวเตอร์และมือถือ ไม่ต้องติดตั้งโปรแกรม', TEAL],
      ['FaLaptop', 'ข้อมูลอยู่ในเครื่อง', 'ไม่มีเซิร์ฟเวอร์เก็บข้อมูลโรงเรียน ข้อมูลไม่ออกจากเครื่องที่ใช้', SKY],
      ['FaMicrochip', 'คำนวณเบื้องหลัง', 'ตัวจัดตารางทำงานแยกจากหน้าจอ หน้าเว็บไม่ค้าง กดหยุดได้', AMBER],
      ['FaLock', 'แชร์ด้วยรหัส', 'ไฟล์ตารางที่เผยแพร่ถูกเข้ารหัส นักเรียน/ครูดูได้อย่างเดียว', GREEN],
    ];
    for (let i = 0; i < 4; i++) {
      const [ic, t, d, col] = cards[i], x = 0.6 + i * 3.08, w = 2.9;
      card(s, x, 1.65, w, 4.0, { name: 'tech' + i });
      await iconCircle(s, ic, x + w / 2 - 0.65, 1.95, 1.3, col, col === AMBER ? INK : 'FFFFFF');
      T(s, t, { x: x + 0.15, y: 3.5, w: w - 0.3, h: 0.6, align: 'center', fontSize: 19, bold: true, color: C.text2 });
      T(s, d, { x: x + 0.2, y: 4.15, w: w - 0.4, h: 1.4, align: 'center', fontSize: 16, color: '4B5563', valign: 'top' });
    }
    card(s, 0.6, 5.95, 12.1, 0.8, { fill: SOFT, noShadow: true });
    T(s, 'สำหรับคนสนใจเทคนิค: สร้างด้วย React + TypeScript • ตัวจัดตารางรันใน Web Worker • เข้ารหัส AES-256 • ฟรีและโอเพนซอร์ส (MIT)', { x: 0.85, y: 5.95, w: 11.6, h: 0.8, fontSize: 14, color: '4B5563' });
    s.addNotes('เรื่องเทคโนโลยี พูดให้ง่ายที่สุด ระบบเป็นเว็บ เปิดลิงก์ใช้ได้เลยทั้งคอมพิวเตอร์และมือถือ ข้อมูลของโรงเรียนอยู่ในเครื่องที่ใช้ ไม่มีเซิร์ฟเวอร์เก็บ การคำนวณทำงานเบื้องหลัง หน้าจอไม่ค้าง และเวลาแชร์ตารางให้นักเรียนครู ไฟล์ถูกเข้ารหัสและดูได้อย่างเดียว');
  }

  // ================= 11) ผลลัพธ์จริง =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('ผลลัพธ์จริง: ตารางครบ ไม่ชน และเสร็จในไม่กี่วินาที', { placeholder: 'title' });
    card(s, 0.6, 1.55, 7.3, 5.0, { name: 'shotcard' });
    const iw = 6.9;
    s.addImage({ path: SHOT('dash-result-crop'), x: 0.8, y: 1.75, w: iw, h: iw * (1200 / 1992), altText: 'ตารางสอนที่ระบบจัดให้ พร้อมสถานะ' });
    T(s, 'ภาพจากระบบจริง (ตัวอย่างข้อมูล)', { x: 0.6, y: 6.05, w: 7.3, h: 0.35, align: 'center', fontSize: 13, color: GRAY });
    const stats = [
      [`100%`, 'วางครบทุกคาบ', GREEN], [`${big.conflicts}`, 'ครู/ห้อง/กลุ่ม ชนกัน', GREEN], [`~${big.sec} วินาที`, `จัดตาราง ${big.periods} คาบ (${big.groups} ห้องเรียน)`, TEAL],
    ];
    stats.forEach(([n, l, col], i) => {
      const y = 1.55 + i * 1.7;
      card(s, 8.25, y, 4.45, 1.5, { name: 'stat' + i });
      T(s, n, { x: 8.45, y: y + 0.1, w: 4.05, h: 0.85, fontSize: 38, bold: true, color: col });
      T(s, l, { x: 8.45, y: y + 0.95, w: 4.05, h: 0.5, fontSize: 15, color: '4B5563', valign: 'top' });
    });
    T(s, 'ตารางแรกที่ครบทุกคาบเสร็จใน < 0.1 วินาที', { x: 8.25, y: 6.6, w: 4.45, h: 0.35, fontSize: 13, color: GRAY });
    s.addNotes(`ผลการทดสอบจริงกับข้อมูลตัวอย่างขนาดใหญ่ ${big.groups} ห้องเรียน ${big.periods} คาบต่อสัปดาห์ วางครบ 100% ไม่มีครู กลุ่ม หรือห้องชนกันเลย (ตรวจด้วยโปรแกรมตรวจแยกต่างหาก) ใช้เวลาประมาณ ${big.sec} วินาที และตารางแรกที่ครบทุกคาบได้ภายในไม่ถึงหนึ่งในสิบวินาที ภาพด้านซ้ายคือหน้าจอจริง หมายเหตุ: ตัวเลขนี้มาจากข้อมูลตัวอย่าง ข้อมูลจริงของโรงเรียนอาจต่างออกไป`);
  }

  // ================= 12) ใช้งานจริง =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('ใช้งานจริงเป็นอย่างไร: กรอก กดจัด แล้วแจกให้ทุกคนดู', { placeholder: 'title' });
    const steps = [
      ['FaKeyboard', 'กรอก หรือนำเข้า Excel', TEAL],
      ['FaPlay', 'กดปุ่ม "จัดตารางอัตโนมัติ"', SKY],
      ['FaFilePdf', 'ดูตาราง ส่งออก PDF / Excel', AMBER],
      ['FaMobileAlt', 'เผยแพร่ให้นักเรียนและครู ดูบนมือถือด้วยรหัส', GREEN],
    ];
    for (let i = 0; i < 4; i++) {
      const y = 1.6 + i * 1.28;
      numCircle(s, i + 1, 0.6, y + 0.2, 0.55, steps[i][2] === AMBER ? 'D99A1F' : steps[i][2]);
      card(s, 1.35, y, 3.9, 1.1, { name: 'u' + i });
      await iconCircle(s, steps[i][0], 1.5, y + 0.2, 0.7, steps[i][2], steps[i][2] === AMBER ? INK : 'FFFFFF');
      T(s, steps[i][1], { x: 2.35, y, w: 2.8, h: 1.1, fontSize: 15, bold: true, color: C.text2 });
    }
    card(s, 5.55, 1.55, 4.9, 5.1, { name: 'deskcard' });
    const dw = 4.6;
    s.addImage({ path: SHOT('dash-result-crop'), x: 5.7, y: 2.4, w: dw, h: dw * (1200 / 1992), altText: 'หน้าจอคอมพิวเตอร์' });
    T(s, 'บนคอมพิวเตอร์ (ผู้ดูแลจัดตาราง)', { x: 5.55, y: 6.2, w: 4.9, h: 0.4, align: 'center', fontSize: 13, color: GRAY });
    card(s, 10.75, 1.55, 1.95, 5.1, { name: 'phonecard' });
    s.addImage({ path: SHOT('phone-viewer'), x: 10.85, y: 1.65, w: 1.75, h: 1.75 * 2, altText: 'หน้าจอมือถือของนักเรียน' });
    T(s, 'บนมือถือ (นักเรียน/ครู)', { x: 10.75, y: 5.8, w: 1.95, h: 0.7, align: 'center', fontSize: 12, color: GRAY, valign: 'top' });
    s.addNotes('การใช้งานจริงมี 4 ขั้น: กรอกหรือนำเข้าจาก Excel กดปุ่มจัดตารางอัตโนมัติ ดูตารางและส่งออกเป็น PDF หรือ Excel แล้วเผยแพร่ให้นักเรียนและครูดูบนมือถือด้วยรหัส นักเรียนใช้รหัสนักเรียนเห็นตารางห้องเรียน ครูใช้รหัสครูเห็นตารางสอน ดูได้อย่างเดียว แก้ไม่ได้');
  }

  // ================= 13) ประโยชน์ 5 ด้าน =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('ประโยชน์ที่โรงเรียนจะได้รับ', { placeholder: 'title' });
    const b = [
      ['FaStar', 'ตารางมีคุณภาพ', 'ครบทุกคาบ และมีคาบว่างคั่นกลางวันน้อยลง', TEAL],
      ['FaShieldAlt', 'ถูกต้อง ไม่ชน', 'ครู ห้อง และกลุ่มเรียน ไม่ซ้อนกัน', GREEN],
      ['FaBuilding', 'ใช้ทรัพยากรคุ้ม', 'จัดครูและห้องให้ลงตัว ไม่ซ้อนเวลากัน', SKY],
      ['FaClipboardCheck', 'จัดการง่าย', 'นำเข้า Excel ส่งออก PDF/Excel สำรองข้อมูลได้', AMBER],
      ['FaSyncAlt', 'ยืดหยุ่น', 'แก้ข้อมูลแล้วจัดใหม่ได้ทันที รองรับวิชาเสรีหลายห้อง', CORAL],
    ];
    const pos = [[0.6, 1.6], [4.7, 1.6], [8.8, 1.6], [2.65, 4.2], [6.75, 4.2]];
    for (let i = 0; i < 5; i++) {
      const [ic, t, d, col] = b[i], [x, y] = pos[i], w = 3.9, h = 2.3;
      card(s, x, y, w, h, { name: 'ben' + i });
      await iconCircle(s, ic, x + 0.25, y + 0.3, 0.85, col, col === AMBER ? INK : 'FFFFFF');
      T(s, t, { x: x + 1.3, y: y + 0.3, w: w - 1.5, h: 0.85, fontSize: 19, bold: true, color: C.text2 });
      T(s, d, { x: x + 0.3, y: y + 1.3, w: w - 0.6, h: 0.9, fontSize: 15, color: '4B5563', valign: 'top' });
    }
    s.addNotes('ประโยชน์ 5 ด้านที่โรงเรียนจะได้ หนึ่ง ตารางมีคุณภาพ ครบและมีคาบว่างน้อย สอง ถูกต้องไม่ชน สาม ใช้ครูและห้องอย่างลงตัว สี่ จัดการง่าย นำเข้าส่งออกสำรองข้อมูลได้ ห้า ยืดหยุ่น แก้ข้อมูลแล้วจัดใหม่ได้ทันที ตัวเลขประหยัดเวลาจริงต้องวัดกับข้อมูลโรงเรียนจริง ตอนนี้ยังไม่ได้วัด จึงไม่ขอพูดเป็นตัวเลข');
  }

  // ================= 14) 3 จุดเด่น =================
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    blobs(s);
    s.addText('3 จุดเด่นของระบบ', { placeholder: 'title' });
    const h = [
      ['FaCheckDouble', 'แก้ปัญหาตั้งต้นได้ครบ', `ชนกัน ${big.conflicts}`, 'วางครบทุกคาบ ไม่มีครู ห้อง หรือกลุ่มเรียนชนกัน', GREEN],
      ['FaBolt', 'ประมวลผลรวดเร็ว', `~${big.sec} วินาที`, `สำหรับ ${big.periods} คาบ (${big.groups} ห้องเรียน)`, AMBER],
      ['FaMagic', 'ได้ตารางที่สวยขึ้น', `ลด ${big.cut}%`, `คาบว่างคั่นของนักเรียนลดจาก ${Math.round(big.gB)} เหลือ ${big.gA.toFixed(1).replace('.0', '')} (ตัวอย่างใหญ่)`, TEAL],
    ];
    for (let i = 0; i < 3; i++) {
      const [ic, t, n, d, col] = h[i], x = 0.6 + i * 4.1, w = 3.9;
      card(s, x, 1.6, w, 4.9, { name: 'hl' + i });
      await iconCircle(s, ic, x + w / 2 - 0.6, 1.85, 1.2, col, col === AMBER ? INK : 'FFFFFF');
      T(s, t, { x: x + 0.2, y: 3.2, w: w - 0.4, h: 0.6, align: 'center', fontSize: 20, bold: true, color: C.text2 });
      T(s, n, { x: x + 0.2, y: 3.9, w: w - 0.4, h: 0.95, align: 'center', fontSize: 38, bold: true, color: col === AMBER ? 'B26A00' : col });
      T(s, d, { x: x + 0.3, y: 4.9, w: w - 0.6, h: 1.4, align: 'center', fontSize: 16, color: '4B5563', valign: 'top' });
    }
    s.addNotes(`จุดเด่น 3 ข้อ หนึ่ง แก้ปัญหาตั้งต้นได้ครบ คือไม่มีอะไรชนกัน สอง รวดเร็ว ${big.periods} คาบใช้เวลาประมาณ ${big.sec} วินาที สาม ตารางสวยขึ้น คาบว่างคั่นกลางวันของนักเรียนลดลงประมาณ ${big.cut} เปอร์เซ็นต์ เมื่อเทียบกับตารางร่างแรกในตัวอย่างขนาดใหญ่`);
  }

  // ================= 15) อนาคต + ขอบคุณ =================
  {
    const s = pres.addSlide({ masterName: 'COVER' });
    blobs(s, true);
    T(s, 'สิ่งที่อยากพัฒนาต่อ', { x: 0.7, y: 0.45, w: 7.5, h: 0.8, fontSize: 34, bold: true, color: C.background1 });
    T(s, 'แผนในอนาคต (ยังไม่ได้ทำ)', { x: 0.7, y: 1.2, w: 7.5, h: 0.4, fontSize: 16, color: 'FFE08A' });
    const f = [
      ['FaEdit', 'ปุ่มแก้ไขรายการ', 'ตอนนี้ต้องลบแล้วเพิ่มใหม่'],
      ['FaLayerGroup', 'กรอกกำหนดการหลายรายการพร้อมกัน', 'ลดเวลากรอกข้อมูลจำนวนมาก'],
      ['FaThumbtack', 'ล็อกคาบที่จัดเองแล้ว', 'ให้ระบบจัดเฉพาะส่วนที่เหลือ'],
      ['FaUserClock', 'ความต้องการรายครู', 'เช่น ไม่อยากสอนวันศุกร์ และปรับน้ำหนักความสวยได้'],
      ['FaCloud', 'ซิงก์ข้อมูลหลายเครื่อง', 'ให้ผู้ดูแลหลายคนช่วยกันทำ'],
    ];
    for (let i = 0; i < f.length; i++) {
      const y = 1.85 + i * 0.98;
      s.addShape(SH.ROUNDED_RECTANGLE, { x: 0.7, y, w: 7.4, h: 0.85, rectRadius: 0.14, fill: { color: 'FFFFFF', transparency: 88 }, line: { color: 'FFFFFF', width: 0.75 } });
      await iconCircle(s, f[i][0], 0.85, y + 0.1, 0.65, 'FFFFFF', TEAL);
      T(s, [{ text: f[i][1], options: { bold: true, fontSize: 17, color: 'FFFFFF', breakLine: true } }, { text: f[i][2], options: { fontSize: 13, color: 'D6EEF6' } }], { x: 1.7, y, w: 6.3, h: 0.85 });
    }
    card(s, 8.6, 1.6, 4.1, 5.0, { name: 'thanks', noShadow: false });
    T(s, 'ขอบคุณครับ/ค่ะ', { x: 8.8, y: 2.0, w: 3.7, h: 0.9, align: 'center', fontSize: 30, bold: true, color: C.text2 });
    T(s, 'มีคำถามไหม?', { x: 8.8, y: 2.9, w: 3.7, h: 0.6, align: 'center', fontSize: 20, color: INK });
    T(s, 'ลองใช้ได้ฟรีที่', { x: 8.8, y: 4.0, w: 3.7, h: 0.4, align: 'center', fontSize: 15, color: GRAY });
    T(s, [{ text: URL_APP.replace('https://', ''), options: { hyperlink: { url: URL_APP }, color: TEAL, bold: true } }], { x: 8.8, y: 4.4, w: 3.7, h: 0.7, align: 'center', fontSize: 16 });
    T(s, 'ไม่ต้องติดตั้ง • ไม่ต้องสมัคร', { x: 8.8, y: 5.2, w: 3.7, h: 0.4, align: 'center', fontSize: 14, color: GRAY });
    s.addNotes('สิ่งที่อยากพัฒนาต่อ ซึ่งยังไม่ได้ทำตอนนี้ เช่น ปุ่มแก้ไขรายการ ตอนนี้ต้องลบแล้วเพิ่มใหม่ กรอกกำหนดการหลายรายการพร้อมกัน ล็อกคาบที่จัดเองแล้วให้ระบบจัดที่เหลือ ความต้องการรายครู และซิงก์ข้อมูลหลายเครื่อง ขอบคุณครับ มีคำถามไหมครับ ลองใช้ได้ฟรีที่ลิงก์นี้');
  }

  await pres.writeFile({ fileName: OUTFILE });
  await applyTheme(OUTFILE, THEME);
  console.log('wrote', OUTFILE);

  function BLUE() { return SKY; }
  function NAVYC() { return TEAL; }
})().catch((e) => { console.error(e); process.exit(1); });
