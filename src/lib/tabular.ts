import type { EntityDef } from './entities';

/** อ่านไฟล์ข้อความตาราง (CSV / JSON) ให้ได้แถวรูปแบบเดียวกับ Excel: แถวแรก = หัวตารางมาตรฐานของ def */

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_ROWS = 20000;

const stripBom = (s: string) => s.replace(/^﻿/, '');

/** ถอดรหัสไฟล์ข้อความ: UTF-8 (ตัด BOM) -> UTF-16 (ตาม BOM) -> Windows-874/TIS-620 (CSV ภาษาไทยจาก Excel เก่า) */
export function decodeText(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b).replace(/^﻿/, '');
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b).replace(/^﻿/, '');
  try {
    return stripBom(new TextDecoder('utf-8', { fatal: true }).decode(b));
  } catch {
    try { return new TextDecoder('windows-874').decode(b); } catch { return new TextDecoder('utf-8').decode(b); }
  }
}

/** ตรวจตัวคั่นจากบรรทัดแรก (นอกเครื่องหมายคำพูด): , ; หรือ Tab */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  let q = false;
  for (const ch of text) {
    if (ch === '"') q = !q;
    else if (!q && (ch === '\n' || ch === '\r')) break;
    else if (!q && ch in counts) counts[ch]++;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

/** CSV ตาม RFC 4180: เครื่องหมายคำพูด, "" แทน ", คอมมา/ขึ้นบรรทัดใหม่ในช่อง, CRLF */
export function parseCsv(text: string): string[][] {
  const src = stripBom(text);
  const d = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  let i = 0;
  const endCell = () => { row.push(cell.trim()); cell = ''; };
  const endRow = () => { endCell(); rows.push(row); row = []; }; // เก็บบรรทัดว่างไว้ เพื่อให้เลขแถวในรายงาน error ตรงกับโปรแกรมตาราง
  while (i < src.length) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else q = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') q = true;
    else if (ch === d) endCell();
    else if (ch === '\r') { if (src[i + 1] === '\n') i++; endRow(); }
    else if (ch === '\n') endRow();
    else cell += ch;
    i++;
  }
  if (cell !== '' || row.length) endRow();
  while (rows.length && rows[rows.length - 1].every((c) => c === '')) rows.pop(); // ตัดบรรทัดว่างท้ายไฟล์
  if (rows.length > MAX_ROWS + 1) throw new Error(`ไฟล์มีมากกว่า ${MAX_ROWS.toLocaleString()} แถว`);
  return rows;
}

const norm = (h: unknown) => String(h ?? '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').toLowerCase();

/** ชื่อที่ยอมรับของคอลัมน์ที่ i: หัวตาราง Template (ตัดวงเล็บ) + alias */
function namesOf(def: EntityDef<any>, i: number): Set<string> {
  return new Set([norm(def.headers[i]), ...(def.aliases[i] ?? []).map(norm)]);
}

/** จับคู่หัวคอลัมน์ในไฟล์กับคอลัมน์ของ def (เรียงสลับ/มีคอลัมน์เกินได้) -> แถวหัวมาตรฐาน + ข้อมูล */
export function alignRows(rows: string[][], def: EntityDef<any>): string[][] {
  if (!rows.length) throw new Error('ไฟล์ว่างเปล่า');
  const header = rows[0].map(norm);
  const idx = def.headers.map((_, i) => {
    const names = namesOf(def, i);
    return header.findIndex((h) => names.has(h));
  });
  if (idx[0] < 0) {
    throw new Error(`หัวตารางไม่ตรงกับ Template (ต้องมีคอลัมน์ "${def.headers[0].replace(/\s*\(.*$/, '')}") — กรุณาใช้ Template ของหน้านี้`);
  }
  const body = rows.slice(1).map((r) => idx.map((k) => (k >= 0 ? String(r[k] ?? '').trim() : '')));
  return [def.headers, ...body];
}

/** JSON: [ {...} ] | { "<kind|ชื่อไทย>": [ {...} ] } | [ [...], [...] ] — ดึงเฉพาะคีย์ที่รู้จัก ไม่ merge อ็อบเจ็กต์ทั้งก้อน */
export function rowsFromJson(data: unknown, def: EntityDef<any>): string[][] {
  let list: unknown = data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    const keys = [def.kind, def.label, def.sheetName, 'data', 'items', 'rows'];
    const k = keys.find((x) => Object.prototype.hasOwnProperty.call(o, x) && Array.isArray(o[x]));
    if (!k) throw new Error(`ไม่พบรายการข้อมูลใน JSON (ต้องเป็นอาร์เรย์ หรืออ็อบเจ็กต์ที่มีคีย์ "${def.kind}" หรือ "${def.label}")`);
    list = o[k];
  }
  if (!Array.isArray(list)) throw new Error('รูปแบบ JSON ไม่ถูกต้อง (ต้องเป็นอาร์เรย์ของรายการ)');
  if (list.length > MAX_ROWS) throw new Error(`ไฟล์มีมากกว่า ${MAX_ROWS.toLocaleString()} รายการ`);

  const toText = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return v.map(toText).filter(Boolean).join(',');
    if (typeof v === 'object') return '';
    return String(v).trim();
  };
  const colNames = def.headers.map((_, i) => namesOf(def, i));
  let matchedAny = false;
  const rows: string[][] = [];
  list.forEach((item, n) => {
    if (Array.isArray(item)) { rows.push(def.headers.map((_, i) => toText(item[i]))); matchedAny = true; return; }
    if (!item || typeof item !== 'object') throw new Error(`รายการที่ ${n + 1} ไม่ใช่อ็อบเจ็กต์หรืออาร์เรย์`);
    const byKey = new Map<string, unknown>();
    for (const [k, v] of Object.entries(item as Record<string, unknown>)) byKey.set(norm(k), v);
    rows.push(colNames.map((names) => {
      for (const nm of names) if (byKey.has(nm)) { matchedAny = true; return toText(byKey.get(nm)); }
      return '';
    }));
  });
  if (list.length && !matchedAny) {
    throw new Error(`ไม่พบคีย์ที่รู้จักใน JSON (ควรเป็น: ${def.headers.map((h) => h.replace(/\s*\(.*$/, '')).join(', ')})`);
  }
  return [def.headers, ...rows];
}

/** อ่านไฟล์ CSV/JSON (ข้อความ) -> แถวมาตรฐาน */
export function rowsFromTextFile(name: string, buf: ArrayBuffer, def: EntityDef<any>): string[][] {
  if (buf.byteLength > MAX_BYTES) throw new Error(`ไฟล์ใหญ่เกิน ${MAX_BYTES / 1024 / 1024} MB`);
  const ext = name.toLowerCase().split('.').pop();
  const text = decodeText(buf);
  if (ext === 'json') {
    let data: unknown;
    try { data = JSON.parse(text); } catch (e) { throw new Error('อ่าน JSON ไม่ได้: ' + (e as Error).message); }
    return rowsFromJson(data, def);
  }
  return alignRows(parseCsv(text), def);
}

// ---------- สร้างไฟล์ Template / ส่งออก ----------
const csvCell = (v: string) => (/[",;\n\r\t]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV (ใส่ BOM เพื่อให้ Excel เปิดภาษาไทยถูก) */
export function toCsv(rows: string[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** JSON อาร์เรย์ของอ็อบเจ็กต์ คีย์เป็นหัวคอลัมน์ไทย (ตัดวงเล็บ) */
export function toJsonObjects(def: EntityDef<any>, rows: string[][]): unknown[] {
  const keys = def.headers.map((h) => h.replace(/\s*\(.*$/, ''));
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}
