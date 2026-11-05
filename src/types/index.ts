/**
 * Data structures and constants for Medical Practice Log – Doi Yao
 * ระบบบันทึกข้อมูลการปฏิบัติงานของแพทย์ Node ดอยยาว ในสังกัด องค์การบริหารส่วนจังหวัดเชียงใหม่
 */

export interface WorkReportCounts {
  generalPractice: number;   // ตรวจวินิจฉัย รักษาโรคเบื้องต้น แก่ผู้ป่วยโรคทั่วไป และให้คําแนะนําการใช้ยา (ราย)
  chronicCare: number;       // ตรวจรักษาผู้ป่วยโรคเรื้อรัง และนัดหมายเพื่อติดตามผลการรักษาต่อเนื่อง (ราย)
  homeVisit: number;         // งานอื่นๆ ได้แก่ เยี่ยมบ้านผู้ป่วยติดบ้าน/ติดเตียง (ราย)
  medicalCert: number;       // ออกใบรับรองแพทย์ (ราย)
  specialProcedure: number;  // หัตถการพิเศษ อื่นๆ (ราย)
}

export interface ReporterInfo {
  prefix: string;    // คำนำหน้า (นาย / นาง / นางสาว)
  firstName: string; // ชื่อ
  lastName: string;  // ชื่อสกุล
  position: string;  // ตำแหน่ง
  level?: string;    // ระดับ (ปฏิบัติการ / ชำนาญการ / ปฏิบัติงาน / ชำนาญงาน / ไม่มี)
}


export interface MedicalLogEntry {
  id: string;
  date: string;               // YYYY-MM-DD
  doctorName: string;         // ชื่อแพทย์ (default: นายแพทย์เกรียงยุทธ วรศีตกาลกุล)
  hospital: string;           // รพ.สต.ที่ไปปฏิบัติงาน
  workTime: string;           // เวลาที่มาปฏิบัติงาน
  report: WorkReportCounts;   // รายงานการปฏิบัติงาน 5 ด้าน
  reporter: ReporterInfo;     // ข้อมูลผู้รายงาน
  notes?: string;             // หมายเหตุเพิ่มเติม
  serviceUnitCode?: string;   // รหัสสถานบริการ เช่น 05958, 05959, 05956, 05957
  serviceUnitName?: string;   // ชื่อสถานบริการ
  createdAt: string;          // ISO timestamp
  updatedAt: string;          // ISO timestamp
}

export const HOSPITALS = [
  'รพ.สต.บ้านดอยยาว',
  'รพ.สต.บ้านแม่ผาแหน',
  'รพ.สต.บ้านป่าตาล',
  'รพ.สต.บ้านกอสะเรียม',
] as const;

export type HospitalName = (typeof HOSPITALS)[number];

export const HOSPITAL_UNIT_CODE_MAP: Record<string, { code: string; name: string; color: string }> = {
  'รพ.สต.บ้านดอยยาว': { code: '05958', name: 'รพ.สต.บ้านดอยยาว', color: 'blue' },
  'รพ.สต.บ้านแม่ผาแหน': { code: '05959', name: 'รพ.สต.บ้านแม่ผาแหน', color: 'emerald' },
  'รพ.สต.บ้านป่าตาล': { code: '05956', name: 'รพ.สต.บ้านป่าตาล', color: 'violet' },
  'รพ.สต.บ้านกอสะเรียม': { code: '05957', name: 'รพ.สต.บ้านกอสะเรียม', color: 'amber' },
};

export function getServiceUnitForHospital(hospital: string): { code: string; name: string } {
  return HOSPITAL_UNIT_CODE_MAP[hospital] || { code: '05958', name: hospital || 'รพ.สต.บ้านดอยยาว' };
}

export const WORK_TIMES = [
  '08.30 – 12.00 น.',
  '09.00 – 12.00 น.',
  '08.30 – 16.30 น.',
  '08.30 – 16.00 น.',
  '09.00 – 16.00 น.',
  '08.30 – 15.00 น.',
  '09.00 – 15.00 น.',
  'แพทย์ลา',
] as const;

export type WorkTimeSlot = (typeof WORK_TIMES)[number];

