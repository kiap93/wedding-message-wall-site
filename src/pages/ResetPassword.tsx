import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { API_BASE } from '../lib/config';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing reset token.');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setStatus('idle');
    
    try {
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setStatus('success');
        setMessage('Password reset successful! Redirecting to login...');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('A network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF0] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white p-12 rounded-[2.5rem] shadow-2xl border border-[#C5A059]/10"
      >
        <div className="text-center mb-10">
          <div className="inline-block p-4 rounded-2xl bg-[#C5A059]/10 mb-6">
            <Lock className="w-10 h-10 text-[#C5A059]" />
          </div>
          <h1 className="text-3xl font-serif text-[#2D2424] mb-2">Reset Password</h1>
          <p className="text-[#2D2424]/60 text-sm">Create a new secure password for your account</p>
        </div>

        {status === 'success' ? (
          <div className="text-center">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <p className="text-green-700 font-medium">{message}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {status === 'error' && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 shrink-0" />
                {message}
              </div>
            )}
            
            <div className="space-y-4">
              <input
                type="password"
                placeholder="New Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-transparent focus:border-[#C5A059] focus:bg-white outline-none transition-all text-[#2D2424] text-sm"
              />
              <input
                type="password"
                placeholder="Confirm New Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-transparent focus:border-[#C5A059] focus:bg-white outline-none transition-all text-[#2D2424] text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-4 px-6 rounded-2xl bg-[#C5A059] text-white font-bold uppercase tracking-widest text-xs hover:bg-[#B38D45] transition-all shadow-xl shadow-[#C5A059]/20 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Update Password'}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
