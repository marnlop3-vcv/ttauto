// สร้างสไลด์นำเสนอ (.pptx แก้ไขได้) — รัน: node docs/presentation/build-slides.cjs
// ตัวเลขทั้งหมดอ่านจาก results.json (สร้างโดย collect-results.ts)
const path = require('path');
const TOOLS = process.env.TOOLS_DIR || '/home/user/tools/node_modules'; // ที่ติดตั้ง pptxgenjs react-icons sharp (npm install ในโฟลเดอร์นี้)
const tr = (m) => require(path.join(TOOLS, m));
const pptxgen = tr('pptxgenjs');
const fs = require('fs');
const React = tr('react');
const RDS = tr('react-dom/server');
const sharp = tr('sharp');
const fa = tr('react-icons/fa');
const { applyTheme } = require('/root/.claude/skills/synced/d63f663c-ccca-4192-8114-cee7ae67c851_a4eb7145-75ad-4c41-a6a7-b62f49159b10/pptx/scripts/apply_theme.js');

const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'results.json'), 'utf8'));
const IMGDIR = path.join(__dirname, '../standalone/img');
const OUTFILE = path.join(__dirname, 'timetable-presentation.pptx');

// ---------- ตัวเลขจริง (เฉลี่ย 2 รอบ) ----------
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const r1 = (x) => Math.round(x * 10) / 10;
const S = {};
for (const size of ['small', 'medium', 'large']) {
  const rs = R.runs.filter((r) => r.size === size);
  S[size] = {
    groups: rs[0].groups, periods: rs[0].periodsTotal, placed: Math.min(...rs.map((r) => r.placed)), conflicts: Math.max(...rs.map((r) => r.conflicts)),
    sec: r1(avg(rs.map((r) => r.totalSec))), first: Math.max(...rs.map((r) => r.firstCompleteSec ?? 0)),
    gB: r1(avg(rs.map((r) => r.before.groupGaps))), gA: r1(avg(rs.map((r) => r.after.groupGaps))),
    tB: r1(avg(rs.map((r) => r.before.teacherGaps))), tA: r1(avg(rs.map((r) => r.after.teacherGaps))),
  };
}
console.log(JSON.stringify(S));

// ---------- ธีม ----------
const THEME = {
  name: 'Timetable', headFontFace: 'Tahoma', bodyFontFace: 'Tahoma',
  colors: { dk1: '1F2937', lt1: 'FFFFFF', dk2: '2F4A6B', lt2: 'EAF0F7', accent1: '2F4A6B', accent2: 'E0533D', accent3: '2E9E6B', accent4: 'F2A93B', accent5: '5B8DB8', accent6: '8A94A6', hlink: '1155CC', folHlink: '6B7280' },
};
const HEX = THEME.colors;
const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 in
pres.theme = { headFontFace: 'Tahoma', bodyFontFace: 'Tahoma' };
pres.title = 'ระบบจัดตารางสอนอัตโนมัติ — การนำเสนอ';
pres.author = 'ระบบจัดตารางสอนอัตโนมัติ';
const C = pres.SchemeColor;
const SH = pres.shapes;

pres.defineSlideMaster({
  title: 'TITLE_DARK', background: { color: HEX.dk2 }, objects: [],
});
pres.defineSlideMaster({
  title: 'CONTENT', background: { color: HEX.lt1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.35, w: 12.1, h: 1.0, fontSize: 30, bold: true, color: C.text2, valign: 'middle', align: 'left', fontFace: 'Tahoma', margin: 0 }, text: '' } },
    { text: { text: 'ระบบจัดตารางสอนอัตโนมัติ', options: { x: 0.6, y: 7.0, w: 5, h: 0.3, fontSize: 10, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: 12.1, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.accent6, align: 'right' },
});
pres.defineSlideMaster({
  title: 'CONTENT_DARK', background: { color: HEX.dk2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.35, w: 12.1, h: 1.0, fontSize: 30, bold: true, color: C.background1, valign: 'middle', align: 'left', fontFace: 'Tahoma', margin: 0 }, text: '' } },
  ],
});

// ---------- ตัวช่วย ----------
async function icon(name, color, size = 256) {
  const svg = RDS.renderToStaticMarkup(React.createElement(fa[name], { color: '#' + color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}
const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.12, blur: 6, offset: 2, angle: 90 });
const T = (slide, text, o) => slide.addText(text, { isTextBox: true, margin: 0, valign: 'middle', ...o });
function card(slide, x, y, w, h, o = {}) {
  slide.addShape(SH.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: o.fill ?? C.background1 }, line: o.line ? { color: o.line, width: 1 } : { color: C.background1, width: 0 }, shadow: o.noShadow ? undefined : shadow(), objectName: o.name });
}
async function iconCircle(slide, name, x, y, d, bg, fg = 'FFFFFF') {
  slide.addShape(SH.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0 } });
  const p = d * 0.26;
  slide.addImage({ data: await icon(name, fg), x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: name });
}
function numCircle(slide, n, x, y, d, bg) {
  slide.addShape(SH.OVAL, { x, y, w: d, h: d, fill: { color: bg }, line: { color: bg, width: 0 } });
  T(slide, String(n), { x, y, w: d, h: d, align: 'center', fontSize: Math.round(d * 30), bold: true, color: C.background1 });
}
/** วาดตารางเล็ก (cells: แถวต่อแถว = สีหรือ {fill,text,line}) */
function miniGrid(slide, x, y, cols, rows, cell, gap, cells) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const v = cells[r * cols + c];
    const o = typeof v === 'string' ? { fill: v } : v || { fill: 'E3EAF3' };
    slide.addShape(SH.ROUNDED_RECTANGLE, { x: x + c * (cell + gap), y: y + r * (cell * 0.78 + gap), w: cell, h: cell * 0.78, rectRadius: 0.05, fill: { color: o.fill ?? 'E3EAF3' }, line: o.line ? { color: o.line, width: 2.25 } : { color: o.fill ?? 'E3EAF3', width: 0 } });
    if (o.text) T(slide, o.text, { x: x + c * (cell + gap), y: y + r * (cell * 0.78 + gap), w: cell, h: cell * 0.78, align: 'center', fontSize: o.fs ?? 13, bold: true, color: o.color ?? C.text1 });
  }
}
const arrow = (slide, x1, y1, x2, y2, color = HEX.accent6) => slide.addShape(SH.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipH: x2 < x1, flipV: y2 < y1, line: { color, width: 2.5, endArrowType: 'triangle' } });
const BLUE = HEX.accent5, NAVY = HEX.accent1, RED = HEX.accent2, GREEN = HEX.accent3, AMBER = HEX.accent4, GRAY = HEX.accent6;
const SOFT = HEX.lt2;

