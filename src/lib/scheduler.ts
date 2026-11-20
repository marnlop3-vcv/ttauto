import {
  Assignment, Building, Group, Metrics, PlacedEntry, Schedule, Settings, SpecialCase, SpecialSlot, Subject, Teacher, Unplaced,
  roomKeyOf, roomsOf,
} from '../types';
import { parseCondition } from './thaiRuleParser';

export interface SchedulerInput {
  settings: Settings;
  teachers: Teacher[];
  groups: Group[];
  subjects: Subject[];
  buildings: Building[];
  specialCases: SpecialCase[];
  assignments: Assignment[];
}

export interface SchedulerOptions {
  /** เวลาประมวลผลสูงสุด (มิลลิวินาที) ค่าเริ่มต้น 15 วินาที */
  timeLimitMs?: number;
  seed?: number;
  /** จำนวนคาบติดกันสูงสุดต่อ 1 ช่วง (ค่าเริ่มต้น 4) วิชาที่มากกว่านี้จะถูกแบ่งเป็นหลายช่วงที่ติดกันช่วงละไม่เกินค่านี้ */
  consecutiveMax?: number;
}

export interface Progress {
  elapsedMs: number;
  limitMs: number;
  cost: number;
  bestCost: number;
  unplacedPeriods: number;
  iterations: number;
}

/** น้ำหนักของ "ความไม่สวย" (soft constraints) ยิ่งรวมต่ำยิ่งดี */
export const WEIGHTS = {
  gapGroup: 8,      // คาบว่างคั่นกลางวันเรียนของกลุ่มเรียน (ต่อ 1 คาบว่าง) — ให้ความสำคัญกับนักเรียนมากกว่าครู
  gapTeacher: 2,    // คาบว่างคั่นกลางวันสอนของครู
  overload: 3,      // ครูสอนติดกันเกิน 4 คาบ (ต่อ 1 คาบที่เกิน; พักเที่ยงตัดช่วง)
  loadGroup: 0.4,   // ถ่วงภาระรายวันของกลุ่มเรียนให้สมดุล (ผลรวมกำลังสอง)
  loadTeacher: 0.15,
  spread: 2,        // ช่วงของวิชาเดียวกันกระจุกวันเดียวกัน (ต่อคู่)
  joined: 40,       // ช่วงของวิชาเดียวกันมาติดกันจนยาวเกินที่กำหนด (เช่น 3+2 ติดกัน = 5 คาบ) — ปรับหนักเพื่อให้เกิดน้อยที่สุด
  start: 0.03,      // ชอบคาบต้นๆ ของวันเล็กน้อย (ลดช่องว่าง)
};
const MAX_RUN = 4;

/** random แบบกำหนด seed ได้ (mulberry32) เพื่อให้ทดสอบซ้ำได้ */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

interface Member { a: Assignment; groupIds: string[] }
interface Unit {
  idx: number;
  members: Member[];
  res: number[];          // index ของทรัพยากร (ครู/กลุ่ม/ห้อง)
  need: number;           // จำนวนคาบต่อสัปดาห์
  subjectId: string;
  multi: boolean;         // มีหลายชิ้น (ใช้คิดค่ากระจุกวัน)
}
interface Piece { id: number; unit: Unit; size: number; di: number; start: number } // start: 1-based, -1 = ยังไม่ได้วาง

/**
 * อัลกอริทึม: Greedy -> ซ่อมแซม (Ejection Chain) -> Simulated Annealing
 *
 *  0) ครูชื่อเดียวกันคนละหน้าที่ถือเป็นคนเดียวกัน
 *     กำหนดการ "เรียนรวมกัน" ที่ วิชา+ครู+ห้อง เดียวกันถูกรวมเป็นหน่วยเดียว; "แยกเรียน" แตกเป็นหน่วยละกลุ่ม
 *  1) ทุกวิชาแบ่งเป็น "ชิ้น" ที่เป็นช่วงติดกัน ชิ้นละไม่เกิน 4 คาบ (ไม่ข้ามพักเที่ยง) ใช้จำนวนชิ้นน้อยสุดและแบ่งเท่าๆ กัน
 *     เช่น 4 = 4, 5 = 3+2, 6 = 3+3, 7 = 4+3, 8 = 4+4; ชิ้นของวิชาเดียวกันพยายามอยู่คนละวัน
 *  2) วางกรณีพิเศษก่อน (ล็อกช่องเวลา) แล้ว Greedy วางทีละชิ้นที่ยากก่อน
 *  3) ชิ้นที่วางไม่ลง -> ย้ายชิ้นที่ขวางเป็นทอดๆ (Ejection chain + Tabu)
 *  4) Simulated Annealing: ย้าย/สลับชิ้นโดยรักษาข้อบังคับ (ครู/กลุ่ม/ห้องไม่ชน) ตลอด
 *     เพื่อลดคะแนนความไม่สวย (คาบว่างคั่น, ครูสอนติดกันนานเกิน, ภาระรายวันไม่สมดุล, วิชากระจุกวัน)
 *  5) ถ้าวิชาที่ต้องติดกันวางไม่ได้จริงๆ จะแยกเป็นช่วงย่อยและแจ้งเตือน
 */
