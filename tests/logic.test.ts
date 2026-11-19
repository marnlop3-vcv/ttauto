import { describe, it, expect } from 'vitest';
import { parseCondition } from '../src/lib/thaiRuleParser';
import { generateSchedule as gen0 } from '../src/lib/scheduler';
const generateSchedule = (i: Parameters<typeof gen0>[0], o: Parameters<typeof gen0>[1] = {}) => gen0(i, { timeLimitMs: 500, ...o });
import { teacherDef } from '../src/lib/entities';
import type { Settings, Teacher, Group, Subject, Building, Assignment, SpecialCase } from '../src/types';

const settings: Settings = {
  days: [0, 1, 2, 3, 4],
  periods: Array.from({ length: 8 }, (_, i) => ({ start: `0${8 + i}:00`.slice(-5), end: `0${9 + i}:00`.slice(-5) })),
  lunchAfter: 4,
};

describe('thaiRuleParser', () => {
  it('ทุกวันคาบที่1 -> 5 ช่อง', () => {
    const r = parseCondition('ทุกวันคาบที่1', settings, 1);
    expect(r.ok).toBe(true);
    expect(r.slots).toHaveLength(5);
    expect(r.slots.every((s) => s.period === 1)).toBe(true);
  });
  it('เลขไทยและช่องว่าง', () => {
    const r = parseCondition('ทุกวัน คาบที่ ๑', settings);
    expect(r.slots).toHaveLength(5);
  });
  it('วันพุธ คาบ 7-8', () => {
    const r = parseCondition('วันพุธ คาบ 7-8', settings);
    expect(r.slots).toEqual([{ day: 2, period: 7 }, { day: 2, period: 8 }]);
  });
  it('ช่วงวัน + ช่วงบ่าย', () => {
    const r = parseCondition('จันทร์-พุธ ช่วงบ่าย', settings);
    expect(r.slots).toHaveLength(3 * 4);
  });
  it('คาบสุดท้าย + count', () => {
    const r = parseCondition('วันศุกร์ คาบ 3', settings, 2);
    expect(r.slots.map((s) => s.period)).toEqual([3, 4]);
  });
  it('หลายเงื่อนไขคั่นด้วย ;', () => {
    const r = parseCondition('จันทร์ คาบ 1; พุธ คาบ 3', settings);
    expect(r.slots).toHaveLength(2);
  });
  it('แจ้งผิดเมื่ออ่านไม่ออก / คาบเกิน', () => {
    expect(parseCondition('สวัสดี', settings).ok).toBe(false);
    expect(parseCondition('ทุกวันคาบ 9', settings).ok).toBe(false);
  });
});

function world(n: number) {
  const teachers: Teacher[] = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: `ครู${i}`, role: 'main' }));
  const groups: Group[] = Array.from({ length: n }, (_, i) => ({ id: `g${i}`, code: `G${i}`, name: `กลุ่ม${i}`, major: 'x' }));
  const subjects: Subject[] = Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, code: `S${i}`, name: `วิชา${i}`, periodsPerWeek: 3 }));
  const buildings: Building[] = [{ id: 'b1', name: 'A', floors: 3, roomsPerFloor: 5 }];
  const assignments: Assignment[] = [];
  let k = 0;
  for (let g = 0; g < n; g++)
    for (let s = 0; s < 5; s++)
      assignments.push({
        id: `a${k++}`, subjectId: `s${s}`, mainTeacherIds: [`t${(g + s) % n}`], coTeacherIds: [], groupIds: [`g${g}`],
        room: { buildingId: 'b1', floor: 1 + (g % 3), no: 1 + (g % 5) }, together: true,
      });
  return { teachers, groups, subjects, buildings, assignments };
}

function conflicts(out: ReturnType<typeof generateSchedule>, w: ReturnType<typeof world>) {
  const seen = new Set<string>();
  let bad = 0;
  for (const e of out.entries) {
    const a = w.assignments.find((x) => x.id === e.assignmentId)!;
    const res = [...a.mainTeacherIds, ...a.coTeacherIds, ...a.groupIds, `${a.room.buildingId}${a.room.floor}${a.room.no}`];
    for (const r of res) {
      const k = `${r}|${e.day}|${e.period}`;
      if (seen.has(k)) bad++;
      seen.add(k);
    }
  }
  return bad;
}

