import { Assignment, Building, Group, Settings, SpecialCase, Subject, Teacher, roomKeyOf, roomLabel, roomsOf } from '../types';
import { parseCondition } from './thaiRuleParser';

/** ตรวจข้อมูลก่อนจัดตาราง (ไม่ต้องรอจัดตารางก่อน):
 *  1) ภาระ ครู / กลุ่มเรียน / ห้อง / อาคาร เทียบช่องว่างที่มีจริง (ช่องทั้งหมด − ช่องที่กรณีพิเศษล็อก)
 *  2) กำหนดการเรียนที่เวลาว่างของครูกับกลุ่มเรียนตรงกันไม่พอ (ติดกรณีพิเศษ)
 *  3) กรณีพิเศษที่อ่านเงื่อนไขไม่ได้ (ระบบจะข้ามไปเงียบๆ ตอนจัด)
 *  4) ข้อมูลที่กรอกแล้วไม่ได้ใช้ (กลุ่มเรียน/วิชา/ครู ที่ไม่มีกำหนดการเรียน)
 *  ถ้าภาระเกินช่องว่าง = จัดให้ครบไม่ได้แน่นอน (เป็นเงื่อนไขจำเป็น ไม่ใช่เงื่อนไขพอ) */
export interface LoadInput {
  settings: Settings; teachers: Teacher[]; groups: Group[]; subjects: Subject[]; buildings: Building[]; specialCases: SpecialCase[]; assignments: Assignment[];
}
export type LoadKind = 'teacher' | 'group' | 'room' | 'building';
export interface LoadRow { kind: LoadKind; id: string; name: string; need: number; available: number; note?: string }
export type Level = 'error' | 'warn' | 'info';
export interface Issue { level: Level; kind: string; text: string }
export interface LoadReport {
  days: number; periodsPerDay: number; totalSlots: number;
  rows: LoadRow[];
  over: LoadRow[];   // ภาระ > ช่องว่าง (ครู/กลุ่ม/ห้อง)
  near: LoadRow[];   // ใช้เกิน 90% ของช่องว่าง แต่ยังไม่เกิน
  issues: Issue[];   // รวมทุกข้อ เรียงจากร้ายแรงไปเบา
}
export const KIND_LABEL: Record<LoadKind, string> = { teacher: 'ครู', group: 'กลุ่มเรียน', room: 'ห้อง', building: 'อาคาร' };

