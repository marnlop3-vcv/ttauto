import { useEffect, useState } from 'react';
import { DAY_NAMES, Settings } from '../../types';
import { useStore } from '../../store';

export default function SettingsTab() {
  const { settings, setSettings, schedule } = useStore();
  const [draft, setDraft] = useState<Settings>(settings);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => setDraft(settings), [settings]);

  const toggleDay = (d: number) =>
    setDraft({ ...draft, days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort() });

  const setCount = (n: number) => {
    n = Math.max(0, Math.min(14, n || 0));
    const periods = Array.from({ length: n }, (_, i) => draft.periods[i] ?? { start: '', end: '' });
    setDraft({ ...draft, periods, lunchAfter: draft.lunchAfter > n ? 0 : draft.lunchAfter });
  };

  const save = () => {
    if (!draft.days.length) return setMsg({ ok: false, text: 'กรุณาเลือกวันที่เปิดสอนอย่างน้อย 1 วัน' });
    if (!draft.periods.length) return setMsg({ ok: false, text: 'กรุณาระบุจำนวนคาบต่อวัน' });
    for (let i = 0; i < draft.periods.length; i++) {
      const p = draft.periods[i];
      if (!p.start || !p.end) return setMsg({ ok: false, text: `กรุณาใส่เวลาเริ่ม–จบของคาบที่ ${i + 1}` });
      if (p.start >= p.end) return setMsg({ ok: false, text: `คาบที่ ${i + 1}: เวลาเริ่มต้องน้อยกว่าเวลาจบ` });
      if (i > 0 && draft.periods[i - 1].end > p.start) return setMsg({ ok: false, text: `คาบที่ ${i + 1} เริ่มก่อนคาบที่ ${i} จบ` });
    }
    if (schedule && !window.confirm('การเปลี่ยนการตั้งค่าจะล้างตารางที่จัดไว้แล้ว (ข้อมูลอื่นไม่หาย) ดำเนินการต่อ?')) return;
    setSettings(draft);
    setMsg({ ok: true, text: 'บันทึกการตั้งค่าแล้ว — กรอกข้อมูลในแท็บอื่นและกดจัดตารางที่หน้า Dashboard ได้เลย' });
  };

  return (
    <div className="card">
      <h2>ตั้งค่าวันและคาบเรียน</h2>
      <p className="hint" style={{ marginTop: 0 }}>ต้องตั้งค่าส่วนนี้ก่อน ระบบจึงจะจัดตารางได้ (ใช้เป็นกรอบของตารางสอนทั้งหมด)</p>
      <h3>วันที่เปิดสอน</h3>
      <div className="form-row" style={{ marginBottom: 16 }}>
        {DAY_NAMES.map((n, d) => (
          <label key={d} style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={draft.days.includes(d)} onChange={() => toggleDay(d)} /> {n}
          </label>
        ))}
      </div>
      <div className="form-row" style={{ marginBottom: 14 }}>
        <label className="field">จำนวนคาบต่อวัน
          <input type="number" min={1} max={14} value={draft.periods.length || ''} onChange={(e) => setCount(+e.target.value)} />
        </label>
        <label className="field">พักเที่ยงหลังคาบที่
          <select value={draft.lunchAfter} onChange={(e) => setDraft({ ...draft, lunchAfter: +e.target.value })}>
            <option value={0}>ไม่มีพักเที่ยง</option>
            {draft.periods.slice(0, -1).map((_, i) => <option key={i} value={i + 1}>หลังคาบที่ {i + 1}</option>)}
          </select>
        </label>
      </div>
      {draft.periods.length > 0 && (
        <table className="data" style={{ maxWidth: 520 }}>
          <thead><tr><th>คาบ</th><th>เวลาเริ่ม</th><th>เวลาจบ</th></tr></thead>
          <tbody>
            {draft.periods.map((p, i) => (
              <tr key={i}>
                <td>คาบที่ {i + 1}</td>
                <td><input type="time" value={p.start} onChange={(e) => setDraft({ ...draft, periods: draft.periods.map((q, j) => (j === i ? { ...q, start: e.target.value } : q)) })} /></td>
                <td><input type="time" value={p.end} onChange={(e) => setDraft({ ...draft, periods: draft.periods.map((q, j) => (j === i ? { ...q, end: e.target.value } : q)) })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ marginTop: 16 }}><button className="btn primary" onClick={save}>บันทึกการตั้งค่า</button></div>
      {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
    </div>
  );
}
