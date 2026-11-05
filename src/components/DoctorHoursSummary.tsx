import React, { useState, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Building2,
  UserCheck,
  Download,
  Printer,
  BarChart2,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Users,
  Zap,
} from 'lucide-react';
import { MedicalLogEntry, HOSPITALS, DEFAULT_DOCTOR_NAME, getWorkSlotHours } from '../types';
import { formatThaiDate, calculateTotalPatients } from '../utils/storage';

interface DoctorHoursSummaryProps {
  records: MedicalLogEntry[];
  onOpenAddModal: () => void;
}

export const DoctorHoursSummary: React.FC<DoctorHoursSummaryProps> = ({
  records,
  onOpenAddModal,
}) => {
  const [viewMode, setViewMode] = useState<'monthly' | 'daily'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedHospital, setSelectedHospital] = useState<string>('all');

  // Helper to extract Thai month and year label from YYYY-MM
  const formatMonthYearThai = (yearMonth: string) => {
    try {
      const [yearStr, monthStr] = yearMonth.split('-');
      const year = parseInt(yearStr, 10) + 543;
      const monthIndex = parseInt(monthStr, 10) - 1;
      const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      return `${thaiMonths[monthIndex]} ${year}`;
    } catch {
      return yearMonth;
    }
  };

  // Helper to get Thai Day name (วันจันทร์, วันอังคาร ฯลฯ)
  const getThaiDayName = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
      return `วัน${days[d.getDay()]}`;
    } catch {
      return '';
    }
  };

  // Distinct months in records sorted descending
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.date) {
        set.add(r.date.slice(0, 7)); // YYYY-MM
      }
    });
    return Array.from(set).sort().reverse();
  }, [records]);

  // Filtered records based on selected month and hospital
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchesMonth = selectedMonth === 'all' || r.date.startsWith(selectedMonth);
      const matchesHosp = selectedHospital === 'all' || r.hospital === selectedHospital;
      return matchesMonth && matchesHosp;
    });
  }, [records, selectedMonth, selectedHospital]);

  // Overall Doctor Hours KPI Aggregates
  const stats = useMemo(() => {
    let totalHours = 0;
    let dutyDays = 0;
    let leaveDays = 0;
    let totalPatients = 0;

    filteredRecords.forEach((r) => {
      const hrs = getWorkSlotHours(r.workTime);
      totalHours += hrs;
      if (r.workTime === 'แพทย์ลา') {
        leaveDays += 1;
      } else {
        dutyDays += 1;
      }
      totalPatients += calculateTotalPatients(r.report);
    });

    const avgHoursPerDutyDay = dutyDays > 0 ? (totalHours / dutyDays).toFixed(1) : '0';
    const patientsPerHour = totalHours > 0 ? (totalPatients / totalHours).toFixed(1) : '0';

    return {
      totalHours,
      dutyDays,
      leaveDays,
      totalPatients,
      avgHoursPerDutyDay,
      patientsPerHour,
    };
  }, [filteredRecords]);

  // Monthly Aggregated Data
  const monthlySummaryData = useMemo(() => {
    const map = new Map<
      string,
      {
        yearMonth: string;
        dutyDays: number;
        leaveDays: number;
        totalHours: number;
        totalPatients: number;
        hospitalHours: Record<string, number>;
      }
    >();

    records.forEach((r) => {
      if (!r.date) return;
      const ym = r.date.slice(0, 7);
      if (!map.has(ym)) {
        map.set(ym, {
          yearMonth: ym,
          dutyDays: 0,
          leaveDays: 0,
          totalHours: 0,
          totalPatients: 0,
          hospitalHours: {
            'รพ.สต.บ้านดอยยาว': 0,
            'รพ.สต.บ้านแม่ผาแหน': 0,
            'รพ.สต.บ้านป่าตาล': 0,
            'รพ.สต.บ้านกอสะเรียม': 0,
          },
        });
      }

      const item = map.get(ym)!;
      const hrs = getWorkSlotHours(r.workTime);
      item.totalHours += hrs;
      if (r.workTime === 'แพทย์ลา') {
        item.leaveDays += 1;
      } else {
        item.dutyDays += 1;
      }
      item.totalPatients += calculateTotalPatients(r.report);
      if (item.hospitalHours[r.hospital] !== undefined) {
        item.hospitalHours[r.hospital] += hrs;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  }, [records]);

  // Max monthly hours for SVG chart scaling
  const maxMonthlyHours = Math.max(1, ...monthlySummaryData.map((m) => m.totalHours));

  // Daily records sorted by date descending
  const dailyRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredRecords]);

  // Export Daily Timesheet to CSV
  const handleExportTimesheetCSV = () => {
    const headers = [
      'ลำดับ',
      'วันที่ (YYYY-MM-DD)',
      'วันในสัปดาห์',
      'วันที่แบบไทย',
      'ชื่อแพทย์',
      'รพ.สต.ที่ปฏิบัติงาน',
      'เวลาปฏิบัติงาน',
      'จำนวนชั่วโมงปฏิบัติงาน (ชม.)',
      'สถานะ',
      'ผู้รับบริการรวม (ราย)',
      'ผู้รายงาน',
      'ตำแหน่ง',
      'หมายเหตุ',
    ];

    const escapeCSV = (val: string | number) => {
      const s = String(val ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = dailyRecords.map((r, i) => {
      const hrs = getWorkSlotHours(r.workTime);
      const isLeave = r.workTime === 'แพทย์ลา';
      const reporterName = `${r.reporter.prefix}${r.reporter.firstName} ${r.reporter.lastName}`.trim();
      return [
        i + 1,
        r.date,
        getThaiDayName(r.date),
        formatThaiDate(r.date, 'full'),
        r.doctorName,
        r.hospital,
        r.workTime,
        hrs,
        isLeave ? 'แพทย์ลา' : 'ปฏิบัติงาน',
        calculateTotalPatients(r.report),
        reporterName,
        r.reporter.position || '-',
        r.notes || '-',
      ].map(escapeCSV).join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Timesheet_Doctor_Hours_DoiYao_${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Doctor Profile Banner */}
      <div className="bg-white rounded-2xl border border-sky-100 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-700 to-sky-600 flex items-center justify-center text-white shadow-md">
            <Clock className="w-7 h-7 text-sky-100" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                รายงานชั่วโมงแพทย์
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Node ดอยยาว อบจ.เชียงใหม่
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-0.5">
              สรุปชั่วโมงการปฏิบัติงานของแพทย์
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              สรุปภาระเวลาการปฏิบัติงานของแพทย์ ทั้งรูปแบบชั่วโมงรวม, รายเดือน และบันทึกเวลาปฏิบัติงานรายวัน
            </p>
          </div>
        </div>

        {/* View Switcher and Action Tools */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setViewMode('monthly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'monthly'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>สรุปรายเดือน</span>
            </button>
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>สรุปรายวัน</span>
            </button>
          </div>

          <button
            onClick={handleExportTimesheetCSV}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors shadow-2xs cursor-pointer"
            title="ดาวน์โหลดตารางชั่วโมงแพทย์เป็น CSV"
          >
            <Download className="w-3.5 h-3.5 text-blue-700" />
            <span>ส่งออกตารางชั่วโมง</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors shadow-2xs cursor-pointer no-print"
            title="พิมพ์รายงานสรุปชั่วโมงแพทย์"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>พิมพ์รายงาน</span>
          </button>
        </div>
      </div>

      {/* Colorful KPI Stats Cards (6 Vibrant Themed Boxes) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* 1. Total Hours (Royal Blue & Indigo Hero) */}
        <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white rounded-2xl p-4 border border-blue-500/40 shadow-md shadow-blue-900/15 relative overflow-hidden flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-lg group">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between gap-1.5 relative z-10">
            <span className="text-[11px] font-extrabold text-sky-200 uppercase tracking-wide truncate">
              รวมชั่วโมงปฏิบัติงาน
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5 relative z-10">
            <div className="text-3xl font-black text-white tabular-nums tracking-tight drop-shadow-xs">
              {stats.totalHours.toFixed(1)}{' '}
              <span className="text-xs font-bold text-sky-200">ชม.</span>
            </div>
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 text-sky-100 text-[11px] font-medium backdrop-blur-xs">
              <span>สะสมทั้งหมด {filteredRecords.length} บันทึก</span>
            </div>
          </div>
        </div>

        {/* 2. Active Duty Days (Emerald & Mint Green) */}
        <div className="bg-gradient-to-br from-emerald-50 via-teal-50/70 to-emerald-100/60 rounded-2xl p-4 border-2 border-emerald-300 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between group">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-extrabold text-emerald-950 truncate">
              วันปฏิบัติงานจริง
            </span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-emerald-800 tabular-nums tracking-tight">
              {stats.dutyDays}{' '}
              <span className="text-xs font-bold text-emerald-600">วัน</span>
            </div>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 text-[11px] font-bold">
              ลงตรวจใน 4 รพ.สต.
            </span>
          </div>
        </div>

        {/* 3. Leave Days (Amber & Sun Orange) */}
        <div className="bg-gradient-to-br from-amber-50 via-orange-50/70 to-amber-100/60 rounded-2xl p-4 border-2 border-amber-300 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between group">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-extrabold text-amber-950 truncate">
              วันลาของแพทย์
            </span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <CalendarDays className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-amber-800 tabular-nums tracking-tight">
              {stats.leaveDays}{' '}
              <span className="text-xs font-bold text-amber-600">วัน</span>
            </div>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 text-[11px] font-bold">
              {stats.leaveDays > 0 ? 'ลาอบรม / ภารกิจราชการ' : 'ไม่มีวันลา'}
            </span>
          </div>
        </div>

        {/* 4. Average Hours / Duty Day (Cyan & Sky Blue) */}
        <div className="bg-gradient-to-br from-sky-50 via-cyan-50/70 to-sky-100/60 rounded-2xl p-4 border-2 border-sky-300 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between group">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-extrabold text-sky-950 truncate">
              เฉลี่ยต่อวันทำงาน
            </span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-sky-800 tabular-nums tracking-tight">
              {stats.avgHoursPerDutyDay}{' '}
              <span className="text-xs font-bold text-sky-600">ชม./วัน</span>
            </div>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-sky-200/80 text-sky-900 text-[11px] font-bold truncate max-w-full">
              ตามตารางเข้าเวรตรวจ
            </span>
          </div>
        </div>

        {/* 5. Total Patients Served (Violet & Purple) */}
        <div className="bg-gradient-to-br from-purple-50 via-fuchsia-50/70 to-purple-100/60 rounded-2xl p-4 border-2 border-purple-300 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between group">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-extrabold text-purple-950 truncate">
              ผู้รับบริการรวม
            </span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-purple-800 tabular-nums tracking-tight">
              {stats.totalPatients.toLocaleString()}{' '}
              <span className="text-xs font-bold text-purple-600">ราย</span>
            </div>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-purple-200/80 text-purple-900 text-[11px] font-bold truncate max-w-full">
              ตรวจรักษาทุกกลุ่มโรค
            </span>
          </div>
        </div>

        {/* 6. Productivity Patients / Hour (Rose & Coral Pink) */}
        <div className="bg-gradient-to-br from-rose-50 via-pink-50/70 to-rose-100/60 rounded-2xl p-4 border-2 border-rose-300 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between group">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-extrabold text-rose-950 truncate">
              ภาระงานเฉลี่ย
            </span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <Zap className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-rose-800 tabular-nums tracking-tight">
              {stats.patientsPerHour}{' '}
              <span className="text-xs font-bold text-rose-600">ราย/ชม.</span>
            </div>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-900 text-[11px] font-bold truncate max-w-full">
              อัตราตรวจต่อชั่วโมง
            </span>
          </div>
        </div>
      </div>

      {/* Filter Options Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">เลือกเดือน:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">ทุกเดือนที่บันทึก ({records.length} รายการ)</option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym}>
                  {formatMonthYearThai(ym)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">เลือก รพ.สต.:</span>
            <select
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">รพ.สต. ทั้งหมด (4 แห่ง)</option>
              {HOSPITALS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          {(selectedMonth !== 'all' || selectedHospital !== 'all') && (
            <button
              onClick={() => {
                setSelectedMonth('all');
                setSelectedHospital('all');
              }}
              className="text-blue-700 underline text-xs cursor-pointer ml-1"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>

        <div className="text-[11px] text-slate-500">
          * มาตรฐานชั่วโมง: 08.30-16.30 น. (8 ชม.), 09.00-16.00 น. (7 ชม.), 08.30-15.00 น. (6.5 ชม.), ครึ่งวันเช้า (3-3.5 ชม.)
        </div>
      </div>

      {/* VIEW 1: MONTHLY SUMMARY */}
      {viewMode === 'monthly' && (
        <div className="space-y-6">
          {/* Monthly Bar Chart of Doctor Hours */}
          {monthlySummaryData.length > 0 && (
            <div className="bg-white rounded-xl border border-sky-100 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-blue-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    กราฟชั่วโมงการปฏิบัติงานแพทย์รายเดือน (Doctor Monthly Hours)
                  </h3>
                </div>
                <span className="text-xs text-slate-500">หน่วย: ชั่วโมง (ชม.)</span>
              </div>

              <div className="mt-5 space-y-4">
                {monthlySummaryData.map((item) => {
                  const pct = Math.max(8, Math.round((item.totalHours / maxMonthlyHours) * 100));

                  return (
                    <div key={item.yearMonth} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-900">
                          {formatMonthYearThai(item.yearMonth)}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">
                            ตรวจ {item.dutyDays} วัน {item.leaveDays > 0 ? `(ลา ${item.leaveDays} วัน)` : ''} · ผู้ป่วย {item.totalPatients} ราย
                          </span>
                          <strong className="font-mono text-sm font-bold text-blue-900 tabular-nums">
                            {item.totalHours.toFixed(1)} ชม.
                          </strong>
                        </div>
                      </div>

                      <div className="w-full h-6 bg-slate-100 rounded-lg overflow-hidden flex items-center p-0.5">
                        <div
                          className="h-full rounded-md bg-gradient-to-r from-blue-700 via-blue-600 to-sky-500 transition-all duration-500 flex items-center justify-end pr-2.5 text-white font-mono text-[11px] font-bold shadow-2xs"
                          style={{ width: `${pct}%` }}
                        >
                          {item.totalHours > 0 && `${item.totalHours.toFixed(1)} ชม.`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Monthly Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-700" />
                <span>ตารางสรุปชั่วโมงการปฏิบัติงานแพทย์รายเดือน</span>
              </h3>
              <span className="text-xs text-slate-500">
                แพทย์ประจำ Node ดอยยาว: {DEFAULT_DOCTOR_NAME}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-blue-900 text-white font-semibold">
                  <tr>
                    <th className="px-3.5 py-3">เดือน / ปี (พ.ศ.)</th>
                    <th className="px-3 py-3 text-center">วันปฏิบัติงาน</th>
                    <th className="px-3 py-3 text-center">วันลา</th>
                    <th className="px-3 py-3 text-right">บ้านดอยยาว (ชม.)</th>
                    <th className="px-3 py-3 text-right">บ้านแม่ผาแหน (ชม.)</th>
                    <th className="px-3 py-3 text-right">บ้านป่าตาล (ชม.)</th>
                    <th className="px-3 py-3 text-right">บ้านกอสะเรียม (ชม.)</th>
                    <th className="px-3 py-3 text-right font-bold bg-blue-950">รวมชั่วโมง (ชม.)</th>
                    <th className="px-3 py-3 text-right">ผู้รับบริการ (ราย)</th>
                    <th className="px-3 py-3 text-right">อัตรา (ราย/ชม.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlySummaryData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        ยังไม่มีข้อมูลบันทึกเวลาปฏิบัติงานของแพทย์
                      </td>
                    </tr>
                  ) : (
                    monthlySummaryData.map((m) => {
                      const pph = m.totalHours > 0 ? (m.totalPatients / m.totalHours).toFixed(1) : '0';

                      return (
                        <tr key={m.yearMonth} className="hover:bg-sky-50/50">
                          <td className="px-3.5 py-3 font-semibold text-slate-900">
                            {formatMonthYearThai(m.yearMonth)}
                          </td>
                          <td className="px-3 py-3 text-center font-mono">
                            {m.dutyDays} วัน
                          </td>
                          <td className="px-3 py-3 text-center font-mono">
                            {m.leaveDays > 0 ? (
                              <span className="text-amber-800 font-semibold bg-amber-100 px-1.5 py-0.5 rounded text-[10px]">
                                {m.leaveDays} วัน
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                            {m.hospitalHours['รพ.สต.บ้านดอยยาว']?.toFixed(1) || '0.0'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                            {m.hospitalHours['รพ.สต.บ้านแม่ผาแหน']?.toFixed(1) || '0.0'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                            {m.hospitalHours['รพ.สต.บ้านป่าตาล']?.toFixed(1) || '0.0'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-700">
                            {m.hospitalHours['รพ.สต.บ้านกอสะเรียม']?.toFixed(1) || '0.0'}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-sm text-blue-950 bg-sky-50/80">
                            {m.totalHours.toFixed(1)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums font-medium text-slate-900">
                            {m.totalPatients.toLocaleString()}
                          </td>
                          <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">
                            {pph}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {monthlySummaryData.length > 0 && (
                  <tfoot className="bg-sky-100/90 font-semibold text-blue-950 border-t-2 border-blue-800">
                    <tr>
                      <td className="px-3.5 py-3 font-bold">รวมทุกเดือน:</td>
                      <td className="px-3 py-3 text-center font-mono font-bold">
                        {monthlySummaryData.reduce((s, m) => s + m.dutyDays, 0)} วัน
                      </td>
                      <td className="px-3 py-3 text-center font-mono font-bold">
                        {monthlySummaryData.reduce((s, m) => s + m.leaveDays, 0)} วัน
                      </td>
                      <td colSpan={4} className="px-3 py-3 text-right text-slate-600">
                        ชั่วโมงรวมสะสม:
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums font-bold text-base text-blue-950 bg-sky-200/50">
                        {monthlySummaryData.reduce((s, m) => s + m.totalHours, 0).toFixed(1)} ชม.
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">
                        {monthlySummaryData.reduce((s, m) => s + m.totalPatients, 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">
                        {stats.patientsPerHour}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: DAILY SUMMARY (TIMESHEET) */}
      {viewMode === 'daily' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="bg-slate-50 p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-700" />
                <span>บันทึกชั่วโมงการปฏิบัติงานแพทย์รายวัน (Daily Timesheet)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ตารางเวลาเข้า-ออก และจำนวนชั่วโมงการตรวจของแพทย์ประจำวัน
              </p>
            </div>
            <div className="text-xs text-blue-900 font-semibold bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
              รวม {dailyRecords.length} วันบันทึก ({stats.totalHours.toFixed(1)} ชั่วโมง)
            </div>
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-blue-900 text-white font-semibold sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center">ลำดับ</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">วันที่</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">วันในสัปดาห์</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">รพ.สต. ที่ปฏิบัติงาน</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">เวลาที่ปฏิบัติงาน</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap bg-blue-950 font-bold">
                    ชั่วโมง (ชม.)
                  </th>
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">สถานะ</th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap">ผู้รับบริการ (ราย)</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">ผู้รายงาน</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">ตำแหน่ง</th>
                  <th className="px-3 py-2.5 whitespace-nowrap min-w-[150px]">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyRecords.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      <p className="text-sm font-medium">ยังไม่มีข้อมูลชั่วโมงปฏิบัติงานในตัวกรองนี้</p>
                      <button
                        onClick={onOpenAddModal}
                        className="mt-3 inline-flex items-center gap-1.5 bg-blue-700 text-white text-xs px-3.5 py-1.5 rounded-lg hover:bg-blue-800"
                      >
                        บันทึกข้อมูลการปฏิบัติงานแพทย์
                      </button>
                    </td>
                  </tr>
                ) : (
                  dailyRecords.map((r, i) => {
                    const hrs = getWorkSlotHours(r.workTime);
                    const isLeave = r.workTime === 'แพทย์ลา';
                    const patients = calculateTotalPatients(r.report);

                    return (
                      <tr
                        key={r.id}
                        className={`hover:bg-sky-50/50 transition-colors ${
                          isLeave ? 'bg-amber-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                        }`}
                      >
                        <td className="px-3 py-2 text-center font-mono text-slate-400">
                          {i + 1}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-900 whitespace-nowrap">
                          {formatThaiDate(r.date, 'short')}
                        </td>
                        <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                          {getThaiDayName(r.date)}
                        </td>
                        <td className="px-3 py-2 font-medium text-blue-900 whitespace-nowrap">
                          {r.hospital}
                        </td>
                        <td className="px-3 py-2 text-slate-800 whitespace-nowrap">
                          {r.workTime}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums font-bold text-sm text-blue-950 bg-sky-50/50">
                          {isLeave ? '0.0' : hrs.toFixed(1)}
                        </td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          {isLeave ? (
                            <span className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                              แพทย์ลา
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              ปฏิบัติงาน
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {patients}
                        </td>
                        <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                          {r.reporter.prefix}{r.reporter.firstName} {r.reporter.lastName}
                        </td>
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                          <span>{r.reporter.position || '-'}</span>
                          {r.reporter.level && r.reporter.level !== 'ไม่มี' && (
                            <span className="ml-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {r.reporter.level}
                            </span>
                          )}
                        </td>

                        <td className="px-3 py-2 text-slate-500 truncate max-w-xs" title={r.notes}>
                          {r.notes || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {dailyRecords.length > 0 && (
                <tfoot className="bg-sky-100 font-semibold text-blue-950 sticky bottom-0 z-10 border-t-2 border-blue-800">
                  <tr>
                    <td colSpan={5} className="px-3 py-2.5 text-right font-bold">
                      รวมทั้งหมด ({dailyRecords.length} รายการ):
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-sm text-blue-950 bg-sky-200/60">
                      {stats.totalHours.toFixed(1)} ชม.
                    </td>
                    <td className="px-3 py-2.5 text-center text-[11px] text-slate-600">
                      (ลา {stats.leaveDays} วัน)
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold">
                      {stats.totalPatients.toLocaleString()} ราย
                    </td>
                    <td colSpan={3} className="px-3 py-2.5 text-[11px] text-slate-500 font-normal">
                      *คำนวณตามบันทึกการปฏิบัติงานของแพทย์
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
