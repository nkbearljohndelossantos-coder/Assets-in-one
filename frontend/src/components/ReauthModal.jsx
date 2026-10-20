import React, { useState } from 'react';
import { ShieldCheck, Lock, X, AlertTriangle } from 'lucide-react';
import api from '../services/api';

export default function ReauthModal({ isOpen, onClose, deviceId, actionType, onSuccess }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/remote/reauth', {
        password,
        device_id: deviceId,
        action_type: actionType
      });

      if (res.data.success) {
        onSuccess(res.data.data.reauthToken);
        setPassword('');
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Re-authentication failed. Please check your password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up select-none" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gold-500" />
            <h3 className="font-bold text-sm">Technician Re-authentication Required</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Privileged Action Verification</strong>
              <span>Action: <code className="font-mono bg-amber-100 px-1 rounded font-bold">{actionType}</code> on Target <code className="font-mono bg-amber-100 px-1 rounded font-bold">{deviceId}</code>. Enter your account password to verify identity.</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Your Account Password</label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full pl-9 pr-3 py-2 border border-slate-350 rounded-lg text-xs font-medium focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-350 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-gold-650 cursor-pointer flex items-center gap-1.5 shadow"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verify & Issue Token</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
