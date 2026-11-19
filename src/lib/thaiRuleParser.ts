import { DAY_NAMES, Settings, Slot } from '../types';

/**
 * แปลงเงื่อนไขกรณีพิเศษที่พิมพ์เป็นภาษาไทย -> รายการช่องเวลา (วัน, คาบ)
 *
 * ตัวอย่างที่รองรับ
 *   ทุกวันคาบที่1            -> ทุกวัน คาบ 1
 *   วันพุธ คาบ 7-8           -> พุธ คาบ 7,8
 *   จันทร์-ศุกร์ คาบสุดท้าย  -> จันทร์..ศุกร์ คาบสุดท้ายของวัน
 *   วันศุกร์ช่วงบ่าย         -> ศุกร์ คาบหลังพักเที่ยงทั้งหมด
 *   จันทร์ คาบ 1; พุธ คาบ 3   -> หลายเงื่อนไข คั่นด้วย ; หรือขึ้นบรรทัดใหม่
 *
 * count (จำนวนคาบต่อครั้ง): ถ้าเงื่อนไขระบุคาบเริ่มต้นเพียงคาบเดียว และ count > 1
 * ระบบจะกินคาบต่อเนื่องจากคาบเริ่มต้นนั้น เช่น คาบ 3 + count 2 -> คาบ 3,4
 */

export interface ParseResult {
  ok: boolean;
  slots: Slot[];
  error?: string;
  notes: string[];
}

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const DAY_PATTERNS: [string, number][] = [
  ['จันทร์', 0], ['อังคาร', 1], ['พุธ', 2], ['พฤหัสบดี', 3], ['พฤหัส', 3], ['ศุกร์', 4], ['เสาร์', 5], ['อาทิตย์', 6],
];
const DAY_RE = '(จันทร์|อังคาร|พุธ|พฤหัสบดี|พฤหัส|ศุกร์|เสาร์|อาทิตย์)';
const RANGE_SEP = '(?:-|–|—|ถึง|จนถึง|ไปถึง|ไปจนถึง)';

const dayIndex = (name: string) => DAY_PATTERNS.find(([n]) => n === name)![1];
const normalize = (s: string) =>
  s
    .replace(/[๐-๙]/g, (c) => String(THAI_DIGITS.indexOf(c)))
    .replace(/\s+/g, '')
    .replace(/วัน(?=ทุก|จันทร์|อังคาร|พุธ|พฤหัส|ศุกร์|เสาร์|อาทิตย์)/g, '');

export const dayName = (d: number) => DAY_NAMES[d] ?? `วัน${d}`;

