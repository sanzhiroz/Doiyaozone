import React, { useState, useMemo } from 'react';
import {
  Search,
  PlusCircle,
  FileSpreadsheet,
  Download,
  Edit2,
  Trash2,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Building2,
  Radio,
  Layers,
  Clock,
  Users,
  Calendar,
} from 'lucide-react';
import {
  MedicalLogEntry,
  HOSPITALS,
  WORK_TIMES,
  HOSPITAL_UNIT_CODE_MAP,
  getServiceUnitForHospital,
  getWorkSlotHours,
} from '../types';
import { formatThaiDate, calculateTotalPatients } from '../utils/storage';

interface GoogleSheetViewProps {
  records: MedicalLogEntry[];
  onOpenAddModal: () => void;
  onEditEntry: (entry: MedicalLogEntry) => void;
  onDeleteEntry: (entry: MedicalLogEntry) => void;
  onExportCSV: () => void;
  onCopyTSV: () => void;
  onOpenPDFReport?: () => void;
  isRealtimeConnected?: boolean;
  connectedClients?: number;
}

const UNIT_BADGE_STYLES: Record<
  string,
  {
    cardBg: string;
    cardBorder: string;
    activeRing: string;
    headerGradient: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    codeBg: string;
  }
> = {
  'รพ.สต.บ้านดอยยาว': {
    cardBg: 'from-blue-50/90 via-white to-sky-50/70',
    cardBorder: 'border-blue-200 hover:border-blue-400',
    activeRing: 'ring-2 ring-blue-600 border-blue-600 shadow-md',
    headerGradient: 'from-blue-700 via-blue-800 to-indigo-800',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-900',
    badgeBorder: 'border-blue-200',
    codeBg: 'bg-blue-700 text-white',
  },
  'รพ.สต.บ้านแม่ผาแหน': {
    cardBg: 'from-emerald-50/90 via-white to-teal-50/70',
    cardBorder: 'border-emerald-200 hover:border-emerald-400',
    activeRing: 'ring-2 ring-emerald-600 border-emerald-600 shadow-md',
    headerGradient: 'from-emerald-700 via-teal-700 to-emerald-800',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-900',
    badgeBorder: 'border-emerald-200',
    codeBg: 'bg-emerald-700 text-white',
  },
  'รพ.สต.บ้านป่าตาล': {
    cardBg: 'from-purple-50/90 via-white to-violet-50/70',
    cardBorder: 'border-purple-200 hover:border-purple-400',
    activeRing: 'ring-2 ring-purple-600 border-purple-600 shadow-md',
    headerGradient: 'from-purple-700 via-violet-700 to-indigo-800',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-900',
    badgeBorder: 'border-purple-200',
    codeBg: 'bg-purple-700 text-white',
  },
  'รพ.สต.บ้านกอสะเรียม': {
    cardBg: 'from-amber-50/90 via-white to-orange-50/70',
    cardBorder: 'border-amber-200 hover:border-amber-400',
    activeRing: 'ring-2 ring-amber-500 border-amber-500 shadow-md',
    headerGradient: 'from-amber-600 via-orange-600 to-amber-700',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-900',
    badgeBorder: 'border-amber-200',
    codeBg: 'bg-amber-600 text-white',
  },
};

