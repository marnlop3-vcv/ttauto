import { describe, it, expect } from 'vitest';
import { alignRows, decodeText, MAX_ROWS, parseCsv, rowsFromJson, rowsFromTextFile, toCsv, toJsonObjects } from '../src/lib/tabular';
import { buildingDef, groupDef, specialDef, teacherDef } from '../src/lib/entities';

const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
const settings = { days: [0, 1, 2, 3, 4], periods: Array.from({ length: 8 }, () => ({ start: '08:00', end: '09:00' })), lunchAfter: 4 };

describe('CSV', () => {
  it('ตัด BOM และอ่านหัว/ข้อมูลพื้นฐาน', () => {
    const r = parseCsv('﻿ชื่อครู,หน้าที่\nสมศรี,ครูสอนหลัก\n');
    expect(r).toEqual([['ชื่อครู', 'หน้าที่'], ['สมศรี', 'ครูสอนหลัก']]);
  });
  it('เครื่องหมายคำพูด: คอมมา, "" และขึ้นบรรทัดใหม่ในช่อง, CRLF', () => {
    const r = parseCsv('a,b\r\n"x, y","He said ""hi"""\r\n"line1\nline2",z\r\n');
    expect(r[1]).toEqual(['x, y', 'He said "hi"']);
    expect(r[2]).toEqual(['line1\nline2', 'z']);
  });
  it('ตัวคั่น ; และ Tab ตรวจอัตโนมัติ', () => {
    expect(parseCsv('a;b;c\n1;2;3')[1]).toEqual(['1', '2', '3']);
    expect(parseCsv('a\tb\n1\t2')[1]).toEqual(['1', '2']);
  });
  it('เก็บบรรทัดว่างกลางไฟล์ (เลขแถวตรงกับโปรแกรมตาราง) แต่ตัดท้ายไฟล์', () => {
    const r = parseCsv('a,b\n1,2\n\n3,4\n\n\n');
    expect(r).toHaveLength(4);
    expect(r[2].every((c) => c === '')).toBe(true);
  });
  it('รหัสที่ขึ้นต้นด้วย 0 คงเป็นข้อความ', () => {
    expect(parseCsv('code\n06701')[1][0]).toBe('06701');
  });
  it('toCsv -> parseCsv ย้อนกลับได้ (มีคอมมา/เครื่องหมายคำพูด)', () => {
    const rows = [['ก', 'ข'], ['a,b', 'c"d'], ['x\ny', '']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
    expect(toCsv(rows).startsWith('﻿')).toBe(true);
  });
  it('เกินจำนวนแถวที่กำหนดต้อง error', () => {
    const big = 'a\n' + Array.from({ length: MAX_ROWS + 5 }, () => '1').join('\n');
    expect(() => parseCsv(big)).toThrow();
  });
});

describe('ถอดรหัสข้อความ', () => {
  it('UTF-8 มี BOM', () => {
    const b = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode('ครู')]);
    expect(decodeText(b.buffer as ArrayBuffer)).toBe('ครู');
  });
  it('Windows-874 (CSV ไทยจาก Excel เก่า)', () => {
    // "ครู" ใน TIS-620/Windows-874 = A4 C3 D9
    expect(decodeText(new Uint8Array([0xa4, 0xc3, 0xd9]).buffer as ArrayBuffer)).toBe('ครู');
  });
  it('UTF-16LE มี BOM', () => {
    const s = 'ครู';
    const b = new Uint8Array([0xff, 0xfe, ...[...s].flatMap((c) => [c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8])]);
    expect(decodeText(b.buffer as ArrayBuffer)).toBe('ครู');
  });
});

describe('จับคู่หัวคอลัมน์', () => {
  it('สลับลำดับคอลัมน์ + มีคอลัมน์เกิน', () => {
    const r = alignRows([['หน้าที่', 'อื่นๆ', 'ชื่อครู'], ['ครูสอนร่วม', 'x', 'สมชาย']], teacherDef);
    expect(r[1]).toEqual(['สมชาย', 'ครูสอนร่วม']);
  });
  it('หัวเป็นภาษาอังกฤษ (alias) และไม่สนตัวพิมพ์', () => {
    const r = alignRows([['Name', 'Role'], ['สมชาย', 'ครูสอนหลัก']], teacherDef);
    expect(r[1]).toEqual(['สมชาย', 'ครูสอนหลัก']);
  });
  it('หัวมีวงเล็บตาม Template ใช้ได้', () => {
    const r = alignRows([['ชื่อครู', 'หน้าที่ (ครูสอนหลัก/ครูสอนร่วม)'], ['ก', 'ครูสอนหลัก']], teacherDef);
    expect(r[1][1]).toBe('ครูสอนหลัก');
  });
  it('คอลัมน์ท้ายที่ไม่มีในไฟล์เป็นค่าว่าง (กรณีพิเศษ)', () => {
    const r = alignRows([['ชื่อกรณีพิเศษ', 'จำนวนคาบ', 'เงื่อนไข'], ['กิจกรรม', '1', 'ทุกวันคาบที่ 1']], specialDef);
    expect(r[1]).toEqual(['กิจกรรม', '1', 'ทุกวันคาบที่ 1', '', '']);
  });
  it('หัวไม่ตรงเลย -> error ที่อ่านรู้เรื่อง', () => {
    expect(() => alignRows([['foo', 'bar'], ['1', '2']], teacherDef)).toThrow(/หัวตารางไม่ตรง/);
  });
});

