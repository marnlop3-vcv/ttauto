import { useEffect, useRef, useState } from 'react';
import ViewerHelp from '../components/HelpPanel';
import { SiteFooter } from '../components/Notice';
import { hasAdminLock, resetThisDevice, verifyAdminLock } from '../auth/adminLock';
import { FetchResult, fetchPublished, openPublished, PublishedFile, readPublishedFromFile } from '../auth/bundle';
import { useSession } from '../auth/session';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (t: number) => new Date(t).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

/** หน้าเข้าสู่ระบบ: ช่องรหัสช่องเดียว ระบบดูว่ารหัสเป็นของมุมมองไหน (ผู้ดูแล / นักเรียน / ครู) */
export default function Login() {
  const { loginAdmin, loginViewer } = useSession();
  const [pass, setPass] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fails, setFails] = useState(0);
  const [lock, setLock] = useState(hasAdminLock());
  const [pub, setPub] = useState<FetchResult | { status: 'loading' }>({ status: 'loading' });
  const [picked, setPicked] = useState<{ file: PublishedFile; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchPublished().then(setPub); }, []);
  const file: PublishedFile | null = picked?.file ?? (pub.status === 'ready' ? pub.file : null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!pass.trim()) return setErr('กรุณาใส่รหัส');
    setBusy(true);
    setErr('');
    try {
      if (lock && (await verifyAdminLock(pass))) return loginAdmin();
      if (file) {
        const payload = await openPublished(file, pass);
        if (payload) return loginViewer(payload);
      }
      setFails((f) => f + 1);
      await sleep(Math.min(fails, 4) * 600); // หน่วงเล็กน้อยเมื่อใส่ผิดซ้ำ
      if (file || lock) setErr('รหัสไม่ถูกต้อง');
      else if (pub.status === 'loading') setErr('กำลังโหลดไฟล์ตาราง กรุณาลองอีกครั้ง');
      else if (pub.status === 'error') setErr(pub.message);
      else setErr('ยังไม่มีตารางที่เผยแพร่ในเว็บนี้ — ติดต่อผู้ดูแล หรือเลือกไฟล์ตารางที่ได้รับ (ด้านล่าง)');
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (f: File) => {
    try {
      const pf = await readPublishedFromFile(f);
      setPicked({ file: pf, name: f.name });
      setErr('');
    } catch (e) { setErr((e as Error).message); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const forgot = () => {
    if (!window.confirm('รีเซ็ตเครื่องนี้?\n\nระบบจะลบ "รหัสผู้ดูแล" และ "ข้อมูลทั้งหมดที่กรอกไว้ในเครื่องนี้" (ไม่สามารถกู้คืนได้ ยกเว้นมีไฟล์สำรอง)')) return;
    resetThisDevice();
    setLock(false);
    setErr('');
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">ระบบจัดตารางสอนอัตโนมัติ</div>
        <p className="login-sub">ใส่รหัสที่ได้รับ ระบบจะพาไปยังมุมมองของคุณ<br /><small>(นักเรียน • ครู • ผู้ดูแล)</small></p>
        <form onSubmit={submit}>
          <label className="field">รหัสผ่าน
            <div className="pass-row">
              <input type={show ? 'text' : 'password'} value={pass} autoFocus autoComplete="off" spellCheck={false}
                placeholder="เช่น ABCD-EFGH-JKLM" onChange={(e) => { setPass(e.target.value); setErr(''); }} aria-label="รหัสผ่าน" />
              <button type="button" className="btn sm" onClick={() => setShow(!show)}>{show ? 'ซ่อน' : 'แสดง'}</button>
            </div>
          </label>
          <button className="btn primary login-go" type="submit" disabled={busy}>{busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}</button>
        </form>
        {err && <div className="msg err" role="alert">{err}</div>}

        <div className="login-status">
          {pub.status === 'loading' && !picked && <span>กำลังตรวจหาตารางที่เผยแพร่…</span>}
          {file && <span>✔ พบตารางที่เผยแพร่{picked ? ` (ไฟล์ ${picked.name})` : ''} • เผยแพร่เมื่อ {fmt(file.publishedAt)}</span>}
          {!file && pub.status === 'none' && <span>ยังไม่มีตารางเผยแพร่ในเว็บนี้</span>}
        </div>

        <div className="login-more">
          <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
          <button type="button" className="link" onClick={() => fileRef.current?.click()}>มีไฟล์ตารางที่ได้รับ (published.enc.json)? เลือกไฟล์</button>
          {!lock ? (
            <button type="button" className="btn login-admin" onClick={loginAdmin}>ใช้งานเป็นผู้ดูแล (จัดตารางเอง)</button>
          ) : (
            <details className="login-forgot">
              <summary>ลืมรหัสผู้ดูแล?</summary>
              <p>กู้คืนรหัสไม่ได้ วิธีเดียวคือรีเซ็ตเครื่องนี้ ซึ่งจะ <b>ลบข้อมูลที่กรอกไว้ในเครื่องนี้ทั้งหมด</b> (ถ้ามีไฟล์สำรอง JSON ก็กู้คืนได้ภายหลัง)</p>
              <button type="button" className="btn danger sm" onClick={forgot}>รีเซ็ตเครื่องนี้</button>
            </details>
          )}
        </div>
        <ViewerHelp />
      </div>
      <SiteFooter />
    </div>
  );
}
