// สร้างภาพไดอะแกรมสำหรับรายงาน (PNG) ด้วย Playwright — รัน: node docs/presentation/render-diagrams.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'results.json'), 'utf8'));
const OUT = path.join(__dirname, 'diagrams');

// ---- กราฟการลู่เข้า (ข้อมูลจริง): คะแนนความไม่สวยที่ดีที่สุด เทียบ % ของคะแนนเริ่มต้น ----
function convergenceSvg() {
  const W = 1040, H = 400, L = 70, Rr = 30, T = 30, B = 60;
  const runs = R.runs.filter((r) => r.seed === 1);
  const maxT = Math.max(...runs.map((r) => r.totalSec));
  const X = (t) => L + (t / (Math.ceil(maxT / 2) * 2)) * (W - L - Rr);
  const ymin = 84, ymax = 101;
  const Y = (p) => T + (1 - (p - ymin) / (ymax - ymin)) * (H - T - B);
  const col = { small: '#5B8DB8', medium: '#F2A93B', large: '#2E9E6B' };
  const name = { small: 'เล็ก (64 คาบ)', medium: 'กลาง (264 คาบ)', large: 'ใหญ่ (720 คาบ)' };
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Tahoma, Loma, sans-serif">`;
  for (let p = 85; p <= 100; p += 5) s += `<line x1="${L}" x2="${W - Rr}" y1="${Y(p)}" y2="${Y(p)}" stroke="#E1E7EF"/><text x="${L - 10}" y="${Y(p) + 5}" text-anchor="end" font-size="15" fill="#6B7280">${p}%</text>`;
  const xmax = Math.ceil(maxT / 2) * 2;
  for (let t = 0; t <= xmax; t += 2) s += `<text x="${X(t)}" y="${H - B + 24}" text-anchor="middle" font-size="15" fill="#6B7280">${t}</text>`;
  s += `<text x="${(L + W - Rr) / 2}" y="${H - 10}" text-anchor="middle" font-size="16" fill="#374151">เวลา (วินาที)</text>`;
  s += `<text x="18" y="${(T + H - B) / 2}" font-size="16" fill="#374151" transform="rotate(-90 18 ${(T + H - B) / 2})" text-anchor="middle">คะแนนความไม่สวย (% ของตอนเริ่ม)</text>`;
  for (const r of runs) {
    const pts = [[0, 100], ...r.curve.map((c) => [c.t, (c.cost / r.cost.initial) * 100])];
    pts.push([r.totalSec, (r.cost.final / r.cost.initial) * 100]);
    s += `<polyline fill="none" stroke="${col[r.size]}" stroke-width="4" stroke-linejoin="round" points="${pts.map(([t, p]) => `${X(t).toFixed(1)},${Y(p).toFixed(1)}`).join(' ')}"/>`;
    const fin = (r.cost.final / r.cost.initial) * 100;
    s += `<circle cx="${X(r.totalSec)}" cy="${Y(fin)}" r="7" fill="${col[r.size]}"/>`;
  }
  const order = ['large', 'medium', 'small'];
  order.forEach((k, i) => {
    const r = runs.find((x) => x.size === k);
    const fin = (r.cost.final / r.cost.initial) * 100;
    const y = 120 + i * 30;
    s += `<line x1="${W - 470}" x2="${W - 430}" y1="${y}" y2="${y}" stroke="${col[k]}" stroke-width="5"/><text x="${W - 420}" y="${y + 5}" font-size="16" fill="#1F2937">${name[k]}: เหลือ ${fin.toFixed(0)}% • จบที่ ${r.totalSec.toFixed(1)} วินาที</text>`;
  });
  return s + '</svg>';
}

