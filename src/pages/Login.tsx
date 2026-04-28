import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, Chrome, Heart } from 'lucide-react';

import { API_BASE } from '../lib/config';
import { authenticatedFetch } from '../lib/auth';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          navigate('/admin', { replace: true });
        }
      })
      .catch(() => {});
  }, [navigate]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const source = window.location.origin;
      const apiUrl = `${API_BASE}/api/auth/google?source=${encodeURIComponent(source)}`;
      console.log('[Login] Initializing Google Login at:', apiUrl);
      
      const response = await fetch(apiUrl);
      const contentType = response.headers.get('Content-Type') || '';
      const text = await response.text();
      
      if (!response.ok) {
        console.error('[Login] API Error Status:', response.status);
        console.error('[Login] API Error Body:', text);
        throw new Error(`Auth failed (${response.status}): ${text.substring(0, 100)}`);
      }

      if (!contentType.includes('application/json')) {
        console.error('[Login] Expected JSON but got:', contentType);
        console.error('[Login] Response Preview:', text.substring(0, 200));
        throw new Error(`Server returned non-JSON response (${contentType}). Likely caught by proxy. Check URL: ${apiUrl}`);
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error('[Login] JSON Parse Error. Raw body:', text.substring(0, 500));
        throw new Error(`Failed to parse response from ${apiUrl}. Check console.`);
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
            Sign in to customize your wall and manage messages
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center gap-3 transition-all font-medium text-[#2D2424] shadow-sm hover:shadow-md disabled:opacity-50"
            >
              <Chrome className="w-5 h-5" />
              {loading ? 'Connecting...' : 'Continue with Google'}
            </button>
            
            <button
              disabled
              className="w-full py-4 px-6 rounded-2xl border border-gray-200 bg-white opacity-50 cursor-not-allowed flex items-center justify-center gap-3 transition-all font-medium text-[#2D2424]"
            >
              <Mail className="w-5 h-5" />
              Sign in with Email
            </button>
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
