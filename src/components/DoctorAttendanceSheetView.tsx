import React, { useState, useMemo } from 'react';
import {
  Printer,
  Calendar,
  Building2,
  FileCheck2,
  Settings,
  Sparkles,
  User,
  CheckCircle2,
  Info,
  Clock,
  ChevronDown,
} from 'lucide-react';
import { MedicalLogEntry, HOSPITALS, DEFAULT_DOCTOR_NAME } from '../types';
import { THAI_MONTHS_FULL, toThaiDigits } from '../utils/storage';

interface DoctorAttendanceSheetViewProps {
  records: MedicalLogEntry[];
}

// Thai short month names
const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

// Default official Thai public holidays (MM-DD)
const DEFAULT_THAI_HOLIDAYS: Record<string, string> = {
  '01-01': 'วันขึ้นปีใหม่',
  '01-02': 'วันหยุดชดเชยวันขึ้นปีใหม่',
  '02-26': 'วันมาฆบูชา',
  '04-06': 'วันจักรี',
  '04-13': 'วันสงกรานต์',
  '04-14': 'วันสงกรานต์',
  '04-15': 'วันสงกรานต์',
  '05-01': 'วันแรงงานแห่งชาติ',
  '05-04': 'วันฉัตรมงคล',
  '06-03': 'วันเฉลิมพระชนมพรรษา สมเด็จพระบรมราชินี',
  '07-28': 'วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว',
  '08-12': 'วันแม่แห่งชาติ',
  '10-13': 'วันนวมินทรมหาราช', // Matches sample image: 13 ต.ค. วันหยุดนักขัตฤกษ์
  '10-23': 'วันปิยมหาราช',
  '12-05': 'วันคล้ายวันพระบรมราชสมภพ ร.9 / วันพ่อแห่งชาติ',
  '12-10': 'วันรัฐธรรมนูญ',
  '12-31': 'วันสิ้นปี',
};

/**
 * Helper to parse time-in and time-out from workTime (เวลาที่มาปฏิบัติงาน)
 * Examples:
 * - "08.30 – 16.30 น." -> { timeIn: "08.30", timeOut: "16.30" }
 * - "08.30 – 12.00 น." -> { timeIn: "08.30", timeOut: "12.00" }
 * - "09.00 – 12.00 น." -> { timeIn: "09.00", timeOut: "12.00" }
 * - "09.00 – 16.00 น." -> { timeIn: "09.00", timeOut: "16.00" }
 * - "08.30 – 15.00 น." -> { timeIn: "08.30", timeOut: "15.00" }
 * - "09.00 – 15.00 น." -> { timeIn: "09.00", timeOut: "15.00" }
 * - "08:30 - 16:30"    -> { timeIn: "08.30", timeOut: "16.30" }
 * - "แพทย์ลา"          -> { timeIn: "", timeOut: "" }
 */
function parseWorkTimes(workTimeString?: string): { timeIn: string; timeOut: string } {
  if (!workTimeString || typeof workTimeString !== 'string') {
    return { timeIn: '', timeOut: '' };
  }
  const cleanStr = workTimeString.trim();
  if (cleanStr === '' || cleanStr.includes('แพทย์ลา')) {
    return { timeIn: '', timeOut: '' };
  }

  // Regex matches time formats like 08.30, 8.30, 08:30, 8:30
  const matches = cleanStr.match(/(\d{1,2})[.:](\d{2})/g);
  if (!matches || matches.length === 0) {
    return { timeIn: '', timeOut: '' };
  }

  const normalizeTime = (raw: string) => {
    const parts = raw.replace(':', '.').split('.');
    const hour = parts[0].padStart(2, '0');
    const minute = (parts[1] || '00').slice(0, 2);
    return `${hour}.${minute}`;
  };

  if (matches.length >= 2) {
    return {
      timeIn: normalizeTime(matches[0]),
      timeOut: normalizeTime(matches[matches.length - 1]),
    };
  }

  return {
    timeIn: normalizeTime(matches[0]),
    timeOut: '',
  };
}

