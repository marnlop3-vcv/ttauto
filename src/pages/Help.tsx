import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Block, FAQ, GLOSSARY, MANUAL, QUICK10, QUICK_TRY, Step } from '../help/content';

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

/** **ตัวหนา** และ `ชื่อปุ่ม/ข้อความบนจอ` */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((x, i) =>
        x.startsWith('**') ? <b key={i}>{x.slice(2, -2)}</b> : x.startsWith('`') ? <b key={i} className="man-key">{x.slice(1, -1)}</b> : <span key={i}>{x}</span>)}
    </>
  );
}

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p': return <p key={i} className="man-p"><Rich text={b.text} /></p>;
          case 'steps': return <ol key={i} className="man-steps">{b.items.map((x, j) => <li key={j}><Rich text={x} /></li>)}</ol>;
          case 'list': return <ul key={i} className="man-list">{b.items.map((x, j) => <li key={j}><Rich text={x} /></li>)}</ul>;
          case 'tip': return <div key={i} className="msg ok man-note">💡 <Rich text={b.text} /></div>;
          case 'warn': return <div key={i} className="msg warn man-note">⚠ <Rich text={b.text} /></div>;
          case 'img': return (
            <figure key={i} className="man-fig"><img src={b.src} alt={b.alt} loading="lazy" style={b.w ? { maxWidth: b.w } : undefined} />{b.caption && <figcaption>{b.caption}</figcaption>}</figure>
          );
          case 'imgs': return (
            <div key={i} className="man-figs">{b.items.map((it) => <figure key={it.src} className="man-fig"><img src={it.src} alt={it.alt} loading="lazy" />{it.caption && <figcaption>{it.caption}</figcaption>}</figure>)}</div>
          );
          case 'table': return (
            <div key={i} className="man-table-wrap">
              <table className="data man-table">
                <thead><tr>{b.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}><Rich text={c} /></td>)}</tr>)}</tbody>
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

      <div className="card" id="man-quick10">
        <h2>🏫 ใช้งาน 10 ขั้น — ตั้งแต่เปิดลิงก์ถึงแจกตาราง</h2>
        <p className="hint" style={{ marginTop: 0 }}>ทำตามลำดับ มีภาพประกอบทุกขั้น ทุกขั้นกลับมาแก้ภายหลังได้ (แก้ข้อมูลหลังจัดตารางแล้ว ต้องกดจัดตารางใหม่)</p>
        <ol className="man-quick">
          {QUICK10.map((q) => (
            <li key={q.id} id={'man-' + q.id}>
              <div className="man-quick-head"><span className="help-no">{q.icon}</span><h3>{q.title}</h3></div>
              <div className="man-quick-body"><Blocks blocks={q.blocks} /></div>
            </li>
          ))}
        </ol>
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
