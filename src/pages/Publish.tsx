import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { hasAdminLock, removeAdminLock, setAdminLock } from '../auth/adminLock';
import { buildPublished, openPublished } from '../auth/bundle';
import { canonicalPass, checkPasscode, generatePasscode } from '../auth/crypto';
import { downloadBlob } from '../lib/excel';
import { useStore } from '../store';

function copy(text: string) { try { void navigator.clipboard?.writeText(text); } catch { /* ignore */ } }

function PassField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint: string }) {
  const [show, setShow] = useState(false);
  const st = value ? checkPasscode(value) : null;
  return (
    <div className="field" style={{ minWidth: 300 }}>{label}
      <div className="pass-row">
        <input type={show ? 'text' : 'password'} value={value} autoComplete="off" spellCheck={false} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        <button type="button" className="btn sm" onClick={() => setShow(!show)}>{show ? 'ซ่อน' : 'แสดง'}</button>
        <button type="button" className="btn sm" onClick={() => { onChange(generatePasscode()); setShow(true); }}>สร้างรหัสให้</button>
      </div>
      <div className="hint" style={{ margin: 0 }}>{hint}</div>
      {st && <div className={`strength ${st.level}`}>ความแข็งแรง: {st.label}{st.problem ? ` — ${st.problem}` : ''}</div>}
    </div>
  );
}

function AdminLockCard() {
  const [has, setHas] = useState(hasAdminLock());
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const st = pw ? checkPasscode(pw) : null;

  const save = async () => {
    const c = checkPasscode(pw);
    if (c.problem) return setMsg({ ok: false, text: c.problem });
    setBusy(true);
    try { await setAdminLock(pw); setHas(true); setPw(''); setMsg({ ok: true, text: 'ตั้งรหัสล็อกผู้ดูแลแล้ว — ครั้งหน้าที่เปิดเว็บบนเครื่องนี้ ต้องใส่รหัสนี้เพื่อเข้าโหมดผู้ดูแล' }); }
    finally { setBusy(false); }
  };
  return (
    <div className="card">
      <h2>รหัสล็อกผู้ดูแล <small style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 14 }}>เฉพาะเครื่องนี้</small></h2>
      <p className="hint" style={{ marginTop: 0 }}>
        ใช้กันคนอื่นที่เปิดเว็บบนเครื่องนี้เข้ามาแก้ข้อมูล <b>เป็นเพียงการล็อกหน้าจอ ไม่ได้เข้ารหัสข้อมูลที่เก็บในเครื่อง</b> (คนที่ใช้เครื่องนี้และมีความรู้ทางเทคนิคยังเข้าถึงข้อมูลในเบราว์เซอร์ได้)
        ลืมรหัสแล้วกู้คืนไม่ได้ ต้องรีเซ็ตเครื่อง (ข้อมูลในเครื่องจะถูกลบ)
      </p>
      <div className="form-row" style={{ alignItems: 'flex-start' }}>
        <div className="field" style={{ minWidth: 300 }}>{has ? 'ตั้งรหัสใหม่ (เปลี่ยนรหัส)' : 'ตั้งรหัสล็อกผู้ดูแล'}
          <input type="password" value={pw} autoComplete="off" aria-label={has ? 'ตั้งรหัสใหม่' : 'ตั้งรหัสล็อกผู้ดูแล'} onChange={(e) => setPw(e.target.value)} />
          {st && <div className={`strength ${st.level}`}>ความแข็งแรง: {st.label}{st.problem ? ` — ${st.problem}` : ''}</div>}
        </div>
        <button className="btn primary" disabled={busy || !pw} onClick={save} style={{ marginTop: 20 }}>{has ? 'เปลี่ยนรหัส' : 'ตั้งรหัสล็อก'}</button>
        {has && <button className="btn danger" style={{ marginTop: 20 }} onClick={() => { if (window.confirm('ยกเลิกรหัสล็อกผู้ดูแลบนเครื่องนี้?')) { removeAdminLock(); setHas(false); setMsg({ ok: true, text: 'ยกเลิกรหัสล็อกแล้ว' }); } }}>ยกเลิกรหัสล็อก</button>}
      </div>
      <div className="hint">สถานะ: {has ? '🔒 ตั้งรหัสล็อกไว้แล้ว' : 'ยังไม่ได้ตั้งรหัสล็อก (ใครเปิดเว็บบนเครื่องนี้ก็เข้าโหมดผู้ดูแลได้)'}</div>
      {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
    </div>
  );
}

