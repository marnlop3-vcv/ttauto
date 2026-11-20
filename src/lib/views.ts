import { DAY_NAMES, roomLabel, roomKeyOf, roomsOf, Assignment } from '../types';
import { placeText } from './rooms';
import type { DataState } from '../store';

export type ViewKind = 'teacher' | 'group' | 'building';

export interface CellItem {
  kind: 'class' | 'special';
  key: string;          // ใช้เทียบว่าคาบติดกันเป็นรายการเดียวกันหรือไม่
  title: string;
  lines: string[];
}
/** ช่องในตาราง 1 ช่อง อาจครอบหลายคาบ (span) เมื่อสอนติดกันเป็นรายการเดียวกัน */
export interface CellData { items: CellItem[]; span: number; from: number }

export interface Summary {
  total: number;                       // คาบเรียน/สอน/ใช้งาน ต่อสัปดาห์
  special: number;                     // คาบกรณีพิเศษ ต่อสัปดาห์
  totalLabel: string;
  items: { label: string; count: number; special?: boolean }[];
}

export interface GridData {
  title: string;
  subtitle: string;
  periods: { label: string; time: string }[];
  lunchAfter: number;
  rows: { dayLabel: string; cells: CellData[] }[];
  summary: Summary;
}

export const VIEW_LABEL: Record<ViewKind, string> = { teacher: 'ครู', group: 'กลุ่มเรียน', building: 'อาคาร' };

export function listOptions(kind: ViewKind, d: DataState): { id: string; label: string }[] {
  // ครูชื่อเดียวกัน (คนละหน้าที่) ถือเป็นคนเดียวกัน: ใช้ชื่อเป็น id
  if (kind === 'teacher') return [...new Set(d.teachers.map((t) => t.name))].map((n) => ({ id: n, label: n }));
  if (kind === 'group') return d.groups.map((g) => ({ id: g.id, label: `${g.code} ${g.name}` }));
  return d.buildings.map((b) => ({ id: b.id, label: b.name }));
}

export function cellText(items: CellItem[]): string {
  return items.map((i) => [i.title, ...i.lines].join('\n')).join('\n\n');
}

