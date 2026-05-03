import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Globe, ArrowRight, CheckCircle2 } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { API_BASE } from '../lib/config';
import { authenticatedFetch } from '../lib/auth';

export default function Onboarding() {
  const [role, setRole] = useState<'agency' | 'couple' | null>(null);
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
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
            name: role === 'couple' ? `${name}'s Wedding` : name,
            slug,
            user_id: userData.user.id,
            user_role: role
          }
        ]);

      if (insertError) throw insertError;

      // 4. Redirect to workspace
      const protocol = window.location.protocol;
      const hostParts = window.location.host.split('.');
      const baseDomain = hostParts.length > 2 ? hostParts.slice(-2).join('.') : hostParts.join('.');
      const token = localStorage.getItem('wedding_session_token');
      
      window.location.href = `${protocol}//${slug}.${baseDomain}/admin${token ? `?token=${token}` : ''}`;

    } catch (err: any) {
      setError(err.message || 'Failed to create workspace');
      setLoading(false);
    }
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-[#FDFCF0] flex flex-col items-center justify-center p-4">
        <div className="max-w-4xl w-full text-center mb-12">
          <h1 className="text-5xl font-serif text-[#2C1810] mb-4">How will you use EventFrame?</h1>
          <p className="text-[#2C1810]/60 text-lg">Select the path that fits you best.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl w-full">
          <button 
            onClick={() => {
              setRole('couple');
              setName('');
            }}
            className="bg-white p-10 rounded-[3rem] shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all text-left border border-black/5 group"
          >
            <div className="w-16 h-16 bg-[#C5A059]/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
              <CheckCircle2 className="w-8 h-8 text-[#C5A059]" />
            </div>
            <h2 className="text-3xl font-serif text-[#2C1810] mb-4">I'm a Couple</h2>
            <p className="text-[#2C1810]/60 leading-relaxed mb-8">
              Planning your own special day. Create a beautiful digital guestbook and manage your RSVPs in one place.
            </p>
            <div className="flex items-center gap-2 text-[#C5A059] font-black uppercase tracking-widest text-[10px]">
              Individual Plan <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          <button 
            onClick={() => {
              setRole('agency');
              setName('');
            }}
            className="bg-[#2D2424] p-10 rounded-[3rem] shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all text-left border border-white/5 group text-white"
          >
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
              <Layout className="w-8 h-8 text-[#C5A059]" />
            </div>
            <h2 className="text-3xl font-serif mb-4">I'm an Agency</h2>
            <p className="opacity-60 leading-relaxed mb-8">
              Managing weddings for multiple clients. Professional white-label tools to elevate your agency's service.
            </p>
            <div className="flex items-center gap-2 text-[#C5A059] font-black uppercase tracking-widest text-[10px]">
              Agency Pro Plan <ArrowRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCF0] flex flex-col items-center justify-center p-4">
      <button 
        onClick={() => setRole(null)}
        className="mb-8 text-[#2C1810]/40 hover:text-[#C5A059] text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
      >
        ← Back to selection
      </button>

      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-black/5 p-8 border border-black/5">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-[#C5A059]/10 rounded-2xl flex items-center justify-center mb-4">
            {role === 'agency' ? <Layout className="w-8 h-8 text-[#C5A059]" /> : <CheckCircle2 className="w-8 h-8 text-[#C5A059]" />}
          </div>
          <h1 className="text-3xl font-serif text-[#2C1810] mb-2">
            {role === 'agency' ? 'Your Agency Space' : 'Your Wedding Space'}
          </h1>
          <p className="text-[#2C1810]/60">
            {role === 'agency' ? 'Name your agency and claim your domain.' : 'Name your wedding and claim your guest URL.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#2C1810]/70 mb-2">
              {role === 'agency' ? 'Agency Name' : 'Couple Names'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={role === 'agency' ? "e.g. Elegant Events Co." : "e.g. Lucas & Sofia"}
              required
              className="w-full px-4 py-3 bg-[#FDFCF0] border border-black/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30 focus:border-[#C5A059] transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#2C1810]/70 mb-2">
              Guest URL Subdomain
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
                {role === 'agency' ? 'Create Agency' : 'Start Planning'}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