export const GoogleSheetView: React.FC<GoogleSheetViewProps> = ({
  records,
  onOpenAddModal,
  onEditEntry,
  onDeleteEntry,
  onExportCSV,
  onCopyTSV,
  onOpenPDFReport,
  isRealtimeConnected = true,
  connectedClients = 1,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHospital, setSelectedHospital] = useState<string>('all');
  const [selectedWorkTime, setSelectedWorkTime] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'both' | 'combined' | 'grouped'>('both');
  const [copied, setCopied] = useState(false);

  // Per-Service-Unit Real-Time Summary (combines all accounts under each service unit)
  const serviceUnitSummaries = useMemo(() => {
    return HOSPITALS.map((hospName) => {
      const unitInfo = HOSPITAL_UNIT_CODE_MAP[hospName] || {
        code: '05958',
        name: hospName,
        color: 'blue',
      };
      const unitRecords = records.filter((r) => r.hospital === hospName);
      const activeDays = unitRecords.filter((r) => r.workTime !== 'แพทย์ลา').length;
      const leaveDays = unitRecords.filter((r) => r.workTime === 'แพทย์ลา').length;
      const totalHours = unitRecords.reduce((sum, r) => sum + getWorkSlotHours(r.workTime), 0);

      const counts = unitRecords.reduce(
        (acc, r) => {
          const gp = Number(r.report.generalPractice) || 0;
          const cc = Number(r.report.chronicCare) || 0;
          const hv = Number(r.report.homeVisit) || 0;
          const mc = Number(r.report.medicalCert) || 0;
          const sp = Number(r.report.specialProcedure) || 0;
          return {
            gp: acc.gp + gp,
            cc: acc.cc + cc,
            hv: acc.hv + hv,
            mc: acc.mc + mc,
            sp: acc.sp + sp,
            total: acc.total + gp + cc + hv + mc + sp,
          };
        },
        { gp: 0, cc: 0, hv: 0, mc: 0, sp: 0, total: 0 }
      );

      const latestRecord = unitRecords[0] || null;

      return {
        hospital: hospName,
        code: unitInfo.code,
        recordCount: unitRecords.length,
        activeDays,
        leaveDays,
        totalHours,
        counts,
        latestRecord,
        records: unitRecords,
      };
    });
  }, [records]);

  // Filtered dataset
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      const unitInfo = getServiceUnitForHospital(rec.hospital);
      const reporterFullName = `${rec.reporter.prefix}${rec.reporter.firstName} ${rec.reporter.lastName}`.toLowerCase();
      const matchesSearch =
        searchQuery === '' ||
        rec.date.includes(searchQuery) ||
        rec.hospital.toLowerCase().includes(searchQuery.toLowerCase()) ||
        unitInfo.code.includes(searchQuery) ||
        rec.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reporterFullName.includes(searchQuery.toLowerCase()) ||
        rec.reporter.position.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (rec.notes && rec.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesHospital = selectedHospital === 'all' || rec.hospital === selectedHospital;
      const matchesWorkTime = selectedWorkTime === 'all' || rec.workTime === selectedWorkTime;

      let matchesDate = true;
      if (dateFilter === 'this_month') {
        const currentMonth = new Date().toISOString().slice(0, 7);
        matchesDate = rec.date.startsWith(currentMonth);
      } else if (dateFilter === 'last_month') {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        const lastMonth = d.toISOString().slice(0, 7);
        matchesDate = rec.date.startsWith(lastMonth);
      }

      return matchesSearch && matchesHospital && matchesWorkTime && matchesDate;
    });
  }, [records, searchQuery, selectedHospital, selectedWorkTime, dateFilter]);

  // Grand totals of filtered records
  const totals = useMemo(() => {
    return filteredRecords.reduce(
      (acc, rec) => {
        const gp = Number(rec.report.generalPractice) || 0;
        const cc = Number(rec.report.chronicCare) || 0;
        const hv = Number(rec.report.homeVisit) || 0;
        const mc = Number(rec.report.medicalCert) || 0;
        const sp = Number(rec.report.specialProcedure) || 0;
        const rowTotal = gp + cc + hv + mc + sp;

        return {
          gp: acc.gp + gp,
          cc: acc.cc + cc,
          hv: acc.hv + hv,
          mc: acc.mc + mc,
          sp: acc.sp + sp,
          total: acc.total + rowTotal,
        };
      },
      { gp: 0, cc: 0, hv: 0, mc: 0, sp: 0, total: 0 }
    );
  }, [filteredRecords]);

  // Filtered records grouped by service unit for the on-page per-facility breakdown
  const groupedFilteredByUnit = useMemo(() => {
    return HOSPITALS.map((hospName) => {
      const unitInfo = HOSPITAL_UNIT_CODE_MAP[hospName] || {
        code: '05958',
        name: hospName,
        color: 'blue',
      };
      const unitRows = filteredRecords.filter((r) => r.hospital === hospName);
      const unitTotals = unitRows.reduce(
        (acc, rec) => {
          const gp = Number(rec.report.generalPractice) || 0;
          const cc = Number(rec.report.chronicCare) || 0;
          const hv = Number(rec.report.homeVisit) || 0;
          const mc = Number(rec.report.medicalCert) || 0;
          const sp = Number(rec.report.specialProcedure) || 0;
          return {
            gp: acc.gp + gp,
            cc: acc.cc + cc,
            hv: acc.hv + hv,
            mc: acc.mc + mc,
            sp: acc.sp + sp,
            total: acc.total + gp + cc + hv + mc + sp,
          };
        },
        { gp: 0, cc: 0, hv: 0, mc: 0, sp: 0, total: 0 }
      );
      const unitHours = unitRows.reduce((sum, r) => sum + getWorkSlotHours(r.workTime), 0);

      return {
        hospital: hospName,
        code: unitInfo.code,
        rows: unitRows,
        totals: unitTotals,
        unitHours,
      };
    });
  }, [filteredRecords]);

  const handleCopyQuick = () => {
    onCopyTSV();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* ===================================================================== */}
      {/* 1. REAL-TIME UNIFIED SERVICE UNIT DASHBOARD (ทุกสถานบริการรวมกันในหน้าเดียว) */}
      {/* ===================================================================== */}
      <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 rounded-2xl p-4 sm:p-5 text-white shadow-md border border-blue-800/60 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-white/15">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 text-emerald-300 animate-pulse" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
                  ข้อมูลการให้บริการของแพทย์รวมทุกแห่ง • แยกตามสถานบริการ (Real-time)
                </h2>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-500/20 text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>
                    {isRealtimeConnected ? 'เชื่อมต่อ Real-time ทุกเครื่องแล้ว' : 'โหมดบันทึกถาวรในเครื่อง'}
                    {connectedClients > 1 ? ` (${connectedClients} เครื่องออนไลน์)` : ''}
                  </span>
                </span>
              </div>
              <p className="text-xs text-sky-200/90 mt-0.5">
                ทุกบัญชีผู้ใช้งาน (ทุก Account) ถูกรวมเข้าตามรหัสสถานบริการ และแสดงข้อมูลที่บันทึกแล้วมารวมกันในหน้าเดียวแบบอัตโนมัติโดยไม่รีเซ็ตข้อมูล
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedHospital('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                selectedHospital === 'all'
                  ? 'bg-white text-blue-950 border-white shadow-xs'
                  : 'bg-white/10 text-sky-100 border-white/20 hover:bg-white/20'
              }`}
            >
              ดูรวมทุกสถานบริการ ({records.length} บันทึก)
            </button>
          </div>
        </div>

        {/* 4 Service Unit Cards (Real-time breakdown by Facility) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {serviceUnitSummaries.map((unit) => {
            const isSelected = selectedHospital === unit.hospital;
            const style = UNIT_BADGE_STYLES[unit.hospital] || UNIT_BADGE_STYLES['รพ.สต.บ้านดอยยาว'];

            return (
              <div
                key={unit.code}
                onClick={() =>
                  setSelectedHospital(isSelected ? 'all' : unit.hospital)
                }
                className={`rounded-xl p-3.5 bg-gradient-to-br ${style.cardBg} text-slate-900 border-2 transition-all cursor-pointer ${
                  isSelected ? style.activeRing : style.cardBorder
                }`}
                title="คลิกเพื่อกรองดูเฉพาะสถานบริการนี้ หรือคลิกซ้ำเพื่อดูรวมทั้งหมด"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded-md ${style.codeBg}`}
                  >
                    รหัส {unit.code}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 bg-white/90 px-2 py-0.5 rounded-full border border-slate-200">
                    {unit.recordCount} บันทึก
                  </span>
                </div>

                <h3 className="text-sm font-extrabold text-slate-900 truncate">
                  {unit.hospital}
                </h3>

                <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-slate-200/80 text-xs">
                  <div className="bg-white/80 rounded-lg p-2 border border-slate-200/70">
                    <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                      <Users className="w-3 h-3 text-blue-600" />
                      <span>ผู้รับบริการรวม</span>
                    </div>
                    <div className="text-base font-black text-slate-900 font-mono tabular-nums mt-0.5">
                      {unit.counts.total.toLocaleString()}{' '}
                      <span className="text-[10px] font-normal text-slate-500">ราย</span>
                    </div>
                  </div>

                  <div className="bg-white/80 rounded-lg p-2 border border-slate-200/70">
                    <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      <span>ปฏิบัติงานจริง</span>
                    </div>
                    <div className="text-base font-black text-slate-900 font-mono tabular-nums mt-0.5">
                      {unit.activeDays}{' '}
                      <span className="text-[10px] font-normal text-slate-500">
                        วัน ({unit.totalHours.toFixed(1)} ชม.)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] text-slate-600">
                  <span>
                    ทั่วไป <strong>{unit.counts.gp}</strong> • เรื้อรัง{' '}
                    <strong>{unit.counts.cc}</strong> • เยี่ยมบ้าน{' '}
                    <strong>{unit.counts.hv}</strong>
                  </span>
                  {unit.latestRecord && (
                    <span className="text-[10px] font-semibold text-blue-800 bg-blue-100/70 px-1.5 py-0.5 rounded">
                      ล่าสุด {formatThaiDate(unit.latestRecord.date, 'short')}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. CONTROL BAR & VIEW MODE SWITCHER                                   */}
      {/* ===================================================================== */}
      <div className="bg-white rounded-xl border border-sky-100 shadow-xs p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">
                  บันทึกการปฏิบัติงาน Node ดอยยาว (ตารางรวมทุกสถานบริการ)
                </h2>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  รวมทุกเครื่อง & ทุก Account
                </span>
              </div>
              <p className="text-xs text-slate-500">
                แสดงข้อมูลที่บันทึกจากทุกสถานบริการมารวมกันในหน้าเดียว พร้อมแยกตามสถานบริการแบบ Real-time
              </p>
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyQuick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
              title="คัดลอกข้อมูลทั้งหมด เพื่อไปกด Ctrl+V วางใน Google Sheets"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-emerald-700" />
              )}
              <span>{copied ? 'คัดลอกแล้ว!' : 'คัดลอกลง Google Sheet'}</span>
            </button>

            <button
              onClick={onExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-blue-700" />
              <span>ดาวน์โหลด CSV</span>
            </button>

            {onOpenPDFReport && (
              <button
                onClick={onOpenPDFReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                title="เปิดแบบฟอร์มสรุปรายงานผลการปฏิบัติงานประจำเดือน สำหรับพิมพ์หรือโหลดเป็น PDF"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-rose-600" />
                <span>รายงานผลการปฏิบัติงาน</span>
              </button>
            )}

            <button
              onClick={onOpenAddModal}
              className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-bold px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl text-sm sm:text-base transition-all duration-200 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-98 ring-4 ring-blue-500/20 cursor-pointer ml-auto sm:ml-0"
              title="กดเพื่อบันทึกข้อมูลการปฏิบัติงานของแพทย์"
            >
              <PlusCircle className="w-5 h-5 text-sky-200 shrink-0" />
              <span className="tracking-wide">เพิ่มข้อมูลการปฏิบัติงานแพทย์</span>
              <div className="flex items-center gap-1 shrink-0 text-sky-200">
                <ArrowRight className="w-5 h-5 animate-pulse transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </button>
          </div>
        </div>

        {/* Filter bar + View Mode Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหา วันที่, รหัส/ชื่อ รพ.สต., ผู้รายงาน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          {/* Hospital Filter */}
          <div className="relative">
            <select
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 cursor-pointer font-medium"
            >
              <option value="all">สถานบริการทั้งหมด (4 รพ.สต.)</option>
              {HOSPITALS.map((h) => {
                const code = HOSPITAL_UNIT_CODE_MAP[h]?.code || '';
                return (
                  <option key={h} value={h}>
                    {code} - {h}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Work Time Filter */}
          <div className="relative">
            <select
              value={selectedWorkTime}
              onChange={(e) => setSelectedWorkTime(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 cursor-pointer"
            >
              <option value="all">เวลาปฏิบัติงานทั้งหมด</option>
              {WORK_TIMES.map((wt) => (
                <option key={wt} value={wt}>
                  {wt}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Quick Filter */}
          <div className="flex items-center gap-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800 cursor-pointer"
            >
              <option value="all">แสดงทุกช่วงวันที่</option>
              <option value="this_month">เดือนปัจจุบัน</option>
              <option value="last_month">เดือนก่อนหน้า</option>
            </select>

            {(searchQuery ||
              selectedHospital !== 'all' ||
              selectedWorkTime !== 'all' ||
              dateFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedHospital('all');
                  setSelectedWorkTime('all');
                  setDateFilter('all');
                }}
                className="px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg shrink-0 transition-colors cursor-pointer"
                title="ล้างตัวกรอง"
              >
                ล้างกรอง
              </button>
            )}
          </div>

          {/* Layout Mode Selector */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-[11px] font-bold">
            <button
              onClick={() => setViewMode('both')}
              className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer ${
                viewMode === 'both'
                  ? 'bg-blue-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="แสดงทั้งตารางรวมและตารางแยกตามสถานบริการในหน้าเดียว"
            >
              รวม + แยก รพ.สต.
            </button>
            <button
              onClick={() => setViewMode('grouped')}
              className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-blue-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="แสดงแยกตามสถานบริการทั้ง 4 แห่งในหน้าเดียว"
            >
              แยกตาม รพ.สต.
            </button>
            <button
              onClick={() => setViewMode('combined')}
              className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer ${
                viewMode === 'combined'
                  ? 'bg-blue-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="แสดงตารางรวมเรียงตามวันที่"
            >
              ตารางรวม
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. COMBINED MASTER SPREADSHEET (ข้อมูลรวมทุกสถานบริการ)                  */}
      {/* ===================================================================== */}
      {(viewMode === 'both' || viewMode === 'combined') && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 via-blue-950 to-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-300" />
              <span className="text-xs sm:text-sm font-bold">
                ตารางรวมข้อมูลการปฏิบัติงานของแพทย์ทุกสถานบริการ (รวมทุกเครื่อง / ทุก Account)
              </span>
            </div>
            <span className="text-xs text-sky-200 font-mono">
              ทั้งหมด {filteredRecords.length} รายการ • ผู้รับบริการรวม {totals.total.toLocaleString()} ราย
            </span>
          </div>

          <div className="overflow-x-auto max-h-[600px] relative">
            <table className="w-full text-xs text-left border-collapse select-text">
              <thead className="bg-slate-100/90 text-slate-500 font-mono text-[11px] sticky top-0 z-20 border-b border-slate-200">
                <tr>
                  <th className="w-10 px-2 py-1 text-center border-r border-slate-200 bg-slate-200/70 font-semibold text-slate-600">
                    #
                  </th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">A</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">B</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">C</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">D</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">E</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">F</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">G</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">H</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">I</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">J</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">K</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">L</th>
                  <th className="px-3 py-1 text-center border-r border-slate-200">M</th>
                  <th className="px-3 py-1 text-center">N</th>
                </tr>

                <tr className="bg-blue-900 text-white font-sans text-xs">
                  <th className="w-10 px-2 py-2.5 text-center border-r border-blue-800 bg-blue-950/80 font-bold">
                    แถว
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 whitespace-nowrap font-semibold">
                    วันที่ปฏิบัติงาน
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 whitespace-nowrap font-semibold">
                    สถานบริการ (รหัส / รพ.สต.)
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 whitespace-nowrap font-semibold">
                    ชื่อแพทย์
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 whitespace-nowrap font-semibold">
                    เวลาปฏิบัติงาน
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 text-right whitespace-nowrap font-semibold">
                    4.1 ทั่วไป/ยา (ราย)
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 text-right whitespace-nowrap font-semibold">
                    4.2 โรคเรื้อรัง (ราย)
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 text-right whitespace-nowrap font-semibold">
                    4.3 เยี่ยมบ้าน (ราย)
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 text-right whitespace-nowrap font-semibold">
                    4.4 ใบรับรองแพทย์ (ราย)
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 text-right whitespace-nowrap font-semibold">
                    4.5 หัตถการ (ราย)
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 text-right whitespace-nowrap font-bold bg-blue-950/50">
                    รวมผู้ป่วย (ราย)
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 whitespace-nowrap font-semibold">
                    ชื่อผู้รายงาน
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 whitespace-nowrap font-semibold">
                    ตำแหน่ง
                  </th>
                  <th className="px-3 py-2.5 border-r border-blue-800 whitespace-nowrap font-semibold min-w-[150px]">
                    หมายเหตุ
                  </th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap font-semibold">
                    การจัดการ
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="py-14 text-center text-slate-500 bg-white">
                      {records.length === 0 ? (
                        <div className="max-w-md mx-auto space-y-3">
                          <div className="w-12 h-12 mx-auto rounded-full bg-sky-100 text-blue-700 flex items-center justify-center">
                            <FileSpreadsheet className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="text-base font-bold text-slate-900">
                              พร้อมสำหรับบันทึกข้อมูลการปฏิบัติงานแพทย์ (ซิงค์ข้อมูลรวมทุกเครื่อง)
                            </p>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                              เมื่อสถานบริการใดบันทึกข้อมูล ระบบจะนำข้อมูลจากทุกเครื่องและทุกสถานบริการมารวมกันในหน้านี้แบบ Real-time อัตโนมัติ และเก็บรักษาไว้ถาวรโดยไม่มีการรีเซ็ตข้อมูล
                            </p>
                          </div>
                          <div className="flex items-center justify-center pt-2">
                            <button
                              onClick={onOpenAddModal}
                              className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-bold px-6 py-3 rounded-xl text-sm sm:text-base transition-all duration-200 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-98 ring-4 ring-blue-500/20 cursor-pointer"
                            >
                              <PlusCircle className="w-5 h-5 text-sky-200 shrink-0" />
                              <span>เพิ่มข้อมูลการปฏิบัติงานแพทย์</span>
                              <ArrowRight className="w-5 h-5 text-sky-200 animate-pulse transition-transform duration-200 group-hover:translate-x-1 shrink-0" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-slate-800">
                            ไม่พบข้อมูลที่ตรงกับเงื่อนไขการค้นหา/ตัวกรอง
                          </p>
                          <p className="text-xs text-slate-400">
                            ลองล้างคำค้นหาหรือเปลี่ยนเงื่อนไขตัวกรอง รพ.สต.
                          </p>
                          <button
                            onClick={() => {
                              setSearchQuery('');
                              setSelectedHospital('all');
                              setSelectedWorkTime('all');
                              setDateFilter('all');
                            }}
                            className="mt-2 text-xs text-blue-700 underline cursor-pointer"
                          >
                            ล้างเงื่อนไขตัวกรองทั้งหมด
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((entry, index) => {
                    const rowTotal = calculateTotalPatients(entry.report);
                    const isLeave = entry.workTime === 'แพทย์ลา';
                    const rowNumber = index + 1;
                    const unitInfo = getServiceUnitForHospital(entry.hospital);
                    const unitStyle =
                      UNIT_BADGE_STYLES[entry.hospital] || UNIT_BADGE_STYLES['รพ.สต.บ้านดอยยาว'];

                    return (
                      <tr
                        key={entry.id}
                        className={`hover:bg-sky-50/70 transition-colors ${
                          isLeave
                            ? 'bg-amber-50/30'
                            : index % 2 === 0
                            ? 'bg-white'
                            : 'bg-slate-50/40'
                        }`}
                      >
                        <td className="px-2 py-2 text-center border-r border-slate-200 bg-slate-100/60 font-mono text-slate-500 font-medium">
                          {rowNumber}
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap font-medium text-slate-900">
                          {formatThaiDate(entry.date, 'short')}
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${unitStyle.codeBg}`}
                            >
                              {unitInfo.code}
                            </span>
                            <span className={`font-bold ${unitStyle.badgeText}`}>
                              {entry.hospital}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-slate-800">
                          {entry.doctorName}
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                          {isLeave ? (
                            <span className="font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded text-[11px]">
                              {entry.workTime}
                            </span>
                          ) : (
                            <span className="text-slate-700">{entry.workTime}</span>
                          )}
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800">
                          {entry.report.generalPractice}
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800">
                          {entry.report.chronicCare}
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800">
                          {entry.report.homeVisit}
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800">
                          {entry.report.medicalCert}
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums text-slate-800">
                          {entry.report.specialProcedure}
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums font-bold text-blue-950 bg-blue-50/40">
                          {rowTotal}
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-slate-800">
                          {entry.reporter.prefix}
                          {entry.reporter.firstName} {entry.reporter.lastName}
                        </td>

                        <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-slate-600">
                          <span>{entry.reporter.position || '-'}</span>
                          {entry.reporter.level && entry.reporter.level !== 'ไม่มี' && (
                            <span className="ml-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {entry.reporter.level}
                            </span>
                          )}
                        </td>

                        <td
                          className="px-3 py-2 border-r border-slate-200 text-slate-600 truncate max-w-xs"
                          title={entry.notes}
                        >
                          {entry.notes || '-'}
                        </td>

                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => onEditEntry(entry)}
                              className="p-1 text-blue-700 hover:text-blue-900 hover:bg-blue-100 rounded transition-colors cursor-pointer"
                              title="แก้ไขข้อมูลแถวนี้"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onDeleteEntry(entry)}
                              className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded transition-colors cursor-pointer"
                              title="ลบข้อมูลแถวนี้"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {filteredRecords.length > 0 && (
                <tfoot className="bg-sky-100/80 text-blue-950 font-semibold sticky bottom-0 z-20 border-t-2 border-blue-800 text-xs">
                  <tr>
                    <td className="px-2 py-2.5 text-center border-r border-sky-200 bg-sky-200/80 font-mono">
                      Σ
                    </td>
                    <td
                      colSpan={4}
                      className="px-3 py-2.5 border-r border-sky-200 text-right font-bold"
                    >
                      รวมทั้งสิ้นทุกสถานบริการ ({filteredRecords.length} แถว):
                    </td>
                    <td className="px-3 py-2.5 border-r border-sky-200 text-right font-mono tabular-nums font-bold">
                      {totals.gp.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 border-r border-sky-200 text-right font-mono tabular-nums font-bold">
                      {totals.cc.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 border-r border-sky-200 text-right font-mono tabular-nums font-bold">
                      {totals.hv.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 border-r border-sky-200 text-right font-mono tabular-nums font-bold">
                      {totals.mc.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 border-r border-sky-200 text-right font-mono tabular-nums font-bold">
                      {totals.sp.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 border-r border-sky-200 text-right font-mono tabular-nums font-bold text-sm text-blue-950 bg-sky-200/50">
                      {totals.total.toLocaleString()}
                    </td>
                    <td
                      colSpan={4}
                      className="px-3 py-2.5 text-slate-600 text-[11px] font-normal"
                    >
                      *ข้อมูลรวมจากทุกสถานบริการและทุกเครื่องแบบ Real-time
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>
                แสดงข้อมูลรวมทั้งหมด {filteredRecords.length} แถว (จากข้อมูลสะสมทุกสถานบริการ{' '}
                {records.length} แถว)
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-emerald-700 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                ซิงค์ข้อมูลรวมทุกเครื่องแบบ Real-time • เก็บรักษาข้อมูลถาวร ไม่รีเซ็ตหรือล้างข้อมูล
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. REAL-TIME GROUPED TABLES BY SERVICE UNIT ON THE SAME PAGE          */}
      {/* ===================================================================== */}
      {(viewMode === 'both' || viewMode === 'grouped') && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-700" />
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                ตารางข้อมูลแยกตามสถานบริการ (4 รพ.สต. ในหน้าเดียวกันแบบ Real-time)
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              ทุก Account ของแต่ละ รพ.สต. จะรวมแสดงในกล่องสถานบริการของตนเองโดยอัตโนมัติ
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {groupedFilteredByUnit.map((group) => {
              const style =
                UNIT_BADGE_STYLES[group.hospital] || UNIT_BADGE_STYLES['รพ.สต.บ้านดอยยาว'];

              return (
                <div
                  key={group.code}
                  className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden"
                >
                  {/* Service Unit Section Header */}
                  <div
                    className={`bg-gradient-to-r ${style.headerGradient} text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-black bg-white/20 px-2.5 py-1 rounded-lg border border-white/25">
                        รหัสสถานบริการ {group.code}
                      </span>
                      <h4 className="text-sm sm:text-base font-extrabold tracking-tight">
                        {group.hospital}
                      </h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <span className="bg-white/15 px-2.5 py-1 rounded-lg font-semibold">
                        จำนวนบันทึก: <strong>{group.rows.length}</strong> รายการ
                      </span>
                      <span className="bg-white/15 px-2.5 py-1 rounded-lg font-semibold">
                        ชั่วโมงรวม: <strong>{group.unitHours.toFixed(1)}</strong> ชม.
                      </span>
                      <span className="bg-white text-slate-900 px-3 py-1 rounded-lg font-extrabold font-mono">
                        ผู้รับบริการรวม: {group.totals.total.toLocaleString()} ราย
                      </span>
                    </div>
                  </div>

                  {/* Service Unit Sub-Table */}
                  {group.rows.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-50/50">
                      ยังไม่มีรายการบันทึกของ <strong>{group.hospital}</strong> ({group.code})
                      ในเงื่อนไขที่เลือก
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                          <tr>
                            <th className="w-10 px-2 py-2 text-center border-r border-slate-200 font-bold">
                              ลำดับ
                            </th>
                            <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap font-bold">
                              วันที่ปฏิบัติงาน
                            </th>
                            <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap font-bold">
                              เวลาปฏิบัติงาน
                            </th>
                            <th className="px-3 py-2 border-r border-slate-200 text-right whitespace-nowrap font-bold">
                              4.1 ทั่วไป
                            </th>
                            <th className="px-3 py-2 border-r border-slate-200 text-right whitespace-nowrap font-bold">
                              4.2 เรื้อรัง
                            </th>
                            <th className="px-3 py-2 border-r border-slate-200 text-right whitespace-nowrap font-bold">
                              4.3 เยี่ยมบ้าน
                            </th>
                            <th className="px-3 py-2 border-r border-slate-200 text-right whitespace-nowrap font-bold">
                              4.4 ใบรับรอง
                            </th>
                            <th className="px-3 py-2 border-r border-slate-200 text-right whitespace-nowrap font-bold">
                              4.5 หัตถการ
                            </th>
                            <th className="px-3 py-2 border-r border-slate-200 text-right whitespace-nowrap font-extrabold bg-slate-200/60">
                              รวมผู้ป่วย (ราย)
                            </th>
                            <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap font-bold">
                              ผู้รายงาน (Account สถานบริการ)
                            </th>
                            <th className="px-3 py-2 border-r border-slate-200 whitespace-nowrap font-bold">
                              หมายเหตุ
                            </th>
                            <th className="px-3 py-2 text-center whitespace-nowrap font-bold">
                              จัดการ
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {group.rows.map((entry, idx) => {
                            const rowTotal = calculateTotalPatients(entry.report);
                            const isLeave = entry.workTime === 'แพทย์ลา';
                            return (
                              <tr
                                key={entry.id}
                                className={
                                  isLeave
                                    ? 'bg-amber-50/40'
                                    : idx % 2 === 0
                                    ? 'bg-white'
                                    : 'bg-slate-50/50'
                                }
                              >
                                <td className="px-2 py-2 text-center border-r border-slate-200 font-mono text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap font-semibold text-slate-900">
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    {formatThaiDate(entry.date, 'short')}
                                  </span>
                                </td>
                                <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                                  {isLeave ? (
                                    <span className="font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                                      {entry.workTime}
                                    </span>
                                  ) : (
                                    <span>{entry.workTime}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums">
                                  {entry.report.generalPractice}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums">
                                  {entry.report.chronicCare}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums">
                                  {entry.report.homeVisit}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums">
                                  {entry.report.medicalCert}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums">
                                  {entry.report.specialProcedure}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-200 text-right font-mono tabular-nums font-bold text-slate-900 bg-slate-100/70">
                                  {rowTotal}
                                </td>
                                <td className="px-3 py-2 border-r border-slate-200 whitespace-nowrap text-slate-800">
                                  {entry.reporter.prefix}
                                  {entry.reporter.firstName} {entry.reporter.lastName}
                                  {entry.reporter.position ? ` (${entry.reporter.position})` : ''}
                                </td>
                                <td
                                  className="px-3 py-2 border-r border-slate-200 text-slate-600 truncate max-w-xs"
                                  title={entry.notes}
                                >
                                  {entry.notes || '-'}
                                </td>
                                <td className="px-3 py-2 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => onEditEntry(entry)}
                                      className="p-1 text-blue-700 hover:bg-blue-100 rounded cursor-pointer"
                                      title="แก้ไข"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => onDeleteEntry(entry)}
                                      className="p-1 text-rose-600 hover:bg-rose-100 rounded cursor-pointer"
                                      title="ลบ"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300">
                          <tr>
                            <td colSpan={3} className="px-3 py-2 text-right border-r border-slate-200">
                              รวมเฉพาะ {group.hospital} ({group.rows.length} แถว):
                            </td>
                            <td className="px-3 py-2 text-right border-r border-slate-200 font-mono">
                              {group.totals.gp.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right border-r border-slate-200 font-mono">
                              {group.totals.cc.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right border-r border-slate-200 font-mono">
                              {group.totals.hv.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right border-r border-slate-200 font-mono">
                              {group.totals.mc.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right border-r border-slate-200 font-mono">
                              {group.totals.sp.toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-right border-r border-slate-200 font-mono text-blue-950 bg-blue-50">
                              {group.totals.total.toLocaleString()}
                            </td>
                            <td colSpan={3} className="px-3 py-2 text-xs font-normal text-slate-500">
                              รวมทุก Account ของรหัสสถานบริการ {group.code}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