function parseClause(raw: string, settings: Settings, count: number, notes: string[]): { slots: Slot[]; error?: string } {
  let t = normalize(raw);
  if (!t) return { slots: [] };
  const nPeriods = settings.periods.length;

  // ---------- วัน ----------
  let days: number[] = [];
  if (/ทุกวัน/.test(t)) {
    days = [...settings.days];
    t = t.replace(/ทุกวัน/g, '');
  }
  const rangeRe = new RegExp(`${DAY_RE}${RANGE_SEP}${DAY_RE}`, 'g');
  t = t.replace(rangeRe, (_m, a: string, b: string) => {
    const from = dayIndex(a);
    const to = dayIndex(b);
    for (let d = from; d <= to; d++) days.push(d);
    return '';
  });
  const singleRe = new RegExp(DAY_RE, 'g');
  t = t.replace(singleRe, (_m, a: string) => {
    days.push(dayIndex(a));
    return '';
  });
  days = [...new Set(days)].sort((a, b) => a - b);

  // ---------- คาบ ----------
  let periods: number[] = [];
  let singleStart = false;

  if (/ช่วงเช้า|ภาคเช้า/.test(t)) {
    if (!settings.lunchAfter) return { slots: [], error: 'ใช้ "ช่วงเช้า" ไม่ได้ เพราะยังไม่ได้ตั้งค่าพักเที่ยงในหน้าตั้งค่าคาบเรียน' };
    for (let p = 1; p <= settings.lunchAfter; p++) periods.push(p);
    t = t.replace(/ช่วงเช้า|ภาคเช้า/g, '');
  }
  if (/ช่วงบ่าย|ภาคบ่าย/.test(t)) {
    if (!settings.lunchAfter) return { slots: [], error: 'ใช้ "ช่วงบ่าย" ไม่ได้ เพราะยังไม่ได้ตั้งค่าพักเที่ยงในหน้าตั้งค่าคาบเรียน' };
    for (let p = settings.lunchAfter + 1; p <= nPeriods; p++) periods.push(p);
    t = t.replace(/ช่วงบ่าย|ภาคบ่าย/g, '');
  }
  if (/คาบสุดท้าย/.test(t)) {
    periods.push(nPeriods);
    singleStart = true;
    t = t.replace(/คาบสุดท้าย/g, '');
  }
  if (/คาบแรก/.test(t)) {
    periods.push(1);
    singleStart = true;
    t = t.replace(/คาบแรก/g, '');
  }
  const pm = t.match(/คาบ(?:ที่)?(\d+(?:(?:-|–|—|ถึง|,|และ|&)\d+)*)/);
  if (pm) {
    const parts = pm[1].split(/,|และ|&/);
    const listed: number[] = [];
    for (const part of parts) {
      const r = part.match(/^(\d+)(?:-|–|—|ถึง)(\d+)$/);
      if (r) {
        const a = +r[1], b = +r[2];
        for (let p = Math.min(a, b); p <= Math.max(a, b); p++) listed.push(p);
      } else listed.push(+part);
    }
    if (listed.length === 1) singleStart = true;
    periods.push(...listed);
    t = t.replace(pm[0], '');
  }
  periods = [...new Set(periods)].sort((a, b) => a - b);

  const leftover = t.replace(/[,.:;()คาบที่และ&]/g, '');
  if (!periods.length && !days.length) {
    return { slots: [], error: `อ่านเงื่อนไข "${raw.trim()}" ไม่ออก — ลองใช้รูปแบบ เช่น "ทุกวันคาบที่ 1", "วันพุธ คาบ 7-8", "ศุกร์ช่วงบ่าย"` };
  }
  if (!periods.length) return { slots: [], error: `เงื่อนไข "${raw.trim()}" ไม่ได้ระบุคาบ (เช่น "คาบที่ 3" หรือ "ช่วงบ่าย")` };
  if (!days.length) {
    days = [...settings.days];
    notes.push(`"${raw.trim()}" ไม่ได้ระบุวัน ระบบถือว่าเป็นทุกวัน`);
  }
  if (leftover) notes.push(`ไม่ได้ใช้ข้อความ "${leftover}" ในเงื่อนไข "${raw.trim()}"`);

  if (singleStart && count > 1) {
    const start = periods[0];
    periods = [];
    for (let p = start; p < start + count; p++) periods.push(p);
  }

  const slots: Slot[] = [];
  for (const d of days) {
    if (!settings.days.includes(d)) {
      notes.push(`${dayName(d)} ไม่ได้เปิดสอนในการตั้งค่า จึงข้ามไป`);
      continue;
    }
    for (const p of periods) {
      if (p < 1 || p > nPeriods) return { slots: [], error: `คาบที่ ${p} ไม่มีในการตั้งค่า (มี ${nPeriods} คาบต่อวัน)` };
      slots.push({ day: d, period: p });
    }
  }
  return { slots };
}

export function parseCondition(text: string, settings: Settings, count = 1): ParseResult {
  const notes: string[] = [];
  if (!text.trim()) return { ok: false, slots: [], error: 'กรุณาพิมพ์เงื่อนไข', notes };
  if (!settings.days.length || !settings.periods.length) {
    return { ok: false, slots: [], error: 'ยังไม่ได้ตั้งค่าวันและคาบเรียน (ไปที่แท็บ "ตั้งค่าคาบเรียน")', notes };
  }
  const clauses = text.split(/[;\n]+/).filter((c) => c.trim());
  const all: Slot[] = [];
  for (const c of clauses) {
    const r = parseClause(c, settings, Math.max(1, count || 1), notes);
    if (r.error) return { ok: false, slots: [], error: r.error, notes };
    all.push(...r.slots);
  }
  const seen = new Set<string>();
  const slots = all.filter((s) => {
    const k = `${s.day}-${s.period}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  slots.sort((a, b) => a.day - b.day || a.period - b.period);
  if (!slots.length) return { ok: false, slots, error: 'เงื่อนไขนี้ไม่ตรงกับวัน/คาบที่เปิดสอนเลย', notes };
  return { ok: true, slots, notes };
}

/** สรุปช่องเวลาเป็นข้อความสั้น เช่น "ทุกวัน • คาบ 1" */
export function describeSlots(slots: Slot[], settings: Settings): string {
  if (!slots.length) return '-';
  const byDay = new Map<number, number[]>();
  for (const s of slots) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s.period]);
  const groupsByPeriods = new Map<string, number[]>();
  for (const [d, ps] of byDay) {
    const key = ps.join(',');
    groupsByPeriods.set(key, [...(groupsByPeriods.get(key) ?? []), d]);
  }
  const fmtPeriods = (ps: number[]) => {
    const out: string[] = [];
    let i = 0;
    while (i < ps.length) {
      let j = i;
      while (j + 1 < ps.length && ps[j + 1] === ps[j] + 1) j++;
      out.push(j > i ? `${ps[i]}-${ps[j]}` : `${ps[i]}`);
      i = j + 1;
    }
    return `คาบ ${out.join(', ')}`;
  };
  return [...groupsByPeriods.entries()]
    .map(([key, ds]) => {
      const dayTxt = ds.length === settings.days.length && settings.days.every((d) => ds.includes(d)) ? 'ทุกวัน' : ds.map(dayName).join(', ');
      return `${dayTxt} • ${fmtPeriods(key.split(',').map(Number))}`;
    })
    .join(' ; ');
}