describe('scheduler', () => {
  it('ไม่มีครู/กลุ่ม/ห้องชนกัน และวางครบ', () => {
    const w = world(10);
    const out = generateSchedule({ settings, ...w, specialCases: [] }, { seed: 1 });
    expect(conflicts(out, w)).toBe(0);
    expect(out.unplaced).toHaveLength(0);
    expect(out.entries).toHaveLength(out.totalUnits);
  });
  it('กรณีพิเศษถูกวางก่อนและไม่ถูกทับ', () => {
    const w = world(6);
    const sp: SpecialCase[] = [{ id: 'sp1', name: 'กิจกรรม', count: 1, condition: 'ทุกวันคาบที่1', groupIds: [], teacherIds: [] }];
    const out = generateSchedule({ settings, ...w, specialCases: sp }, { seed: 2 });
    expect(out.specials).toHaveLength(5);
    expect(out.entries.some((e) => e.period === 1)).toBe(false);
    expect(conflicts(out, w)).toBe(0);
  });
  it('รายงานรายการที่จัดไม่ได้เมื่อข้อมูลขัดแย้ง', () => {
    const w = world(1);
    // วิชา 5 วิชา x 3 = 15 คาบ ใส่ครูคนเดียวเรียนห้องเดียว แต่ล็อกช่องเกือบทั้งหมด
    const sp: SpecialCase[] = [{ id: 'sp', name: 'ปิด', count: 1, condition: 'ทุกวัน ช่วงบ่าย; ทุกวัน คาบที่ 1-3', groupIds: [], teacherIds: [] }];
    const out = generateSchedule({ settings, ...w, specialCases: sp }, { seed: 3, timeLimitMs: 300 });
    expect(out.unplaced.length).toBeGreaterThan(0);
    expect(out.unplaced[0].reason).toContain('วิชา');
  });
  it('ครูสอนร่วมไม่ชนกับครูหลักของวิชาอื่น', () => {
    const w = world(4);
    w.assignments[0].coTeacherIds = ['t1'];
    const out = generateSchedule({ settings, ...w, specialCases: [] }, { seed: 4 });
    expect(conflicts(out, w)).toBe(0);
  });
});

const mini = (periodsPerWeek: number, extra: Partial<Assignment> = {}) => {
  const teachers: Teacher[] = [{ id: 't1', name: 'ครูเอ', role: 'main' }];
  const groups: Group[] = [{ id: 'g1', code: '1', name: 'ก', major: '' }, { id: 'g2', code: '2', name: 'ข', major: '' }];
  const subjects: Subject[] = [{ id: 's1', code: 'S', name: 'วิชา', periodsPerWeek }];
  const buildings: Building[] = [{ id: 'b1', name: 'A', floors: 1, roomsPerFloor: 3 }];
  const assignments: Assignment[] = [{
    id: 'a1', subjectId: 's1', mainTeacherIds: ['t1'], coTeacherIds: [], groupIds: ['g1'],
    room: { buildingId: 'b1', floor: 1, no: 1 }, together: true, ...extra,
  }];
  return { teachers, groups, subjects, buildings, assignments };
};

describe('ข้อ 1: ครูชื่อเดียวกันคนละหน้าที่', () => {
  it('identity ต่างกันเมื่อหน้าที่ต่างกัน แต่ซ้ำเมื่อหน้าที่เดียวกัน', () => {
    const a = teacherDef.identity({ name: 'สมศรี', role: 'main' });
    expect(a).not.toBe(teacherDef.identity({ name: 'สมศรี', role: 'co' }));
    expect(a).toBe(teacherDef.identity({ name: 'สมศรี', role: 'main' }));
  });
  it('ถือเป็นคนเดียวกัน: ไม่ถูกจัดสอนชนกันเมื่ออยู่คนละ id', () => {
    const w = mini(3);
    w.teachers.push({ id: 't2', name: 'ครูเอ', role: 'co' }); // ชื่อเดียวกัน คนละหน้าที่
    w.assignments.push({ id: 'a2', subjectId: 's1', mainTeacherIds: [], coTeacherIds: ['t2'], groupIds: ['g2'], room: { buildingId: 'b1', floor: 1, no: 2 }, together: true });
    w.assignments[1].mainTeacherIds = ['t1']; // ต้องมีครูหลัก (ห้ามชนกับ a1)
    w.assignments[1].coTeacherIds = ['t2'];
    const out = generateSchedule({ settings, ...w, specialCases: [] }, { seed: 5 });
    const slots = out.entries.map((e) => `${e.day}-${e.period}`);
    expect(new Set(slots).size).toBe(slots.length); // ไม่มีช่องซ้ำ
  });
});