export class SchedulerEngine {
  private input: SchedulerInput;
  private nDays: number;
  private nP: number;
  private totalSlots: number;
  private lunch: number;
  private rand: () => number;
  private limitMs: number;
  private consecutiveMax: number;

  private resKeys: string[] = [];
  private kind: string[] = [];
  private occ: Int32Array[] = [];
  private blocked: Uint8Array[] = [];
  private units: Unit[] = [];
  private pieces: Piece[] = [];
  private bySize = new Map<number, Piece[]>();
  private unitDay: Int32Array;
  private posCache = new Map<number, [number, number][]>();
  private specials: SpecialSlot[] = [];
  private warnings: string[] = [];
  private merged = 0;
  private subjectName = new Map<number, string>();
  private subjectById: Map<string, Subject>;

  private cost = 0;
  private initialCost = 0;
  private initialMetrics: Metrics = { groupGaps: 0, teacherGaps: 0, overload: 0 };
  private unplacedSize = 0;
  private best: { pos: Int32Array; cost: number; up: number } | null = null;
  private T = 2;
  private startMs = 0;
  private lastImprove = 0;
  private iter = 0;
  private sinceRepair = 0;
  private splitDone = false;
  private done = false;
  private endedAt = 0;

  constructor(input: SchedulerInput, options: SchedulerOptions = {}) {
    this.input = input;
    const { settings } = input;
    this.nDays = settings.days.length;
    this.nP = settings.periods.length;
    this.totalSlots = this.nDays * this.nP;
    this.lunch = settings.lunchAfter;
    this.limitMs = options.timeLimitMs ?? 15000;
    this.consecutiveMax = options.consecutiveMax ?? 4;
    this.rand = rng(options.seed ?? 12345);
    this.subjectById = new Map(input.subjects.map((s) => [s.id, s]));
    this.unitDay = new Int32Array(0);
    this.build();
    this.construct();
    this.cost = this.totalCost();
    this.initialCost = this.cost;
    this.initialMetrics = this.metrics();
    this.startMs = now();
    this.lastImprove = this.startMs;
    this.noteBest();
    if (!this.pieces.length || this.nDays === 0 || this.nP === 0) this.finish();
  }

  // ===================== เตรียมข้อมูล =====================
  private r(): number { return this.rand(); }

  private resId(key: string): number {
    let i = this.resKeys.indexOf(key);
    if (i < 0) { i = this.resKeys.length; this.resKeys.push(key); this.kind.push(key[0]); }
    return i;
  }

