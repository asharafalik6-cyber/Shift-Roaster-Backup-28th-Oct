import {
  EmployeeLeaveBalance,
  EmployeeRosterRow,
  ShiftCode,
  CellValue,
} from '../types/roster';
import { calculateEmployeeBalance, getDaysInMonth } from '../utils/rosterUtils';
import { MASTER_ROSTER_CSV } from './rawRosterCsv';

export interface DatabaseState {
  version: number;
  balances: EmployeeLeaveBalance[];
  // Mapping of empId -> dateKey ("YYYY-MM-DD" or "M/D/YYYY") -> cell value
  dailySchedules: Record<string, Record<string, string>>;
}

const DB_STORAGE_KEY = 'kaseya_noc_database_2026_master_v3';

// Parse raw CSV into DatabaseState
// Parse raw CSV into DatabaseState (optionally merging into an existing database)
export function parseRosterCsv(csvText: string, mergeIntoDb?: DatabaseState): DatabaseState {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV has insufficient rows');
  }

  const header = parseCsvLine(lines[0]);
  // Date columns start at index 19 (e.g., 1/1/2026, 11/1/2026, or 2026-11-01)
  const dateColumns: { index: number; rawDate: string; month: number; day: number; year: number }[] = [];

  for (let colIdx = 19; colIdx < header.length; colIdx++) {
    const raw = header[colIdx].trim();
    if (!raw) continue;

    if (raw.includes('/')) {
      const parts = raw.split('/');
      if (parts.length === 3) {
        const m = parseInt(parts[0], 10);
        const d = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
          dateColumns.push({
            index: colIdx,
            rawDate: raw,
            month: m,
            day: d,
            year: y,
          });
        }
      }
    } else if (raw.includes('-')) {
      const parts = raw.split('-');
      if (parts.length === 3) {
        let y = parseInt(parts[0], 10);
        let m = parseInt(parts[1], 10);
        let d = parseInt(parts[2], 10);
        if (parts[0].length === 2 && parts[2].length === 4) {
          // DD-MM-YYYY
          d = parseInt(parts[0], 10);
          m = parseInt(parts[1], 10);
          y = parseInt(parts[2], 10);
        }
        if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
          dateColumns.push({
            index: colIdx,
            rawDate: raw,
            month: m,
            day: d,
            year: y,
          });
        }
      }
    }
  }

  const balances: EmployeeLeaveBalance[] = mergeIntoDb ? [...mergeIntoDb.balances] : [];
  const dailySchedules: Record<string, Record<string, string>> = mergeIntoDb
    ? JSON.parse(JSON.stringify(mergeIntoDb.dailySchedules || {}))
    : {};

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const line = lines[rowIdx].trim();
    if (!line) continue;

    const row = parseCsvLine(line);
    const name = (row[0] || '').trim();
    const empId = (row[1] || '').trim();

    // Skip legend lines (e.g. Abbreviations, Shifts, etc.)
    if (!name || !empId || (isNaN(Number(empId)) && !['1262', '1313', '1446'].includes(empId))) {
      continue;
    }

    const plCarriedOver = parseFloat(row[2]) || 0;
    const plAccumulated = parseFloat(row[3]) || 0;
    const plConsumed = parseFloat(row[4]) || 0;
    const plBalance = parseFloat(row[5]) || 0;

    const totalSlAccumulated = parseFloat(row[6]) || 0;
    const slConsumed = parseFloat(row[7]) || 0;
    const slBalance = parseFloat(row[8]) || 0;

    const totalClAccumulated = parseFloat(row[9]) || 0;
    const clConsumed = parseFloat(row[10]) || 0;
    const clBalance = parseFloat(row[11]) || 0;

    const compOffEligible = parseFloat(row[12]) || 0;
    const compOffConsumed = parseFloat(row[13]) || 0;
    const coExpired = parseFloat(row[14]) || 0;
    const compOffBalance = parseFloat(row[15]) || 0;

    const phConsumed = parseFloat(row[16]) || 0;
    const totalLeaveTaken = parseFloat(row[17]) || 0;
    const joiningDate = (row[18] || 'N/A').trim();

    const empBalance = calculateEmployeeBalance({
      empId,
      name,
      joiningDate,
      department: 'Kaseya NOC Dedicated Team',
      plCarriedOver,
      plAccumulated,
      plConsumed,
      plBalance: isNaN(plBalance) ? (plCarriedOver + plAccumulated - plConsumed) : plBalance,
      totalSlAccumulated,
      slConsumed,
      slBalance: isNaN(slBalance) ? (totalSlAccumulated - slConsumed) : slBalance,
      totalClAccumulated,
      clConsumed,
      clBalance: isNaN(clBalance) ? (totalClAccumulated - clConsumed) : clBalance,
      compOffEligible,
      compOffConsumed,
      coExpired,
      compOffBalance: isNaN(compOffBalance) ? (compOffEligible - compOffConsumed - coExpired) : compOffBalance,
      phConsumed,
      totalLeaveTaken,
    });

    const existingIdx = balances.findIndex((b) => b.empId === empId);
    if (existingIdx >= 0) {
      balances[existingIdx] = empBalance;
    } else {
      balances.push(empBalance);
    }

    // Parse date cells and merge into employee's schedule
    const empSchedule: Record<string, string> = dailySchedules[empId] || {};
    dateColumns.forEach((dc) => {
      const cellVal = (row[dc.index] || '').trim();
      const dateKey = `${dc.year}-${String(dc.month).padStart(2, '0')}-${String(dc.day).padStart(2, '0')}`;
      if (cellVal) {
        empSchedule[dateKey] = cellVal;
      }
    });

    dailySchedules[empId] = empSchedule;
  }

  return {
    version: 3,
    balances,
    dailySchedules,
  };
}

