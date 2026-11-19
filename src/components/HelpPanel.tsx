import { VIEWER_FILE_ANDROID, VIEWER_FILE_IPHONE, VIEWER_STEPS } from '../help/content';

/** คำแนะนำสำหรับนักเรียน/ครู บนหน้าเข้าสู่ระบบ (พับได้ ดูบนมือถือสะดวก) */
export default function ViewerHelp() {
  return (
    <div className="viewer-help">
      <details>
        <summary>วิธีดูตาราง (3 ขั้น)</summary>
        <ol>{VIEWER_STEPS.map((s) => <li key={s.title}><b>{s.title}</b> — {s.what}</li>)}</ol>
      </details>
      <details>
        <summary>ได้รับ "ไฟล์ตาราง" ทางไลน์หรืออีเมล? ทำอย่างไร</summary>
        <p className="hint" style={{ marginTop: 6 }}>ไฟล์ชื่อ <code>published.enc.json</code> เปิดอ่านตรงๆ ไม่ได้ (เป็นข้อมูลที่เข้ารหัส เห็นเป็นตัวอักษรแปลกๆ เป็นเรื่องปกติ) ให้เลือกไฟล์นี้ในหน้าเว็บนี้ แล้วใส่รหัส</p>
        <b>Android</b>
        <ol>{VIEWER_FILE_ANDROID.map((t) => <li key={t}>{t}</li>)}</ol>
        <b>iPhone</b>
        <ol>{VIEWER_FILE_IPHONE.map((t) => <li key={t}>{t}</li>)}</ol>
      </details>
      <details>
        <summary>ใส่รหัสแล้วขึ้น "รหัสไม่ถูกต้อง"</summary>
        <ul>
          <li>เช็กตัวอักษรให้ตรง (รหัสที่ระบบสร้างให้ พิมพ์เล็กหรือไม่ใส่ขีดได้ แต่รหัสที่ผู้ดูแลตั้งเอง แยกตัวพิมพ์เล็ก/ใหญ่)</li>
          <li>นักเรียนต้องใช้รหัสนักเรียน ครูต้องใช้รหัสครู ใช้สลับกันไม่ได้</li>
          <li>ถ้าผู้ดูแลเพิ่งเปลี่ยนรหัส ให้ขอรหัสและไฟล์ตารางล่าสุด (รหัสใหม่ใช้กับไฟล์เก่าไม่ได้)</li>
        </ul>
      </details>
    </div>
  );
}
