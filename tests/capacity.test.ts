import { describe, it, expect } from 'vitest';
import { checkLoad, describeLoad } from '../src/lib/capacity';
import { generateSchedule } from '../src/lib/scheduler';
import { makeSample } from '../src/lib/sample';
import type { Assignment, Building, Group, Settings, SpecialCase, Subject, Teacher } from '../src/types';

const settings: Settings = { days: [0, 1, 2, 3, 4], lunchAfter: 4, periods: Array.from({ length: 7 }, (_, i) => ({ start: `0${8 + i}:00`.slice(-5), end: `0${9 + i}:00`.slice(-5) })) }; // 7 คาบ × 5 วัน = 35
const buildings: Building[] = [{ id: 'b', name: 'A', floors: 2, roomsPerFloor: 9 }];
const T = (id: string, name = id): Teacher => ({ id, name, role: 'main' });
const G = (id: string): Group => ({ id, code: id, name: 'กลุ่ม' + id, major: '' });
const S = (id: string, n: number): Subject => ({ id, code: id, name: 'วิชา' + id, periodsPerWeek: n });
let k = 0;
const A = (subjectId: string, t: string[], g: string[], room = 1, extra: Partial<Assignment> = {}): Assignment => ({
  id: 'a' + k++, subjectId, mainTeacherIds: t, coTeacherIds: [], groupIds: g, room: { buildingId: 'b', floor: 1, no: room }, together: true, ...extra,
});
const base = (o: Partial<Parameters<typeof checkLoad>[0]>) => ({ settings, teachers: [], groups: [], subjects: [], buildings, specialCases: [] as SpecialCase[], assignments: [], ...o });