// Helper to parse CSV line supporting quotes and commas
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Load database from LocalStorage or initialize from Master CSV
export function loadDatabase(): DatabaseState {
  try {
    const saved = localStorage.getItem(DB_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.version === 3 && parsed.balances?.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load database from localStorage', e);
  }

  const initial = parseRosterCsv(MASTER_ROSTER_CSV);
  saveDatabase(initial);
  return initial;
}

// Save database to LocalStorage
export function saveDatabase(db: DatabaseState): void {
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('Failed to persist database', e);
  }
}

const DB_BACKUP_KEY = 'kaseya_noc_database_backup_pre_import_v2';

export interface DatabaseBackup {
  state: DatabaseState;
  timestamp: number;
  formattedTime: string;
  note: string;
  employeeCount: number;
}

export function saveDatabaseBackup(db: DatabaseState, note = 'Automatic snapshot before import'): void {
  try {
    const backup: DatabaseBackup = {
      state: JSON.parse(JSON.stringify(db)),
      timestamp: Date.now(),
      formattedTime: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
      note,
      employeeCount: db.balances.length,
    };
    localStorage.setItem(DB_BACKUP_KEY, JSON.stringify(backup));
  } catch (e) {
    console.error('Failed to create database backup', e);
  }
}

export function getDatabaseBackup(): DatabaseBackup | null {
  try {
    const raw = localStorage.getItem(DB_BACKUP_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.state && parsed.state.balances) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read database backup', e);
  }
  return null;
}

export function restoreDatabaseBackup(): DatabaseState | null {
  try {
    const backup = getDatabaseBackup();
    if (backup && backup.state) {
      saveDatabase(backup.state);
      localStorage.removeItem(DB_BACKUP_KEY);
      return backup.state;
    }
  } catch (e) {
    console.error('Failed to restore database backup', e);
  }
  return null;
}

export function clearDatabaseBackup(): void {
  try {
    localStorage.removeItem(DB_BACKUP_KEY);
  } catch (e) {
    console.error('Failed to clear backup', e);
  }
}

// Reset database back to pristine master CSV
export function resetDatabase(): DatabaseState {
  localStorage.removeItem(DB_STORAGE_KEY);
  localStorage.removeItem(DB_BACKUP_KEY);
  const fresh = parseRosterCsv(MASTER_ROSTER_CSV);
  saveDatabase(fresh);
  return fresh;
}

// Extract rows for any month of 2026
export function getMonthRosterRows(
  db: DatabaseState,
  year: number,
  month: number
): EmployeeRosterRow[] {
  const daysInMonth = getDaysInMonth(year, month);

  return db.balances.map((emp) => {
    const empSchedules = db.dailySchedules[emp.empId] || {};
    const days: Record<number, CellValue> = {};

    let detectedDefaultShift: ShiftCode = '23';
    const shiftCount: Record<string, number> = {};

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const val = empSchedules[dateKey] || '';

      days[d] = val;
      if (val && !['W', 'PL', 'SL', 'CL', 'CO', 'PH', 'Paternity', 'ML', 'LWD'].includes(val)) {
        shiftCount[val] = (shiftCount[val] || 0) + 1;
      }
    }

    // Determine default shift for this employee in this month
    let maxShift = '23';
    let maxCount = 0;
    Object.entries(shiftCount).forEach(([s, cnt]) => {
      if (cnt > maxCount) {
        maxCount = cnt;
        maxShift = s;
      }
    });
    detectedDefaultShift = maxShift as ShiftCode;

    return {
      empId: emp.empId,
      name: emp.name,
      defaultShift: detectedDefaultShift,
      days,
    };
  });
}

// Export database back to master CSV format
export function exportDatabaseToCSV(db: DatabaseState, year = 2026): void {
  // Generate header for all days in year
  const headers = [
    'Name',
    'EMP ID',
    'PL Carried Over',
    'PL accumulated',
    'PL Consumed',
    'PL Balance',
    'Total SL Accumulated',
    'SL Consumed',
    'SL Balance',
    'Total CL Accumulated',
    'CL Consumed',
    'CL Balance',
    'Comp Off Eligible',
    'Comp Off consumed',
    'CO Expired',
    'Comp Off Balance',
    'PH Consumed',
    'Total Leave Taken',
    'Joining Date',
  ];

  const dateList: { key: string; header: string }[] = [];
  for (let m = 1; m <= 12; m++) {
    const days = getDaysInMonth(year, m);
    for (let d = 1; d <= days; d++) {
      dateList.push({
        key: `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        header: `${m}/${d}/${year}`,
      });
    }
  }

  const csvRows: string[] = [
    headers.concat(dateList.map((d) => d.header)).join(','),
  ];

  db.balances.forEach((b) => {
    const sched = db.dailySchedules[b.empId] || {};
    const line: string[] = [
      `"${b.name}"`,
      `"${b.empId}"`,
      String(b.plCarriedOver),
      String(b.plAccumulated),
      String(b.plConsumed),
      String(b.plBalance),
      String(b.totalSlAccumulated),
      String(b.slConsumed),
      String(b.slBalance),
      String(b.totalClAccumulated),
      String(b.clConsumed),
      String(b.clBalance),
      String(b.compOffEligible),
      String(b.compOffConsumed),
      String(b.coExpired),
      String(b.compOffBalance),
      String(b.phConsumed),
      String(b.totalLeaveTaken),
      `"${b.joiningDate}"`,
    ];

    dateList.forEach((d) => {
      line.push(`"${sched[d.key] || ''}"`);
    });

    csvRows.push(line.join(','));
  });

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Kaseya_NOC_Dedicated_Team_Roster_${year}_Master_Database.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
