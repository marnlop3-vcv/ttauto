import ExcelJS from 'exceljs';
import { EntityDef, Ctx } from './entities';
import { cellText, GridData } from './views';
import { alignRows, MAX_BYTES, MAX_ROWS, rowsFromTextFile, toCsv, toJsonObjects } from './tabular';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type TemplateFormat = 'xlsx' | 'csv' | 'json';

export async function downloadTemplate<T>(def: EntityDef<T>, format: TemplateFormat = 'xlsx') {
  if (format === 'csv') {
    // CSV: หัวตารางอย่างเดียว (ตัวอย่างอยู่ในคู่มือ) เพื่อไม่ให้ตัวอย่างหลุดเข้าระบบโดยไม่ตั้งใจ
    return downloadBlob(new Blob([toCsv([def.headers])], { type: 'text/csv;charset=utf-8' }), `template_${def.label}.csv`);
  }
  if (format === 'json') {
    const obj = {
      _คำอธิบาย: `กรอกรายการในคีย์ "${def.kind}" (แต่ละรายการเป็นอ็อบเจ็กต์ คีย์ตามหัวตาราง) — คีย์ที่ขึ้นต้นด้วย _ ถูกข้าม: ${def.notes.join(' / ')}`,
      _ตัวอย่าง: toJsonObjects(def, def.example),
      [def.kind]: [],
    };
    return downloadBlob(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), `template_${def.label}.json`);
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('ข้อมูล');
  ws.addRow(def.headers);
  styleHeader(ws.getRow(1));
  def.headers.forEach((h, i) => (ws.getColumn(i + 1).width = Math.max(18, h.length + 6)));
  ws.getColumn(def.headers.length).width = Math.max(ws.getColumn(def.headers.length).width ?? 0, 24);
  const help = wb.addWorksheet('ตัวอย่างและคำอธิบาย');
  help.addRow(['ตัวอย่างข้อมูล (คัดลอกรูปแบบไปกรอกในชีต "ข้อมูล" — อย่ากรอกในชีตนี้)']).font = { bold: true };
  help.addRow(def.headers);
  styleHeader(help.getRow(2));
  def.example.forEach((r) => help.addRow(r));
  help.addRow([]);
  help.addRow(['คำอธิบาย']).font = { bold: true };
  def.notes.forEach((n) => help.addRow(['• ' + n]));
  def.headers.forEach((_, i) => (help.getColumn(i + 1).width = 28));
  downloadBlob(new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME }), `template_${def.label}.xlsx`);
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  row.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F6D8F' } };
    c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  });
}

function cellToString(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    const o = v as any;
    if (Array.isArray(o.richText)) return o.richText.map((r: any) => r.text).join('');
    if (o.result !== undefined) return String(o.result ?? '');
    if (o.text !== undefined) return String(o.text);
    if (v instanceof Date) return v.toISOString();
  }
  return String(v);
}

export async function readFirstSheet(file: File): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('ไม่พบชีตในไฟล์');
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row, n) => {
    const vals: string[] = [];
    for (let c = 1; c <= row.cellCount; c++) vals.push(cellToString(row.getCell(c).value).trim());
    rows[n - 1] = vals;
  });
  return rows;
}

export interface ImportReport<T> { items: Omit<T, 'id'>[]; errors: string[]; skipped: number }

/** อ่านไฟล์ .xlsx / .csv / .json -> แถวมาตรฐาน (แถวแรก = หัวตารางของ def) */
export async function readRowsFromFile(file: File, def: EntityDef<any>): Promise<string[][]> {
  if (file.size > MAX_BYTES) throw new Error(`ไฟล์ใหญ่เกิน ${MAX_BYTES / 1024 / 1024} MB`);
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'csv' || ext === 'json' || ext === 'txt') return rowsFromTextFile(ext === 'txt' ? 'x.csv' : file.name, await file.arrayBuffer(), def);
  if (ext === 'xlsx') {
    const rows = await readFirstSheet(file);
    if (rows.length > MAX_ROWS + 1) throw new Error(`ไฟล์มีมากกว่า ${MAX_ROWS.toLocaleString()} แถว`);
    return alignRows(rows.map((r) => r ?? []), def);
  }
  throw new Error(`ไม่รองรับไฟล์ .${ext} (รองรับ .xlsx .csv .json — ไฟล์ .xls เก่าให้บันทึกเป็น .xlsx หรือ "CSV UTF-8" ก่อน)`);
}

