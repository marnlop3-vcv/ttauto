import { describe, it, expect } from 'vitest';
import { guideSteps, isTabKey, tabKeyToName } from '../src/lib/guide';
import { makeSample } from '../src/lib/sample';
import { generateSchedule } from '../src/lib/scheduler';

const empty: any = {
  settings: { days: [], periods: [], lunchAfter: 0 },
  teachers: [], groups: [], subjects: [], buildings: [], specialCases: [], assignments: [], schedule: null, stale: false,
};

describe('guideSteps (ตัวนำทางเริ่มต้นใช้งาน)', () => {
  it('ผู้ใช้ใหม่: ทุกขั้นยังไม่เสร็จ, ขั้นถัดไปคือตั้งค่าคาบเรียน', () => {
    const g = guideSteps(empty);
    expect(g.isEmpty).toBe(true);
    expect(g.doneCount).toBe(0);
    expect(g.requiredTotal).toBe(4);
    expect(g.allRequiredDone).toBe(false);
    expect(g.current).toBe('settings');
    expect(g.steps.map((s) => s.id)).toEqual(['settings', 'data', 'assign', 'schedule', 'publish']);
  });
  it('ตั้งค่าคาบแล้ว: ขั้น 1 เสร็จ, ขั้นถัดไปคือเพิ่มข้อมูลพื้นฐาน, ไม่ถือว่าว่างแล้ว', () => {
    const g = guideSteps({ ...empty, settings: { days: [0, 1], periods: [{ start: '08:00', end: '09:00' }], lunchAfter: 0 } });
    expect(g.steps[0].done).toBe(true);
    expect(g.current).toBe('data');
    expect(g.isEmpty).toBe(false);
  });
  it('ข้อมูลพื้นฐานไม่ครบ: ขั้น 2 ยังไม่เสร็จ แต่ติ๊กย่อยตามที่มี', () => {
    const g = guideSteps({
      ...empty,
      settings: { days: [0], periods: [{ start: '08:00', end: '09:00' }], lunchAfter: 0 },
      teachers: [{ id: 't', name: 'ก', role: 'main' }], groups: [{ id: 'g', code: '1', name: 'ก', major: '' }],
    });
    const data = g.steps[1];
    expect(data.done).toBe(false);
    expect(data.subs!.map((s) => [s.label, s.done])).toEqual([['ครู', true], ['กลุ่มเรียน', true], ['วิชาเรียน', false], ['ห้องเรียน (อาคาร)', false]]);
    expect(g.current).toBe('data');
  });
  it('ข้อมูลตัวอย่างโหลดแล้ว: ขั้น 1-3 เสร็จ, ขั้นถัดไปคือจัดตาราง', () => {
    const s = makeSample('small') as any;
    const g = guideSteps({ ...empty, ...s, schedule: null, stale: false });
    expect(g.steps.slice(0, 3).every((x) => x.done)).toBe(true);
    expect(g.current).toBe('schedule');
    expect(g.doneCount).toBe(3);
    expect(g.allRequiredDone).toBe(false);
  });
  it('จัดตารางแล้ว: ครบทุกขั้นบังคับ, เผยแพร่เป็นขั้นไม่บังคับและไม่นับ', () => {
    const s = makeSample('small') as any;
    const schedule = generateSchedule(s, { timeLimitMs: 300, seed: 1 });
    const g = guideSteps({ ...empty, ...s, schedule, stale: false });
    expect(g.allRequiredDone).toBe(true);
    expect(g.current).toBeNull();
    expect(g.doneCount).toBe(4);
    expect(g.steps[4].optional).toBe(true);
    expect(g.steps[4].done).toBe(false);
  });
  it('ข้อมูลเปลี่ยนหลังจัดตาราง (stale): ขั้นจัดตารางกลับเป็นยังไม่เสร็จ พร้อมข้อความให้จัดใหม่', () => {
    const s = makeSample('small') as any;
    const schedule = generateSchedule(s, { timeLimitMs: 300, seed: 1 });
    const g = guideSteps({ ...empty, ...s, schedule, stale: true });
    expect(g.steps[3].done).toBe(false);
    expect(g.steps[3].hint).toContain('จัดใหม่');
    expect(g.current).toBe('schedule');
  });
  it('ลิงก์ของแต่ละขั้นชี้แท็บที่มีจริง', () => {
    const g = guideSteps(empty);
    for (const s of [...g.steps, ...g.steps.flatMap((x) => x.subs ?? [])]) {
      const m = s.to.match(/^\/input\?tab=(\w+)$/);
      if (m) expect(isTabKey(m[1]), s.to).toBe(true);
    }
    expect(Object.keys(tabKeyToName)).toHaveLength(7);
    expect(isTabKey('nope')).toBe(false);
    expect(isTabKey(null)).toBe(false);
  });
});
