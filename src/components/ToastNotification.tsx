import React from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { NotificationState } from '../types';

interface ToastProps {
  notification: NotificationState;
  onClose: () => void;
}

export const ToastNotification: React.FC<ToastProps> = ({ notification, onClose }) => {
  if (!notification.show) return null;

  const bgStyles = {
    success: 'bg-emerald-50 border-emerald-300 text-emerald-950',
    warning: 'bg-amber-50 border-amber-300 text-amber-950',
    error: 'bg-rose-50 border-rose-300 text-rose-950',
    info: 'bg-blue-50 border-blue-300 text-blue-950',
  }[notification.type];

  const iconColors = {
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    error: 'text-rose-600',
    info: 'text-blue-600',
  }[notification.type];

  const IconComponent = {
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
    info: Info,
  }[notification.type];

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg ${bgStyles}`}>
        <IconComponent className={`w-5 h-5 shrink-0 mt-0.5 ${iconColors}`} />
        <div className="flex-1 pr-2">
          <p className="font-semibold text-sm">{notification.title}</p>
          <p className="text-xs mt-0.5 opacity-90 leading-relaxed">{notification.message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
          title="ปิดการแจ้งเตือน"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
