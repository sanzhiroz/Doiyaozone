import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Printer,
  Calendar,
  ChevronDown,
  Building2,
  FileCheck2,
  Info,
  Settings,
} from 'lucide-react';
import { MedicalLogEntry, HOSPITALS, DEFAULT_DOCTOR_NAME } from '../types';
import { THAI_MONTHS_FULL, toThaiDigits } from '../utils/storage';

interface MonthlyReportPDFViewProps {
  records: MedicalLogEntry[];
}


export const MonthlyReportPDFView: React.FC<MonthlyReportPDFViewProps> = ({ records }) => {
  // Determine available months from records
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    records.forEach((r) => {
      if (r.date && r.date.length >= 7) {
        monthSet.add(r.date.slice(0, 7)); // YYYY-MM
      }
    });

    // Also include current month and previous few months if not already present
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthSet.add(ym);
    }

    return Array.from(monthSet).sort().reverse();
  }, [records]);

  // Selected month (YYYY-MM), default to first available with data or current
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    if (availableMonths.length > 0) return availableMonths[0];
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Settings
  const [useThaiDigits, setUseThaiDigits] = useState<boolean>(true); // default Thai numerals as in sample image
  const [showCommitteeSettings, setShowCommitteeSettings] = useState<boolean>(false);
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);

  // Committee names (defaults to empty dots as in the template image)
  const [chairpersonName, setChairpersonName] = useState<string>('');
  const [committee1Name, setCommittee1Name] = useState<string>('');
  const [committee2Name, setCommittee2Name] = useState<string>('');

  // Custom leave note override if user wishes to tweak or append details
  const [manualLeaveNote, setManualLeaveNote] = useState<string>('');
  const [isManualNoteEnabled, setIsManualNoteEnabled] = useState<boolean>(false);

  // Parse Year and Month from selectedMonth (YYYY-MM)
  const { yearCE, yearBE, monthIndex, thaiMonthName, monthDisplayString } = useMemo(() => {
    const [yStr, mStr] = (selectedMonth || '2026-11').split('-');
    const y = parseInt(yStr, 10) || 2026;
    const m = (parseInt(mStr, 10) || 11) - 1;
    const be = y + 543;
    const mName = THAI_MONTHS_FULL[m] || 'พฤศจิกายน';
    const beStr = useThaiDigits ? toThaiDigits(be) : String(be);

    return {
      yearCE: y,
      yearBE: be,
      monthIndex: m,
      thaiMonthName: mName,
      monthDisplayString: `ประจำเดือน ${mName} พ.ศ. ${beStr}`,
    };
  }, [selectedMonth, useThaiDigits]);

  // Filter records belonging strictly to the selected month
  const monthRecords = useMemo(() => {
    return records.filter((r) => r.date && r.date.startsWith(selectedMonth));
  }, [records, selectedMonth]);

  // Extract all leave records in this month where workTime === 'แพทย์ลา'
  const leaveRecords = useMemo(() => {
    return monthRecords
      .filter((r) => r.workTime === 'แพทย์ลา' && r.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [monthRecords]);

  // Automatic leave note: "แพทย์ลา วันที่ (ดึงข้อมูลจากแพทย์ลา) จากเวลาที่มาปฏิบัติงาน"
  const autoLeaveDatesText = useMemo(() => {
    if (leaveRecords.length === 0) return '';
    // Extract unique days
    const uniqueDates = Array.from(new Set(leaveRecords.map((r) => r.date))).sort();
    const dayNumbers = uniqueDates.map((dateStr) => {
      const parts = dateStr.split('-');
      const dNum = parseInt(parts[2], 10);
      return useThaiDigits ? toThaiDigits(dNum) : String(dNum);
    });

    const daysJoined = dayNumbers.join(', ');
    const yearDisplay = useThaiDigits ? toThaiDigits(yearBE) : String(yearBE);
    return `แพทย์ลา วันที่ ${daysJoined} ${thaiMonthName} พ.ศ. ${yearDisplay}`;
  }, [leaveRecords, useThaiDigits, thaiMonthName, yearBE]);

  // Active leave note displayed under the table
  const activeLeaveNote = isManualNoteEnabled ? manualLeaveNote : autoLeaveDatesText;

  // Calculate totals across ALL service units (4 รพ.สต.) for the entire month from day 1 to end
  const aggregatedReport = useMemo(() => {
    let gp = 0; // 4.1 ตรวจวินิจฉัย รักษาโรคเบื้องต้น
    let cc = 0; // 4.2 ตรวจรักษาผู้ป่วยโรคเรื้อรัง
    let hv = 0; // 4.3 งานอื่นๆ เยี่ยมบ้านติดบ้านติดเตียง
    let mc = 0; // 4.4 ออกใบรับรองแพทย์
    let sp = 0; // 4.5 หัตถการพิเศษ อื่นๆ

    monthRecords.forEach((r) => {
      gp += Number(r.report.generalPractice) || 0;
      cc += Number(r.report.chronicCare) || 0;
      hv += Number(r.report.homeVisit) || 0;
      mc += Number(r.report.medicalCert) || 0;
      sp += Number(r.report.specialProcedure) || 0;
    });

    const total = gp + cc + hv + mc + sp;

    return {
      generalPractice: gp,
      chronicCare: cc,
      homeVisit: hv,
      medicalCert: mc,
      specialProcedure: sp,
      total,
    };
  }, [monthRecords]);

  // Hospital breakdown for transparency and verification
  const hospitalBreakdowns = useMemo(() => {
    return HOSPITALS.map((hName) => {
      const hRecords = monthRecords.filter((r) => r.hospital === hName);
      const gp = hRecords.reduce((sum, r) => sum + (Number(r.report.generalPractice) || 0), 0);
      const cc = hRecords.reduce((sum, r) => sum + (Number(r.report.chronicCare) || 0), 0);
      const hv = hRecords.reduce((sum, r) => sum + (Number(r.report.homeVisit) || 0), 0);
      const mc = hRecords.reduce((sum, r) => sum + (Number(r.report.medicalCert) || 0), 0);
      const sp = hRecords.reduce((sum, r) => sum + (Number(r.report.specialProcedure) || 0), 0);
      const total = gp + cc + hv + mc + sp;
      return {
        hospital: hName,
        days: hRecords.length,
        gp,
        cc,
        hv,
        mc,
        sp,
        total,
      };
    });
  }, [monthRecords]);

  // Helper to format values according to Thai/Arabic selection
  const fmtNum = (val: number) => {
    if (useThaiDigits) {
      return toThaiDigits(val);
    }
    return val.toLocaleString();
  };

  /**
   * Print function:
   * Opens local computer printer selection dialog directly.
   * Prints strictly the report from Line 1 to the bottom signature line,
   * sized and styled to fit perfectly on ONE page of A4 paper.
   */
  const handlePrint = useCallback(() => {
    const printContainer = document.getElementById('print-area');
    if (!printContainer) return;

    // Use an isolated hidden iframe for printing to guarantee that:
    // 1. Only the report content is sent to the printer (zero web chrome, zero outer containers)
    // 2. Fits cleanly on a single A4 page with saraban margins (top/bottom 2cm, left 3cm, right 2.5cm)
    // 3. Browser opens computer's native printer selector immediately
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    const yearDisplay = useThaiDigits ? toThaiDigits(yearBE) : String(yearBE);
    const docTitle = `รายงานผลการปฏิบัติงาน_${DEFAULT_DOCTOR_NAME}_${thaiMonthName}_${yearDisplay}`;

    // Copy all active stylesheets and style tags from host document to guarantee exact font & layout fidelity
    const headNodes = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'));
    const copiedStyles = headNodes.map((node) => node.outerHTML).join('\n');

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <title>${docTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
  ${copiedStyles}
  <style>
    @media print {
      @page {
        size: A4 portrait !important;   /* กำหนดขนาดกระดาษ A4 แนวตั้ง */
        margin-top: 2cm !important;     /* ขอบบน 2 ซม. */
        margin-right: 2.5cm !important; /* ขอบขวา 2.5 ซม. */
        margin-bottom: 2cm !important;  /* ขอบล่าง 2 ซม. */
        margin-left: 3cm !important;    /* ขอบซ้าย 3 ซม. (ตามระเบียบงานสารบรรณ) */
      }
      body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
    }
    @page {
      size: A4 portrait !important;
      margin-top: 2cm !important;
      margin-right: 2.5cm !important;
      margin-bottom: 2cm !important;
      margin-left: 3cm !important;
    }
    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'TH Sarabun PSK', 'TH Sarabun New', 'Sarabun', sans-serif !important;
    }
    .print-sheet {
      width: 100% !important;
      max-height: 257mm !important; /* 297mm - 40mm (ขอบบน 2cm + ขอบล่าง 2cm) */
      margin: 0 !important;
      padding: 0 !important;
      background: transparent !important;
      color: #000000 !important;
      overflow: hidden !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .print-sheet #print-area {
      padding: 0 !important;
      margin: 0 !important;
      width: 100% !important;
      min-height: auto !important;
      box-shadow: none !important;
      border: none !important;
    }
    .header-block {
      text-align: center;
      margin-bottom: 12px;
    }
    .header-line {
      font-size: 18pt !important;
      font-weight: bold !important;
      line-height: 1.35 !important;
      margin: 0 0 3px 0 !important;
      padding: 0 !important;
      text-align: center !important;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-top: 8px !important;
      margin-bottom: 6px !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    th, td {
      border: 1px solid #000000 !important;
      padding: 6px 10px !important;
      font-size: 16pt !important;
      line-height: 1.35 !important;
      color: #000000 !important;
      background: #ffffff !important;
    }
    th {
      font-weight: bold !important;
      text-align: center !important;
    }
    /* Flex and signature layout helpers */
    .flex { display: flex !important; }
    .inline-flex { display: inline-flex !important; }
    .flex-col { flex-direction: column !important; }
    .justify-end { justify-content: flex-end !important; }
    .justify-center { justify-content: center !important; }
    .items-center { align-items: center !important; }
    .items-start { align-items: flex-start !important; }
    .whitespace-nowrap { white-space: nowrap !important; }
    .text-center { text-align: center !important; }
    .text-left { text-align: left !important; }
    .w-full { width: 100% !important; }
    .block { display: block !important; }
    .invisible { visibility: hidden !important; }
    .opacity-0 { opacity: 0 !important; }
  </style>
</head>
<body>
  <div class="print-sheet">
    ${printContainer.innerHTML}
  </div>
</body>
</html>`);
    doc.close();

    // Trigger native printer dialog
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print iframe fallback:', err);
        window.print();
      }
      // Clean up iframe after dialog closes
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 5000);
    }, 250);
  }, [thaiMonthName, yearBE, useThaiDigits]);

  // Keyboard shortcut: Ctrl + P (or Cmd + P on Mac) opens the print dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrint]);



  return (
    <div className="space-y-6">
      {/* Control Panel & Month Selector (Hidden during printing) */}
      <div className="no-print bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-blue-100 text-blue-800">
                <FileCheck2 className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  รายงานผลการปฏิบัติงาน
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  คำนวณรวบรวมข้อมูลข้อ 4.1 – 4.5 ของทุกหน่วยบริการ (4 รพ.สต.) ตั้งแต่ต้นเดือนจนถึงสิ้นเดือน จัดรูปแบบตามมาตรฐานราชการ A4
                </p>
              </div>
            </div>
          </div>

          {/* Print Button: พิมพ์ */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2.5 px-4 py-2 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white rounded-xl shadow-sm hover:shadow-md transition-all active:scale-98 cursor-pointer ring-2 ring-blue-500/20 shrink-0 self-start sm:self-auto group"
            title="คลิกเพื่อสั่งพิมพ์ หรือกดคีย์ลัด Ctrl + P บนแป้นพิมพ์"
          >
            <span className="p-1 rounded-md bg-white/20 text-white group-hover:scale-110 transition-transform">
              <Printer className="w-4 h-4" />
            </span>
            <span className="text-xs sm:text-sm font-bold tracking-wide">
              พิมพ์
            </span>
          </button>
        </div>

        {/* Selection & Configuration Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
          {/* 1. Month Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-700" />
              <span>ประจำเดือน (เลือกเดือนที่ต้องการรายงาน)</span>
            </label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {availableMonths.map((ym) => {
                  const [y, m] = ym.split('-');
                  const monthName = THAI_MONTHS_FULL[parseInt(m, 10) - 1] || m;
                  const yearThai = parseInt(y, 10) + 543;
                  const count = records.filter((r) => r.date.startsWith(ym)).length;
                  return (
                    <option key={ym} value={ym}>
                      {monthName} {yearThai} ({count} บันทึก)
                    </option>
                  );
                })}
              </select>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              แสดงผลในเอกสาร: <strong className="text-blue-900">{monthDisplayString}</strong>
            </p>
          </div>

          {/* 2. Number Format Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-blue-700" />
              <span>รูปแบบตัวเลขในเอกสาร</span>
            </label>
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => setUseThaiDigits(true)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  useThaiDigits
                    ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                เลขไทย (๑, ๒, ๓)
              </button>
              <button
                type="button"
                onClick={() => setUseThaiDigits(false)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  !useThaiDigits
                    ? 'bg-blue-700 text-white border-blue-700 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                เลขอารบิก (1, 2, 3)
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {useThaiDigits ? 'จัดทำตามตัวอย่างราชการเดิม (เลขไทย)' : 'แสดงตัวเลขอารบิกสากล'}
            </p>
          </div>

          {/* 3. Committee Setup Toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-700" />
              <span>คณะกรรมการตรวจรับพัสดุ</span>
            </label>
            <button
              type="button"
              onClick={() => setShowCommitteeSettings(!showCommitteeSettings)}
              className="w-full text-left py-2 px-3 rounded-xl border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
            >
              <span>
                {chairpersonName || committee1Name || committee2Name
                  ? 'ระบุชื่อคณะกรรมการแล้ว'
                  : 'เว้นจุดไข่ปลาไว้เซ็นด้วยมือ (ค่าเริ่มต้น)'}
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showCommitteeSettings ? 'rotate-180' : ''}`} />
            </button>
            <p className="text-[11px] text-slate-500 mt-1">
              คลิกเพื่อพิมพ์ชื่อ หรือปล่อยว่างเป็นจุดไข่ปลา
            </p>
          </div>
        </div>

        {/* Doctor Leave Status & Custom Note Strip */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${leaveRecords.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
            <div>
              <span className="font-bold text-slate-800">ข้อมูลการลาของแพทย์: </span>
              {leaveRecords.length > 0 ? (
                <span className="text-amber-900 font-semibold">
                  พบแพทย์ลาในเดือนนี้ {leaveRecords.length} วัน ({autoLeaveDatesText})
                </span>
              ) : (
                <span className="text-slate-600">
                  ไม่มีบันทึกแพทย์ลาในเดือนนี้ (คำนวณเวลาทำงาน 0 ชม. และจะขึ้นหมายเหตุอัตโนมัติเมื่อมีบันทึก)
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isManualNoteEnabled ? (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <input
                  type="text"
                  value={manualLeaveNote}
                  onChange={(e) => setManualLeaveNote(e.target.value)}
                  placeholder="พิมพ์ข้อความหมายเหตุ เช่น แพทย์ลา วันที่ ๔ พฤศจิกายน ๒๕๖๙ (ไปราชการ)"
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 w-64 sm:w-80"
                />
                <button
                  type="button"
                  onClick={() => setIsManualNoteEnabled(false)}
                  className="text-xs text-blue-700 hover:text-blue-900 underline cursor-pointer whitespace-nowrap"
                >
                  ใช้ค่าอัตโนมัติ
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setManualLeaveNote(autoLeaveDatesText || `แพทย์ลา วันที่ ... ${thaiMonthName} พ.ศ. ${useThaiDigits ? toThaiDigits(yearBE) : yearBE}`);
                  setIsManualNoteEnabled(true);
                }}
                className="text-xs font-semibold text-blue-700 hover:text-blue-900 underline cursor-pointer"
              >
                {leaveRecords.length > 0 ? 'แก้ไขข้อความหมายเหตุ' : '+ เพิ่มข้อความหมายเหตุด้วยตนเอง'}
              </button>
            )}
          </div>
        </div>

        {/* Collapsible Committee Fields */}
        {showCommitteeSettings && (
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                ชื่อประธานกรรมการ
              </label>
              <input
                type="text"
                placeholder="เว้นว่างไว้เพื่อเป็นจุดไข่ปลา"
                value={chairpersonName}
                onChange={(e) => setChairpersonName(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                ชื่อกรรมการ (คนที่ 1)
              </label>
              <input
                type="text"
                placeholder="เว้นว่างไว้เพื่อเป็นจุดไข่ปลา"
                value={committee1Name}
                onChange={(e) => setCommittee1Name(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                ชื่อกรรมการ (คนที่ 2)
              </label>
              <input
                type="text"
                placeholder="เว้นว่างไว้เพื่อเป็นจุดไข่ปลา"
                value={committee2Name}
                onChange={(e) => setCommittee2Name(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          THE OFFICIAL A4 PRINTABLE DOCUMENT
          Typography Rules (Specified by User):
          - Lines 1 - 3: TH_SARABUN SPK, size 18pt, Bold (ตัวหนา)
          - All other lines: TH_SARABUN SPK, size 16pt, Normal (ธรรมดา)
          - Fits perfectly on ONE single A4 page
          ========================================================================= */}
      <div className="flex flex-col items-center justify-center print:block print:p-0 print:m-0 overflow-x-auto pb-6">
        {/* Saraban Margins Indicator for WYSIWYG */}
        <div className="no-print mb-2.5 inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-full text-xs font-medium shadow-2xs">
          <span>📐 จัดหน้าระเบียบงานสารบรรณ: ขอบบน 2 ซม. | ขอบล่าง 2 ซม. | ขอบซ้าย 3 ซม. | ขอบขวา 2.5 ซม. (A4 พอดี 1 หน้า)</span>
        </div>

        <div
          id="print-area"
          className="print-report-sheet font-sarabun bg-white text-black border border-slate-300 shadow-xl rounded-sm print:border-none print:shadow-none print:bg-transparent print:p-0 print:m-0 print:w-full"
          style={{
            fontFamily: "'TH Sarabun PSK', 'TH Sarabun New', 'Sarabun', sans-serif",
            color: '#000000',
            backgroundColor: '#ffffff',
            width: '210mm',
            minHeight: '297mm',
            boxSizing: 'border-box',
            paddingTop: '20mm',
            paddingBottom: '20mm',
            paddingLeft: '30mm',
            paddingRight: '25mm',
          }}
        >

          {/* Header Lines 1 - 3: TH Sarabun 18pt Bold (Centered) */}
          <div className="text-center space-y-0.5 pb-3">
            {/* บรรทัดที่ 1 */}
            <p
              className="font-bold tracking-tight m-0 p-0"
              style={{ fontSize: '18pt', lineHeight: '1.35' }}
            >
              รายงานผลการปฏิบัติงาน ของ{DEFAULT_DOCTOR_NAME}
            </p>

            {/* บรรทัดที่ 2 */}
            <p
              className="font-bold tracking-tight m-0 p-0"
              style={{ fontSize: '18pt', lineHeight: '1.35' }}
            >
              พนักงานจ้างเหมา{'\u00A0\u00A0'}ตำแหน่ง แพทย์
            </p>

            {/* บรรทัดที่ 3 */}
            <p
              className="font-bold tracking-tight m-0 p-0"
              style={{ fontSize: '18pt', lineHeight: '1.35' }}
            >
              {monthDisplayString}
            </p>
          </div>

          {/* Table: TH Sarabun 16pt (Header bold, body regular) */}
          <div className="mt-3">
            <table
              className="w-full border-collapse"
              style={{
                border: '1px solid #000000',
                borderCollapse: 'collapse',
                fontSize: '16pt',
                lineHeight: '1.35',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#ffffff' }}>
                  <th
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '16pt',
                    }}
                  >
                    รายงานปฏิบัติงาน
                  </th>
                  <th
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '16pt',
                      width: '160px',
                    }}
                  >
                    ปริมาณงาน (ราย)
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* 1. ข้อ 4.1 */}
                <tr>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'left',
                      fontSize: '16pt',
                      fontWeight: 'normal',
                    }}
                  >
                    {useThaiDigits ? '๑' : '1'}.ตรวจวินิจฉัย รักษาโรคเบื้องต้น แก่ผู้ป่วยโรคทั่วไป และให้คำแนะนำการใช้ยา การปฏิบัติตัวเพื่อประสิทธิผลในการรักษาโรค
                  </td>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontSize: '16pt',
                      fontWeight: 'normal',
                    }}
                  >
                    {fmtNum(aggregatedReport.generalPractice)}
                  </td>
                </tr>

                {/* 2. ข้อ 4.2 */}
                <tr>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'left',
                      fontSize: '16pt',
                      fontWeight: 'normal',
                    }}
                  >
                    {useThaiDigits ? '๒' : '2'}.ตรวจรักษาผู้ป่วยโรคเรื้อรัง และนัดหมายเพื่อติดตามผลการรักษาต่อเนื่อง
                  </td>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontSize: '16pt',
                      fontWeight: 'normal',
                    }}
                  >
                    {fmtNum(aggregatedReport.chronicCare)}
                  </td>
                </tr>

                {/* 3. ข้อ 4.3 (เยี่ยมบ้าน) */}
                <tr>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'left',
                      fontSize: '16pt',
                      fontWeight: 'normal',
                    }}
                  >
                    {useThaiDigits ? '๓' : '3'}.งานอื่นๆ ได้แก่ เยี่ยมบ้านผู้ป่วยติดบ้าน/ติดเตียง
                  </td>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontSize: '16pt',
                      fontWeight: 'normal',
                    }}
                  >
                    {fmtNum(aggregatedReport.homeVisit)}
                  </td>
                </tr>

                {/* 4. ข้อ 4.4 (ออกใบรับรองแพทย์) */}
                <tr>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'left',
                      fontSize: '16pt',
                      fontWeight: 'normal',
                    }}
                  >
                    {useThaiDigits ? '๔' : '4'}.ออกใบรับรองแพทย์
                  </td>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontSize: '16pt',
                      fontWeight: 'normal',
                    }}
                  >
                    {fmtNum(aggregatedReport.medicalCert)}
                  </td>
                </tr>

                {/* 5. ข้อ 4.5 (หัตถการพิเศษ อื่นๆ) */}
                <tr>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'left',
                      fontSize: '16pt',
                      fontWeight: 'normal',
                    }}
                  >
                    {useThaiDigits ? '๕' : '5'}.หัตถการพิเศษ อื่นๆ
                  </td>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontSize: '16pt',
                      fontWeight: 'normal',
                    }}
                  >
                    {fmtNum(aggregatedReport.specialProcedure)}
                  </td>
                </tr>

                {/* Row Summary: รวม */}
                <tr>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontSize: '16pt',
                      fontWeight: 'bold',
                    }}
                  >
                    รวม
                  </td>
                  <td
                    style={{
                      border: '1px solid #000000',
                      padding: '6px 12px',
                      textAlign: 'center',
                      fontSize: '16pt',
                      fontWeight: 'bold',
                    }}
                  >
                    {fmtNum(aggregatedReport.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Note: หมายเหตุ : แพทย์ลา วันที่ (ดึงข้อมูลจากแพทย์ลา) จากเวลาที่มาปฏิบัติงาน */}
          {activeLeaveNote && (
            <div className="mt-2 text-left" style={{ fontSize: '16pt', lineHeight: '1.4' }}>
              <p className="m-0 font-normal">
                <strong>หมายเหตุ :</strong> {activeLeaveNote}
              </p>
            </div>
          )}

          {/* Signatures & Committee Endorsement - Professional Thai Government Administrative Format */}
          <div
            className="signatures mt-7 print:mt-5 space-y-3.5 print:space-y-2.5"
            style={{ fontSize: '16pt', lineHeight: '1.35' }}
          >
            {/* 1. ผู้ส่งมอบงาน */}
            <div className="flex justify-end pr-1 sm:pr-4">
              <div className="inline-flex items-start whitespace-nowrap">
                <span className="pt-0.5">(ลงชื่อ)</span>
                <div className="inline-flex flex-col items-center mx-1.5" style={{ width: '230px' }}>
                  <span
                    className="select-none font-sarabun block w-full text-center tracking-tighter"
                    style={{ borderBottom: '1.5px dotted #000', height: '14px', marginBottom: '2px' }}
                  ></span>
                  <span className="text-center font-normal block w-full mt-0.5" style={{ fontSize: '16pt' }}>
                    ({DEFAULT_DOCTOR_NAME})
                  </span>
                </div>
                <span className="pt-0.5 w-[105px] text-left">ผู้ส่งมอบงาน</span>
              </div>
            </div>

            {/* 2. คณะกรรมการตรวจรับพัสดุ - ตัวหนา จัดกึ่งกลางตรงกับคำว่า (นายแพทย์เกรียงยุทธ วรศีตกาลกุล) */}
            <div className="flex justify-end pr-1 sm:pr-4 pt-2.5 print:pt-1.5 pb-0.5">
              <div className="inline-flex items-center whitespace-nowrap">
                <span className="pt-0.5 invisible select-none opacity-0" style={{ visibility: 'hidden' }} aria-hidden="true">(ลงชื่อ)</span>
                <div className="inline-flex flex-col items-center mx-1.5" style={{ width: '230px' }}>
                  <p
                    className="m-0 font-bold text-center w-full select-none"
                    style={{ fontSize: '16pt', fontWeight: 'bold' }}
                  >
                    คณะกรรมการตรวจรับพัสดุ
                  </p>
                </div>
                <span className="pt-0.5 w-[105px] invisible select-none opacity-0" style={{ visibility: 'hidden' }} aria-hidden="true">ผู้ส่งมอบงาน</span>
              </div>
            </div>

            {/* 3. ประธานกรรมการ */}
            <div className="flex justify-end pr-1 sm:pr-4">
              <div className="inline-flex items-start whitespace-nowrap">
                <span className="pt-0.5">(ลงชื่อ)</span>
                <div className="inline-flex flex-col items-center mx-1.5" style={{ width: '230px' }}>
                  <span
                    className="select-none font-sarabun block w-full text-center tracking-tighter"
                    style={{ borderBottom: '1.5px dotted #000', height: '14px', marginBottom: '2px' }}
                  ></span>
                  <span className="text-center font-normal block w-full mt-0.5" style={{ fontSize: '16pt' }}>
                    ({chairpersonName || '...................................................'})
                  </span>
                </div>
                <span className="pt-0.5 w-[105px] text-left">ประธานกรรมการ</span>
              </div>
            </div>

            {/* 4. กรรมการ คนที่ 1 */}
            <div className="flex justify-end pr-1 sm:pr-4">
              <div className="inline-flex items-start whitespace-nowrap">
                <span className="pt-0.5">(ลงชื่อ)</span>
                <div className="inline-flex flex-col items-center mx-1.5" style={{ width: '230px' }}>
                  <span
                    className="select-none font-sarabun block w-full text-center tracking-tighter"
                    style={{ borderBottom: '1.5px dotted #000', height: '14px', marginBottom: '2px' }}
                  ></span>
                  <span className="text-center font-normal block w-full mt-0.5" style={{ fontSize: '16pt' }}>
                    ({committee1Name || '...................................................'})
                  </span>
                </div>
                <span className="pt-0.5 w-[105px] text-left">กรรมการ</span>
              </div>
            </div>

            {/* 5. กรรมการ คนที่ 2 */}
            <div className="flex justify-end pr-1 sm:pr-4">
              <div className="inline-flex items-start whitespace-nowrap">
                <span className="pt-0.5">(ลงชื่อ)</span>
                <div className="inline-flex flex-col items-center mx-1.5" style={{ width: '230px' }}>
                  <span
                    className="select-none font-sarabun block w-full text-center tracking-tighter"
                    style={{ borderBottom: '1.5px dotted #000', height: '14px', marginBottom: '2px' }}
                  ></span>
                  <span className="text-center font-normal block w-full mt-0.5" style={{ fontSize: '16pt' }}>
                    ({committee2Name || '...................................................'})
                  </span>
                </div>
                <span className="pt-0.5 w-[105px] text-left">กรรมการ</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Verification Breakdown Section (Hidden when printing) */}
      <div className="no-print bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-700" />
            <h3 className="text-sm font-bold text-slate-900">
              รายละเอียดข้อมูลที่นำมารวม แยกตาม 4 หน่วยบริการ (รพ.สต.) ประจำเดือนนี้
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-xs font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
          >
            <span>{showBreakdown ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียดรายหน่วยบริการ'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBreakdown ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showBreakdown && (
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-xs text-slate-800 border-collapse">
              <thead>
                <tr className="bg-sky-50 text-blue-950 font-bold border-b border-sky-200">
                  <th className="py-2.5 px-3 text-left">หน่วยบริการ (รพ.สต.)</th>
                  <th className="py-2.5 px-2 text-center">จำนวนวัน</th>
                  <th className="py-2.5 px-2 text-right">4.1 โรคทั่วไป</th>
                  <th className="py-2.5 px-2 text-right">4.2 โรคเรื้อรัง</th>
                  <th className="py-2.5 px-2 text-right">4.3 เยี่ยมบ้าน</th>
                  <th className="py-2.5 px-2 text-right">4.4 ใบรับรองแพทย์</th>
                  <th className="py-2.5 px-2 text-right">4.5 หัตถการ</th>
                  <th className="py-2.5 px-3 text-right bg-blue-100/60 font-bold text-blue-900">รวม (ราย)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {hospitalBreakdowns.map((hb) => (
                  <tr key={hb.hospital} className="hover:bg-slate-50">
                    <td className="py-2 px-3 font-semibold text-slate-900">{hb.hospital}</td>
                    <td className="py-2 px-2 text-center text-slate-600">{hb.days} วัน</td>
                    <td className="py-2 px-2 text-right tabular-nums">{hb.gp.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{hb.cc.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{hb.hv.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{hb.mc.toLocaleString()}</td>
                    <td className="py-2 px-2 text-right tabular-nums">{hb.sp.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-bold text-blue-950 bg-blue-50/40">
                      {hb.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td className="py-2.5 px-3 text-slate-900">รวมทุกหน่วยบริการ</td>
                  <td className="py-2.5 px-2 text-center text-slate-700">
                    {monthRecords.length} ครั้ง
                  </td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{aggregatedReport.generalPractice.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{aggregatedReport.chronicCare.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{aggregatedReport.homeVisit.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{aggregatedReport.medicalCert.toLocaleString()}</td>
                  <td className="py-2.5 px-2 text-right tabular-nums">{aggregatedReport.specialProcedure.toLocaleString()}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-blue-950 bg-blue-200/50">
                    {aggregatedReport.total.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
