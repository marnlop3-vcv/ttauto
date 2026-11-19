import { useRef, useState } from 'react';
import { EntityDef } from '../lib/entities';
import { analyzeImport, downloadTemplate } from '../lib/excel';
import { useStore } from '../store';

export default function ExcelButtons<T extends { id: string }>({ def, items }: { def: EntityDef<T>; items: T[] }) {
  const input = useRef<HTMLInputElement>(null);
  const { settings, groups, teachers, addMany } = useStore();
  const [report, setReport] = useState<{ added: number; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const r = await analyzeImport(file, def, { settings, groups, teachers }, items as any);
      if (r.items.length) addMany(def.kind, r.items);
      setReport({ added: r.items.length, errors: r.errors });
    } catch (e) {
      setReport({ added: 0, errors: ['อ่านไฟล์ไม่สำเร็จ: ' + (e as Error).message + ''] });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="btn-group" role="group" aria-label="ดาวน์โหลด Template">
          <span className="btn-group-label">⬇ Template</span>
          <button className="btn" onClick={() => downloadTemplate(def, 'xlsx')}>Excel</button>
          <button className="btn" onClick={() => downloadTemplate(def, 'csv')}>CSV</button>
          <button className="btn" onClick={() => downloadTemplate(def, 'json')}>JSON</button>
        </div>
        <button className="btn" disabled={busy} onClick={() => input.current?.click()} title="รองรับไฟล์ .xlsx .csv .json (อ่านจากเครื่องของคุณ ไม่อัปโหลดไปที่ใด)">⬆ Import จากไฟล์</button>
        <input ref={input} type="file" accept=".xlsx,.csv,.json,.txt" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
      {report && (
        <div className={`msg ${report.errors.length ? (report.added ? 'warn' : 'err') : 'ok'}`}>
          นำเข้าสำเร็จ {report.added} รายการ{report.errors.length ? ` • ข้าม/ผิดพลาด ${report.errors.length} รายการ` : ''}
          {report.errors.length > 0 && <ul>{report.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}{report.errors.length > 12 && <li>… และอีก {report.errors.length - 12} รายการ</li>}</ul>}
        </div>
      )}
    </div>
  );
}
