import { canonicalPass, hashPass, PassHash, verifyPass } from './crypto';

const KEY = 'tt-admin-lock';
const DATA_KEY = 'timetable-app-v1';

function read(): PassHash | null {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return j && typeof j.hash === 'string' && typeof j.salt === 'string' && Number.isInteger(j.iter) ? j : null;
  } catch { return null; }
}

/** รหัสล็อกผู้ดูแล = ล็อกหน้าจอบนเครื่องนี้ (เก็บเฉพาะค่า hash ไม่ได้เข้ารหัสข้อมูลในเครื่อง) */
export const hasAdminLock = () => read() !== null;

export async function setAdminLock(pass: string): Promise<void> {
  localStorage.setItem(KEY, JSON.stringify(await hashPass(canonicalPass(pass))));
}
export async function verifyAdminLock(pass: string): Promise<boolean> {
  const h = read();
  return h ? verifyPass(canonicalPass(pass), h) : false;
}
export function removeAdminLock() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

/** ลืมรหัส: ลบทั้งรหัสล็อกและข้อมูลผู้ดูแลในเครื่องนี้ (ลบข้อมูลด้วย เพื่อไม่ให้ใช้ทางลัดนี้ข้ามรหัสไปดูข้อมูลได้) */
export function resetThisDevice() {
  try { localStorage.removeItem(KEY); localStorage.removeItem(DATA_KEY); } catch { /* ignore */ }
}
