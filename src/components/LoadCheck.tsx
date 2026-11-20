import { useMemo } from 'react';
import { checkLoad, KIND_LABEL } from '../lib/capacity';
import { useStore } from '../store';

/** การ์ด "ตรวจข้อมูลก่อนจัดตาราง": เตือนทันที (ไม่ต้องรอจัดตาราง) เรื่องภาระ ครู/กลุ่มเรียน/ห้อง/อาคาร, เวลาว่างไม่ตรงกัน, กรณีพิเศษที่อ่านไม่ได้, ข้อมูลที่ไม่ได้ใช้ */
export default function LoadCheck() {
  const { settings, teachers, groups, subjects, buildings, specialCases, assignments } = useStore();
  const rep = useMemo(() => checkLoad({ settings, teachers, groups, subjects, buildings, specialCases, assignments }), [settings, teachers, groups, subjects, buildings, specialCases, assignments]);
  if (!assignments.length || !rep.totalSlots) return null;
  const errors = rep.issues.filter((i) => i.level === 'error');
  const warns = rep.issues.filter((i) => i.level === 'warn');
  const infos = rep.issues.filter((i) => i.level === 'info');
  const top = rep.rows.slice(0, 12);
  return (
    <div className="card load-check">
      <h2 style={{ margin: 0 }}>ตรวจข้อมูลก่อนจัดตาราง</h2>
      {errors.length > 0 && (
        <div className="msg err" style={{ marginTop: 10 }}>
          <b>⚠ พบปัญหา {errors.length} รายการ — ถ้าไม่แก้ จัดให้ครบทุกคาบไม่ได้แน่นอน</b>
          <ul>{errors.slice(0, 15).map((i, n) => <li key={n}>{i.text}</li>)}{errors.length > 15 && <li>… และอีก {errors.length - 15} รายการ</li>}</ul>
          <div>แก้ได้โดย: ลดคาบ/ย้ายวิชาไปให้ครูหรือห้องอื่น • เพิ่มจำนวนคาบต่อวันหรือวันที่เปิดสอน • ลดหรือแก้กรณีพิเศษที่ล็อกเวลา แล้วค่อยกดจัดตาราง (กดจัดได้เลยถ้าต้องการให้ระบบจัดเท่าที่ทำได้)</div>
        </div>
      )}
      {warns.length > 0 && (
        <div className="msg warn" style={{ marginTop: 10 }}>
          <b>ข้อควรระวัง {warns.length} รายการ</b> (ยังจัดได้ แต่ควรตรวจ)
          <ul>{warns.slice(0, 10).map((i, n) => <li key={n}>{i.text}</li>)}{warns.length > 10 && <li>… และอีก {warns.length - 10} รายการ</li>}</ul>
        </div>
      )}
      {errors.length === 0 && warns.length === 0 && (
        <div className="msg ok" style={{ marginTop: 10 }}>✔ ไม่พบปัญหา: ภาระของครู กลุ่มเรียน ห้อง และอาคาร อยู่ในช่องว่างที่มี (ตารางมี {rep.totalSlots} ช่อง/สัปดาห์)</div>
      )}
      {infos.length > 0 && <p className="hint" style={{ marginBottom: 0 }}>{infos.map((i) => i.text).join(' • ')}</p>}
      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>ดูภาระที่หนักที่สุด 12 อันดับ (ครู / กลุ่มเรียน / ห้อง / อาคาร)</summary>
        <table className="data" style={{ marginTop: 8 }}>
          <thead><tr><th>ประเภท</th><th>ชื่อ</th><th>ต้องใช้ (คาบ/สัปดาห์)</th><th>ช่องว่างที่มี</th><th>ใช้ไป</th></tr></thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.kind + r.id}>
                <td>{KIND_LABEL[r.kind]}</td><td>{r.name}{r.note && <small style={{ color: 'var(--muted)' }}> ({r.note})</small>}</td><td>{r.need}</td><td>{r.available}</td>
                <td style={{ color: r.need > r.available ? '#c0392b' : undefined, fontWeight: r.need > r.available ? 700 : undefined }}>{r.available ? Math.round((r.need / r.available) * 100) + '%' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">นับตามที่ระบบจัดจริง: กำหนดการที่ "เรียนรวมกัน" (วิชา/ครู/ห้องเดียวกัน) นับเป็นรายการเดียว และไม่นับช่องที่ถูกกรณีพิเศษล็อกไว้ — เป็นการตรวจเบื้องต้น (ถ้าเกินแปลว่าจัดไม่ได้แน่ แต่ถ้าไม่เกินก็ยังไม่ใช่การันตีว่าจัดได้)</p>
      </details>
    </div>
  );
}
