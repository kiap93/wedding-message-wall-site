import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout, Globe, ArrowRight, CheckCircle2, Building2, Heart, ArrowLeft } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { API_BASE } from '../lib/config';
import { authenticatedFetch } from '../lib/auth';
import { useUser } from '../lib/UserContext';
import Button from '../design-system/components/Button';
import Input from '../design-system/components/Input';

export default function Onboarding() {
  const { user } = useUser();
  const [role, setRole] = useState<'agency' | 'couple' | null>(null);
  const [name, setName] = useState('');
  const [groomName, setGroomName] = useState('');
  const [brideName, setBrideName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkExisting = async () => {
      if (!user) return;
      try {
        const supabase = getSupabase();
        const userId = user.id || user.sub;
        
        const { data: existingAgency } = await supabase
          .from('agencies')
          .select('id, slug, user_role')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingAgency) {
          const protocol = window.location.protocol;
          const hostParts = window.location.host.split('.');
          const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const baseDomain = isLocalhost ? 'localhost:3000' : (hostParts.length > 2 ? hostParts.slice(-2).join('.') : hostParts.join('.'));
          const token = localStorage.getItem('wedding_session_token');

          if (existingAgency.user_role === 'agency') {
            window.location.replace(`${protocol}//${existingAgency.slug}.${baseDomain}/workspace${token ? `?token=${token}` : ''}`);
          } else {
            window.location.replace('/workspace');
          }
        }
      } catch (err) {
        console.error('Error checking existing agency:', err);
      }
    };
    checkExisting();
  }, [navigate, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    setError(null);

    const slug = subdomain.toLowerCase().replace(/[^a-z0-9-]/g, '');
    
    if (slug.length < 3) {
      setError('Subdomain must be at least 3 characters.');
      setLoading(false);
      return;
    }

    try {
      const response = await authenticatedFetch(`${API_BASE}/api/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          name,
          groomName,
          brideName,
          slug
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to complete onboarding');
      }

      const { createdProjectId } = await response.json();

      const protocol = window.location.protocol;
      const hostParts = window.location.host.split('.');
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseDomain = hostParts.length > 2 ? hostParts.slice(-2).join('.') : hostParts.join('.');
      const token = localStorage.getItem('wedding_session_token');
      
      if (role === 'agency') {
        window.location.replace(`${protocol}//${slug}.${baseDomain}/workspace${token ? `?token=${token}` : ''}`);
      } else {
        window.location.replace(`/workspace${createdProjectId ? `?project=${createdProjectId}` : ''}`);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to configure workspace');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col justify-center items-center p-6 font-sans">
      <div className="w-full max-w-xl">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="text-base font-semibold tracking-tight text-[#252525]">
            EventFrame<span className="text-[#8B806F]">.io</span>
          </div>
          <p className="text-xs text-[#777777] mt-1">Set up your workspace in less than 60 seconds</p>
        </div>

        {!role ? (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-xl font-semibold text-[#252525] tracking-tight">Select your account type</h1>
              <p className="text-xs text-[#777777] mt-1">Choose how you plan to use EventFrame</p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div 
                onClick={() => {
                  setRole('agency');
                  setName('');
                }}
                className="bg-white border border-[#E8E8E5] hover:border-[#252525] rounded-lg p-6 cursor-pointer transition-all shadow-subtle group flex flex-col justify-between text-left"
              >
                <div>
                  <div className="w-9 h-9 rounded-md bg-[#FAF9F7] border border-[#E8E8E5] text-[#252525] flex items-center justify-center mb-4">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#252525]">Event Agency / Studio</h3>
                  <p className="text-xs text-[#777777] mt-1.5 leading-relaxed">
                    For planners and photographers managing multiple weddings under their own agency brand and subdomain.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-xs font-medium text-[#252525] group-hover:translate-x-0.5 transition-transform">
                  <span>Continue as Agency</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>

              <div 
                onClick={() => {
                  setRole('couple');
                  setName('');
                }}
                className="bg-white border border-[#E8E8E5] hover:border-[#252525] rounded-lg p-6 cursor-pointer transition-all shadow-subtle group flex flex-col justify-between text-left"
              >
                <div>
                  <div className="w-9 h-9 rounded-md bg-[#FAF9F7] border border-[#E8E8E5] text-[#8B806F] flex items-center justify-center mb-4">
                    <Heart className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#252525]">Bride & Groom</h3>
                  <p className="text-xs text-[#777777] mt-1.5 leading-relaxed">
                    Planning your own celebration. Create invitations, manage RSVPs, and stream live guest messages.
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1 text-xs font-medium text-[#252525] group-hover:translate-x-0.5 transition-transform">
                  <span>Continue as Couple</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#E8E8E5] rounded-lg p-6 sm:p-8 shadow-card">
            <button
              onClick={() => { setRole(null); setError(null); }}
              className="inline-flex items-center gap-1 text-xs text-[#777777] hover:text-[#252525] mb-5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to account selection</span>
            </button>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#252525] tracking-tight">
                {role === 'agency' ? 'Configure Agency Workspace' : 'Configure Wedding Space'}
              </h2>
              <p className="text-xs text-[#777777] mt-1">
                {role === 'agency' 
                  ? 'Set your agency brand name and claim your custom subdomain' 
                  : 'Enter your names and create your wedding guest URL'}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {role === 'couple' ? (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Groom's Name"
                    placeholder="e.g. Lucas"
                    value={groomName}
                    onChange={(e) => setGroomName(e.target.value)}
                    required
                  />
                  <Input
                    label="Bride's Name"
                    placeholder="e.g. Sofia"
                    value={brideName}
                    onChange={(e) => setBrideName(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <Input
                  label="Agency / Studio Name"
                  placeholder="e.g. Atelier Blanc Events"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}

              <div>
                <Input
                  label={role === 'agency' ? 'Agency Subdomain' : 'Event URL Slug'}
                  placeholder={role === 'agency' ? 'atelier-blanc' : 'lucas-and-sofia'}
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  hint={
                    role === 'agency'
                      ? `Your workspace will live at: ${subdomain || 'your-agency'}.eventframe.io`
                      : `Guest link: eventframe.io/${subdomain || 'your-wedding'}`
                  }
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={loading}
                className="w-full mt-2"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                {role === 'agency' ? 'Create Agency Workspace' : 'Launch Wedding Suite'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
