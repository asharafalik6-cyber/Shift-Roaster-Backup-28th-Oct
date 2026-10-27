import * as XLSX from 'xlsx';
import {
  EmployeeLeaveBalance,
  CellValue,
} from '../types/roster';
import { calculateEmployeeBalance } from './rosterUtils';
import { DatabaseState } from '../data/database';

export interface ParsedRosterResult {
  newState: DatabaseState;
  sheetNames: string[];
  activeSheet: string;
  detectedMonths: string[];
  dateRangeText: string;
  dateKeys: string[];
  employeeCount: number;
  sampleEmployees: string[];
  totalShiftsUpdated: number;
  leavesDetectedSummary: Record<string, number>;
  leaveBalanceChanges: {
    empId: string;
    name: string;
    leaveType: string;
    count: number;
    prevBalance: number;
    newBalance: number;
  }[];
}

const MONTH_NAMES_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const MONTH_DISPLAY_NAMES = [
  '',
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Infer month number (1-12) from sheet name or text (e.g. "November", "Nov 2026", "Roster_Nov")
 */
export function extractMonthFromText(text: string): number | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [key, num] of Object.entries(MONTH_NAMES_MAP)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(lower)) {
      return num;
    }
  }
  return null;
}

/**
 * Robustly parses a cell or header value into { year, month, day, dateKey }
 */
export function parseDateHeader(
  val: any,
  fallbackMonth?: number | null,
  fallbackYear = 2026
): { year: number; month: number; day: number; dateKey: string } | null {
  if (val === null || val === undefined) return null;

  // 1. If it's already a Date object (SheetJS with cellDates: true)
  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear() < 2000 ? fallbackYear : val.getFullYear();
    const m = val.getMonth() + 1;
    const d = val.getDate();
    const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    return { year: y, month: m, day: d, dateKey };
  }

  // 2. If it's a number (Excel serial date e.g. 46327 or day number 1..31)
  if (typeof val === 'number') {
    if (val >= 44000 && val <= 49000) {
      // Excel serial date code
      try {
        const parsed = XLSX.SSF.parse_date_code(val);
        if (parsed && parsed.y && parsed.m && parsed.d) {
          const y = parsed.y < 2000 ? fallbackYear : parsed.y;
          const dateKey = `${y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
          return { year: y, month: parsed.m, day: parsed.d, dateKey };
        }
      } catch (e) {
        // Fall through
      }
    } else if (val >= 1 && val <= 31 && fallbackMonth) {
      // Day number within a month-specific sheet (e.g. 1..30 in November sheet)
      const d = Math.floor(val);
      const dateKey = `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { year: fallbackYear, month: fallbackMonth, day: d, dateKey };
    }
  }

  // 3. String date parsing
  const str = String(val).trim();
  if (!str) return null;

  // Format: M/D/YYYY or MM/DD/YYYY or D/M/YYYY
  if (str.includes('/')) {
    const parts = str.split('/').map((p) => p.trim());
    if (parts.length === 3) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      let p2 = parseInt(parts[2], 10);
      if (p2 < 100) p2 += 2000;

      // Determine whether MM/DD or DD/MM
      let m = p0;
      let d = p1;
      if (p0 > 12 && p1 <= 12) {
        // DD/MM/YYYY
        d = p0;
        m = p1;
      }
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && p2 >= 2020 && p2 <= 2035) {
        const dateKey = `${p2}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        return { year: p2, month: m, day: d, dateKey };
      }
    }
  }

  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const [yStr, mStr, dStr] = str.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const d = parseInt(dStr, 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { year: y, month: m, day: d, dateKey };
    }
  }

  // Format: DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
    const [dStr, mStr, yStr] = str.split('-');
    const y = parseInt(yStr, 10);
    const m = parseInt(mStr, 10);
    const d = parseInt(dStr, 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { year: y, month: m, day: d, dateKey };
    }
  }

  // Format with text month: e.g. "01-Nov", "1-Nov", "1-Nov-2026", "Nov 1", "01-November-2026"
  const textMonthMatch = str.match(/(\d{1,2})[-/\s]+([A-Za-z]{3,9})(?:[-/\s]+(\d{2,4}))?/i) ||
                         str.match(/([A-Za-z]{3,9})[-/\s]+(\d{1,2})(?:[-/\s]+(\d{2,4}))?/i);
  if (textMonthMatch) {
    let dayStr = '';
    let monStr = '';
    let yrStr = '';

    if (isNaN(Number(textMonthMatch[1]))) {
      // Month first: "Nov 1"
      monStr = textMonthMatch[1];
      dayStr = textMonthMatch[2];
      yrStr = textMonthMatch[3];
    } else {
      // Day first: "1-Nov"
      dayStr = textMonthMatch[1];
      monStr = textMonthMatch[2];
      yrStr = textMonthMatch[3];
    }

    const monthNum = extractMonthFromText(monStr);
    const d = parseInt(dayStr, 10);
    let y = yrStr ? parseInt(yrStr, 10) : fallbackYear;
    if (y < 100) y += 2000;

    if (monthNum && d >= 1 && d <= 31) {
      const dateKey = `${y}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return { year: y, month: monthNum, day: d, dateKey };
    }
  }

  // Plain day number (1..31) if we have fallback month context
  const pureNum = parseInt(str, 10);
  if (!isNaN(pureNum) && pureNum >= 1 && pureNum <= 31 && String(pureNum) === str && fallbackMonth) {
    const dateKey = `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-${String(pureNum).padStart(2, '0')}`;
    return { year: fallbackYear, month: fallbackMonth, day: pureNum, dateKey };
  }

  return null;
}

