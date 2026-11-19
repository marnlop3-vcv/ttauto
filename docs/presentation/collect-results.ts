// เก็บตัวเลขจริงจากเอนจินจัดตาราง สำหรับสไลด์/รายงาน -> docs/presentation/results.json
// รัน: npx vite-node docs/presentation/collect-results.ts
import { writeFileSync } from 'node:fs';
import { SchedulerEngine, WEIGHTS } from '../../src/lib/scheduler';
import { makeSample, sampleInfo, SampleSize } from '../../src/lib/sample';
import os from 'node:os';

const LIMITS: Record<SampleSize, number> = { small: 5000, medium: 10000, large: 20000 };
const SEEDS = [1, 2];

function countConflicts(d: any, out: any): number {
  const byA = new Map<string, any>(d.assignments.map((a: any) => [a.id, a]));
  const tname = new Map<string, string>(d.teachers.map((t: any) => [t.id, t.name]));
  const seen = new Map<string, string>();
  let bad = 0;
  for (const e of out.entries) {
    const a = byA.get(e.assignmentId);
    const names = [...new Set([...a.mainTeacherIds, ...a.coTeacherIds].map((x: string) => tname.get(x)))];
    const session = `${a.subjectId}|${[...names].sort()}|${JSON.stringify(a.room)}|${e.day}-${e.period}`;
    const res = [...names.map((n) => `t:${n}`), ...e.groupIds.map((g: string) => `g:${g}`), `r:${JSON.stringify(a.room)}`];
    for (const r of res) {
      const k = `${r}|${e.day}-${e.period}`;
      if (seen.has(k) && seen.get(k) !== session) bad++;
      seen.set(k, session);
    }
  }
  // ช่องกรณีพิเศษทับกับคาบเรียน (ครู/กลุ่มที่เกี่ยวข้อง)
  const occ = new Set<string>();
  for (const e of out.entries) {
    const a = byA.get(e.assignmentId);
    for (const g of e.groupIds) occ.add(`g:${g}|${e.day}-${e.period}`);
    for (const t of new Set([...a.mainTeacherIds, ...a.coTeacherIds].map((x: string) => tname.get(x)))) occ.add(`t:${t}|${e.day}-${e.period}`);
  }
  for (const s of out.specials) {
    for (const g of s.groupIds) if (occ.has(`g:${g}|${s.day}-${s.period}`)) bad++;
    for (const t of s.teacherIds) if (occ.has(`t:${tname.get(t)}|${s.day}-${s.period}`)) bad++;
  }
  return bad;
}

const runs: any[] = [];
for (const size of ['small', 'medium', 'large'] as SampleSize[]) {
  const info = sampleInfo(size);
  for (const seed of SEEDS) {
    const d: any = makeSample(size);
    const eng = new SchedulerEngine(d, { timeLimitMs: LIMITS[size], seed });
    const t0 = performance.now();
    let firstComplete: number | null = null;
    const curve: { t: number; cost: number; unplaced: number }[] = [];
    let lastSample = -1;
    while (!eng.finished) {
      eng.step(25);
      const p = eng.progress();
      const t = (performance.now() - t0) / 1000;
      if (firstComplete === null && p.unplacedPeriods === 0) firstComplete = t;
      if (t - lastSample >= LIMITS[size] / 1000 / 25) { curve.push({ t: +t.toFixed(2), cost: +p.bestCost.toFixed(1), unplaced: p.unplacedPeriods }); lastSample = t; }
    }
    const out = eng.result();
    const total = (performance.now() - t0) / 1000;
    const q = out.quality!;
    const r = {
      size, seed, groups: info.groups, subjects: info.subjects, teachers: info.teachers, buildings: info.buildings, periodsTotal: info.periods,
      limitSec: LIMITS[size] / 1000, placed: out.entries.length, totalUnits: out.totalUnits, unplaced: out.unplaced.length, merged: out.merged ?? 0,
      conflicts: countConflicts(d, out), warnings: out.warnings?.length ?? 0, specials: out.specials.length,
      firstCompleteSec: firstComplete === null ? null : +firstComplete.toFixed(2), totalSec: +total.toFixed(2), iterations: q.iterations,
      cost: { initial: q.initial, final: q.final }, before: q.before, after: q.after, curve,
    };
    runs.push(r);
    console.log(size, seed, `${r.placed}/${r.totalUnits}`, 'conf', r.conflicts, 'first', r.firstCompleteSec, 'total', r.totalSec, 'gaps', JSON.stringify(q.before), '->', JSON.stringify(q.after), 'cost', q.initial, '->', q.final);
  }
}
writeFileSync(new URL('./results.json', import.meta.url), JSON.stringify({
  generatedAt: new Date().toISOString(), machine: { cpus: os.cpus().length, model: os.cpus()[0]?.model }, node: process.version,
  weights: WEIGHTS, anneal: { t0: 2.0, t1: 0.03, moves: { relocate: 0.45, shift: 0.30, swap: 0.25 } }, runs,
}, null, 2));
console.log('wrote results.json');
