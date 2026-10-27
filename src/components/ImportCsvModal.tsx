import React, { useState, useRef } from 'react';
import { DatabaseState, DatabaseBackup } from '../data/database';
import { parseRosterData, ParsedRosterResult } from '../utils/rosterFileParser';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Layers,
  RefreshCw,
  Info,
  FileSpreadsheet,
  FileText,
  Calendar,
  Users,
  Check,
  RotateCcw,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface ImportCsvModalProps {
  onClose: () => void;
  onImportSuccess: (newState: DatabaseState, targetMonth?: number) => void;
  currentDb?: DatabaseState;
  backupInfo?: DatabaseBackup | null;
  onUndoImport?: () => void;
}

export const ImportCsvModal: React.FC<ImportCsvModalProps> = ({
  onClose,
  onImportSuccess,
  currentDb,
  backupInfo,
  onUndoImport,
}) => {
  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [inputTab, setInputTab] = useState<'upload' | 'paste'>('upload');

  // Sheet state for Excel files
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  // Settings
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [autoSyncLeaves, setAutoSyncLeaves] = useState<boolean>(true);

  // Parse state & results
  const [error, setError] = useState<string | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedRosterResult | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showAllBalanceChanges, setShowAllBalanceChanges] = useState<boolean>(false);

  // Hidden file input refs for generic, Excel-specific, and CSV-specific pickers
  const fileInputGenericRef = useRef<HTMLInputElement>(null);
  const fileInputExcelRef = useRef<HTMLInputElement>(null);
  const fileInputCsvRef = useRef<HTMLInputElement>(null);

  // Process file buffer or raw text
  const processData = (
    data: ArrayBuffer | string,
    sheetName?: string,
    mode = importMode,
    sync = autoSyncLeaves,
    fName = file?.name
  ) => {
    try {
      setError(null);
      const res = parseRosterData({
        fileData: data,
        fileName: fName,
        selectedSheetName: sheetName,
        baseDb: mode === 'merge' ? currentDb : undefined,
        mergeMode: mode === 'merge',
        autoSyncLeaves: sync,
      });

      setParsedResult(res);
      setAvailableSheets(res.sheetNames);
      setSelectedSheet(res.activeSheet);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse file. Please verify columns and date headers.');
      setParsedResult(null);
    }
  };

  const handleFileChange = (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setParsedResult(null);

    const isCsv = selectedFile.name.toLowerCase().endsWith('.csv');

    if (isCsv) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          setCsvText(text);
          processData(text, undefined, importMode, autoSyncLeaves, selectedFile.name);
        }
      };
      reader.readAsText(selectedFile);
    } else {
      // Excel (.xlsx, .xls)
      const reader = new FileReader();
      reader.onload = (e) => {
        const buf = e.target?.result as ArrayBuffer;
        if (buf) {
          setFileBuffer(buf);
          processData(buf, undefined, importMode, autoSyncLeaves, selectedFile.name);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileChange(droppedFile);
    }
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (fileBuffer) {
      processData(fileBuffer, sheetName, importMode, autoSyncLeaves, file?.name);
    } else if (csvText) {
      processData(csvText, sheetName, importMode, autoSyncLeaves, file?.name);
    }
  };

  const handleModeChange = (mode: 'merge' | 'overwrite') => {
    setImportMode(mode);
    if (fileBuffer) {
      processData(fileBuffer, selectedSheet, mode, autoSyncLeaves, file?.name);
    } else if (csvText) {
      processData(csvText, selectedSheet, mode, autoSyncLeaves, file?.name);
    }
  };

  const handleSyncToggle = (sync: boolean) => {
    setAutoSyncLeaves(sync);
    if (fileBuffer) {
      processData(fileBuffer, selectedSheet, importMode, sync, file?.name);
    } else if (csvText) {
      processData(csvText, selectedSheet, importMode, sync, file?.name);
    }
  };

  const handleApply = () => {
    if (!parsedResult) return;
    try {
      let targetMonth: number | undefined;
      if (parsedResult.dateKeys.length > 0) {
        const m = parseInt(parsedResult.dateKeys[0].split('-')[1], 10);
        if (!isNaN(m) && m >= 1 && m <= 12) targetMonth = m;
      }
      onImportSuccess(parsedResult.newState, targetMonth);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save imported roster into database.');
    }
  };

  const isExcel =
    file?.name?.toLowerCase().endsWith('.xlsx') || file?.name?.toLowerCase().endsWith('.xls');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      {/* Hidden File Inputs */}
      <input
        ref={fileInputGenericRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileChange(f);
        }}
        className="hidden"
      />
      <input
        ref={fileInputExcelRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileChange(f);
        }}
        className="hidden"
      />
      <input
        ref={fileInputCsvRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileChange(f);
        }}
        className="hidden"
      />

      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 my-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Import &amp; Synchronize Roster (Excel / CSV)
                </h2>
                <p className="text-xs text-slate-500">
                  Upload Excel (.xlsx, .xls) or CSV file for any month or full year roster
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 font-bold text-lg leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Undo Previous Import Alert (If Backup Exists) */}
        {backupInfo && onUndoImport && (
          <div className="mt-3.5 p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <RotateCcw className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <span className="font-bold">Undo Available:</span> A backup snapshot taken before your
                last import at <strong className="font-mono">{backupInfo.formattedTime}</strong> is saved.
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onUndoImport();
                onClose();
              }}
              className="px-3 py-1.5 font-bold text-xs bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg shadow-2xs transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo Last Import</span>
            </button>
          </div>
        )}

        <div className="mt-4 space-y-4 text-xs">
          {/* Method selector tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInputTab('upload')}
                className={`px-3 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  inputTab === 'upload'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload File (Excel / CSV)
              </button>
              <button
                type="button"
                onClick={() => setInputTab('paste')}
                className={`px-3 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  inputTab === 'paste'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Paste Raw CSV Text
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px]">
                .XLSX
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold text-[10px]">
                .XLS
              </span>
              <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 font-mono font-bold text-[10px]">
                .CSV
              </span>
            </div>
          </div>

          {/* Upload Dropzone & Direct Select Buttons */}
          {inputTab === 'upload' ? (
            <div className="space-y-2">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputGenericRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-blue-600 bg-blue-50/80 scale-[1.01]'
                    : file
                    ? 'border-emerald-400 bg-emerald-50/40'
                    : 'border-slate-300 hover:border-blue-500 bg-slate-50/80'
                }`}
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div
                    className={`p-3 rounded-full ${
                      file ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
                    }`}
                  >
                    {file ? <Check className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                  </div>

                  <div>
                    {file ? (
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-800 text-sm flex items-center justify-center gap-1.5">
                          {isExcel ? (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <FileText className="w-4 h-4 text-sky-600" />
                          )}
                          <span>{file.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {(file.size / 1024).toFixed(1)} KB • Click or drop another file to replace
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="font-bold text-slate-800 text-sm">
                          Click to select or drag and drop your Excel or CSV file
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Supports Microsoft Excel (.xlsx, .xls) and standard CSV (.csv)
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Direct Dedicated System Pickers for 100% Compatibility */}
              <div className="flex items-center justify-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500 font-medium">Or choose format directly:</span>
                <button
                  type="button"
                  onClick={() => fileInputExcelRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Choose Excel (.xlsx / .xls)</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputCsvRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-600" />
                  <span>Choose CSV (.csv)</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <textarea
                rows={4}
                placeholder="Paste CSV text with headers (Name, EMP ID, dates...)..."
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  if (e.target.value.length > 50) {
                    processData(e.target.value, undefined, importMode, autoSyncLeaves);
                  }
                }}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>
          )}

          {/* Sheet Selector (Shown for Excel files with multiple sheets) */}
          {availableSheets.length > 1 && (
            <div className="flex items-center justify-between p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-bold text-slate-800">
                  Multiple Sheets Detected in Excel Workbook:
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 text-[11px]">Select Sheet:</span>
                <select
                  value={selectedSheet}
                  onChange={(e) => handleSheetChange(e.target.value)}
                  className="px-2.5 py-1 text-xs font-bold text-amber-900 bg-white border border-amber-300 rounded-lg shadow-2xs focus:ring-1 focus:ring-amber-500 cursor-pointer"
                >
                  {availableSheets.map((sh) => (
                    <option key={sh} value={sh}>
                      Sheet: {sh}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Sync Configuration Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Mode selection */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="block font-bold text-slate-800">
                Synchronization Strategy:
              </span>
              <div className="space-y-1.5">
                <label
                  className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    importMode === 'merge'
                      ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={() => handleModeChange('merge')}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <div className="font-bold text-xs flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      Merge &amp; Update
                      <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.2 rounded-full font-bold ml-1">
                        Recommended
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      Adds new dates &amp; updates shifts while safely preserving all other months.
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                    importMode === 'overwrite'
                      ? 'border-blue-500 bg-blue-50 text-blue-900 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="importMode"
                    value="overwrite"
                    checked={importMode === 'overwrite'}
                    onChange={() => handleModeChange('overwrite')}
                    className="mt-0.5 text-blue-600"
                  />
                  <div>
                    <div className="font-bold text-xs flex items-center gap-1">
                      <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
                      Full Replace
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      Replaces all database records with only dates in this sheet.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Leave balance synchronization option */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 flex flex-col justify-between">
              <div>
                <span className="block font-bold text-slate-800">
                  Leave Balance Auto-Sync:
                </span>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Automatically syncs leave balances when leaves (PL, SL, CL, CO, PH) are logged in the file.
                </p>
              </div>

              <label className="flex items-start gap-2 p-2 rounded-lg border border-emerald-300 bg-emerald-50/70 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoSyncLeaves}
                  onChange={(e) => handleSyncToggle(e.target.checked)}
                  className="mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <div>
                  <div className="font-bold text-xs text-emerald-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Auto-reconcile leave quotas
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-tight mt-0.5">
                    Leaves taken in the uploaded file directly deduct from each employee's remaining quota.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Rich Preview Card */}
          {parsedResult && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-300 rounded-xl text-emerald-950 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2.5">
                <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Validation Passed &amp; Ready to Synchronize</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[10px] font-bold">
                  {parsedResult.totalShiftsUpdated} schedule cells detected
                </span>
              </div>

              {/* Grid of detected metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                <div className="p-2 bg-white/80 rounded-lg border border-emerald-200">
                  <div className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-emerald-600" />
                    <span>Months Detected</span>
                  </div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {parsedResult.detectedMonths.join(', ') || 'Current Year'}
                  </div>
                </div>

                <div className="p-2 bg-white/80 rounded-lg border border-emerald-200">
                  <div className="text-slate-500 flex items-center gap-1">
                    <Users className="w-3 h-3 text-emerald-600" />
                    <span>Team Members</span>
                  </div>
                  <div className="font-bold text-slate-800 mt-0.5">
                    {parsedResult.employeeCount} Resources
                  </div>
                </div>

                <div className="p-2 bg-white/80 rounded-lg border border-emerald-200 col-span-2 sm:col-span-1">
                  <div className="text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-emerald-600" />
                    <span>Date Span</span>
                  </div>
                  <div
                    className="font-bold text-slate-800 mt-0.5 truncate"
                    title={parsedResult.dateRangeText}
                  >
                    {parsedResult.dateRangeText}
                  </div>
                </div>
              </div>

              {/* Detected Leaves Breakdown */}
              {Object.keys(parsedResult.leavesDetectedSummary).length > 0 && (
                <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200">
                  <div className="font-bold text-[11px] text-emerald-900 mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-600" />
                    <span>Leaves Recognized Across Schedules:</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {Object.entries(parsedResult.leavesDetectedSummary).map(([code, count]) => {
                      if (count === 0) return null;
                      return (
                        <span
                          key={code}
                          className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200"
                        >
                          {code}: <strong className="text-blue-700">{count}</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Leave Quota Changes Preview */}
              {parsedResult.leaveBalanceChanges.length > 0 && (
                <div className="p-2.5 bg-white/90 rounded-lg border border-emerald-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="font-bold text-[11px] text-emerald-900 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      <span>
                        Leave Quota Recalculation Preview ({parsedResult.leaveBalanceChanges.length}{' '}
                        updates):
                      </span>
                    </div>
                    {parsedResult.leaveBalanceChanges.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowAllBalanceChanges(!showAllBalanceChanges)}
                        className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        {showAllBalanceChanges
                          ? 'Show Less'
                          : `View All (${parsedResult.leaveBalanceChanges.length})`}
                      </button>
                    )}
                  </div>

                  <div className="space-y-1">
                    {(showAllBalanceChanges
                      ? parsedResult.leaveBalanceChanges
                      : parsedResult.leaveBalanceChanges.slice(0, 3)
                    ).map((c, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-[11px] px-2 py-1 bg-emerald-50/50 rounded border border-emerald-100"
                      >
                        <span className="font-semibold text-slate-800">{c.name}</span>
                        <div className="flex items-center gap-2 font-mono text-[10px]">
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                            +{c.count} {c.leaveType}
                          </span>
                          <span className="text-slate-500 flex items-center gap-1">
                            Balance: <s>{c.prevBalance}</s>
                            <ArrowRight className="w-3 h-3 text-emerald-600" />
                            <strong className="text-emerald-700">{c.newBalance}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] text-slate-500">
              <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Saves securely to local database; automatic undo snapshot is recorded.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={!parsedResult}
                className="px-5 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:hover:bg-blue-600 rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Sync &amp; Update Database</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