export const DoctorAttendanceSheetView: React.FC<DoctorAttendanceSheetViewProps> = ({ records }) => {
  // Current date defaults
  const now = new Date();
  const currentYearBE = now.getFullYear() + 543;

  // Selected Month (0 = ม.ค., 9 = ต.ค., etc.)
  // Default to October (index 9) to match user's sample document or current month
  const [selectedMonthIndex, setSelectedMonthIndex] = useState<number>(9);
  const [selectedYearBE, setSelectedYearBE] = useState<number>(currentYearBE);

  // Service unit / Hospital name (Default: โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านสันโค้ง as requested)
  const [hospitalTitle, setHospitalTitle] = useState<string>('โรงพยาบาลส่งเสริมสุขภาพตำบลบ้านสันโค้ง');
  const [doctorPosition, setDoctorPosition] = useState<string>('นายแพทย์');
  const [doctorFullName, setDoctorFullName] = useState<string>(DEFAULT_DOCTOR_NAME);

  // Settings
  const [useThaiDigits, setUseThaiDigits] = useState<boolean>(true);
  const [useThaiDigitsForTime, setUseThaiDigitsForTime] = useState<boolean>(false);
  const [autoFillDoctorInfo, setAutoFillDoctorInfo] = useState<boolean>(true);
  const [showSettingsPanel, setShowSettingsPanel] = useState<boolean>(false);

  // Committee names (defaults to empty dots as per government template)
  const [chairpersonName, setChairpersonName] = useState<string>('');
  const [committee1Name, setCommittee1Name] = useState<string>('');
  const [committee2Name, setCommittee2Name] = useState<string>('');

  // Custom Holiday overrides (key: 'YYYY-MM-DD' or day number)
  const [customHolidays, setCustomHolidays] = useState<Record<number, { isHoliday: boolean; title?: string }>>({});

  // Summary counts (can be auto-calculated or manually tuned)
  const [manualDutyDays, setManualDutyDays] = useState<string>('');
  const [manualSickLeaveDays, setManualSickLeaveDays] = useState<string>('');
  const [manualVacationDays, setManualVacationDays] = useState<string>('');
  const [manualVacationDateRange, setManualVacationDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  // Calculate year CE (Christian Era) from Buddhist Era
  const yearCE = selectedYearBE - 543;
  const monthNumStr = String(selectedMonthIndex + 1).padStart(2, '0');
  const selectedYM = `${yearCE}-${monthNumStr}`;

  // Total days in selected month
  const totalDaysInMonth = useMemo(() => {
    return new Date(yearCE, selectedMonthIndex + 1, 0).getDate();
  }, [yearCE, selectedMonthIndex]);

  // Generate all days in month with metadata
  const daysData = useMemo(() => {
    const list = [];
    const shortYear = String(selectedYearBE).slice(-2);

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const dateObj = new Date(yearCE, selectedMonthIndex, day);
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      const mmDdKey = `${monthNumStr}-${String(day).padStart(2, '0')}`;
      const defaultHolidayName = DEFAULT_THAI_HOLIDAYS[mmDdKey];

      // Check custom override
      const custom = customHolidays[day];
      let isHoliday = isWeekend || Boolean(defaultHolidayName);
      let holidayTitle = defaultHolidayName || (isWeekend ? 'เสาร์-อาทิตย์' : '');

      if (custom !== undefined) {
        isHoliday = custom.isHoliday;
        if (custom.title !== undefined) holidayTitle = custom.title;
      }

      // Check if there are actual work logs on this day in records
      const dateIso = `${yearCE}-${monthNumStr}-${String(day).padStart(2, '0')}`;
      const dayRecords = records.filter((r) => r.date === dateIso);
      const isDoctorLeave = dayRecords.some((r) => r.workTime === 'แพทย์ลา');
      const workingRecords = dayRecords.filter((r) => r.workTime && r.workTime !== 'แพทย์ลา');
      const hasWorked = workingRecords.length > 0;
      const dayRecord = dayRecords[0];

      // Extract timeIn (เวลามา) and timeOut (เวลากลับ) from เวลามาปฏิบัติงาน (workTime)
      let timeIn = '';
      let timeOut = '';

      if (hasWorked) {
        const parsedList = workingRecords
          .map((r) => parseWorkTimes(r.workTime))
          .filter((t) => t.timeIn || t.timeOut);

        if (parsedList.length > 0) {
          const ins = parsedList.map((t) => t.timeIn).filter(Boolean).sort();
          const outs = parsedList.map((t) => t.timeOut).filter(Boolean).sort();
          timeIn = ins[0] || '';
          timeOut = outs[outs.length - 1] || '';
        }
      }

      // Thai formatted date string
      const dayStr = useThaiDigits ? toThaiDigits(day) : String(day);
      const monthShort = THAI_MONTHS_SHORT[selectedMonthIndex];
      const yearStr = useThaiDigits ? toThaiDigits(shortYear) : shortYear;
      const displayDate = `${dayStr} ${monthShort} ${yearStr}`;

      list.push({
        day,
        dateIso,
        dateObj,
        dayOfWeek,
        isWeekend,
        isHoliday,
        holidayTitle,
        hasWorked,
        isDoctorLeave,
        dayRecord,
        timeIn,
        timeOut,
        displayDate,
      });
    }

    return list;
  }, [yearCE, selectedMonthIndex, selectedYearBE, totalDaysInMonth, monthNumStr, customHolidays, records, useThaiDigits]);

  // Split days for 2 A4 Pages: Page 1 (days 1 to 22), Page 2 (days 23 to end)
  const page1Days = useMemo(() => daysData.filter((d) => d.day <= 22), [daysData]);
  const page2Days = useMemo(() => daysData.filter((d) => d.day >= 23), [daysData]);

  // Helper to format time display based on user preference
  const formatTimeDisplay = (timeStr?: string) => {
    if (!timeStr) return '';
    return useThaiDigitsForTime ? toThaiDigits(timeStr) : timeStr;
  };

  // Calculations for summary
  const calculatedDutyDays = useMemo(() => {
    const worked = daysData.filter((d) => d.hasWorked).length;
    if (worked > 0) return worked;
    // Fallback: estimate weekdays minus holidays
    return daysData.filter((d) => !d.isHoliday).length;
  }, [daysData]);

  const calculatedDoctorLeaveDays = useMemo(() => {
    return daysData.filter((d) => d.isDoctorLeave).length;
  }, [daysData]);

  const finalDutyDays = manualDutyDays !== '' ? manualDutyDays : String(calculatedDutyDays);
  const finalDutyDaysDisplay = useThaiDigits ? toThaiDigits(finalDutyDays) : finalDutyDays;

  const finalSickDays = manualSickLeaveDays !== '' ? manualSickLeaveDays : (calculatedDoctorLeaveDays > 0 ? String(calculatedDoctorLeaveDays) : '');
  const finalSickDaysDisplay = finalSickDays ? (useThaiDigits ? toThaiDigits(finalSickDays) : finalSickDays) : '';

  const finalVacationDaysDisplay = manualVacationDays ? (useThaiDigits ? toThaiDigits(manualVacationDays) : manualVacationDays) : '';

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Toggle holiday status for any specific day
  const handleToggleHoliday = (day: number) => {
    setCustomHolidays((prev) => {
      const current = prev[day];
      const defaultState = daysData.find((d) => d.day === day)?.isHoliday ?? false;
      const nextIsHoliday = current !== undefined ? !current.isHoliday : !defaultState;
      return {
        ...prev,
        [day]: {
          isHoliday: nextIsHoliday,
          title: nextIsHoliday ? 'วันหยุดนักขัตฤกษ์' : '',
        },
      };
    });
  };

  // Thai Month and Year display strings
  const thaiMonthName = THAI_MONTHS_FULL[selectedMonthIndex];
  const thaiYearDisplay = useThaiDigits ? toThaiDigits(selectedYearBE) : String(selectedYearBE);

  return (
    <div className="space-y-6">
      {/* Control Bar (Screen only, hidden on print) */}
      <div className="no-print bg-white rounded-2xl border-2 border-teal-200/80 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 flex items-center justify-center text-white shadow-sm ring-2 ring-teal-500/20 shrink-0">
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  รายงานใบลงชื่อปฏิบัติงาน
                </h2>
                <span className="text-[11px] font-bold text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded-full border border-teal-200">
                  เอกสารมาตรฐาน 2 หน้า A4
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                ใบลงชื่อปฏิบัติงานพนักงานจ้างเหมาบริการหน่วยบริการประจำ ตามระเบียบงานสารบรรณ พร้อมไฮไลต์วันหยุดเสาร์-อาทิตย์
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
            <button
              onClick={() => setShowSettingsPanel(!showSettingsPanel)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>ปรับแต่งหัวเอกสาร/กรรมการ</span>
            </button>

            <button
              onClick={() => setUseThaiDigits(!useThaiDigits)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              title="สลับการแสดงผลตัวเลขอารบิก / เลขไทย"
            >
              <span>{useThaiDigits ? 'เลขไทย (๑ ๒ ๓)' : 'เลขอารบิก (1 2 3)'}</span>
            </button>

            <button
              onClick={() => setAutoFillDoctorInfo(!autoFillDoctorInfo)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                autoFillDoctorInfo
                  ? 'bg-blue-50 text-blue-900 border-blue-300'
                  : 'bg-amber-50 text-amber-900 border-amber-300'
              }`}
              title="เปิด/ปิดการใส่ชื่อแพทย์และเวลาทำงานอัตโนมัติ"
            >
              <span>{autoFillDoctorInfo ? 'กรอกชื่อแพทย์อัตโนมัติ' : 'แบบฟอร์มว่างสำหรับเซ็น'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-98 cursor-pointer ring-2 ring-teal-500/20 font-bold text-xs sm:text-sm group"
            >
              <Printer className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>พิมพ์ใบลงชื่อ (Ctrl + P)</span>
            </button>
          </div>
        </div>

        {/* Selection Strip: Month, Year, Hospital */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          {/* Month Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              <span>เลือกประจำเดือน:</span>
            </label>
            <select
              value={selectedMonthIndex}
              onChange={(e) => setSelectedMonthIndex(parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {THAI_MONTHS_FULL.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-700" />
              <span>เลือกปี พ.ศ.:</span>
            </label>
            <select
              value={selectedYearBE}
              onChange={(e) => setSelectedYearBE(parseInt(e.target.value, 10))}
              className="w-full bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500 cursor-pointer"
            >
              {[2567, 2568, 2569, 2570, 2571, 2572].map((yr) => (
                <option key={yr} value={yr}>
                  พ.ศ. {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Hospital / Service Unit Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-teal-700" />
              <span>หน่วยบริการ (โรงพยาบาลส่งเสริมสุขภาพตำบล):</span>
            </label>
            <input
              type="text"
              value={hospitalTitle}
              onChange={(e) => setHospitalTitle(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500"
              placeholder="พิมพ์ชื่อโรงพยาบาลส่งเสริมสุขภาพตำบล..."
            />
          </div>
        </div>

        {/* Expandable Settings Panel */}
        {showSettingsPanel && (
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3 mt-2 text-xs animate-fadeIn">
            <h4 className="font-bold text-slate-800 flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-teal-700" />
              <span>ปรับแต่งรายชื่อคณะกรรมการตรวจรับพัสดุ และข้อมูลสรุป</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  ประธานกรรมการ:
                </label>
                <input
                  type="text"
                  value={chairpersonName}
                  onChange={(e) => setChairpersonName(e.target.value)}
                  placeholder="เช่น นางสาวสมศรี มีสุข (เว้นว่างไว้เป็นจุดไข่ปลา)"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  กรรมการ คนที่ 1:
                </label>
                <input
                  type="text"
                  value={committee1Name}
                  onChange={(e) => setCommittee1Name(e.target.value)}
                  placeholder="เช่น นายมานพ สุขใจ (เว้นว่างไว้เป็นจุดไข่ปลา)"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  กรรมการ คนที่ 2:
                </label>
                <input
                  type="text"
                  value={committee2Name}
                  onChange={(e) => setCommittee2Name(e.target.value)}
                  placeholder="เช่น นางสมหมาย ใจดี (เว้นว่างไว้เป็นจุดไข่ปลา)"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  สรุปวันปฏิบัติงานจริง (ระบุตัวเลขหรือเว้นว่างให้คำนวณอัตโนมัติ):
                </label>
                <input
                  type="text"
                  value={manualDutyDays}
                  onChange={(e) => setManualDutyDays(e.target.value)}
                  placeholder={`คำนวณอัตโนมัติ: ${calculatedDutyDays} วัน`}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  ลาป่วย/ลากิจ (วัน):
                </label>
                <input
                  type="text"
                  value={manualSickLeaveDays}
                  onChange={(e) => setManualSickLeaveDays(e.target.value)}
                  placeholder="เช่น 1 (เว้นว่างถ้าไม่มี)"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  ลาพักผ่อน (วัน):
                </label>
                <input
                  type="text"
                  value={manualVacationDays}
                  onChange={(e) => setManualVacationDays(e.target.value)}
                  placeholder="เช่น 2 (เว้นว่างถ้าไม่มี)"
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer font-medium hover:text-teal-900 select-none">
                <input
                  type="checkbox"
                  checked={useThaiDigitsForTime}
                  onChange={(e) => setUseThaiDigitsForTime(e.target.checked)}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer w-3.5 h-3.5"
                />
                <span>แสดงเวลามา-กลับ เป็นตัวเลขไทย (เช่น ๐๘.๓๐, ๑๖.๓๐)</span>
              </label>

              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>
                  คำแนะนำ: สามารถคลิกที่วันในตารางเพื่อสลับสถานะเป็นวันหยุดนักขัตฤกษ์ (แถบสีเหลือง) ได้โดยตรง
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Printable 2-Page A4 Container */}
      <div className="print-area flex flex-col items-center gap-8 py-2">
        {/* ========================================================= */}
        {/* PAGE 1: Header + Table Days 1 to 16 */}
        {/* ========================================================= */}
        <div
          className="attendance-page a4-page-1 bg-white shadow-xl border border-slate-300 font-sarabun text-black relative flex flex-col justify-between"
          style={{
            width: '210mm',
            minHeight: '297mm',
            maxHeight: '297mm',
            height: '297mm',
            paddingTop: '20mm',
            paddingBottom: '20mm',
            paddingLeft: '20mm',
            paddingRight: '15mm',
            boxSizing: 'border-box',
            pageBreakAfter: 'always',
            breakAfter: 'page',
          }}
        >
          {/* Page Badge on Screen */}
          <div className="no-print absolute top-3 right-4 bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-teal-200">
            หน้า 1 จาก 2
          </div>

          <div>
            {/* Header: 4 Lines Centered - TH Sarabun 16pt Bold */}
            <div className="text-center pb-2 space-y-0.5">
              {/* บรรทัดที่ 1 */}
              <p
                className="font-bold tracking-tight m-0 p-0 text-black leading-tight"
                style={{ fontSize: '16pt' }}
              >
                ใบลงชื่อปฏิบัติงานพนักงานจ้างเหมาบริการหน่วยบริการประจำ
              </p>

              {/* บรรทัดที่ 2 */}
              <p
                className="font-bold tracking-tight m-0 p-0 text-black leading-tight"
                style={{ fontSize: '16pt' }}
              >
                {hospitalTitle}
              </p>

              {/* บรรทัดที่ 3 */}
              <p
                className="font-bold tracking-tight m-0 p-0 text-black leading-tight"
                style={{ fontSize: '16pt' }}
              >
                ตำแหน่ง {doctorPosition}
              </p>

              {/* บรรทัดที่ 4 */}
              <p
                className="font-bold tracking-tight m-0 p-0 text-black leading-tight"
                style={{ fontSize: '16pt' }}
              >
                ประจำเดือน ........{thaiMonthName}.............พ.ศ. ..............{thaiYearDisplay}..................
              </p>
            </div>

            {/* Table Part 1 (Days 1 to 22) */}
            <div className="mt-1.5">
              <table
                className="w-full border-collapse"
                style={{
                  border: '1px solid #000000',
                  borderCollapse: 'collapse',
                  fontSize: '15pt',
                  lineHeight: '1.25',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#ffffff', fontWeight: 'bold' }}>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '13%',
                        textAlign: 'center',
                      }}
                    >
                      วัน/เดือน/ปี
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 4px',
                        width: '31%',
                        textAlign: 'center',
                      }}
                    >
                      รายชื่อพนักงาน
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '12%',
                        textAlign: 'center',
                      }}
                    >
                      ลายมือชื่อ
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '11%',
                        textAlign: 'center',
                      }}
                    >
                      เวลามา
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '12%',
                        textAlign: 'center',
                      }}
                    >
                      ลายมือชื่อ
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '11%',
                        textAlign: 'center',
                      }}
                    >
                      เวลากลับ
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '10%',
                        textAlign: 'center',
                      }}
                    >
                      หมายเหตุ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page1Days.map((item) => {
                    const isYellow = item.isHoliday;
                    // Check if holiday name is official public holiday
                    const isPublicHolidayText = item.isHoliday && !item.isWeekend;

                    return (
                      <tr
                        key={item.day}
                        style={{
                          backgroundColor: isYellow ? '#ffff00' : '#ffffff',
                          height: '24px',
                        }}
                        className="hover:opacity-90"
                      >
                        {/* 1. วัน/เดือน/ปี */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                            fontWeight: 'normal',
                          }}
                        >
                          {item.displayDate}
                        </td>

                        {/* 2. รายชื่อพนักงาน */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            padding: '2px 4px',
                            textAlign: isPublicHolidayText ? 'center' : 'left',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isPublicHolidayText ? (
                            <span style={{ color: '#ff0000', fontWeight: 'bold' }}>
                              วันหยุดนักขัตฤกษ์
                            </span>
                          ) : isYellow ? (
                            ''
                          ) : autoFillDoctorInfo ? (
                            doctorFullName
                          ) : (
                            ''
                          )}
                        </td>

                        {/* 3. ลายมือชื่อ (มา) */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                          }}
                        ></td>

                        {/* 4. เวลามา */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                          }}
                        >
                          {!isYellow && autoFillDoctorInfo
                            ? (item.hasWorked ? formatTimeDisplay(item.timeIn || '08.30') : '')
                            : ''}
                        </td>

                        {/* 5. ลายมือชื่อ (กลับ) */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                          }}
                        ></td>

                        {/* 6. เวลากลับ */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                          }}
                        >
                          {!isYellow && autoFillDoctorInfo
                            ? (item.hasWorked ? formatTimeDisplay(item.timeOut || '16.30') : '')
                            : ''}
                        </td>

                        {/* 7. หมายเหตุ */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                            fontSize: '13pt',
                          }}
                        >
                          {item.isDoctorLeave ? 'แพทย์ลา' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Page 1 Bottom Footer Note */}
          <div className="pt-2 text-right text-[11pt] text-slate-500 font-sarabun">
            <span>(ต่อหน้าที่ ๒)</span>
          </div>
        </div>

        {/* ========================================================= */}
        {/* PAGE 2: Table Days 17 to End + Footer Legend + Signatures */}
        {/* ========================================================= */}
        <div
          className="attendance-page a4-page-2 bg-white shadow-xl border border-slate-300 font-sarabun text-black relative flex flex-col justify-between"
          style={{
            width: '210mm',
            minHeight: '297mm',
            maxHeight: '297mm',
            height: '297mm',
            paddingTop: '20mm',
            paddingBottom: '20mm',
            paddingLeft: '20mm',
            paddingRight: '15mm',
            boxSizing: 'border-box',
          }}
        >
          {/* Page Badge on Screen */}
          <div className="no-print absolute top-3 right-4 bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-teal-200">
            หน้า 2 จาก 2
          </div>

          <div>
            {/* Header: 4 Lines Centered - Same as Page 1 */}
            <div className="text-center pb-2 space-y-0.5">
              {/* บรรทัดที่ 1 */}
              <p
                className="font-bold tracking-tight m-0 p-0 text-black leading-tight"
                style={{ fontSize: '16pt' }}
              >
                ใบลงชื่อปฏิบัติงานพนักงานจ้างเหมาบริการหน่วยบริการประจำ (ต่อ)
              </p>

              {/* บรรทัดที่ 2 */}
              <p
                className="font-bold tracking-tight m-0 p-0 text-black leading-tight"
                style={{ fontSize: '16pt' }}
              >
                {hospitalTitle}
              </p>

              {/* บรรทัดที่ 3 */}
              <p
                className="font-bold tracking-tight m-0 p-0 text-black leading-tight"
                style={{ fontSize: '16pt' }}
              >
                ตำแหน่ง {doctorPosition}
              </p>

              {/* บรรทัดที่ 4 */}
              <p
                className="font-bold tracking-tight m-0 p-0 text-black leading-tight"
                style={{ fontSize: '16pt' }}
              >
                ประจำเดือน ........{thaiMonthName}.............พ.ศ. ..............{thaiYearDisplay}..................
              </p>
            </div>

            {/* Table Part 2 (Days 23 to End of Month) */}
            <div className="mt-1">
              <table
                className="w-full border-collapse"
                style={{
                  border: '1px solid #000000',
                  borderCollapse: 'collapse',
                  fontSize: '15pt',
                  lineHeight: '1.25',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#ffffff', fontWeight: 'bold' }}>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '13%',
                        textAlign: 'center',
                      }}
                    >
                      วัน/เดือน/ปี
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 4px',
                        width: '31%',
                        textAlign: 'center',
                      }}
                    >
                      รายชื่อพนักงาน
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '12%',
                        textAlign: 'center',
                      }}
                    >
                      ลายมือชื่อ
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '11%',
                        textAlign: 'center',
                      }}
                    >
                      เวลามา
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '12%',
                        textAlign: 'center',
                      }}
                    >
                      ลายมือชื่อ
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '11%',
                        textAlign: 'center',
                      }}
                    >
                      เวลากลับ
                    </th>
                    <th
                      style={{
                        border: '1px solid #000000',
                        padding: '3px 2px',
                        width: '10%',
                        textAlign: 'center',
                      }}
                    >
                      หมายเหตุ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page2Days.map((item) => {
                    const isYellow = item.isHoliday;
                    const isPublicHolidayText = item.isHoliday && !item.isWeekend;

                    return (
                      <tr
                        key={item.day}
                        style={{
                          backgroundColor: isYellow ? '#ffff00' : '#ffffff',
                          height: '26px',
                        }}
                        className="hover:opacity-90"
                      >
                        {/* 1. วัน/เดือน/ปี */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                          }}
                        >
                          {item.displayDate}
                        </td>

                        {/* 2. รายชื่อพนักงาน */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            padding: '2px 4px',
                            textAlign: isPublicHolidayText ? 'center' : 'left',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {isPublicHolidayText ? (
                            <span style={{ color: '#ff0000', fontWeight: 'bold' }}>
                              วันหยุดนักขัตฤกษ์
                            </span>
                          ) : isYellow ? (
                            ''
                          ) : autoFillDoctorInfo ? (
                            doctorFullName
                          ) : (
                            ''
                          )}
                        </td>

                        {/* 3. ลายมือชื่อ (มา) */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                          }}
                        ></td>

                        {/* 4. เวลามา */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                          }}
                        >
                          {!isYellow && autoFillDoctorInfo
                            ? (item.hasWorked ? formatTimeDisplay(item.timeIn || '08.30') : '')
                            : ''}
                        </td>

                        {/* 5. ลายมือชื่อ (กลับ) */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                          }}
                        ></td>

                        {/* 6. เวลากลับ */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                          }}
                        >
                          {!isYellow && autoFillDoctorInfo
                            ? (item.hasWorked ? formatTimeDisplay(item.timeOut || '16.30') : '')
                            : ''}
                        </td>

                        {/* 7. หมายเหตุ */}
                        <td
                          style={{
                            border: '1px solid #000000',
                            textAlign: 'center',
                            padding: '2px 2px',
                            fontSize: '13pt',
                          }}
                        >
                          {item.isDoctorLeave ? 'แพทย์ลา' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Footer Section: Legend & Summary of Duty/Leave Days */}
            <div
              className="mt-3.5 space-y-1 text-black font-sarabun pl-4 sm:pl-8"
              style={{ fontSize: '16pt', lineHeight: '1.4' }}
            >
              {/* หมายเหตุ : [กล่องสีเหลือง] เสาร์-อาทิตย์ ,วันหยุดนักขัตฤกษ์ */}
              <div className="flex items-center gap-2">
                <span>หมายเหตุ :</span>
                <span
                  style={{
                    display: 'inline-block',
                    width: '32px',
                    height: '18px',
                    backgroundColor: '#ffff00',
                    border: '1px solid #000000',
                  }}
                ></span>
                <span className="ml-1">เสาร์-อาทิตย์ ,วันหยุดนักขัตฤกษ์</span>
              </div>

              {/* สรุปวันปฏิบัตงานจริง */}
              <div className="whitespace-nowrap">
                <span>สรุปวันปฏิบัตงานจริง...........</span>
                <span className="font-bold text-black">{finalDutyDaysDisplay || (useThaiDigits ? '๒๐' : '20')}</span>
                <span>............วัน</span>
              </div>

              {/* ลาป่วย/ลากิจ */}
              <div className="whitespace-nowrap">
                <span>ลาป่วย/ลากิจ/............................................... วัน</span>
              </div>

              {/* ลาพักผ่อน (ไม่มีช่องว่าง อยู่บรรทัดเดียวกัน) */}
              <div className="whitespace-nowrap">
                <span>ลาพักผ่อน....................วัน,ตั้งแต่วันที่.............................ถึง.........................</span>
              </div>
            </div>
          </div>

          {/* Signatures Section: Centered Beautiful Layout */}
          <div
            className="pb-2 text-black font-sarabun space-y-4"
            style={{ fontSize: '16pt', lineHeight: '1.3' }}
          >
            {/* 1. ผู้ส่งมอบงาน */}
            <div className="flex justify-center text-center">
              <div className="inline-flex flex-col items-center">
                <div className="whitespace-nowrap">
                  <span>(ลงชื่อ)................................................................................</span>
                  <span className="font-bold">ผู้ส่งมอบงาน</span>
                </div>
                <div className="mt-1">
                  <span>({doctorFullName})</span>
                </div>
              </div>
            </div>

            {/* คณะกรรมการตรวจรับพัสดุ */}
            <div className="text-center font-bold" style={{ fontSize: '17pt' }}>
              <p className="m-0 p-0">คณะกรรมการตรวจรับพัสดุ</p>
            </div>

            {/* 2. ประธานกรรมการ */}
            <div className="flex justify-center text-center">
              <div className="inline-flex flex-col items-center">
                <div className="whitespace-nowrap">
                  <span>(ลงชื่อ)....................................................................</span>
                  <span className="font-bold">ประธานกรรมการ</span>
                </div>
                <div className="mt-1">
                  <span>
                    ({chairpersonName ? chairpersonName : '....................................................................'})
                  </span>
                </div>
              </div>
            </div>

            {/* 3. กรรมการ คนที่ 1 */}
            <div className="flex justify-center text-center">
              <div className="inline-flex flex-col items-center">
                <div className="whitespace-nowrap">
                  <span>(ลงชื่อ)......................................................................... </span>
                  <span className="font-bold">กรรมการ</span>
                </div>
                <div className="mt-1">
                  <span>
                    ({committee1Name ? committee1Name : '....................................................................'})
                  </span>
                </div>
              </div>
            </div>

            {/* 4. กรรมการ คนที่ 2 */}
            <div className="flex justify-center text-center">
              <div className="inline-flex flex-col items-center">
                <div className="whitespace-nowrap">
                  <span>(ลงชื่อ)......................................................................... </span>
                  <span className="font-bold">กรรมการ</span>
                </div>
                <div className="mt-1">
                  <span>
                    ({committee2Name ? committee2Name : '....................................................................'})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Print Stylesheet for exact 2-Page A4 Printing */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .no-print {
            display: none !important;
          }

          .print-area {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          .attendance-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
          }

          .a4-page-1 {
            page-break-after: always !important;
            break-after: page !important;
          }

          .a4-page-2 {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }

          /* Force exact yellow highlight printing */
          tr[style*="background-color: #ffff00"],
          tr[style*="background-color: rgb(255, 255, 0)"] {
            background-color: #ffff00 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          span[style*="background-color: #ffff00"] {
            background-color: #ffff00 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </div>
  );
};
