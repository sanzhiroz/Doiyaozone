import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { MedicalLogEntry } from '../types';
import { formatThaiDate, calculateTotalPatients } from '../utils/storage';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  entry: MedicalLogEntry | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  entry,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !entry) return null;

  const totalPatients = calculateTotalPatients(entry.report);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full border border-rose-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900">
              ยืนยันการลบข้อมูลการปฏิบัติงาน?
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              ข้อมูลที่ถูกลบจะไม่สามารถกู้คืนได้ กรุณาตรวจสอบข้อมูลด้านล่าง
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3 text-xs text-slate-700">
          <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200/80 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">วันที่:</span>
              <span className="font-semibold text-slate-900">{formatThaiDate(entry.date, 'full')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">รพ.สต.:</span>
              <span className="font-semibold text-blue-900">{entry.hospital}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">แพทย์:</span>
              <span className="text-slate-800">{entry.doctorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">เวลาปฏิบัติงาน:</span>
              <span className="text-slate-800">{entry.workTime}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-500">ยอดรวมผู้รับบริการ:</span>
              <span className="font-bold text-slate-900">{totalPatients} ราย</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-5 py-3.5 flex items-center justify-end gap-2.5 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => onConfirm(entry.id)}
            className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white font-medium px-4 py-1.5 rounded-lg text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>ยืนยันลบข้อมูล</span>
          </button>
        </div>
      </div>
    </div>
  );
};
