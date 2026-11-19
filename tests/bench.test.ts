// วัดประสิทธิภาพกับข้อมูลชุดใหญ่ (ข้ามโดยปริยาย) รัน: BENCH=1 npx vitest run tests/bench.test.ts
import { describe, it } from 'vitest';
import { generateSchedule } from '../src/lib/scheduler';
import type { Assignment, Building, Group, Settings, SpecialCase, Subject, Teacher } from '../src/types';

const settings: Settings = {
  days: [0, 1, 2, 3, 4], lunchAfter: 4,
  periods: Array.from({ length: 8 }, (_, i) => ({ start: `${8 + i}:00`, end: `${9 + i}:00` })),
};

function big(nGroups: number, nTeachers: number) {
  let seed = 7; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const teachers: Teacher[] = Array.from({ length: nTeachers }, (_, i) => ({ id: `t${i}`, name: `ครู${i}`, role: 'main' }));
  const groups: Group[] = Array.from({ length: nGroups }, (_, i) => ({ id: `g${i}`, code: `${i}`, name: `กลุ่ม${i}`, major: '' }));
  const per = [2, 3, 4, 2, 3, 4, 6, 2]; // 26 คาบ/กลุ่ม/สัปดาห์
  const subjects: Subject[] = per.map((n, i) => ({ id: `s${i}`, code: `S${i}`, name: `วิชา${i}`, periodsPerWeek: n }));
  const buildings: Building[] = [{ id: 'b', name: 'A', floors: 4, roomsPerFloor: 10 }];
  const assignments: Assignment[] = [];
  groups.forEach((g, gi) => subjects.forEach((s, si) => assignments.push({
    id: `a${gi}_${si}`, subjectId: s.id, mainTeacherIds: [`t${Math.floor(rnd() * nTeachers)}`], coTeacherIds: [], groupIds: [g.id],
    room: { buildingId: 'b', floor: 1 + (gi % 4), no: 1 + Math.floor(gi / 4) % 10 }, together: true,
  })));
  const specialCases: SpecialCase[] = [{ id: 'sp', name: 'กิจกรรม', count: 1, condition: 'ทุกวันคาบที่ 1', groupIds: [], teacherIds: [] }];
  return { settings, teachers, groups, subjects, buildings, assignments, specialCases };
}

describe.skipIf(!process.env.BENCH)('bench', () => {
  for (const [g, t, ms] of [[12, 14, 5000], [24, 28, 10000]] as const) {
    it(`${g} กลุ่ม ${t} ครู (${ms / 1000}s)`, () => {
      const inp = big(g, t);
      const out = generateSchedule(inp, { timeLimitMs: ms, seed: 3 });
      console.log(`${g} groups/${t} teachers: periods ${out.entries.length}/${out.totalUnits}, unplaced ${out.unplaced.length}, cost ${out.quality!.initial} -> ${out.quality!.final}, gaps(group) ${out.quality!.before.groupGaps} -> ${out.quality!.after.groupGaps}, gaps(teacher) ${out.quality!.before.teacherGaps} -> ${out.quality!.after.teacherGaps}, overload ${out.quality!.before.overload} -> ${out.quality!.after.overload}, iters ${out.quality!.iterations}, ${out.quality!.seconds}s, warnings ${out.warnings?.length}`);
      out.unplaced.forEach((u) => console.log('  unplaced:', u.reason));
    }, ms + 20000);
  }
});
