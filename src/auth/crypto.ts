/**
 * เข้ารหัส/ถอดรหัสด้วย WebCrypto: PBKDF2-SHA256 -> AES-256-GCM
 * - salt/iv สุ่มใหม่ทุกครั้ง, GCM ตรวจความถูกต้อง (รหัสผิดหรือไฟล์ถูกแก้ = ถอดไม่ได้)
 * - ข้อมูล JSON ถูกบีบอัด (gzip) ก่อนเข้ารหัสถ้าเบราว์เซอร์รองรับ
 */

export const KDF_ITER = 600_000;
const MIN_ITER = 100_000;
const MAX_ITER = 3_000_000;            // กันไฟล์ปลอมที่สั่งให้คำนวณนานเกินไป
const MAX_CIPHER_BYTES = 40 * 1024 * 1024;

export interface Envelope { salt: string; iv: string; ct: string; iter: number; z: 0 | 1 }

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('เบราว์เซอร์นี้ไม่รองรับการเข้ารหัส (ต้องเปิดผ่าน https หรือ localhost)');
  return s;
};

// ---------- base64 ----------
export function b64encode(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64decode(str: string): Uint8Array {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ---------- gzip ----------
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream as any));
  return new Uint8Array(await out.arrayBuffer());
}
const canGzip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

// ---------- KDF ----------
async function aesKey(pass: string, salt: Uint8Array, iter: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function encryptJson(data: unknown, pass: string, iter = KDF_ITER): Promise<Envelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  let plain: Uint8Array = enc.encode(JSON.stringify(data));
  let z: 0 | 1 = 0;
  if (canGzip()) { plain = await pipe(plain, new CompressionStream('gzip')); z = 1; }
  const key = await aesKey(pass, salt, iter);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plain as BufferSource));
  return { salt: b64encode(salt), iv: b64encode(iv), ct: b64encode(ct), iter, z };
}

/** คืนข้อมูลเมื่อรหัสถูก, คืน null เมื่อรหัสผิด/ไฟล์ถูกแก้/รูปแบบไม่ถูกต้อง */
export async function decryptJson<T = unknown>(env: Envelope, pass: string): Promise<T | null> {
  try {
    if (!env || typeof env.salt !== 'string' || typeof env.iv !== 'string' || typeof env.ct !== 'string') return null;
    if (!Number.isInteger(env.iter) || env.iter < MIN_ITER || env.iter > MAX_ITER) return null;
    if (env.ct.length > MAX_CIPHER_BYTES * 1.4) return null;
    const key = await aesKey(pass, b64decode(env.salt), env.iter);
    let plain: Uint8Array = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: b64decode(env.iv) as BufferSource }, key, b64decode(env.ct) as BufferSource));
    if (env.z === 1) plain = await pipe(plain, new DecompressionStream('gzip'));
    return JSON.parse(dec.decode(plain)) as T;
  } catch {
    return null;
  }
}

// ---------- รหัสผ่านผู้ดูแล (hash สำหรับล็อกหน้าจอ) ----------
export interface PassHash { salt: string; hash: string; iter: number }

async function bits(pass: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const base = await subtle().importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, base, 256));
}
export async function hashPass(pass: string, iter = KDF_ITER): Promise<PassHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { salt: b64encode(salt), hash: b64encode(await bits(pass, salt, iter)), iter };
}
export async function verifyPass(pass: string, h: PassHash): Promise<boolean> {
  try {
    if (!h || h.iter < MIN_ITER || h.iter > MAX_ITER) return false;
    const got = await bits(pass, b64decode(h.salt), h.iter);
    const want = b64decode(h.hash);
    if (got.length !== want.length) return false;
    let diff = 0;
    for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
    return diff === 0;
  } catch { return false; }
}

// ---------- รหัสผ่าน: ปรับรูปแบบ / สร้างให้ / ประเมินความแข็งแรง ----------
const GEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // ตัดตัวที่สับสน (I, L, O, 0, 1)
const GEN_RE = /^[A-HJ-NP-Z2-9]{12}$/;

/** รหัสที่ระบบสร้างให้ (ABCD-EFGH-JKLM) พิมพ์เล็ก/ไม่ใส่ขีดได้ ส่วนรหัสที่ตั้งเองใช้ตามที่พิมพ์ (ตัดช่องว่างหัวท้าย) */
export function canonicalPass(raw: string): string {
  const t = raw.trim().normalize('NFKC');
  const u = t.toUpperCase().replace(/[\s-]/g, '');
  return GEN_RE.test(u) ? u : t;
}

/** สร้างรหัสสุ่ม 12 ตัว (~59 บิต) รูปแบบ ABCD-EFGH-JKLM */
export function generatePasscode(): string {
  const out: string[] = [];
  const n = GEN_ALPHABET.length;
  const limit = 256 - (256 % n); // rejection sampling กัน bias
  while (out.length < 12) {
    const buf = crypto.getRandomValues(new Uint8Array(24));
    for (const b of buf) { if (b < limit && out.length < 12) out.push(GEN_ALPHABET[b % n]); }
  }
  const s = out.join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

const COMMON = ['password', 'passw0rd', 'qwertyuiop', 'asdfghjkl', '1234567890', '0123456789', '1q2w3e4r5t', 'iloveyou', 'abcdefghij', '0000000000', '1111111111', 'schooldata', 'teacher123', 'student123', 'admin12345'];

/** ประมาณเอนโทรปี (บิต) แบบหยาบ: ความยาว x log2(ชุดตัวอักษรที่ใช้) หักตัวซ้ำ */
export function passEntropy(p: string): number {
  const s = canonicalPass(p);
  if (!s) return 0;
  if (GEN_RE.test(s)) return 12 * Math.log2(GEN_ALPHABET.length);
  let set = 0;
  if (/[a-z]/.test(s)) set += 26;
  if (/[A-Z]/.test(s)) set += 26;
  if (/[0-9]/.test(s)) set += 10;
  if (/[^A-Za-z0-9]/.test(s)) set += 33;
  const uniq = new Set(s).size;
  return Math.min(s.length, uniq * 2) * Math.log2(Math.max(set, 2));
}

export type Strength = { level: 'weak' | 'ok' | 'strong'; label: string; problem: string | null };

/** ตรวจรหัสที่ผู้ดูแลตั้ง: ต้องยาวพอและไม่เดาง่าย (ไฟล์ที่เข้ารหัสเปิดสาธารณะ จึงถูกเดาแบบออฟไลน์ได้) */
export function checkPasscode(p: string): Strength {
  const s = canonicalPass(p);
  const lower = s.toLowerCase();
  if (s.length < 10) return { level: 'weak', label: 'สั้นเกินไป', problem: 'รหัสต้องมีอย่างน้อย 10 ตัวอักษร (หรือกด "สร้างรหัสให้")' };
  if (COMMON.some((c) => lower.includes(c))) return { level: 'weak', label: 'เดาง่าย', problem: 'รหัสนี้เป็นรหัสที่พบบ่อย เดาง่าย' };
  const bitsEst = passEntropy(s);
  if (bitsEst < 45) return { level: 'weak', label: 'อ่อน', problem: 'รหัสนี้เดาง่ายเกินไป ลองยาวขึ้นหรือผสมตัวอักษร/ตัวเลข หรือกด "สร้างรหัสให้"' };
  if (bitsEst < 55) return { level: 'ok', label: 'พอใช้', problem: null };
  return { level: 'strong', label: 'แข็งแรง', problem: null };
}
