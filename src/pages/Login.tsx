import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Chrome, Heart, Globe, XCircle, CheckCircle2 } from 'lucide-react';

import { API_BASE } from '../lib/config';
import { authenticatedFetch } from '../lib/auth';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('error');

  useEffect(() => {
    if (authError) {
      setError(decodeURIComponent(authError));
    }
  }, [authError]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      localStorage.removeItem('wedding_session_token');
      
      const response = await fetch(`${API_BASE}/api/auth/google`, {
        headers: { 'Accept': 'application/json' }
      });
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Failed to initialize Google login');
      }
    } catch (err) {
      setError('An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Basic validation
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }
    if (mode !== 'forgot-password' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      localStorage.removeItem('wedding_session_token');

      const endpoint = mode === 'forgot-password' ? '/api/auth/forgot-password' : '/api/auth/email';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, mode }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.success) {
          if (mode === 'forgot-password') {
            setSuccess('If this email is registered, you will receive a password reset link shortly.');
          } else {
            setSuccess(mode === 'signup' 
              ? 'Account created! Please check your email (including spam folder) for a verification link.' 
              : 'A secure login link has been sent to your email. If it doesn\'t arrive in a few minutes, check your spam or try again.');
          }
          setError(null);
        } else {
          setError(data.error || 'Authentication failed.');
        }
      } else {
        if (data.error?.includes('already exists')) {
          setError('This email is already registered. If you haven\'t verified it, try signing up again to resend the link.');
        } else {
          setError(data.error || (mode === 'signup' ? 'Failed to create account.' : 'Invalid credentials.'));
        }
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF0] flex flex-col md:flex-row shadow-inner">
      <div className="hidden md:flex md:w-1/2 bg-[#C5A059] items-center justify-center p-12 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[#2D2424]/10" />
        <div className="max-w-md relative z-10">
          <Heart className="w-16 h-16 mb-8 text-white/40" />
          <h1 className="text-6xl font-serif mb-6 leading-tight">Your Wedding, Perfectly Frame by Frame.</h1>
          <p className="text-xl text-white/80 font-light">The all-in-one platform for professional wedding photographers and happy couples.</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-[#C5A059]/10"
        >
          <div className="mb-8 items-center flex flex-col">
            <div className="w-16 h-16 bg-[#C5A059] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-[#C5A059]/20">
              <Globe className="text-white w-8 h-8" />
            </div>
            <h2 className="text-3xl font-serif text-[#2D2424] mb-2">
              {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
            </h2>
            <p className="text-[#2D2424]/60 text-center text-sm">
              {mode === 'login' 
                ? 'Sign in to manage your wedding workspace' 
                : mode === 'signup'
                ? 'Join our community of wedding creators'
                : 'Enter your email to receive a reset link'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl text-sm leading-relaxed">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="flex-1">
                  {success}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl border-2 border-slate-100 hover:border-[#C5A059] flex items-center justify-center gap-3 transition-all group disabled:opacity-50"
            >
              <Chrome className="w-5 h-5 text-slate-400 group-hover:text-[#C5A059]" />
              <span className="font-bold text-[#2D2424] text-xs uppercase tracking-widest">
                Continue with Google
              </span>
            </button>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px]">
                <span className="px-4 bg-white text-slate-400 uppercase tracking-[0.2em] font-bold">Or email</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div>
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address" 
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-transparent focus:border-[#C5A059] focus:bg-white outline-none transition-all text-[#2D2424] text-sm"
                  required
                />
              </div>
              {mode !== 'forgot-password' && (
                <div>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (Min 6 chars)" 
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-transparent focus:border-[#C5A059] focus:bg-white outline-none transition-all text-[#2D2424] text-sm"
                    required
                  />
                  {mode === 'login' && (
                    <div className="flex justify-end mt-2">
                      <button 
                        type="button"
                        onClick={() => setMode('forgot-password')}
                        className="text-[10px] uppercase tracking-widest font-bold text-[#C5A059] hover:text-[#B38D45]"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </div>
              )}
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 px-6 rounded-2xl bg-[#C5A059] text-white font-bold uppercase tracking-widest text-xs hover:bg-[#B38D45] transition-all shadow-xl shadow-[#C5A059]/20 disabled:opacity-50"
              >
                {loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link')}
              </button>
            </form>
          </div>

          <p className="mt-8 text-center text-sm text-[#2D2424]/60">
            {mode === 'login' ? "Don't have an account?" : "Ready to sign in?"}{' '}
            <button 
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
                setSuccess(null);
              }}
              className="text-[#C5A059] font-bold hover:underline"
            >
              {mode === 'login' ? 'Sign Up' : 'Log In'}
            </button>
          </p>

          <div className="mt-12 pt-8 border-t border-slate-50 flex justify-center gap-6">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest cursor-pointer hover:text-slate-600">Privacy</span>
            <span className="text-[10px] text-slate-300">•</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest cursor-pointer hover:text-slate-600">Terms</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