describe('JSON', () => {
  it('อาร์เรย์ของอ็อบเจ็กต์ คีย์ไทย', () => {
    const r = rowsFromJson([{ ชื่อครู: 'สมศรี', หน้าที่: 'ครูสอนหลัก' }], teacherDef);
    expect(r[1]).toEqual(['สมศรี', 'ครูสอนหลัก']);
  });
  it('คีย์อังกฤษ + ตัวเลขถูกแปลงเป็นข้อความ', () => {
    const r = rowsFromJson([{ name: 'A', floors: 3, roomsPerFloor: 6 }], buildingDef);
    expect(r[1]).toEqual(['A', '3', '6']);
  });
  it('อ็อบเจ็กต์ห่อด้วยคีย์ kind / ชื่อไทย และข้ามคีย์ที่ขึ้นต้นด้วย _', () => {
    expect(rowsFromJson({ _คำอธิบาย: 'x', _ตัวอย่าง: [{ ชื่อครู: 'ตัวอย่าง' }], teachers: [{ name: 'จริง', role: 'ครูสอนหลัก' }] }, teacherDef)[1][0]).toBe('จริง');
    expect(rowsFromJson({ ครู: [{ name: 'ไทย', role: 'co' }] }, teacherDef)[1][0]).toBe('ไทย');
  });
  it('อาร์เรย์ของอาร์เรย์ และค่าอาร์เรย์ในช่อง (รหัสกลุ่มหลายตัว) รวมด้วยคอมมา', () => {
    expect(rowsFromJson([['A', 'ครูสอนหลัก']], teacherDef)[1]).toEqual(['A', 'ครูสอนหลัก']);
    expect(rowsFromJson([{ name: 'ชุมนุม', count: 2, condition: 'พุธ คาบ 7', groups: ['6701', '6702'] }], specialDef)[1][3]).toBe('6701,6702');
  });
  it('ไม่ merge คีย์แปลก/__proto__ เข้าอ็อบเจ็กต์ใดๆ', () => {
    const data = JSON.parse('[{"__proto__": {"polluted": true}, "ชื่อครู": "A", "หน้าที่": "ครูสอนหลัก"}]');
    const r = rowsFromJson(data, teacherDef);
    expect(r[1]).toEqual(['A', 'ครูสอนหลัก']);
    expect(({} as any).polluted).toBeUndefined();
  });
  it('error: ไม่ใช่อาร์เรย์ / ไม่มีคีย์ที่รู้จัก / รายการไม่ใช่อ็อบเจ็กต์', () => {
    expect(() => rowsFromJson({ foo: 1 }, teacherDef)).toThrow();
    expect(() => rowsFromJson([{ x: 1 }], teacherDef)).toThrow(/ไม่พบคีย์/);
    expect(() => rowsFromJson(['abc'], teacherDef)).toThrow(/ไม่ใช่อ็อบเจ็กต์/);
  });
  it('rowsFromTextFile: JSON เสีย -> ข้อความ error ไทย; ไฟล์ใหญ่เกิน -> error', () => {
    expect(() => rowsFromTextFile('a.json', enc('{bad'), teacherDef)).toThrow(/อ่าน JSON ไม่ได้/);
    expect(() => rowsFromTextFile('a.csv', new ArrayBuffer(6 * 1024 * 1024), teacherDef)).toThrow(/ใหญ่เกิน/);
  });
});

describe('นำเข้า CSV/JSON ผ่านกฎตรวจเดียวกับฟอร์ม', () => {
  const ctx = { settings, groups: [{ id: 'g1', code: '6701', name: 'ก', major: '' }], teachers: [{ id: 't1', name: 'สมศรี', role: 'main' as const }] };
  it('CSV กรณีพิเศษ + อ้างอิงกลุ่ม/ครู', () => {
    const rows = rowsFromTextFile('s.csv', enc('ชื่อกรณีพิเศษ,จำนวนคาบ,เงื่อนไข,รหัสกลุ่มเรียนที่เกี่ยวข้อง,ชื่อครูที่เกี่ยวข้อง\nประชุม,2,"วันอังคาร คาบ 1-2",6701,สมศรี\n'), specialDef);
    const r = specialDef.fromRow(rows[1], ctx);
    expect(r.error).toBeUndefined();
    expect(r.value!.groupIds).toEqual(['g1']);
    expect(r.value!.teacherIds).toEqual(['t1']);
  });
  it('อ้างอิงกลุ่มที่ไม่มีในระบบ -> error ชัดเจน', () => {
    const rows = rowsFromTextFile('s.csv', enc('ชื่อกรณีพิเศษ,จำนวนคาบ,เงื่อนไข,รหัสกลุ่มเรียนที่เกี่ยวข้อง\nก,1,ทุกวันคาบที่ 1,9999\n'), specialDef);
    expect(specialDef.fromRow(rows[1], ctx).error).toContain('ไม่พบกลุ่มเรียน');
  });
  it('toRow -> toCsv -> นำเข้ากลับได้ค่าเดิม', () => {
    const item = { code: '06701', name: 'ปวช.1/1, A', major: 'บัญชี "ดี"' };
    const csv = toCsv([groupDef.headers, groupDef.toRow(item, ctx)]);
    const back = groupDef.fromRow(rowsFromTextFile('g.csv', enc(csv), groupDef)[1], ctx);
    expect(back.value).toEqual(item);
    expect(toJsonObjects(groupDef, [groupDef.toRow(item, ctx)])[0]).toMatchObject({ รหัสกลุ่มเรียน: '06701' });
  });
});
