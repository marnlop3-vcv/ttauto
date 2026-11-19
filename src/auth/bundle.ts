import type { DataState } from '../store';
import { buildGrid, GridData, listOptions } from '../lib/views';
import { canonicalPass, decryptJson, encryptJson, Envelope } from './crypto';

/** ข้อมูลที่ผู้ดูแลเผยแพร่ ประกอบด้วย 2 ซองที่เข้ารหัสแยกกัน (คนละรหัส) */
export interface PublishedFile {
  v: 1;
  publishedAt: number;      // เวลาเผยแพร่ (ไม่ใช่ความลับ)
  student: Envelope;
  teacher: Envelope;
}

export type ViewerRole = 'student' | 'teacher';

/** สิ่งที่ผู้ดูเห็นหลังถอดรหัส: ตารางที่คำนวณเสร็จแล้วเท่านั้น (ไม่มีกำหนดการเรียน/ข้อมูลดิบ) */
export interface ViewerPayload {
  kind: ViewerRole;
  title: string;
  publishedAt: number;
  items: { id: string; label: string; grid: GridData }[];
}

export const PUBLISHED_URL = './published/published.enc.json';

/** ซองนักเรียน = ตารางรายกลุ่มเรียน, ซองครู = ตารางรายครู */
export function buildPayloads(data: DataState, title: string, publishedAt: number): { student: ViewerPayload; teacher: ViewerPayload } {
  const collect = (kind: 'group' | 'teacher') =>
    listOptions(kind, data)
      .map((o) => ({ id: o.id, label: o.label, grid: buildGrid(kind, o.id, data) }))
      .filter((x): x is { id: string; label: string; grid: GridData } => !!x.grid);
  return {
    student: { kind: 'student', title, publishedAt, items: collect('group') },
    teacher: { kind: 'teacher', title, publishedAt, items: collect('teacher') },
  };
}

export async function buildPublished(
  data: DataState,
  opts: { title: string; studentPass: string; teacherPass: string },
): Promise<PublishedFile> {
  const publishedAt = Date.now();
  const p = buildPayloads(data, opts.title.trim(), publishedAt);
  const [student, teacher] = await Promise.all([
    encryptJson(p.student, canonicalPass(opts.studentPass)),
    encryptJson(p.teacher, canonicalPass(opts.teacherPass)),
  ]);
  return { v: 1, publishedAt, student, teacher };
}

/** ลองถอดทีละซองด้วยรหัสที่ใส่ — ซองไหนถอดได้ = บทบาทนั้น (null = รหัสไม่ถูกต้อง) */
export async function openPublished(file: PublishedFile, pass: string): Promise<ViewerPayload | null> {
  const p = canonicalPass(pass);
  if (!p) return null;
  for (const kind of ['student', 'teacher'] as const) {
    const payload = await decryptJson<ViewerPayload>(file[kind], p);
    // กันกรณีซองถูกสลับ: ชนิดข้อมูลต้องตรงกับซอง
    if (payload && payload.kind === kind && Array.isArray(payload.items)) return payload;
  }
  return null;
}

export function isPublishedFile(x: any): x is PublishedFile {
  return !!x && x.v === 1 && typeof x.publishedAt === 'number' && !!x.student && !!x.teacher &&
    typeof x.student.ct === 'string' && typeof x.teacher.ct === 'string';
}

export type FetchResult = { status: 'ready'; file: PublishedFile } | { status: 'none' } | { status: 'error'; message: string };

/** โหลดไฟล์เผยแพร่ที่วางไว้พร้อมเว็บ (ไม่มีไฟล์ = none) */
export async function fetchPublished(): Promise<FetchResult> {
  try {
    const res = await fetch(PUBLISHED_URL, { cache: 'no-cache' });
    if (res.status === 404) return { status: 'none' };
    if (!res.ok) return { status: 'error', message: `โหลดไฟล์ตารางไม่สำเร็จ (HTTP ${res.status})` };
    const json = await res.json().catch(() => null);
    // เว็บบางที่ตอบ 200 เป็นหน้า HTML เมื่อไม่พบไฟล์ -> ถือว่าไม่มีไฟล์
    if (!isPublishedFile(json)) return { status: 'none' };
    return { status: 'ready', file: json };
  } catch (e) {
    return { status: 'error', message: 'เชื่อมต่อไม่ได้: ' + (e as Error).message };
  }
}

export async function readPublishedFromFile(file: File): Promise<PublishedFile> {
  if (file.size > 40 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกินไป');
  let json: unknown;
  try { json = JSON.parse(await file.text()); } catch { throw new Error('อ่านไฟล์ไม่ได้ (ไม่ใช่ไฟล์ตารางที่เผยแพร่)'); }
  if (!isPublishedFile(json)) throw new Error('ไฟล์นี้ไม่ใช่ไฟล์ตารางที่เผยแพร่ (published.enc.json)');
  return json;
}
