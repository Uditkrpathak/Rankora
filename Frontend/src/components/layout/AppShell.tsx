import React from 'react';
import { AppNavbar } from './AppNavbar';

interface AppShellProps {
  children: React.ReactNode;
  hideSidebar?: boolean;
  onAddBusiness?: () => void;
  fullWidth?: boolean;
}

/**
 * Top-level application shell
 * Clean, full-width layout across all pages per user specification.
 */
export const AppShell: React.FC<AppShellProps> = ({
  children,
  onAddBusiness,
  fullWidth = true,
}) => {
  return (
    <div className="min-h-screen page-canvas flex flex-col text-slate-900 antialiased selection:bg-brand-500 selection:text-white">
      <AppNavbar onAddBusiness={onAddBusiness} fullWidth={true} />
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 min-w-0 flex flex-col">
        {children}
      </main>
    </div>
  );
};

export default AppShell;