  private build() {
    const { settings } = this.input;
    const nP = this.nP;
    const dayPos = new Map(settings.days.map((d, i) => [d, i]));
    const slotId = (di: number, p: number) => di * nP + (p - 1);
    const teacherName = new Map(this.input.teachers.map((t) => [t.id, t.name]));
    const tKey = (id: string) => `t:${teacherName.get(id) ?? id}`;

    // ---- กรณีพิเศษ ----
    const blockAll = new Set<number>();
    const blockSpec = new Map<string, Set<number>>();
    const addTo = (k: string, sid: number) => { if (!blockSpec.has(k)) blockSpec.set(k, new Set()); blockSpec.get(k)!.add(sid); };
    for (const sc of this.input.specialCases) {
      const r = parseCondition(sc.condition, settings, sc.count);
      if (!r.ok) continue;
      const tIds = sc.teacherIds ?? [];
      const global = sc.groupIds.length === 0 && tIds.length === 0;
      for (const s of r.slots) {
        const di = dayPos.get(s.day);
        if (di === undefined) continue;
        const sid = slotId(di, s.period);
        if (global) blockAll.add(sid);
        else {
          for (const g of sc.groupIds) addTo(`g:${g}`, sid);
          for (const t of tIds) addTo(tKey(t), sid);
        }
        this.specials.push({ caseId: sc.id, name: sc.name, day: s.day, period: s.period, groupIds: sc.groupIds, teacherIds: tIds });
      }
    }

    // ---- หน่วยงาน (รวม/แยก) ----
    const byKey = new Map<string, Unit>();
    const mkUnit = (members: Member[], a: Assignment, teachers: string[], groupIds: string[], need: number): Unit => {
      // วิชาเสรี: ใช้ได้หลายห้อง/หลายอาคารพร้อมกัน ทุกห้องต้องว่างในคาบเดียวกัน
      const roomKeys = roomsOf(a).map((r) => `r:${roomKeyOf(r)}`);
      const u: Unit = {
        idx: this.units.length, members, need, subjectId: a.subjectId, multi: false,
        res: [...new Set([...teachers, ...groupIds.map((g) => `g:${g}`), ...roomKeys])].map((k) => this.resId(k)),
      };
      this.units.push(u);
      return u;
    };
    for (const a of this.input.assignments) {
      const sub = this.subjectById.get(a.subjectId);
      if (!sub || sub.periodsPerWeek < 1) continue;
      const teachers = [...new Set([...a.mainTeacherIds, ...a.coTeacherIds].map(tKey))];
      const roomKey = roomsOf(a).map(roomKeyOf).sort().join('+');
      if (a.together === false) {
        for (const g of a.groupIds) mkUnit([{ a, groupIds: [g] }], a, teachers, [g], sub.periodsPerWeek);
        continue;
      }
      const key = `${a.subjectId}|${[...teachers].sort().join(',')}|${roomKey}`;
      const ex = byKey.get(key);
      if (ex) {
        ex.members.push({ a, groupIds: a.groupIds });
        for (const g of a.groupIds) { const id = this.resId(`g:${g}`); if (!ex.res.includes(id)) ex.res.push(id); }
        this.merged++;
      } else byKey.set(key, mkUnit([{ a, groupIds: a.groupIds }], a, teachers, a.groupIds, sub.periodsPerWeek));
    }
    this.unitDay = new Int32Array(this.units.length * this.nDays);

    // ---- ทรัพยากร: ช่องว่าง/ช่องล็อก ----
    this.occ = this.resKeys.map(() => new Int32Array(this.totalSlots));
    this.blocked = this.resKeys.map((k) => {
      const b = new Uint8Array(this.totalSlots);
      const spec = blockSpec.get(k);
      for (let s = 0; s < this.totalSlots; s++) if (blockAll.has(s) || spec?.has(s)) b[s] = 1;
      return b;
    });

    // ---- ชิ้นงาน ----
    // ทุกวิชาถูกแบ่งเป็นช่วงที่ติดกัน ช่วงละไม่เกิน consecutiveMax คาบ (ค่าเริ่มต้น 4) และไม่ข้ามพักเที่ยง
    //   ใช้จำนวนช่วงน้อยที่สุด แล้วแบ่งให้เท่าๆ กัน เช่น 3 -> 3, 4 -> 4, 5 -> 3+2, 6 -> 3+3, 7 -> 4+3, 8 -> 4+4, 9 -> 3+3+3
    //   ช่วงของวิชาเดียวกันพยายามอยู่คนละวัน (ค่าปรับ spread)
    const maxBlock = this.lunch > 0 ? Math.max(this.lunch, this.nP - this.lunch) : this.nP; // ช่วงที่ยาวที่สุดของวัน (ก่อน/หลังพักเที่ยง)
    const cap = Math.max(1, Math.min(this.consecutiveMax, maxBlock));
    for (const u of this.units) {
      const k = Math.ceil(u.need / cap);
      const sizes = Array.from({ length: k }, (_, i) => Math.floor(u.need / k) + (i < u.need % k ? 1 : 0));
      if (k > Math.ceil(u.need / this.consecutiveMax)) {
        // ต้องแบ่งมากกว่าปกติ เพราะครึ่งวันสั้นกว่าจำนวนคาบสูงสุดต่อช่วง
        this.warnings.push(`วิชา ${this.subjectById.get(u.subjectId)?.name} (${u.need} คาบ): ช่วงเรียนต่อเนื่องมีได้สูงสุด ${cap} คาบ จึงต้องแบ่งเป็น ${k} ช่วง`);
      }
      u.multi = sizes.length > 1;
      for (const size of sizes) this.addPiece(u, size);
    }
  }

