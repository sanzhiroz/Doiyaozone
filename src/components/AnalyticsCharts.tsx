import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Activity,
  Users,
  Home,
  FileCheck,
  Stethoscope,
  Building2,
  Calendar,
  AlertCircle,
  Sparkles,
  Palette,
} from 'lucide-react';
import { MedicalLogEntry, HOSPITALS, HospitalName } from '../types';
import { calculateTotalPatients, formatThaiDate } from '../utils/storage';

interface AnalyticsChartsProps {
  records: MedicalLogEntry[];
}

export const AnalyticsCharts: React.FC<AnalyticsChartsProps> = ({ records }) => {
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState<string>('all');
  const [timelineBgTheme, setTimelineBgTheme] = useState<'navy' | 'sky' | 'aurora'>('navy');

  // Filter records if user wants to isolate a specific hospital
  const filteredRecords = useMemo(() => {
    if (selectedHospitalFilter === 'all') return records;
    return records.filter((r) => r.hospital === selectedHospitalFilter);
  }, [records, selectedHospitalFilter]);

  // Aggregate totals
  const aggregates = useMemo(() => {
    let gp = 0;
    let cc = 0;
    let hv = 0;
    let mc = 0;
    let sp = 0;
    let doctorLeaveCount = 0;
    let activeDutyDays = 0;

    filteredRecords.forEach((r) => {
      if (r.workTime === 'แพทย์ลา') {
        doctorLeaveCount += 1;
      } else {
        activeDutyDays += 1;
      }
      gp += Number(r.report.generalPractice) || 0;
      cc += Number(r.report.chronicCare) || 0;
      hv += Number(r.report.homeVisit) || 0;
      mc += Number(r.report.medicalCert) || 0;
      sp += Number(r.report.specialProcedure) || 0;
    });

    const total = gp + cc + hv + mc + sp;

    return {
      gp,
      cc,
      hv,
      mc,
      sp,
      total,
      doctorLeaveCount,
      activeDutyDays,
      averagePerDay: activeDutyDays > 0 ? Math.round(total / activeDutyDays) : 0,
    };
  }, [filteredRecords]);

  // Breakdown by the 4 designated hospitals
  const hospitalBreakdown = useMemo(() => {
    return HOSPITALS.map((hosp) => {
      const hospRecords = records.filter((r) => r.hospital === hosp);
      let count = 0;
      let activeDays = 0;
      let gp = 0;
      let cc = 0;
      let hv = 0;
      let mc = 0;
      let sp = 0;

      hospRecords.forEach((r) => {
        if (r.workTime !== 'แพทย์ลา') activeDays += 1;
        const rgp = Number(r.report.generalPractice) || 0;
        const rcc = Number(r.report.chronicCare) || 0;
        const rhv = Number(r.report.homeVisit) || 0;
        const rmc = Number(r.report.medicalCert) || 0;
        const rsp = Number(r.report.specialProcedure) || 0;
        gp += rgp;
        cc += rcc;
        hv += rhv;
        mc += rmc;
        sp += rsp;
        count += rgp + rcc + rhv + rmc + rsp;
      });

      return {
        hospital: hosp,
        totalPatients: count,
        sessionsCount: hospRecords.length,
        activeDays,
        gp,
        cc,
        hv,
        mc,
        sp,
        avgPerDay: activeDays > 0 ? Math.round(count / activeDays) : 0,
      };
    });
  }, [records]);

  // Max hospital patient count for scaling bar chart
  const maxHospitalPatients = Math.max(1, ...hospitalBreakdown.map((h) => h.totalPatients));

  // Category distribution for Donut Chart
  const categoriesData = useMemo(() => {
    const total = Math.max(1, aggregates.total);
    return [
      {
        id: 'gp',
        label: '4.1 ผู้ป่วยโรคทั่วไปและแนะนำการใช้ยา',
        shortLabel: 'โรคทั่วไป & การใช้ยา',
        value: aggregates.gp,
        percentage: ((aggregates.gp / total) * 100).toFixed(1),
        color: '#1d4ed8', // blue-700
      },
      {
        id: 'cc',
        label: '4.2 ผู้ป่วยโรคเรื้อรัง (NCDs)',
        shortLabel: 'โรคเรื้อรัง (NCDs)',
        value: aggregates.cc,
        percentage: ((aggregates.cc / total) * 100).toFixed(1),
        color: '#0284c7', // sky-600
      },
      {
        id: 'hv',
        label: '4.3 เยี่ยมบ้านผู้ป่วยติดบ้าน/ติดเตียง',
        shortLabel: 'เยี่ยมบ้านติดบ้าน/ติดเตียง',
        value: aggregates.hv,
        percentage: ((aggregates.hv / total) * 100).toFixed(1),
        color: '#0d9488', // teal-600
      },
      {
        id: 'mc',
        label: '4.4 ออกใบรับรองแพทย์',
        shortLabel: 'ออกใบรับรองแพทย์',
        value: aggregates.mc,
        percentage: ((aggregates.mc / total) * 100).toFixed(1),
        color: '#3b82f6', // blue-500
      },
      {
        id: 'sp',
        label: '4.5 หัตถการพิเศษ อื่นๆ',
        shortLabel: 'หัตถการพิเศษ',
        value: aggregates.sp,
        percentage: ((aggregates.sp / total) * 100).toFixed(1),
        color: '#6366f1', // indigo-500
      },
    ];
  }, [aggregates]);

  // Daily timeline data sorted by date ascending
  const timelineData = useMemo(() => {
    const sorted = [...filteredRecords]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-10); // last 10 entries

    return sorted.map((r) => ({
      date: r.date,
      displayDate: formatThaiDate(r.date, 'short'),
      hospital: r.hospital.replace('รพ.สต.บ้าน', 'บ้าน'),
      patients: calculateTotalPatients(r.report),
      isLeave: r.workTime === 'แพทย์ลา',
    }));
  }, [filteredRecords]);

  const maxTimelinePatients = Math.max(1, ...timelineData.map((d) => d.patients));
  const timelineTotalPatients = useMemo(
    () => timelineData.reduce((sum, d) => sum + (d.isLeave ? 0 : d.patients), 0),
    [timelineData]
  );
  const activeTimelineDays = useMemo(
    () => timelineData.filter((d) => !d.isLeave).length,
    [timelineData]
  );
  const timelineAvgPatients =
    activeTimelineDays > 0 ? Math.round(timelineTotalPatients / activeTimelineDays) : 0;

  // Compute SVG Donut stroke-dasharray and stroke-dashoffset
  const circumference = 2 * Math.PI * 40; // r=40
  let cumulativePercent = 0;

  return (
    <div className="space-y-6">
      {/* Top Filter & Scope Indicator */}
      <div className="bg-gradient-to-r from-sky-50 via-blue-50/50 to-white rounded-2xl border-2 border-sky-200/80 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-500/20 shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <span>สรุปข้อมูลสถิติและรายงานผลเชิงกราฟ (Node ดอยยาว)</span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200">
                <Sparkles className="w-3 h-3 text-blue-600" />
                อัปเดตสด
              </span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              สรุปข้อมูลการให้บริการทางการแพทย์และการปฏิบัติงานของแพทย์ องค์การบริหารส่วนจังหวัดเชียงใหม่
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto bg-white px-3 py-1.5 rounded-xl border border-sky-200 shadow-2xs">
          <label className="text-xs font-bold text-slate-700 whitespace-nowrap flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-blue-700" />
            <span>กรองพื้นที่:</span>
          </label>
          <select
            value={selectedHospitalFilter}
            onChange={(e) => setSelectedHospitalFilter(e.target.value)}
            className="text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">ทุก รพ.สต. ใน Node ดอยยาว (4 แห่ง)</option>
            {HOSPITALS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Colorful KPI Stat Cards (6 Vibrant Themed Boxes) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Total Patients (Royal Blue & Indigo Hero) */}
        <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white rounded-2xl p-4 border border-blue-500/40 shadow-md shadow-blue-900/15 relative overflow-hidden flex flex-col justify-between transition-all hover:scale-[1.02] hover:shadow-lg group">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between gap-1.5 relative z-10">
            <span className="text-[11px] font-extrabold text-sky-200 uppercase tracking-wide truncate">
              รวมผู้รับบริการทั้งหมด
            </span>
            <div className="w-7 h-7 rounded-lg bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5 relative z-10">
            <div className="text-3xl font-black text-white tabular-nums tracking-tight drop-shadow-xs">
              {aggregates.total.toLocaleString()}
            </div>
          </div>
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 text-sky-100 text-[11px] font-medium backdrop-blur-xs">
              <span>เฉลี่ย {aggregates.averagePerDay} ราย/วัน</span>
            </div>
          </div>
        </div>

        {/* Card 2: 4.1 General Practice (Emerald & Mint Green) */}
        <div className="bg-gradient-to-br from-emerald-50 via-teal-50/70 to-emerald-100/60 rounded-2xl p-4 border-2 border-emerald-300 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between group">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-extrabold text-emerald-950 truncate">
              4.1 โรคทั่วไป & การใช้ยา
            </span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <Stethoscope className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-emerald-800 tabular-nums tracking-tight">
              {aggregates.gp.toLocaleString()}
            </div>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-emerald-200/80 text-emerald-900 text-[11px] font-bold">
              {aggregates.total > 0 ? ((aggregates.gp / aggregates.total) * 100).toFixed(0) : 0}% ของทั้งหมด
            </span>
          </div>
        </div>

        {/* Card 3: 4.2 Chronic Care (Amber & Sun Orange) */}
        <div className="bg-gradient-to-br from-amber-50 via-orange-50/70 to-amber-100/60 rounded-2xl p-4 border-2 border-amber-300 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between group">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-extrabold text-amber-950 truncate">
              4.2 โรคเรื้อรัง (NCDs)
            </span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-amber-800 tabular-nums tracking-tight">
              {aggregates.cc.toLocaleString()}
            </div>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 text-[11px] font-bold">
              {aggregates.total > 0 ? ((aggregates.cc / aggregates.total) * 100).toFixed(0) : 0}% ของทั้งหมด
            </span>
          </div>
        </div>

        {/* Card 4: 4.3 Home Visit (Violet & Purple) */}
        <div className="bg-gradient-to-br from-purple-50 via-fuchsia-50/70 to-purple-100/60 rounded-2xl p-4 border-2 border-purple-300 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between group">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-extrabold text-purple-950 truncate">
              4.3 เยี่ยมบ้านติดเตียง
            </span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <Home className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-purple-800 tabular-nums tracking-tight">
              {aggregates.hv.toLocaleString()}
            </div>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-purple-200/80 text-purple-900 text-[11px] font-bold truncate max-w-full">
              ผู้ป่วยติดบ้าน/ติดเตียง
            </span>
          </div>
        </div>

        {/* Card 5: 4.4 Medical Cert (Cyan & Sky Blue) */}
        <div className="bg-gradient-to-br from-sky-50 via-cyan-50/70 to-sky-100/60 rounded-2xl p-4 border-2 border-sky-300 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between group">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-extrabold text-sky-950 truncate">
              4.4 ใบรับรองแพทย์
            </span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <FileCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-sky-800 tabular-nums tracking-tight">
              {aggregates.mc.toLocaleString()}
            </div>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-sky-200/80 text-sky-900 text-[11px] font-bold truncate max-w-full">
              ออกใบรับรองตรวจสุขภาพ
            </span>
          </div>
        </div>

        {/* Card 6: 4.5 Special Procedures (Rose & Coral Pink) */}
        <div className="bg-gradient-to-br from-rose-50 via-pink-50/70 to-rose-100/60 rounded-2xl p-4 border-2 border-rose-300 shadow-xs hover:shadow-md hover:scale-[1.02] transition-all relative overflow-hidden flex flex-col justify-between group">
          <div className="flex items-center justify-between gap-1.5">
            <span className="text-[11px] font-extrabold text-rose-950 truncate">
              4.5 หัตถการพิเศษ
            </span>
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-xs shrink-0 group-hover:scale-110 transition-transform">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-black text-rose-800 tabular-nums tracking-tight">
              {aggregates.sp.toLocaleString()}
            </div>
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 rounded-md bg-rose-200/80 text-rose-900 text-[11px] font-bold truncate max-w-full">
              เย็บแผล/ผ่าฝี/หัตถการ
            </span>
          </div>
        </div>
      </div>

      {/* Main Charts Grid: Bar Chart & Donut Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Bar Chart of 4 รพ.สต. */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-sky-100 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  กราฟแท่งเปรียบเทียบภาระงานตาม รพ.สต. ทั้ง 4 แห่ง
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">หน่วย: ราย</span>
            </div>

            <p className="text-xs text-slate-500 mt-2 mb-5">
              แสดงสัดส่วนผู้รับบริการสะสมและการลงตรวจของแพทย์ในเครือข่าย Node ดอยยาว
            </p>

            {/* Custom SVG / CSS Bar Chart */}
            <div className="space-y-4">
              {hospitalBreakdown.map((item, idx) => {
                const percentage = Math.round((item.totalPatients / maxHospitalPatients) * 100);
                const colors = [
                  'from-blue-700 to-sky-600',
                  'from-blue-600 to-sky-500',
                  'from-sky-700 to-blue-500',
                  'from-blue-800 to-sky-700',
                ][idx % 4];

                return (
                  <div key={item.hospital} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-blue-800" />
                        <span className="font-semibold text-slate-900">{item.hospital}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 text-[11px]">
                          {item.activeDays} วันตรวจ (เฉลี่ย {item.avgPerDay} ราย/วัน)
                        </span>
                        <strong className="font-mono text-blue-950 font-bold tabular-nums">
                          {item.totalPatients.toLocaleString()} ราย
                        </strong>
                      </div>
                    </div>

                    <div className="w-full h-6 bg-slate-100/90 rounded-xl overflow-hidden flex items-center p-0.5 relative shadow-inner border border-slate-200/60">
                      <div
                        className={`h-full rounded-lg bg-gradient-to-r ${colors} transition-all duration-700 flex items-center justify-end pr-2.5 text-[11px] font-bold text-white shadow-sm relative overflow-hidden`}
                        style={{ width: `${Math.max(6, percentage)}%` }}
                      >
                        {/* Animated white light sheen passing across continuously */}
                        <div className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden">
                          <div
                            className="animate-white-shimmer absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-white/55 to-transparent"
                            style={{ animationDelay: `${idx * 0.4}s` }}
                          />
                        </div>

                        <span className="relative z-10 drop-shadow-xs font-mono">
                          {item.totalPatients > 0 && `${item.totalPatients}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>แพทย์ประจำ Node: นายแพทย์เกรียงยุทธ วรศีตกาลกุล</span>
            <span>สังกัด อบจ.เชียงใหม่</span>
          </div>
        </div>

        {/* Chart 2: Donut Chart of 5 Service Categories */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-sky-100 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  กราฟสัดส่วนประเภทการให้บริการ 5 ด้าน
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-2 mb-4">
              จำแนกสัดส่วนงานบริการตามหัวข้อรายงานการปฏิบัติงาน
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-6 justify-center my-3">
              {/* SVG Donut */}
              <div className="relative w-40 h-40 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  {/* Background Track */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    className="stroke-slate-100 fill-none"
                    strokeWidth="16"
                  />
                  {categoriesData.map((cat) => {
                    const pct = Number(cat.percentage) || 0;
                    if (pct <= 0) return null;
                    const strokeDash = (pct / 100) * circumference;
                    const strokeOffset = -((cumulativePercent / 100) * circumference);
                    cumulativePercent += pct;

                    return (
                      <circle
                        key={cat.id}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={cat.color}
                        strokeWidth="16"
                        strokeDasharray={`${strokeDash} ${circumference - strokeDash}`}
                        strokeDashoffset={strokeOffset}
                        className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                      />
                    );
                  })}
                </svg>
                {/* Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <span className="text-[10px] text-slate-400 font-medium">รวม</span>
                  <span className="text-base font-bold text-slate-900 font-mono tabular-nums">
                    {aggregates.total}
                  </span>
                  <span className="text-[10px] text-slate-500">ราย</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="space-y-2 text-xs flex-1 w-full">
                {categoriesData.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-slate-800 text-[11px] truncate" title={cat.label}>
                        {cat.shortLabel}
                      </span>
                    </div>
                    <div className="text-right shrink-0 font-mono">
                      <span className="font-semibold text-slate-900">{cat.value}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({cat.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 text-center">
            * สรุปตามรายงาน 4.1 ถึง 4.5 ในระบบบันทึก
          </div>
        </div>
      </div>

      {/* Chart 3: Timeline trend of recent duty sessions with Beautiful Background */}
      <div
        className={`rounded-2xl relative overflow-hidden p-5 sm:p-6 space-y-5 transition-all duration-300 ${
          timelineBgTheme === 'navy'
            ? 'bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white border border-blue-800/70 shadow-xl'
            : timelineBgTheme === 'aurora'
            ? 'bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-950 text-white border border-teal-800/70 shadow-xl'
            : 'bg-gradient-to-br from-sky-50 via-blue-50/70 to-indigo-100/70 text-slate-900 border-2 border-sky-300 shadow-md'
        }`}
      >
        {/* Ambient Glows & Grid Pattern */}
        {timelineBgTheme === 'navy' && (
          <>
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#38bdf8 1.5px, transparent 1.5px)',
                backgroundSize: '24px 24px',
              }}
            />
          </>
        )}
        {timelineBgTheme === 'aurora' && (
          <>
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-teal-600/20 rounded-full blur-3xl pointer-events-none" />
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#34d399 1.5px, transparent 1.5px)',
                backgroundSize: '24px 24px',
              }}
            />
          </>
        )}
        {timelineBgTheme === 'sky' && (
          <>
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-blue-300/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-sky-300/30 rounded-full blur-3xl pointer-events-none" />
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#60a5fa 1.5px, transparent 1.5px)',
                backgroundSize: '24px 24px',
              }}
            />
          </>
        )}

        {/* Top Header of Timeline Card */}
        <div
          className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b relative z-10 ${
            timelineBgTheme === 'sky' ? 'border-sky-200' : 'border-white/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs shrink-0 ${
                timelineBgTheme === 'navy'
                  ? 'bg-cyan-500/20 border border-cyan-400/40 text-cyan-300'
                  : timelineBgTheme === 'aurora'
                  ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                  : 'bg-blue-600 text-white'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className={`text-base font-black tracking-wide ${
                    timelineBgTheme === 'sky' ? 'text-slate-900' : 'text-white'
                  }`}
                >
                  แนวโน้มจำนวนผู้รับบริการรายวัน (Timeline)
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    timelineBgTheme === 'sky'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-white/15 text-sky-200 border border-white/20'
                  }`}
                >
                  ย้อนหลัง 10 ครั้งล่าสุด
                </span>
              </div>
              <p
                className={`text-xs mt-0.5 ${
                  timelineBgTheme === 'sky' ? 'text-slate-600' : 'text-slate-300'
                }`}
              >
                กราฟแสดงจำนวนผู้มารับบริการทางการแพทย์ในแต่ละวันทำการของ Node ดอยยาว
              </p>
            </div>
          </div>

          {/* Quick Metrics & Theme Switcher */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <div
              className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-semibold ${
                timelineBgTheme === 'sky'
                  ? 'bg-white/80 border border-sky-200 text-slate-700'
                  : 'bg-white/10 border border-white/15 text-slate-200'
              }`}
            >
              <span>
                ยอดรวม: <strong className="text-emerald-400">{timelineTotalPatients}</strong> ราย
              </span>
              <span>•</span>
              <span>
                สูงสุด: <strong className="text-cyan-400">{maxTimelinePatients}</strong> ราย
              </span>
              <span>•</span>
              <span>
                เฉลี่ย: <strong className="text-amber-400">{timelineAvgPatients}</strong> ราย/วัน
              </span>
            </div>

            {/* Theme switcher */}
            <div
              className={`inline-flex items-center p-1 rounded-xl border ${
                timelineBgTheme === 'sky'
                  ? 'bg-white border-sky-200 shadow-2xs'
                  : 'bg-black/30 border-white/15'
              }`}
            >
              <button
                type="button"
                onClick={() => setTimelineBgTheme('navy')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  timelineBgTheme === 'navy'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="พื้นหลังสีกรมท่าหรูหรา"
              >
                สีกรมท่า
              </button>
              <button
                type="button"
                onClick={() => setTimelineBgTheme('sky')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  timelineBgTheme === 'sky'
                    ? 'bg-sky-500 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="พื้นหลังสีฟ้าสว่างสดใส"
              >
                สีฟ้าสว่าง
              </button>
              <button
                type="button"
                onClick={() => setTimelineBgTheme('aurora')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  timelineBgTheme === 'aurora'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="พื้นหลังสีมรกต Aurora"
              >
                สีมรกต
              </button>
            </div>
          </div>
        </div>

        {/* Chart Canvas Area with Guidelines */}
        <div className="relative pt-6 pb-2 px-2 z-10">
          {/* Horizontal Reference Gridlines */}
          <div className="absolute inset-x-2 top-6 bottom-16 flex flex-col justify-between pointer-events-none">
            {[100, 75, 50, 25].map((pct) => {
              const val = Math.round((maxTimelinePatients * pct) / 100);
              return (
                <div key={pct} className="w-full flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono tabular-nums w-8 text-right shrink-0 ${
                      timelineBgTheme === 'sky' ? 'text-slate-400' : 'text-slate-400/80'
                    }`}
                  >
                    {val}
                  </span>
                  <div
                    className={`flex-1 border-b border-dashed ${
                      timelineBgTheme === 'sky' ? 'border-sky-200' : 'border-white/10'
                    }`}
                  />
                </div>
              );
            })}
            <div className="w-full flex items-center gap-2">
              <span
                className={`text-[10px] font-mono tabular-nums w-8 text-right shrink-0 ${
                  timelineBgTheme === 'sky' ? 'text-slate-400' : 'text-slate-400/80'
                }`}
              >
                0
              </span>
              <div
                className={`flex-1 border-b ${
                  timelineBgTheme === 'sky' ? 'border-sky-300' : 'border-white/20'
                }`}
              />
            </div>
          </div>

          {/* Bar Chart Bars Container */}
          <div className="h-56 w-full flex items-end gap-2 sm:gap-4 pl-10 pr-2">
            {timelineData.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-6">
                <Calendar className="w-8 h-8 text-slate-400 mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-300">ยังไม่มีข้อมูลบันทึกในช่วงที่เลือก</p>
                <p className="text-xs text-slate-400 mt-1">
                  เมื่อมีการบันทึกการปฏิบัติงานแพทย์ กราฟแนวโน้มรายวันจะแสดงขึ้นที่นี่โดยอัตโนมัติ
                </p>
              </div>
            ) : (
              timelineData.map((item) => {
                const heightPct = item.isLeave
                  ? 10
                  : Math.max(14, Math.round((item.patients / maxTimelinePatients) * 100));

                return (
                  <div
                    key={item.date}
                    className="flex-1 flex flex-col items-center h-full justify-end group min-w-[36px]"
                  >
                    {/* Tooltip Badge on top */}
                    <div
                      className={`text-[11px] font-mono font-black mb-1.5 px-2 py-0.5 rounded-full shadow-xs transition-transform group-hover:scale-115 ${
                        item.isLeave
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                          : timelineBgTheme === 'navy'
                          ? 'bg-slate-900/90 text-cyan-300 border border-cyan-400/60'
                          : timelineBgTheme === 'aurora'
                          ? 'bg-slate-900/90 text-emerald-300 border border-emerald-400/60'
                          : 'bg-white text-blue-900 border border-blue-200'
                      }`}
                    >
                      {item.isLeave ? 'ลา' : item.patients}
                    </div>

                    {/* Bar with Lively White Shimmer Effect */}
                    <div
                      className={`w-full max-w-[54px] rounded-t-xl transition-all duration-300 relative overflow-hidden group-hover:scale-y-[1.03] ${
                        item.isLeave
                          ? 'bg-amber-400/25 border-2 border-dashed border-amber-400'
                          : timelineBgTheme === 'navy'
                          ? 'bg-gradient-to-t from-blue-700 via-sky-500 to-cyan-300 shadow-lg shadow-cyan-500/25 group-hover:from-blue-600 group-hover:to-cyan-200'
                          : timelineBgTheme === 'aurora'
                          ? 'bg-gradient-to-t from-emerald-700 via-teal-500 to-cyan-300 shadow-lg shadow-teal-500/25 group-hover:from-emerald-600 group-hover:to-cyan-200'
                          : 'bg-gradient-to-t from-blue-700 via-blue-600 to-sky-400 shadow-md shadow-blue-500/20 group-hover:from-blue-600 group-hover:to-sky-300'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${item.displayDate} - ${item.hospital}: ${
                        item.isLeave ? 'แพทย์ลา' : `${item.patients} ราย`
                      }`}
                    >
                      {/* Animated white light wave sweep across the bar */}
                      {!item.isLeave && (
                        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-white-shimmer pointer-events-none" />
                      )}
                    </div>

                    {/* Date and Hospital Labels Below */}
                    <div className="mt-2.5 text-center flex flex-col items-center">
                      <div
                        className={`text-[11px] font-bold truncate max-w-[68px] ${
                          timelineBgTheme === 'sky' ? 'text-slate-800' : 'text-white'
                        }`}
                      >
                        {item.displayDate}
                      </div>
                      <div
                        className={`text-[10px] font-semibold truncate max-w-[68px] mt-0.5 px-1.5 py-0.2 rounded ${
                          timelineBgTheme === 'sky'
                            ? 'text-sky-950 bg-sky-200/70'
                            : 'text-sky-200/90 bg-white/10'
                        }`}
                      >
                        {item.hospital}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown Matrix Table for Official Review */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-700" />
          <span>ตารางวิเคราะห์ภาระงานรายพื้นที่ รพ.สต. ในสังกัด อบจ.เชียงใหม่</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-sky-50 text-blue-950 font-semibold border-b border-sky-100">
              <tr>
                <th className="px-3 py-2.5">รพ.สต.</th>
                <th className="px-3 py-2.5 text-center">วันตรวจ</th>
                <th className="px-3 py-2.5 text-right">4.1 ทั่วไป</th>
                <th className="px-3 py-2.5 text-right">4.2 เรื้อรัง</th>
                <th className="px-3 py-2.5 text-right">4.3 เยี่ยมบ้าน</th>
                <th className="px-3 py-2.5 text-right">4.4 ใบรับรอง</th>
                <th className="px-3 py-2.5 text-right">4.5 หัตถการ</th>
                <th className="px-3 py-2.5 text-right font-bold text-blue-900">รวมทั้งหมด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {hospitalBreakdown.map((row) => (
                <tr key={row.hospital} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-900">{row.hospital}</td>
                  <td className="px-3 py-2.5 text-center font-mono">{row.activeDays} วัน</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.gp}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.cc}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.hv}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.mc}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.sp}</td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-blue-900 bg-sky-50/50">
                    {row.totalPatients.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-semibold text-slate-900 border-t-2 border-slate-300">
              <tr>
                <td className="px-3 py-2.5 font-bold">รวมทุกพื้นที่</td>
                <td className="px-3 py-2.5 text-center font-mono font-bold">
                  {hospitalBreakdown.reduce((s, r) => s + r.activeDays, 0)} วัน
                </td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{aggregates.gp}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{aggregates.cc}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{aggregates.hv}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{aggregates.mc}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums">{aggregates.sp}</td>
                <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-blue-950 bg-sky-200/40">
                  {aggregates.total.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
