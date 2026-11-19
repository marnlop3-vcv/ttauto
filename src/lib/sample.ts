import { Assignment, Building, Group, Settings, SpecialCase, Subject, Teacher } from '../types';
import { DataState, uid } from '../store';

export type SampleSize = 'small' | 'medium' | 'large';

export const SAMPLE_LABEL: Record<SampleSize, string> = { small: 'เล็ก', medium: 'กลาง', large: 'ใหญ่' };

const SETTINGS: Settings = {
  days: [0, 1, 2, 3, 4], lunchAfter: 4,
  periods: [
    ['08:30', '09:20'], ['09:20', '10:10'], ['10:10', '11:00'], ['11:00', '11:50'],
    ['12:50', '13:40'], ['13:40', '14:30'], ['14:30', '15:20'], ['15:20', '16:10'],
  ].map(([start, end]) => ({ start, end })),
};

const mk = <T,>(arr: Omit<T, 'id'>[]): T[] => arr.map((a) => ({ id: uid(), ...a } as T));

/** เล็ก: 4 กลุ่ม 6 วิชา 8 ครู 2 อาคาร (ลองใช้เร็ว / ดูฟีเจอร์ครบ) */
function small(): Partial<DataState> {
  const teachers = mk<Teacher>([
    { name: 'นางสมศรี ใจดี', role: 'main' }, { name: 'นายประเสริฐ มั่นคง', role: 'main' },
    { name: 'นางสาวมาลี สุขใจ', role: 'main' }, { name: 'นายวิชัย ทองดี', role: 'main' },
    { name: 'นางสุนีย์ รักเรียน', role: 'main' }, { name: 'นายอนันต์ ชำนาญ', role: 'main' },
    { name: 'นางสาวพิมพ์ใจ ศรีสุข', role: 'co' }, { name: 'นายกิตติ พัฒนา', role: 'co' }, { name: 'นางสมศรี ใจดี', role: 'co' },
  ]);
  const groups = mk<Group>([
    { code: '6701', name: 'ปวช.1/1', major: 'การบัญชี' }, { code: '6702', name: 'ปวช.1/2', major: 'การตลาด' },
    { code: '6601', name: 'ปวช.2/1', major: 'การบัญชี' }, { code: '6602', name: 'ปวช.2/2', major: 'การตลาด' },
  ]);
  const subjects = mk<Subject>([
    { code: '20001-1001', name: 'ภาษาไทย', periodsPerWeek: 2 }, { code: '20000-1201', name: 'คณิตศาสตร์', periodsPerWeek: 3 },
    { code: '20000-1301', name: 'ภาษาอังกฤษ', periodsPerWeek: 2 }, { code: '30100-1001', name: 'การบัญชีเบื้องต้น', periodsPerWeek: 4 },
    { code: '30200-1001', name: 'หลักการตลาด', periodsPerWeek: 3 }, { code: '20000-1401', name: 'คอมพิวเตอร์', periodsPerWeek: 2 },
  ]);
  const buildings = mk<Building>([
    { name: 'อาคาร 1', floors: 3, roomsPerFloor: 4 }, { name: 'อาคาร 2', floors: 2, roomsPerFloor: 3 },
  ]);
  const specialCases = mk<SpecialCase>([
    { name: 'คาบกิจกรรม', count: 1, condition: 'ทุกวันคาบที่ 1', groupIds: [], teacherIds: [] },
    { name: 'ชุมนุม', count: 2, condition: 'วันพุธ คาบ 7', groupIds: [], teacherIds: [] },
    { name: 'ประชุมครู', count: 2, condition: 'วันอังคาร คาบ 7-8', groupIds: [], teacherIds: [teachers[0].id, teachers[1].id] },
  ]);
  const assignments: Assignment[] = [];
  groups.forEach((g, gi) => {
    subjects.forEach((s, si) => {
      // ภาษาไทยของ 2 กลุ่มแรก: ครู/ห้องเดียวกัน -> ระบบรวมสอนพร้อมกัน
      const together = si === 0 && gi < 2;
      assignments.push({
        id: uid(), subjectId: s.id,
        mainTeacherIds: [teachers[together ? 0 : (si + gi) % 6].id],
        coTeacherIds: si === 5 ? [teachers[6].id] : si === 2 && gi % 2 === 0 ? [teachers[7].id] : [],
        groupIds: [g.id], together: true,
        room: together ? { buildingId: buildings[0].id, floor: 1, no: 1 } : { buildingId: buildings[gi < 2 ? 0 : 1].id, floor: 1 + (gi % 2), no: 1 + (gi % 3) },
      });
    });
  });
  return { settings: SETTINGS, teachers, groups, subjects, buildings, specialCases, assignments };
}