  private addPiece(u: Unit, size: number): Piece {
    const p: Piece = { id: this.pieces.length, unit: u, size, di: -1, start: -1 };
    this.pieces.push(p);
    if (!this.bySize.has(size)) this.bySize.set(size, []);
    this.bySize.get(size)!.push(p);
    this.unplacedSize += size;
    return p;
  }

  // ===================== พื้นฐาน =====================
  private validStart(size: number, start: number): boolean {
    if (start < 1 || start + size - 1 > this.nP) return false;
    return !(this.lunch > 0 && start <= this.lunch && start + size - 1 > this.lunch);
  }

  private positions(size: number): [number, number][] {
    let list = this.posCache.get(size);
    if (!list) {
      list = [];
      for (let di = 0; di < this.nDays; di++) for (let s = 1; s <= this.nP; s++) if (this.validStart(size, s)) list.push([di, s]);
      this.posCache.set(size, list);
    }
    return list;
  }

  /** วางได้หรือไม่ (ชิ้นเดิมของตัวเองไม่ถือว่าขวาง) */
  private fits(p: Piece, di: number, start: number): boolean {
    const base = di * this.nP + start - 1;
    for (const r of p.unit.res) {
      const o = this.occ[r], b = this.blocked[r];
      for (let k = 0; k < p.size; k++) {
        const s = base + k;
        if (b[s]) return false;
        const v = o[s];
        if (v !== 0 && v - 1 !== p.id) return false;
      }
    }
    return true;
  }

  /** ชิ้นที่ขวางตำแหน่งนี้ (null = ติดกรณีพิเศษ วางไม่ได้เลย) */
  private blockersAt(p: Piece, di: number, start: number): Piece[] | null {
    const base = di * this.nP + start - 1;
    const out: Piece[] = [];
    for (const r of p.unit.res) {
      const o = this.occ[r], b = this.blocked[r];
      for (let k = 0; k < p.size; k++) {
        const s = base + k;
        if (b[s]) return null;
        const v = o[s];
        if (v !== 0 && v - 1 !== p.id) { const q = this.pieces[v - 1]; if (!out.includes(q)) out.push(q); }
      }
    }
    return out;
  }

  private place(p: Piece, di: number, start: number) {
    const base = di * this.nP + start - 1;
    for (const r of p.unit.res) for (let k = 0; k < p.size; k++) this.occ[r][base + k] = p.id + 1;
    this.unitDay[p.unit.idx * this.nDays + di]++;
    if (p.start < 0) this.unplacedSize -= p.size;
    p.di = di; p.start = start;
  }

  private remove(p: Piece) {
    const base = p.di * this.nP + p.start - 1;
    for (const r of p.unit.res) for (let k = 0; k < p.size; k++) this.occ[r][base + k] = 0;
    this.unitDay[p.unit.idx * this.nDays + p.di]--;
    this.unplacedSize += p.size;
    p.start = -1;
  }

  // ===================== คะแนนความไม่สวย =====================
  private dayCost(r: number, di: number): number {
    const kind = this.kind[r];
    if (kind === 'r') return 0;
    const occ = this.occ[r], bl = this.blocked[r];
    const base = di * this.nP;
    let first = -1, last = -1, load = 0, busy = 0, run = 0, over = 0;
    for (let p = 0; p < this.nP; p++) {
      const c = occ[base + p] > 0;
      if (c || bl[base + p] === 1) { if (first < 0) first = p; last = p; busy++; }
      if (c) { load++; run++; if (run > MAX_RUN) over++; } else run = 0;
      if (this.lunch > 0 && p + 1 === this.lunch) run = 0;
    }
    const gaps = first < 0 ? 0 : last - first + 1 - busy;
    return kind === 'g'
      ? WEIGHTS.gapGroup * gaps + WEIGHTS.loadGroup * load * load
      : WEIGHTS.gapTeacher * gaps + WEIGHTS.overload * over + WEIGHTS.loadTeacher * load * load;
  }

