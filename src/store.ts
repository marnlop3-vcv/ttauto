import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Assignment, Building, Group, Schedule, Settings, SpecialCase, Subject, Teacher,
} from './types';
import { EntityKind } from './lib/entities';

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

export interface DataState {
  settings: Settings;
  teachers: Teacher[];
  groups: Group[];
  subjects: Subject[];
  buildings: Building[];
  specialCases: SpecialCase[];
  assignments: Assignment[];
  schedule: Schedule | null;
  stale: boolean; // ข้อมูลเปลี่ยนหลังจัดตารางล่าสุด
}

interface Actions {
  setSettings(s: Settings): void;
  addMany(kind: EntityKind, values: any[]): void;
  remove(kind: EntityKind, id: string): { assignmentsRemoved: number };
  usage(kind: EntityKind, id: string): number;
  addAssignment(a: Omit<Assignment, 'id'>): void;
  removeAssignment(id: string): void;
  setSchedule(s: Schedule): void;
  replaceAll(d: Partial<DataState>): void;
  clearAll(): void;
}

const emptyData = (): DataState => ({
  settings: { days: [], periods: [], lunchAfter: 0 },
  teachers: [], groups: [], subjects: [], buildings: [], specialCases: [], assignments: [],
  schedule: null, stale: false,
});

/** ตรวจว่า assignment ใช้ id นี้อยู่หรือไม่ */
const uses = (a: Assignment, kind: EntityKind, id: string) =>
  (kind === 'teachers' && (a.mainTeacherIds.includes(id) || a.coTeacherIds.includes(id))) ||
  (kind === 'groups' && a.groupIds.includes(id)) ||
  (kind === 'subjects' && a.subjectId === id) ||
  (kind === 'buildings' && a.room.buildingId === id);

export const useStore = create<DataState & Actions>()(
  persist(
    (set, get) => ({
      ...emptyData(),
      setSettings: (settings) => set({ settings, schedule: null, stale: false }),
      addMany: (kind, values) =>
        set((st) => ({
          [kind]: [...(st[kind] as any[]), ...values.map((v) => ({ id: uid(), ...v }))],
          stale: st.schedule ? true : false,
        } as any)),
      usage: (kind, id) => get().assignments.filter((a) => uses(a, kind, id)).length,
      remove: (kind, id) => {
        const st = get();
        const before = st.assignments.length;
        let assignments = st.assignments;
        if (kind !== 'specialCases') {
          assignments = assignments
            .map((a) => {
              if (!uses(a, kind, id)) return a;
              return {
                ...a,
                mainTeacherIds: a.mainTeacherIds.filter((x) => x !== id),
                coTeacherIds: a.coTeacherIds.filter((x) => x !== id),
                groupIds: a.groupIds.filter((x) => x !== id),
              };
            })
            .filter((a) => a.mainTeacherIds.length && a.groupIds.length && !(kind === 'subjects' && a.subjectId === id) &&
              !(kind === 'buildings' && a.room.buildingId === id));
        }
        const patch: any = {
          [kind]: (st[kind] as any[]).filter((x) => x.id !== id),
          assignments,
          schedule: null,
          stale: false,
        };
        if (kind === 'groups') patch.specialCases = st.specialCases.map((c) => ({ ...c, groupIds: c.groupIds.filter((g) => g !== id) }));
        if (kind === 'teachers') patch.specialCases = st.specialCases.map((c) => ({ ...c, teacherIds: (c.teacherIds ?? []).filter((t) => t !== id) }));
        set(patch);
        return { assignmentsRemoved: before - assignments.length };
      },
      addAssignment: (a) => set((st) => ({ assignments: [...st.assignments, { id: uid(), ...a }], stale: !!st.schedule })),
      removeAssignment: (id) => set((st) => ({ assignments: st.assignments.filter((a) => a.id !== id), schedule: null, stale: false })),
      setSchedule: (schedule) => set({ schedule, stale: false }),
      replaceAll: (d) => set({ ...emptyData(), ...d }),
      clearAll: () => set(emptyData()),
    }),
    {
      name: 'timetable-app-v1',
      version: 3,
      migrate: (state: any) => {
        // v1 -> v2: กรณีพิเศษเพิ่มฟิลด์ teacherIds
        if (state?.specialCases) state.specialCases = state.specialCases.map((c: any) => ({ teacherIds: [], groupIds: [], ...c }));
        // v2 -> v3: กำหนดการเรียนมี together (ค่าเดิม = เรียนรวม) และผลตารางเก่าใช้รูปแบบใหม่ไม่ได้ ต้องจัดใหม่
        if (state?.assignments) state.assignments = state.assignments.map((a: any) => ({ together: true, ...a }));
        state.schedule = null;
        state.stale = false;
        return state;
      },
    },
  ),
);