// ---------- กลาง / ใหญ่: สร้างอัตโนมัติแบบกำหนดแน่นอน (ไม่สุ่ม) ออกแบบให้จัดได้ครบ ----------
const FIRST = ['นายสมชาย', 'นางสมศรี', 'นางสาวมาลี', 'นายวิชัย', 'นางสุนีย์', 'นายอนันต์', 'นางสาวพิมพ์ใจ', 'นายกิตติ', 'นางวันเพ็ญ', 'นายธนากร',
  'นางสาวกัลยา', 'นายประสิทธิ์', 'นางสาวรัตนา', 'นายสุรชัย', 'นางจันทร์เพ็ญ', 'นายชาญชัย', 'นางสาวนภา', 'นายพิชัย', 'นางอรทัย', 'นายเอกชัย',
  'นางสาวปรียา', 'นายวีระ', 'นางสมหมาย', 'นายณัฐพล', 'นางสาวจุฑามาศ', 'นายอดิศักดิ์', 'นางศิริพร', 'นายภานุพงศ์', 'นางสาวสุภาพร', 'นายธีรศักดิ์'];
const LAST = ['ใจดี', 'มั่นคง', 'สุขใจ', 'ทองดี', 'รักเรียน', 'ชำนาญ', 'ศรีสุข', 'พัฒนา', 'เจริญผล', 'บุญมี', 'แก้วมณี', 'สว่างวงศ์', 'พรหมสุวรรณ', 'วงศ์ใหญ่', 'ทรัพย์สิน',
  'ปัญญาดี', 'สุริยา', 'คงเจริญ', 'อินทร์แก้ว', 'ศิลาลัย', 'เพชรรัตน์', 'ดีเลิศ', 'ชัยมงคล', 'นามวงศ์', 'โชคชัย', 'รุ่งเรือง', 'มีสุข', 'พงษ์ไทย', 'สมบูรณ์', 'ธรรมรักษ์'];
const teacherName = (i: number) => `${FIRST[i % 30]} ${LAST[(i * 7 + Math.floor(i / 30) * 11 + 3) % 30]}`;

const SUBJECTS: [string, string, number][] = [
  ['20001-1001', 'ภาษาไทย', 2], ['20000-1201', 'คณิตศาสตร์', 3], ['20000-1301', 'ภาษาอังกฤษ', 2], ['20000-1601', 'วิทยาศาสตร์', 3],
  ['20000-1501', 'สังคมศึกษา', 2], ['20000-1101', 'พลศึกษา', 1], ['20000-1401', 'คอมพิวเตอร์', 2], ['30100-1001', 'การบัญชีเบื้องต้น', 4],
  ['30200-1001', 'หลักการตลาด', 3], ['30000-1002', 'เศรษฐศาสตร์', 2],
];
const MAJORS = ['การบัญชี', 'การตลาด', 'คอมพิวเตอร์ธุรกิจ', 'การขาย', 'เลขานุการ'];

