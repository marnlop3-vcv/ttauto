import { useState } from 'react';
import DataTable from '../../components/DataTable';
import { SearchMulti, SearchSelect } from '../../components/Search';
import { useStore } from '../../store';
import { placeText } from '../../lib/rooms';
import { roomKeyOf, roomLabel, roomsOf, RoomRef } from '../../types';

export default function AssignmentTab() {
  const { teachers, groups, subjects, buildings, assignments, addAssignment, removeAssignment } = useStore();
  const [main, setMain] = useState<string[]>([]);
  const [co, setCo] = useState<string[]>([]);
  const [grp, setGrp] = useState<string[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [roomVal, setRoomVal] = useState(''); // "floor:no"
  const [rooms, setRooms] = useState<RoomRef[]>([]); // ห้องที่เลือกไว้แล้ว (หลายห้อง/หลายอาคารพร้อมกันได้ — วิชาเสรี)
  const [together, setTogether] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const b = buildings.find((x) => x.id === buildingId);
  const roomOptions = b
    ? Array.from({ length: b.floors }, (_, f) => Array.from({ length: b.roomsPerFloor }, (_, r) => ({
        value: `${f + 1}:${r + 1}`, label: `ห้อง ${roomLabel({ buildingId: b.id, floor: f + 1, no: r + 1 })} (ชั้น ${f + 1})`,
      }))).flat()
    : [];

  const bName = (id: string) => buildings.find((x) => x.id === id)?.name ?? '?';
  /** ห้องที่กำลังเลือกอยู่ในช่อง (ยังไม่ได้กดเพิ่ม) */
  const pending = (): RoomRef | null => {
    if (!b || !roomVal) return null;
    const [floor, no] = roomVal.split(':').map(Number);
    return { buildingId: b.id, floor, no };
  };
  const addRoom = () => {
    const r = pending();
    if (!r) return setMsg({ ok: false, text: 'เลือกอาคารและห้องก่อน แล้วจึงกด "＋ เพิ่มห้อง"' });
    if (rooms.some((x) => roomKeyOf(x) === roomKeyOf(r))) return setMsg({ ok: false, text: 'ห้องนี้เลือกไว้แล้ว' });
    setRooms([...rooms, r]); setRoomVal(''); setMsg(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) return setMsg({ ok: false, text: 'กรุณาเลือกวิชาเรียน' });
    if (!main.length) return setMsg({ ok: false, text: 'กรุณาเลือกครูสอนหลักอย่างน้อย 1 คน' });
    if (!grp.length) return setMsg({ ok: false, text: 'กรุณาเลือกกลุ่มเรียนอย่างน้อย 1 กลุ่ม' });
    const p = pending();
    const list = p && !rooms.some((x) => roomKeyOf(x) === roomKeyOf(p)) ? [...rooms, p] : rooms; // ห้องที่เลือกค้างไว้ในช่อง นับรวมให้ด้วย
    if (!list.length) return setMsg({ ok: false, text: 'กรุณาเลือกอาคารและห้องเรียนอย่างน้อย 1 ห้อง' });
    const dup = assignments.find((a) => a.subjectId === subjectId && a.groupIds.some((g) => grp.includes(g)));
    if (dup && !window.confirm('มีกำหนดการเรียนของวิชานี้กับกลุ่มเรียนที่เลือกอยู่แล้ว ต้องการเพิ่มซ้ำหรือไม่ (คาบจะถูกนับซ้ำ)?')) return;
    addAssignment({ subjectId, mainTeacherIds: main, coTeacherIds: co, groupIds: grp, room: list[0], ...(list.length > 1 ? { extraRooms: list.slice(1) } : {}), together });
    setMain([]); setCo([]); setGrp([]); setRoomVal(''); setRooms([]);
    setMsg({ ok: true, text: `บันทึกกำหนดการเรียนเรียบร้อย${list.length > 1 ? ` (ใช้ ${list.length} ห้องพร้อมกัน)` : ''}` });
  };

  const nameT = (id: string) => teachers.find((t) => t.id === id)?.name ?? '?';

  return (
    <>
      <div className="card">
        <h2>กำหนดการเรียน</h2>
        <p className="hint" style={{ marginTop: 0 }}>เลือกข้อมูลที่มีอยู่ในระบบ: 1 รายการ = วิชา 1 วิชา ที่กลุ่มเรียน (หนึ่งกลุ่มหรือหลายกลุ่มเรียนพร้อมกัน) เรียนกับครู ในห้องเรียนที่กำหนด</p>
        <form onSubmit={submit}>
          <div className="form-row" style={{ alignItems: 'flex-start' }}>
            <div className="field">วิชาเรียน
              <SearchSelect value={subjectId} onChange={setSubjectId} width={280} placeholder="พิมพ์ชื่อหรือรหัสวิชา…"
                options={subjects.map((s) => ({ value: s.id, label: `${s.code} ${s.name} (${s.periodsPerWeek} คาบ)` }))} />
            </div>
            <div className="field">ครูสอนหลัก (เลือกได้หลายคน)
              <SearchMulti items={teachers.filter((t) => t.role === 'main').map((t) => ({ value: t.id, label: t.name }))} selected={main}
                onChange={setMain} empty="ยังไม่มีครูสอนหลัก" />
            </div>
            <div className="field">ครูสอนร่วม (ไม่บังคับ)
              <SearchMulti items={teachers.filter((t) => t.role === 'co').map((t) => ({ value: t.id, label: t.name }))} selected={co}
                onChange={setCo} empty="ยังไม่มีครูสอนร่วม" />
            </div>
            <div className="field">กลุ่มเรียน (เลือกได้หลายกลุ่ม)
              <SearchMulti items={groups.map((g) => ({ value: g.id, label: `${g.code} ${g.name}` }))} selected={grp}
                onChange={setGrp} empty="ยังไม่มีกลุ่มเรียน" />
            </div>
          </div>
          <div className="form-row" style={{ marginTop: 14, alignItems: 'flex-end' }}>
            <div className="field">อาคาร
              <SearchSelect value={buildingId} onChange={(v) => { setBuildingId(v); setRoomVal(''); }} placeholder="พิมพ์ชื่ออาคาร…"
                options={buildings.map((x) => ({ value: x.id, label: x.name }))} />
            </div>
            <div className="field">ห้อง
              <SearchSelect value={roomVal} onChange={setRoomVal} disabled={!b} width={220} placeholder={b ? 'พิมพ์เลขห้อง เช่น 203…' : 'เลือกอาคารก่อน'} options={roomOptions} />
            </div>
            <button type="button" className="btn" onClick={addRoom} title="เพิ่มห้องนี้เข้ารายการ (เลือกได้หลายห้อง/หลายอาคาร)">＋ เพิ่มห้อง</button>
          </div>
          {rooms.length > 0 && (
            <div className="sm-chips" style={{ marginTop: 8 }} aria-label="ห้องที่เลือกไว้">
              {rooms.map((r) => (
                <span key={roomKeyOf(r)} className="chip">{placeText([r], bName)} <button type="button" className="x" aria-label="เอาออก" onClick={() => setRooms(rooms.filter((x) => roomKeyOf(x) !== roomKeyOf(r)))}>×</button></span>
              ))}
            </div>
          )}
          <div className="hint">
            ห้องเดียว: เลือกอาคารและห้อง แล้วกดบันทึกได้เลย • <b>วิชาเสรี</b> (นักเรียนแต่ละคนแยกไปเรียนคนละห้อง/คนละอาคารในคาบเดียวกัน): กด "＋ เพิ่มห้อง" ให้ครบทุกห้องที่ใช้
            ระบบจะจองทุกห้องพร้อมกัน และแสดงครู กลุ่มเรียน และทุกอาคารในคาบเดียวกัน (เลือกครูสอนหลักหลายคนและกลุ่มเรียนที่เข้าร่วมด้วย)
          </div>
          <div className="field" style={{ marginTop: 14 }}>การเรียนของกลุ่มเรียนที่เลือก
            <div className="radio-row">
              <label className={`radio ${together ? 'on' : ''}`}>
                <input type="radio" name="together" checked={together} onChange={() => setTogether(true)} />
                <span><b>เรียนรวมกัน</b><small>เรียนเวลาเดียวกัน ห้องเดียวกัน (รวมกับกำหนดการอื่นที่วิชา/ครู/ห้องเดียวกันและเลือก "เรียนรวมกัน" เช่นกัน)</small></span>
              </label>
              <label className={`radio ${!together ? 'on' : ''}`}>
                <input type="radio" name="together" checked={!together} onChange={() => setTogether(false)} />
                <span><b>แยกเรียน</b><small>ระบบจัดเวลาให้แต่ละกลุ่มคนละเวลา (ครู/ห้องเดียวกันสอนทีละกลุ่ม)</small></span>
              </label>
            </div>
          </div>
          <div style={{ marginTop: 14 }}><button className="btn primary" type="submit">บันทึก</button></div>
        </form>
        {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      </div>
      <div className="card">
        <h2>กำหนดการเรียนที่มีอยู่ในระบบ ({assignments.length})</h2>
        <DataTable
          rows={assignments}
          onDelete={(a) => window.confirm('ลบกำหนดการเรียนนี้? (ตารางที่จัดไว้จะถูกล้าง)') && removeAssignment(a.id)}
          columns={[
            { header: 'วิชา', render: (a) => { const s = subjects.find((x) => x.id === a.subjectId); return s ? `${s.name} (${s.periodsPerWeek} คาบ)` : '?'; } },
            { header: 'ครู', render: (a) => <>{a.mainTeacherIds.map((id) => <span className="chip" key={id}>{nameT(id)}</span>)}{a.coTeacherIds.map((id) => <span className="chip co" key={id}>{nameT(id)} (ร่วม)</span>)}</> },
            { header: 'กลุ่มเรียน', render: (a) => a.groupIds.map((id) => <span className="chip" key={id}>{groups.find((g) => g.id === id)?.name}</span>) },
            { header: 'การเรียน', render: (a) => <span className={`chip ${a.together ? '' : 'co'}`}>{a.together ? 'เรียนรวมกัน' : 'แยกเรียน'}</span>, width: '120px' },
            { header: 'ห้องเรียน', render: (a) => { const rs = roomsOf(a); return <>{placeText(rs, bName)}{rs.length > 1 && <span className="chip co" style={{ marginLeft: 6 }}>{rs.length} ห้องพร้อมกัน</span>}</>; } },
          ]}
        />
      </div>
    </>
  );
}