export function buildGrid(kind: ViewKind, id: string, d: DataState): GridData | null {
  const { settings, schedule } = d;
  if (!settings.days.length || !settings.periods.length) return null;
  const nP = settings.periods.length;
  const lunch = settings.lunchAfter;
  const teacherName = (tid: string) => d.teachers.find((t) => t.id === tid)?.name;
  const groupName = (gid: string) => d.groups.find((g) => g.id === gid)?.name;
  const subjectName = (sid: string) => d.subjects.find((s) => s.id === sid)?.name ?? '?';
  const buildingName = (bid: string) => d.buildings.find((b) => b.id === bid)?.name ?? '?';

  let title = '';
  let subtitle = VIEW_LABEL[kind];
  if (kind === 'teacher') {
    if (!d.teachers.some((x) => x.name === id)) return null;
    title = `ตารางสอนครู ${id}`;
  } else if (kind === 'group') {
    const g = d.groups.find((x) => x.id === id);
    if (!g) return null;
    title = `ตารางเรียนกลุ่ม ${g.name}`;
    subtitle = `รหัส ${g.code}${g.major ? ' • สาขา ' + g.major : ''}`;
  } else {
    const b = d.buildings.find((x) => x.id === id);
    if (!b) return null;
    title = `ตารางการใช้อาคาร ${b.name}`;
    subtitle = `${b.floors} ชั้น • ชั้นละ ${b.roomsPerFloor} ห้อง`;
  }

  const relevant = (a: Assignment) =>
    kind === 'teacher' ? [...a.mainTeacherIds, ...a.coTeacherIds].some((t) => teacherName(t) === id)
    : kind === 'group' ? true // กรองด้วย entry.groupIds
    : roomsOf(a).some((r) => r.buildingId === id);

  const byId = new Map(d.assignments.map((a) => [a.id, a]));
  const slots = new Map<string, CellItem[]>();
  const counts = new Map<string, number>();       // สรุปคาบ: ชื่อ -> จำนวน
  const specialCounts = new Map<string, number>();
  const push = (day: number, period: number, item: CellItem, countLabel?: string) => {
    const k = `${day}-${period}`;
    slots.set(k, [...(slots.get(k) ?? []), item]);
    if (item.kind === 'special') specialCounts.set(item.title, (specialCounts.get(item.title) ?? 0) + 1);
    else if (countLabel) counts.set(countLabel, (counts.get(countLabel) ?? 0) + 1);
  };

  if (schedule) {
    for (const sp of schedule.specials) {
      const global = sp.groupIds.length === 0 && (sp.teacherIds ?? []).length === 0;
      const applies =
        kind === 'group' ? global || sp.groupIds.includes(id)
        : kind === 'teacher' ? global || (sp.teacherIds ?? []).some((t) => teacherName(t) === id)
        : false;
      if (applies) push(sp.day, sp.period, { kind: 'special', key: `s:${sp.caseId}`, title: sp.name, lines: [] });
    }

    // ครู/อาคาร: ช่องเวลาเดียวกันที่ วิชา+ห้อง+ครู เดียวกัน (เรียนรวมหลายกลุ่ม) รวมเป็นรายการเดียว
    const agg = new Map<string, { a: Assignment; day: number; period: number; groups: Set<string>; tn: string }>();
    for (const e of schedule.entries) {
      const a = byId.get(e.assignmentId);
      if (!a || !relevant(a)) continue;
      const allRooms = roomsOf(a);
      const place = placeText(allRooms, buildingName); // วิชาเสรี: แสดงทุกห้อง/ทุกอาคารที่ใช้พร้อมกัน
      const subj = subjectName(a.subjectId);
      if (kind === 'group') {
        if (!(e.groupIds ?? []).includes(id)) continue;
        const main = a.mainTeacherIds.map(teacherName).filter(Boolean) as string[];
        const co = a.coTeacherIds.map(teacherName).filter(Boolean) as string[];
        const teachers = [...main, ...co.map((n) => `${n} (ร่วม)`)].join(', ');
        push(e.day, e.period, { kind: 'class', key: `c:${a.id}`, title: subj, lines: [teachers, place] }, subj);
        continue;
      }
      const tn = [...new Set([...a.mainTeacherIds, ...a.coTeacherIds].map((t) => teacherName(t)))].sort().join(',');
      const key = `${e.day}-${e.period}|${a.subjectId}|${allRooms.map(roomKeyOf).sort().join('+')}|${tn}`;
      const cur = agg.get(key) ?? { a, day: e.day, period: e.period, groups: new Set<string>(), tn };
      (e.groupIds ?? []).forEach((g) => cur.groups.add(g));
      agg.set(key, cur);
    }
    for (const { a, day, period, groups, tn } of agg.values()) {
      const subj = subjectName(a.subjectId);
      const gNames = [...groups].map(groupName).filter(Boolean).join(', ');
      const allRooms = roomsOf(a);
      const place = placeText(allRooms, buildingName);
      const roomsHere = allRooms.filter((r) => r.buildingId === id); // มุมมองอาคาร: เฉพาะห้องของอาคารนี้
      const roomsKey = allRooms.map(roomKeyOf).sort().join('+');
      const main = a.mainTeacherIds.map(teacherName).filter(Boolean) as string[];
      const co = a.coTeacherIds.map(teacherName).filter(Boolean) as string[];
      const teachers = [...main, ...co.map((n) => `${n} (ร่วม)`)].join(', ');
      const gKey = [...groups].sort().join('+');
      if (kind === 'teacher') {
        push(day, period, { kind: 'class', key: `t:${a.subjectId}:${roomsKey}:${gKey}`, title: subj, lines: [gNames, place] }, subj);
      } else {
        const here = roomsHere.map(roomLabel).join(', ');
        const labels = roomsHere.map((r) => `ห้อง ${roomLabel(r)}`);
        const others = allRooms.length > roomsHere.length ? [`ใช้พร้อมกับ ${placeText(allRooms.filter((r) => r.buildingId !== id), buildingName)}`] : [];
        push(day, period, { kind: 'class', key: `b:${a.subjectId}:${roomsKey}:${tn}:${gKey}`, title: `${subj} [${here}]`, lines: [teachers, gNames, ...others] }, labels[0]);
        // นับการใช้งานรายห้อง: ห้องที่ 2 เป็นต้นไปในอาคารนี้
        labels.slice(1).forEach((l) => counts.set(l, (counts.get(l) ?? 0) + 1));
      }
    }
  }

  // ---- รวมคาบที่สอนติดกัน (รายการเดียวกัน) เป็นช่องเดียว ----
  const sig = (items: CellItem[]) => items.map((i) => i.key).sort().join('|');
  const rows = settings.days.map((day) => {
    const raw = Array.from({ length: nP }, (_, i) => slots.get(`${day}-${i + 1}`) ?? []);
    const cells: CellData[] = [];
    for (let i = 0; i < nP; ) {
      let span = 1;
      if (raw[i].length) {
        // คาบ p กับ p+1 ติดกันได้ ถ้าไม่ได้คั่นด้วยพักเที่ยง (คาบที่ i+1 === lunch)
        while (i + span < nP && i + span !== lunch && sig(raw[i + span]) === sig(raw[i])) span++;
      }
      cells.push({ items: raw[i], span, from: i });
      i += span;
    }
    return { dayLabel: DAY_NAMES[day], cells };
  });

  const items = [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'th'));
  const spItems = [...specialCounts.entries()].map(([label, count]) => ({ label: `${label} (กรณีพิเศษ)`, count, special: true }));
  const total = items.reduce((n, x) => n + x.count, 0);
  const special = spItems.reduce((n, x) => n + x.count, 0);
  const totalLabel = kind === 'teacher' ? 'คาบสอน' : kind === 'group' ? 'คาบเรียน' : 'คาบที่มีการใช้ห้อง';

  return {
    title, subtitle,
    periods: settings.periods.map((p, i) => ({ label: `คาบ ${i + 1}`, time: `${p.start}-${p.end}` })),
    lunchAfter: lunch,
    rows,
    summary: { total, special, totalLabel, items: [...items, ...spItems] },
  };
}
