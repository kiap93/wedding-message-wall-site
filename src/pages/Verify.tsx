import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { API_BASE } from '../lib/config';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email...');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/verify?token=${token}`, {
          method: 'POST',
        });
        const data = await response.json();

        if (response.ok && data.token) {
          localStorage.setItem('wedding_session_token', data.token);
          setStatus('success');
          setMessage('Email verified successfully! Redirecting to workspace...');
          setTimeout(() => {
            navigate('/workspace');
          }, 2000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed. The link may have expired.');
        }
      } catch (err) {
        setStatus('error');
        setMessage('A network error occurred. Please try again.');
      }
    };

    verifyToken();
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-[#FDFCF0] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white p-12 rounded-[2.5rem] shadow-2xl border border-[#C5A059]/10 text-center"
      >
        <div className="mb-8 flex justify-center">
          {status === 'loading' && (
            <div className="p-4 rounded-full bg-[#C5A059]/10 animate-pulse">
              <Loader2 className="w-12 h-12 text-[#C5A059] animate-spin" />
            </div>
          )}
          {status === 'success' && (
            <div className="p-4 rounded-full bg-green-50">
              <CheckCircle2 className="w-12 h-12 text-green-500" />
            </div>
          )}
          {status === 'error' && (
            <div className="p-4 rounded-full bg-red-50">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
          )}
        </div>

        <h1 className="text-3xl font-serif mb-4 text-[#2D2424]">
          {status === 'loading' && 'Verifying...'}
          {status === 'success' && 'Welcome Back!'}
          {status === 'error' && 'Verification Error'}
        </h1>
        
        <p className="text-[#2D2424]/60 mb-8">
          {message}
        </p>

        {status === 'error' && (
          <button
            onClick={() => navigate('/login')}
            className="w-full py-4 px-6 rounded-2xl bg-[#C5A059] text-white font-bold uppercase tracking-widest text-xs hover:bg-[#B38D45] transition-all shadow-xl shadow-[#C5A059]/20"
          >
            Back to Login
          </button>
        )}
      </motion.div>
    </div>
  );
}
