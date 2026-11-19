import { useMemo, useRef, useState } from 'react';

export interface Opt { value: string; label: string }

const match = (label: string, q: string) => label.toLowerCase().includes(q.trim().toLowerCase());
const MAX_SHOWN = 100;

/** ช่องเลือก 1 ค่า พิมพ์ค้นหาได้ (ใช้แทน <select> เมื่อข้อมูลเยอะ) */
export function SearchSelect({ options, value, onChange, placeholder = 'พิมพ์เพื่อค้นหา…', disabled, width = 260 }: {
  options: Opt[]; value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean; width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => options.filter((o) => match(o.label, q)), [options, q]);
  const shown = filtered.slice(0, MAX_SHOWN);

  const pick = (o: Opt) => { onChange(o.value); setOpen(false); setQ(''); ref.current?.blur(); };

  return (
    <div className="ss" style={{ width }}>
      <input
        ref={ref} type="text" className="ss-input" disabled={disabled} autoComplete="off"
        value={open ? q : selected?.label ?? ''} placeholder={selected ? selected.label : placeholder}
        onFocus={() => { setOpen(true); setQ(''); setHl(0); }}
        onBlur={() => setOpen(false)}
        onChange={(e) => { setQ(e.target.value); setHl(0); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(h + 1, shown.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); if (shown[hl]) pick(shown[hl]); }
          else if (e.key === 'Escape') { setOpen(false); ref.current?.blur(); }
        }}
      />
      <span className="ss-caret">▾</span>
      {open && (
        <div className="ss-list">
          {shown.length === 0 && <div className="ss-none">{options.length ? 'ไม่พบรายการที่ค้นหา' : 'ยังไม่มีข้อมูล'}</div>}
          {shown.map((o, i) => (
            <div
              key={o.value} className={`ss-opt ${i === hl ? 'hl' : ''} ${o.value === value ? 'sel' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setHl(i)}
            >{o.label}</div>
          ))}
          {filtered.length > MAX_SHOWN && <div className="ss-none">แสดง {MAX_SHOWN} จาก {filtered.length} รายการ — พิมพ์เพิ่มเพื่อกรอง</div>}
        </div>
      )}
    </div>
  );
}

/** ช่องเลือกหลายค่า พิมพ์ค้นหาได้ มีรายการที่เลือกแสดงเป็นป้าย */
export function SearchMulti({ items, selected, onChange, empty = 'ยังไม่มีข้อมูล', placeholder = 'พิมพ์เพื่อค้นหา…', width = 260 }: {
  items: Opt[]; selected: string[]; onChange: (v: string[]) => void; empty?: string; placeholder?: string; width?: number;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => items.filter((o) => match(o.label, q)), [items, q]);
  const shown = filtered.slice(0, MAX_SHOWN);
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const label = (v: string) => items.find((i) => i.value === v)?.label ?? '?';

  return (
    <div className="smulti" style={{ width }}>
      <input type="text" className="sm-search" value={q} placeholder={placeholder} autoComplete="off" onChange={(e) => setQ(e.target.value)} />
      <div className="checklist">
        {items.length === 0 && <div className="none">{empty}</div>}
        {items.length > 0 && shown.length === 0 && <div className="none">ไม่พบรายการที่ค้นหา</div>}
        {shown.map((o) => (
          <label key={o.value}>
            <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggle(o.value)} /> {o.label}
          </label>
        ))}
        {filtered.length > MAX_SHOWN && <div className="none">แสดง {MAX_SHOWN} จาก {filtered.length} — พิมพ์เพิ่มเพื่อกรอง</div>}
      </div>
      <div className="sm-actions">
        <button type="button" className="link" disabled={!q.trim() || !filtered.length}
          onClick={() => onChange([...new Set([...selected, ...filtered.map((o) => o.value)])])}>เลือกทั้งหมดที่ค้นเจอ ({q.trim() ? filtered.length : 0})</button>
        <button type="button" className="link" disabled={!selected.length} onClick={() => onChange([])}>ล้างที่เลือก</button>
      </div>
      {selected.length > 0 && (
        <div className="sm-chips">
          {selected.map((v) => (
            <span key={v} className="chip">{label(v)} <button type="button" className="x" aria-label="เอาออก" onClick={() => toggle(v)}>×</button></span>
          ))}
        </div>
      )}
    </div>
  );
}
