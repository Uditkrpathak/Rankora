import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { AppNavbar } from '../../components/layout/AppNavbar';
import {
  User,
  Globe,
  HelpCircle,
  Settings,
  Users,
  CreditCard,
  Sparkles,
  Link2,
  FileText,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Check,
  BookOpen,
  MessageSquare,
  ShieldAlert,
  Bell,
} from 'lucide-react';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children }) => {
  const location = useLocation();
  const { user, activeWorkspace } = useSelector((state: RootState) => state.auth);
  const [collapsed, setCollapsed] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState('English (US)');

  const langRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) {
        setHelpOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const personalNav = [
    { label: 'My Account', icon: <User size={16} />, to: '/settings/account' },
  ];

  const workspaceNav = [
    { label: 'Settings', icon: <Settings size={16} />, to: '/settings/workspace' },
    { label: 'Team & Clients', icon: <Users size={16} />, to: '/settings/team', altTo: '/team' },
    { label: 'Billing', icon: <CreditCard size={16} />, to: '/settings/billing' },
    { label: 'Notifications & Alerts', icon: <Bell size={16} />, to: '/settings/notifications' },
    { label: 'Explore plans', icon: <Sparkles size={16} />, to: '/settings/plans' },
    { label: 'Connected accounts', icon: <Link2 size={16} />, to: '/settings/connections' },
    { label: 'Published sites', icon: <FileText size={16} />, to: '/settings/published-sites' },
  ];

  const languages = [
    'English (US)',
    'English (UK)',
    'Español',
    'Français',
    'Deutsch',
    'Português',
    'Italiano',
  ];

  const userInitial = (user?.name || user?.email || 'U')[0].toUpperCase();
  const userEmail = user?.email || 'user@example.com';

  return (
    <div className="min-h-screen w-full page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar fullWidth={true} />
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row gap-8 min-h-[calc(100vh-60px)]">
        {/* Settings Left Sidebar */}
        <aside
          className={`shrink-0 transition-all duration-200 self-start sticky top-20 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs ${
            collapsed ? 'w-full lg:w-[72px]' : 'w-full lg:w-[260px]'
          }`}
        >
          {/* User Email Pill */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 mb-5 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-blue-600 text-white flex items-center justify-center text-sm font-extrabold shrink-0 shadow-2xs">
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

            {/* Language dropdown */}
            <div className="relative" ref={langRef}>
              <button
                type="button"
                onClick={() => setLangOpen(!langOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Globe size={16} className="text-slate-400" />
                  {!collapsed && <span>Language</span>}
                </div>
                {!collapsed && <ChevronDown size={14} className="text-slate-400" />}
              </button>

              {langOpen && !collapsed && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Language
                  </div>
                  {languages.map((l) => (
                    <button
                      key={l}
                      onClick={() => {
                        setSelectedLang(l);
                        setLangOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left cursor-pointer transition ${
                        selectedLang === l ? 'bg-brand-50 text-brand-600 font-bold' : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{l}</span>
                      {selectedLang === l && <Check size={12} className="text-brand-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Help center dropdown */}
            <div className="relative" ref={helpRef}>
              <button
                type="button"
                onClick={() => setHelpOpen(!helpOpen)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle size={16} className="text-slate-400" />
                  {!collapsed && <span>Help center</span>}
                </div>
                {!collapsed && <ChevronDown size={14} className="text-slate-400" />}
              </button>

              {helpOpen && !collapsed && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50 animate-in fade-in space-y-1">
                  <a
                    href="https://support.google.com/business"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition"
                  >
                    <BookOpen size={14} className="text-brand-500" />
                    <span>Localo Knowledge Base</span>
                    <ExternalLink size={12} className="text-slate-400 ml-auto" />
                  </a>
                  <a
                    href="mailto:support@localo.io"
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition"
                  >
                    <MessageSquare size={14} className="text-emerald-500" />
                    <span>Contact 24/7 Support</span>
                  </a>
                </div>
              )}
            </div>
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
        <main className="flex-1 min-w-0 max-w-full space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
};
