import { useState } from 'react';
import pkg from '../../package.json';

const KEY = 'tt-notice-v1';
const read = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

/** ข้อความแจ้งผู้ใช้ครั้งแรก (ปิดแล้วจำไว้) */
export function WelcomeNotice() {
  const [hidden, setHidden] = useState(read);
  if (hidden) return null;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } setHidden(true); };
  return (
    <div className="notice" role="note">
      <div>
        <b>ก่อนเริ่มใช้ — 3 ข้อควรรู้</b>
        <ul>
          <li><b>ข้อมูลเก็บเฉพาะในเบราว์เซอร์เครื่องนี้</b> ไม่ถูกส่งไปที่ใด และคนอื่นมองไม่เห็นข้อมูลของคุณ (แต่ละคนแยกกัน)</li>
          <li><b>กด "สำรองข้อมูล (JSON)" เป็นระยะ</b> (เมนู กรอกข้อมูล) เพราะถ้าล้างเบราว์เซอร์หรือเปลี่ยนเครื่อง ข้อมูลจะหายและไม่มีใครกู้คืนให้ได้</li>
          <li><b>ใช้เครื่องร่วมกัน</b> (เช่น ห้องพักครู) ให้สำรองแล้วกด "ล้างข้อมูลทั้งหมด" ก่อนเลิกใช้ เพื่อไม่ให้คนถัดไปเห็นข้อมูล</li>
        </ul>
      </div>
      <button className="btn" onClick={close}>รับทราบ</button>
    </div>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div>
        ระบบจัดตารางสอนอัตโนมัติ v{pkg.version} • <a href="./timetable-user-manual.pdf" target="_blank" rel="noopener">คู่มือการใช้งาน (PDF)</a> • สัญญาอนุญาตแบบ MIT
      </div>
      <div>
        ข้อมูลของคุณอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น • ตารางเป็นผลจากการคำนวณอัตโนมัติ ควรตรวจสอบก่อนนำไปใช้จริง
      </div>
    </footer>
  );
}
