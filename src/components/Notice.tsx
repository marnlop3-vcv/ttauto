import pkg from '../../package.json';

export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div>
        ระบบจัดตารางสอนอัตโนมัติ v{pkg.version} • <a href="./timetable-user-manual.pdf" target="_blank" rel="noopener">คู่มือผู้ดูแล (PDF)</a> • <a href="./viewer-guide.pdf" target="_blank" rel="noopener">คู่มือนักเรียน/ครู (PDF)</a> • สัญญาอนุญาตแบบ MIT
      </div>
      <div>
        ข้อมูลของคุณอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น • ตารางเป็นผลจากการคำนวณอัตโนมัติ ควรตรวจสอบก่อนนำไปใช้จริง
      </div>
    </footer>
  );
}
