import { describe, it, expect } from 'vitest';
import {
  b64decode, b64encode, canonicalPass, checkPasscode, decryptJson, encryptJson, generatePasscode, hashPass, verifyPass,
} from '../src/auth/crypto';
import { buildPayloads, buildPublished, isPublishedFile, openPublished } from '../src/auth/bundle';
import { makeSample } from '../src/lib/sample';
import { generateSchedule } from '../src/lib/scheduler';

describe('เข้ารหัส/ถอดรหัส', () => {
  const data = { ชื่อ: 'ตารางสอน', n: [1, 2, 3], big: 'ก'.repeat(5000) };

  it('เข้ารหัสแล้วถอดกลับด้วยรหัสเดิมได้', async () => {
    const e = await encryptJson(data, 'correct horse battery');
    expect(await decryptJson(e, 'correct horse battery')).toEqual(data);
  });
  it('รหัสผิด -> null (ไม่ throw)', async () => {
    const e = await encryptJson(data, 'correct horse battery');
    expect(await decryptJson(e, 'correct horse batterY')).toBeNull();
    expect(await decryptJson(e, '')).toBeNull();
  });
  it('ไฟล์ถูกแก้ (ciphertext / iv / salt) -> ถอดไม่ได้', async () => {
    const e = await encryptJson(data, 'pass-12345678');
    const flip = (s: string) => { const b = b64decode(s); b[0] ^= 1; return b64encode(b); };
    expect(await decryptJson({ ...e, ct: flip(e.ct) }, 'pass-12345678')).toBeNull();
    expect(await decryptJson({ ...e, iv: flip(e.iv) }, 'pass-12345678')).toBeNull();
    expect(await decryptJson({ ...e, salt: flip(e.salt) }, 'pass-12345678')).toBeNull();
  });
  it('salt/iv สุ่มใหม่ทุกครั้ง', async () => {
    const a = await encryptJson(data, 'pass-12345678');
    const b = await encryptJson(data, 'pass-12345678');
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });
  it('ซองปลอมที่สั่งจำนวนรอบผิดปกติ/รูปแบบผิด ถูกปฏิเสธทันที ไม่ค้าง', async () => {
    const e = await encryptJson(data, 'pass-12345678');
    const t0 = performance.now();
    expect(await decryptJson({ ...e, iter: 2_000_000_000 }, 'pass-12345678')).toBeNull();
    expect(await decryptJson({ ...e, iter: 1 }, 'pass-12345678')).toBeNull();
    expect(await decryptJson({} as any, 'x')).toBeNull();
    expect(await decryptJson(null as any, 'x')).toBeNull();
    expect(performance.now() - t0).toBeLessThan(500);
  });
  it('ข้อความเข้ารหัสไม่มีข้อความต้นฉบับปนอยู่', async () => {
    const e = await encryptJson({ secret: 'นางสมศรีใจดี-SECRET' }, 'pass-12345678');
    const raw = JSON.stringify(e);
    expect(raw).not.toContain('SECRET');
    expect(raw).not.toContain('นางสมศรี');
  });
  it('base64 ข้อมูลใหญ่ย้อนกลับได้', () => {
    const big = new Uint8Array(200_000).map((_, i) => i % 251);
    expect(b64decode(b64encode(big))).toEqual(big);
  });
});

describe('รหัสผ่าน', () => {
  it('รหัสที่สร้างให้: รูปแบบ ABCD-EFGH-JKLM, ไม่ซ้ำ, ไม่มีตัวสับสน, ผ่านเกณฑ์ "แข็งแรง"', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generatePasscode();
      expect(p).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(checkPasscode(p).level).toBe('strong');
      seen.add(p);
    }
    expect(seen.size).toBe(200);
  });
  it('canonicalPass: รหัสที่สร้างให้พิมพ์เล็ก/ไม่มีขีด/มีช่องว่างได้ ส่วนรหัสตั้งเองคงเดิม (แยกตัวพิมพ์)', () => {
    expect(canonicalPass('abcd-efgh-jkmn')).toBe('ABCDEFGHJKMN');
    expect(canonicalPass(' ABCD EFGH JKMN ')).toBe('ABCDEFGHJKMN');
    expect(canonicalPass('  My Secret Phrase  ')).toBe('My Secret Phrase');
    expect(canonicalPass('abc')).toBe('abc');
  });
  it('รหัสสั้น/เดาง่ายถูกปฏิเสธ รหัสยาวผ่าน', () => {
    for (const bad of ['1234', '12345678', '1234567890', 'password123', 'aaaaaaaaaa', 'qwertyuiop12']) {
      expect(checkPasscode(bad).level, bad).toBe('weak');
      expect(checkPasscode(bad).problem).toBeTruthy();
    }
    expect(checkPasscode('ครูใหญ่โรงเรียนสวนกุหลาบ 2569').level).not.toBe('weak');
    expect(checkPasscode('correct horse battery staple').level).toBe('strong');
  });
  it('hash/verify รหัสผู้ดูแล', async () => {
    const h = await hashPass('admin-secret-2569');
    expect(await verifyPass('admin-secret-2569', h)).toBe(true);
    expect(await verifyPass('admin-secret-2570', h)).toBe(false);
    expect(h.hash).not.toContain('admin');
  });
});

