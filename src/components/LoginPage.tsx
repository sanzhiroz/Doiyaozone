import React, { useState } from 'react';
import {
  Lock,
  User,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  LogIn,
} from 'lucide-react';
import { RegisteredUser } from '../types/auth';
import { authenticateUser, setActiveSession } from '../utils/authStorage';

interface LoginPageProps {
  onLoginSuccess: (user: RegisteredUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  // Empty credentials - user enters them manually
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState<boolean>(false);

  // Handle Login Submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmittingLogin(true);

    setTimeout(() => {
      const result = authenticateUser(loginUsername, loginPassword);
      if (result.success && result.user) {
        setActiveSession(result.user);
        onLoginSuccess(result.user);
      } else {
        setLoginError(result.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
        setIsSubmittingLogin(false);
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-between p-4 sm:p-6 text-slate-800">
      {/* Background Decorative Lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 bg-sky-500/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
      </div>

      <div className="max-w-[520px] w-full mx-auto my-auto relative z-10 py-4">
        {/* Brand Header */}
        <div className="text-center mb-6">
          {/* Official PAO Chiang Mai Logo */}
          <div className="inline-flex items-center justify-center mb-3">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center p-1 relative">
              <img
                src="/assets/aistudio/th-11134207-7rask-m3xoxbry1ynva1__1__89990021.jpg"
                alt="ตราประจำองค์การบริหารส่วนจังหวัดเชียงใหม่"
                className="w-full h-full object-contain rounded-full drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                style={{ clipPath: 'circle(49.2% at 50% 50%)' }}
              />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-sky-200 text-xs font-medium mb-2.5 whitespace-nowrap">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-300 shrink-0" />
            <span>องค์การบริหารส่วนจังหวัดเชียงใหม่</span>
          </div>

          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight whitespace-nowrap">
            บันทึกการปฏิบัติงานของแพทย์ Node ดอยยาว
          </h1>
          <p className="text-xs sm:text-sm text-sky-200/90 mt-1 whitespace-nowrap">
            ระบบสารสนเทศภาระงานแพทย์และการให้บริการตรวจรักษาเครือข่าย รพ.สต.
          </p>
        </div>

        {/* Clean Login Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-6 sm:p-8">
          <div className="flex items-center gap-2.5 pb-4 mb-5 border-b border-slate-100 text-slate-800">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-800 shrink-0">
              <LogIn className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                เข้าสู่ระบบ (Login)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 whitespace-nowrap">
                กรุณากรอก Username และ Password เพื่อเข้าใช้งาน
              </p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Username Input: Empty, user fills it */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 whitespace-nowrap">
                <User className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>Username (ชื่อผู้ใช้ / รหัสสถานบริการ)</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoFocus
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="กรอกชื่อผู้ใช้ หรือ รหัสสถานบริการ"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                />
              </div>
            </div>

            {/* Password Input: Empty & Masked */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5 whitespace-nowrap">
                <Lock className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                <span>Password (รหัสผ่าน)</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmittingLogin}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-bold text-sm sm:text-base rounded-xl shadow-md hover:shadow-lg transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer ring-2 ring-blue-500/20 disabled:opacity-50 whitespace-nowrap"
            >
              <span>{isSubmittingLogin ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-sky-200/70 space-y-1">
          <p className="whitespace-nowrap">© องค์การบริหารส่วนจังหวัดเชียงใหม่ (อบจ.เชียงใหม่)</p>
          <p className="text-[11px] text-sky-300/60 whitespace-nowrap">
            ระบบสนับสนุนการปฏิบัติงานแพทย์ Node ดอยยาว อ.สันกำแพง จ.เชียงใหม่
          </p>
        </div>
      </div>
    </div>
  );
};
