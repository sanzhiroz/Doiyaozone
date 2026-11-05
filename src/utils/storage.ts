import { MedicalLogEntry, getServiceUnitForHospital } from '../types';

const STORAGE_KEY = 'doi_yao_medical_practice_logs_v1';
const BACKUP_KEY = 'doi_yao_medical_practice_logs_backup_permanent';

export function enrichMedicalRecord(raw: MedicalLogEntry): MedicalLogEntry {
  const unit = getServiceUnitForHospital(raw.hospital);
  const nowIso = new Date().toISOString();
  return {
    ...raw,
    id: String(raw.id || `log-${Date.now()}`),
    date: String(raw.date || nowIso.slice(0, 10)),
    doctorName: String(raw.doctorName || 'นายแพทย์เกรียงยุทธ วรศีตกาลกุล'),
    hospital: String(raw.hospital || 'รพ.สต.บ้านดอยยาว'),
    workTime: String(raw.workTime || '08.30 – 16.30 น.'),
    serviceUnitCode: unit.code,
    serviceUnitName: unit.name,
    report: {
      generalPractice: Number(raw.report?.generalPractice) || 0,
      chronicCare: Number(raw.report?.chronicCare) || 0,
      homeVisit: Number(raw.report?.homeVisit) || 0,
      medicalCert: Number(raw.report?.medicalCert) || 0,
      specialProcedure: Number(raw.report?.specialProcedure) || 0,
    },
    reporter: {
      prefix: String(raw.reporter?.prefix || 'นาย'),
      firstName: String(raw.reporter?.firstName || ''),
      lastName: String(raw.reporter?.lastName || ''),
      position: String(raw.reporter?.position || ''),
      level: String(raw.reporter?.level || 'ไม่มี'),
    },
    notes: raw.notes ? String(raw.notes) : '',
    createdAt: raw.createdAt || nowIso,
    updatedAt: raw.updatedAt || raw.createdAt || nowIso,
  };
}

export function sortMedicalRecords(records: MedicalLogEntry[]): MedicalLogEntry[] {
  return [...records].sort((a, b) => {
    const dCmp = (b.date || '').localeCompare(a.date || '');
    if (dCmp !== 0) return dCmp;
    return (b.updatedAt || '').localeCompare(a.updatedAt || '');
  });
}

/**
 * Additively merges two lists of MedicalLogEntry by ID, keeping the newest updatedAt.
 * Never resets or drops records unless an ID is in deletedIds.
 */
export function mergeMedicalRecords(
  existingList: MedicalLogEntry[],
  incomingList: MedicalLogEntry[],
  deletedIds?: Set<string>
): MedicalLogEntry[] {
  const map = new Map<string, MedicalLogEntry>();

  for (const item of existingList) {
    if (!item || !item.id) continue;
    if (deletedIds?.has(item.id)) continue;
    map.set(item.id, enrichMedicalRecord(item));
  }

  for (const item of incomingList) {
    if (!item || !item.id) continue;
    if (deletedIds?.has(item.id)) continue;
    const enriched = enrichMedicalRecord(item);
    const current = map.get(enriched.id);
    if (!current || (enriched.updatedAt || '') >= (current.updatedAt || '')) {
      map.set(enriched.id, enriched);
    }
  }

  return sortMedicalRecords(Array.from(map.values()));
}

export function loadStoredRecords(): MedicalLogEntry[] {
  let combined: MedicalLogEntry[] = [];
  try {
    // Check primary key, backup key, and any legacy keys in localStorage to ensure all accounts/sessions combine
    const candidateKeys = new Set<string>([STORAGE_KEY, BACKUP_KEY]);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.includes('medical_practice_logs') || k.includes('doi_yao'))) {
        candidateKeys.add(k);
      }
    }

    for (const key of candidateKeys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            combined = mergeMedicalRecords(combined, parsed);
          }
        }
      } catch {
        // Ignore non-JSON or unrelated keys
      }
    }

    if (combined.length > 0) {
      const serialized = JSON.stringify(combined);
      localStorage.setItem(STORAGE_KEY, serialized);
      localStorage.setItem(BACKUP_KEY, serialized);
    }

    return combined;
  } catch (e) {
    console.error('Failed to load records from localStorage', e);
    return combined;
  }
}

export function saveRecordsToStorage(records: MedicalLogEntry[], allowEmpty = false): void {
  try {
    if (records.length === 0 && !allowEmpty) {
      // Never accidentally overwrite existing stored records with an empty list
      return;
    }
    const sorted = sortMedicalRecords(records.map(enrichMedicalRecord));
    const serialized = JSON.stringify(sorted);
    // Write to both primary storage and permanent redundant backup
    localStorage.setItem(STORAGE_KEY, serialized);
    localStorage.setItem(BACKUP_KEY, serialized);
  } catch (e) {
    console.error('Failed to save records to localStorage', e);
  }
}

/**
 * Downloads a complete JSON backup file of all medical logs for permanent archive.
 */
