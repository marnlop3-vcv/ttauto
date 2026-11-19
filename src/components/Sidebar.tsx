import { NavLink } from 'react-router-dom';
import { hasAdminLock } from '../auth/adminLock';
import { useSession } from '../auth/session';

export default function Sidebar() {
  const logout = useSession((s) => s.logout);
  return (
    <aside className="sidebar">
      <div>
        <div className="brand">ระบบจัดตารางสอน</div>
        <div className="brand-sub">จัดตารางอัตโนมัติ</div>
      </div>
      <nav className="nav">
        <NavLink to="/" end><span className="ico">▦</span> Dashboard</NavLink>
        <NavLink to="/input"><span className="ico">✎</span> กรอกข้อมูล</NavLink>
        <NavLink to="/publish"><span className="ico">⇪</span> เผยแพร่ตาราง</NavLink>
      </nav>
      <div className="side-user">
        <span className="role-badge">ผู้ดูแล</span>
        <button className="btn sm" onClick={logout} title={hasAdminLock() ? 'ล็อกหน้าจอ (ต้องใส่รหัสเพื่อกลับเข้ามา)' : 'กลับไปหน้าเข้าสู่ระบบ'}>{hasAdminLock() ? '🔒 ล็อก' : 'ออก'}</button>
      </div>
      <div className="side-foot">ข้อมูลถูกเก็บในเบราว์เซอร์ของเครื่องนี้</div>
    </aside>
  );
}
