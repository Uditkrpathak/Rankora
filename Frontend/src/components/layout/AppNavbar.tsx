import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useLogoutMutation } from '../../store/api/authApi';
import { useGetWorkspaceQuery } from '../../store/api/workspaceApi';
import { BrandLogo } from '../ui/BrandLogo';
import { Button } from '../ui/Button';
import { BusinessAvatar } from '../ui/BusinessAvatar';
import { NotificationBell } from './NotificationBell';
import {
  Plus,
  Zap,
  User as UserIcon,
  HelpCircle,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Settings,
  Link2,
} from 'lucide-react';

interface AppNavbarProps {
  onAddBusiness?: () => void;
  fullWidth?: boolean;
}

export const AppNavbar: React.FC<AppNavbarProps> = ({ onAddBusiness, fullWidth = true }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, activeWorkspace } = useSelector((state: RootState) => state.auth);
  const [logout] = useLogoutMutation();

  const workspaceId = activeWorkspace?.id || '';
  const { data: wsDetail } = useGetWorkspaceQuery(workspaceId, { skip: !workspaceId });

  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Close menus on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAvatarMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Route change closes menus
  useEffect(() => {
    setAvatarMenuOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    setAvatarMenuOpen(false);
    setMobileMenuOpen(false);
    await logout();
    navigate('/login');
  };

  const scanCredits = wsDetail?.data?.limits?.scanCredits;
  const creditsDisplay = typeof scanCredits === 'number' ? `${scanCredits} credits` : null;

  const navLinks = [
    { label: 'Home', to: '/dashboard' },
    { label: 'Reviews', to: '/reviews' },
    { label: 'Help', to: '/help' },
  ];

  const handleAddClick = () => {
    if (onAddBusiness) {
      onAddBusiness();
    } else {
      navigate('/locations/new');
    }
  };

  return (
    <>
      {user && !user.isEmailVerified && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center justify-between z-50">
          <div className="flex items-center gap-2 truncate">
            <span className="font-bold flex-shrink-0">⚠️ Action required:</span>
            <span className="truncate">Your email ({user.email}) is unverified. Verify your email to activate full workspace scanning.</span>
          </div>
          <Link to="/verify-email" className="font-bold text-amber-900 underline hover:text-amber-950 ml-4 flex-shrink-0">
            Verify email →
          </Link>
        </div>
      )}
      <header className="sticky top-0 z-40 w-full h-14 bg-white border-b border-slate-200 transition-all">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-6">
          {/* Left: Brand Logo & Desktop Nav Links with Generous Spacing */}
          <div className="flex items-center gap-6 md:gap-8">
            <BrandLogo to="/dashboard" />
            <div className="h-4 w-px bg-slate-200/90 hidden sm:block" />

            <nav className="hidden md:flex items-center gap-2" aria-label="Main Navigation">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${isActive
                      ? 'bg-slate-100 text-slate-900 font-semibold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Actions, Credits & User Avatar with Generous Spacing */}
          <div className="flex items-center gap-3 sm:gap-4 md:gap-5">
            {/* Real Credits Chip */}


            {/* Add Business - Desktop */}
            <div className="hidden sm:block">
              <Button
                variant="primary"
                size="md"
                onClick={handleAddClick}
                leftIcon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
                className="font-semibold shadow-xs"
                aria-label="Add business"
              >
                Add business
              </Button>
            </div>

            {/* Add Business - Mobile Icon */}
            <button
              onClick={handleAddClick}
              aria-label="Add business"
              className="sm:hidden p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 shadow-xs"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Notification Bell Center */}
            <NotificationBell />

            {/* User Avatar Menu Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setAvatarMenuOpen((prev) => !prev)}
                aria-expanded={avatarMenuOpen}
                aria-haspopup="true"
                aria-label="User account menu"
                className="flex items-center gap-2 p-1 rounded-full ring-1 ring-slate-200/80 hover:ring-brand-500/50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <BusinessAvatar
                  name={user?.name || user?.email || 'User'}
                  size="sm"
                  shape="circle"
                  photoUrl={user?.avatarUrl}
                />
                <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block mr-0.5" />
              </button>

              {avatarMenuOpen && (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-slate-200 shadow-elevated py-1.5 z-50 text-xs"
                >
                  <div className="px-3.5 py-2.5 border-b border-slate-100">
                    <p className="font-semibold text-slate-900 truncate">
                      {user?.name || 'User'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {user?.email || ''}
                    </p>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/settings/account"
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition font-medium"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>Edit Profile</span>
                    </Link>
                    <Link
                      to="/settings/workspace"
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition font-medium"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>Settings</span>
                    </Link>
                    <Link
                      to="/settings/connections"
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                      className="w-full flex items-center justify-between px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition font-medium"
                    >
                      <div className="flex items-center gap-2.5">
                        <Link2 className="w-3.5 h-3.5 text-blue-500" />
                        <span>Connected Accounts</span>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200">
                        GBP
                      </span>
                    </Link>
                    <Link
                      to="/help"
                      role="menuitem"
                      onClick={() => setAvatarMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition font-medium"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>Help</span>
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 pt-1">
                    <button
                      role="menuitem"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2 text-rose-600 hover:bg-rose-50 transition text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer Sheet */}
      {mobileMenuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
          className="md:hidden fixed inset-0 z-50 flex flex-col bg-slate-900/40 backdrop-blur-xs"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-full bg-white border-b border-slate-200 shadow-elevated p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <BrandLogo to="/dashboard" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {creditsDisplay !== null && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <Zap className="w-3.5 h-3.5 text-brand-600" />
                <span className="font-semibold">{creditsDisplay}</span>
              </div>
            )}

            <nav className="space-y-1.5" aria-label="Mobile Navigation Links">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3.5 py-2 rounded-lg text-xs font-medium transition ${location.pathname === link.to
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                to="/settings/account"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Edit Profile
              </Link>
              <Link
                to="/settings/workspace"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Settings
              </Link>
              <Link
                to="/settings/connections"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                Connected Accounts (GBP)
              </Link>
            </nav>

            <div className="pt-2 border-t border-slate-100">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition text-left"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
