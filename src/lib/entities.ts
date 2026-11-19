import { Building, Group, Role, Settings, SpecialCase, Subject, Teacher } from '../types';
import { describeSlots, parseCondition } from './thaiRuleParser';

export type EntityKind = 'teachers' | 'groups' | 'subjects' | 'buildings' | 'specialCases';

export interface Ctx { settings: Settings; groups: Group[]; teachers: Teacher[] }
export interface RowResult<T> { value?: Omit<T, 'id'>; error?: string }

export interface EntityDef<T> {
  kind: EntityKind;
  label: string;          // ชื่อภาษาไทย เช่น "ครู"
  sheetName: string;
  headers: string[];
  example: string[][];
  notes: string[];
  /** ชื่อคีย์ภาษาอังกฤษที่ยอมรับ (ไฟล์ CSV/JSON) ของแต่ละคอลัมน์ ตามลำดับเดียวกับ headers */
  aliases: string[][];
  fromRow(row: string[], ctx: Ctx): RowResult<T>;
  /** แปลงข้อมูลในระบบกลับเป็นแถวข้อความ (ใช้สร้างไฟล์ตัวอย่าง/ส่งออก) */
  toRow(item: Omit<T, 'id'>, ctx: Ctx): string[];
  identity(v: Omit<T, 'id'>): string;
}

const s = (v: unknown) => String(v ?? '').trim();
const posInt = (v: string) => (/^\d+$/.test(v) && +v > 0 ? +v : NaN);

export const roleLabel = (r: Role) => (r === 'main' ? 'ครูสอนหลัก' : 'ครูสอนร่วม');

export const teacherDef: EntityDef<Teacher> = {
  kind: 'teachers', label: 'ครู', sheetName: 'ครู',
  headers: ['ชื่อครู', 'หน้าที่ (ครูสอนหลัก/ครูสอนร่วม)'],
  example: [['นางสมศรี ใจดี', 'ครูสอนหลัก'], ['นายสมชาย รักเรียน', 'ครูสอนร่วม']],
  notes: ['หน้าที่ ให้ใส่ "ครูสอนหลัก" หรือ "ครูสอนร่วม" เท่านั้น', 'ชื่อเดียวกันเพิ่มได้ถ้าคนละหน้าที่ (ระบบถือเป็นครูคนเดียวกัน ไม่จัดให้สอนชนกัน) แต่ชื่อเดียวกันและหน้าที่เดียวกันห้ามซ้ำ'],
  aliases: [['name', 'teacher', 'ชื่อ'], ['role', 'position', 'หน้าที่']],
  toRow: (v) => [v.name, roleLabel(v.role)],
  fromRow(row) {
    const name = s(row[0]);
    const r = s(row[1]);
    if (!name) return { error: 'ไม่ได้ระบุชื่อครู' };
    let role: Role | null = null;
    if (/หลัก|^main$/i.test(r)) role = 'main';
    else if (/ร่วม|^co$/i.test(r)) role = 'co';
    if (!role) return { error: `หน้าที่ "${r}" ไม่ถูกต้อง (ต้องเป็น ครูสอนหลัก หรือ ครูสอนร่วม)` };
    return { value: { name, role } };
  },
  identity: (v) => `${v.name} (${roleLabel(v.role)})`,
};

export const groupDef: EntityDef<Group> = {
  kind: 'groups', label: 'กลุ่มเรียน', sheetName: 'กลุ่มเรียน',
  headers: ['รหัสกลุ่มเรียน', 'ชื่อกลุ่มเรียน', 'สาขาวิชา'],
  example: [['6701', 'ปวช.1/1', 'การบัญชี'], ['6702', 'ปวช.1/2', 'การตลาด']],
  notes: ['รหัสกลุ่มเรียนห้ามซ้ำกัน'],
  aliases: [['code', 'id', 'รหัส'], ['name', 'ชื่อ'], ['major', 'department', 'สาขา']],
  toRow: (v) => [v.code, v.name, v.major],
  fromRow(row) {
    const code = s(row[0]), name = s(row[1]), major = s(row[2]);
    if (!code) return { error: 'ไม่ได้ระบุรหัสกลุ่มเรียน' };
    if (!name) return { error: 'ไม่ได้ระบุชื่อกลุ่มเรียน' };
    return { value: { code, name, major } };
  },
  identity: (v) => v.code,
};

export const subjectDef: EntityDef<Subject> = {
  kind: 'subjects', label: 'วิชาเรียน', sheetName: 'วิชาเรียน',
  headers: ['รหัสวิชา', 'ชื่อวิชา', 'จำนวนคาบต่อสัปดาห์'],
  example: [['20001-1001', 'ภาษาไทยพื้นฐาน', '2'], ['30100-1002', 'การบัญชีเบื้องต้น', '4']],
  notes: ['จำนวนคาบต่อสัปดาห์ ต้องเป็นจำนวนเต็มบวก', 'รหัสวิชาห้ามซ้ำกัน'],
  aliases: [['code', 'id', 'รหัส'], ['name', 'ชื่อ'], ['periodsPerWeek', 'periods', 'hoursPerWeek', 'คาบ']],
  toRow: (v) => [v.code, v.name, String(v.periodsPerWeek)],
  fromRow(row) {
    const code = s(row[0]), name = s(row[1]);
    const n = posInt(s(row[2]));
    if (!code) return { error: 'ไม่ได้ระบุรหัสวิชา' };
    if (!name) return { error: 'ไม่ได้ระบุชื่อวิชา' };
    if (isNaN(n)) return { error: `จำนวนคาบต่อสัปดาห์ "${s(row[2])}" ไม่ถูกต้อง (ต้องเป็นจำนวนเต็มบวก)` };
    return { value: { code, name, periodsPerWeek: n } };
  },
  identity: (v) => v.code,
};

