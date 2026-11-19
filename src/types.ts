export type Role = 'main' | 'co';

export interface Teacher { id: string; name: string; role: Role }
export interface Group { id: string; code: string; name: string; major: string }
export interface Subject { id: string; code: string; name: string; periodsPerWeek: number }
export interface Building { id: string; name: string; floors: number; roomsPerFloor: number }
export interface SpecialCase {
  id: string;
  name: string;
  count: number;          // จำนวนคาบต่อครั้ง (คาบติดกัน)
  condition: string;      // ข้อความที่ผู้ใช้พิมพ์
  groupIds: string[];     // กลุ่มเรียนที่เกี่ยวข้อง
  teacherIds: string[];   // ครูที่เกี่ยวข้อง (ว่างทั้งกลุ่มและครู = ใช้กับทุกคน)
}
export interface RoomRef { buildingId: string; floor: number; no: number }
export interface Assignment {
  id: string;
  subjectId: string;
  mainTeacherIds: string[];
  coTeacherIds: string[];
  groupIds: string[];
  room: RoomRef;
  /** true = กลุ่มเรียนที่เลือก (และกำหนดการอื่นที่ วิชา/ครู/ห้อง เดียวกันที่เลือกเรียนรวมเช่นกัน) เรียนพร้อมกัน; false = แยกเรียนทีละกลุ่ม */
  together: boolean;
}

/** day: 0=จันทร์ ... 6=อาทิตย์ */
export interface Settings {
  days: number[];
  periods: { start: string; end: string }[];
  lunchAfter: number; // 0 = ไม่มีพักเที่ยง, k = พักหลังคาบที่ k
}

export interface Slot { day: number; period: number } // period เริ่มที่ 1

/** 1 รายการ = 1 คาบ ของกำหนดการเรียนหนึ่งๆ สำหรับกลุ่มเรียน groupIds */
export interface PlacedEntry { assignmentId: string; groupIds: string[]; day: number; period: number }
export interface SpecialSlot { caseId: string; name: string; day: number; period: number; groupIds: string[]; teacherIds: string[] }
export interface Unplaced { assignmentId: string; missing: number; reason: string }

/** ตัวชี้วัดความสวย: จำนวนคาบว่างคั่นกลางวัน และคาบที่ครูสอนติดกันเกิน 4 คาบ */
export interface Metrics { groupGaps: number; teacherGaps: number; overload: number }

export interface Schedule {
  entries: PlacedEntry[];
  specials: SpecialSlot[];
  unplaced: Unplaced[];
  totalUnits: number;
  merged?: number;        // จำนวนกำหนดการที่ถูกรวมเรียนพร้อมกัน
  warnings?: string[];    // เช่น วิชาที่จัดติดกันไม่ได้ ต้องแยกคาบ
  quality?: {
    initial: number; final: number;        // คะแนนความไม่สวยรวม (ยิ่งต่ำยิ่งดี)
    iterations: number; seconds: number;
    before: Metrics; after: Metrics;       // ตัวชี้วัดที่อ่านง่าย: ก่อน/หลังปรับให้ดีขึ้น
  };
  createdAt: number;
}

export const DAY_NAMES = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

export const roomLabel = (r: RoomRef) => `${r.floor}${String(r.no).padStart(2, '0')}`;
