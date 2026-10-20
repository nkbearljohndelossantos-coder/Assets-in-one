import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  oldPassword: z.string().min(1, 'Old password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
  confirmPassword: z.string().min(8, 'Confirm password is required')
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export default function ChangePassword() {
  const { showToast } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await api.post('/auth/change-password', {
        oldPassword: data.oldPassword,
        newPassword: data.newPassword
      });

      if (response.data && response.data.success) {
        setSuccess(true);
        showToast('Password Changed', 'Your account password has been updated successfully.', 'success');
        reset();
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to change password. Please verify your old password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-md border border-slate-200">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Change Password</h2>
        <p className="text-xs text-slate-500 mt-1">
          Provide your current password and set a new secure password.
        </p>
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {success ? (
        <div className="py-6 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto animate-bounce" />
          <h3 className="text-emerald-900 font-bold text-lg">Password Updated!</h3>
          <p className="text-slate-500 text-xs">
            Redirecting you to the home dashboard...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Old Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Current Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                {...register('oldPassword')}
                placeholder="Enter current password"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 text-slate-900"
              />
            </div>
            {errors.oldPassword && <p className="text-rose-600 text-xs mt-1 font-medium">{errors.oldPassword.message}</p>}
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">New Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                {...register('newPassword')}
                placeholder="Minimum 8 characters"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 text-slate-900"
              />
            </div>
            {errors.newPassword && <p className="text-rose-600 text-xs mt-1 font-medium">{errors.newPassword.message}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Confirm New Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                {...register('confirmPassword')}
                placeholder="Confirm password"
                className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 text-slate-900"
              />
            </div>
            {errors.confirmPassword && <p className="text-rose-600 text-xs mt-1 font-medium">{errors.confirmPassword.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-gold-600 border border-transparent shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving updates...</span>
              </>
            ) : (
              <span>Change Password</span>
            )}
          </button>
        </form>
      )}
    </div>
  );
}
