import React from 'react';
import { UserCheck, ShieldAlert, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function AttendedRequestPromptModal({ request, onResponse, onClose }) {
  if (!request) return null;

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/65 p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up select-none border-2 border-slate-900">
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-gold-500" />
            <h3 className="font-bold text-sm">Remote Support Access Request</h3>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 text-xs rounded-lg space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-blue-950">
              <ShieldAlert className="h-4 w-4 text-blue-600" />
              <span>Incoming Technician Remote Request</span>
            </div>
            <p>An IT Technician is requesting remote access to support your workstation.</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Technician Name:</span>
              <span className="font-bold text-slate-900">{request.technicianName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Target Device:</span>
              <span className="font-bold font-mono text-slate-900">{request.deviceId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-bold">Reason for Support:</span>
              <span className="font-semibold text-slate-800 italic">{request.reason}</span>
            </div>
            <div className="flex justify-between text-amber-700">
              <span className="font-bold flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Expiration:</span>
              <span className="font-bold">5 Minutes Timer Active</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => onResponse(request.requestCode, 'deny')}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer"
            >
              <XCircle className="h-4 w-4" />
              <span>Deny Access</span>
            </button>
            <button
              onClick={() => onResponse(request.requestCode, 'allow')}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Allow Connection</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
