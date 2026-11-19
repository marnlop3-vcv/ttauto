import { useMemo, useRef, useState } from 'react';
import { SearchSelect } from '../components/Search';
import TimetableGrid from '../components/TimetableGrid';
import { SiteFooter } from '../components/Notice';
import { exportTimetableExcel } from '../lib/excel';
import { exportElementToPdf } from '../lib/pdf';
import { useSession } from '../auth/session';

const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_');

/** มุมมองอ่านอย่างเดียวของนักเรียน/ครู: เลือกดูได้ + Export เท่านั้น (ไม่มีเมนูแก้ไขใดๆ) */
export default function Viewer() {
  const { role, payload, logout } = useSession();
  const [id, setId] = useState(payload?.items[0]?.id ?? '');
  const [busy, setBusy] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  const isStudent = role === 'student';

  const options = useMemo(() => (payload?.items ?? []).map((i) => ({ value: i.id, label: i.label })), [payload]);
  if (!payload) return null;
  const item = payload.items.find((i) => i.id === id) ?? payload.items[0];
  const noun = isStudent ? 'กลุ่มเรียน' : 'ครู';

  const doPdf = async () => {
    if (!gridRef.current || !item) return;
    setBusy('กำลังสร้าง PDF…');
    try { await exportElementToPdf(gridRef.current, `${safe(item.grid.title)}.pdf`); }
    catch (e) { window.alert('สร้าง PDF ไม่สำเร็จ: ' + (e as Error).message); }
    finally { setBusy(''); }
  };
  const doExcel = async (all: boolean) => {
    if (!item) return;
    setBusy('กำลังสร้าง Excel…');
    try {
      const grids = all ? payload.items.map((i) => i.grid) : [item.grid];
      await exportTimetableExcel(grids, all ? `ตารางสอน_ทุก${noun}.xlsx` : `${safe(item.grid.title)}.xlsx`);
    } catch (e) { window.alert('สร้าง Excel ไม่สำเร็จ: ' + (e as Error).message); }
    finally { setBusy(''); }
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div>
          <div className="brand">ระบบจัดตารางสอน</div>
          <div className="brand-sub">โหมดอ่านอย่างเดียว</div>
        </div>
        <nav className="nav">
          <a className="active" aria-current="page"><span className="ico">▦</span> {isStudent ? 'ตารางเรียน' : 'ตารางสอน'}</a>
        </nav>
        <div className="side-user">
          <span className="role-badge">{isStudent ? 'นักเรียน' : 'ครู'}</span>
          <button className="btn sm" onClick={logout}>ออกจากระบบ</button>
        </div>
      </aside>
      <main className="main">
        <h1>{isStudent ? 'ตารางเรียน' : 'ตารางสอน'}{payload.title ? ` — ${payload.title}` : ''}</h1>
        <p className="page-sub">เผยแพร่เมื่อ {new Date(payload.publishedAt).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })} • ถ้าตารางมีการเปลี่ยนแปลง ให้รีเฟรชหน้าเว็บหรือสอบถามผู้ดูแล</p>

        <div className="card">
          <div className="toolbar">
            <div className="field">เลือก{noun}
              <SearchSelect value={item?.id ?? ''} onChange={setId} width={300} options={options} placeholder={`พิมพ์ค้นหา${noun}…`} />
            </div>
            <span className="spacer" />
          </div>
          <div className="toolbar" style={{ marginTop: 14 }}>
            <button className="btn" disabled={!item || !!busy} onClick={doPdf}>Export PDF</button>
            <button className="btn" disabled={!item || !!busy} onClick={() => doExcel(false)}>Export Excel (รายการนี้)</button>
            <button className="btn" disabled={!item || !!busy} onClick={() => doExcel(true)}>Export Excel (ทุก{noun})</button>
            {busy && <span className="hint" style={{ margin: 0 }}>{busy}</span>}
          </div>
        </div>

        {item
          ? <div className="card" style={{ padding: 0 }}><TimetableGrid ref={gridRef} grid={item.grid} /></div>
          : <div className="card empty">ไม่พบข้อมูลในตารางที่เผยแพร่</div>}
        <SiteFooter />
      </main>
    </div>
  );
}
