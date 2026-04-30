import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Heart, Lock, User, AlertCircle } from 'lucide-react';
import { getSupabase } from '../lib/supabase';

export default function CoupleLogin() {
  const [slug, setSlug] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*')
        .eq('slug', slug)
        .single();

      if (fetchError || !data) {
        setError('Event not found. Please check your slug.');
        setIsLoading(false);
        return;
      }

      if (data.access_password && data.access_password === password) {
        // Successful login
        // Store session in localStorage for this specific event
        localStorage.setItem(`wedding_auth_${data.id}`, JSON.stringify({
          eventId: data.id,
          authenticated: true,
          timestamp: Date.now()
        }));
        navigate(`/couple/${data.id}`);
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl border border-[#C5A059]/10 p-12"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#C5A059]/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Heart className="w-8 h-8 text-[#C5A059] fill-current" />
          </div>
          <h1 className="text-3xl font-serif text-[#2D2424] mb-2">Couple Login</h1>
          <p className="text-gray-500 font-medium tracking-wide">Enter your event details to manage your wedding</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black tracking-widest text-gray-400 ml-1">Event Slug</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
              <input 
                required
                type="text"
                placeholder="e.g. alex-sam-2026"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black tracking-widest text-gray-400 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
              <input 
                required
                type="password"
                placeholder="Enter access password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100 italic">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <button 
            disabled={isLoading}
            className="w-full py-5 bg-[#C5A059] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-[#B38D45] transition-all shadow-xl active:scale-95 disabled:opacity-50"
          >
            {isLoading ? 'Verifying...' : 'Login to Dashboard'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-400 font-medium italic">
          If you've forgotten your details, please contact your event agency.
        </p>
      </motion.div>
    </div>
  );
}