export const DEFAULT_DOCTOR_NAME = 'นายแพทย์เกรียงยุทธ วรศีตกาลกุล';

export const COMMON_PREFIXES = [
  'นาย',
  'นาง',
  'นางสาว',
] as const;

export const POSITION_OPTIONS = [
  'นักสาธารณสุข',
  'นักวิชาการสาธารณสุข',
  'พยาบาลวิชาชีพ',
  'แพทย์แผนไทย',
  'นักกายภาพบำบัด',
  'เจ้าพนักงานสาธารณสุข',
  'เจ้าพนักงานทันตสาธารณสุข',
  'เจ้าพนักงานการเงินและบัญชี',
  'เจ้าพนักงานธุรการ',
] as const;

export type PositionOption = (typeof POSITION_OPTIONS)[number];

export const REPORTER_LEVEL_OPTIONS = [
  'ปฏิบัติการ',
  'ชำนาญการ',
  'ปฏิบัติงาน',
  'ชำนาญงาน',
  'ไม่มี',
] as const;

export type ReporterLevelOption = (typeof REPORTER_LEVEL_OPTIONS)[number];


export const WORK_TIME_HOURS_MAP: Record<WorkTimeSlot, number> = {
  '08.30 – 12.00 น.': 3.5,
  '09.00 – 12.00 น.': 3.0,
  '08.30 – 16.30 น.': 8.0,
  '08.30 – 16.00 น.': 7.5,
  '09.00 – 16.00 น.': 7.0,
  '08.30 – 15.00 น.': 6.5,
  '09.00 – 15.00 น.': 6.0,
  'แพทย์ลา': 0,
};

export function getWorkSlotHours(workTime: string): number {
  return WORK_TIME_HOURS_MAP[workTime as WorkTimeSlot] || 0;
}

export interface NotificationState {
  show: boolean;
  type: 'success' | 'warning' | 'info' | 'error';
  title: string;
  message: string;
}

export interface FacilityUnit {
  code: string;
  name: string;
  shortName: string;
  role: 'hospital' | 'cup';
  description?: string;
  defaultSecret: string;
}

export const FACILITY_UNITS: FacilityUnit[] = [
  {
    code: '05954',
    name: 'Cup สันโค้ง (ดึงรายงาน)',
    shortName: 'Cup สันโค้ง',
    role: 'cup',
    description: 'ศูนย์ประสานงานเครือข่ายบริการสุขภาพ สันโค้ง (ดึงรายงานและกำกับดูแล)',
    defaultSecret: 'JBSWY3DPEHPK3P54',
  },
  {
    code: '05956',
    name: 'รพ.สต.บ้านป่าตาล',
    shortName: 'รพ.สต.บ้านป่าตาล',
    role: 'hospital',
    defaultSecret: 'JBSWY3DPEHPK3P56',
  },
  {
    code: '05957',
    name: 'รพ.สต.บ้านกอสะเรียม',
    shortName: 'รพ.สต.บ้านกอสะเรียม',
    role: 'hospital',
    defaultSecret: 'JBSWY3DPEHPK3P57',
  },
  {
    code: '05958',
    name: 'รพ.สต.บ้านดอยยาว',
    shortName: 'รพ.สต.บ้านดอยยาว',
    role: 'hospital',
    defaultSecret: 'JBSWY3DPEHPK3P58',
  },
  {
    code: '05959',
    name: 'รพ.สต.บ้านแม่ผาแหน',
    shortName: 'รพ.สต.บ้านแม่ผาแหน',
    role: 'hospital',
    defaultSecret: 'JBSWY3DPEHPK3P59',
  },
];

export interface RegisteredUser {
  id: string;
  username: string; // รหัสสถานบริการ
  password: string; // รหัสสถานบริการ
  facilityCode: string; // 05954, 05956, 05957, 05958, 05959
  facilityName: string;
  firstName: string; // ชื่อ
  lastName: string;  // นามสกุล
  phone: string;     // เบอร์โทร
  totpSecret: string;
  createdAt: string;
}

export interface AuthSession {
  user: RegisteredUser;
  loggedInAt: string;
  facilityCode: string;
  facilityName: string;
}
