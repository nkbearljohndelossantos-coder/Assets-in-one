import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Mail, Loader2, ArrowLeft, Info } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email address')
});

export default function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [devToken, setDevToken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setErrorMsg('');
    setDevToken('');
    try {
      const response = await api.post('/auth/forgot-password', { email: data.email });
      if (response.data && response.data.success) {
        setSuccess(true);
        if (response.data.token) {
          // Dev token returned for local testing when SMTP is absent
          setDevToken(response.data.token);
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Something went wrong. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black px-4">
      <div className="max-w-md w-full bg-white/95 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-slate-200/50">
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-950">Password Recovery</h2>
          <p className="text-xs text-slate-500 mt-2">
            Enter your email address to request a secure password reset token.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold">
            {errorMsg}
          </div>
        )}

        {success ? (
          <div className="space-y-6">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs leading-relaxed font-semibold">
              If the email matches an active account, a password reset token has been generated.
            </div>

            {/* Development token bypass window */}
            {devToken && (
              <div className="p-4 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-xs space-y-2">
                <p className="font-bold flex items-center gap-1"><Info className="h-3.5 w-3.5" /> [Development Mode Only]</p>
                <p className="opacity-95">No SMTP credentials are configured. Use this token link to proceed directly to reset your password:</p>
                <Link 
                  to={`/reset-password?token=${devToken}`}
                  className="font-bold underline text-sky-850 hover:text-sky-900 block truncate mt-2"
                >
                  Click here to Reset Password
                </Link>
              </div>
            )}

            <Link 
              to="/login"
              className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 hover:text-gold-700 py-2 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Login</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  {...register('email')}
                  placeholder="name@company.com"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/20 focus:border-gold-500 text-slate-900"
                />
              </div>
              {errors.email && <p className="text-rose-600 text-xs mt-1 font-medium">{errors.email.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-slate-950 text-white text-sm font-semibold hover:bg-gold-650 border border-transparent shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Requesting reset...</span>
                </>
              ) : (
                <span>Request Reset Link</span>
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
