import React from 'react';
import { ViewTab, UserRole } from '../types/roster';
import {
  Calendar,
  BarChart3,
  Users,
  Lock,
  ShieldCheck,
  KeyRound,
  LogOut,
  Layers,
} from 'lucide-react';
import { KaseyaLogo } from './KaseyaLogo';
import { useISTClock } from '../utils/istUtils';

interface NavbarProps {
  currentTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  year: number;
  userRole: UserRole;
  onOpenAdminModal: () => void;
  onOpenPasswordSettings?: () => void;
  onLockApp?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  year,
  userRole,
  onOpenAdminModal,
  onOpenPasswordSettings,
  onLockApp,
}) => {
  const ist = useISTClock();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Zone 1: Brand Zone with Kaseya Logo & title */}
          <div className="flex items-center gap-3 shrink-0">
            <KaseyaLogo size="sm" showWordmark={true} />
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div className="hidden sm:flex items-baseline gap-2">
              <span className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
                NOC Dedicated Team Roster
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded font-mono tabular-nums">
                {year}
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => onTabChange('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                currentTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onTabChange('roster')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                currentTab === 'roster'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Shift Roster</span>
            </button>

            <button
              onClick={() => onTabChange('balances')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                currentTab === 'balances'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Leave Balances</span>
            </button>

            <button
              onClick={() => onTabChange('directory')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
                currentTab === 'directory'
                  ? 'bg-blue-600 text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Directory</span>
            </button>
          </nav>

          {/* Zone 3: Security & Session Controls (Sleek, Uncrowded) */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Live Indian Standard Time (IST) Clock & Date Badge */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 border border-blue-200/80 text-xs shadow-2xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Live IST Synchronization Active" />
              <span className="font-bold text-blue-950">🇮🇳 IST:</span>
              <span className="text-blue-900 font-semibold">{ist.formattedDate}</span>
              <span className="text-blue-300">|</span>
              <span className="text-blue-700 font-bold tabular-nums">{ist.formattedTime}</span>
            </div>

            {/* Admin Role Status & Switcher */}
            <button
              onClick={onOpenAdminModal}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-2xs active:scale-98 ${
                userRole === 'admin'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
              title={
                userRole === 'admin'
                  ? 'Admin Mode Active (Full Edit & Import Rights). Click to switch to Read-Only.'
                  : 'Read-Only Mode. Click to enter Admin Password and unlock full edit rights.'
              }
            >
              {userRole === 'admin' ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Admin Mode</span>
                  <span className="text-[10px] text-emerald-600 font-normal">(Switch)</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Read-Only</span>
                  <span className="text-[10px] text-amber-700 font-normal">(Unlock)</span>
                </>
              )}
            </button>

            {/* Change Passwords (Admin Only) */}
            {userRole === 'admin' && onOpenPasswordSettings && (
              <button
                onClick={onOpenPasswordSettings}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Manage App Entrance Password and Admin Password"
              >
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Change Passwords</span>
              </button>
            )}

            {/* Lock Portal / Logout */}
            {onLockApp && (
              <button
                onClick={onLockApp}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Lock Portal (Requires App Password to re-enter)"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Lock Portal</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="flex md:hidden border-t border-slate-100 py-2 gap-1 overflow-x-auto">
          <button
            onClick={() => onTabChange('dashboard')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
              currentTab === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-600'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => onTabChange('roster')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
              currentTab === 'roster' ? 'bg-blue-600 text-white' : 'text-slate-600'
            }`}
          >
            Shift Roster
          </button>
          <button
            onClick={() => onTabChange('balances')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
              currentTab === 'balances' ? 'bg-blue-600 text-white' : 'text-slate-600'
            }`}
          >
            Leave Balances
          </button>
          <button
            onClick={() => onTabChange('directory')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap cursor-pointer ${
              currentTab === 'directory' ? 'bg-blue-600 text-white' : 'text-slate-600'
            }`}
          >
            Directory
          </button>
        </div>
      </div>
    </header>
  );
};
