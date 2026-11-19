import { useMemo, useState } from 'react';
import DataTable from '../../components/DataTable';
import ExcelButtons from '../../components/ExcelButtons';
import { conditionSummary, specialDef } from '../../lib/entities';
import { describeSlots, parseCondition } from '../../lib/thaiRuleParser';
import { SearchMulti } from '../../components/Search';
import { useStore } from '../../store';

export default function SpecialTab() {
  const { settings, groups, teachers, specialCases, addMany, remove } = useStore();
  const [name, setName] = useState('');
  const [count, setCount] = useState('1');
  const [cond, setCond] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [selT, setSelT] = useState<string[]>([]); // ชื่อครูที่เลือก
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const preview = useMemo(() => (cond.trim() ? parseCondition(cond, settings, +count || 1) : null), [cond, count, settings]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = specialDef.fromRow([name, count, cond, groups.filter((g) => sel.includes(g.id)).map((g) => g.code).join(','), selT.join(',')], { settings, groups, teachers });
    if (!r.value) return setMsg({ ok: false, text: r.error ?? 'ข้อมูลไม่ถูกต้อง' });
    if (specialCases.some((s) => s.name === r.value!.name)) return setMsg({ ok: false, text: `"${r.value.name}" มีอยู่ในระบบแล้ว` });
    addMany('specialCases', [r.value]);
    setName(''); setCount('1'); setCond(''); setSel([]); setSelT([]);
    setMsg({ ok: true, text: `เพิ่มกรณีพิเศษ "${r.value.name}" เรียบร้อย` });
  };

  return (
    <>
      <div className="card">
        <h2>เพิ่มกรณีพิเศษ</h2>
        <form onSubmit={submit}>
          <div className="form-row" style={{ alignItems: 'flex-start' }}>
            <label className="field">ชื่อกรณีพิเศษ
              <input type="text" value={name} placeholder="เช่น คาบกิจกรรม" onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">จำนวนคาบ
              <input type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />
            </label>
            <div className="field">กลุ่มเรียนที่เกี่ยวข้อง
              <SearchMulti items={groups.map((g) => ({ value: g.id, label: `${g.code} ${g.name}` }))} selected={sel} onChange={setSel} empty="ยังไม่มีกลุ่มเรียน" />
            </div>
            <div className="field">ครูที่เกี่ยวข้อง
              <SearchMulti items={[...new Set(teachers.map((t) => t.name))].map((n) => ({ value: n, label: n }))} selected={selT} onChange={setSelT} empty="ยังไม่มีครู" />
            </div>
          </div>
          <label className="field" style={{ marginTop: 14 }}>เงื่อนไข (พิมพ์เป็นภาษาไทย)
            <textarea value={cond} placeholder={'เช่น  ทุกวันคาบที่ 1   |   วันพุธ คาบ 7-8   |   วันศุกร์ ช่วงบ่าย'} onChange={(e) => setCond(e.target.value)} />
          </label>
          {preview && (
            <div className={`msg ${preview.ok ? 'ok' : 'err'}`} style={{ marginTop: 8 }}>
              {preview.ok ? <>ระบบเข้าใจว่า: <b>{describeSlots(preview.slots, settings)}</b> (รวม {preview.slots.length} ช่องเวลา)</> : preview.error}
              {preview.notes.length > 0 && <ul>{preview.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            </div>
          )}
          <div className="hint">
            <b>ใช้กับใคร:</b> ไม่เลือกกลุ่มเรียนและครูเลย = ใช้กับ <b>ทุกกลุ่มเรียนและทุกครู</b> (เช่น คาบกิจกรรมทั้งโรงเรียน); เลือกกลุ่มเรียนและ/หรือครู = ใช้เฉพาะที่เลือก (เช่น ครู A และกลุ่ม B ประชุมทุกวันอังคาร คาบ 1-2)
            <br />ตัวอย่างเงื่อนไข: "ทุกวันคาบที่1" • "วันพุธ คาบ 7-8" • "จันทร์-ศุกร์ คาบสุดท้าย" • "วันศุกร์ ช่วงบ่าย" • หลายเงื่อนไขคั่นด้วย ;
            <br />ถ้าเงื่อนไขระบุคาบเริ่มต้นคาบเดียว ระบบจะวางต่อเนื่องตาม "จำนวนคาบ" (เช่น คาบ 3 + จำนวนคาบ 2 = คาบ 3–4)
          </div>
          <div style={{ marginTop: 12 }}><button className="btn primary" type="submit">เพิ่มกรณีพิเศษ</button></div>
        </form>
        {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0' }} />
        <ExcelButtons def={specialDef} items={specialCases} />
      </div>
      <div className="card">
        <h2>กรณีพิเศษที่มีอยู่ในระบบ ({specialCases.length})</h2>
        <DataTable
          rows={specialCases}
          onDelete={(c) => window.confirm(`ลบกรณีพิเศษ "${c.name}"?`) && remove('specialCases', c.id)}
          columns={[
            { header: 'ชื่อกรณีพิเศษ', render: (c) => c.name },
            { header: 'จำนวนคาบ', render: (c) => c.count, width: '100px' },
            { header: 'เงื่อนไขที่พิมพ์', render: (c) => c.condition },
            { header: 'ระบบแปลงเป็น', render: (c) => <span className="chip">{conditionSummary(c, { settings, groups, teachers })}</span> },
            { header: 'ใช้กับ', render: (c) => {
              const tn = [...new Set((c.teacherIds ?? []).map((id) => teachers.find((t) => t.id === id)?.name).filter(Boolean))];
              const gn = c.groupIds.map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean);
              if (!tn.length && !gn.length) return <span className="chip">ทุกกลุ่มและทุกครู</span>;
              return <>{gn.map((n) => <span className="chip" key={'g' + n}>กลุ่ม {n}</span>)}{tn.map((n) => <span className="chip co" key={'t' + n}>ครู {n}</span>)}</>;
            } },
          ]}
        />
      </div>
    </>
  );
}
