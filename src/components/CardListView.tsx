import React, { useState } from 'react';
import {
  Calendar,
  Building2,
  Clock,
  User,
  FileText,
  Edit2,
  Trash2,
  PlusCircle,
  Search,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import { MedicalLogEntry, HOSPITALS } from '../types';
import { formatThaiDate, calculateTotalPatients } from '../utils/storage';

interface CardListViewProps {
  records: MedicalLogEntry[];
  onOpenAddModal: () => void;
  onEditEntry: (entry: MedicalLogEntry) => void;
  onDeleteEntry: (entry: MedicalLogEntry) => void;
}

export const CardListView: React.FC<CardListViewProps> = ({
  records,
  onOpenAddModal,
  onEditEntry,
  onDeleteEntry,
}) => {
  const [filterHosp, setFilterHosp] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filtered = records.filter((r) => {
    const matchesHosp = filterHosp === 'all' || r.hospital === filterHosp;
    const matchesSearch =
      searchTerm === '' ||
      r.date.includes(searchTerm) ||
      r.hospital.includes(searchTerm) ||
      `${r.reporter.prefix}${r.reporter.firstName} ${r.reporter.lastName}`.includes(searchTerm) ||
      (r.notes && r.notes.includes(searchTerm));
    return matchesHosp && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions */}
      <div className="bg-white rounded-xl border border-sky-100 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-lg">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="ค้นหารายการ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filterHosp}
            onChange={(e) => setFilterHosp(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">รพ.สต. ทั้งหมด</option>
            {HOSPITALS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onOpenAddModal}
          className="group inline-flex items-center gap-2.5 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all duration-200 shadow-md hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 active:scale-98 ring-4 ring-blue-500/20 cursor-pointer"
        >
          <PlusCircle className="w-5 h-5 text-sky-200 shrink-0" />
          <span>เพิ่มข้อมูลการปฏิบัติงานแพทย์</span>
          <ArrowRight className="w-5 h-5 text-sky-200 animate-pulse transition-transform duration-200 group-hover:translate-x-1 shrink-0" />
        </button>
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          <p className="text-sm font-medium">ไม่พบบันทึกการปฏิบัติงาน</p>
          <button
            onClick={onOpenAddModal}
            className="group mt-4 inline-flex items-center gap-2.5 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-800 hover:from-blue-800 hover:to-blue-900 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-md hover:shadow-lg cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-sky-200" />
            <span>เพิ่มข้อมูลการปฏิบัติงานแพทย์</span>
            <ArrowRight className="w-4 h-4 text-sky-200 animate-pulse" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((entry) => {
            const total = calculateTotalPatients(entry.report);
            const isLeave = entry.workTime === 'แพทย์ลา';

            return (
              <div
                key={entry.id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between ${
                  isLeave ? 'border-amber-200 bg-amber-50/20' : 'border-sky-100'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-blue-950">
                          {entry.hospital}
                        </span>
                        {isLeave && (
                          <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                            แพทย์ลา
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 flex items-center gap-2 mt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-800">
                          <Calendar className="w-3.5 h-3.5 text-blue-700" />
                          {formatThaiDate(entry.date, 'full')}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {entry.workTime}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-slate-400">ผู้รับบริการ</div>
                      <div className="text-lg font-bold text-blue-900 font-mono tabular-nums">
                        {total} <span className="text-xs font-normal text-slate-500">ราย</span>
                      </div>
                    </div>
                  </div>

                  {/* Doctor Info */}
                  <div className="py-2.5 flex items-center justify-between text-xs text-slate-700">
                    <span className="text-slate-500">แพทย์ผู้ปฏิบัติงาน:</span>
                    <span className="font-medium text-slate-900">{entry.doctorName}</span>
                  </div>

                  {/* Service Breakdown Grid */}
                  <div className="grid grid-cols-5 gap-1.5 py-3 border-t border-b border-slate-100 text-center text-xs">
                    <div className="bg-slate-50 p-1.5 rounded-md">
                      <div className="text-[10px] text-slate-500 truncate" title="4.1 ทั่วไป">
                        ทั่วไป
                      </div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">
                        {entry.report.generalPractice}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-1.5 rounded-md">
                      <div className="text-[10px] text-slate-500 truncate" title="4.2 เรื้อรัง">
                        เรื้อรัง
                      </div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">
                        {entry.report.chronicCare}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-1.5 rounded-md">
                      <div className="text-[10px] text-slate-500 truncate" title="4.3 เยี่ยมบ้าน">
                        เยี่ยมบ้าน
                      </div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">
                        {entry.report.homeVisit}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-1.5 rounded-md">
                      <div className="text-[10px] text-slate-500 truncate" title="4.4 ใบรับรอง">
                        ใบรับรอง
                      </div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">
                        {entry.report.medicalCert}
                      </div>
                    </div>

                    <div className="bg-slate-50 p-1.5 rounded-md">
                      <div className="text-[10px] text-slate-500 truncate" title="4.5 หัตถการ">
                        หัตถการ
                      </div>
                      <div className="font-bold text-slate-800 font-mono mt-0.5">
                        {entry.report.specialProcedure}
                      </div>
                    </div>
                  </div>

                  {/* Notes if any */}
                  {entry.notes && (
                    <div className="mt-2.5 text-xs text-slate-600 bg-sky-50/50 p-2.5 rounded-lg border border-sky-100">
                      <span className="font-semibold text-blue-950">หมายเหตุ: </span>
                      <span>{entry.notes}</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Reporter and Action Buttons */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="text-slate-500 text-[11px] truncate max-w-[200px]">
                    ผู้รายงาน: {entry.reporter.prefix}
                    {entry.reporter.firstName} {entry.reporter.lastName} ({entry.reporter.position || '-'}{entry.reporter.level && entry.reporter.level !== 'ไม่มี' ? ` - ${entry.reporter.level}` : ''})
                  </div>



                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditEntry(entry)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>แก้ไข</span>
                    </button>
                    <button
                      onClick={() => onDeleteEntry(entry)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>ลบ</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