export default function Publish() {
  const state = useStore();
  const [title, setTitle] = useState(() => { try { return localStorage.getItem('tt-pub-title') ?? ''; } catch { return ''; } });
  const [sp, setSp] = useState('');
  const [tp, setTp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ kb: number; groups: number; teachers: number; sp: string; tp: string; title: string } | null>(null);

  const url = useMemo(() => location.origin + location.pathname, []);
  const same = sp && tp && canonicalPass(sp) === canonicalPass(tp);
  const sCheck = sp ? checkPasscode(sp) : null;
  const tCheck = tp ? checkPasscode(tp) : null;
  const ready = !!state.schedule && !!title.trim() && !!sp && !!tp && !sCheck?.problem && !tCheck?.problem && !same;

  const build = async () => {
    setBusy(true); setErr(''); setDone(null);
    try { localStorage.setItem('tt-pub-title', title); } catch { /* ignore */ }
    try {
      const file = await buildPublished(useStore.getState() as any, { title, studentPass: sp, teacherPass: tp });
      // ทดสอบถอดรหัสก่อนให้ดาวน์โหลด (กันตั้งรหัสผิดพลาด)
      const s = await openPublished(file, sp);
      const t = await openPublished(file, tp);
      if (!s || s.kind !== 'student' || !t || t.kind !== 'teacher') throw new Error('ตรวจสอบไฟล์ไม่ผ่าน (ถอดรหัสทดสอบไม่ได้) กรุณาลองใหม่');
      const text = JSON.stringify(file);
      downloadBlob(new Blob([text], { type: 'application/json' }), 'published.enc.json');
      setDone({ kb: Math.max(1, Math.round(text.length / 1024)), groups: s.items.length, teachers: t.items.length, sp, tp, title });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const msg = (who: string, code: string) =>
`ตาราง${who === 'นักเรียน' ? 'เรียน' : 'สอน'} ${done?.title ?? title}
เปิดดูได้ที่: ${url}
รหัสสำหรับ${who}: ${canonicalPass(code).length === 12 && /^[A-Z2-9]+$/.test(canonicalPass(code)) ? `${canonicalPass(code).slice(0, 4)}-${canonicalPass(code).slice(4, 8)}-${canonicalPass(code).slice(8)}` : code}
(เก็บรหัสเป็นความลับ ห้ามส่งต่อให้คนนอก)`;

  return (
    <>
      <h1>เผยแพร่ตาราง</h1>
      <p className="page-sub">ส่งตารางที่จัดแล้วให้นักเรียนและครูดูได้ ผ่านไฟล์ที่เข้ารหัส — แต่ละกลุ่มใช้รหัสของตัวเอง ดูได้อย่างเดียว</p>

      <div className="card">
        <h2>1) สร้างไฟล์เผยแพร่</h2>
        {!state.schedule && <div className="msg warn" style={{ marginTop: 0 }}>ยังไม่มีตารางที่จัดไว้ — ไปที่ <Link to="/">Dashboard</Link> กด "จัดตารางอัตโนมัติ" ก่อน</div>}
        {state.schedule && state.stale && <div className="msg warn" style={{ marginTop: 0 }}>ข้อมูลมีการเปลี่ยนแปลงหลังจัดตารางล่าสุด ควรกลับไป <Link to="/">Dashboard</Link> จัดตารางใหม่ก่อนเผยแพร่</div>}
        <div className="form-row" style={{ alignItems: 'flex-start', marginTop: 12 }}>
          <label className="field" style={{ minWidth: 300 }}>ชื่อชุดตาราง (แสดงให้ผู้ดูเห็น)
            <input type="text" value={title} placeholder="เช่น ภาคเรียนที่ 1/2569" onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>
        <div className="form-row" style={{ alignItems: 'flex-start', marginTop: 14 }}>
          <PassField label="รหัสสำหรับนักเรียน" value={sp} onChange={setSp} hint="นักเรียนที่ใส่รหัสนี้ เห็นเฉพาะตารางเรียนรายกลุ่ม (เลือกห้องได้)" />
          <PassField label="รหัสสำหรับครู" value={tp} onChange={setTp} hint="ครูที่ใส่รหัสนี้ เห็นเฉพาะตารางสอนรายครู (เลือกครูได้)" />
        </div>
        {same && <div className="msg err">รหัสนักเรียนและรหัสครูต้องไม่เหมือนกัน</div>}
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" disabled={!ready || busy} onClick={build}>{busy ? 'กำลังเข้ารหัส…' : '🔐 สร้างไฟล์เผยแพร่ (published.enc.json)'}</button>
        </div>
        {err && <div className="msg err">{err}</div>}

        <div className="msg warn">
          <b>ข้อควรรู้เรื่องรหัส</b>
          <ul>
            <li>ไฟล์ที่เผยแพร่เปิดสาธารณะ (แต่เข้ารหัส) คนอื่นลองเดารหัสแบบออฟไลน์ได้ ดังนั้นรหัสต้อง <b>ยาวและเดายาก</b> — แนะนำกด "สร้างรหัสให้"</li>
            <li><b>ระบบไม่เก็บรหัส</b> ที่คุณตั้ง จดไว้ให้ดี ลืมแล้วกู้คืนไม่ได้ ต้องตั้งและเผยแพร่ใหม่</li>
            <li>รหัสเป็นรหัสร่วมของทั้งกลุ่ม ยกเลิกสิทธิ์รายคนไม่ได้ ถ้ารหัสหลุด ให้ตั้งรหัสใหม่แล้วเผยแพร่ใหม่ (ไฟล์เก่าในประวัติ git ยังถอดด้วยรหัสเก่าได้)</li>
            <li>ผู้ดูเห็นเฉพาะตารางที่แสดง (ชื่อวิชา ครู ห้อง กลุ่มเรียน) ไม่เห็นข้อมูลดิบหรือเมนูแก้ไขใดๆ ตารางจะอัปเดตเมื่อคุณเผยแพร่ไฟล์ใหม่เท่านั้น</li>
          </ul>
        </div>
      </div>

      {done && (
        <div className="card">
          <h2>2) นำไฟล์ไปเผยแพร่ <small style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 14 }}>ดาวน์โหลดแล้ว: {done.kb} KB • {done.groups} กลุ่มเรียน • {done.teachers} ครู</small></h2>
          <ol className="steps-list">
            <li>วางไฟล์ <code>published.enc.json</code> ในโฟลเดอร์ <code>public/published/</code> ของโปรเจกต์ (สร้างโฟลเดอร์ถ้ายังไม่มี) ทับไฟล์เดิมได้</li>
            <li>ส่งขึ้น GitHub (เปิด Command Prompt ในโฟลเดอร์โปรเจกต์):
              <pre className="codeblock">{'git add public/published\ngit commit -m "Publish timetable"\ngit push'}</pre>
            </li>
            <li>รอแท็บ <b>Actions</b> ในรีโพขึ้นเครื่องหมายถูกสีเขียว (ราว 1–2 นาที) แล้วให้ผู้ดูรีเฟรชหน้าเว็บ (บางครั้งต้องรอถึง ~10 นาที)</li>
            <li>ไม่ได้ใช้ GitHub? ส่งไฟล์ให้ผู้ดูโดยตรง (เช่น ไลน์) แล้วให้เลือกไฟล์ที่หน้าเข้าสู่ระบบ ("มีไฟล์ตารางที่ได้รับ? เลือกไฟล์")</li>
          </ol>
          <h3 style={{ marginTop: 14 }}>ข้อความแจ้งผู้ดู <small style={{ fontWeight: 400, color: 'var(--muted)' }}>(แยกส่ง — อย่าส่งรหัสครูให้นักเรียน)</small></h3>
          <div className="cols">
            <div><pre className="codeblock">{msg('นักเรียน', done.sp)}</pre><button className="btn sm" onClick={() => copy(msg('นักเรียน', done.sp))}>คัดลอกข้อความนักเรียน</button></div>
            <div><pre className="codeblock">{msg('ครู', done.tp)}</pre><button className="btn sm" onClick={() => copy(msg('ครู', done.tp))}>คัดลอกข้อความครู</button></div>
          </div>
          <p className="hint">ตัวอย่างลิงก์ด้านบนคือที่อยู่ของหน้านี้ ถ้าเปิดผู้ดูแลจากเครื่องของคุณเอง (localhost) ให้แก้เป็นลิงก์เว็บที่เผยแพร่จริงก่อนส่ง</p>
        </div>
      )}

      <AdminLockCard />
    </>
  );
}
