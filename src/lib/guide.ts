import type { DataState } from '../store';

/** ตรรกะของการ์ด "เริ่มต้นใช้งาน": คำนวณว่าแต่ละขั้นเสร็จหรือยัง จากข้อมูลในระบบ (ฟังก์ชันบริสุทธิ์ ทดสอบง่าย) */

export type GuideStepId = 'settings' | 'data' | 'assign' | 'schedule' | 'publish';

export interface GuideSub { label: string; done: boolean; to: string }
export interface GuideStep {
  id: GuideStepId;
  no: number;
  title: string;
  hint: string;
  done: boolean;
  optional?: boolean;
  to: string;          // ที่อยู่ภายในแอป (hash route)
  toLabel: string;
  subs?: GuideSub[];
}
export interface GuideState {
  steps: GuideStep[];
  required: GuideStep[];
  doneCount: number;
  requiredTotal: number;
  allRequiredDone: boolean;
  isEmpty: boolean;                 // ยังไม่มีข้อมูลอะไรเลย (ผู้ใช้ใหม่)
  current: GuideStepId | null;      // ขั้นที่ควรทำถัดไป
}

type Input = Pick<DataState, 'settings' | 'teachers' | 'groups' | 'subjects' | 'buildings' | 'specialCases' | 'assignments' | 'schedule' | 'stale'>;

export function guideSteps(d: Input): GuideState {
  const settingsDone = d.settings.days.length > 0 && d.settings.periods.length > 0;
  const subs: GuideSub[] = [
    { label: 'ครู', done: d.teachers.length > 0, to: '/input?tab=teachers' },
    { label: 'กลุ่มเรียน', done: d.groups.length > 0, to: '/input?tab=groups' },
    { label: 'วิชาเรียน', done: d.subjects.length > 0, to: '/input?tab=subjects' },
    { label: 'ห้องเรียน (อาคาร)', done: d.buildings.length > 0, to: '/input?tab=buildings' },
  ];
  const dataDone = subs.every((s) => s.done);
  const assignDone = d.assignments.length > 0;
  const scheduleDone = !!d.schedule && !d.stale;

  const steps: GuideStep[] = [
    {
      id: 'settings', no: 1, title: 'ตั้งค่าคาบเรียน', done: settingsDone,
      hint: 'เลือกวันที่เปิดสอน จำนวนคาบต่อวัน และเวลาของแต่ละคาบ',
      to: '/input?tab=settings', toLabel: 'ไปตั้งค่า',
    },
    {
      id: 'data', no: 2, title: 'เพิ่มข้อมูลพื้นฐาน', done: dataDone, subs,
      hint: 'ครู กลุ่มเรียน วิชา และห้องเรียน (พิมพ์เอง หรือนำเข้าจากไฟล์ Excel ก็ได้) กรณีพิเศษ เช่น คาบกิจกรรม เพิ่มทีหลังได้',
      to: '/input?tab=teachers', toLabel: 'ไปเพิ่มข้อมูล',
    },
    {
      id: 'assign', no: 3, title: 'กำหนดการเรียน', done: assignDone,
      hint: 'บอกว่า วิชาไหน ใครสอน กลุ่มไหนเรียน อยู่ห้องไหน (ทำให้ครบทุกวิชาของทุกกลุ่ม)',
      to: '/input?tab=assignments', toLabel: 'ไปกำหนดการเรียน',
    },
    {
      id: 'schedule', no: 4, title: 'จัดตารางอัตโนมัติ', done: scheduleDone,
      hint: d.schedule && d.stale ? 'ข้อมูลเปลี่ยนหลังจัดตารางล่าสุด กดจัดใหม่' : 'กดปุ่ม "จัดตารางอัตโนมัติ" แล้วรอสักครู่',
      to: '/', toLabel: 'จัดตารางเลย',
    },
    {
      id: 'publish', no: 5, title: 'เผยแพร่ให้นักเรียนและครู (ไม่บังคับ)', done: false, optional: true,
      hint: 'ตั้งรหัสแล้วสร้างไฟล์ตารางให้นักเรียนและครูดู (ดูอย่างเดียว)',
      to: '/publish', toLabel: 'ไปเผยแพร่',
    },
  ];

  const required = steps.filter((s) => !s.optional);
  const first = required.find((s) => !s.done);
  const isEmpty = !settingsDone && !subs.some((s) => s.done) && !assignDone && !d.schedule && d.specialCases.length === 0;
  return {
    steps,
    required,
    doneCount: required.filter((s) => s.done).length,
    requiredTotal: required.length,
    allRequiredDone: !first,
    isEmpty,
    current: first ? first.id : null,
  };
}

export const tabKeyToName = {
  settings: 'ตั้งค่าคาบเรียน', teachers: 'ครู', groups: 'กลุ่มเรียน', subjects: 'วิชาเรียน',
  buildings: 'ห้องเรียน', special: 'กรณีพิเศษ', assignments: 'กำหนดการเรียน',
} as const;
export type TabKey = keyof typeof tabKeyToName;
export const isTabKey = (k: string | null): k is TabKey => !!k && k in tabKeyToName;