/**
 * Synchronize leave balances from schedule records for all employees
 */
export function synchronizeLeaveBalances(
  balances: EmployeeLeaveBalance[],
  dailySchedules: Record<string, Record<string, string>>
): {
  syncedBalances: EmployeeLeaveBalance[];
  summaryChanges: {
    empId: string;
    name: string;
    leaveType: string;
    count: number;
    prevBalance: number;
    newBalance: number;
  }[];
  leaveCounts: Record<string, number>;
} {
  const summaryChanges: {
    empId: string;
    name: string;
    leaveType: string;
    count: number;
    prevBalance: number;
    newBalance: number;
  }[] = [];

  const overallLeaveCounts: Record<string, number> = {
    PL: 0,
    SL: 0,
    CL: 0,
    CO: 0,
    PH: 0,
  };

  const syncedBalances = balances.map((emp) => {
    const sched = dailySchedules[emp.empId] || {};

    let plCount = 0;
    let slCount = 0;
    let clCount = 0;
    let coCount = 0;
    let phCount = 0;

    Object.entries(sched).forEach(([dateKey, cellVal]) => {
      if (!cellVal) return;
      const v = String(cellVal).trim().toUpperCase();

      // Check for PL (Vacation / Privilege Leave)
      if (v === 'PL') {
        plCount += 1;
        overallLeaveCounts.PL = (overallLeaveCounts.PL || 0) + 1;
      } else if (v === 'PL*' || v === '0.5PL' || v === 'HD-PL' || v === 'PL(HALF)') {
        plCount += 0.5;
        overallLeaveCounts.PL = (overallLeaveCounts.PL || 0) + 0.5;
      }
      // Check for SL (Sick Leave)
      else if (v === 'SL') {
        slCount += 1;
        overallLeaveCounts.SL = (overallLeaveCounts.SL || 0) + 1;
      } else if (v === 'SL*' || v === '0.5SL' || v === 'HD-SL' || v === 'SL(HALF)') {
        slCount += 0.5;
        overallLeaveCounts.SL = (overallLeaveCounts.SL || 0) + 0.5;
      }
      // Check for CL (Casual Leave)
      else if (v === 'CL') {
        clCount += 1;
        overallLeaveCounts.CL = (overallLeaveCounts.CL || 0) + 1;
      } else if (v === 'CL*' || v === '0.5CL' || v === 'HD-CL' || v === 'CL(HALF)') {
        clCount += 0.5;
        overallLeaveCounts.CL = (overallLeaveCounts.CL || 0) + 0.5;
      }
      // Check for CO (Comp Off)
      else if (v === 'CO') {
        coCount += 1;
        overallLeaveCounts.CO = (overallLeaveCounts.CO || 0) + 1;
      } else if (v === 'CO*' || v === '0.5CO' || v === 'HD-CO' || v === 'CO(HALF)') {
        coCount += 0.5;
        overallLeaveCounts.CO = (overallLeaveCounts.CO || 0) + 0.5;
      }
      // Check for PH (Public Holiday)
      else if (v === 'PH') {
        phCount += 1;
        overallLeaveCounts.PH = (overallLeaveCounts.PH || 0) + 1;
      }
    });

    // Track differences for reporting
    if (plCount !== emp.plConsumed) {
      const prevBal = emp.plBalance;
      const newBal = (emp.plCarriedOver + emp.plAccumulated) - plCount;
      summaryChanges.push({
        empId: emp.empId,
        name: emp.name,
        leaveType: 'PL',
        count: plCount,
        prevBalance: prevBal,
        newBalance: Number(newBal.toFixed(1)),
      });
    }

    if (slCount !== emp.slConsumed) {
      const prevBal = emp.slBalance;
      const newBal = emp.totalSlAccumulated - slCount;
      summaryChanges.push({
        empId: emp.empId,
        name: emp.name,
        leaveType: 'SL',
        count: slCount,
        prevBalance: prevBal,
        newBalance: Number(newBal.toFixed(1)),
      });
    }

    if (clCount !== emp.clConsumed) {
      const prevBal = emp.clBalance;
      const newBal = emp.totalClAccumulated - clCount;
      summaryChanges.push({
        empId: emp.empId,
        name: emp.name,
        leaveType: 'CL',
        count: clCount,
        prevBalance: prevBal,
        newBalance: Number(newBal.toFixed(1)),
      });
    }

    if (coCount !== emp.compOffConsumed) {
      const prevBal = emp.compOffBalance;
      const newBal = emp.compOffEligible - coCount - emp.coExpired;
      summaryChanges.push({
        empId: emp.empId,
        name: emp.name,
        leaveType: 'CO',
        count: coCount,
        prevBalance: prevBal,
        newBalance: Number(newBal.toFixed(1)),
      });
    }

    // Build recomputed balance
    return calculateEmployeeBalance({
      ...emp,
      plConsumed: plCount,
      slConsumed: slCount,
      clConsumed: clCount,
      compOffConsumed: coCount,
      phConsumed: phCount,
    });
  });

  return {
    syncedBalances,
    summaryChanges,
    leaveCounts: overallLeaveCounts,
  };
}

