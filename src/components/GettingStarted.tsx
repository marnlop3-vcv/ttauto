import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { guideSteps } from '../lib/guide';
import { makeSample } from '../lib/sample';
import { useStore } from '../store';

const K_COLLAPSE = 'tt-guide-collapsed';
const K_DONE = 'tt-guide-done-hidden';
const get = (k: string) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const set = (k: string, v: boolean) => { try { v ? localStorage.setItem(k, '1') : localStorage.removeItem(k); } catch { /* ignore */ } };

/** การ์ด "เริ่มต้นใช้งาน" บน Dashboard: บอกว่าทำถึงไหนแล้ว ขั้นถัดไปคืออะไร กดไปทำได้ทันที */
export default function GettingStarted({ onRun, canRun, running }: { onRun: () => void; canRun: boolean; running: boolean }) {
  const st = useStore();
  const g = useMemo(
    () => guideSteps(st),
    [st.settings, st.teachers, st.groups, st.subjects, st.buildings, st.specialCases, st.assignments, st.schedule, st.stale],
  );
  const [collapsed, setCollapsed] = useState(() => get(K_COLLAPSE));
  const [doneHidden, setDoneHidden] = useState(() => get(K_DONE));

  const toggle = () => { set(K_COLLAPSE, !collapsed); setCollapsed(!collapsed); };

  const trySample = () => {
    if (!g.isEmpty && !window.confirm('โหลดข้อมูลตัวอย่าง? ข้อมูลที่กรอกไว้ตอนนี้จะถูกแทนที่ (สำรองข้อมูลไว้ก่อนได้ที่เมนู กรอกข้อมูล)')) return;
    st.replaceAll(makeSample('small'));
  };

  // ครบทุกขั้นบังคับแล้ว: แสดงแถบสั้นๆ ชวนเผยแพร่ (ปิดได้)
  if (g.allRequiredDone) {
    if (doneHidden) return null;
    return (
      <div className="guide-done" role="status">
        <span>🎉 <b>ทุกขั้นพร้อมแล้ว</b> — อยากให้นักเรียนและครูดูตารางด้วยไหม?</span>
        <span className="guide-done-actions">
          <Link className="btn sm primary" to="/publish">ไปเผยแพร่ตาราง</Link>
          <Link className="btn sm" to="/help">วิธีใช้</Link>
          <button className="btn sm" onClick={() => { set(K_DONE, true); setDoneHidden(true); }}>ปิด</button>
        </span>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="guide-bar">
        <span><b>เริ่มต้นใช้งาน</b> • ทำแล้ว {g.doneCount}/{g.requiredTotal} ขั้น</span>
        <button className="btn sm" onClick={toggle}>แสดงขั้นตอน ▾</button>
      </div>
    );
  }

  return (
    <section className="guide card" aria-label="เริ่มต้นใช้งาน">
      <div className="guide-head">
        <div>
          <h2 style={{ margin: 0 }}>เริ่มต้นใช้งาน</h2>
          <div className="hint" style={{ margin: 0 }}>ทำตามลำดับ 4 ขั้น ระบบติ๊กให้เองเมื่อทำเสร็จ • ทำแล้ว <b>{g.doneCount}/{g.requiredTotal}</b></div>
        </div>
        <button className="btn sm" onClick={toggle}>ย่อ ▴</button>
      </div>
      <div className="guide-progress" aria-hidden="true"><div style={{ width: `${(g.doneCount / g.requiredTotal) * 100}%` }} /></div>

      {g.isEmpty && (
        <div className="guide-try">
          <div>
            <b>ยังไม่เคยใช้? ลองก่อนได้ใน 5 นาที</b>
            <div className="hint" style={{ margin: 0 }}>ระบบใส่ข้อมูลตัวอย่างให้ครบทุกอย่าง แล้วคุณแค่กดจัดตาราง ดูผลว่าหน้าตาเป็นอย่างไร (ลบทิ้งแล้วเริ่มกรอกของจริงทีหลังได้)</div>
          </div>
          <button className="btn primary" onClick={trySample}>✨ ลองใช้ด้วยข้อมูลตัวอย่าง</button>
        </div>
      )}

      <ol className="guide-steps">
        {g.steps.map((s) => {
          const cur = g.current === s.id;
          return (
            <li key={s.id} className={`gs ${s.done ? 'done' : ''} ${cur ? 'current' : ''} ${s.optional ? 'optional' : ''}`}>
              <span className="gs-mark" aria-label={s.done ? 'เสร็จแล้ว' : 'ยังไม่เสร็จ'}>{s.done ? '✔' : s.no}</span>
              <div className="gs-body">
                <div className="gs-title">{s.title}{cur && <span className="gs-next">ขั้นถัดไป</span>}</div>
                {(cur || !s.done) && <div className="gs-hint">{s.hint}</div>}
                {s.subs && !s.done && (
                  <div className="gs-subs">
                    {s.subs.map((x) => (
                      <Link key={x.label} to={x.to} className={`gs-sub ${x.done ? 'done' : ''}`}>{x.done ? '✔' : '＋'} {x.label}</Link>
                    ))}
                  </div>
                )}
              </div>
              {!s.done && (s.id === 'schedule'
                ? <button className={`btn sm ${cur ? 'primary' : ''}`} disabled={!canRun || running} onClick={onRun}>{running ? 'กำลังจัด…' : s.toLabel}</button>
                : <Link className={`btn sm ${cur ? 'primary' : ''}`} to={s.to}>{s.toLabel}</Link>)}
              {s.done && s.id !== 'publish' && <Link className="gs-edit" to={s.to}>ดู/แก้</Link>}
            </li>
          );
        })}
      </ol>

      <details className="guide-facts" open={g.isEmpty}>
        <summary>ควรรู้ก่อนเริ่ม (3 ข้อ)</summary>
        <ul>
          <li><b>ข้อมูลเก็บเฉพาะในเบราว์เซอร์เครื่องนี้</b> ไม่ถูกส่งไปที่ใด คนอื่นมองไม่เห็นข้อมูลของคุณ</li>
          <li><b>กด "สำรองข้อมูล (JSON)" เป็นระยะ</b> (เมนู กรอกข้อมูล) ถ้าล้างเบราว์เซอร์หรือเปลี่ยนเครื่อง ข้อมูลจะหายและกู้คืนไม่ได้</li>
          <li><b>ใช้เครื่องร่วมกัน</b> (เช่น ห้องพักครู) ให้สำรองแล้วกด "ล้างข้อมูลทั้งหมด" ก่อนเลิกใช้</li>
        </ul>
        <Link to="/help">ดูวิธีใช้แบบเต็ม คำศัพท์ และถามตอบ →</Link>
      </details>
    </section>
  );
}
