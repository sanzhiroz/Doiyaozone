import { FileSpreadsheet, Download, Activity, Building2, UserCheck, Calendar, ShieldCheck, Clock, FileCheck2, Printer, LogOut, ClipboardCheck } from 'lucide-react';
import { MedicalLogEntry, DEFAULT_DOCTOR_NAME, getWorkSlotHours } from '../types';
import { RegisteredUser } from '../types/auth';
import { calculateTotalPatients } from '../utils/storage';

interface HeaderProps {
  records: MedicalLogEntry[];
  activeTab: 'sheet' | 'hours' | 'pdf' | 'attendance' | 'charts' | 'cards';
  setActiveTab: (tab: 'sheet' | 'hours' | 'pdf' | 'attendance' | 'charts' | 'cards') => void;
  onOpenAddModal: () => void;
  onExportCSV: () => void;
  onCopyTSV: () => void;
  onBackupJSON: () => void;
  currentUser?: RegisteredUser | null;
  onLogout?: () => void;
}


export const Header: React.FC<HeaderProps> = ({
  records,
  activeTab,
  setActiveTab,
  onOpenAddModal,
  onExportCSV,
  onCopyTSV,
  onBackupJSON,
  currentUser,
  onLogout,
}) => {
  const totalPatients = records.reduce((sum, r) => sum + calculateTotalPatients(r.report), 0);
  const totalDoctorHours = records.reduce((sum, r) => sum + getWorkSlotHours(r.workTime), 0);
  const activeWorkDays = records.filter(r => r.workTime !== 'แพทย์ลา').length;
  const leaveDays = records.filter(r => r.workTime === 'แพทย์ลา').length;

  return (
    <header className="no-print bg-white border-b border-sky-100 shadow-xs">
      {/* Top Banner with Provincial / Organization Identity */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-sky-900 text-white px-4 sm:px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-5 shrink-0 min-w-0">
            {/* PAO Chiang Mai Official Seal Logo (Enlarged, transparent background, stationary) */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-26 md:h-26 shrink-0 flex items-center justify-center">
              <img
                src="/assets/aistudio/th-11134207-7rask-m3xoxbry1ynva1__1__89990021.jpg"
                alt="ตราประจำองค์การบริหารส่วนจังหวัดเชียงใหม่"
                className="w-full h-full object-contain rounded-full transition-transform duration-300 drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:scale-105"
                style={{
                  clipPath: 'circle(49.2% at 50% 50%)',
                }}
              />
            </div>

            <div className="shrink-0 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold tracking-wide bg-sky-500/25 text-sky-200 px-2.5 py-0.5 rounded border border-sky-400/30">
                  Node ดอยยาว
                </span>
                <span className="text-xs text-sky-200/90 font-light whitespace-nowrap">
                  ในสังกัด องค์การบริหารส่วนจังหวัดเชียงใหม่
                </span>
              </div>
              <h1 className="text-base sm:text-xl lg:text-2xl font-black tracking-tight text-white mt-0.5 whitespace-nowrap">
                บันทึกการปฏิบัติงานของแพทย์ Node ดอยยาว
              </h1>
              <p className="text-xs sm:text-sm text-sky-100/90 font-sans tracking-wide whitespace-nowrap">
                Medical Practice Log – Doi Yao
              </p>
            </div>
          </div>

          {/* Current Doctor Badge, User Unit Badge & Actions */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            {/* Logged in User Badge (Enlarged per user request) */}
            {currentUser && (
              <div className="bg-sky-950/80 backdrop-blur-md border border-sky-400/40 px-4 sm:px-5 py-2.5 sm:py-3 rounded-2xl flex items-center gap-3.5 text-sky-100 shadow-md ring-1 ring-white/10">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0 border border-sky-300/40 text-white shadow-xs">
                  <Building2 className="w-5 h-5 text-sky-100" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-extrabold text-sky-300 text-sm sm:text-base tracking-wide">
                      {currentUser.serviceUnitCode}
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-white">
                      {currentUser.serviceUnitName}
                    </span>
                  </div>
                  <div className="text-xs text-sky-200/90 font-medium mt-0.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>สถานบริการเครือข่าย Node ดอยยาว (ซิงค์ข้อมูลรวมทุกแห่ง Real-time)</span>
                  </div>
                </div>

                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="ml-2 px-3 py-2 rounded-xl bg-white/15 hover:bg-rose-600 text-sky-100 hover:text-white transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs active:scale-95 group"
                    title="ออกจากระบบ"
                  >
                    <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    <span className="hidden sm:inline">ออกจากระบบ</span>
                  </button>
                )}
              </div>
            )}

            <div className="bg-white/10 backdrop-blur-xs border border-white/15 px-3.5 py-2.5 rounded-xl flex items-center gap-2.5 text-xs text-sky-100">
              <UserCheck className="w-4 h-4 text-sky-300" />
              <div>
                <div className="text-[11px] text-sky-300 font-medium">แพทย์ประจำ Node:</div>
                <div className="font-semibold text-white text-xs sm:text-sm">{DEFAULT_DOCTOR_NAME}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Summary strip */}
      <div className="bg-sky-50/70 border-b border-sky-100 px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-5 sm:gap-8">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-700" />
              <span>ชั่วโมงปฏิบัติงานแพทย์รวม:</span>
              <strong className="text-sm font-bold text-blue-900 tabular-nums">
                {totalDoctorHours.toFixed(1)}
              </strong>
              <span className="text-slate-500">ชม.</span>
            </div>

            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-700" />
              <span>ผู้รับบริการสะสม:</span>
              <strong className="text-sm font-bold text-blue-900 tabular-nums">
                {totalPatients.toLocaleString()}
              </strong>
              <span className="text-slate-500">ราย</span>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>วันปฏิบัติงานจริง:</span>
              <strong className="text-sm font-bold text-sky-900 tabular-nums">{activeWorkDays}</strong>
              <span className="text-slate-500">วัน</span>
              {leaveDays > 0 && (
                <span className="text-amber-800 bg-amber-100/70 px-1.5 py-0.5 rounded text-[11px]">
                  (แพทย์ลา {leaveDays} วัน)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-800" />
              <span>พื้นที่บริการ:</span>
              <span className="font-medium text-slate-700">4 รพ.สต.</span>
            </div>
          </div>

          {/* Quick Export Actions & Backup */}
          <div className="flex items-center gap-2">
            <button
              onClick={onExportCSV}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors shadow-2xs cursor-pointer"
              title="ดาวน์โหลดไฟล์ CSV (เปิดได้ทั้ง Google Sheets และ Excel รองรับภาษาไทย)"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>ส่งออก CSV</span>
            </button>
            <button
              onClick={onBackupJSON}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-md transition-colors shadow-2xs cursor-pointer"
              title="ดาวน์โหลดไฟล์สำรองข้อมูล (JSON) สำหรับจัดเก็บไว้ในคอมพิวเตอร์อย่างถาวร"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>สำรองข้อมูลถาวร</span>
            </button>
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium text-blue-900 bg-blue-100/60 rounded border border-blue-200/60" title="ระบบจัดเก็บข้อมูลแบบถาวร">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>บันทึกถาวร</span>
            </div>
          </div>
        </div>
      </div>

      {/* Colorful Main Tabs Navigation Strip */}
      <div className="bg-gradient-to-r from-sky-50/90 via-blue-50/50 to-indigo-50/80 border-b border-sky-200/80 px-4 sm:px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <nav className="flex flex-wrap items-center gap-2 sm:gap-2.5 py-0.5" aria-label="Tabs">
            {/* Tab 1: หน้าแรก (Blue theme) */}
            <button
              onClick={() => setActiveTab('sheet')}
              className={`flex items-center gap-2 py-2 px-3.5 sm:px-4 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                activeTab === 'sheet'
                  ? 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white shadow-sm shadow-blue-600/30 ring-2 ring-blue-500/40 scale-102'
                  : 'bg-white hover:bg-blue-50 text-blue-900 border-2 border-blue-200/80 hover:border-blue-300'
              }`}
            >
              <FileSpreadsheet
                className={`w-4 h-4 ${activeTab === 'sheet' ? 'text-white' : 'text-blue-700'}`}
              />
              <span>หน้าแรก</span>
            </button>

            {/* Tab 2: สรุปชั่วโมงแพทย์ (Emerald theme) */}
            <button
              onClick={() => setActiveTab('hours')}
              className={`flex items-center gap-2 py-2 px-3.5 sm:px-4 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                activeTab === 'hours'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-600/30 ring-2 ring-emerald-500/40 scale-102'
                  : 'bg-white hover:bg-emerald-50 text-emerald-950 border-2 border-emerald-200/80 hover:border-emerald-300'
              }`}
            >
              <Clock
                className={`w-4 h-4 ${activeTab === 'hours' ? 'text-white' : 'text-emerald-700'}`}
              />
              <span>สรุปชั่วโมงแพทย์ (รายเดือน/รายวัน)</span>
              <span
                className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-full ${
                  activeTab === 'hours'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}
              >
                {totalDoctorHours.toFixed(1)} ชม.
              </span>
            </button>

            {/* Tab 3: รายงานผลการปฏิบัติงาน (Rose theme - 2 lines text) */}
            <button
              onClick={() => setActiveTab('pdf')}
              className={`flex items-center gap-2 py-1.5 px-3.5 sm:px-4 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer shadow-2xs ${
                activeTab === 'pdf'
                  ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-sm shadow-rose-600/30 ring-2 ring-rose-500/40 scale-102'
                  : 'bg-white hover:bg-rose-50 text-rose-950 border-2 border-rose-200/80 hover:border-rose-300'
              }`}
            >
              <FileCheck2
                className={`w-4 h-4 shrink-0 ${activeTab === 'pdf' ? 'text-white' : 'text-rose-700'}`}
              />
              <span className="flex flex-col text-left leading-tight">
                <span>รายงานผล</span>
                <span>การปฏิบัติงาน</span>
              </span>
            </button>

            {/* Tab 4: ใบลงชื่อปฏิบัติงาน (Teal theme - 2-Page A4 Official Report) */}
            <button
              onClick={() => setActiveTab('attendance')}
              className={`flex items-center gap-2 py-2 px-3.5 sm:px-4 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                activeTab === 'attendance'
                  ? 'bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 text-white shadow-sm shadow-teal-600/30 ring-2 ring-teal-500/40 scale-102'
                  : 'bg-white hover:bg-teal-50 text-teal-950 border-2 border-teal-200/80 hover:border-teal-300'
              }`}
            >
              <ClipboardCheck
                className={`w-4 h-4 ${activeTab === 'attendance' ? 'text-white' : 'text-teal-700'}`}
              />
              <span>ใบลงชื่อปฏิบัติงาน</span>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                  activeTab === 'attendance'
                    ? 'bg-white/20 text-white'
                    : 'bg-teal-100 text-teal-800 border border-teal-200'
                }`}
              >
                ๒ หน้า A4
              </span>
            </button>

            {/* Tab 4: สรุปข้อมูลและกราฟ (Purple theme) */}
            <button
              onClick={() => setActiveTab('charts')}
              className={`flex items-center gap-2 py-2 px-3.5 sm:px-4 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                activeTab === 'charts'
                  ? 'bg-gradient-to-r from-purple-600 to-violet-600 text-white shadow-sm shadow-purple-600/30 ring-2 ring-purple-500/40 scale-102'
                  : 'bg-white hover:bg-purple-50 text-purple-950 border-2 border-purple-200/80 hover:border-purple-300'
              }`}
            >
              <Activity
                className={`w-4 h-4 ${activeTab === 'charts' ? 'text-white' : 'text-purple-700'}`}
              />
              <span>สรุปข้อมูลและกราฟ (Analytics)</span>
            </button>

            {/* Tab 5: ประวัติบันทึกรายวัน (Amber theme) */}
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex items-center gap-2 py-2 px-3.5 sm:px-4 text-xs sm:text-sm font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
                activeTab === 'cards'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm shadow-amber-500/30 ring-2 ring-amber-500/40 scale-102'
                  : 'bg-white hover:bg-amber-50 text-amber-950 border-2 border-amber-200/80 hover:border-amber-300'
              }`}
            >
              <Calendar
                className={`w-4 h-4 ${activeTab === 'cards' ? 'text-white' : 'text-amber-700'}`}
              />
              <span>ประวัติบันทึกรายวัน</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