describe('ข้อ 2: กรณีพิเศษเฉพาะครู/กลุ่ม', () => {
  it('บล็อกเฉพาะครูที่เลือก (ครูประชุมทุกวันอังคาร คาบ 1-2)', () => {
    const w = mini(10);
    const sp: SpecialCase[] = [{ id: 'sp', name: 'ประชุม', count: 1, condition: 'วันอังคาร คาบ 1-2', groupIds: [], teacherIds: ['t1'] }];
    const out = generateSchedule({ settings, ...w, specialCases: sp }, { seed: 1 });
    expect(out.entries.some((e) => e.day === 1 && (e.period === 1 || e.period === 2))).toBe(false);
    expect(out.specials).toHaveLength(2);
    expect(out.specials[0].teacherIds).toEqual(['t1']);
  });
  it('ไม่กระทบครูอื่น', () => {
    const w = mini(3);
    w.teachers.push({ id: 't9', name: 'ครูบี', role: 'main' });
    w.assignments[0].mainTeacherIds = ['t9'];
    const sp: SpecialCase[] = [{ id: 'sp', name: 'ประชุม', count: 1, condition: 'ทุกวันคาบที่ 1', groupIds: [], teacherIds: ['t1'] }];
    const out = generateSchedule({ settings, ...w, specialCases: sp }, { seed: 1 });
    expect(out.unplaced).toHaveLength(0);
  });
});

describe('วิชาไม่เกิน 4 คาบ = ช่วงเดียวติดกัน (ไม่ข้ามพักเที่ยง)', () => {
  const contiguous = (out: ReturnType<typeof generateSchedule>) => {
    const ps = out.entries.map((e) => e.period).sort((a, b) => a - b);
    const days = new Set(out.entries.map((e) => e.day));
    if (days.size !== 1) return false;
    for (let i = 1; i < ps.length; i++) if (ps[i] !== ps[i - 1] + 1) return false;
    return !(settings.lunchAfter > 0 && ps[0] <= settings.lunchAfter && ps[ps.length - 1] > settings.lunchAfter);
  };
  for (const n of [2, 3, 4]) {
    it(`วิชา ${n} คาบ -> ช่วงเดียวติดกัน`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const out = generateSchedule({ settings, ...mini(n), specialCases: [] }, { seed, timeLimitMs: 150 });
        expect(out.entries).toHaveLength(n);
        expect(contiguous(out)).toBe(true);
      }
    });
  }
  it('หลายวิชาในกลุ่มเดียวกัน ทุกวิชา (≤4 คาบ) เป็นช่วงติดกัน', () => {
    const w = world(4);
    const out = generateSchedule({ settings, ...w, specialCases: [] }, { seed: 7 });
    expect(out.unplaced).toHaveLength(0);
    for (const a of w.assignments) {
      const es = out.entries.filter((e) => e.assignmentId === a.id);
      expect(new Set(es.map((e) => e.day)).size).toBe(1);
      const ps = es.map((e) => e.period).sort((x, y) => x - y);
      for (let i = 1; i < ps.length; i++) expect(ps[i]).toBe(ps[i - 1] + 1);
      expect(settings.lunchAfter > 0 && ps[0] <= settings.lunchAfter && ps[ps.length - 1] > settings.lunchAfter).toBe(false);
    }
  });
  it('วิชา 6 คาบ -> กระจาย ไม่เกิน 2 คาบต่อวัน', () => {
    const out = generateSchedule({ settings, ...mini(6), specialCases: [] }, { seed: 3 });
    const cnt = new Map<number, number>();
    out.entries.forEach((e) => cnt.set(e.day, (cnt.get(e.day) ?? 0) + 1));
    expect(out.entries).toHaveLength(6);
    expect(Math.max(...cnt.values())).toBeLessThanOrEqual(2);
  });
  it('ถ้าติดกันไม่ได้จริง (ช่วงว่างติดกันไม่พอ) -> แยกช่วงและแจ้งเตือน', () => {
    const w = mini(4);
    // ล็อกคาบ 3 และ 7 ทุกวัน -> ไม่มีช่วงว่างติดกัน 4 คาบเหลือ (เหลือแค่ 1-2, 4, 5-6, 8)
    const sp: SpecialCase[] = [{ id: 'sp', name: 'ปิด', count: 1, condition: 'ทุกวัน คาบที่ 3; ทุกวัน คาบที่ 7', groupIds: [], teacherIds: [] }];
    const out = generateSchedule({ settings, ...w, specialCases: sp }, { seed: 1, timeLimitMs: 1200 });
    expect(out.entries).toHaveLength(4);
    expect(out.unplaced).toHaveLength(0);
    expect((out.warnings ?? []).join(' ')).toContain('แยกเป็นช่วง');
  });
});

