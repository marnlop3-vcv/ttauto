import { describe, it, expect } from 'vitest';
import { makeSample, sampleInfo, SampleSize } from '../src/lib/sample';
import { buildingDef, groupDef, specialDef, subjectDef, teacherDef } from '../src/lib/entities';
import { generateSchedule } from '../src/lib/scheduler';

const SIZES: [SampleSize, number][] = [['small', 2500], ['medium', 7000], ['large', 14000]];

describe('ข้อมูลตัวอย่าง 3 ขนาด', () => {
  it('ขนาดเล็ก < กลาง < ใหญ่', () => {
    const [s, m, l] = SIZES.map(([z]) => sampleInfo(z));
    expect(s.groups).toBeLessThan(m.groups);
    expect(m.groups).toBeLessThan(l.groups);
    expect(s.periods).toBeLessThan(m.periods);
    expect(m.periods).toBeLessThan(l.periods);
  });

  for (const [size, ms] of SIZES) {
    describe(size, () => {
      const d = makeSample(size) as any;
      const ctx = { settings: d.settings, groups: d.groups, teachers: d.teachers };

      it('ทุกแถวผ่านกฎตรวจเดียวกับฟอร์ม/Import และไม่ซ้ำ', () => {
        const check = (def: any, items: any[]) => {
          const keys = new Set<string>();
          for (const it of items) {
            const r = def.fromRow(def.toRow(it, ctx), ctx);
            expect(r.error, `${def.label}: ${JSON.stringify(it)}`).toBeUndefined();
            const k = def.identity(r.value);
            expect(keys.has(k), `ซ้ำ: ${k}`).toBe(false);
            keys.add(k);
          }
        };
        check(teacherDef, d.teachers); check(groupDef, d.groups); check(subjectDef, d.subjects);
        check(buildingDef, d.buildings); check(specialDef, d.specialCases);
      });

      it(`จัดตารางได้ครบ ไม่มีชน (ภายใน ${ms / 1000} วินาที)`, () => {
        const out = generateSchedule(d, { timeLimitMs: ms, seed: 1 });
        expect(out.unplaced, out.unplaced.map((u) => u.reason).join('\n')).toHaveLength(0);
        expect(out.entries).toHaveLength(out.totalUnits);
        // ไม่มีครู(ตามชื่อ)/กลุ่ม/ห้อง ซ้ำช่องเวลาเดียวกัน (กำหนดการที่รวมเรียนกันนับเป็นครั้งเดียว)
        const byA = new Map<string, any>(d.assignments.map((a: any) => [a.id, a]));
        const tname = new Map<string, string>(d.teachers.map((t: any) => [t.id, t.name]));
        const seen = new Map<string, string>();
        for (const e of out.entries) {
          const a = byA.get(e.assignmentId);
          const session = `${a.subjectId}|${[...new Set([...a.mainTeacherIds, ...a.coTeacherIds].map((x: string) => tname.get(x)))].sort()}|${JSON.stringify(a.room)}|${e.day}-${e.period}`;
          const res = [...new Set([...a.mainTeacherIds, ...a.coTeacherIds].map((x: string) => `t:${tname.get(x)}`)), ...e.groupIds.map((g: string) => `g:${g}`), `r:${JSON.stringify(a.room)}`];
          for (const r of res) {
            const k = `${r}|${e.day}-${e.period}`;
            if (seen.has(k)) expect(seen.get(k)).toBe(session); // ซ้ำได้เฉพาะเรียนรวมในเซสชันเดียวกัน
            seen.set(k, session);
          }
        }
        console.log(`${size}: ${out.entries.length}/${out.totalUnits} คาบ, รวมเรียน ${out.merged}, warnings ${out.warnings?.length}, ช่องว่างนักเรียน ${out.quality!.before.groupGaps}->${out.quality!.after.groupGaps}`);
      }, ms + 30000);
    });
  }
});
