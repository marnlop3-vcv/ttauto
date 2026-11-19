// สร้างไฟล์ตัวอย่าง 3 ขนาด: sample-data/{small,medium,large}/  (รัน: npm run make-samples)
import ExcelJS from 'exceljs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { buildingDef, EntityDef, groupDef, specialDef, subjectDef, teacherDef } from '../src/lib/entities';
import { makeSample, SAMPLE_LABEL, sampleInfo, SampleSize } from '../src/lib/sample';
import { toCsv, toJsonObjects } from '../src/lib/tabular';

const root = new URL('../sample-data/', import.meta.url).pathname;

const ENTITIES: { file: string; def: EntityDef<any>; key: string }[] = [
  { file: 'teachers', def: teacherDef, key: 'teachers' },
  { file: 'groups', def: groupDef, key: 'groups' },
  { file: 'subjects', def: subjectDef, key: 'subjects' },
  { file: 'buildings', def: buildingDef, key: 'buildings' },
  { file: 'special_cases', def: specialDef, key: 'specialCases' },
];

for (const size of ['small', 'medium', 'large'] as SampleSize[]) {
  const d = makeSample(size) as any;
  const info = sampleInfo(size);
  const dir = `${root}${size}/`;
  mkdirSync(dir, { recursive: true });
  const ctx = { settings: d.settings, groups: d.groups, teachers: d.teachers };

  for (const { file, def, key } of ENTITIES) {
    const rows: string[][] = d[key].map((it: any) => def.toRow(it, ctx));
    // Excel
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('ข้อมูล');
    ws.addRow(def.headers).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((c) => (c.width = 28));
    await wb.xlsx.writeFile(`${dir}${file}.xlsx`);
    // CSV (UTF-8 BOM) และ JSON
    writeFileSync(`${dir}${file}.csv`, toCsv([def.headers, ...rows]));
    writeFileSync(`${dir}${file}.json`, JSON.stringify(toJsonObjects(def, rows), null, 2));
  }
  // ชุดสมบูรณ์ (รวมกำหนดการเรียนและการตั้งค่าคาบ) ใช้ปุ่ม "กู้คืนข้อมูล"
  const { settings, teachers, groups, subjects, buildings, specialCases, assignments } = d;
  writeFileSync(`${dir}dataset.json`, JSON.stringify({ settings, teachers, groups, subjects, buildings, specialCases, assignments, schedule: null }, null, 2));

  writeFileSync(`${dir}README.txt`, `ข้อมูลตัวอย่างขนาด${SAMPLE_LABEL[size]}
${info.groups} กลุ่มเรียน • ${info.subjects} วิชา • ${info.teachers} ครู • ${info.buildings} อาคาร • ${info.periods} คาบเรียน/สัปดาห์

วิธีใช้ 1 (ง่ายที่สุด): กรอกข้อมูล › กู้คืนข้อมูล › เลือก dataset.json
   ได้ข้อมูลครบทุกส่วน รวมการตั้งค่าคาบเรียนและกำหนดการเรียน แล้วไป Dashboard กด "จัดตารางอัตโนมัติ"

วิธีใช้ 2 (ทดสอบ Import): ตั้งค่าคาบเรียนก่อน (จันทร์-ศุกร์ 8 คาบ พักเที่ยงหลังคาบ 4) แล้ว Import ตามลำดับ
   1) teachers  2) groups  3) subjects  4) buildings  5) special_cases   (ไฟล์ .xlsx / .csv / .json ใช้แทนกันได้)
   ส่วน "กำหนดการเรียน" ไม่มีไฟล์ Import รายส่วน ให้กรอกในหน้าเว็บ หรือใช้ dataset.json
`);
  console.log(`${size}: ${info.groups} groups, ${info.teachers} teachers, ${info.periods} periods -> ${dir}`);
}
