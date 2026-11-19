import { create } from 'zustand';
import type { ViewerPayload } from './bundle';

export type Role = 'admin' | 'student' | 'teacher';
const KEY = 'tt-session';

interface Session {
  role: Role | null;
  payload: ViewerPayload | null;
  loginAdmin(): void;
  loginViewer(p: ViewerPayload): void;
  logout(): void;
}

function load(): Pick<Session, 'role' | 'payload'> {
  try {
    const j = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    if (j?.role === 'admin') return { role: 'admin', payload: null };
    if ((j?.role === 'student' || j?.role === 'teacher') && j.payload?.kind === j.role && Array.isArray(j.payload.items)) return { role: j.role, payload: j.payload };
  } catch { /* ignore */ }
  return { role: null, payload: null };
}
const save = (role: Role | null, payload: ViewerPayload | null) => {
  try { if (role) sessionStorage.setItem(KEY, JSON.stringify({ role, payload })); else sessionStorage.removeItem(KEY); } catch { /* ignore */ }
};

/** สถานะการเข้าสู่ระบบ อยู่ได้ตลอดแท็บนี้เท่านั้น (ปิดแท็บแล้วต้องใส่รหัสใหม่) ไม่เก็บถาวร */
export const useSession = create<Session>((set) => ({
  ...load(),
  loginAdmin: () => { save('admin', null); set({ role: 'admin', payload: null }); },
  loginViewer: (payload) => { save(payload.kind, payload); set({ role: payload.kind, payload }); },
  logout: () => { save(null, null); set({ role: null, payload: null }); },
}));
