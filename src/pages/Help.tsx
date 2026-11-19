import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Block, FAQ, GLOSSARY, MANUAL, QUICK_TRY, REAL_STEPS, Step } from '../help/content';

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

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p': return <p key={i} className="man-p">{b.text}</p>;
          case 'steps': return <ol key={i} className="man-steps">{b.items.map((x, j) => <li key={j}>{x}</li>)}</ol>;
          case 'list': return <ul key={i} className="man-list">{b.items.map((x, j) => <li key={j}>{x}</li>)}</ul>;
          case 'tip': return <div key={i} className="msg ok man-note">💡 {b.text}</div>;
          case 'warn': return <div key={i} className="msg warn man-note">⚠ {b.text}</div>;
          case 'table': return (
            <div key={i} className="man-table-wrap">
              <table className="data man-table">
                <thead><tr>{b.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
      })}
    </>
  );
}

/** หน้า "วิธีใช้" สำหรับผู้ดูแล: ลองใช้ใน 5 นาที → คู่มือละเอียดทีละหัวข้อ (มีสารบัญ) → คำศัพท์ → ถามตอบ → PDF */
export default function Help() {
  const [open, setOpen] = useState<string>('');
  const go = (id: string) => {
    setOpen(id);
    // รอให้หัวข้อกางก่อนค่อยเลื่อน (ใช้ scrollIntoView แทนลิงก์ # เพราะแอปใช้ # เป็นที่อยู่หน้า)
    setTimeout(() => document.getElementById('man-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };
  const allOpen = open === '*';

  return (
    <>
      <h1>วิธีใช้</h1>
      <p className="page-sub">อ่านสั้นๆ แล้วลองทำได้เลย — ไม่ต้องจำทั้งหมด ระบบมีตัวนำทางที่หน้า Dashboard คอยบอกขั้นถัดไป หัวข้อด้านล่างเป็นคู่มือฉบับเต็มไว้เปิดดูเวลาติดขัด</p>

      <div className="card">
        <h2>🚀 ลองใช้ใน 5 นาที</h2>
        <p className="hint" style={{ marginTop: 0 }}>เหมาะกับคนที่ยังไม่เคยใช้ ใช้ข้อมูลสมมติ ไม่ต้องพิมพ์เอง</p>
        <StepList steps={QUICK_TRY} />
        <Link className="btn primary" to="/">ไปที่ Dashboard เพื่อเริ่มลอง</Link>
      </div>

      <div className="card">
        <h2>🏫 ใช้กับโรงเรียนจริง — ภาพรวม 6 ขั้น</h2>
        <StepList steps={REAL_STEPS} />
        <p className="hint">ทุกขั้นกลับมาแก้ภายหลังได้ แต่ถ้าแก้ข้อมูลหลังจัดตารางแล้ว ต้องกดจัดตารางใหม่ (ตารางอาจเปลี่ยนจากเดิม)</p>
      </div>

      <div className="card" id="man-top">
        <h2>📚 คู่มือฉบับเต็ม</h2>
        <p className="hint" style={{ marginTop: 0 }}>กดหัวข้อเพื่อกางอ่าน หรือกด "กางทั้งหมด"</p>
        <div className="man-toc">
          {MANUAL.map((s) => (
            <button key={s.id} className="btn sm" onClick={() => go(s.id)}>{s.icon} {s.title.replace(/^ขั้น \d: /, '')}</button>
          ))}
          <button className="btn sm" onClick={() => setOpen(allOpen ? '' : '*')}>{allOpen ? 'ย่อทั้งหมด' : 'กางทั้งหมด'}</button>
        </div>
        {MANUAL.map((s) => (
          <details key={s.id} id={'man-' + s.id} className="man-sec" open={allOpen || open === s.id}
            onToggle={(e) => { if (!(e.target as HTMLDetailsElement).open && open === s.id) setOpen(''); }}>
            <summary>{s.icon} {s.title}</summary>
            <div className="man-body"><Blocks blocks={s.blocks} /></div>
          </details>
        ))}
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