/**
 * Universal Parser: Parses either raw CSV string or an Excel binary/buffer.
 */
export function parseRosterData({
  fileData, // string (CSV) or ArrayBuffer / Uint8Array (Excel)
  fileName,
  selectedSheetName,
  baseDb,
  mergeMode = true,
  autoSyncLeaves = true,
}: {
  fileData: string | ArrayBuffer | Uint8Array;
  fileName?: string;
  selectedSheetName?: string;
  baseDb?: DatabaseState;
  mergeMode?: boolean;
  autoSyncLeaves?: boolean;
}): ParsedRosterResult {
  let workbook: XLSX.WorkBook;

  if (typeof fileData === 'string') {
    // CSV Text
    workbook = XLSX.read(fileData, {
      type: 'string',
      cellDates: true,
      raw: false,
    });
  } else {
    // ArrayBuffer / Uint8Array for .xlsx / .xls
    workbook = XLSX.read(fileData, {
      type: 'array',
      cellDates: true,
      raw: false,
    });
  }

  const sheetNames = workbook.SheetNames || [];
  if (sheetNames.length === 0) {
    throw new Error('Spreadsheet has no readable sheets.');
  }

  // Select target sheet: explicit user selection, or sheet matching any month name, or first sheet
  let targetSheetName = selectedSheetName || sheetNames[0];
  if (!selectedSheetName) {
    const monthSheet = sheetNames.find((s) => extractMonthFromText(s) !== null);
    if (monthSheet) targetSheetName = monthSheet;
  }

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error(`Sheet "${targetSheetName}" not found in workbook.`);
  }

  // Convert sheet to 2D array of rows
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
  });

  if (rawRows.length < 2) {
    throw new Error(`Sheet "${targetSheetName}" does not contain sufficient rows.`);
  }

  // Detect month from sheet name if available
  const sheetMonth = extractMonthFromText(targetSheetName);

  // Locate Header Row: Find the row that contains 'EMP ID' or 'ID' or 'Name' or multiple date patterns
  let headerRowIndex = 0;
  for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
    const row = rawRows[r] || [];
    const textRow = row.map((c) => String(c || '').toLowerCase().trim());
    if (
      textRow.some((c) => c.includes('emp id') || c === 'id' || c.includes('employee id')) ||
      (textRow.some((c) => c.includes('name')) && textRow.some((c) => parseDateHeader(c, sheetMonth)))
    ) {
      headerRowIndex = r;
      break;
    }
  }

  const headerRow = rawRows[headerRowIndex] || [];

  // Identify EMP ID and Name column indexes
  let empIdColIdx = -1;
  let nameColIdx = -1;

  headerRow.forEach((cell, idx) => {
    const txt = String(cell || '').trim().toLowerCase();
    if (txt === 'emp id' || txt === 'employee id' || txt === 'empid' || txt === 'id') {
      empIdColIdx = idx;
    } else if (txt === 'name' || txt === 'resource name' || txt === 'employee name' || txt === 'resource') {
      nameColIdx = idx;
    }
  });

  // Fallbacks if not detected by header text: default standard master roster index
  if (nameColIdx === -1) nameColIdx = 0;
  if (empIdColIdx === -1) empIdColIdx = 1;

  // Detect Date Columns
  interface ColDateMeta {
    colIdx: number;
    year: number;
    month: number;
    day: number;
    dateKey: string;
  }
  const dateColumns: ColDateMeta[] = [];
  const detectedMonthsSet = new Set<string>();

  for (let c = 0; c < headerRow.length; c++) {
    // Skip name and empId columns
    if (c === nameColIdx || c === empIdColIdx) continue;

    // Check header cell for date
    let parsedDate = parseDateHeader(headerRow[c], sheetMonth);

    // If not in header row, check the row immediately above or below (often row 1 is month and row 2 is days)
    if (!parsedDate && headerRowIndex > 0) {
      parsedDate = parseDateHeader(rawRows[headerRowIndex - 1]?.[c], sheetMonth);
    }
    if (!parsedDate && rawRows[headerRowIndex + 1]) {
      // Sometimes row 0 is banner, row 1 is headers, or row 1 is dates
      parsedDate = parseDateHeader(rawRows[headerRowIndex + 1]?.[c], sheetMonth);
    }

    if (parsedDate) {
      dateColumns.push({
        colIdx: c,
        ...parsedDate,
      });
      detectedMonthsSet.add(`${MONTH_DISPLAY_NAMES[parsedDate.month]} ${parsedDate.year}`);
    }
  }

  if (dateColumns.length === 0) {
    throw new Error(
      `No valid date columns recognized in sheet "${targetSheetName}". Ensure headers have dates (e.g., 11/1/2026, 01-Nov, or day numbers 1..30).`
    );
  }

  // Sort detected date keys
  dateColumns.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const uniqueDateKeys = Array.from(new Set(dateColumns.map((d) => d.dateKey))).sort();

  // Prepare database state for merging
  const balances: EmployeeLeaveBalance[] = mergeMode && baseDb ? [...baseDb.balances] : [];
  const dailySchedules: Record<string, Record<string, string>> = mergeMode && baseDb
    ? JSON.parse(JSON.stringify(baseDb.dailySchedules || {}))
    : {};

  let totalShiftsUpdated = 0;
  const sampleEmployees: string[] = [];

  // Parse employee rows starting after headerRowIndex
  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawName = String(row[nameColIdx] || '').trim();
    const rawEmpId = String(row[empIdColIdx] || '').trim();

    // Skip empty rows, footer legends, or total lines
    if (!rawName && !rawEmpId) continue;
    if (
      rawName.toLowerCase().startsWith('shift') ||
      rawName.toLowerCase().startsWith('abbreviations') ||
      rawName.toLowerCase().startsWith('legend') ||
      rawName.toLowerCase().startsWith('total')
    ) {
      continue;
    }

    // Try finding existing employee by ID or Name
    let existingEmp = balances.find((b) => b.empId === rawEmpId || (rawEmpId === '' && b.name.toLowerCase() === rawName.toLowerCase()));
    if (!existingEmp && rawName) {
      existingEmp = balances.find((b) => b.name.toLowerCase() === rawName.toLowerCase());
    }

    const effectiveEmpId = rawEmpId || existingEmp?.empId || String(1000 + balances.length);
    const effectiveName = rawName || existingEmp?.name || `Employee ${effectiveEmpId}`;

    if (sampleEmployees.length < 5 && !sampleEmployees.includes(effectiveName)) {
      sampleEmployees.push(effectiveName);
    }

    // If new employee not present in balances, initialize standard quota
    if (!existingEmp) {
      const newEmp: EmployeeLeaveBalance = calculateEmployeeBalance({
        empId: effectiveEmpId,
        name: effectiveName,
        joiningDate: '1-Jan-2026',
        department: 'Dedicated Support',
        plCarriedOver: 6,
        plAccumulated: 9,
        plConsumed: 0,
        plBalance: 15,
        totalSlAccumulated: 9,
        slConsumed: 0,
        slBalance: 9,
        totalClAccumulated: 4.5,
        clConsumed: 0,
        clBalance: 4.5,
        compOffEligible: 6,
        compOffConsumed: 0,
        coExpired: 0,
        compOffBalance: 6,
        phConsumed: 0,
        totalLeaveTaken: 0,
      });
      balances.push(newEmp);
      existingEmp = newEmp;
    }

    // Extract daily shifts/leaves for this employee
    const empSched: Record<string, string> = dailySchedules[effectiveEmpId] || {};

    dateColumns.forEach((dc) => {
      const rawVal = row[dc.colIdx];
      if (rawVal !== undefined && rawVal !== null) {
        const strVal = String(rawVal).trim();
        if (strVal) {
          empSched[dc.dateKey] = strVal;
          totalShiftsUpdated++;
        }
      }
    });

    dailySchedules[effectiveEmpId] = empSched;
  }

  // Perform automatic leave balance synchronization across the entire year
  let finalBalances = balances;
  let leaveBalanceChanges: ParsedRosterResult['leaveBalanceChanges'] = [];
  let leavesDetectedSummary: Record<string, number> = {};

  if (autoSyncLeaves) {
    const syncResult = synchronizeLeaveBalances(balances, dailySchedules);
    finalBalances = syncResult.syncedBalances;
    leaveBalanceChanges = syncResult.summaryChanges;
    leavesDetectedSummary = syncResult.leaveCounts;
  }

  const detectedMonths = Array.from(detectedMonthsSet);
  const firstDate = uniqueDateKeys[0];
  const lastDate = uniqueDateKeys[uniqueDateKeys.length - 1];
  const dateRangeText = `${firstDate} to ${lastDate} (${uniqueDateKeys.length} days)`;

  return {
    newState: {
      version: 3,
      balances: finalBalances,
      dailySchedules,
    },
    sheetNames,
    activeSheet: targetSheetName,
    detectedMonths,
    dateRangeText,
    dateKeys: uniqueDateKeys,
    employeeCount: sampleEmployees.length > 0 ? balances.length : 0,
    sampleEmployees,
    totalShiftsUpdated,
    leavesDetectedSummary,
    leaveBalanceChanges,
  };
}