(async () => {
  // ============ 1) ปก ============
  {
    const s = pres.addSlide({ masterName: 'TITLE_DARK' });
    // ลวดลายตารางสอน (motif: กระเบื้องมน)
    const cols = [BLUE, GREEN, AMBER, 'FFFFFF', RED];
    const pat = [
      [1, 0, 0, 1, 0], [0, 1, 1, 0, 1], [1, 0, 1, 1, 0], [0, 1, 0, 1, 1], [1, 1, 0, 0, 1], [0, 0, 1, 1, 0],
    ];
    const pal = [BLUE, GREEN, AMBER, 'FFFFFF', BLUE, GREEN, RED, AMBER];
    const ox = 8.2, oy = 1.1, cw = 0.86, g = 0.1;
    for (let r = 0; r < 6; r++) for (let c = 0; c < 5; c++) {
      if (!pat[r][c]) { s.addShape(SH.ROUNDED_RECTANGLE, { x: ox + c * (cw + g), y: oy + r * (0.62 + g), w: cw, h: 0.62, rectRadius: 0.08, fill: { color: '3B5A80' }, line: { color: '3B5A80', width: 0 } }); continue; }
      const col = pal[(r * 3 + c * 5) % pal.length];
      const span = (r + c) % 3 === 0 && c < 4 && pat[r][c + 1] === 0 ? 2 : 1; // บางช่องกว้าง = วิชาที่สอนติดกัน
      s.addShape(SH.ROUNDED_RECTANGLE, { x: ox + c * (cw + g), y: oy + r * (0.62 + g), w: cw * span + g * (span - 1), h: 0.62, rectRadius: 0.08, fill: { color: col }, line: { color: col, width: 0 } });
    }
    T(s, 'ระบบจัดตารางสอนอัตโนมัติ', { x: 0.7, y: 2.0, w: 7.1, h: 1.7, fontSize: 48, bold: true, color: C.background1, valign: 'top' });
    T(s, 'ข้อมูลเยอะ ก็จัดตารางให้ครบ ถูกต้อง ในไม่กี่วินาที', { x: 0.7, y: 3.9, w: 7.0, h: 0.9, fontSize: 22, color: 'CADCFC', valign: 'top' });
    T(s, [{ text: 'Web App • ไม่ต้องติดตั้ง • ใช้ฟรี', options: { breakLine: true } }, { text: 'marnlop3-vcv.github.io/ttauto', options: { hyperlink: { url: 'https://marnlop3-vcv.github.io/ttauto/' }, color: 'FFFFFF' } }], { x: 0.7, y: 5.4, w: 7.0, h: 0.9, fontSize: 16, color: 'CADCFC', valign: 'top', paraSpaceAfter: 6 });
    s.addNotes('เปิดตัวโปรเจกต์: เว็บแอปจัดตารางสอนอัตโนมัติ ผู้ใช้ใส่ข้อมูลครู กลุ่มเรียน วิชา ห้อง แล้วระบบจัดตารางให้เองโดยไม่ชน ใช้ได้ฟรีบนเบราว์เซอร์ ข้อมูลไม่ส่งไปไหน เนื้อหาวันนี้ 3 ส่วน: ปัญหา → แนวทางแก้ (อัลกอริทึม) → ผลลัพธ์');
  }

  // ============ 2) ปัญหา ============
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    s.addText('จัดตารางมือ: ข้อมูลเยอะ ข้อบังคับซ้อน แก้ทีหนึ่งพังอีกที', { placeholder: 'title' });
    // สถิติ 3 ใบ
    const stats = [
      { big: '720', unit: 'คาบ/สัปดาห์ ที่ต้องวาง', sub: '30 กลุ่มเรียน × 10 วิชา', col: NAVY },
      { big: '3', unit: 'อย่างที่ห้ามชนพร้อมกัน', sub: 'ครู • กลุ่มเรียน • ห้อง', col: AMBER },
      { big: '10', sup: '1,000+', unit: 'วิธีวางที่เป็นไปได้', sub: 'ขอบบนโดยประมาณ (≈ 40 ช่อง ^ 720 คาบ)', col: RED },
    ];
    stats.forEach((st, i) => {
      const y = 1.65 + i * 1.7;
      card(s, 0.6, y, 5.9, 1.5, { name: 'stat' + i });
      const bigRuns = st.sup ? [{ text: st.big, options: {} }, { text: st.sup, options: { superscript: true, fontSize: 24 } }] : [{ text: st.big, options: {} }];
      T(s, bigRuns, { x: 0.85, y: y + 0.1, w: 2.5, h: 1.3, fontSize: 54, bold: true, color: st.col, align: 'left' });
      T(s, [{ text: st.unit, options: { bold: true, fontSize: 18, breakLine: true } }, { text: st.sub, options: { fontSize: 14, color: GRAY } }], { x: 3.4, y: y + 0.1, w: 2.95, h: 1.3, color: C.text1, valign: 'middle', paraSpaceAfter: 4 });
    });
    // ภาพ "แก้จุดหนึ่ง ไปชนอีกจุด"
    T(s, 'แก้จุดหนึ่ง → ไปชนอีกจุด', { x: 6.9, y: 1.65, w: 5.8, h: 0.4, fontSize: 18, bold: true, color: C.text2 });
    const base = [BLUE, null, BLUE, null, null, BLUE, GREEN, null, BLUE, null, null, GREEN];
    const g1 = base.map((c) => c); g1[5] = { fill: RED, text: '✕', color: 'FFFFFF', fs: 16 }; g1[1] = AMBER;
    const g2 = base.map((c) => c); g2[5] = null; g2[1] = AMBER; g2[7] = AMBER;
    const g3 = base.map((c) => c); g3[5] = null; g3[1] = AMBER; g3[7] = { fill: RED, text: '✕', color: 'FFFFFF', fs: 16 };
    [[g1, 6.9], [g2, 8.95], [g3, 11.0]].forEach(([g, x], i) => {
      miniGrid(s, x, 2.2, 4, 3, 0.4, 0.05, g.map((v) => v || 'E3EAF3'));
      T(s, ['ชนกัน', 'ย้ายออก', 'ไปชนที่ใหม่'][i], { x: x - 0.1, y: 3.55, w: 1.85, h: 0.35, align: 'center', fontSize: 14, color: i === 1 ? C.text1 : RED, bold: true });
    });
    arrow(s, 8.6, 2.85, 8.92, 2.85); arrow(s, 10.65, 2.85, 10.97, 2.85);
    // ข้อบังคับ
    T(s, 'ข้อบังคับที่ต้องรักษาพร้อมกัน', { x: 6.9, y: 4.15, w: 5.8, h: 0.4, fontSize: 18, bold: true, color: C.text2 });
    const chips = [
      ['FaUsers', 'ครู • กลุ่มเรียน • ห้อง ห้ามชนกัน'],
      ['FaLock', 'กรณีพิเศษ (กิจกรรม/ประชุม) ล็อกเวลาตายตัว'],
      ['FaLink', 'วิชา ≤ 4 คาบ ต้องติดกัน ไม่ข้ามพักเที่ยง'],
      ['FaCodeBranch', 'ครูชื่อซ้ำ และกลุ่มที่เรียนรวมกัน ต้องจัดให้ถูก'],
    ];
    for (let i = 0; i < chips.length; i++) {
      const y = 4.65 + i * 0.58;
      await iconCircle(s, chips[i][0], 6.9, y, 0.46, i === 0 ? RED : NAVY);
      T(s, chips[i][1], { x: 7.55, y, w: 5.2, h: 0.46, fontSize: 15, color: C.text1 });
    }
    s.addNotes('ปัญหา: โรงเรียนหนึ่งแห่งมีกลุ่มเรียนหลายสิบกลุ่ม วิชาหลายวิชา ครูและห้องจำกัด การจัดด้วยมือต้องวางทีละคาบแล้วเช็กว่า ครู กลุ่ม ห้อง ไม่ชนกัน ตัวอย่าง 30 กลุ่ม 10 วิชา คือ 720 คาบต่อสัปดาห์ จำนวนวิธีวางที่เป็นไปได้ใหญ่กว่า 10 ยกกำลัง 1,000 (ขอบบนโดยประมาณ ไม่ใช่ตัวเลขที่ต้องไล่ตรวจจริง) ที่ยากคือ แก้จุดหนึ่งมักไปชนอีกจุด และยังมีกรณีพิเศษ คาบติดกัน ครูชื่อซ้ำ และการเรียนรวม ถ้าอยากเทียบกับเวลาที่โรงเรียนใช้จัดมือจริง ให้ใส่ตัวเลขของโรงเรียนเองตรงนี้');
  }

  // ============ 3) แนวทาง: ไปป์ไลน์ ============
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    s.addText('แนวทาง: แปลงเป็นปัญหาข้อบังคับ แล้วแก้ 3 ขั้นต่อเนื่อง', { placeholder: 'title' });
    const nodes = [
      { ic: 'FaDatabase', n: 'เตรียมข้อมูล', en: 'Pre-processing', d: 'รวม/แยกเรียน • ล็อกกรณีพิเศษ', col: GRAY },
      { ic: 'FaBolt', n: 'Greedy', en: 'สร้างตารางแรก', d: 'ยากก่อน วางที่เสียน้อยสุด', col: BLUE },
      { ic: 'FaTools', n: 'Ejection Chain + Tabu', en: 'ซ่อมที่วางไม่ลง', d: 'ไล่ชิ้นที่ขวางเป็นทอดๆ', col: AMBER },
      { ic: 'FaFire', n: 'Simulated Annealing', en: 'ปรับให้สวย', d: 'ย้าย/สลับ ไม่ละเมิดข้อบังคับ', col: GREEN },
      { ic: 'FaCheckCircle', n: 'ตารางสุดท้าย', en: 'ครบ ไม่ชน', d: 'ส่งออก PDF/Excel • เผยแพร่', col: NAVY },
    ];
    const w = 2.2, gap = 0.275, y = 1.75, h = 2.9;
    for (let i = 0; i < nodes.length; i++) {
      const x = 0.6 + i * (w + gap), nd = nodes[i];
      card(s, x, y, w, h, { name: 'node' + i });
      await iconCircle(s, nd.ic, x + w / 2 - 0.38, y + 0.2, 0.76, nd.col);
      T(s, nd.n, { x: x + 0.1, y: y + 1.08, w: w - 0.2, h: 0.75, align: 'center', fontSize: 16, bold: true, color: C.text2 });
      T(s, nd.en, { x: x + 0.1, y: y + 1.85, w: w - 0.2, h: 0.35, align: 'center', fontSize: 14, bold: true, color: nd.col === AMBER ? 'B26A00' : nd.col === GRAY ? C.text1 : nd.col });
      T(s, nd.d, { x: x + 0.12, y: y + 2.2, w: w - 0.24, h: 0.6, align: 'center', fontSize: 13, color: GRAY, valign: 'top' });
      if (i < 4) arrow(s, x + w + 0.02, y + 1.45, x + w + gap - 0.02, y + 1.45, NAVY);
    }
    // แถบ Hard / Soft
    const xs = (i) => 0.6 + i * (w + gap);
    s.addShape(SH.ROUNDED_RECTANGLE, { x: xs(0), y: 5.0, w: xs(4) + w - xs(0), h: 0.7, rectRadius: 0.1, fill: { color: 'FBE3DE' }, line: { color: RED, width: 1.5 } });
    T(s, [{ text: 'ข้อบังคับ (Hard) ', options: { bold: true, color: RED } }, { text: 'ครู / กลุ่มเรียน / ห้อง ห้ามชน — ต้องผ่านทุกขั้นตลอดเวลา', options: { color: C.text1 } }], { x: xs(0) + 0.25, y: 5.0, w: 11.5, h: 0.7, fontSize: 17 });
    s.addShape(SH.ROUNDED_RECTANGLE, { x: xs(1), y: 5.9, w: xs(3) + w - xs(1), h: 0.7, rectRadius: 0.1, fill: { color: 'D9F0E5' }, line: { color: GREEN, width: 1.5 } });
    T(s, [{ text: 'ความสวย (Soft) ', options: { bold: true, color: '1F7A50' } }, { text: 'คาบว่างคั่น • ครูสอนติดนานเกิน • ภาระไม่สมดุล → ให้คะแนน ยิ่งต่ำยิ่งดี', options: { color: C.text1 } }], { x: xs(1) + 0.25, y: 5.9, w: 7.6, h: 0.7, fontSize: 15 });
    s.addNotes('แนวคิดหลัก: แยกข้อบังคับเป็น 2 ชนิด Hard คือห้ามชนเด็ดขาด ต้องผ่านเสมอ ส่วน Soft คือความสวย เช่น คาบว่างคั่นกลางวัน ให้เป็นคะแนน ยิ่งต่ำยิ่งดี จากนั้นแก้เป็น 3 ขั้นต่อกัน: Greedy สร้างตารางแรกให้เร็ว, Ejection Chain กับ Tabu ซ่อมชิ้นที่วางไม่ลง, Simulated Annealing ปรับให้สวย ก่อนหน้านั้นมีขั้นเตรียมข้อมูล เช่น ครูชื่อซ้ำคนละหน้าที่ถือเป็นคนเดียว การเรียนรวมถูกรวมเป็นหน่วยเดียว กรณีพิเศษถูกล็อกเวลาไว้ก่อน');
  }

  // ============ 4) Greedy ============
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    s.addText('Greedy: เรียงชิ้นยากก่อน แล้ววางที่ที่เสียน้อยที่สุด', { placeholder: 'title' });
    card(s, 0.6, 1.6, 5.6, 4.6, { name: 'greedyL' });
    numCircle(s, 1, 0.85, 1.8, 0.5, BLUE);
    T(s, 'เรียงลำดับ — ยากก่อน', { x: 1.5, y: 1.8, w: 4.5, h: 0.5, fontSize: 19, bold: true, color: C.text2 });
    T(s, 'คะแนนความยาก = จำนวนคาบ × จำนวนที่ต้องว่างพร้อมกัน (ครู+กลุ่ม+ห้อง)', { x: 0.85, y: 2.4, w: 5.1, h: 0.6, fontSize: 13, color: GRAY, valign: 'top' });
    const items = [['การบัญชี 4 คาบ', 16], ['คณิตศาสตร์ 3 คาบ', 9], ['ภาษาไทย 2 คาบ', 6], ['พลศึกษา 1 คาบ', 3]];
    items.forEach(([n, v], i) => {
      const y = 3.15 + i * 0.7;
      T(s, n, { x: 0.85, y, w: 2.1, h: 0.5, fontSize: 14, color: C.text1 });
      s.addShape(SH.ROUNDED_RECTANGLE, { x: 3.0, y: y + 0.06, w: 0.18 * v, h: 0.38, rectRadius: 0.06, fill: { color: i === 0 ? NAVY : BLUE }, line: { color: i === 0 ? NAVY : BLUE, width: 0 } });
      T(s, String(v), { x: 3.0 + 0.18 * v + 0.1, y, w: 0.5, h: 0.5, fontSize: 14, bold: true, color: C.text2 });
    });
    card(s, 6.6, 1.6, 6.1, 4.6, { name: 'greedyR' });
    numCircle(s, 2, 6.85, 1.8, 0.5, GREEN);
    T(s, 'วาง — ช่องที่คะแนนเพิ่มน้อยสุด', { x: 7.5, y: 1.8, w: 5.0, h: 0.5, fontSize: 19, bold: true, color: C.text2 });
    const days = ['จ', 'อ', 'พ', 'พฤ', 'ศ'];
    const grid = [
      ['+8', '+2', '✕', '+5', '+3'],
      ['+2', '✓ +0', '✕', '+2', '+4'],
      ['✕', '+4', '+3', '✕', '+6'],
    ];
    const gx = 7.15, gy = 3.0, cw = 1.0, ch = 0.7;
    days.forEach((d, i) => T(s, d, { x: gx + i * (cw + 0.08), y: gy - 0.42, w: cw, h: 0.35, align: 'center', fontSize: 14, bold: true, color: GRAY }));
    grid.forEach((row, r) => {
      T(s, 'คาบ ' + (r + 1), { x: 6.65, y: gy + r * (ch + 0.08), w: 0.5, h: ch, fontSize: 10, color: GRAY, align: 'right' });
      row.forEach((v, c) => {
        const bad = v === '✕', best = v.startsWith('✓');
        s.addShape(SH.ROUNDED_RECTANGLE, { x: gx + c * (cw + 0.08) + 0.0, y: gy + r * (ch + 0.08), w: cw, h: ch, rectRadius: 0.08, fill: { color: bad ? 'F6D5CF' : best ? 'CDEBDD' : SOFT }, line: best ? { color: GREEN, width: 2.5 } : { color: bad ? 'F6D5CF' : SOFT, width: 0 } });
        T(s, v, { x: gx + c * (cw + 0.08), y: gy + r * (ch + 0.08), w: cw, h: ch, align: 'center', fontSize: best ? 15 : 16, bold: true, color: bad ? RED : best ? '1F7A50' : C.text1 });
      });
    });
    T(s, [{ text: '✕ ', options: { bold: true, color: RED } }, { text: 'ชน = วางไม่ได้     ', options: { color: C.text1 } }, { text: '+n ', options: { bold: true } }, { text: 'คะแนนความไม่สวยที่เพิ่มขึ้น', options: { color: C.text1 } }], { x: 6.85, y: 5.35, w: 5.7, h: 0.5, fontSize: 13 });
    // ผลจริง
    s.addShape(SH.ROUNDED_RECTANGLE, { x: 0.6, y: 6.35, w: 12.1, h: 0.5, rectRadius: 0.1, fill: { color: 'DCE8F5' }, line: { color: 'DCE8F5', width: 0 } });
    T(s, [{ text: 'ผลจริง: ', options: { bold: true, color: C.text2 } }, { text: `ตารางแรกครบทุกคาบ (${S.large.periods} คาบ) ภายใน < 0.1 วินาที — แต่ยังไม่สวย`, options: { color: C.text1 } }], { x: 0.85, y: 6.35, w: 11.6, h: 0.5, fontSize: 16 });
    s.addNotes('ขั้นที่ 1 Greedy: เรียงชิ้นงานที่ยากก่อน (ยากคือกินหลายคาบและเกี่ยวกับหลายทรัพยากร) แล้ววางทีละชิ้นลงช่องที่ไม่ชน และเพิ่มคะแนนความไม่สวยน้อยที่สุด ข้อดีคือเร็วมาก ได้ตารางแรกครบทุกคาบในเสี้ยววินาที ข้อเสียคือเป็นการตัดสินใจทีละจุด ยังไม่มองภาพรวม จึงยังไม่สวยและบางชิ้นอาจวางไม่ลง ซึ่งส่งต่อให้ขั้นซ่อม');
  }

  // ============ 5) Ejection Chain + Tabu ============
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    s.addText('Ejection Chain + Tabu: วางไม่ลง → ไล่ชิ้นที่ขวางเป็นทอดๆ', { placeholder: 'title' });
    const F = BLUE;
    const steps = [
      { t: 'ชิ้นใหม่ไม่มีช่องว่าง', d: 'ช่องที่พอไหวถูกชิ้นอื่นจองหมด', cells: [F, F, F, F, F, F], extra: { text: 'ใหม่', fill: AMBER } },
      { t: 'เลือกช่องที่ขวางน้อยสุด', d: 'นับว่าต้องไล่กี่ชิ้น เลือกน้อยสุด', cells: [F, F, { fill: F, line: RED }, F, F, F] },
      { t: 'ไล่ชิ้นที่ขวางออกไปรอ', d: 'วางชิ้นใหม่ลงแทน', cells: [F, F, { fill: AMBER, text: 'ใหม่' }, F, F, F], extra: { text: 'รอ', fill: GRAY } },
      { t: 'ชิ้นที่ถูกไล่ ไปหาที่ใหม่', d: 'ถ้าไปขวางอีก → ไล่ต่อ เป็นลูกโซ่', cells: [F, F, { fill: AMBER, text: 'ใหม่' }, F, { fill: GREEN, text: '✓' }, F] },
    ];
    const w = 2.8, gap = 0.3, y = 1.65, h = 3.55;
    steps.forEach((st, i) => {
      const x = 0.6 + i * (w + gap);
      card(s, x, y, w, h, { name: 'ej' + i });
      numCircle(s, i + 1, x + 0.2, y + 0.2, 0.46, AMBER);
      T(s, st.t, { x: x + 0.8, y: y + 0.15, w: w - 0.95, h: 0.56, fontSize: 15, bold: true, color: C.text2 });
      miniGrid(s, x + 0.55, y + 0.95, 3, 2, 0.58, 0.1, st.cells.map((c) => (typeof c === 'string' ? { fill: c } : c)));
      if (st.extra) {
        s.addShape(SH.ROUNDED_RECTANGLE, { x: x + 0.55, y: y + 2.05, w: 0.9, h: 0.38, rectRadius: 0.06, fill: { color: st.extra.fill }, line: { color: st.extra.fill, width: 0 } });
        T(s, st.extra.text, { x: x + 0.55, y: y + 2.05, w: 0.9, h: 0.38, align: 'center', fontSize: 13, bold: true, color: C.background1 });
      }
      T(s, st.d, { x: x + 0.2, y: y + 2.6, w: w - 0.4, h: 0.8, fontSize: 14, color: '4B5563', valign: 'top' });
      if (i < 3) arrow(s, x + w + 0.02, y + 1.8, x + w + gap - 0.02, y + 1.8, NAVY);
    });
    // Tabu + fallback
    card(s, 0.6, 5.45, 6.0, 1.3, { name: 'tabu', fill: 'FFF4E0', noShadow: true, line: AMBER });
    await iconCircle(s, 'FaBan', 0.85, 5.75, 0.7, RED);
    T(s, [{ text: 'Tabu — กันวนลูป', options: { bold: true, fontSize: 17, breakLine: true } }, { text: 'ชิ้นที่เพิ่งถูกไล่ ห้ามไล่ซ้ำ ~8–15 รอบ', options: { fontSize: 14 } }], { x: 1.75, y: 5.5, w: 4.7, h: 1.2, color: C.text1, paraSpaceAfter: 4 });
    card(s, 6.9, 5.45, 5.8, 1.3, { name: 'noway', fill: SOFT, noShadow: true });
    await iconCircle(s, 'FaRoute', 7.15, 5.75, 0.7, NAVY);
    T(s, [{ text: 'ไม่มีทางวางเลย?', options: { bold: true, fontSize: 17, breakLine: true } }, { text: 'คงสถานะ "ยังไม่ได้วาง" แล้วให้ขั้นถัดไป/แยกช่วงช่วย', options: { fontSize: 14 } }], { x: 8.05, y: 5.5, w: 4.5, h: 1.2, color: C.text1, paraSpaceAfter: 4 });
    s.addNotes('ขั้นที่ 2 ซ่อมแซม: เมื่อชิ้นไหนวางไม่ลงเพราะทุกช่องถูกจองแล้ว ระบบไม่ยอมแพ้ แต่เลือกช่องที่มีชิ้นขวางน้อยที่สุด ไล่ชิ้นที่ขวางออกไปเข้าคิว แล้ววางชิ้นใหม่ลง จากนั้นชิ้นที่ถูกไล่ก็ไปหาที่ใหม่ ถ้าไปขวางชิ้นอื่นอีกก็ไล่ต่อเป็นลูกโซ่ (Ejection Chain) เพื่อกันการไล่กันวนไปมา ใช้ Tabu คือจำว่าชิ้นไหนเพิ่งถูกไล่ ห้ามไล่ซ้ำประมาณ 8 ถึง 15 รอบ');
  }

  // ============ 6) Simulated Annealing ============
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    s.addText('Simulated Annealing: ขยับให้สวยขึ้น โดยไม่ละเมิดข้อบังคับเลย', { placeholder: 'title' });
    // คอลัมน์ 1: กราฟอุณหภูมิ
    T(s, 'อุณหภูมิ T ลดลงตามเวลา', { x: 0.6, y: 1.55, w: 4.3, h: 0.4, fontSize: 17, bold: true, color: C.text2 });
    const labels = [], vals = [];
    for (let i = 0; i <= 10; i++) { labels.push(String(i * 10)); vals.push(+(2.0 * Math.pow(0.03 / 2.0, i / 10)).toFixed(2)); }
    s.addChart(pres.charts.LINE, [{ name: 'T', labels, values: vals }], {
      x: 0.5, y: 1.95, w: 4.5, h: 3.4, chartColors: [RED], lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 6,
      catAxisLabelColor: GRAY, valAxisLabelColor: GRAY, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11, catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt',
      valGridLine: { color: 'E1E7EF', size: 0.75 }, catGridLine: { style: 'none' }, showLegend: false, valAxisMaxVal: 2.2, valAxisMinVal: 0, valAxisMajorUnit: 0.5,
      showCatAxisTitle: true, catAxisTitle: 'ส่วนของเวลาที่ตั้งไว้ที่ใช้ไป (%)', catAxisTitleFontSize: 11, catAxisTitleColor: GRAY, catAxisTitleFontFace: '+mn-lt',
    });
    T(s, [{ text: 'ร้อน ', options: { bold: true, color: RED } }, { text: 'ยอมแย่ลงบ้างเพื่อสำรวจ', options: { breakLine: true } }, { text: 'เย็น ', options: { bold: true, color: NAVY } }, { text: 'รับเฉพาะที่ดีขึ้น' }], { x: 0.6, y: 5.4, w: 4.4, h: 0.9, fontSize: 14, color: C.text1, valign: 'top', paraSpaceAfter: 3 });
    // คอลัมน์ 2: การขยับ
    T(s, '3 รูปแบบการขยับ', { x: 5.3, y: 1.55, w: 3.4, h: 0.4, fontSize: 17, bold: true, color: C.text2 });
    [['45%', 'ย้ายไปช่องสุ่ม', BLUE], ['30%', 'เลื่อน ±1–3 คาบ', AMBER], ['25%', 'สลับกับชิ้นอื่น', GREEN]].forEach(([p, t, col], i) => {
      const y = 2.05 + i * 1.4;
      card(s, 5.3, y, 3.4, 1.2, { name: 'mv' + i });
      T(s, p, { x: 5.5, y, w: 1.3, h: 1.2, fontSize: 30, bold: true, color: col === AMBER ? 'B26A00' : col });
      T(s, t, { x: 6.8, y, w: 1.8, h: 1.2, fontSize: 15, color: C.text1 });
    });
    // คอลัมน์ 3: น้ำหนัก
    T(s, 'คะแนนความไม่สวย (น้อย = ดี)', { x: 9.1, y: 1.55, w: 3.6, h: 0.4, fontSize: 17, bold: true, color: C.text2 });
    const W = R.weights;
    s.addChart(pres.charts.BAR, [{ name: 'น้ำหนัก', labels: ['คาบว่างคั่น: นักเรียน', 'ครูสอนติด >4 คาบ', 'คาบว่างคั่น: ครู', 'วิชากระจุกวัน'], values: [W.gapGroup, W.overload, W.gapTeacher, W.spread] }], {
      x: 9.0, y: 1.95, w: 3.8, h: 3.4, barDir: 'bar', chartColors: [NAVY], catAxisOrientation: 'maxMin', showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 12, dataLabelColor: HEX.dk1, dataLabelFontFace: '+mn-lt',
      catAxisLabelColor: HEX.dk1, valAxisLabelColor: GRAY, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt',
      valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false, valAxisHidden: true, valAxisMaxVal: 10, valAxisMinVal: 0, barGapWidthPct: 50,
    });
    T(s, 'นักเรียนสำคัญกว่าครู 4 เท่า', { x: 9.1, y: 5.4, w: 3.6, h: 0.5, fontSize: 14, color: GRAY, valign: 'top' });
    // แถบรับประกัน
    s.addShape(SH.ROUNDED_RECTANGLE, { x: 0.6, y: 6.2, w: 12.1, h: 0.6, rectRadius: 0.1, fill: { color: 'D9F0E5' }, line: { color: GREEN, width: 1.5 } });
    T(s, [{ text: '✔ ทุกการขยับต้องผ่านข้อบังคับก่อน ', options: { bold: true, color: '1F7A50' } }, { text: '— ครู/กลุ่ม/ห้องจึงไม่เคยชนระหว่างทาง และเก็บ "คำตอบที่ดีที่สุด" ไว้เสมอ', options: { color: C.text1 } }], { x: 0.85, y: 6.2, w: 11.6, h: 0.6, fontSize: 15 });
    s.addNotes('ขั้นที่ 3 Simulated Annealing เลียนแบบการอบโลหะ: เริ่มจากตารางที่ครบแล้ว สุ่มขยับทีละชิ้น 3 แบบ คือ ย้ายไปช่องสุ่ม 45% เลื่อนใกล้ๆ บวกลบ 1 ถึง 3 คาบ 30% และสลับกับชิ้นอื่น 25% ทุกการขยับต้องไม่ชน ถ้าคะแนนความไม่สวยลดลงก็รับ ถ้าแย่ลงก็ยังรับได้ด้วยความน่าจะเป็นที่ขึ้นกับอุณหภูมิ T ซึ่งลดจาก 2.0 เหลือ 0.03 แบบเรขาคณิตตามเวลา ช่วงแรกยอมแย่ลงเพื่อหลุดจากกับดัก ช่วงหลังรับเฉพาะที่ดีขึ้น คะแนนความไม่สวยถ่วงน้ำหนัก: คาบว่างของนักเรียน 8 ครูสอนติดเกิน 4 คาบ 3 (ต่อคาบ) คาบว่างของครู 2 วิชาเดียวกันกระจุกวัน 2 และมีค่าเล็กน้อยสำหรับความสมดุลรายวัน');
  }

  // ============ 7) ทำงานสอดคล้องกัน ============
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    s.addText('ทำงานต่อกันเป็นวงจร: เร็ว → ครบ → สวย', { placeholder: 'title' });
    const segs = [
      { x: 0.6, w: 2.6, col: BLUE, t: 'Greedy', d: 'ตารางแรก < 0.1 วินาที', k: 'เร็ว' },
      { x: 3.3, w: 2.6, col: AMBER, t: 'Ejection + Tabu', d: 'ซ่อมชิ้นที่ค้าง', k: 'ครบ' },
      { x: 6.0, w: 6.7, col: GREEN, t: 'Simulated Annealing', d: 'ย้าย/สลับ ลดคะแนนความไม่สวย (ใช้เวลาส่วนใหญ่)', k: 'สวย' },
    ];
    segs.forEach((sg) => {
      T(s, sg.k, { x: sg.x, y: 1.6, w: sg.w, h: 0.5, fontSize: 24, bold: true, align: 'center', color: sg.col === AMBER ? 'B26A00' : sg.col });
      s.addShape(SH.ROUNDED_RECTANGLE, { x: sg.x, y: 2.2, w: sg.w, h: 1.2, rectRadius: 0.12, fill: { color: sg.col }, line: { color: sg.col, width: 0 } });
      T(s, [{ text: sg.t, options: { bold: true, fontSize: 18, breakLine: true } }, { text: sg.d, options: { fontSize: 13 } }], { x: sg.x + 0.1, y: 2.2, w: sg.w - 0.2, h: 1.2, align: 'center', color: sg.col === AMBER ? HEX.dk1 : C.background1, paraSpaceAfter: 3 });
    });
    T(s, 'ความกว้างเป็นภาพประกอบ ไม่ตามสัดส่วนเวลาจริง', { x: 6.0, y: 3.45, w: 6.7, h: 0.3, fontSize: 10, color: GRAY, align: 'right' });
    // ลูกศรย้อนกลับ SA -> Repair
    s.addShape(SH.LINE, { x: 9.3, y: 3.75, w: 0, h: 0.5, line: { color: AMBER, width: 2.5 } });
    s.addShape(SH.LINE, { x: 4.6, y: 4.25, w: 4.7, h: 0, line: { color: AMBER, width: 2.5 } });
    s.addShape(SH.LINE, { x: 4.6, y: 3.45, w: 0, h: 0.8, flipV: true, line: { color: AMBER, width: 2.5, endArrowType: 'triangle' } });
    T(s, 'ทุก 6,000 รอบ ถ้ายังมีชิ้นค้าง → เรียกซ่อมซ้ำ', { x: 4.7, y: 4.3, w: 4.6, h: 0.4, fontSize: 14, bold: true, align: 'center', color: 'B26A00' });
    // 3 การ์ดประกอบ
    const cards = [
      ['FaTrophy', 'เก็บคำตอบดีที่สุดไว้เสมอ', 'หยุดเมื่อไรก็ได้ผลดีที่สุดเสมอ', GREEN],
      ['FaCut', 'ถ้าวิชาติดกันวางไม่ลง', 'แยกเป็นช่วง เช่น 4 = 2+2 พร้อมแจ้งเตือน', AMBER],
      ['FaDesktop', 'รันใน Web Worker', 'หน้าจอไม่ค้าง กดหยุดได้ จบเองเมื่อไม่ดีขึ้นอีก', NAVY],
    ];
    for (let i = 0; i < cards.length; i++) {
      const x = 0.6 + i * 4.1;
      card(s, x, 4.95, 3.9, 1.8, { name: 'sup' + i });
      await iconCircle(s, cards[i][0], x + 0.2, 5.15, 0.62, cards[i][3]);
      T(s, cards[i][1], { x: x + 0.95, y: 5.1, w: 2.85, h: 0.75, fontSize: 15, bold: true, color: C.text2 });
      T(s, cards[i][2], { x: x + 0.2, y: 5.9, w: 3.55, h: 0.75, fontSize: 14, color: '4B5563', valign: 'top' });
    }
    s.addNotes('สามขั้นไม่ได้ทำแยกกัน แต่ส่งต่อกันเป็นวงจร Greedy ให้คำตอบเริ่มต้นเร็วมาก, Ejection Chain กับ Tabu เติมชิ้นที่ยังค้างให้ครบ, Simulated Annealing ใช้เวลาส่วนใหญ่ขัดเกลาให้สวย และระหว่างนั้นถ้ายังมีชิ้นค้างอยู่ จะเรียกขั้นซ่อมกลับมาช่วยทุกๆ 6,000 รอบ ระบบเก็บคำตอบที่ดีที่สุดไว้ตลอด จึงกดหยุดเมื่อไรก็ได้ผลที่ดีที่สุดเท่าที่หาได้ ถ้าวิชาที่ต้องติดกันวางไม่ลงจริงๆ จะแยกเป็นช่วงย่อยและแจ้งเตือน ทั้งหมดรันใน Web Worker หน้าจอจึงไม่ค้าง');
  }

  // ============ 8) ผลลัพธ์ ============
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    s.addText('ผลลัพธ์: ครบทุกคาบ ไม่ชนเลย ใช้เวลาไม่กี่วินาที', { placeholder: 'title' });
    const keys = [['small', 'เล็ก'], ['medium', 'กลาง'], ['large', 'ใหญ่']];
    keys.forEach(([k, name], i) => {
      const x = 0.6 + i * 4.1, d = S[k];
      card(s, x, 1.6, 3.9, 2.35, { name: 'res' + k });
      T(s, [{ text: `ตัวอย่าง${name}`, options: { bold: true, color: C.text2 } }, { text: `  ${d.groups} กลุ่ม • ${d.periods} คาบ`, options: { color: GRAY, fontSize: 13 } }], { x: x + 0.25, y: 1.7, w: 3.5, h: 0.5, fontSize: 17 });
      T(s, [{ text: '100%', options: { fontSize: 34, bold: true, color: GREEN } }, { text: ' วางครบ', options: { fontSize: 15, color: C.text1 } }], { x: x + 0.25, y: 2.2, w: 3.5, h: 0.7 });
      T(s, [{ text: `ชน ${d.conflicts}`, options: { bold: true, color: GREEN, fontSize: 20 } }, { text: '   •   ', options: { color: GRAY } }, { text: `${d.sec.toFixed(1)} วินาที`, options: { bold: true, color: C.text2, fontSize: 20 } }], { x: x + 0.25, y: 2.95, w: 3.5, h: 0.5, fontSize: 16 });
      T(s, `ตารางแรกครบใน < 0.1 วินาที`, { x: x + 0.25, y: 3.4, w: 3.5, h: 0.35, fontSize: 12, color: GRAY });
    });
    const cats = keys.map(([k, n]) => `${n} (${S[k].periods} คาบ)`);
    const chartOpts = (x, title) => ({
      x, y: 4.35, w: 5.9, h: 2.5, chartColors: [GRAY, GREEN], barGrouping: 'clustered', barGapWidthPct: 60, showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 11, dataLabelColor: HEX.dk1, dataLabelFontFace: '+mn-lt',
      catAxisLabelColor: HEX.dk1, valAxisLabelColor: GRAY, catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt',
      valGridLine: { color: 'E1E7EF', size: 0.75 }, catGridLine: { style: 'none' }, showLegend: true, legendPos: 'b', legendFontSize: 11, legendColor: HEX.dk1, legendFontFace: '+mn-lt', valAxisHidden: true,
      showTitle: true, title, titleFontSize: 14, titleColor: HEX.dk2, titleFontFace: '+mn-lt', dataLabelFormatCode: 'General',
    });
    s.addChart(pres.charts.BAR, [
      { name: 'ก่อนปรับ (Greedy + ซ่อม)', labels: cats, values: keys.map(([k]) => S[k].gB) },
      { name: 'หลังปรับ (Annealing)', labels: cats, values: keys.map(([k]) => S[k].gA) },
    ], chartOpts(0.6, `คาบว่างคั่นนักเรียน (น้อย = ดี) • ใหญ่ลด ${Math.round((1 - S.large.gA / S.large.gB) * 100)}%`));
    s.addChart(pres.charts.BAR, [
      { name: 'ก่อนปรับ (Greedy + ซ่อม)', labels: cats, values: keys.map(([k]) => S[k].tB) },
      { name: 'หลังปรับ (Annealing)', labels: cats, values: keys.map(([k]) => S[k].tA) },
    ], chartOpts(6.8, `คาบว่างคั่นครู (น้อย = ดี) • ใหญ่ลด ${Math.round((1 - S.large.tA / S.large.tB) * 100)}%`));
    s.addNotes(`ผลการรันจริง (เฉลี่ย 2 รอบ, เครื่อง ${R.machine.cpus} คอร์): ตัวอย่างเล็ก ${S.small.periods} คาบ, กลาง ${S.medium.periods} คาบ, ใหญ่ ${S.large.periods} คาบ ทุกขนาดวางครบ 100% และตรวจแล้วไม่มีครู/กลุ่ม/ห้องชนกันเลย (ตรวจด้วยโค้ดแยกอิสระ) ตารางแรกที่ครบได้ภายในเสี้ยววินาที จากนั้นขั้นปรับให้สวยลดคาบว่างคั่นของนักเรียนจาก ${S.large.gB} เหลือ ${S.large.gA} (ตัวอย่างใหญ่) และของครูจาก ${S.large.tB} เหลือ ${S.large.tA} ระบบจบเองเมื่อคะแนนไม่ดีขึ้นอีก (ตั้งเวลาสูงสุดไว้ ${R.runs[0].limitSec}/${R.runs[2].limitSec}/${R.runs[4].limitSec} วินาที) ตัวเลขเวลาจัดมือของโรงเรียนจริงไม่ได้วัดไว้ จึงไม่นำมาเทียบ`);
  }

  // ============ 9) จากข้อมูลสู่ผู้ใช้ ============
  {
    const s = pres.addSlide({ masterName: 'CONTENT' });
    s.addText('ใช้งานง่าย: กรอก → จัดอัตโนมัติ → แจกให้ทุกคนดู', { placeholder: 'title' });
    const cols = [
      { n: 1, t: 'กรอก / Import ข้อมูล', img: 'q4-teachers.png', ar: 417 / 1100, d: 'พิมพ์เอง หรือนำเข้า Excel / CSV / JSON' },
      { n: 2, t: 'จัดตารางอัตโนมัติ', img: 'q7-run.png', ar: 513 / 1100, d: 'กดปุ่มเดียว ดูตามครู กลุ่ม อาคาร ส่งออก PDF/Excel' },
      { n: 3, t: 'เผยแพร่ด้วยรหัส', img: 'q8-publish.png', ar: 393 / 1100, d: 'รหัสนักเรียน/ครูแยกกัน ดูได้อย่างเดียว' },
    ];
    cols.forEach((c, i) => {
      const x = 0.6 + i * 4.1;
      card(s, x, 1.6, 3.9, 4.0, { name: 'flow' + i });
      numCircle(s, c.n, x + 0.2, 1.8, 0.5, NAVY);
      T(s, c.t, { x: x + 0.85, y: 1.8, w: 2.95, h: 0.5, fontSize: 17, bold: true, color: C.text2 });
      const iw = 3.5, ih = iw * c.ar;
      s.addImage({ path: path.join(IMGDIR, c.img), x: x + 0.2, y: 2.55 + (1.9 - ih) / 2, w: iw, h: ih, altText: c.t, objectName: 'shot' + i });
      T(s, c.d, { x: x + 0.2, y: 4.65, w: 3.5, h: 0.8, fontSize: 14, color: C.text1, valign: 'top' });
      if (i < 2) arrow(s, x + 3.92, 3.6, x + 4.08, 3.6, NAVY);
    });
    const chips = [['FaFilePdf', 'ส่งออก PDF / Excel'], ['FaMobileAlt', 'นักเรียน/ครู ดูบนมือถือได้'], ['FaShieldAlt', 'ข้อมูลอยู่ในเครื่อง • เข้ารหัสเมื่อเผยแพร่']];
    for (let i = 0; i < chips.length; i++) {
      const x = 0.6 + i * 4.1;
      await iconCircle(s, chips[i][0], x, 5.95, 0.6, i === 2 ? GREEN : BLUE);
      T(s, chips[i][1], { x: x + 0.75, y: 5.95, w: 3.15, h: 0.6, fontSize: 14, color: C.text1 });
    }
    s.addNotes('ผู้ใช้ทั่วไปไม่ต้องรู้อัลกอริทึม: กรอกข้อมูลหรือ Import จาก Excel กดจัดตารางปุ่มเดียว ดูตามครู กลุ่มเรียน หรืออาคาร ส่งออก PDF หรือ Excel ได้ และเผยแพร่ให้นักเรียน/ครูดูบนมือถือด้วยรหัสแยกกัน ไฟล์ที่เผยแพร่เข้ารหัส (PBKDF2 + AES-256-GCM) ระบบไม่มีเซิร์ฟเวอร์ ข้อมูลอยู่ในเบราว์เซอร์ของผู้ใช้');
  }

  // ============ 10) สรุป ============
  {
    const s = pres.addSlide({ masterName: 'CONTENT_DARK' });
    s.addText('สรุป: ครบ ถูกต้อง เร็ว', { placeholder: 'title' });
    const cols = [
      ['FaLayerGroup', 'ครบ', 'รองรับเงื่อนไขจริง: ครูชื่อซ้ำ เรียนรวม/แยก กรณีพิเศษ คาบติดกัน', BLUE],
      ['FaCheckDouble', 'ถูกต้อง', 'ครู กลุ่ม ห้อง ไม่ชนเลย • ผ่านการทดสอบอัตโนมัติ 85 รายการ', GREEN],
      ['FaBolt', 'เร็ว', `${S.large.periods} คาบ ใน ~${Math.round(S.large.sec)} วินาที • ตารางแรกใน < 0.1 วินาที`, AMBER],
    ];
    for (let i = 0; i < cols.length; i++) {
      const x = 0.6 + i * 4.1;
      s.addShape(SH.ROUNDED_RECTANGLE, { x, y: 1.6, w: 3.9, h: 3.0, rectRadius: 0.14, fill: { color: '3B5A80' }, line: { color: '3B5A80', width: 0 } });
      await iconCircle(s, cols[i][0], x + 0.3, 1.85, 0.85, cols[i][3], cols[i][3] === AMBER ? HEX.dk1 : 'FFFFFF');
      T(s, cols[i][1], { x: x + 1.35, y: 1.85, w: 2.4, h: 0.85, fontSize: 30, bold: true, color: C.background1 });
      T(s, cols[i][2], { x: x + 0.3, y: 2.95, w: 3.3, h: 1.5, fontSize: 16, color: 'E6EEF8', valign: 'top' });
    }
    s.addShape(SH.ROUNDED_RECTANGLE, { x: 0.6, y: 4.95, w: 12.1, h: 1.35, rectRadius: 0.12, fill: { color: '27405E' }, line: { color: '27405E', width: 0 } });
    T(s, [
      { text: 'ข้อจำกัด  ', options: { bold: true, color: AMBER } }, { text: 'ได้ตารางที่ดีมากแต่ไม่การันตีว่าดีที่สุด • ยังไม่มีปุ่มแก้ไขรายการ (ลบแล้วเพิ่มใหม่)', options: { color: 'E6EEF8', breakLine: true } },
      { text: 'ต่อยอด  ', options: { bold: true, color: GREEN } }, { text: 'ทดลองกับข้อมูลโรงเรียนจริง • ปรับน้ำหนักความสวยตามนโยบายโรงเรียน', options: { color: 'E6EEF8' } },
    ], { x: 0.9, y: 4.95, w: 11.5, h: 1.35, fontSize: 16, paraSpaceAfter: 8 });
    T(s, [{ text: 'ขอบคุณครับ/ค่ะ • ', options: { bold: true } }, { text: 'marnlop3-vcv.github.io/ttauto', options: { hyperlink: { url: 'https://marnlop3-vcv.github.io/ttauto/' }, color: 'CADCFC' } }], { x: 0.6, y: 6.5, w: 12.1, h: 0.45, fontSize: 16, color: C.background1 });
    s.addNotes('สรุป 3 ข้อ: ครบ (รองรับเงื่อนไขจริง) ถูกต้อง (ไม่ชนเลย ตรวจอัตโนมัติ) เร็ว (720 คาบในประมาณ 13 วินาที) ข้อจำกัดที่ต้องบอกตรงๆ: เป็นวิธีฮิวริสติก ได้ตารางที่ดีมากแต่ไม่การันตีว่าดีที่สุด และยังไม่มีปุ่มแก้ไขรายการ ต่อยอดได้โดยทดลองกับข้อมูลโรงเรียนจริงและปรับน้ำหนักความสวยตามนโยบาย เปิดให้ถามตอบ');
  }

  await pres.writeFile({ fileName: OUTFILE });
  await applyTheme(OUTFILE, THEME);
  console.log('wrote', OUTFILE);
})().catch((e) => { console.error(e); process.exit(1); });