describe('ไฟล์เผยแพร่ (ซองนักเรียน / ซองครู)', () => {
  const sample = makeSample('medium') as any;
  const schedule = generateSchedule(sample, { timeLimitMs: 1500, seed: 1 });
  const data = { ...sample, schedule, stale: false } as any;
  const SP = 'STUDENT-pass-2569';
  const TP = 'TEACHER-pass-2569';

  it('ซองนักเรียนมีเฉพาะตารางรายกลุ่ม; ซองครูมีเฉพาะตารางรายครู', () => {
    const { student, teacher } = buildPayloads(data, 'ภาคเรียน 1/2569', 1);
    expect(student.kind).toBe('student');
    expect(student.items).toHaveLength(12);
    expect(student.items.every((i) => i.grid.title.startsWith('ตารางเรียนกลุ่ม'))).toBe(true);
    const names = new Set(sample.teachers.map((t: any) => t.name));
    expect(teacher.items).toHaveLength(names.size);
    expect(teacher.items.every((i) => i.grid.title.startsWith('ตารางสอนครู'))).toBe(true);
  });
  it('ซองนักเรียนไม่มีข้อมูลดิบ (กำหนดการเรียน/รายชื่อครูทั้งหมด/การตั้งค่า) — มีเฉพาะที่แสดงในตาราง', () => {
    const { student } = buildPayloads(data, 't', 1);
    const keys = new Set<string>();
    const walk = (o: any) => { if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { keys.add(k); walk(v); } };
    walk(student);
    for (const forbidden of ['assignments', 'teachers', 'mainTeacherIds', 'coTeacherIds', 'groupIds', 'teacherIds', 'subjects', 'buildings', 'specialCases', 'schedule', 'entries']) {
      expect(keys.has(forbidden), forbidden).toBe(false);
    }
    // รายชื่อครูที่ไม่ได้สอนกลุ่มใดเลยต้องไม่ปรากฏ (ซองนักเรียนมีเฉพาะครูที่สอนในตาราง)
    const text = JSON.stringify(student);
    const unused = sample.teachers.filter((t: any) => !JSON.stringify(sample.assignments).includes(t.id));
    for (const t of unused) expect(text).not.toContain(t.name);
  });
  it('รหัสนักเรียน -> student, รหัสครู -> teacher, รหัสอื่น/ว่าง -> null', async () => {
    const file = await buildPublished(data, { title: 'ภาคเรียน 1/2569', studentPass: SP, teacherPass: TP });
    expect(isPublishedFile(file)).toBe(true);
    const s = await openPublished(file, SP);
    const t = await openPublished(file, TP);
    expect(s?.kind).toBe('student');
    expect(s?.title).toBe('ภาคเรียน 1/2569');
    expect(t?.kind).toBe('teacher');
    expect(await openPublished(file, 'wrong-pass-12345')).toBeNull();
    expect(await openPublished(file, '')).toBeNull();
    expect(await openPublished(file, `  ${SP}  `)).not.toBeNull(); // ช่องว่างหัวท้ายไม่เป็นปัญหา
  });
  it('รหัสนักเรียนถอดซองครูไม่ได้ (และกลับกัน)', async () => {
    const file = await buildPublished(data, { title: 't', studentPass: SP, teacherPass: TP });
    expect(await decryptJson(file.teacher, SP)).toBeNull();
    expect(await decryptJson(file.student, TP)).toBeNull();
  });
  it('ซองถูกสลับในไฟล์ -> ไม่ได้สิทธิ์ผิดบทบาท', async () => {
    const file = await buildPublished(data, { title: 't', studentPass: SP, teacherPass: TP });
    const swapped = { ...file, student: file.teacher, teacher: file.student };
    expect(await openPublished(swapped, SP)).toBeNull();
    expect(await openPublished(swapped, TP)).toBeNull();
  });
  it('ไฟล์เผยแพร่ไม่มีข้อความตารางหลุดออกมาแบบอ่านได้', async () => {
    const file = await buildPublished(data, { title: 'ชื่อชุดลับ', studentPass: SP, teacherPass: TP });
    const raw = JSON.stringify(file);
    expect(raw).not.toContain('ชื่อชุดลับ');
    expect(raw).not.toContain(sample.teachers[0].name);
    expect(raw).not.toContain(sample.groups[0].name);
  });
  it('ตัวอย่างขนาดใหญ่: สร้างไฟล์ + ถอดรหัสได้เร็วพอ และไฟล์ไม่ใหญ่เกินไป', async () => {
    const big = makeSample('large') as any;
    const d = { ...big, schedule: generateSchedule(big, { timeLimitMs: 1500, seed: 1 }), stale: false } as any;
    const t0 = performance.now();
    const file = await buildPublished(d, { title: 'x', studentPass: SP, teacherPass: TP });
    const t1 = performance.now();
    const s = await openPublished(file, SP);
    const t2 = performance.now();
    const kb = Math.round(JSON.stringify(file).length / 1024);
    console.log(`large: build ${(t1 - t0).toFixed(0)}ms, open ${(t2 - t1).toFixed(0)}ms, file ${kb} KB, ${s?.items.length} กลุ่ม`);
    expect(s?.items).toHaveLength(30);
    expect(kb).toBeLessThan(2000);
    expect(t2 - t1).toBeLessThan(3000);
  }, 60000);
});
