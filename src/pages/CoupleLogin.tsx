import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { Heart, Lock, User, AlertCircle, Globe } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { useWorkspace } from '../lib/WorkspaceContext';

export default function CoupleLogin() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [slug, setSlug] = useState(searchParams.get('slug') || '');
  const [agencySlug, setAgencySlug] = useState(searchParams.get('agency') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // If we're on an agency subdomain, use its slug
  useEffect(() => {
    if (workspace) {
      setAgencySlug(workspace.slug);
    }
  }, [workspace]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = getSupabase();
      
      let query = supabase.from('projects').select('*').eq('slug', slug);

      // If we have a workspace context, filter by that agency
      if (workspace) {
        query = query.eq('agency_id', workspace.id);
      } else if (agencySlug) {
        // If on root domain, we need to find the agency first
        const { data: agencyData } = await supabase
          .from('agencies')
          .select('id')
          .eq('slug', agencySlug)
          .single();
        
        if (!agencyData) {
          setError('Agency not found. Please check the agency name.');
          setIsLoading(false);
          return;
        }
        query = query.eq('agency_id', agencyData.id);
      } else {
        setError('Please provide your Agency identifier.');
        setIsLoading(false);
        return;
      }

      const { data, error: fetchError } = await query.single();

      if (fetchError || !data) {
        setError('Event not found within this agency. Please check your slug.');
        setIsLoading(false);
        return;
      }

      if (data.access_password && data.access_password === password) {
        // Successful login
        localStorage.setItem(`wedding_auth_${data.id}`, JSON.stringify({
          eventId: data.id,
          authenticated: true,
          timestamp: Date.now()
        }));
        
        // Use the agency subdomain if possible for the dashboard
        const hostParts = window.location.host.split('.');
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        if (!workspace && !isLocalhost && hostParts.length <= 2) {
          // On root domain, redirect to subdomain dashboard
          const protocol = window.location.protocol;
          const baseDomain = hostParts.slice(-2).join('.');
          window.location.replace(`${protocol}//${agencySlug}.${baseDomain}/${data.slug}/dashboard`);
        } else {
          navigate(`/${data.slug}/dashboard`, { replace: true });
        }
      } else {
        setError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setError('An error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingWorkspace) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#C5A059] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
          {workspace ? (
            <p className="text-gray-500 font-medium tracking-wide">Enter your event details for <span className="text-[#C5A059] font-bold">{workspace.name}</span></p>
          ) : (
            <p className="text-gray-500 font-medium tracking-wide">Enter your agency and event details</p>
          )}
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          {!workspace && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black tracking-widest text-gray-400 ml-1">Agency Name / Slug</label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300" />
                <input 
                  required
                  type="text"
                  placeholder="e.g. elegant-weddings"
                  value={agencySlug}
                  onChange={(e) => setAgencySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full pl-12 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 transition-all font-medium"
                />
              </div>
            </div>
          )}

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
