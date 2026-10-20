import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { Lock, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
  confirmPassword: z.string().min(8, 'Confirm password is required')
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const token = searchParams.get('token');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data) => {
    if (!token) {
      setErrorMsg('Reset token is missing or invalid.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    try {
      const response = await api.post('/auth/reset-password', {
        token,
        newPassword: data.newPassword
      });

      if (response.data && response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black px-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-200/50">
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-950">Reset Password</h2>
          <p className="text-xs text-slate-500 mt-2">
            Create a new secure password for your account.
          </p>
        </div>

        {!token && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold">
            Reset token is missing from the link URL. Please request a new recovery link.
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {success ? (
          <div className="p-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto animate-bounce" />
            <h3 className="text-emerald-900 font-bold text-lg">Password Reset Successful!</h3>
            <p className="text-slate-500 text-xs">
              Redirecting you to the sign-in page to log in...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">New Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  {...register('newPassword')}
                  placeholder="Enter secure password (min 8 chars)"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 text-slate-900"
                  disabled={!token}
                />
              </div>
              {errors.newPassword && <p className="text-rose-600 text-xs mt-1 font-medium">{errors.newPassword.message}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Confirm New Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  {...register('confirmPassword')}
                  placeholder="Re-type new password"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 text-slate-900"
                  disabled={!token}
                />
              </div>
              {errors.confirmPassword && <p className="text-rose-600 text-xs mt-1 font-medium">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-2.5 rounded-lg bg-slate-950 text-white text-sm font-semibold hover:bg-gold-650 border border-transparent shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving new password...</span>
                </>
              ) : (
                <span>Reset Password</span>
              )}
            </button>

            <div className="text-center pt-2">
              <Link 
                to="/login"
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-slate-950 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Login</span>
              </Link>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