  private unitCost(u: Unit, di: number): number {
    if (!u.multi) return 0;
    const c = this.unitDay[u.idx * this.nDays + di];
    if (c <= 1) return 0;
    let cost = (WEIGHTS.spread * c * (c - 1)) / 2;
    // ช่วงของวิชาเดียวกัน 2 ช่วงวางชิดกัน (ไม่คั่นพักเที่ยง) จะกลายเป็นช่วงยาวเกินกำหนด -> ปรับหนัก
    const o = this.occ[u.res[0]], base = di * this.nP;
    for (let k = 1; k < this.nP; k++) {
      if (k === this.lunch) continue;
      const a = o[base + k - 1], b = o[base + k];
      if (a !== 0 && b !== 0 && a !== b && this.pieces[a - 1].unit === u && this.pieces[b - 1].unit === u) cost += WEIGHTS.joined;
    }
    return cost;
  }

  private local(ps: Piece[], days: number[]): number {
    let sum = 0;
    if (ps.length === 1) {
      for (const r of ps[0].unit.res) for (const d of days) sum += this.dayCost(r, d);
      for (const d of days) sum += this.unitCost(ps[0].unit, d);
    } else {
      const rs: number[] = [];
      const us: Unit[] = [];
      for (const p of ps) {
        for (const r of p.unit.res) if (!rs.includes(r)) rs.push(r);
        if (!us.includes(p.unit)) us.push(p.unit);
      }
      for (const r of rs) for (const d of days) sum += this.dayCost(r, d);
      for (const u of us) for (const d of days) sum += this.unitCost(u, d);
    }
    for (const p of ps) if (p.start > 0) sum += WEIGHTS.start * (p.start - 1);
    return sum;
  }

  totalCost(): number {
    let sum = 0;
    for (let r = 0; r < this.resKeys.length; r++) for (let d = 0; d < this.nDays; d++) sum += this.dayCost(r, d);
    for (const u of this.units) for (let d = 0; d < this.nDays; d++) sum += this.unitCost(u, d);
    for (const p of this.pieces) if (p.start > 0) sum += WEIGHTS.start * (p.start - 1);
    return sum;
  }

  /** ตัวชี้วัดที่อ่านง่าย: คาบว่างคั่นของนักเรียน/ครู และคาบที่ครูสอนติดกันเกิน 4 คาบ */
  metrics(): Metrics {
    const m: Metrics = { groupGaps: 0, teacherGaps: 0, overload: 0 };
    for (let r = 0; r < this.resKeys.length; r++) {
      const kind = this.kind[r];
      if (kind === 'r') continue;
      for (let di = 0; di < this.nDays; di++) {
        const base = di * this.nP;
        let first = -1, last = -1, busy = 0, run = 0, over = 0;
        for (let p = 0; p < this.nP; p++) {
          const c = this.occ[r][base + p] > 0;
          if (c || this.blocked[r][base + p] === 1) { if (first < 0) first = p; last = p; busy++; }
          if (c) { run++; if (run > MAX_RUN) over++; } else run = 0;
          if (this.lunch > 0 && p + 1 === this.lunch) run = 0;
        }
        const gaps = first < 0 ? 0 : last - first + 1 - busy;
        if (kind === 'g') m.groupGaps += gaps;
        else { m.teacherGaps += gaps; m.overload += over; }
      }
    }
    return m;
  }

  /** ผลต่างคะแนนถ้าวางชิ้นที่ยังไม่ได้วางที่ตำแหน่งนี้ */
  private estimate(p: Piece, di: number, start: number): number {
    const before = this.local([p], [di]);
    this.place(p, di, start);
    const after = this.local([p], [di]);
    this.remove(p);
    return after - before;
  }

  // ===================== 1) Greedy =====================
  private construct() {
    const order = [...this.pieces]
      .map((p) => ({ p, k: p.size * p.unit.res.length + this.r() * 0.9 }))
      .sort((a, b) => b.k - a.k)
      .map((x) => x.p);
    const left: Piece[] = [];
    for (const p of order) {
      if (!this.greedyPlace(p)) left.push(p);
    }
    if (left.length) this.repair(left, 400 + left.length * 40, 3000, 0.5);
  }

