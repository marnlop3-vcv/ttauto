// วัดว่า "Greedy ล้วน" วางได้กี่คาบ เทียบกับหลังขั้นซ่อม และผลสุดท้าย -> เพิ่มฟิลด์ greedyOnly ใน results.json
// รัน: npx vite-node docs/presentation/collect-greedy-only.ts   (ปิดขั้นซ่อมชั่วคราวในหน่วยความจำเท่านั้น ไม่แก้ซอร์ส)
import { readFileSync, writeFileSync } from 'node:fs';
import { SchedulerEngine } from '../../src/lib/scheduler';
import { makeSample } from '../../src/lib/sample';

const settings: any = { days: [0, 1, 2, 3, 4], lunchAfter: 4, periods: Array.from({ length: 8 }, (_, i) => ({ start: `${8 + i}:00`, end: `${9 + i}:00` })) };
function tight(nG: number, nT: number, needs: number[]) { // ข้อมูลสังเคราะห์ที่แน่นกว่าตัวอย่าง (ครูสุ่มต่อวิชา) ใช้ทดสอบกรณีหนัก
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const teachers = Array.from({ length: nT }, (_, i) => ({ id: `t${i}`, name: `ครู${i}`, role: 'main' }));
  const groups = Array.from({ length: nG }, (_, i) => ({ id: `g${i}`, code: `${i}`, name: `กลุ่ม${i}`, major: '' }));
  const subjects = needs.map((n, i) => ({ id: `s${i}`, code: `S${i}`, name: `วิชา${i}`, periodsPerWeek: n }));
  const buildings = [{ id: 'b', name: 'A', floors: 4, roomsPerFloor: 10 }];
  const assignments: any[] = [];
  groups.forEach((g, gi) => subjects.forEach((s, si) => assignments.push({ id: `a${gi}_${si}`, subjectId: s.id, mainTeacherIds: [`t${Math.floor(rnd() * nT)}`], coTeacherIds: [], groupIds: [g.id], room: { buildingId: 'b', floor: 1 + (gi % 4), no: 1 + Math.floor(gi / 4) % 10 }, together: true })));
  return { settings, teachers, groups, subjects, buildings, assignments, specialCases: [{ id: 'sp', name: 'กิจกรรม', count: 1, condition: 'ทุกวันคาบที่ 1', groupIds: [], teacherIds: [] }] };
}
const needs = [2, 3, 4, 2, 3, 4, 6, 2];
const cases: [string, string, any, number][] = [
  ['small', 'ตัวอย่างเล็ก', makeSample('small'), 5000], ['medium', 'ตัวอย่างกลาง', makeSample('medium'), 10000], ['large', 'ตัวอย่างใหญ่', makeSample('large'), 20000],
  ['tight12', 'ข้อมูลแน่น 12 กลุ่ม 14 ครู', tight(12, 14, needs), 8000], ['tight24', 'ข้อมูลแน่น 24 กลุ่ม 28 ครู', tight(24, 28, needs), 15000],
];
const realRepair = (SchedulerEngine.prototype as any).repair;
const rows: any[] = [];
for (const [key, label, d, ms] of cases) {
  const input = { ...d, settings: d.settings ?? settings };
  const row: any = { key, label, runs: [] };
  for (const seed of [1, 2]) {
    (SchedulerEngine.prototype as any).repair = function () {};            // Greedy ล้วน
    const g: any = new SchedulerEngine(input, { timeLimitMs: 1000, seed });
    const total = g.pieces.reduce((n: number, p: any) => n + p.size, 0);
    const gOnly = total - g.unplacedSize;
    (SchedulerEngine.prototype as any).repair = realRepair;                 // Greedy + ซ่อม (ก่อนเริ่ม Annealing)
    const r: any = new SchedulerEngine(input, { timeLimitMs: 1000, seed });
    const afterRepair = total - r.unplacedSize;
    const eng: any = new SchedulerEngine(input, { timeLimitMs: ms, seed });  // ผลสุดท้ายทั้งกระบวนการ
    while (!eng.finished) eng.step(100);
    const out = eng.result();
    const fin = out.entries.length;
    row.runs.push({ seed, total, greedyOnly: gOnly, afterRepair, final: fin, finalTotal: out.totalUnits, unplacedFinal: out.unplaced.length });
    console.log(label, 'seed', seed, `Greedy ล้วน ${gOnly}/${total}`, `หลังซ่อม ${afterRepair}/${total}`, `สุดท้าย ${fin}/${out.totalUnits}`);
  }
  rows.push(row);
}
const p = new URL('./results.json', import.meta.url);
const R = JSON.parse(readFileSync(p, 'utf8'));
R.greedyOnly = rows;
writeFileSync(p, JSON.stringify(R, null, 2));
console.log('updated results.json');
