/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  CellValue,
  EmployeeLeaveBalance,
  EmployeeRosterRow,
  ViewTab,
  UserRole,
} from './types/roster';
import {
  loadDatabase,
  saveDatabase,
  resetDatabase,
  getMonthRosterRows,
  exportDatabaseToCSV,
  DatabaseState,
  saveDatabaseBackup,
  getDatabaseBackup,
  restoreDatabaseBackup,
  DatabaseBackup,
} from './data/database';
import { calculateEmployeeBalance } from './utils/rosterUtils';
import { synchronizeLeaveBalances } from './utils/rosterFileParser';
import { RotateCcw } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { PageActionBar } from './components/PageActionBar';
import { DashboardView } from './components/DashboardView';
import { RosterGridView } from './components/RosterGridView';
import { LeaveBalancesView } from './components/LeaveBalancesView';
import { EmployeeDirectoryView } from './components/EmployeeDirectoryView';
import { EmployeeDetailModal } from './components/EmployeeDetailModal';
import { AddLeaveModal } from './components/AddLeaveModal';
import { ImportCsvModal } from './components/ImportCsvModal';
import { AdminAuthModal } from './components/AdminAuthModal';
import { AppPasswordGate } from './components/AppPasswordGate';
import { AdminPasswordSettingsModal } from './components/AdminPasswordSettingsModal';
import { isAppAuthenticated, setAppAuthenticated } from './utils/authUtils';
import { getISTDate } from './utils/istUtils';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function App() {
  const initialIST = getISTDate();

  // Gatekeeper: App Entrance Password required for anyone opening the app (default: Noc@Roster2026)
  const [isAppUnlocked, setIsAppUnlocked] = useState<boolean>(() => isAppAuthenticated());

  // Indian Standard Time (IST) initial date state: starts directly with current date roster
  const [year] = useState<number>(() => initialIST.year);
  const [month, setMonth] = useState<number>(() => initialIST.month);
  const [selectedDay, setSelectedDay] = useState<number>(() => initialIST.day);
  const [currentTab, setCurrentTab] = useState<ViewTab>('dashboard');

  // User Role State: Default to 'viewer' (Read-Only) to demonstrate viewer protection; user can click Unlock Admin
  const [userRole, setUserRole] = useState<UserRole>('viewer');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState<boolean>(false);
  const [isPasswordSettingsOpen, setIsPasswordSettingsOpen] = useState<boolean>(false);

  // Master Database State (Holds all 365 days of schedules and leave balances for all 28 employees)
  const [db, setDb] = useState<DatabaseState>(() => loadDatabase());
  // Database backup state for Undo capability
  const [backupInfo, setBackupInfo] = useState<DatabaseBackup | null>(() => getDatabaseBackup());

  // Derive Roster Rows for currently active month from database
  const rosterRows = useMemo(() => {
    return getMonthRosterRows(db, year, month);
  }, [db, year, month]);

  // Balances
  const balances = db.balances;

  // Modal states
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [addModalPreselectedEmpId, setAddModalPreselectedEmpId] = useState<
    string | undefined
  >(undefined);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // 1. Update single day cell in database
  const handleUpdateCell = (empId: string, day: number, value: CellValue) => {
    if (userRole === 'viewer') {
      setIsAdminModalOpen(true);
      return;
    }
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const newSchedules = {
      ...db.dailySchedules,
      [empId]: {
        ...(db.dailySchedules[empId] || {}),
        [dateKey]: String(value),
      },
    };

    const newDb: DatabaseState = {
      ...db,
      dailySchedules: newSchedules,
    };

    setDb(newDb);
    saveDatabase(newDb);
    showToast(`Saved Day ${day} (${month}/${day}/${year}) to '${value}' in database`);
  };

  // 2. Update employee leave balance quota
  const handleUpdateBalance = (empId: string, updated: EmployeeLeaveBalance) => {
    if (userRole === 'viewer') {
      setIsAdminModalOpen(true);
      return;
    }
    const recomputed = calculateEmployeeBalance(updated);
    const newBalances = db.balances.map((b) => (b.empId === empId ? recomputed : b));

    const newDb: DatabaseState = {
      ...db,
      balances: newBalances,
    };

    setDb(newDb);
    saveDatabase(newDb);
    showToast(`Updated 2026 quota ledger for ${updated.name}`);
  };

  // 3. Reset database to master CSV
  const handleResetToMaster = () => {
    if (userRole === 'viewer') {
      setIsAdminModalOpen(true);
      return;
    }
    if (
      window.confirm(
        'Reset the entire database back to the official Kaseya NOC master CSV data?'
      )
    ) {
      const resetState = resetDatabase();
      setDb(resetState);
      showToast('Reset database to official master Kaseya NOC roster');
    }
  };

  // 4. Multi-day leave or shift assignment
  const handleAddLeaveSubmit = ({
    empId,
    startDay,
    endDay,
    value,
    updateQuota,
  }: {
    empId: string;
    startDay: number;
    endDay: number;
    value: CellValue;
    updateQuota: boolean;
  }) => {
    if (userRole === 'viewer') {
      setIsAdminModalOpen(true);
      return;
    }
    const newEmpSchedule = { ...(db.dailySchedules[empId] || {}) };
    for (let d = startDay; d <= endDay; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      newEmpSchedule[dateKey] = String(value);
    }

    let newBalances = db.balances;
    if (updateQuota) {
      const daysCount = endDay - startDay + 1;
      newBalances = db.balances.map((b) => {
        if (b.empId === empId) {
          const mod = { ...b };
          if (value === 'PL') mod.plConsumed += daysCount;
          else if (value === 'SL') mod.slConsumed += daysCount;
          else if (value === 'CL') mod.clConsumed += daysCount;
          else if (value === 'CO') mod.compOffConsumed += daysCount;
          else if (value === 'PH') mod.phConsumed += daysCount;
          return calculateEmployeeBalance(mod);
        }
        return b;
      });
    }

    const newDb: DatabaseState = {
      ...db,
      balances: newBalances,
      dailySchedules: {
        ...db.dailySchedules,
        [empId]: newEmpSchedule,
      },
    };

    setDb(newDb);
    saveDatabase(newDb);

    const emp = db.balances.find((b) => b.empId === empId);
    showToast(
      `Logged ${value} for ${emp?.name || empId} from Day ${startDay} to ${endDay} (${MONTH_NAMES[month - 1]})`
    );
  };

  // 5. Apply newly imported Excel / CSV data
  const handleImportSuccess = (importedState: DatabaseState, targetMonth?: number) => {
    if (userRole === 'viewer') {
      setIsAdminModalOpen(true);
      return;
    }
    // Save database backup snapshot before applying import so user can undo anytime!
    saveDatabaseBackup(db, `Snapshot before import at ${new Date().toLocaleTimeString()}`);
    setBackupInfo(getDatabaseBackup());

    setDb(importedState);
    saveDatabase(importedState);
    if (targetMonth && targetMonth >= 1 && targetMonth <= 12) {
      setMonth(targetMonth);
    }
    showToast(
      `Successfully synchronized ${importedState.balances.length} team members! Undo snapshot saved.`
    );
  };

  // 6. Undo last import and revert to previous database snapshot
  const handleUndoImport = () => {
    if (userRole === 'viewer') {
      setIsAdminModalOpen(true);
      return;
    }
    const previous = restoreDatabaseBackup();
    if (!previous) {
      showToast('No previous database backup available to restore.');
      return;
    }
    setDb(previous);
    setBackupInfo(null);
    showToast('Undo completed: Reverted database to state before last import!');
  };

  // 7. Synchronize all leave balances with daily schedules
  const handleSyncAllBalances = () => {
    if (userRole === 'viewer') {
      setIsAdminModalOpen(true);
      return;
    }
    const syncRes = synchronizeLeaveBalances(db.balances, db.dailySchedules);
    const newDb: DatabaseState = {
      ...db,
      balances: syncRes.syncedBalances,
    };
    setDb(newDb);
    saveDatabase(newDb);
    showToast(
      `Synchronized leave balances from all schedules! (${syncRes.summaryChanges.length} quotas updated)`
    );
  };

  const handleOpenAddModal = (targetEmpId?: string) => {
    if (userRole === 'viewer') {
      setIsAdminModalOpen(true);
      return;
    }
    setAddModalPreselectedEmpId(targetEmpId);
    setIsAddModalOpen(true);
  };

  const monthName = MONTH_NAMES[month - 1];

  const selectedEmployeeBalance = balances.find((b) => b.empId === selectedEmpId);
  const selectedEmployeeRoster = rosterRows.find((r) => r.empId === selectedEmpId);

  // If the app has not been unlocked with the app password, render the AppPasswordGate
  if (!isAppUnlocked) {
    return (
      <>
        <AppPasswordGate
          onUnlockSuccess={() => {
            const istNow = getISTDate();
            setMonth(istNow.month);
            setSelectedDay(istNow.day);
            setIsAppUnlocked(true);
            showToast(`Access granted: Loaded today's roster for ${istNow.formattedDate} (Indian Standard Time).`);
          }}
        />
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-xl border border-slate-700 animate-in slide-in-from-bottom-3 duration-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gradient-to-b from-blue-50/70 via-slate-50 to-blue-50/50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Sleek, uncrowded Navbar with brand, navigation, and role security */}
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        year={year}
        userRole={userRole}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
        onOpenPasswordSettings={() => setIsPasswordSettingsOpen(true)}
        onLockApp={() => {
          setAppAuthenticated(false);
          setIsAppUnlocked(false);
          showToast('Portal locked. App password required to re-enter.');
        }}
      />

      {/* Undo Alert Banner for Recent Import */}
      {backupInfo && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 border-b border-amber-600 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-slate-950 shrink-0" />
            <span>
              <strong>Roster database was recently imported.</strong> Wrong file or merged accidentally? Snapshot from{' '}
              <span className="font-mono">{backupInfo.formattedTime}</span> ({backupInfo.employeeCount} members) can be restored.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleUndoImport}
              className="px-3 py-1 bg-slate-900 hover:bg-black text-white font-bold rounded-md shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Undo Last Import</span>
            </button>
            <button
              onClick={() => setBackupInfo(null)}
              className="text-slate-900 hover:text-black p-0.5 font-bold cursor-pointer text-sm"
              title="Dismiss banner"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main View Area - Fluid responsive width up to 1600px without blank side gutters */}
      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* In-Page Operational Action Toolbar (Roster Month, Today IST, Import Excel/CSV, Export DB, Log Leave/Shift) */}
        <PageActionBar
          year={year}
          month={month}
          onMonthChange={(m) => {
            setMonth(m);
            const istNow = getISTDate();
            if (m === istNow.month) {
              setSelectedDay(istNow.day);
            } else {
              setSelectedDay(1);
            }
          }}
          onJumpToToday={() => {
            const istNow = getISTDate();
            setMonth(istNow.month);
            setSelectedDay(istNow.day);
            showToast(`Jumped to today: ${istNow.formattedDate} (IST)`);
          }}
          onOpenImportModal={() => {
            if (userRole === 'viewer') {
              setIsAdminModalOpen(true);
            } else {
              setIsImportModalOpen(true);
            }
          }}
          onExportMasterCsv={() => {
            if (userRole === 'viewer') {
              setIsAdminModalOpen(true);
              return;
            }
            exportDatabaseToCSV(db, year);
          }}
          onOpenLogModal={() => handleOpenAddModal()}
          userRole={userRole}
          onOpenAdminModal={() => setIsAdminModalOpen(true)}
          onUndoImport={handleUndoImport}
          hasUndoBackup={!!backupInfo}
        />
        {currentTab === 'dashboard' && (
          <DashboardView
            balances={balances}
            rosterRows={rosterRows}
            year={year}
            month={month}
            monthName={monthName}
            onSelectEmployee={(empId) => setSelectedEmpId(empId)}
            onNavigateToRoster={() => setCurrentTab('roster')}
            onNavigateToBalances={() => setCurrentTab('balances')}
            db={db}
            onMonthChange={setMonth}
            userRole={userRole}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        )}

        {currentTab === 'roster' && (
          <RosterGridView
            year={year}
            month={month}
            monthName={monthName}
            rows={rosterRows}
            onUpdateCell={handleUpdateCell}
            onResetRoster={handleResetToMaster}
            onSelectEmployee={(empId) => setSelectedEmpId(empId)}
            onMonthChange={setMonth}
            userRole={userRole}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
          />
        )}

        {currentTab === 'balances' && (
          <LeaveBalancesView
            balances={balances}
            year={year}
            onUpdateBalance={handleUpdateBalance}
            onSelectEmployee={(empId) => setSelectedEmpId(empId)}
            onOpenLogModal={handleOpenAddModal}
            userRole={userRole}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
            onSyncAllBalances={handleSyncAllBalances}
          />
        )}

        {currentTab === 'directory' && (
          <EmployeeDirectoryView
            balances={balances}
            rosterRows={rosterRows}
            year={year}
            onSelectEmployee={(empId) => setSelectedEmpId(empId)}
            onOpenLogLeave={handleOpenAddModal}
            userRole={userRole}
            onOpenAdminModal={() => setIsAdminModalOpen(true)}
          />
        )}
      </main>

      {/* Individual Employee Drill-down Modal */}
      {selectedEmployeeBalance && (
        <EmployeeDetailModal
          employee={selectedEmployeeBalance}
          rosterRow={selectedEmployeeRoster}
          year={year}
          month={month}
          monthName={monthName}
          onClose={() => setSelectedEmpId(null)}
          onOpenLogLeave={(empId) => handleOpenAddModal(empId)}
          onUpdateDayCell={handleUpdateCell}
          userRole={userRole}
          onOpenAdminModal={() => setIsAdminModalOpen(true)}
        />
      )}

      {/* Add Leave / Assign Shift Modal */}
      {isAddModalOpen && (
        <AddLeaveModal
          employees={balances}
          preSelectedEmpId={addModalPreselectedEmpId}
          year={year}
          month={month}
          monthName={monthName}
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddLeaveSubmit}
        />
      )}

      {/* Import Excel / CSV Modal */}
      {isImportModalOpen && (
        <ImportCsvModal
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={handleImportSuccess}
          currentDb={db}
          backupInfo={backupInfo}
          onUndoImport={handleUndoImport}
        />
      )}

      {/* Admin Verification & Role Switcher Modal */}
      <AdminAuthModal
        currentRole={userRole}
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onRoleChange={setUserRole}
        onShowToast={showToast}
        onOpenPasswordSettings={() => setIsPasswordSettingsOpen(true)}
      />

      {/* Admin Password Management Modal (Only Admin can change App Password and Admin Password) */}
      <AdminPasswordSettingsModal
        isOpen={isPasswordSettingsOpen}
        onClose={() => setIsPasswordSettingsOpen(false)}
        onShowToast={showToast}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-xl border border-slate-700 animate-in slide-in-from-bottom-3 duration-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
