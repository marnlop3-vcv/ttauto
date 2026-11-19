import { Navigate, Route, Routes } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { SiteFooter, WelcomeNotice } from './components/Notice';
import { useSession } from './auth/session';
import Dashboard from './pages/Dashboard';
import DataEntry from './pages/DataEntry';
import Login from './pages/Login';
import Publish from './pages/Publish';
import Viewer from './pages/Viewer';

export default function App() {
  const role = useSession((s) => s.role);

  // ยังไม่เข้าสู่ระบบ -> หน้าใส่รหัส
  if (!role) return <Login />;
  // นักเรียน/ครู -> มุมมองอ่านอย่างเดียว (ไม่มี route แก้ไขเลย แม้พิมพ์ที่อยู่เอง)
  if (role === 'student' || role === 'teacher') return <Viewer />;

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <WelcomeNotice />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/input" element={<DataEntry />} />
          <Route path="/publish" element={<Publish />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <SiteFooter />
      </main>
    </div>
  );
}