describe('Simulated Annealing ลดคะแนนความไม่สวยลง', () => {
  it('คะแนนสุดท้าย <= คะแนนเริ่มต้น และไม่มีชน', () => {
    const w = world(8);
    const out = generateSchedule({ settings, ...w, specialCases: [] }, { seed: 11, timeLimitMs: 1500 });
    expect(out.quality!.final).toBeLessThanOrEqual(out.quality!.initial);
    expect(out.quality!.iterations).toBeGreaterThan(1000);
    expect(conflicts(out, w)).toBe(0);
    expect(out.unplaced).toHaveLength(0);
  });
  it('ข้อมูลแน่น: ซ่อมแซมแล้วยังวางครบและไม่ชน', () => {
    // 6 กลุ่ม x 5 วิชา x 3 คาบ = 90 คาบ บนตาราง 40 ช่อง/กลุ่ม (กลุ่มละ 15 คาบ) ครูหมุนเวียน 6 คน
    const w = world(6);
    const out = generateSchedule({ settings, ...w, specialCases: [{ id: 's', name: 'กิจกรรม', count: 1, condition: 'ทุกวันคาบที่ 1', groupIds: [], teacherIds: [] }] }, { seed: 5, timeLimitMs: 1500 });
    expect(out.unplaced).toHaveLength(0);
    expect(conflicts(out, w)).toBe(0);
  });
});

describe('เลือกเรียนรวม/แยกที่กำหนดการเรียน', () => {
  const two = (t1 = true, t2 = true) => {
    const w = mini(3);
    w.assignments[0].together = t1;
    w.assignments.push({ id: 'a2', subjectId: 's1', mainTeacherIds: ['t1'], coTeacherIds: [], groupIds: ['g2'], room: { buildingId: 'b1', floor: 1, no: 1 }, together: t2 });
    return w;
  };
  const slotsOf = (out: ReturnType<typeof generateSchedule>, id: string) => out.entries.filter((e) => e.assignmentId === id).map((e) => `${e.day}-${e.period}`).sort();

  it('ทั้งคู่เลือกเรียนรวม + วิชา/ครู/ห้องเดียวกัน -> เวลาเดียวกัน', () => {
    const out = generateSchedule({ settings, ...two(), specialCases: [] }, { seed: 2 });
    expect(slotsOf(out, 'a1')).toHaveLength(3);
    expect(slotsOf(out, 'a1')).toEqual(slotsOf(out, 'a2'));
    expect(out.merged).toBe(1);
    expect(out.unplaced).toHaveLength(0);
  });
  it('คนใดคนหนึ่งเลือกแยกเรียน -> ไม่รวม จัดคนละเวลา', () => {
    const out = generateSchedule({ settings, ...two(true, false), specialCases: [] }, { seed: 2 });
    const all = out.entries.map((e) => `${e.day}-${e.period}`);
    expect(new Set(all).size).toBe(6);
    expect(out.merged).toBe(0);
  });
  it('1 กำหนดการ 2 กลุ่ม + เรียนรวม -> เวลาเดียวกัน และ entry มี groupIds ครบ', () => {
    const w = mini(2);
    w.assignments[0].groupIds = ['g1', 'g2'];
    const out = generateSchedule({ settings, ...w, specialCases: [] }, { seed: 2 });
    expect(out.entries).toHaveLength(2);
    expect(out.entries.every((e) => e.groupIds.length === 2)).toBe(true);
  });
  it('1 กำหนดการ 2 กลุ่ม + แยกเรียน -> คนละเวลา แต่ละ entry มีกลุ่มเดียว', () => {
    const w = mini(2);
    w.assignments[0].groupIds = ['g1', 'g2'];
    w.assignments[0].together = false;
    const out = generateSchedule({ settings, ...w, specialCases: [] }, { seed: 2 });
    expect(out.entries).toHaveLength(4);
    expect(out.entries.every((e) => e.groupIds.length === 1)).toBe(true);
    const bySlot = new Set(out.entries.map((e) => `${e.day}-${e.period}`));
    expect(bySlot.size).toBe(4); // ครู/ห้องเดียวกัน ห้ามซ้อน
    for (const g of ['g1', 'g2']) {
      const ps = out.entries.filter((e) => e.groupIds[0] === g).map((e) => e.period).sort((a, b) => a - b);
      expect(ps[1] - ps[0]).toBe(1); // แต่ละกลุ่มเรียน 2 คาบติดกัน
    }
  });
  it('ห้องต่างกัน -> ไม่รวม', () => {
    const w = two();
    w.assignments[1].room = { buildingId: 'b1', floor: 1, no: 2 };
    const out = generateSchedule({ settings, ...w, specialCases: [] }, { seed: 2 });
    expect(out.merged).toBe(0);
  });
});
