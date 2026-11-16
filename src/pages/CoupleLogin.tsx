import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, Lock, User, AlertCircle, Globe } from 'lucide-react';
import { API_BASE } from '../lib/config';
import { extractApiErrorMessage } from '../lib/auth';
import { useWorkspace } from '../lib/WorkspaceContext';
import AuthLayout from '../layouts/AuthLayout';
import Button from '../design-system/components/Button';
import Input from '../design-system/components/Input';

export default function CoupleLogin() {
  const { workspace, isLoading: isLoadingWorkspace } = useWorkspace();
  const [searchParams] = useSearchParams();
  const [slug, setSlug] = useState(searchParams.get('slug') || '');
  const [agencySlug, setAgencySlug] = useState(searchParams.get('agency') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
      const targetAgencySlug = workspace ? workspace.slug : agencySlug;
      if (!targetAgencySlug) {
        setError('Please provide your Agency identifier.');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/api/couple/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'EventFrame' },
        credentials: 'include',
        body: JSON.stringify({
          agencySlug: targetAgencySlug,
          slug,
          password,
        }),
      });

      const result = await response.json().catch(() => ({} as any));
      if (!response.ok || !result?.success || !result?.project) {
        setError(extractApiErrorMessage(result, 'Incorrect credentials or event not found.'));
        setIsLoading(false);
        return;
      }

      const data = result.project;
      localStorage.setItem(`wedding_auth_${data.id}`, JSON.stringify({
        eventId: data.id,
        pin: password,
        authenticated: true,
        timestamp: Date.now()
      }));

      const hostParts = window.location.host.split('.');
      const hostname = window.location.hostname.toLowerCase();
      const isPreviewOrLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname.endsWith('.run.app') ||
        hostname.endsWith('.pages.dev') ||
        hostname.endsWith('.workers.dev');

      if (!workspace && !isPreviewOrLocal && hostParts.length <= 2) {
        const protocol = window.location.protocol;
        const baseDomain = hostParts.slice(-2).join('.');
        window.location.replace(`${protocol}//${targetAgencySlug}.${baseDomain}/${data.slug}/dashboard`);
      } else {
        navigate(`/${data.slug}/dashboard`, { replace: true });
      }
    } catch (err) {
      setError('An error occurred during sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingWorkspace) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#252525] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <AuthLayout
      title="Couple Event Portal"
      subtitle={
        workspace 
          ? `Access guest list and moderation for ${workspace.name}`
          : 'Access your wedding RSVP list and digital stationery suite'
      }
    >
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-3.5">
        {!workspace && (
          <Input
            label="Agency Slug"
            placeholder="e.g. elegant-weddings"
            value={agencySlug}
            onChange={(e) => setAgencySlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            required
            hint="The agency hosting your wedding website"
          />
        )}

        <Input
          label="Wedding Event Slug"
          placeholder="e.g. celia-elias-2026"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          required
        />

        <Input
          label="Event Access PIN / Password"
          type="password"
          placeholder="Enter event password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          className="w-full mt-2"
        >
          Sign In to Wedding Dashboard
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t border-[#E8E8E5] text-center">
        <span className="text-xs text-[#777777]">Are you an agency or studio? </span>
        <button
          onClick={() => navigate('/login')}
          className="text-xs text-[#8B806F] font-medium hover:underline"
        >
          Agency Sign In &rarr;
        </button>
      </div>
    </AuthLayout>
  );
}
