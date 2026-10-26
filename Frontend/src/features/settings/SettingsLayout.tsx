import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { AppNavbar } from '../../components/layout/AppNavbar';
import { FEATURE_FLAGS } from '../../config/features';
import {
  User,
  HelpCircle,
  Settings,
  Users,
  CreditCard,
  Sparkles,
  Link2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Bell,
} from 'lucide-react';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user } = useSelector((state: RootState) => state.auth);
  const [collapsed, setCollapsed] = useState(false);

  const personalNav = [
    { label: 'My Account', icon: <User size={16} />, to: '/settings/account' },
    { label: 'Help Center', icon: <HelpCircle size={16} />, to: '/help' },
  ];

  const workspaceNav = [
    { label: 'Settings', icon: <Settings size={16} />, to: '/settings/workspace' },
    ...(FEATURE_FLAGS.ENABLE_TEAM_CLIENTS
      ? [{ label: 'Team & Clients', icon: <Users size={16} />, to: '/settings/team', altTo: '/team' }]
      : []),
    { label: 'Billing', icon: <CreditCard size={16} />, to: '/settings/billing' },
    { label: 'Notifications & Alerts', icon: <Bell size={16} />, to: '/settings/notifications' },
    ...(FEATURE_FLAGS.ENABLE_EXPLORE_PLANS
      ? [{ label: 'Explore plans', icon: <Sparkles size={16} />, to: '/settings/plans' }]
      : []),
    { label: 'Connected accounts', icon: <Link2 size={16} />, to: '/settings/connections' },
    ...(FEATURE_FLAGS.ENABLE_PUBLISHED_SITES
      ? [{ label: 'Published sites', icon: <FileText size={16} />, to: '/settings/published-sites' }]
      : []),
  ];

  const userInitial = (user?.name || user?.email || 'U')[0].toUpperCase();
  const userEmail = user?.email || 'user@example.com';

  return (
    <div className="min-h-screen w-full bg-white flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-60px)]">
        {/* Settings Left Sidebar */}
        <aside
          className={`shrink-0 transition-all duration-200 self-start sticky top-20 bg-white rounded-lg border border-slate-200 p-4 ${
            collapsed ? 'w-full lg:w-[72px]' : 'w-full lg:w-[260px]'
          }`}
        >
          {/* User Email Pill */}
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-slate-200 mb-5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {userInitial}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-slate-800 truncate">
                  {user?.name || 'My Account'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {userEmail}
                </div>
              </div>
            )}
          </div>

          {/* Section: Personal */}
          <div className="mb-5">
            {!collapsed && (
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                Personal
              </div>
            )}
            {personalNav.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition mb-1 ${
                    active
                      ? 'bg-brand-50 text-brand-600 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className={active ? 'text-brand-600' : 'text-slate-400'}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>

          {/* Section: Workspace */}
          <div className="flex-1">
            {!collapsed && (
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                Workspace
              </div>
            )}
            {workspaceNav.map((item) => {
              const active = location.pathname === item.to || (item.altTo && location.pathname === item.altTo);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  title={collapsed ? item.label : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition mb-1 ${
                    active
                      ? 'bg-brand-50 text-brand-600 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className={active ? 'text-brand-600' : 'text-slate-400'}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>

          {/* Collapse / Expand toggle button */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-2 pt-3 mt-4 border-t border-slate-100 text-xs font-semibold text-slate-400 hover:text-slate-700 transition cursor-pointer"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            {!collapsed && <span>Collapse menu</span>}
          </button>
        </aside>

        {/* Main Settings Content */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
