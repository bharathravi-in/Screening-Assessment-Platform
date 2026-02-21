import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  Users,
  BarChart3,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import ThemeToggle from '../common/ThemeToggle';

const navItems = [
  { path: '/tech', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { path: '/tech/questions', icon: BookOpen, label: 'My Questions' },
  { path: '/tech/assessments', icon: ClipboardList, label: 'Build Assessment' },
  { path: '/tech/candidates', icon: Users, label: 'Candidates' },
  { path: '/tech/analytics', icon: BarChart3, label: 'Results' },
];

export default function TechLayout() {
  const { fullName, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <aside
        className="w-64 flex flex-col"
        style={{ backgroundColor: 'var(--sidebar-bg)' }}
      >
        <div className="p-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <h1 className="text-lg font-bold text-white">Assessment Platform</h1>
          <p className="text-xs mt-1" style={{ color: 'var(--sidebar-text)' }}>
            Tech Panel
          </p>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'text-white font-medium' : 'hover:bg-white/5'
                }`
              }
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--sidebar-active)' : undefined,
                color: isActive ? '#fff' : 'var(--sidebar-text)',
              })}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div className="flex items-center justify-between">
            <div className="text-sm text-white truncate">{fullName}</div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              style={{ color: 'var(--sidebar-text)' }}
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header
          className="h-14 flex items-center justify-between px-6 border-b"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderColor: 'var(--border)',
          }}
        >
          <div />
          <ThemeToggle />
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
