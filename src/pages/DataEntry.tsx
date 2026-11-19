import { useMemo, useRef, useState } from 'react';
import { buildingDef, groupDef, roleLabel, subjectDef, teacherDef } from '../lib/entities';
import { makeSample, SAMPLE_LABEL, SampleInfo, sampleInfo, SampleSize } from '../lib/sample';
import { downloadBlob } from '../lib/excel';
import { useStore } from '../store';
import { roomLabel } from '../types';
import AssignmentTab from './tabs/AssignmentTab';
import EntityTab from './tabs/EntityTab';
import SettingsTab from './tabs/SettingsTab';
import SpecialTab from './tabs/SpecialTab';

const TABS = ['ตั้งค่าคาบเรียน', 'ครู', 'กลุ่มเรียน', 'วิชาเรียน', 'ห้องเรียน', 'กรณีพิเศษ', 'กำหนดการเรียน'] as const;
type Tab = (typeof TABS)[number];

export default function DataEntry() {
  const [tab, setTab] = useState<Tab>('ตั้งค่าคาบเรียน');
  const st = useStore();
  const restore = useRef<HTMLInputElement>(null);
  const infos = useMemo(() => Object.fromEntries((['small', 'medium', 'large'] as SampleSize[]).map((z) => [z, sampleInfo(z)])) as Record<SampleSize, SampleInfo>, []);
  const loadSample = (z: SampleSize) => {
    const i = infos[z];
    if (window.confirm(`โหลดตัวอย่างขนาด${SAMPLE_LABEL[z]} (${i.groups} กลุ่มเรียน ${i.teachers} ครู ${i.periods} คาบ/สัปดาห์)? ข้อมูลปัจจุบันจะถูกแทนที่`)) st.replaceAll(makeSample(z));
  };

  const backup = () => {
    const { settings, teachers, groups, subjects, buildings, specialCases, assignments, schedule } = st;
    downloadBlob(new Blob([JSON.stringify({ settings, teachers, groups, subjects, buildings, specialCases, assignments, schedule }, null, 2)], { type: 'application/json' }), 'timetable-backup.json');
  };
  const onRestore = async (f: File) => {
    try {
      const d = JSON.parse(await f.text());
      if (!d.settings || !Array.isArray(d.teachers)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
      if (window.confirm('กู้คืนข้อมูลจากไฟล์นี้? ข้อมูลปัจจุบันจะถูกแทนที่')) st.replaceAll(d);
    } catch (e) { window.alert('กู้คืนไม่สำเร็จ: ' + (e as Error).message); }
    if (restore.current) restore.current.value = '';
  };

  return (
    <>
      <h1>กรอกข้อมูล</h1>
      <p className="page-sub">กรอกข้อมูลทีละส่วน หรือ Import จาก Excel แล้วไปที่ Dashboard เพื่อจัดตาราง</p>
      <div className="card" style={{ padding: '12px 18px' }}>
        <div className="toolbar">
          <b>เครื่องมือ</b>
          <span className="btn-group" role="group" aria-label="โหลดข้อมูลตัวอย่าง">
            <span className="btn-group-label">ข้อมูลตัวอย่าง</span>
            {(['small', 'medium', 'large'] as SampleSize[]).map((z) => (
              <button key={z} className="btn sm" onClick={() => loadSample(z)}
                title={`${infos[z].groups} กลุ่มเรียน • ${infos[z].subjects} วิชา • ${infos[z].teachers} ครู • ${infos[z].buildings} อาคาร • ${infos[z].periods} คาบ/สัปดาห์`}>
                {SAMPLE_LABEL[z]} ({infos[z].groups} กลุ่ม)
              </button>
            ))}
          </span>
          <button className="btn sm" onClick={backup}>สำรองข้อมูล (JSON)</button>
          <button className="btn sm" onClick={() => restore.current?.click()}>กู้คืนข้อมูล</button>
          <input ref={restore} type="file" accept=".json" hidden onChange={(e) => e.target.files?.[0] && onRestore(e.target.files[0])} />
          <span className="spacer" />
          <button className="btn danger sm" onClick={() => window.confirm('ล้างข้อมูลทั้งหมดในระบบ? ไม่สามารถกู้คืนได้') && st.clearAll()}>ล้างข้อมูลทั้งหมด</button>
        </div>
      </div>
      <div className="tabs">
        {TABS.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'ตั้งค่าคาบเรียน' && <SettingsTab />}
      {tab === 'ครู' && (
        <EntityTab def={teacherDef} title="ครู" addLabel="เพิ่มครู" items={st.teachers} nameOf={(t) => t.name}
          fields={[
            { key: 'name', label: 'ชื่อครู', placeholder: 'เช่น นางสมศรี ใจดี' },
            { key: 'role', label: 'หน้าที่', type: 'select', options: [{ value: 'ครูสอนหลัก', label: 'ครูสอนหลัก' }, { value: 'ครูสอนร่วม', label: 'ครูสอนร่วม' }] },
          ]}
          columns={[{ header: 'ชื่อครู', render: (t) => t.name }, { header: 'หน้าที่', render: (t) => <span className={`chip ${t.role === 'co' ? 'co' : ''}`}>{roleLabel(t.role)}</span> }]} />
      )}
      {tab === 'กลุ่มเรียน' && (
        <EntityTab def={groupDef} title="กลุ่มเรียน" addLabel="เพิ่มกลุ่มเรียน" items={st.groups} nameOf={(g) => g.name}
          fields={[
            { key: 'code', label: 'รหัสกลุ่มเรียน', placeholder: 'เช่น 6701' },
            { key: 'name', label: 'ชื่อกลุ่มเรียน', placeholder: 'เช่น ปวช.1/1' },
            { key: 'major', label: 'สาขาวิชา', placeholder: 'เช่น การบัญชี' },
          ]}
          columns={[{ header: 'รหัส', render: (g) => g.code }, { header: 'ชื่อกลุ่มเรียน', render: (g) => g.name }, { header: 'สาขาวิชา', render: (g) => g.major }]} />
      )}
      {tab === 'วิชาเรียน' && (
        <EntityTab def={subjectDef} title="วิชาเรียน" addLabel="เพิ่มวิชาเรียน" items={st.subjects} nameOf={(s) => s.name}
          fields={[
            { key: 'code', label: 'รหัสวิชา', placeholder: 'เช่น 20001-1001' },
            { key: 'name', label: 'ชื่อวิชา', placeholder: 'เช่น ภาษาไทย' },
            { key: 'n', label: 'จำนวนคาบต่อสัปดาห์', type: 'number', placeholder: '2' },
          ]}
          columns={[{ header: 'รหัสวิชา', render: (s) => s.code }, { header: 'ชื่อวิชา', render: (s) => s.name }, { header: 'คาบ/สัปดาห์', render: (s) => s.periodsPerWeek }]} />
      )}
      {tab === 'ห้องเรียน' && (
        <EntityTab def={buildingDef} title="อาคาร" addLabel="เพิ่มอาคาร" items={st.buildings} nameOf={(b) => b.name}
          hint="จำนวนห้อง = จำนวนห้องต่อ 1 ชั้น ระบบสร้างห้องให้อัตโนมัติ เช่น ชั้น 1 ห้อง 1 = ห้อง 101, ชั้น 2 ห้อง 3 = ห้อง 203"
          fields={[
            { key: 'name', label: 'ชื่ออาคาร', placeholder: 'เช่น อาคาร 1' },
            { key: 'floors', label: 'จำนวนชั้น', type: 'number', placeholder: '3' },
            { key: 'rooms', label: 'จำนวนห้อง (ต่อชั้น)', type: 'number', placeholder: '6' },
          ]}
          columns={[
            { header: 'ชื่ออาคาร', render: (b) => b.name }, { header: 'จำนวนชั้น', render: (b) => b.floors },
            { header: 'ห้องต่อชั้น', render: (b) => b.roomsPerFloor },
            { header: 'รวมห้อง', render: (b) => `${b.floors * b.roomsPerFloor} ห้อง (${roomLabel({ buildingId: '', floor: 1, no: 1 })} – ${roomLabel({ buildingId: '', floor: b.floors, no: b.roomsPerFloor })})` },
          ]} />
      )}
      {tab === 'กรณีพิเศษ' && <SpecialTab />}
      {tab === 'กำหนดการเรียน' && <AssignmentTab />}
    </>
  );
}