  private greedyPlace(p: Piece): boolean {
    let best: [number, number] | null = null;
    let bd = Infinity;
    for (const [di, s] of this.positions(p.size)) {
      if (!this.fits(p, di, s)) continue;
      const d = this.estimate(p, di, s) + this.r() * 0.3;
      if (d < bd) { bd = d; best = [di, s]; }
    }
    if (!best) return false;
    this.place(p, best[0], best[1]);
    return true;
  }

  // ===================== 2) ซ่อมแซม (Ejection chain + Tabu) =====================
  private repair(queue: Piece[], maxIter: number, maxMs: number, evictLimit = 0.5) {
    const tabu = new Map<number, number>();
    const deadline = now() + maxMs;
    let it = 0;
    while (queue.length && it < maxIter && now() < deadline) {
      it++;
      const p = queue.shift()!;
      if (p.start > 0) continue;
      if (this.greedyPlace(p)) continue;
      let bestPos: [number, number] | null = null;
      let bestBl: Piece[] = [];
      let bestN = Infinity;
      for (const [di, s] of this.positions(p.size)) {
        const bl = this.blockersAt(p, di, s);
        if (!bl || bl.some((b) => (tabu.get(b.id) ?? 0) > it)) continue;
        const n = bl.reduce((a, b) => a + b.size, 0) + this.r() * evictLimit;
        if (n < bestN) { bestN = n; bestPos = [di, s]; bestBl = bl; }
      }
      if (!bestPos) continue; // ไม่มีที่วางเลย: คงสถานะยังไม่ได้วาง
      for (const b of bestBl) { this.remove(b); queue.push(b); }
      this.place(p, bestPos[0], bestPos[1]);
      tabu.set(p.id, it + 8 + ((this.r() * 8) | 0));
    }
  }

  private repairAll(maxIter: number) {
    const un = this.pieces.filter((p) => p.start < 0);
    if (!un.length) return;
    this.repair(un, maxIter, 150);
    this.cost = this.totalCost();
    this.noteBest(); // ดีกว่าเดิมเฉพาะเมื่อวางได้เพิ่ม หรือคะแนนต่ำลง
  }

  // ===================== 3) Simulated Annealing =====================
  private noteBest() {
    const up = this.unplacedSize;
    if (!this.best || up < this.best.up || (up === this.best.up && this.cost < this.best.cost - 1e-9)) {
      const pos = this.best && this.best.pos.length === this.pieces.length ? this.best.pos : new Int32Array(this.pieces.length);
      for (let i = 0; i < this.pieces.length; i++) {
        const p = this.pieces[i];
        pos[i] = p.start < 0 ? -1 : p.di * this.nP + (p.start - 1);
      }
      this.best = { pos, cost: this.cost, up };
      this.lastImprove = now();
    }
  }

  private restoreBest() {
    if (!this.best) return;
    for (const p of this.pieces) if (p.start > 0) this.remove(p);
    for (let i = 0; i < this.pieces.length; i++) {
      const v = this.best.pos[i];
      if (v >= 0) this.place(this.pieces[i], Math.floor(v / this.nP), (v % this.nP) + 1);
    }
    this.cost = this.totalCost();
  }

  private tryMove(p: Piece, di: number, start: number) {
    if ((di === p.di && start === p.start) || !this.validStart(p.size, start) || !this.fits(p, di, start)) return;
    const days = di === p.di ? [di] : [p.di, di];
    const before = this.local([p], days);
    const od = p.di, os = p.start;
    this.remove(p);
    this.place(p, di, start);
    const delta = this.local([p], days) - before;
    if (delta <= 0 || Math.exp(-delta / this.T) > this.r()) {
      this.cost += delta;
      this.noteBest();
    } else {
      this.remove(p);
      this.place(p, od, os);
    }
  }