export const buildingDef: EntityDef<Building> = {
  kind: 'buildings', label: 'อาคาร', sheetName: 'อาคาร',
  headers: ['ชื่ออาคาร', 'จำนวนชั้น', 'จำนวนห้อง (ต่อชั้น)'],
  example: [['อาคาร 1', '3', '6'], ['อาคารช่างยนต์', '2', '4']],
  notes: ['จำนวนห้อง = จำนวนห้องต่อ 1 ชั้น ระบบจะสร้างห้องให้อัตโนมัติ เช่น อาคาร 1 ชั้น 1 ห้อง 1 = ห้อง 101', 'ชื่ออาคารห้ามซ้ำกัน'],
  aliases: [['name', 'building', 'ชื่อ'], ['floors', 'floor', 'จำนวนชั้น'], ['roomsPerFloor', 'rooms', 'จำนวนห้อง']],
  toRow: (v) => [v.name, String(v.floors), String(v.roomsPerFloor)],
  fromRow(row) {
    const name = s(row[0]);
    const floors = posInt(s(row[1])), rooms = posInt(s(row[2]));
    if (!name) return { error: 'ไม่ได้ระบุชื่ออาคาร' };
    if (isNaN(floors)) return { error: `จำนวนชั้น "${s(row[1])}" ไม่ถูกต้อง` };
    if (isNaN(rooms)) return { error: `จำนวนห้อง "${s(row[2])}" ไม่ถูกต้อง` };
    if (rooms > 99) return { error: 'จำนวนห้องต่อชั้นต้องไม่เกิน 99' };
    return { value: { name, floors, roomsPerFloor: rooms } };
  },
  identity: (v) => v.name,
};

export const specialDef: EntityDef<SpecialCase> = {
  kind: 'specialCases', label: 'กรณีพิเศษ', sheetName: 'กรณีพิเศษ',
  headers: ['ชื่อกรณีพิเศษ', 'จำนวนคาบ', 'เงื่อนไข', 'รหัสกลุ่มเรียนที่เกี่ยวข้อง (คั่นด้วย ,)', 'ชื่อครูที่เกี่ยวข้อง (คั่นด้วย ,)'],
  example: [['คาบกิจกรรม', '1', 'ทุกวันคาบที่ 1', '', ''], ['ชุมนุม', '2', 'วันพุธ คาบ 7', '6701,6702', ''], ['ประชุมครู', '2', 'วันอังคาร คาบ 1-2', '', 'นางสมศรี ใจดี']],
  notes: [
    'เงื่อนไขพิมพ์เป็นภาษาไทยได้ เช่น "ทุกวันคาบที่ 1", "วันพุธ คาบ 7-8", "จันทร์-ศุกร์ คาบสุดท้าย", "วันศุกร์ ช่วงบ่าย"',
    'ใส่หลายเงื่อนไขได้โดยคั่นด้วย ; เช่น "จันทร์ คาบ 1; พุธ คาบ 3"',
    'จำนวนคาบ = จำนวนคาบต่อเนื่องต่อครั้ง (ถ้าเงื่อนไขระบุคาบเริ่มต้นคาบเดียว)',
    'คอลัมน์กลุ่มเรียน/ครู: เว้นว่างทั้งสองคอลัมน์ = ใช้กับทุกกลุ่มเรียนและทุกครู; ถ้าระบุ จะใช้เฉพาะกลุ่ม/ครูที่ระบุ (ใส่ทั้งสองได้)',
  ],
  aliases: [['name', 'ชื่อ'], ['count', 'periods', 'จำนวนคาบ'], ['condition', 'rule', 'เงื่อนไข'], ['groups', 'groupCodes', 'กลุ่มเรียน'], ['teachers', 'teacherNames', 'ครู']],
  toRow: (v, ctx) => [v.name, String(v.count), v.condition, v.groupIds.map((g) => ctx.groups.find((x) => x.id === g)?.code ?? '').filter(Boolean).join(','), [...new Set((v.teacherIds ?? []).map((t) => ctx.teachers.find((x) => x.id === t)?.name ?? '').filter(Boolean))].join(',')],
  fromRow(row, ctx) {
    const name = s(row[0]);
    const count = posInt(s(row[1]));
    const condition = s(row[2]);
    if (!name) return { error: 'ไม่ได้ระบุชื่อกรณีพิเศษ' };
    if (isNaN(count)) return { error: `จำนวนคาบ "${s(row[1])}" ไม่ถูกต้อง` };
    const parsed = parseCondition(condition, ctx.settings, count);
    if (!parsed.ok) return { error: parsed.error };
    const codes = s(row[3]).split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    const groupIds: string[] = [];
    for (const c of codes) {
      const g = ctx.groups.find((x) => x.code === c || x.name === c);
      if (!g) return { error: `ไม่พบกลุ่มเรียน "${c}" ในระบบ (กรุณาเพิ่มกลุ่มเรียนก่อน)` };
      groupIds.push(g.id);
    }
    const tnames = s(row[4]).split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    const teacherIds: string[] = [];
    for (const n of tnames) {
      const found = ctx.teachers.filter((x) => x.name === n);
      if (!found.length) return { error: `ไม่พบครู "${n}" ในระบบ (กรุณาเพิ่มครูก่อน)` };
      teacherIds.push(...found.map((x) => x.id));
    }
    return { value: { name, count, condition, groupIds, teacherIds } };
  },
  identity: (v) => v.name,
};

export function conditionSummary(c: SpecialCase, ctx: Ctx): string {
  const r = parseCondition(c.condition, ctx.settings, c.count);
  return r.ok ? describeSlots(r.slots, ctx.settings) : '⚠ ' + (r.error ?? '');
}
