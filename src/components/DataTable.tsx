import { ReactNode } from 'react';

export interface Column<T> { header: string; render: (t: T) => ReactNode; width?: string }

export default function DataTable<T extends { id: string }>({
  rows, columns, onDelete, empty = 'ยังไม่มีข้อมูลในระบบ',
}: { rows: T[]; columns: Column<T>[]; onDelete: (t: T) => void; empty?: string }) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  return (
    <table className="data">
      <thead>
        <tr>
          <th style={{ width: 48 }}>#</th>
          {columns.map((c) => <th key={c.header} style={{ width: c.width }}>{c.header}</th>)}
          <th style={{ width: 80 }} />
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id}>
            <td>{i + 1}</td>
            {columns.map((c) => <td key={c.header}>{c.render(r)}</td>)}
            <td><button className="btn danger sm" onClick={() => onDelete(r)}>ลบ</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