function generated(nGroups: number, nSubjects: number, nBuildings: number): Partial<DataState> {
  const subjects = mk<Subject>(SUBJECTS.slice(0, nSubjects).map(([code, name, p]) => ({ code, name, periodsPerWeek: p })));
  const groups = mk<Group>(Array.from({ length: nGroups }, (_, i) => ({
    code: `67${String(i + 1).padStart(2, '0')}`,
    name: `ปวช.${1 + (i % 3)}/${1 + Math.floor(i / 3)}`,
    major: MAJORS[i % MAJORS.length],
  })));
  const ROOMS_PER_FLOOR = 4;
  const buildings = mk<Building>(Array.from({ length: nBuildings }, (_, i) => ({ name: `อาคาร ${i + 1}`, floors: 3, roomsPerFloor: ROOMS_PER_FLOOR })));

  // ครูสอนหลักต่อวิชา: ไม่ให้ครูหนึ่งคนมีงานเกินกำลัง (≤16 คาบ/สัปดาห์; วิชา 4 คาบ ≤3 กลุ่ม เพราะต้องติดกัน 4 คาบ)
  let t = 0;
  const mainList: Omit<Teacher, 'id'>[] = [];
  const pools: number[][] = subjects.map((s) => {
    const perTeacher = s.periodsPerWeek === 4 ? 3 : Math.floor(16 / s.periodsPerWeek);
    const n = Math.ceil(nGroups / perTeacher);
    return Array.from({ length: n }, () => { mainList.push({ name: teacherName(t++), role: 'main' }); return mainList.length - 1; });
  });
  // ครูสอนร่วม (วิชาคอมพิวเตอร์) คนละ 6 กลุ่ม คนแรกใช้ชื่อเดียวกับครูหลักคนแรก (สาธิตชื่อซ้ำคนละหน้าที่)
  const nCo = Math.ceil(nGroups / 6);
  const coList: Omit<Teacher, 'id'>[] = Array.from({ length: nCo }, (_, i) => ({ name: i === 0 ? mainList[0].name : teacherName(t++), role: 'co' as const }));
  const all = mk<Teacher>([...mainList, ...coList]);
  const mainT = all.slice(0, mainList.length);
  const coT = all.slice(mainList.length);

  const specialCases = mk<SpecialCase>([
    { name: 'คาบกิจกรรม', count: 1, condition: 'ทุกวันคาบที่ 1', groupIds: [], teacherIds: [] },
    { name: 'ชุมนุม', count: 2, condition: 'วันพุธ คาบ 7', groupIds: [], teacherIds: [] },
    { name: 'ประชุมครู', count: 2, condition: 'วันอังคาร คาบ 7-8', groupIds: [], teacherIds: [mainT[0].id, mainT[1].id, mainT[2].id] },
  ]);

  const homeRoom = (gi: number) => {
    const b = gi % nBuildings;
    const k = Math.floor(gi / nBuildings);
    return { buildingId: buildings[b].id, floor: 1 + Math.floor(k / ROOMS_PER_FLOOR), no: 1 + (k % ROOMS_PER_FLOOR) };
  };

  const assignments: Assignment[] = [];
  groups.forEach((g, gi) => {
    subjects.forEach((_, si) => {
      const pair = si === 0; // ภาษาไทย: กลุ่มคู่ (2k, 2k+1) เรียนรวมกัน ครู/ห้องเดียวกัน
      const pool = pools[si];
      const teacher = mainT[pool[(pair ? Math.floor(gi / 2) : gi) % pool.length]];
      assignments.push({
        id: uid(), subjectId: subjects[si].id,
        mainTeacherIds: [teacher.id],
        coTeacherIds: si === 6 ? [coT[Math.floor(gi / 6)].id] : [],
        groupIds: [g.id], together: true,
        room: homeRoom(pair ? gi - (gi % 2) : gi),
      });
    });
  });
  return { settings: SETTINGS, teachers: all, groups, subjects, buildings, specialCases, assignments };
}

/** ชุดข้อมูลตัวอย่าง 3 ขนาด */
export function makeSample(size: SampleSize = 'small'): Partial<DataState> {
  if (size === 'medium') return generated(12, 9, 3);
  if (size === 'large') return generated(30, 10, 6);
  return small();
}

export interface SampleInfo { groups: number; subjects: number; teachers: number; buildings: number; periods: number }
export function sampleInfo(size: SampleSize): SampleInfo {
  const d = makeSample(size);
  const per = new Map(d.subjects!.map((s) => [s.id, s.periodsPerWeek]));
  return {
    groups: d.groups!.length, subjects: d.subjects!.length, teachers: new Set(d.teachers!.map((x) => x.name)).size,
    buildings: d.buildings!.length, periods: d.assignments!.reduce((n, a) => n + (per.get(a.subjectId) ?? 0) * a.groupIds.length, 0),
  };
}
