import React, { useState, useMemo } from 'react';
import { EmployeeLeaveBalance, UserRole } from '../types/roster';
import { exportBalancesToCSV, calculateEmployeeBalance } from '../utils/rosterUtils';
import {
  Search,
  Download,
  AlertTriangle,
  Edit2,
  Check,
  X,
  SlidersHorizontal,
  PlusCircle,
  HelpCircle,
  ArrowUpDown,
  Lock,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface LeaveBalancesViewProps {
  balances: EmployeeLeaveBalance[];
  year: number;
  onUpdateBalance: (empId: string, updated: EmployeeLeaveBalance) => void;
  onSelectEmployee: (empId: string) => void;
  onOpenLogModal: (empId?: string) => void;
  userRole?: UserRole;
  onOpenAdminModal?: () => void;
  onSyncAllBalances?: () => void;
}

export const LeaveBalancesView: React.FC<LeaveBalancesViewProps> = ({
  balances,
  year,
  onUpdateBalance,
  onSelectEmployee,
  onOpenLogModal,
  userRole = 'admin',
  onOpenAdminModal,
  onSyncAllBalances,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'negative_co' | 'low_pl' | 'high_consumer'>('all');
  const [sortField, setSortField] = useState<keyof EmployeeLeaveBalance>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Inline editing state
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EmployeeLeaveBalance | null>(null);

  const startEdit = (emp: EmployeeLeaveBalance) => {
    if (userRole === 'viewer') {
      if (onOpenAdminModal) onOpenAdminModal();
      return;
    }
    setEditingEmpId(emp.empId);
    setEditFormData({ ...emp });
  };

  const cancelEdit = () => {
    setEditingEmpId(null);
    setEditFormData(null);
  };

  const saveEdit = () => {
    if (!editingEmpId || !editFormData) return;
    const recomputed = calculateEmployeeBalance(editFormData);
    onUpdateBalance(editingEmpId, recomputed);
    setEditingEmpId(null);
    setEditFormData(null);
  };

  const handleFieldChange = (field: keyof EmployeeLeaveBalance, val: any) => {
    if (!editFormData) return;
    const updated = { ...editFormData, [field]: val };
    const recomputed = calculateEmployeeBalance(updated);
    setEditFormData(recomputed);
  };

  // Filter and sort
  const filteredBalances = useMemo(() => {
    let result = balances.filter((b) => {
      const matchSearch =
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.empId.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;

      if (filterType === 'negative_co') return b.compOffBalance < 0;
      if (filterType === 'low_pl') return b.plBalance <= 6;
      if (filterType === 'high_consumer') return b.totalLeaveTaken >= 12;

      return true;
    });

    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortAsc ? valA - valB : valB - valA;
      }
      return sortAsc
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });

    return result;
  }, [balances, searchTerm, filterType, sortField, sortAsc]);

  const handleSort = (field: keyof EmployeeLeaveBalance) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Controls Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {year} Resource Leave Balances &amp; Quota Ledger
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Exact replica of company Excel sheet with real-time balance formulas (PL, SL, CL, Comp Off &amp; PH)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search employee or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap ${
                  filterType === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({balances.length})
              </button>
              <button
                onClick={() => setFilterType('negative_co')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap ${
                  filterType === 'negative_co'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Deficit Comp Off ({balances.filter((b) => b.compOffBalance < 0).length})
              </button>
              <button
                onClick={() => setFilterType('low_pl')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap ${
                  filterType === 'low_pl'
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Low PL (≤6)
              </button>
              <button
                onClick={() => setFilterType('high_consumer')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md whitespace-nowrap ${
                  filterType === 'high_consumer'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                High Leaves (≥12)
              </button>
            </div>

            {/* Actions */}
            {onSyncAllBalances && (
              <button
                onClick={userRole === 'admin' ? onSyncAllBalances : onOpenAdminModal}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-xs whitespace-nowrap cursor-pointer ${
                  userRole === 'admin'
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'text-slate-500 bg-slate-100/80 border border-slate-200/80 hover:border-amber-400'
                }`}
                title={userRole === 'admin' ? 'Recalculate and synchronize all leave quotas with schedule cells across 2026' : 'Admin only: Unlock to sync'}
              >
                {userRole === 'admin' ? (
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span>Sync Leaves from Schedule</span>
              </button>
            )}

            <button
              onClick={userRole === 'admin' ? () => exportBalancesToCSV(year, balances) : onOpenAdminModal}
              disabled={userRole !== 'admin'}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-xs whitespace-nowrap ${
                userRole === 'admin'
                  ? 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer'
                  : 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed opacity-60'
              }`}
              title={
                userRole === 'admin'
                  ? 'Download leave balances CSV'
                  : 'Export is disabled in Read-Only mode. Admin access required.'
              }
            >
              {userRole === 'admin' ? (
                <Download className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Leave Balances Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[75vh]">
          <table className="w-full text-xs text-left border-collapse border-spacing-0">
            {/* Super Header / Group Headers */}
            <thead className="sticky top-0 z-20 text-slate-800">
              <tr className="border-b border-slate-200 text-center font-bold">
                <th colSpan={3} className="bg-slate-200 px-3 py-1.5 text-left border-r border-slate-300">
                  Resource Info
                </th>
                <th colSpan={4} className="bg-red-100 text-red-950 px-3 py-1.5 border-r border-red-200">
                  Privilege Leave (PL) Quota
                </th>
                <th colSpan={3} className="bg-amber-100 text-amber-950 px-3 py-1.5 border-r border-amber-200">
                  Sick Leave (SL)
                </th>
                <th colSpan={3} className="bg-sky-100 text-sky-950 px-3 py-1.5 border-r border-sky-200">
                  Casual Leave (CL)
                </th>
                <th colSpan={4} className="bg-emerald-100 text-emerald-950 px-3 py-1.5 border-r border-emerald-200">
                  Comp Off (CO / Time in Lieu)
                </th>
                <th colSpan={2} className="bg-blue-100 text-blue-950 px-3 py-1.5 border-r border-blue-200">
                  Totals
                </th>
                <th className="bg-slate-200 px-3 py-1.5">
                  Action
                </th>
              </tr>

              {/* Individual Column Headers */}
              <tr className="bg-slate-100 text-slate-700 border-b border-slate-300 text-[11px]">
                <th
                  onClick={() => handleSort('name')}
                  className="px-3 py-2 font-bold cursor-pointer hover:bg-slate-200 border-r border-slate-200 min-w-[160px]"
                >
                  <div className="flex items-center justify-between">
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('empId')}
                  className="px-2 py-2 font-bold text-center cursor-pointer hover:bg-slate-200 border-r border-slate-200 min-w-[70px]"
                >
                  EMP ID
                </th>
                <th className="px-2 py-2 font-bold text-center border-r border-slate-300 min-w-[90px]">
                  Joining Date
                </th>

                {/* PL Columns */}
                <th className="px-2 py-2 font-bold text-center border-r border-red-100 bg-red-50/50 min-w-[65px]">
                  PL Carried
                </th>
                <th className="px-2 py-2 font-bold text-center border-r border-red-100 bg-red-50/50 min-w-[65px]">
                  PL Accum
                </th>
                <th className="px-2 py-2 font-bold text-center border-r border-red-100 bg-red-50/50 min-w-[65px]">
                  PL Used
                </th>
                <th
                  onClick={() => handleSort('plBalance')}
                  className="px-2 py-2 font-bold text-center border-r border-red-200 bg-red-100/70 text-red-950 cursor-pointer hover:bg-red-200 min-w-[70px]"
                >
                  PL Balance
                </th>

                {/* SL Columns */}
                <th className="px-2 py-2 font-bold text-center border-r border-amber-100 bg-amber-50/50 min-w-[65px]">
                  SL Accum
                </th>
                <th className="px-2 py-2 font-bold text-center border-r border-amber-100 bg-amber-50/50 min-w-[65px]">
                  SL Used
                </th>
                <th
                  onClick={() => handleSort('slBalance')}
                  className="px-2 py-2 font-bold text-center border-r border-amber-200 bg-amber-100/70 text-amber-950 cursor-pointer hover:bg-amber-200 min-w-[70px]"
                >
                  SL Balance
                </th>

                {/* CL Columns */}
                <th className="px-2 py-2 font-bold text-center border-r border-sky-100 bg-sky-50/50 min-w-[65px]">
                  CL Accum
                </th>
                <th className="px-2 py-2 font-bold text-center border-r border-sky-100 bg-sky-50/50 min-w-[65px]">
                  CL Used
                </th>
                <th
                  onClick={() => handleSort('clBalance')}
                  className="px-2 py-2 font-bold text-center border-r border-sky-200 bg-sky-100/70 text-sky-950 cursor-pointer hover:bg-sky-200 min-w-[70px]"
                >
                  CL Balance
                </th>

                {/* Comp Off Columns */}
                <th className="px-2 py-2 font-bold text-center border-r border-emerald-100 bg-emerald-50/50 min-w-[65px]">
                  CO Eligible
                </th>
                <th className="px-2 py-2 font-bold text-center border-r border-emerald-100 bg-emerald-50/50 min-w-[65px]">
                  CO Used
                </th>
                <th className="px-2 py-2 font-bold text-center border-r border-emerald-100 bg-emerald-50/50 min-w-[65px]">
                  CO Expired
                </th>
                <th
                  onClick={() => handleSort('compOffBalance')}
                  className="px-2 py-2 font-bold text-center border-r border-emerald-200 bg-emerald-100/70 text-emerald-950 cursor-pointer hover:bg-emerald-200 min-w-[70px]"
                >
                  CO Balance
                </th>

                {/* Totals */}
                <th className="px-2 py-2 font-bold text-center border-r border-blue-100 bg-blue-50/50 min-w-[65px]">
                  PH Used
                </th>
                <th
                  onClick={() => handleSort('totalLeaveTaken')}
                  className="px-2 py-2 font-bold text-center border-r border-blue-200 bg-blue-100 text-blue-950 cursor-pointer hover:bg-blue-200 min-w-[75px]"
                >
                  Total Leave
                </th>

                <th className="px-3 py-2 text-center min-w-[70px]">
                  Edit
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200 font-mono text-xs">
              {filteredBalances.map((b) => {
                const isEditing = editingEmpId === b.empId;
                const currentData = isEditing && editFormData ? editFormData : b;

                return (
                  <tr
                    key={b.empId}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isEditing ? 'bg-blue-50/40 ring-1 ring-blue-400' : ''
                    }`}
                  >
                    {/* Name */}
                    <td className="px-3 py-2 font-sans font-semibold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                      <button
                        onClick={() => onSelectEmployee(b.empId)}
                        className="hover:text-blue-600 transition-colors text-left"
                      >
                        {b.name}
                      </button>
                    </td>

                    {/* EMP ID */}
                    <td className="px-2 py-2 text-center text-slate-600 border-r border-slate-200 tabular-nums">
                      {b.empId}
                    </td>

                    {/* Joining Date */}
                    <td className="px-2 py-2 text-center text-slate-500 font-sans border-r border-slate-300 whitespace-nowrap text-[11px]">
                      {b.joiningDate}
                    </td>

                    {/* PL Carried Over */}
                    <td className="px-2 py-1.5 text-center border-r border-slate-200 bg-red-50/30 tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={currentData.plCarriedOver}
                          onChange={(e) => handleFieldChange('plCarriedOver', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 text-center bg-white border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        b.plCarriedOver
                      )}
                    </td>

                    {/* PL Accumulated */}
                    <td className="px-2 py-1.5 text-center border-r border-slate-200 bg-red-50/30 tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={currentData.plAccumulated}
                          onChange={(e) => handleFieldChange('plAccumulated', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 text-center bg-white border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        b.plAccumulated
                      )}
                    </td>

                    {/* PL Consumed */}
                    <td className="px-2 py-1.5 text-center border-r border-slate-200 bg-red-50/30 text-red-700 font-bold tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={currentData.plConsumed}
                          onChange={(e) => handleFieldChange('plConsumed', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 text-center bg-white border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500 text-red-700 font-bold"
                        />
                      ) : (
                        b.plConsumed
                      )}
                    </td>

                    {/* PL Balance (Formula) */}
                    <td className="px-2 py-2 text-center border-r border-red-200 bg-red-100/60 font-bold text-slate-900 tabular-nums">
                      {currentData.plBalance}
                    </td>

                    {/* SL Accumulated */}
                    <td className="px-2 py-1.5 text-center border-r border-slate-200 bg-amber-50/30 tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={currentData.totalSlAccumulated}
                          onChange={(e) => handleFieldChange('totalSlAccumulated', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 text-center bg-white border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        b.totalSlAccumulated
                      )}
                    </td>

                    {/* SL Consumed */}
                    <td className="px-2 py-1.5 text-center border-r border-slate-200 bg-amber-50/30 text-amber-800 font-bold tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={currentData.slConsumed}
                          onChange={(e) => handleFieldChange('slConsumed', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 text-center bg-white border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500 text-amber-800 font-bold"
                        />
                      ) : (
                        b.slConsumed
                      )}
                    </td>

                    {/* SL Balance (Formula) */}
                    <td className="px-2 py-2 text-center border-r border-amber-200 bg-amber-100/60 font-bold text-slate-900 tabular-nums">
                      {currentData.slBalance}
                    </td>

                    {/* CL Accumulated */}
                    <td className="px-2 py-1.5 text-center border-r border-slate-200 bg-sky-50/30 tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={currentData.totalClAccumulated}
                          onChange={(e) => handleFieldChange('totalClAccumulated', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 text-center bg-white border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        b.totalClAccumulated
                      )}
                    </td>

                    {/* CL Consumed */}
                    <td className="px-2 py-1.5 text-center border-r border-slate-200 bg-sky-50/30 text-sky-800 font-bold tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.5"
                          value={currentData.clConsumed}
                          onChange={(e) => handleFieldChange('clConsumed', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 text-center bg-white border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500 text-sky-800 font-bold"
                        />
                      ) : (
                        b.clConsumed
                      )}
                    </td>

                    {/* CL Balance (Formula) */}
                    <td className="px-2 py-2 text-center border-r border-sky-200 bg-sky-100/60 font-bold text-slate-900 tabular-nums">
                      {currentData.clBalance}
                    </td>

                    {/* Comp Off Eligible */}
                    <td className="px-2 py-1.5 text-center border-r border-slate-200 bg-emerald-50/30 tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="1"
                          value={currentData.compOffEligible}
                          onChange={(e) => handleFieldChange('compOffEligible', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 text-center bg-white border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        b.compOffEligible
                      )}
                    </td>

                    {/* Comp Off Consumed */}
                    <td className="px-2 py-1.5 text-center border-r border-slate-200 bg-emerald-50/30 text-emerald-800 font-bold tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="1"
                          value={currentData.compOffConsumed}
                          onChange={(e) => handleFieldChange('compOffConsumed', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 text-center bg-white border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500 text-emerald-800 font-bold"
                        />
                      ) : (
                        b.compOffConsumed
                      )}
                    </td>

                    {/* CO Expired */}
                    <td className="px-2 py-1.5 text-center border-r border-slate-200 bg-emerald-50/30 text-slate-500 tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="1"
                          value={currentData.coExpired}
                          onChange={(e) => handleFieldChange('coExpired', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 text-center bg-white border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                      ) : (
                        b.coExpired
                      )}
                    </td>

                    {/* Comp Off Balance (Formula) */}
                    <td
                      className={`px-2 py-2 text-center border-r border-emerald-200 font-bold tabular-nums ${
                        currentData.compOffBalance < 0
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100/60 text-emerald-950'
                      }`}
                    >
                      {currentData.compOffBalance}
                    </td>

                    {/* PH Consumed */}
                    <td className="px-2 py-1.5 text-center border-r border-slate-200 bg-blue-50/30 tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="1"
                          value={currentData.phConsumed}
                          onChange={(e) => handleFieldChange('phConsumed', Number(e.target.value))}
                          className="w-14 px-1 py-0.5 text-center bg-white border border-blue-300 rounded focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        b.phConsumed
                      )}
                    </td>

                    {/* Total Leave Taken */}
                    <td className="px-2 py-2 text-center border-r border-blue-200 bg-blue-100/70 font-bold text-blue-950 tabular-nums">
                      {currentData.totalLeaveTaken}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-1.5 text-center whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={saveEdit}
                            className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                            title="Save changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 rounded bg-slate-200 text-slate-700 hover:bg-slate-300"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : userRole === 'admin' ? (
                        <button
                          onClick={() => startEdit(b)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-sans font-medium text-[11px] transition-colors"
                        >
                          Edit
                        </button>
                      ) : (
                        <button
                          onClick={onOpenAdminModal}
                          className="px-2 py-1 rounded bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-800 font-sans font-medium text-[11px] transition-colors flex items-center gap-1 mx-auto"
                          title="Admin only: Unlock to edit leave balances"
                        >
                          <Lock className="w-3 h-3 text-amber-600" />
                          <span>Locked</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Formula & Rule Documentation Footer */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 space-y-1">
        <div className="font-bold text-slate-800">
          Accounting Formulas (Synchronized with Excel):
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
          <div>• PL Balance = (PL Carried Over + PL Accumulated) − PL Consumed</div>
          <div>• SL Balance = Total SL Accumulated − SL Consumed</div>
          <div>• CL Balance = Total CL Accumulated − CL Consumed</div>
          <div>• Comp Off Balance = Comp Off Eligible − Comp Off Consumed − Expired</div>
          <div>• Total Leave = PL + SL + CL + Comp Off + PH Consumed</div>
        </div>
      </div>
    </div>
  );
};