describe('ตรวจภาระก่อนจัดตาราง (checkLoad)', () => {
  it('ครูสอนเกินช่องว่าง: 45 คาบ จากที่มี 35 ช่อง -> over พร้อมข้อความที่บอกคาบต่อวัน', () => {
    const subjects = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((x) => S(x, 5)); // 9 วิชา × 5 คาบ = 45
    const groups = subjects.map((s) => G('g' + s.id));
    const assignments = subjects.map((s, i) => A(s.id, ['t1'], ['g' + s.id], i + 1));
    const rep = checkLoad(base({ teachers: [T('t1', 'ครูสมชาย')], groups, subjects, assignments }));
    const row = rep.over.find((r) => r.kind === 'teacher')!;
    expect(row).toMatchObject({ name: 'ครูสมชาย', need: 45, available: 35 });
    const text = describeLoad(row, rep);
    expect(text).toContain('ต้องสอน 45 คาบ/สัปดาห์ แต่มีช่องว่างได้ 35 คาบ');
    expect(text).toContain('เกิน 10 คาบ');
    expect(text).toContain('เฉลี่ย 9 คาบ/วัน จากที่มี 7 คาบ/วัน');
    // สอดคล้องกับตัวจัดตารางจริง: จัดไม่ครบแน่นอน
    const out = generateSchedule({ settings, teachers: [T('t1', 'ครูสมชาย')], groups, subjects, buildings, specialCases: [], assignments }, { timeLimitMs: 800, seed: 1 });
    expect(out.unplaced.length).toBeGreaterThan(0);
    expect(out.entries.length).toBeLessThanOrEqual(35);
  });

  it('กรณีพิเศษที่ล็อกเวลาครู ลดช่องว่างของครูคนนั้นเท่านั้น', () => {
    const sp: SpecialCase[] = [{ id: 's', name: 'ประชุม', count: 2, condition: 'วันอังคาร คาบ 6-7', groupIds: [], teacherIds: ['t1'] }];
    const rep = checkLoad(base({ teachers: [T('t1'), T('t2')], groups: [G('g1'), G('g2')], subjects: [S('a', 3), S('b', 3)], specialCases: sp, assignments: [A('a', ['t1'], ['g1']), A('b', ['t2'], ['g2'], 2)] }));
    expect(rep.rows.find((r) => r.id === 't1')!.available).toBe(33);
    expect(rep.rows.find((r) => r.id === 't2')!.available).toBe(35);
    expect(rep.rows.find((r) => r.id === 'g1')!.available).toBe(35); // ไม่ได้เลือกกลุ่ม -> กลุ่มไม่เสียช่อง
  });

  it('กรณีพิเศษทั้งโรงเรียน (ไม่เลือกกลุ่ม/ครู) ลดช่องของทุกคนและทุกห้อง', () => {
    const sp: SpecialCase[] = [{ id: 's', name: 'กิจกรรม', count: 1, condition: 'ทุกวันคาบที่ 1', groupIds: [], teacherIds: [] }];
    const rep = checkLoad(base({ teachers: [T('t1')], groups: [G('g1')], subjects: [S('a', 3)], specialCases: sp, assignments: [A('a', ['t1'], ['g1'])] }));
    expect(rep.rows.filter((r) => r.kind !== 'building').every((r) => r.available === 30)).toBe(true);
  });

  it('เรียนรวมกัน (วิชา+ครู+ห้องเดียวกัน) นับครูครั้งเดียว แต่ "แยกเรียน" นับต่อกลุ่ม', () => {
    const together = checkLoad(base({ teachers: [T('t1')], groups: [G('g1'), G('g2')], subjects: [S('a', 4)], assignments: [A('a', ['t1'], ['g1']), A('a', ['t1'], ['g2'])] }));
    expect(together.rows.find((r) => r.id === 't1')!.need).toBe(4);
    const separate = checkLoad(base({ teachers: [T('t1')], groups: [G('g1'), G('g2')], subjects: [S('a', 4)], assignments: [A('a', ['t1'], ['g1', 'g2'], 1, { together: false })] }));
    expect(separate.rows.find((r) => r.id === 't1')!.need).toBe(8);
  });

  it('กลุ่มเรียนและห้องที่ถูกใช้เกินก็ถูกจับได้ (วิชาเสรีหลายห้อง นับทุกห้อง)', () => {
    const subjects = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((x) => S(x, 5)); // 40 คาบ สำหรับกลุ่มเดียว
    const rep = checkLoad(base({ teachers: subjects.map((s) => T('t' + s.id)), groups: [G('g1')], subjects, assignments: subjects.map((s, i) => A(s.id, ['t' + s.id], ['g1'], i + 1)) }));
    expect(rep.over.map((r) => r.kind)).toEqual(['group']);
    const multi = checkLoad(base({ teachers: [T('t1')], groups: [G('g1')], subjects: [S('a', 3)], assignments: [A('a', ['t1'], ['g1'], 1, { extraRooms: [{ buildingId: 'b', floor: 1, no: 2 }] })] }));
    expect(multi.rows.filter((r) => r.kind === 'room').map((r) => r.need)).toEqual([3, 3]);
  });

  it('ใกล้เต็ม (≥90%) แต่ไม่เกิน -> near ไม่ใช่ over', () => {
    const subjects = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((x) => S(x, 5)); // 35 = 100%
    const rep = checkLoad(base({ teachers: [T('t1')], groups: subjects.map((s) => G('g' + s.id)), subjects, assignments: subjects.map((s, i) => A(s.id, ['t1'], ['g' + s.id], i + 1)) }));
    expect(rep.over).toHaveLength(0);
    expect(rep.near.some((r) => r.kind === 'teacher')).toBe(true);
  });

  it('ข้อมูลตัวอย่างทั้ง 3 ขนาดไม่มีรายการเกิน และไม่มีการตั้งค่า = รายงานว่าง', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      const d: any = makeSample(size);
      expect(checkLoad(d).over, size).toHaveLength(0);
      expect(checkLoad(d).issues.filter((i) => i.level === 'error'), size).toHaveLength(0);
    }
    expect(checkLoad(base({ settings: { days: [], periods: [], lunchAfter: 0 } })).rows).toHaveLength(0);
  });

  it('อาคาร: สรุปภาระรวมเทียบความจุทั้งอาคาร (ใช้ห้อง N จาก M ห้อง)', () => {
    const rep = checkLoad(base({ teachers: [T('t1'), T('t2')], groups: [G('g1'), G('g2')], subjects: [S('a', 3)], assignments: [A('a', ['t1'], ['g1'], 1), A('a', ['t2'], ['g2'], 2)] }));
    const b = rep.rows.find((r) => r.kind === 'building')!;
    expect(b).toMatchObject({ name: 'A', need: 6, available: 18 * 35 });
    expect(b.note).toBe('ใช้ห้อง 2 จาก 18 ห้อง');
  });

  it('เวลาว่างของครูกับกลุ่มเรียนไม่ตรงกัน (แต่ละฝ่ายยังไม่เกินช่องว่างของตัวเอง) -> error ชนิด unit', () => {
    const sp: SpecialCase[] = [
      { id: 's1', name: 'ครูไม่ว่างจันทร์-พฤหัส', count: 1, condition: 'จันทร์-พฤหัส คาบ 1-7', groupIds: [], teacherIds: ['t1'] },
      { id: 's2', name: 'กลุ่มไม่ว่างศุกร์', count: 1, condition: 'ศุกร์ คาบ 1-7', groupIds: ['g1'], teacherIds: [] },
    ];
    const rep = checkLoad(base({ teachers: [T('t1', 'ครูเอ')], groups: [G('g1')], subjects: [S('a', 3)], specialCases: sp, assignments: [A('a', ['t1'], ['g1'])] }));
    expect(rep.over).toHaveLength(0);
    const u = rep.issues.find((i) => i.kind === 'unit')!;
    expect(u.level).toBe('error');
    expect(u.text).toContain('ต้องใช้ 3 คาบ แต่ช่วงเวลาที่ครู (ครูเอ) กับกลุ่มเรียนว่างตรงกันมีเพียง 0 คาบ');
  });

  it('กรณีพิเศษที่อ่านเงื่อนไขไม่ได้ -> error (ระบบจะข้ามตอนจัด)', () => {
    const sp: SpecialCase[] = [{ id: 's', name: 'ชุมนุม', count: 1, condition: 'สวัสดี', groupIds: [], teacherIds: [] }];
    const rep = checkLoad(base({ teachers: [T('t1')], groups: [G('g1')], subjects: [S('a', 3)], specialCases: sp, assignments: [A('a', ['t1'], ['g1'])] }));
    const i = rep.issues.find((x) => x.kind === 'special')!;
    expect(i.level).toBe('error');
    expect(i.text).toContain('กรณีพิเศษ "ชุมนุม"');
  });

  it('ข้อมูลที่ไม่ได้ใช้: กลุ่มเรียน/วิชาที่ไม่มีกำหนดการเป็น warn, ครูที่ไม่มีกำหนดการเป็น info', () => {
    const rep = checkLoad(base({ teachers: [T('t1'), T('t9', 'ครูว่าง')], groups: [G('g1'), G('g2')], subjects: [S('a', 3), S('z', 2)], assignments: [A('a', ['t1'], ['g1'])] }));
    const by = (k: string) => rep.issues.filter((i) => i.kind === k);
    expect(by('unused-group')[0]).toMatchObject({ level: 'warn' });
    expect(by('unused-group')[0].text).toContain('กลุ่มg2');
    expect(by('unused-subject')[0].text).toContain('วิชาz');
    expect(by('unused-teacher')[0]).toMatchObject({ level: 'info' });
    expect(by('unused-teacher')[0].text).toContain('ครูว่าง');
    expect(rep.issues.map((i) => i.level)).toEqual([...rep.issues.map((i) => i.level)].sort((a, b) => ({ error: 0, warn: 1, info: 2 } as any)[a] - ({ error: 0, warn: 1, info: 2 } as any)[b]));
  });
});
