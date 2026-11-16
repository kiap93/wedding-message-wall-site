import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { API_BASE } from '../lib/config';
import { setAuthToken, setCsrfTokenMemory, extractApiErrorMessage, unwrapApiData } from '../lib/auth';
import AuthLayout from '../layouts/AuthLayout';
import Button from '../design-system/components/Button';

export default function Verify() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email address...');
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing or invalid verification token.');
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/verify?token=${encodeURIComponent(token)}`, {
          method: 'POST',
          headers: { 'X-Requested-With': 'EventFrame' },
          credentials: 'include',
        });
        const raw = await response.json().catch(() => null);
        const data = unwrapApiData<any>(raw) || {};
        const verifiedToken = data.token || raw?.token;
        const csrfToken = data.csrfToken || raw?.csrfToken;

        if (response.ok && verifiedToken) {
          setAuthToken(verifiedToken);
          if (csrfToken) setCsrfTokenMemory(csrfToken);
          setStatus('success');
          setMessage('Email confirmed successfully. Redirecting you to your workspace...');
          setTimeout(() => {
            navigate('/workspace');
          }, 1800);
        } else {
          setStatus('error');
          setMessage(extractApiErrorMessage(raw, 'Verification link expired or already used.'));
        }
      } catch {
        setStatus('error');
        setMessage('A network error occurred while verifying your email.');
      }
    };

    verifyToken();
  }, [token, navigate]);

  return (
    <AuthLayout
      title="Email Verification"
      subtitle="Confirming your credentials to secure your workspace"
    >
      <div className="py-4 text-center space-y-4">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-[#8B806F] animate-spin" />
            <p className="text-xs text-[#777777]">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <p className="text-xs font-medium text-green-700">{message}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                <XCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-red-600 leading-relaxed">{message}</p>
            </div>
            <Button
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => navigate('/login')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Return to Sign In
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