const css = `
body{margin:0;background:#fff;font-family:Tahoma,Loma,sans-serif;color:#1F2937}
.fig{width:1060px;padding:20px;background:#fff;box-sizing:border-box;margin-bottom:24px}
.row{display:flex;gap:14px;align-items:stretch}
.box{border-radius:12px;padding:12px 14px;font-size:16px;line-height:1.35;background:#EAF0F7;border:2px solid #C9D6E6}
.box b{display:block;font-size:17px;color:#2F4A6B;margin-bottom:3px}
.small{font-size:14px;color:#4B5563}
.arrow{align-self:center;font-size:30px;color:#2F4A6B;font-weight:700}
.panel{border:2.5px dashed #8A94A6;border-radius:16px;padding:14px;position:relative}
.panel>.tag{position:absolute;top:-14px;left:18px;background:#fff;padding:0 10px;font-weight:700;font-size:16px;color:#2F4A6B}
.blue{background:#DCE8F5;border-color:#5B8DB8}.green{background:#D9F0E5;border-color:#2E9E6B}.amber{background:#FFF1D6;border-color:#F2A93B}.red{background:#FBE3DE;border-color:#E0533D}.navy{background:#2F4A6B;color:#fff;border-color:#2F4A6B}.navy b{color:#fff}.navy .small{color:#CADCFC}
.tile{display:inline-block;border-radius:8px;padding:6px 8px;margin:3px 4px 3px 0;color:#fff;font-weight:700;font-size:15px;text-align:center}
.cap{font-size:14px;color:#6B7280;margin-top:8px;text-align:center}
`;
const archHtml = `<div class="fig" id="arch">
 <div class="panel"><span class="tag">เบราว์เซอร์ของผู้ดูแล (ทุกอย่างทำงานในเครื่อง ไม่มีเซิร์ฟเวอร์)</span>
  <div class="row" style="margin-top:8px">
   <div class="box blue" style="flex:1.1"><b>หน้าจอ (React)</b>Dashboard • กรอกข้อมูล<br>เผยแพร่ • วิธีใช้<span class="small"><br>ตัวนำทาง "เริ่มต้นใช้งาน"</span></div>
   <div class="arrow">⇄</div>
   <div class="box amber" style="flex:1.1"><b>ที่เก็บข้อมูล (Zustand)</b>ครู กลุ่ม วิชา อาคาร<br>กรณีพิเศษ กำหนดการเรียน<span class="small"><br>เก็บใน localStorage ของเบราว์เซอร์</span></div>
   <div class="arrow">→</div>
   <div class="box green" style="flex:1.2"><b>Web Worker: ตัวจัดตาราง</b>Greedy → Ejection+Tabu → Annealing<span class="small"><br>แยกจากหน้าจอ จึงไม่ค้าง กดหยุดได้</span></div>
  </div>
  <div class="row" style="margin-top:14px">
   <div class="box" style="flex:1"><b>นำเข้า/ส่งออก</b>Excel/CSV/JSON (tabular, ExcelJS)<br>PDF (html2canvas + jsPDF)</div>
   <div class="box" style="flex:1"><b>ตัวแปลงเงื่อนไขไทย</b>"วันพุธ คาบ 7-8" → ช่องเวลา</div>
   <div class="box" style="flex:1"><b>มุมมองตาราง</b>ครู / กลุ่มเรียน / อาคาร<br>สรุปคาบต่อสัปดาห์</div>
  </div>
 </div>
 <div style="text-align:center;font-size:30px;color:#2F4A6B;margin:6px 0">↓ กด "สร้างไฟล์เผยแพร่"</div>
 <div class="row">
  <div class="box red" style="flex:1.2"><b>เข้ารหัส (WebCrypto)</b>PBKDF2-SHA256 600,000 รอบ → AES-256-GCM<span class="small"><br>ซองนักเรียน + ซองครู แยกรหัส (gzip ก่อนเข้ารหัส)</span></div>
  <div class="arrow">→</div>
  <div class="box navy" style="flex:1"><b>published.enc.json</b>ไฟล์เข้ารหัส<span class="small"><br>มีเฉพาะตารางสำเร็จรูป ไม่มีข้อมูลดิบ</span></div>
  <div class="arrow">→</div>
  <div class="box" style="flex:1.1"><b>แจกจ่าย</b>วางบนเว็บ (GitHub Pages)<br>หรือส่งทางไลน์/อีเมล</div>
  <div class="arrow">→</div>
  <div class="box green" style="flex:1.1"><b>นักเรียน / ครู</b>ใส่รหัส → ถอดรหัสในเบราว์เซอร์<span class="small"><br>ซองที่ถอดได้ = บทบาทที่เห็น</span></div>
 </div>
 </div>`;

const unitsHtml = `<div class="fig" id="units">
 <div class="row" style="align-items:center">
  <div style="flex:1.15">
   <div class="small" style="margin-bottom:4px"><b>กำหนดการเรียน (ข้อมูลที่ผู้ใช้กรอก)</b></div>
   <div class="box" style="margin-bottom:8px"><b>A1</b>ภาษาไทย • ครูสมศรี • ห้อง 101 • กลุ่ม 6701<span class="small"> • เรียนรวมกัน</span></div>
   <div class="box" style="margin-bottom:8px"><b>A2</b>ภาษาไทย • ครูสมศรี • ห้อง 101 • กลุ่ม 6702<span class="small"> • เรียนรวมกัน</span></div>
   <div class="box"><b>A3</b>บัญชี (6 คาบ) • ครูสุนีย์ • กลุ่ม 6701, 6702<span class="small"> • แยกเรียน</span></div>
  </div>
  <div class="arrow">→</div>
  <div style="flex:1.1">
   <div class="small" style="margin-bottom:4px"><b>หน่วยงาน (Unit): ใครต้องว่างพร้อมกัน</b></div>
   <div class="box blue" style="margin-bottom:8px"><b>U1 = A1 + A2 (รวมเป็นหน่วยเดียว)</b>วิชา+ครู+ห้องเดียวกัน → ต้องว่าง: ครูสมศรี, ห้อง 101, กลุ่ม 6701 และ 6702</div>
   <div class="box blue" style="margin-bottom:8px"><b>U2 = A3 สำหรับ 6701</b>ต้องว่าง: ครูสุนีย์ + กลุ่ม 6701 + ห้อง</div>
   <div class="box blue"><b>U3 = A3 สำหรับ 6702</b>แยกเรียน → แตกเป็นหน่วยละกลุ่ม</div>
  </div>
  <div class="arrow">→</div>
  <div style="flex:1">
   <div class="small" style="margin-bottom:4px"><b>ชิ้นงาน (Piece): สิ่งที่วางลงตาราง</b></div>
   <div class="box green" style="margin-bottom:8px"><b>U1 (2 คาบ ≤ 4)</b><span class="tile" style="background:#2E9E6B;width:96px">2 คาบติดกัน</span></div>
   <div class="box amber"><b>U2 (6 คาบ &gt; 4)</b><span class="tile" style="background:#F2A93B;color:#1F2937;width:78px">3 คาบ</span><span class="tile" style="background:#F2A93B;color:#1F2937;width:78px">3 คาบ</span><span class="small"><br>แบ่งเป็น 3+3 คนละวัน</span></div>
  </div>
 </div>
 </div>`;

const convHtml = `<div class="fig" id="conv">${convergenceSvg()}</div>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
  await p.setContent(`<style>${css}</style>${archHtml}${unitsHtml}${convHtml}`);
  await p.waitForTimeout(300);
  for (const id of ['arch', 'units', 'conv']) {
    await p.locator('#' + id).screenshot({ path: path.join(OUT, id + '.png') });
    console.log('diagram', id);
  }
  await b.close();
})();
