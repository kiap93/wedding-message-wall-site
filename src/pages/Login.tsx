import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Chrome, Heart } from 'lucide-react';

import { API_BASE } from '../lib/config';
import { authenticatedFetch } from '../lib/auth';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const authError = searchParams.get('error');

  useEffect(() => {
    if (authError) {
      setError('Authentication failed. Please try again.');
    }
  }, [authError]);

  // Check if session already exists
  useEffect(() => {
    authenticatedFetch(`${API_BASE}/api/auth/me`)
      .then(res => res.json())
      .then(data => {
        if (data.user && (data.user.sub || data.user.id)) {
          navigate('/workspace', { replace: true });
        }
      })
      .catch(() => {});
  }, [navigate]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/api/auth/google`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      const text = await response.text();
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('Auth API Response:', text);
        if (text.trim().startsWith('<!DOCTYPE html') || text.trim().startsWith('<html')) {
          throw new Error(`The API request reached your website instead of the Worker. Please ensure the Cloudflare Worker route for "eventframe.io/api/*" is correctly configured.`);
        }
        throw new Error(`Authentication API error (Status: ${response.status}). The server returned an invalid format.`);
      }
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to initialize Google Login');
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE}/api/auth/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok) {
        // For physical email login, we'd wait for a link. 
        // For this demo/staff "finish", we'll assume it returns a session or a next step.
        if (data.success) {
          navigate('/workspace');
        } else {
          setError('We couldn\'t find an account with that email.');
        }
      } else {
        throw new Error(data.error || 'Failed to initialize Email Login');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF0] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-[#C5A059] opacity-5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-[#2D2424] opacity-5 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-[#C5A059]/10 relative z-10 text-center">
          <div className="inline-block p-4 rounded-full bg-[#C5A059]/10 mb-8">
            <Heart className="w-10 h-10 text-[#C5A059]" />
          </div>
          
          <h1 className="text-4xl font-serif mb-4 text-[#2D2424]">Wedding Manager</h1>
          <p className="text-[#2D2424]/60 mb-10 font-sans tracking-wide">
            {showEmailLogin ? 'Enter your email to receive a secure login link' : 'Sign in to customize your wall and manage messages'}
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {!showEmailLogin ? (
              <>
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full py-4 px-6 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-3 transition-all font-medium text-[#2D2424] shadow-sm hover:shadow-md disabled:opacity-50"
                >
                  <Chrome className="w-5 h-5" />
                  {loading ? 'Connecting...' : 'Continue with Google'}
                </button>
                
                <button
                  onClick={() => setShowEmailLogin(true)}
                  className="w-full py-4 px-6 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-3 transition-all font-medium text-[#2D2424] shadow-sm hover:shadow-md"
                >
                  <Mail className="w-5 h-5" />
                  Sign in with Email
                </button>
              </>
            ) : (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <input 
                  type="email"
                  required
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-6 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-[#C5A059] focus:border-transparent outline-none transition-all"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-6 rounded-2xl bg-[#C5A059] text-white flex items-center justify-center gap-3 transition-all font-bold uppercase tracking-widest text-xs hover:bg-[#B38D45] disabled:opacity-50 shadow-xl shadow-[#C5A059]/20"
                >
                  {loading ? 'Sending link...' : 'Send Magic Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmailLogin(false)}
                  className="w-full py-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Back to Social Login
                </button>
              </form>
            )}
          </div>

          <div className="mt-10 pt-8 border-t border-gray-100 italic">
            <p className="text-xs text-[#2D2424]/40 font-serif">
              "Love is not only something you feel, it is something you do."
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
