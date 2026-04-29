import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Globe, ArrowRight, CheckCircle2 } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { API_BASE } from '../lib/config';
import { authenticatedFetch } from '../lib/auth';

export default function Onboarding() {
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const slug = subdomain.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (slug.length < 3) {
      setError('Subdomain must be at least 3 characters');
      setLoading(false);
      return;
    }

    try {
      // 1. Get user profile
      const userRes = await authenticatedFetch(`${API_BASE}/api/auth/me`);
      const userData = await userRes.json();
      
      if (!userData.user) throw new Error('Not authenticated');

      const supabase = getSupabase();
      
      // 2. Check if slug exists
      const { data: existing } = await supabase
        .from('agencies')
        .select('id')
        .eq('slug', slug)
        .single();
        
      if (existing) {
        throw new Error('This subdomain is already taken');
      }

      // 3. Create workspace
      const { error: insertError } = await supabase
        .from('agencies')
        .insert([
          {
            name,
            slug,
            user_id: userData.user.id,
          }
        ]);

      if (insertError) throw insertError;

      // 4. Redirect to workspace
      const protocol = window.location.protocol;
      const hostParts = window.location.host.split('.');
      const baseDomain = hostParts.length > 2 ? hostParts.slice(-2).join('.') : hostParts.join('.');
      
      window.location.href = `${protocol}//${slug}.${baseDomain}/admin`;

    } catch (err: any) {
      setError(err.message || 'Failed to create workspace');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF0] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-black/5 p-8 border border-black/5">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-[#C5A059]/10 rounded-2xl flex items-center justify-center mb-4">
            <Layout className="w-8 h-8 text-[#C5A059]" />
          </div>
          <h1 className="text-3xl font-serif text-[#2C1810] mb-2">Create your workspace</h1>
          <p className="text-[#2C1810]/60">Perfect for event planners and wedding agencies.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#2C1810]/70 mb-2">
              Workspace Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Elegant Events Co."
              required
              className="w-full px-4 py-3 bg-[#FDFCF0] border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059] transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2C1810]/70 mb-2">
              Custom Subdomain
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                <Globe className="w-4 h-4 text-[#2C1810]/30 group-focus-within:text-[#C5A059] transition-colors" />
              </div>
              <input
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="your-name"
                required
                className="w-full pl-11 pr-32 py-3 bg-[#FDFCF0] border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059] transition-all"
              />
              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                <span className="text-sm font-medium text-[#2C1810]/40">.eventframe.io</span>
              </div>
            </div>
            <p className="mt-2 text-xs text-[#2C1810]/50 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              Public URL: {subdomain || 'name'}.eventframe.io
            </p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#C5A059] hover:bg-[#B38D46] text-white py-4 rounded-xl font-medium shadow-lg shadow-[#C5A059]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Create Workspace
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