/** วิเคราะห์ไฟล์: อ่าน, ตรวจแต่ละแถว (กฎเดียวกับฟอร์ม), ตรวจซ้ำ แล้วรายงานผล */
export async function analyzeImport<T>(
  file: File, def: EntityDef<T>, ctx: Ctx, existing: Omit<T, 'id'>[],
): Promise<ImportReport<T>> {
  const errors: string[] = [];
  const items: Omit<T, 'id'>[] = [];
  let rows: string[][];
  try {
    rows = await readRowsFromFile(file, def);
  } catch (e) {
    return { items, errors: [(e as Error).message], skipped: 0 };
  }
  const seen = new Set(existing.map((e) => def.identity(e)));
  let skipped = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c)) continue;
    const r = def.fromRow(row, ctx);
    if (!r.value) { errors.push(`แถว ${i + 1}: ${r.error}`); skipped++; continue; }
    const key = def.identity(r.value);
    if (seen.has(key)) { errors.push(`แถว ${i + 1}: "${key}" มีอยู่แล้วในระบบหรือซ้ำในไฟล์`); skipped++; continue; }
    seen.add(key);
    items.push(r.value);
  }
  if (!items.length && !errors.length) errors.push('ไม่พบข้อมูลในไฟล์ (กรอกข้อมูลตั้งแต่แถวที่ 2)');
  return { items, errors, skipped };
}

export async function exportTimetableExcel(grids: GridData[], filename: string) {
  const wb = new ExcelJS.Workbook();
  const used = new Set<string>();
  grids.forEach((g, idx) => {
    let name = g.title.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || `Sheet${idx + 1}`;
    while (used.has(name)) name = name.slice(0, 25) + `_${idx + 1}`;
    used.add(name);
    const ws = wb.addWorksheet(name, { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    const hasLunch = g.lunchAfter > 0;
    const cols = 1 + g.periods.length + (hasLunch ? 1 : 0);
    ws.mergeCells(1, 1, 1, cols);
    ws.getCell(1, 1).value = g.title;
    ws.getCell(1, 1).font = { bold: true, size: 16 };
    ws.getCell(1, 1).alignment = { horizontal: 'center' };
    ws.mergeCells(2, 1, 2, cols);
    ws.getCell(2, 1).value = g.subtitle;
    ws.getCell(2, 1).alignment = { horizontal: 'center' };

    const header: string[] = ['วัน / คาบ'];
    g.periods.forEach((p, i) => {
      header.push(`${p.label}\n${p.time}`);
      if (hasLunch && i + 1 === g.lunchAfter) header.push('พักเที่ยง');
    });
    const hr = ws.addRow(header);
    hr.height = 34;
    styleHeader(hr);
    ws.getColumn(1).width = 14;
    for (let c = 2; c <= cols; c++) ws.getColumn(c).width = 24;
    // คอลัมน์ของคาบที่ i (0-based) ในชีต
    const colOf = (i: number) => 2 + i + (hasLunch && i >= g.lunchAfter ? 1 : 0);
    const border = { top: { style: 'thin' as const }, bottom: { style: 'thin' as const }, left: { style: 'thin' as const }, right: { style: 'thin' as const } };

    g.rows.forEach((r) => {
      const row = ws.addRow([r.dayLabel]);
      const rowNo = row.number;
      let maxLines = 3;
      for (const c of r.cells) {
        const text = cellText(c.items);
        maxLines = Math.max(maxLines, text.split('\n').length);
        const col = colOf(c.from);
        const cell = ws.getCell(rowNo, col);
        cell.value = text;
        if (c.span > 1) ws.mergeCells(rowNo, col, rowNo, colOf(c.from + c.span - 1)); // คาบติดกันรวมเป็นช่องเดียว
      }
      row.height = Math.min(120, maxLines * 15 + 6);
      for (let ci = 1; ci <= cols; ci++) {
        const c = ws.getCell(rowNo, ci);
        c.alignment = { vertical: 'middle', horizontal: ci === 1 ? 'center' : 'left', wrapText: true };
        c.border = border;
        if (ci === 1) { c.font = { bold: true }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF4' } }; }
        else if (hasLunch && ci === g.lunchAfter + 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F1F1' } };
      }
    });
    if (hasLunch) {
      const col = g.lunchAfter + 2;
      ws.getColumn(col).width = 8;
      const first = ws.getCell(4, col);
      first.value = 'พักเที่ยง';
      first.alignment = { textRotation: 90, horizontal: 'center', vertical: 'middle' };
      ws.mergeCells(4, col, 3 + g.rows.length, col);
    }

    // ---- สรุปจำนวนคาบต่อสัปดาห์ ----
    ws.addRow([]);
    const sr = ws.addRow([`สรุปต่อสัปดาห์: รวม ${g.summary.total} ${g.summary.totalLabel}${g.summary.special ? ` + กรณีพิเศษ ${g.summary.special} คาบ` : ''}`]);
    sr.font = { bold: true, size: 13 };
    ws.mergeCells(sr.number, 1, sr.number, cols);
    for (const it of g.summary.items) {
      const r = ws.addRow([it.label, '', `${it.count} คาบ`]);
      ws.mergeCells(r.number, 1, r.number, 2);
      for (let ci = 1; ci <= 3; ci++) r.getCell(ci).border = border;
      r.getCell(3).alignment = { horizontal: 'center' };
    }
  });
  downloadBlob(new Blob([await wb.xlsx.writeBuffer()], { type: XLSX_MIME }), filename);
}