  private trySwap(p: Piece) {
    const list = this.bySize.get(p.size)!;
    if (list.length < 2) return;
    const q = list[(this.r() * list.length) | 0];
    if (q === p || q.start < 0) return;
    const pd = p.di, ps = p.start, qd = q.di, qs = q.start;
    if (pd === qd && ps === qs) return;
    const days = pd === qd ? [pd] : [pd, qd];
    const before = this.local([p, q], days);
    this.remove(p); this.remove(q);
    let ok = false;
    if (this.fits(p, qd, qs)) {
      this.place(p, qd, qs);
      if (this.fits(q, pd, ps)) { this.place(q, pd, ps); ok = true; } else this.remove(p);
    }
    if (!ok) { this.place(p, pd, ps); this.place(q, qd, qs); return; }
    const delta = this.local([p, q], days) - before;
    if (delta <= 0 || Math.exp(-delta / this.T) > this.r()) {
      this.cost += delta;
      this.noteBest();
    } else {
      this.remove(p); this.remove(q);
      this.place(p, pd, ps); this.place(q, qd, qs);
    }
  }

  private anneal(n: number) {
    const P = this.pieces;
    for (let i = 0; i < n; i++) {
      this.iter++;
      const p = P[(this.r() * P.length) | 0];
      if (p.start < 0) continue;
      const x = this.r();
      if (x < 0.45) {
        const pos = this.positions(p.size);
        const t = pos[(this.r() * pos.length) | 0];
        this.tryMove(p, t[0], t[1]);
      } else if (x < 0.75) {
        const d = ((this.r() * 7) | 0) - 3;
        if (d !== 0) this.tryMove(p, p.di, p.start + d);
      } else this.trySwap(p);
    }
    this.sinceRepair += n;
    if (this.sinceRepair >= 6000) {
      this.sinceRepair = 0;
      if (this.unplacedSize > 0) this.repairAll(120);
    }
  }

  /** ถ้าวิชาที่ควรติดกันวางไม่ลง ให้แยกเป็นช่วงย่อยแล้วลองใหม่ */
  private splitFallback() {
    this.splitDone = true;
    this.restoreBest(); // เริ่มจากคำตอบที่ดีที่สุดที่ได้ก่อนแยกช่วง
    const un = this.pieces.filter((p) => p.start < 0 && p.size > 1);
    if (!un.length) return;
    const queue: Piece[] = [];
    for (const p of un) {
      const old = p.size;
      const a = Math.ceil(old / 2), b = old - a;
      this.bySize.set(old, this.bySize.get(old)!.filter((x) => x !== p));
      p.size = a;
      if (!this.bySize.has(a)) this.bySize.set(a, []);
      this.bySize.get(a)!.push(p);
      p.unit.multi = true;
      const q = this.addPiece(p.unit, b);
      this.unplacedSize -= old - a; // addPiece นับ b แล้ว; p ลดจาก old เป็น a
      queue.push(p, q);
      this.warnings.push(`วิชา ${this.subjectById.get(p.unit.subjectId)?.name}: จัดให้สอนติดกัน ${old} คาบไม่ได้ จึงแยกเป็นช่วง ${a}+${b} คาบ`);
    }
    this.repair(queue, 600, 500);
    this.cost = this.totalCost();
    this.best = null;
    this.noteBest();
  }

  // ===================== ควบคุมการรัน =====================
  get finished(): boolean { return this.done; }

  progress(): Progress {
    return {
      elapsedMs: this.done ? this.endedAt - this.startMs : now() - this.startMs,
      limitMs: this.limitMs,
      cost: this.cost,
      bestCost: this.best?.cost ?? this.cost,
      unplacedPeriods: this.best?.up ?? this.unplacedSize,
      iterations: this.iter,
    };
  }

  /** ประมวลผลต่อเป็นเวลา ms มิลลิวินาที (เรียกซ้ำจนกว่า finished) */
  step(ms: number) {
    if (this.done) return;
    const end = now() + ms;
    while (!this.done && now() < end) {
      this.anneal(256);
      const elapsed = now() - this.startMs;
      const frac = Math.min(1, elapsed / this.limitMs);
      this.T = 2.0 * Math.pow(0.03 / 2.0, frac); // อุณหภูมิลดแบบ geometric ตามเวลา
      if (!this.splitDone && frac >= 0.5 && (this.best?.up ?? this.unplacedSize) > 0) this.splitFallback();
      const stall = Math.max(1500, this.limitMs * 0.4);
      // จบก่อนเวลาได้เมื่อวางครบแล้วและคะแนนไม่ดีขึ้นอีก (ถ้ายังมีคาบค้าง ใช้เวลาให้เต็มเพื่อพยายามซ่อม)
      if (frac >= 1 || (frac >= 0.45 && (this.best?.up ?? 1) === 0 && now() - this.lastImprove > stall)) this.finish();
    }
  }

