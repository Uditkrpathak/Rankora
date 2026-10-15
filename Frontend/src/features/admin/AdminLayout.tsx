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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-full md:w-64 bg-slate-900/90 border-r border-slate-800/80 flex flex-col flex-shrink-0 z-20">
        <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-600/30">
              R
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white block">Rankora Admin</span>
              <span className="text-[10px] text-brand-400 font-semibold uppercase tracking-wider block">
                {user?.platformRole === 'SUPER_ADMIN' ? 'Super Administrator' : 'Administrator'}
              </span>
            </div>
          </Link>
        </div>

        <nav className="p-3 space-y-1 flex-1">
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
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
                    ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-brand-400" />}
              </Link>
            );
          })}
        </nav>

        {/* ── Bottom App Links ───────────────────────────────────────── */}
        <div className="p-3 border-t border-slate-800/80 space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Open User Dashboard</span>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition cursor-pointer text-left"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* ── Admin Badge ────────────────────────────────────────────── */}
        <div className="p-3.5 bg-slate-950/50 border-t border-slate-800/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-white">
            {user?.name?.[0]?.toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ──────────────────────────────────────── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
};