export function checkLoad(d: LoadInput): LoadReport {
  const { settings } = d;
  const nD = settings.days.length, nP = settings.periods.length, total = nD * nP;
  const empty: LoadReport = { days: nD, periodsPerDay: nP, totalSlots: total, rows: [], over: [], near: [], issues: [] };
  if (!total) return empty;
  const issues: Issue[] = [];

  // ---- ช่องที่ถูกกรณีพิเศษล็อก (ตรรกะเดียวกับตัวจัดตาราง) ----
  const dayPos = new Map(settings.days.map((x, i) => [x, i]));
  const teacherName = new Map(d.teachers.map((t) => [t.id, t.name]));
  const blockAll = new Set<number>();
  const blockBy = new Map<string, Set<number>>(); // 't:ชื่อครู' / 'g:รหัสกลุ่ม' -> ช่องที่ล็อก
  const addTo = (k: string, s: number) => { if (!blockBy.has(k)) blockBy.set(k, new Set()); blockBy.get(k)!.add(s); };
  for (const sc of d.specialCases) {
    const r = parseCondition(sc.condition, settings, sc.count);
    if (!r.ok) { issues.push({ level: 'error', kind: 'special', text: `กรณีพิเศษ "${sc.name}": ${r.error ?? 'อ่านเงื่อนไขไม่ได้'} — ระบบจะข้ามกรณีพิเศษนี้ตอนจัดตาราง` }); continue; }
    const tIds = sc.teacherIds ?? [];
    const global = sc.groupIds.length === 0 && tIds.length === 0;
    for (const s of r.slots) {
      const di = dayPos.get(s.day);
      if (di === undefined) continue;
      const sid = di * nP + (s.period - 1);
      if (global) blockAll.add(sid);
      else {
        for (const g of sc.groupIds) addTo('g:' + g, sid);
        for (const t of tIds) addTo('t:' + (teacherName.get(t) ?? t), sid);
      }
    }
  }
  const globalAvail = total - blockAll.size;
  const available = (key: string) => {
    const own = blockBy.get(key);
    let blocked = blockAll.size;
    if (own) for (const s of own) if (!blockAll.has(s)) blocked++;
    return total - blocked;
  };

  // ---- หน่วยงาน: รวมเรียนรวมกัน (วิชา+ครู+ห้อง เดียวกัน) เป็นหน่วยเดียว ตามตัวจัดตาราง ----
  interface U { subjectId: string; need: number; teachers: string[]; groups: Set<string>; rooms: string[] }
  const units = new Map<string, U>();
  const subj = new Map(d.subjects.map((s) => [s.id, s]));
  let sep = 0;
  for (const a of d.assignments) {
    const s = subj.get(a.subjectId);
    if (!s || s.periodsPerWeek < 1) continue;
    const teachers = [...new Set([...a.mainTeacherIds, ...a.coTeacherIds].map((t) => teacherName.get(t) ?? t))];
    const rooms = roomsOf(a).map(roomKeyOf);
    if (a.together === false) {
      for (const g of a.groupIds) units.set('sep' + sep++, { subjectId: a.subjectId, need: s.periodsPerWeek, teachers, groups: new Set([g]), rooms });
      continue;
    }
    const key = `${a.subjectId}|${[...teachers].sort().join(',')}|${[...rooms].sort().join('+')}`;
    const u = units.get(key);
    if (u) a.groupIds.forEach((g) => u.groups.add(g));
    else units.set(key, { subjectId: a.subjectId, need: s.periodsPerWeek, teachers, groups: new Set(a.groupIds), rooms });
  }

  const tNeed = new Map<string, number>(), gNeed = new Map<string, number>(), rNeed = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);
  for (const u of units.values()) {
    u.teachers.forEach((t) => bump(tNeed, t, u.need));
    u.groups.forEach((g) => bump(gNeed, g, u.need));
    u.rooms.forEach((r) => bump(rNeed, r, u.need));
  }

  const groupName = (id: string) => { const g = d.groups.find((x) => x.id === id); return g ? `${g.code} ${g.name}` : '?'; };
  const bName = (id: string) => d.buildings.find((b) => b.id === id)?.name ?? '?';
  const rows: LoadRow[] = [];
  for (const [name, need] of tNeed) rows.push({ kind: 'teacher', id: name, name, need, available: available('t:' + name) });
  for (const [id, need] of gNeed) rows.push({ kind: 'group', id, name: groupName(id), need, available: available('g:' + id) });
  const roomRows: LoadRow[] = [];
  for (const [key, need] of rNeed) {
    const [bid, floor, no] = key.split(':');
    roomRows.push({ kind: 'room', id: key, name: `${bName(bid)} ห้อง ${roomLabel({ buildingId: bid, floor: +floor, no: +no })}`, need, available: globalAvail });
  }
  rows.push(...roomRows);
  // อาคาร: ภาระรวมของห้องที่ใช้ เทียบกับความจุทั้งอาคาร (จำนวนห้องทั้งหมด × ช่องว่าง) — ข้อมูลภาพรวม
  for (const b of d.buildings) {
    const used = roomRows.filter((r) => r.id.startsWith(b.id + ':'));
    if (!used.length) continue;
    const cap = b.floors * b.roomsPerFloor;
    rows.push({ kind: 'building', id: b.id, name: b.name, need: used.reduce((n, r) => n + r.need, 0), available: cap * globalAvail, note: `ใช้ห้อง ${used.length} จาก ${cap} ห้อง` });
  }
  rows.sort((a, b) => b.need / Math.max(1, b.available) - a.need / Math.max(1, a.available));

  const checked = rows.filter((r) => r.kind !== 'building');
  const over = checked.filter((r) => r.need > r.available);
  const near = checked.filter((r) => r.need <= r.available && r.available > 0 && r.need >= 0.9 * r.available);
  const rep = { days: nD, periodsPerDay: nP };
  over.forEach((r) => issues.push({ level: 'error', kind: r.kind, text: describeLoad(r, rep) }));

  // ---- กำหนดการเรียนที่เวลาว่างของครู+กลุ่มเรียนที่เกี่ยวข้อง ตรงกันไม่พอ ----
  for (const u of units.values()) {
    if (u.need > globalAvail) continue; // ถูกจับโดยภาระรายครู/กลุ่มอยู่แล้ว
    const blocked = new Set<number>(blockAll);
    u.teachers.forEach((t) => blockBy.get('t:' + t)?.forEach((s) => blocked.add(s)));
    u.groups.forEach((g) => blockBy.get('g:' + g)?.forEach((s) => blocked.add(s)));
    const common = total - blocked.size;
    if (u.need > common) {
      const gs = [...u.groups].map(groupName).join(', ');
      issues.push({ level: 'error', kind: 'unit', text: `วิชา ${subj.get(u.subjectId)?.name ?? '?'} (${gs}): ต้องใช้ ${u.need} คาบ แต่ช่วงเวลาที่ครู (${u.teachers.join(', ')}) กับกลุ่มเรียนว่างตรงกันมีเพียง ${common} คาบ (ติดกรณีพิเศษที่ล็อกเวลาไว้)` });
    }
  }

  near.forEach((r) => issues.push({ level: 'warn', kind: r.kind, text: describeLoad(r, rep) }));

  // ---- ข้อมูลที่กรอกแล้วแต่ไม่ได้ใช้ ----
  const usedSubj = new Set(d.assignments.map((a) => a.subjectId));
  const usedGroup = new Set(d.assignments.flatMap((a) => a.groupIds));
  d.groups.filter((g) => !usedGroup.has(g.id)).forEach((g) => issues.push({ level: 'warn', kind: 'unused-group', text: `กลุ่มเรียน ${g.code} ${g.name} ยังไม่มีกำหนดการเรียนเลย (จะไม่มีตารางเรียน)` }));
  d.subjects.filter((s) => !usedSubj.has(s.id)).forEach((s) => issues.push({ level: 'warn', kind: 'unused-subject', text: `วิชา ${s.name} ยังไม่ถูกใช้ในกำหนดการเรียนใดเลย` }));
  const usedTeacher = new Set(d.assignments.flatMap((a) => [...a.mainTeacherIds, ...a.coTeacherIds].map((t) => teacherName.get(t) ?? t)));
  const idle = [...new Set(d.teachers.map((t) => t.name))].filter((n) => !usedTeacher.has(n));
  if (idle.length) issues.push({ level: 'info', kind: 'unused-teacher', text: `ครู ${idle.length} คนยังไม่มีกำหนดการสอน: ${idle.slice(0, 6).join(', ')}${idle.length > 6 ? ` และอีก ${idle.length - 6} คน` : ''}` });

  const order: Record<Level, number> = { error: 0, warn: 1, info: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);
  return { days: nD, periodsPerDay: nP, totalSlots: total, rows, over, near, issues };
}

/** ข้อความอธิบายแถวภาระ เช่น "ครู นายสมชาย: ต้องสอน 45 คาบ/สัปดาห์ แต่มีช่องว่างได้ 35 คาบ (เกิน 10 คาบ — เฉลี่ย 9 คาบ/วัน จากที่มี 7 คาบ/วัน)" */
export function describeLoad(r: LoadRow, rep: Pick<LoadReport, 'days' | 'periodsPerDay'>): string {
  const verb = r.kind === 'teacher' ? 'ต้องสอน' : r.kind === 'group' ? 'ต้องเรียน' : 'ต้องใช้';
  const perDay = Math.round((r.need / Math.max(1, rep.days)) * 10) / 10;
  const base = `${KIND_LABEL[r.kind]} ${r.name}: ${verb} ${r.need} คาบ/สัปดาห์ แต่มีช่องว่างได้ ${r.available} คาบ`;
  return r.need > r.available ? `${base} (เกิน ${r.need - r.available} คาบ — เฉลี่ย ${perDay} คาบ/วัน จากที่มี ${rep.periodsPerDay} คาบ/วัน)` : `${base} (ใช้ ${Math.round((r.need / r.available) * 100)}%)`;
}
