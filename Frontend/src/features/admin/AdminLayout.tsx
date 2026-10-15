import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useLogoutMutation } from '../../store/api/authApi';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  CreditCard,
  History,
  ArrowLeft,
  LogOut,
  ShieldAlert,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { BrandLogo } from '../../components/ui/BrandLogo';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const [logout] = useLogoutMutation();

  const isSuperAdmin = user?.platformRole === 'SUPER_ADMIN';

  const navItems = [
    { label: 'Overview', to: '/admin', icon: LayoutDashboard, exact: true },
    { label: 'User Directory', to: '/admin/users', icon: Users },
    ...(isSuperAdmin
      ? [
          { label: 'Administrators', to: '/admin/admins', icon: ShieldCheck },
          { label: 'Plans & Distribution', to: '/admin/plans', icon: CreditCard },
          { label: 'Platform Audit Log', to: '/admin/audit-log', icon: History },
        ]
      : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row selection:bg-white selection:text-black">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-full md:w-64 bg-[#09090b] border-r border-[#27272a] flex flex-col flex-shrink-0 z-20">
        <div className="p-5 border-b border-[#27272a] flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center font-black text-black text-sm shadow-xs">
              R
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white block">Rankora Admin</span>
              <span className="text-[10px] text-neutral-400 font-mono uppercase tracking-wider block">
                {user?.platformRole === 'SUPER_ADMIN' ? 'Super Administrator' : 'Administrator'}
              </span>
            </div>
          </Link>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          <div className="px-3 py-2 text-[10px] font-bold text-neutral-500 uppercase tracking-widest font-mono">
            Management
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-black shadow-xs font-bold'
                    : 'text-neutral-400 hover:text-white hover:bg-[#18181b]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-neutral-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-neutral-400" />}
              </Link>
            );
          })}
        </nav>

        {/* ── Bottom App Links ───────────────────────────────────────── */}
        <div className="p-3 border-t border-[#27272a] space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-[#18181b] transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Open User Dashboard</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-white hover:bg-[#18181b] transition cursor-pointer text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* ── Admin Badge ────────────────────────────────────────────── */}
        <div className="p-3.5 bg-black border-t border-[#27272a] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center font-bold text-xs text-white">
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-neutral-500 font-mono truncate">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ──────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto bg-black">
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
};