  stop() { if (!this.done) this.finish(); }

  private finish() {
    if (this.done) return;
    if (!this.splitDone && (this.best?.up ?? this.unplacedSize) > 0) this.splitFallback();
    this.restoreBest();
    this.endedAt = now();
    this.done = true;
  }

  // ===================== ผลลัพธ์ =====================
  result(): Schedule {
    const { settings } = this.input;
    const entries: PlacedEntry[] = [];
    for (const p of this.pieces) {
      if (p.start < 0) continue;
      for (let k = 0; k < p.size; k++) {
        for (const m of p.unit.members) {
          entries.push({ assignmentId: m.a.id, groupIds: m.groupIds, day: settings.days[p.di], period: p.start + k });
        }
      }
    }
    entries.sort((a, b) => a.day - b.day || a.period - b.period);

    const unplaced: Unplaced[] = [];
    const nameOf = (key: string) => {
      if (key.startsWith('t:')) return `ครู ${key.slice(2)}`;
      if (key.startsWith('g:')) return `กลุ่มเรียน ${this.input.groups.find((g) => g.id === key.slice(2))?.name ?? '?'}`;
      return 'ห้องเรียน';
    };
    for (const u of this.units) {
      const miss = this.pieces.filter((p) => p.unit === u && p.start < 0);
      if (!miss.length) continue;
      const missing = miss.reduce((a, p) => a + p.size, 0);
      let worst = u.res[0];
      let worstFree = Infinity;
      for (const r of u.res) {
        let free = 0;
        for (let s = 0; s < this.totalSlots; s++) {
          if (this.blocked[r][s]) continue;
          const v = this.occ[r][s];
          if (v === 0 || this.pieces[v - 1].unit === u) free++;
        }
        if (free < worstFree) { worstFree = free; worst = r; }
      }
      const sub = this.subjectById.get(u.subjectId)!;
      const maxSize = Math.max(...miss.map((p) => p.size));
      const reason = worstFree < u.need
        ? `${nameOf(this.resKeys[worst])} มีช่องว่างเพียง ${worstFree} คาบ แต่ต้องใช้ ${u.need} คาบ`
        : maxSize > 1
          ? `หาช่วงที่ ครู/กลุ่มเรียน/ห้อง ว่างตรงกันต่อเนื่อง ${maxSize} คาบไม่ได้ (ลองเปลี่ยนห้อง หรือลดภาระ)`
          : `ช่องเวลาว่างของ ครู/กลุ่มเรียน/ห้อง ไม่ตรงกัน จัดไม่ได้ ${missing} คาบ (ลองเปลี่ยนห้อง หรือลดภาระ)`;
      const groups = u.members.flatMap((m) => m.groupIds).map((g) => this.input.groups.find((x) => x.id === g)?.name).filter(Boolean);
      unplaced.push({ assignmentId: u.members[0].a.id, missing, reason: `วิชา ${sub.name}${groups.length ? ` (${groups.join(', ')})` : ''}: ${reason}` });
    }

    return {
      entries,
      specials: this.specials,
      unplaced,
      totalUnits: this.units.reduce((n, u) => n + u.need * u.members.length, 0),
      merged: this.merged,
      warnings: [...new Set(this.warnings)],
      quality: {
        initial: Math.round(this.initialCost * 10) / 10,
        final: Math.round(this.totalCost() * 10) / 10,
        iterations: this.iter,
        seconds: Math.round(((this.done ? this.endedAt : now()) - this.startMs) / 100) / 10,
        before: this.initialMetrics,
        after: this.metrics(),
      },
      createdAt: Date.now(),
    };
  }
}

/** รันแบบ synchronous (ใช้ในเทสต์ / เมื่อไม่มี Web Worker) */
export function generateSchedule(input: SchedulerInput, options: SchedulerOptions = {}): Schedule {
  const eng = new SchedulerEngine(input, options);
  while (!eng.finished) eng.step(100);
  return eng.result();
}