export function downloadBackupJSON(records: MedicalLogEntry[]): void {
  const jsonStr = JSON.stringify(records, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Backup_Medical_Practice_Log_DoiYao_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export function toThaiDigits(val: number | string): string {
  const thaiDigits = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];
  return String(val).replace(/[0-9]/g, (d) => thaiDigits[parseInt(d, 10)]);
}


export function formatThaiDate(dateString: string, variant: 'short' | 'full' = 'full'): string {
  if (!dateString) return '-';
  try {
    const [yearStr, monthStr, dayStr] = dateString.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);

    const thaiYear = year + 543;
    if (variant === 'short') {
      return `${day} ${THAI_MONTHS_SHORT[month]} ${thaiYear.toString().slice(-2)}`;
    }
    return `${day} ${THAI_MONTHS_FULL[month]} พ.ศ. ${thaiYear}`;
  } catch {
    return dateString;
  }
}

export function calculateTotalPatients(report: MedicalLogEntry['report']): number {
  return (
    (Number(report.generalPractice) || 0) +
    (Number(report.chronicCare) || 0) +
    (Number(report.homeVisit) || 0) +
    (Number(report.medicalCert) || 0) +
    (Number(report.specialProcedure) || 0)
  );
}

/**
 * Generates TSV (Tab-Separated Values) to easily paste directly into Google Sheets.
 */
export function generateGoogleSheetsTSV(records: MedicalLogEntry[]): string {
  const headers = [
    'ลำดับ',
    'วันที่ปฏิบัติงาน',
    'ชื่อแพทย์',
    'รพ.สต.ที่ปฏิบัติงาน',
    'เวลาที่ปฏิบัติงาน',
    'ผู้ป่วยโรคทั่วไป (ราย)',
    'ผู้ป่วยโรคเรื้อรัง (ราย)',
    'เยี่ยมบ้านติดบ้าน/เตียง (ราย)',
    'ออกใบรับรองแพทย์ (ราย)',
    'หัตถการพิเศษ อื่นๆ (ราย)',
    'รวมผู้รับบริการทั้งหมด (ราย)',
    'ชื่อผู้รายงาน',
    'ตำแหน่ง',
    'ระดับ',
    'หมายเหตุ'
  ];

  const rows = records.map((rec, index) => {
    const total = calculateTotalPatients(rec.report);
    const reporterName = `${rec.reporter.prefix}${rec.reporter.firstName} ${rec.reporter.lastName}`.trim();
    return [
      index + 1,
      formatThaiDate(rec.date, 'full'),
      rec.doctorName,
      rec.hospital,
      rec.workTime,
      rec.report.generalPractice,
      rec.report.chronicCare,
      rec.report.homeVisit,
      rec.report.medicalCert,
      rec.report.specialProcedure,
      total,
      reporterName,
      rec.reporter.position || '-',
      rec.reporter.level || 'ไม่มี',
      (rec.notes || '-').replace(/[\r\n\t]+/g, ' ')
    ].join('\t');
  });

  return [headers.join('\t'), ...rows].join('\n');
}

/**
 * Exports data as CSV with UTF-8 BOM so Microsoft Excel & Google Sheets display Thai text perfectly.
 */
export function downloadCSV(records: MedicalLogEntry[], filename = 'Medical_Practice_Log_DoiYao.csv'): void {
  const headers = [
    'ลำดับ',
    'วันที่ (ISO)',
    'วันที่ปฏิบัติงาน (ไทย)',
    'ชื่อแพทย์',
    'รพ.สต.ที่ปฏิบัติงาน',
    'เวลาที่ปฏิบัติงาน',
    'ผู้ป่วยโรคทั่วไป (ราย)',
    'ผู้ป่วยโรคเรื้อรัง (ราย)',
    'เยี่ยมบ้านผู้ป่วยติดบ้านติดเตียง (ราย)',
    'ออกใบรับรองแพทย์ (ราย)',
    'หัตถการพิเศษอื่นๆ (ราย)',
    'รวมผู้รับบริการทั้งหมด (ราย)',
    'ชื่อผู้รายงาน',
    'ตำแหน่งผู้รายงาน',
    'ระดับ',
    'หมายเหตุ'
  ];

  const escapeCSV = (str: string | number) => {
    const stringVal = String(str ?? '');
    if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
      return `"${stringVal.replace(/"/g, '""')}"`;
    }
    return stringVal;
  };

  const csvRows = [
    headers.map(escapeCSV).join(','),
    ...records.map((rec, idx) => {
      const total = calculateTotalPatients(rec.report);
      const reporterName = `${rec.reporter.prefix}${rec.reporter.firstName} ${rec.reporter.lastName}`.trim();
      return [
        idx + 1,
        rec.date,
        formatThaiDate(rec.date, 'full'),
        rec.doctorName,
        rec.hospital,
        rec.workTime,
        rec.report.generalPractice,
        rec.report.chronicCare,
        rec.report.homeVisit,
        rec.report.medicalCert,
        rec.report.specialProcedure,
        total,
        reporterName,
        rec.reporter.position || '-',
        rec.reporter.level || 'ไม่มี',
        rec.notes || ''
      ].map(escapeCSV).join(',');
    })
  ];


  // \uFEFF is UTF-8 Byte Order Mark for Excel/Google Sheets compatibility
  const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
