import React from 'react';
import { useAuth } from '../context/AuthContext';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export default function ToastContainer() {
  const { toasts } = useAuth();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';
        const isError = toast.type === 'error';

        return (
          <div
            key={toast.id}
            className={`flex items-start p-4 rounded-lg shadow-lg border bg-white transition-all duration-300 animate-slide-in ${
              isSuccess ? 'border-emerald-500 text-emerald-900 bg-emerald-50/95' :
              isWarning ? 'border-gold-500 text-gold-900 bg-gold-50/95' :
              isError ? 'border-rose-500 text-rose-900 bg-rose-50/95' :
              'border-slate-300 text-slate-900 bg-slate-50/95'
            }`}
          >
            <div className="mr-3 mt-0.5">
              {isSuccess && <CheckCircle className="h-5 w-5 text-emerald-600" />}
              {isWarning && <AlertTriangle className="h-5 w-5 text-gold-600" />}
              {isError && <AlertCircle className="h-5 w-5 text-rose-600" />}
              {toast.type === 'info' && <Info className="h-5 w-5 text-sky-600" />}
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm leading-tight">{toast.title}</h4>
              <p className="text-xs mt-1 leading-normal opacity-90">{toast.message}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
