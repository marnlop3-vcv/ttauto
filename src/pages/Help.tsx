import { Link } from 'react-router-dom';
import { FAQ, GLOSSARY, QUICK_TRY, REAL_STEPS, Step } from '../help/content';

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="help-steps">
      {steps.map((s, i) => (
        <li key={s.title}>
          <span className="help-no">{i + 1}</span>
          <div>
            <div className="help-title">{s.title}</div>
            <div>{s.what}</div>
            {s.where && <div className="help-meta"><b>กดตรงไหน:</b> {s.where}</div>}
            {s.see && <div className="help-meta"><b>ควรเห็น:</b> {s.see}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** หน้า "วิธีใช้" สำหรับผู้ดูแล: ลองใช้ใน 5 นาที → ใช้กับโรงเรียนจริง → คำศัพท์ → ถามตอบ */
export default function Help() {
  return (
    <>
      <h1>วิธีใช้</h1>
      <p className="page-sub">อ่านสั้นๆ แล้วลองทำได้เลย — ไม่ต้องจำทั้งหมด ระบบมีตัวนำทางที่หน้า Dashboard คอยบอกขั้นถัดไป</p>

      <div className="card">
        <h2>🚀 ลองใช้ใน 5 นาที</h2>
        <p className="hint" style={{ marginTop: 0 }}>เหมาะกับคนที่ยังไม่เคยใช้ ใช้ข้อมูลสมมติ ไม่ต้องพิมพ์เอง</p>
        <StepList steps={QUICK_TRY} />
        <Link className="btn primary" to="/">ไปที่ Dashboard เพื่อเริ่มลอง</Link>
      </div>

      <div className="card">
        <h2>🏫 ใช้กับโรงเรียนจริง</h2>
        <StepList steps={REAL_STEPS} />
        <p className="hint">ทุกขั้นกลับมาแก้ภายหลังได้ แต่ถ้าแก้ข้อมูลหลังจัดตารางแล้ว ต้องกดจัดตารางใหม่ (ตารางอาจเปลี่ยนจากเดิม)</p>
      </div>

      <div className="card">
        <h2>📖 คำศัพท์ที่ควรรู้</h2>
        <dl className="help-gloss">
          {GLOSSARY.map((g) => (<div key={g.term}><dt>{g.term}</dt><dd>{g.meaning}</dd></div>))}
        </dl>
      </div>

      <div className="card">
        <h2>❓ ถามตอบ</h2>
        {FAQ.map((f) => (
          <details key={f.q} className="help-faq">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>

      <div className="card">
        <h2>📄 คู่มือฉบับ PDF</h2>
        <div className="toolbar">
          <a className="btn" href="./timetable-user-manual.pdf" target="_blank" rel="noopener">คู่มือเริ่มต้นใช้งาน (สำหรับผู้ดูแล)</a>
          <a className="btn" href="./viewer-guide.pdf" target="_blank" rel="noopener">คู่มือสำหรับนักเรียนและครู (1 หน้า)</a>
        </div>
        <p className="hint">คู่มือสำหรับนักเรียนและครู ส่งต่อทางไลน์ได้เลย</p>
      </div>
    </>
  );
}
