import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';
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

export default function ForceChangePassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [success, setSuccess] = useState(false);

  const username = location.state?.username;
  const tempPassword = location.state?.tempPassword;

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  });

  // Redirect to login if loaded directly without auth state
  if (!username || !tempPassword) {
    React.useEffect(() => { navigate('/login'); }, [navigate]);
    return null;
  }

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const response = await api.post('/auth/force-change-password', {
        username,
        oldPassword: tempPassword,
        newPassword: data.newPassword
      });

      if (response.data && response.data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black px-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-200/50">
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-950">Update Password</h2>
          <p className="text-xs text-slate-500 mt-2">
            First-time login security requirement. Please set a secure password.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {success ? (
          <div className="p-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 text-emerald-600 mx-auto animate-bounce" />
            <h3 className="text-emerald-900 font-bold text-lg">Password Changed Successfully!</h3>
            <p className="text-slate-500 text-xs">
              Redirecting you to the sign-in page to log in with your new password...
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
                />
              </div>
              {errors.confirmPassword && <p className="text-rose-600 text-xs mt-1 font-medium">{errors.confirmPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-slate-950 text-white text-sm font-semibold hover:bg-gold-650 border border-transparent shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving new password...</span>
                </>
              ) : (
                <span>Save and Continue</span>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
