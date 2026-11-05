import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Building2, User, Stethoscope, FileText, CheckCircle2 } from 'lucide-react';
import {
  MedicalLogEntry,
  HOSPITALS,
  WORK_TIMES,
  DEFAULT_DOCTOR_NAME,
  COMMON_PREFIXES,
  POSITION_OPTIONS,
  REPORTER_LEVEL_OPTIONS,
  HospitalName,
  WorkTimeSlot,
  getServiceUnitForHospital,
} from '../types';
import { formatThaiDate, calculateTotalPatients } from '../utils/storage';

interface RecordFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: Omit<MedicalLogEntry, 'id' | 'createdAt' | 'updatedAt'>, editId?: string) => void;
  editingEntry?: MedicalLogEntry | null;
  defaultHospital?: HospitalName;
}

export const RecordFormModal: React.FC<RecordFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingEntry,
  defaultHospital,
}) => {
  // Today's date in YYYY-MM-DD
  const todayStr = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState<string>(todayStr);
  const [doctorName, setDoctorName] = useState<string>(DEFAULT_DOCTOR_NAME);
  const [hospital, setHospital] = useState<HospitalName>(defaultHospital || HOSPITALS[0]);
  const [workTime, setWorkTime] = useState<WorkTimeSlot>(WORK_TIMES[2]); // default 08.30 – 16.30 น.

  const [generalPractice, setGeneralPractice] = useState<number>(0);
  const [chronicCare, setChronicCare] = useState<number>(0);
  const [homeVisit, setHomeVisit] = useState<number>(0);
  const [medicalCert, setMedicalCert] = useState<number>(0);
  const [specialProcedure, setSpecialProcedure] = useState<number>(0);

  const [prefix, setPrefix] = useState<string>('นาย');
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [position, setPosition] = useState<string>('');
  const [level, setLevel] = useState<string>('ไม่มี');
  const [notes, setNotes] = useState<string>('');

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  // Reset or pre-fill on open/edit
  useEffect(() => {
    if (editingEntry) {
      setDate(editingEntry.date);
      setDoctorName(editingEntry.doctorName || DEFAULT_DOCTOR_NAME);
      setHospital(editingEntry.hospital as HospitalName);
      setWorkTime(editingEntry.workTime as WorkTimeSlot);
      setGeneralPractice(editingEntry.report.generalPractice || 0);
      setChronicCare(editingEntry.report.chronicCare || 0);
      setHomeVisit(editingEntry.report.homeVisit || 0);
      setMedicalCert(editingEntry.report.medicalCert || 0);
      setSpecialProcedure(editingEntry.report.specialProcedure || 0);
      setPrefix(editingEntry.reporter.prefix || 'นาย');
      setFirstName(editingEntry.reporter.firstName || '');
      setLastName(editingEntry.reporter.lastName || '');
      setPosition(editingEntry.reporter.position || '');
      setLevel(editingEntry.reporter.level || 'ไม่มี');
      setNotes(editingEntry.notes || '');
    } else {
      setDate(new Date().toISOString().split('T')[0]);
      setDoctorName(DEFAULT_DOCTOR_NAME);
      setHospital(defaultHospital || HOSPITALS[0]);
      setWorkTime(WORK_TIMES[2]);
      setGeneralPractice(0);
      setChronicCare(0);
      setHomeVisit(0);
      setMedicalCert(0);
      setSpecialProcedure(0);
      setNotes('');
      setPrefix('นาย');
      setPosition(''); // ตำแหน่ง ให้เว้นว่างไว้ตามคำสั่งผู้ใช้
      setLevel('ไม่มี');
    }
    setFormErrors({});
  }, [editingEntry, isOpen, defaultHospital]);


  // When workTime is changed to "แพทย์ลา", calculate hours as 0 and reset patient counts to 0
  const handleWorkTimeChange = (newTime: WorkTimeSlot) => {
    setWorkTime(newTime);
    if (newTime === 'แพทย์ลา') {
      setGeneralPractice(0);
      setChronicCare(0);
      setHomeVisit(0);
      setMedicalCert(0);
      setSpecialProcedure(0);
    }
  };

  const totalPatients = calculateTotalPatients({
    generalPractice,
    chronicCare,
    homeVisit,
    medicalCert,
    specialProcedure,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: { [key: string]: string } = {};

    if (!date) errors.date = 'กรุณาเลือกวันที่ปฏิบัติงาน';
    if (!firstName.trim()) errors.firstName = 'กรุณาระบุชื่อผู้รายงาน';
    if (!lastName.trim()) errors.lastName = 'กรุณาระบุนามสกุลผู้รายงาน';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const unitInfo = getServiceUnitForHospital(hospital);

    onSave(
      {
        date,
        doctorName: doctorName.trim() || DEFAULT_DOCTOR_NAME,
        hospital,
        workTime,
        serviceUnitCode: unitInfo.code,
        serviceUnitName: unitInfo.name,
        report: {
          generalPractice: Math.max(0, Number(generalPractice) || 0),
          chronicCare: Math.max(0, Number(chronicCare) || 0),
          homeVisit: Math.max(0, Number(homeVisit) || 0),
          medicalCert: Math.max(0, Number(medicalCert) || 0),
          specialProcedure: Math.max(0, Number(specialProcedure) || 0),
        },
        reporter: {
          prefix,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          position: position.trim(),
          level: level.trim() || 'ไม่มี',
        },
        notes: notes.trim(),
      },
      editingEntry?.id
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-sky-100 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-sky-900 text-white px-6 py-4.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-300/30 flex items-center justify-center text-sky-200">
              <Stethoscope className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {editingEntry ? 'แก้ไขข้อมูลการปฏิบัติงาน' : 'เพิ่มข้อมูลการปฏิบัติงานแพทย์ Node ดอยยาว'}
              </h2>
              <p className="text-xs text-sky-200">
                Medical Practice Log – Doi Yao (อบจ.เชียงใหม่)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-sky-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[78vh] overflow-y-auto text-slate-800">
          {/* Section 1: Doctor, Date, Place, Time */}
          <div className="bg-sky-50/60 rounded-xl p-4 border border-sky-100 space-y-4">
            <h3 className="text-sm font-semibold text-blue-950 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-700" />
              <span>ข้อมูลวันเวลาและสถานที่ปฏิบัติงาน</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Date Picker */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  1. วันที่มาปฏิบัติงาน <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent font-sans"
                    required
                  />
                </div>
                <div className="text-[11px] text-blue-800 mt-1 flex items-center gap-1 font-medium">
                  <span>ตรงกับ: {formatThaiDate(date, 'full')}</span>
                </div>
                {formErrors.date && <p className="text-xs text-rose-500 mt-1">{formErrors.date}</p>}
              </div>

              {/* 2. Doctor Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  2. ชื่อแพทย์
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="w-full bg-slate-100/80 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                    placeholder="นายแพทย์เกรียงยุทธ วรศีตกาลกุล"
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  แพทย์ประจำ Node ดอยยาว อบจ.เชียงใหม่
                </span>
              </div>

              {/* 3. Hospital Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  3. รพ.สต. ที่ไปปฏิบัติงาน <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={hospital}
                    onChange={(e) => setHospital(e.target.value as HospitalName)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {HOSPITALS.map((hosp) => (
                      <option key={hosp} value={hosp}>
                        {hosp}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Work Time Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  4. เวลาที่มาปฏิบัติงาน <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={workTime}
                    onChange={(e) => handleWorkTimeChange(e.target.value as WorkTimeSlot)}
                    className={`w-full bg-white border rounded-lg px-3 py-2 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                      workTime === 'แพทย์ลา'
                        ? 'border-amber-400 text-amber-900 bg-amber-50/50'
                        : 'border-slate-300 text-slate-900'
                    }`}
                  >
                    {WORK_TIMES.map((time) => (
                      <option key={time} value={time}>
                        {time}
                      </option>
                    ))}
                  </select>
                </div>
                {workTime === 'แพทย์ลา' && (
                  <div className="mt-1.5 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-0.5">
                    <p className="font-bold flex items-center gap-1 text-amber-950">
                      <span>• คำนวณชั่วโมงการทำงานเป็น 0 ชั่วโมง</span>
                    </p>
                    <p className="text-amber-800">
                      ระบบจะดึงวันที่ลานี้ไปแสดงในหมายเหตุหน้ารายงานประจำเดือน: <strong>"หมายเหตุ : แพทย์ลา วันที่..."</strong> อัตโนมัติ
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Clinical Practice & Services (ตัวเลขจำนวนราย) */}
          <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-blue-950 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                <span>รายงานการปฏิบัติงาน (กรอกจำนวนตัวเลขเป็น ราย)</span>
              </h3>
              <div className="bg-blue-100 text-blue-950 px-3 py-1 rounded-lg text-xs font-bold tabular-nums">
                รวมผู้รับบริการ: {totalPatients} ราย
              </div>
            </div>

            <div className="space-y-3.5">
              {/* 4.1 General Practice */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 hover:bg-sky-50/50 transition-colors border border-slate-100">
                <div className="flex-1">
                  <span className="font-semibold text-xs text-slate-900">4.1 ตรวจวินิจฉัย รักษาโรคเบื้องต้น แก่ผู้ป่วยโรคทั่วไป และให้คําแนะนําการใช้ยา</span>
                  <span className="block text-[11px] text-slate-500">บริการผู้ป่วยนอก OPD ทั่วไป ให้คำปรึกษาการใช้ยา</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setGeneralPractice(Math.max(0, generalPractice - 1))}
                    className="w-8 h-8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={generalPractice}
                    onChange={(e) => setGeneralPractice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 text-center font-bold text-sm bg-white border border-slate-300 rounded-md py-1 text-slate-900 tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setGeneralPractice(generalPractice + 1)}
                    className="w-8 h-8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-600 font-medium w-8">ราย</span>
                </div>
              </div>

              {/* 4.2 Chronic Care */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 hover:bg-sky-50/50 transition-colors border border-slate-100">
                <div className="flex-1">
                  <span className="font-semibold text-xs text-slate-900">4.2 ตรวจรักษาผู้ป่วยโรคเรื้อรัง และนัดหมายเพื่อติดตามผลการรักษาต่อเนื่อง</span>
                  <span className="block text-[11px] text-slate-500">คลินิกโรคเรื้อรัง (NCD: เบาหวาน, ความดันโลหิตสูง, ไต, หอบหืด ฯลฯ)</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setChronicCare(Math.max(0, chronicCare - 1))}
                    className="w-8 h-8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={chronicCare}
                    onChange={(e) => setChronicCare(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 text-center font-bold text-sm bg-white border border-slate-300 rounded-md py-1 text-slate-900 tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setChronicCare(chronicCare + 1)}
                    className="w-8 h-8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-600 font-medium w-8">ราย</span>
                </div>
              </div>

              {/* 4.3 Home Visit */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 hover:bg-sky-50/50 transition-colors border border-slate-100">
                <div className="flex-1">
                  <span className="font-semibold text-xs text-slate-900">4.3 งานอื่นๆ ได้แก่ เยี่ยมบ้านผู้ป่วยติดบ้าน/ติดเตียง</span>
                  <span className="block text-[11px] text-slate-500">บริการดูแลประเมินผู้ป่วยติดบ้านติดเตียงในชุมชน Home Health Care</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setHomeVisit(Math.max(0, homeVisit - 1))}
                    className="w-8 h-8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={homeVisit}
                    onChange={(e) => setHomeVisit(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 text-center font-bold text-sm bg-white border border-slate-300 rounded-md py-1 text-slate-900 tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setHomeVisit(homeVisit + 1)}
                    className="w-8 h-8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-600 font-medium w-8">ราย</span>
                </div>
              </div>

              {/* 4.4 Medical Certificate */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 hover:bg-sky-50/50 transition-colors border border-slate-100">
                <div className="flex-1">
                  <span className="font-semibold text-xs text-slate-900">4.4 ออกใบรับรองแพทย์</span>
                  <span className="block text-[11px] text-slate-500">ใบรับรองแพทย์ตรวจสุขภาพ, สมัครงาน, ใบขับขี่, ลาป่วย</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setMedicalCert(Math.max(0, medicalCert - 1))}
                    className="w-8 h-8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={medicalCert}
                    onChange={(e) => setMedicalCert(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 text-center font-bold text-sm bg-white border border-slate-300 rounded-md py-1 text-slate-900 tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setMedicalCert(medicalCert + 1)}
                    className="w-8 h-8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-600 font-medium w-8">ราย</span>
                </div>
              </div>

              {/* 4.5 Special Procedure */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 hover:bg-sky-50/50 transition-colors border border-slate-100">
                <div className="flex-1">
                  <span className="font-semibold text-xs text-slate-900">4.5 หัตถการพิเศษ อื่นๆ</span>
                  <span className="block text-[11px] text-slate-500">เย็บแผล, ผ่าฝี, ล้างตา, เปลี่ยนสายยางอาหาร/ปัสสาวะ, ทำแผลซับซ้อน ฯลฯ</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSpecialProcedure(Math.max(0, specialProcedure - 1))}
                    className="w-8 h-8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={specialProcedure}
                    onChange={(e) => setSpecialProcedure(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-20 text-center font-bold text-sm bg-white border border-slate-300 rounded-md py-1 text-slate-900 tabular-nums focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setSpecialProcedure(specialProcedure + 1)}
                    className="w-8 h-8 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm cursor-pointer"
                  >
                    +
                  </button>
                  <span className="text-xs text-slate-600 font-medium w-8">ราย</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Reporter Info (5. ชื่อผู้รายงาน & ตำแหน่ง) */}
          <div className="bg-sky-50/60 rounded-xl p-4 border border-sky-100 space-y-4">
            <h3 className="text-sm font-semibold text-blue-950 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-700" />
              <span>5. ข้อมูลผู้รายงาน</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Prefix */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  คำนำหน้า
                </label>
                <select
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {COMMON_PREFIXES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              {/* First Name */}
              <div className="sm:col-span-1.5">
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  ชื่อ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="เช่น สุภาพร"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
                {formErrors.firstName && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.firstName}</p>
                )}
              </div>

              {/* Last Name */}
              <div className="sm:col-span-1.5">
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  ชื่อสกุล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="เช่น แก้วมณี"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  required
                />
                {formErrors.lastName && (
                  <p className="text-xs text-rose-500 mt-1">{formErrors.lastName}</p>
                )}
              </div>
            </div>

            {/* Position Selector with 9 options */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                ตำแหน่งผู้รายงาน <span className="text-slate-400 font-normal">(เลือกจากรายการ หรือเว้นว่างไว้)</span>
              </label>
              <div className="space-y-2">
                <select
                  value={
                    POSITION_OPTIONS.includes(position as any)
                      ? position
                      : position === ''
                      ? ''
                      : '__custom__'
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      setPosition('');
                    } else {
                      setPosition(val);
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">-- เว้นว่างไว้ / ไม่ระบุตำแหน่ง --</option>
                  {POSITION_OPTIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                  <option value="__custom__">อื่นๆ (พิมพ์ระบุเอง...)</option>
                </select>

                {(!POSITION_OPTIONS.includes(position as any) && position !== '') ||
                position === '__custom__' ? (
                  <input
                    type="text"
                    value={position === '__custom__' ? '' : position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="พิมพ์ระบุตำแหน่งอื่นๆ"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                ) : null}
              </div>
            </div>

            {/* Level Selector: ปฏิบัติการ, ชำนาญการ, ปฏิบัติงาน, ชำนาญงาน, ไม่มี */}
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                ระดับ <span className="text-slate-400 font-normal">(ระดับตำแหน่ง)</span>
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {REPORTER_LEVEL_OPTIONS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            {/* Additional notes */}

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                หมายเหตุเพิ่มเติม (ถ้ามี)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="ระบุกิจกรรมพิเศษ เคสส่งต่อ หรือรายละเอียดที่ต้องการบันทึกเพิ่มเติม..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-medium px-5 py-2 rounded-lg text-sm transition-all duration-150 shadow-md hover:shadow-lg active:scale-98 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-sky-200" />
              <span>{editingEntry ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
