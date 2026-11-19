import { forwardRef, Fragment } from 'react';
import { CellItem, GridData } from '../lib/views';

function Cell({ items, span }: { items: CellItem[]; span: number }) {
  return (
    <>
      {items.map((it, i) => (
        <div key={i} className={`item ${it.kind}`}>
          <div className="t">{it.title}{span > 1 && <span className="span-tag">{span} คาบติดกัน</span>}</div>
          {it.lines.filter(Boolean).map((l, j) => <div key={j} className="l">{l}</div>)}
        </div>
      ))}
    </>
  );
}

const TimetableGrid = forwardRef<HTMLDivElement, { grid: GridData }>(({ grid }, ref) => {
  const lunch = grid.lunchAfter;
  return (
    <div className="grid-scroll">
      <div className="grid-wrap" ref={ref}>
        <div className="grid-title">
          <h2>{grid.title}</h2>
          <div>{grid.subtitle}</div>
        </div>
        <table className="tt">
          <thead>
            <tr>
              <th className="day">วัน / คาบ</th>
              {grid.periods.map((p, i) => (
                <Fragment key={i}>
                  <th>{p.label}<small>{p.time}</small></th>
                  {lunch > 0 && i + 1 === lunch && <th className="lunch" />}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((r, ri) => (
              <tr key={r.dayLabel}>
                <th className="day">{r.dayLabel}</th>
                {r.cells.map((c) => (
                  <Fragment key={c.from}>
                    <td colSpan={c.span}><Cell items={c.items} span={c.span} /></td>
                    {lunch > 0 && c.from + c.span === lunch && ri === 0 && (
                      <td className="lunch" rowSpan={grid.rows.length}><span>พักเที่ยง</span></td>
                    )}
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="summary">
          <div className="sum-total">
            สรุปต่อสัปดาห์: <b>{grid.summary.total}</b> {grid.summary.totalLabel}
            {grid.summary.special > 0 && <span className="sum-sp"> + กรณีพิเศษ {grid.summary.special} คาบ</span>}
          </div>
          {grid.summary.items.length > 0 && (
            <div className="sum-items">
              {grid.summary.items.map((it) => (
                <span key={it.label} className={`sum-chip ${it.special ? 'sp' : ''}`}>{it.label} <b>{it.count}</b> คาบ</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
export default TimetableGrid;
