import { ReactNode, useState } from 'react';
import DataTable, { Column } from '../../components/DataTable';
import ExcelButtons from '../../components/ExcelButtons';
import { EntityDef } from '../../lib/entities';
import { useStore } from '../../store';

export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface Props<T extends { id: string }> {
  def: EntityDef<T>;
  title: string;
  fields: FieldDef[];
  items: T[];
  columns: Column<T>[];
  addLabel: string;
  hint?: ReactNode;
  nameOf: (t: T) => string;
}

export default function EntityTab<T extends { id: string }>({ def, title, fields, items, columns, addLabel, hint, nameOf }: Props<T>) {
  const { settings, groups, teachers, addMany, remove, usage } = useStore();
  const empty = () => Object.fromEntries(fields.map((f) => [f.key, f.type === 'select' ? f.options?.[0]?.value ?? '' : '']));
  const [values, setValues] = useState<Record<string, string>>(empty);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = def.fromRow(fields.map((f) => values[f.key] ?? ''), { settings, groups, teachers });
    if (!r.value) return setMsg({ ok: false, text: r.error ?? 'ข้อมูลไม่ถูกต้อง' });
    const key = def.identity(r.value);
    if (items.some((it) => def.identity(it as any) === key)) return setMsg({ ok: false, text: `"${key}" มีอยู่ในระบบแล้ว` });
    addMany(def.kind, [r.value]);
    setValues(empty());
    setMsg({ ok: true, text: `เพิ่ม${def.label} "${key}" เรียบร้อย` });
  };

  const onDelete = (t: T) => {
    const n = usage(def.kind, t.id);
    const warn = n > 0 ? `\n\n⚠ ถูกใช้ในกำหนดการเรียน ${n} รายการ — กำหนดการที่เกี่ยวข้องอาจถูกลบหรือแก้ไขด้วย` : '';
    if (!window.confirm(`ลบ "${nameOf(t)}" ออกจากระบบ?${warn}`)) return;
    const r = remove(def.kind, t.id);
    setMsg({ ok: true, text: `ลบ "${nameOf(t)}" แล้ว${r.assignmentsRemoved ? ` (กำหนดการเรียนถูกลบ ${r.assignmentsRemoved} รายการ)` : ''}` });
  };

  return (
    <>
      <div className="card">
        <h2>เพิ่ม{title}</h2>
        <form className="form-row" onSubmit={submit}>
          {fields.map((f) => (
            <label className="field" key={f.key}>
              {f.label}
              {f.type === 'select' ? (
                <select value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                  {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'} min={f.type === 'number' ? 1 : undefined}
                  value={values[f.key]} placeholder={f.placeholder}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              )}
            </label>
          ))}
          <button className="btn primary" type="submit">{addLabel}</button>
        </form>
        {hint && <div className="hint">{hint}</div>}
        {msg && <div className={`msg ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '18px 0' }} />
        <ExcelButtons def={def} items={items} />
      </div>
      <div className="card">
        <h2>{title}ที่มีอยู่ในระบบ ({items.length})</h2>
        <DataTable rows={items} columns={columns} onDelete={onDelete} />
      </div>
    </>
  );
}
