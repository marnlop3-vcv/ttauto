import { useEffect, useMemo, useRef, useState } from 'react';
import GettingStarted from '../components/GettingStarted';
import { SearchSelect } from '../components/Search';
import TimetableGrid from '../components/TimetableGrid';
import { exportTimetableExcel } from '../lib/excel';
import { exportElementToPdf } from '../lib/pdf';
import type { Progress } from '../lib/scheduler';
import { runScheduler } from '../lib/schedulerClient';
import { buildGrid, GridData, listOptions, VIEW_LABEL, ViewKind } from '../lib/views';
import { useStore } from '../store';

export default function Dashboard() {
  const data = useStore();
  const [kind, setKind] = useState<ViewKind>('group');
  const [id, setId] = useState('');
  const [busy, setBusy] = useState('');
  const [running, setRunning] = useState(false);
  const [prog, setProg] = useState<Progress | null>(null);
  const [seconds, setSeconds] = useState<number>(() => {
    try { return Number(localStorage.getItem('tt-seconds')) || 15; } catch { return 15; }
  });
  const stopRef = useRef<() => void>(() => {});
  const gridRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => listOptions(kind, data), [kind, data.teachers, data.groups, data.buildings]);
  useEffect(() => {
    if (!options.find((o) => o.id === id)) setId(options[0]?.id ?? '');
  }, [options, id]);

  const grid = useMemo(() => (id ? buildGrid(kind, id, data) : null), [kind, id, data.schedule, data.settings, data.teachers, data.groups, data.subjects, data.buildings, data.assignments]);
  const configured = data.settings.days.length > 0 && data.settings.periods.length > 0;
  const hasWork = data.assignments.length > 0;

  const run = async () => {
    setRunning(true);
    setProg(null);
    try { localStorage.setItem('tt-seconds', String(seconds)); } catch { /* ignore */ }
    const { settings, teachers, groups, subjects, buildings, specialCases, assignments } = data;
    const h = runScheduler({ settings, teachers, groups, subjects, buildings, specialCases, assignments }, { timeLimitMs: seconds * 1000 }, setProg);
    stopRef.current = h.stop;
    try {
      data.setSchedule(await h.promise);
    } catch (e) {
      window.alert('จัดตารางไม่สำเร็จ: ' + (e as Error).message);
    } finally {
      setRunning(false);
      setProg(null);
    }
  };

  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, '_');
  const doPdf = async () => {
    if (!gridRef.current || !grid) return;
    setBusy('กำลังสร้าง PDF…');
    try { await exportElementToPdf(gridRef.current, `${safe(grid.title)}.pdf`); }
    catch (e) { window.alert('สร้าง PDF ไม่สำเร็จ: ' + (e as Error).message); }
    finally { setBusy(''); }
  };
  const doExcel = async (all: boolean) => {
    setBusy('กำลังสร้าง Excel…');
    try {
      const ids = all ? options.map((o) => o.id) : [id];
      const grids = ids.map((x) => buildGrid(kind, x, data)).filter(Boolean) as GridData[];
      await exportTimetableExcel(grids, all ? `ตารางสอน_ทุก${VIEW_LABEL[kind]}.xlsx` : `${safe(grids[0].title)}.xlsx`);
    } catch (e) { window.alert('สร้าง Excel ไม่สำเร็จ: ' + (e as Error).message); }
    finally { setBusy(''); }
  };

  const s = data.schedule;
  const placed = s ? s.entries.length : 0;

  return (
    <>
      <h1>Dashboard</h1>
      <p className="page-sub">ดูตารางสอนตามครู กลุ่มเรียน หรืออาคาร และส่งออกเป็น PDF / Excel</p>

      <GettingStarted onRun={run} canRun={configured && hasWork && !busy} running={running} />

      <div className="card">
        <div className="toolbar">
          <label className="field">แสดงตารางของ
            <div className="seg">
              {(Object.keys(VIEW_LABEL) as ViewKind[]).map((k) => (
                <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{VIEW_LABEL[k]}</button>
              ))}
            </div>
          </label>
          <div className="field">เลือก{VIEW_LABEL[kind]}
            <SearchSelect value={id} onChange={setId} width={280} placeholder={`พิมพ์ค้นหา${VIEW_LABEL[kind]}…`} options={options.map((o) => ({ value: o.id, label: o.label }))} />
          </div>
          <span className="spacer" />
          <label className="field" title="ยิ่งให้เวลามาก ตารางยิ่งสวยขึ้น (ถ้าข้อมูลน้อย ระบบจะจบก่อนเวลาเมื่อไม่ดีขึ้นแล้ว)">เวลาประมวลผลสูงสุด
            <select value={seconds} disabled={running} onChange={(e) => setSeconds(+e.target.value)} style={{ minWidth: 130 }}>
              {[5, 15, 30, 60, 120].map((n) => <option key={n} value={n}>{n} วินาที</option>)}
            </select>
          </label>
          {running ? (
            <button className="btn danger" onClick={() => stopRef.current()}>■ หยุดและใช้ผลที่ดีที่สุดตอนนี้</button>
          ) : (
            <button className="btn primary" disabled={!configured || !hasWork || !!busy} onClick={run}>⚙ จัดตารางอัตโนมัติ</button>
          )}
        </div>
        <div className="toolbar" style={{ marginTop: 14 }}>
          <button className="btn" disabled={!grid || !s || !!busy} onClick={doPdf}>Export PDF</button>
          <button className="btn" disabled={!grid || !s || !!busy} onClick={() => doExcel(false)}>Export Excel (รายการนี้)</button>
          <button className="btn" disabled={!grid || !s || !!busy} onClick={() => doExcel(true)}>Export Excel (ทุก{VIEW_LABEL[kind]})</button>
          {busy && <span className="hint" style={{ margin: 0 }}>{busy}</span>}
        </div>

        {running && (
          <div className="msg warn" style={{ marginTop: 12 }}>
            กำลังจัดตารางและปรับให้สวยขึ้น… {prog ? `${Math.min(100, Math.round((prog.elapsedMs / prog.limitMs) * 100))}%` : 'เริ่มต้น'}
            {prog && <> • ยังจัดไม่ได้ {prog.unplacedPeriods} คาบ • คะแนนความไม่สวยดีที่สุด {prog.bestCost.toFixed(1)} • ลองไปแล้ว {prog.iterations.toLocaleString('th-TH')} ครั้ง</>}
            <div className="progress"><div style={{ width: `${prog ? Math.min(100, (prog.elapsedMs / prog.limitMs) * 100) : 2}%` }} /></div>
          </div>
        )}
        {s && (
          <div className="status-row">
            <span className="stat">วางแล้ว {placed} / {s.totalUnits} คาบ</span>
            {!!s.merged && <span className="stat">รวมสอนพร้อมกัน {s.merged} รายการ</span>}
            {s.quality && (
              <span className="stat" title={`คะแนนความไม่สวยรวม (ยิ่งต่ำยิ่งดี) ${s.quality.initial} → ${s.quality.final} • ลองปรับ ${s.quality.iterations.toLocaleString('th-TH')} ครั้ง ใน ${s.quality.seconds} วินาที`}>
                คาบว่างคั่น นักเรียน {s.quality.before.groupGaps} → <b>{s.quality.after.groupGaps}</b> • ครู {s.quality.before.teacherGaps} → <b>{s.quality.after.teacherGaps}</b>
                {(s.quality.before.overload > 0 || s.quality.after.overload > 0) && <> • ครูสอนติดกันเกิน 4 คาบ {s.quality.before.overload} → <b>{s.quality.after.overload}</b></>}
              </span>
            )}
            <span className="stat">กรณีพิเศษ {new Set(s.specials.map((x) => x.caseId)).size} รายการ</span>
            <span className="stat">จัดเมื่อ {new Date(s.createdAt).toLocaleString('th-TH')}</span>
          </div>
        )}
        {data.stale && <div className="msg warn">ข้อมูลมีการเปลี่ยนแปลงหลังจัดตารางล่าสุด — กด "จัดตารางอัตโนมัติ" เพื่อคำนวณใหม่</div>}
        {s && s.warnings && s.warnings.length > 0 && (
          <div className="msg warn">ข้อสังเกต:<ul>{s.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>
        )}
        {s && s.unplaced.length > 0 && (
          <div className="msg err">
            จัดไม่ได้ {s.unplaced.reduce((n, u) => n + u.missing, 0)} คาบ:
            <ul>{s.unplaced.map((u, i) => <li key={i}>{u.reason}</li>)}</ul>
          </div>
        )}
        {s && s.unplaced.length === 0 && <div className="msg ok">จัดตารางครบทุกคาบ ไม่มีครู กลุ่มเรียน หรือห้องชนกัน</div>}
        {configured && !hasWork && <div className="msg warn">ยังไม่มีกำหนดการเรียน — เพิ่มได้ที่ กรอกข้อมูล › กำหนดการเรียน</div>}
        {configured && hasWork && !s && <div className="msg warn">ยังไม่ได้จัดตาราง กดปุ่ม "จัดตารางอัตโนมัติ" ได้เลย</div>}
      </div>

      {grid ? <div className="card" style={{ padding: 0 }}><TimetableGrid ref={gridRef} grid={grid} /></div>
        : configured && <div className="card empty">ยังไม่มี{VIEW_LABEL[kind]}ในระบบ — เพิ่มได้ที่เมนู กรอกข้อมูล</div>}
    </>
  );
}
