import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { API_BASE } from '../lib/config';
import { useUser } from '../lib/UserContext';
import AuthLayout from '../layouts/AuthLayout';
import Button from '../design-system/components/Button';
import Input from '../design-system/components/Input';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showSetupHelper, setShowSetupHelper] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot-password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { isLoading: isGlobalLoading } = useUser();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const authError = searchParams.get('error');

  useEffect(() => {
    const token = localStorage.getItem('wedding_session_token');
    if (token && !loading && !isGlobalLoading) {
      navigate('/workspace');
    }
  }, [navigate, loading, isGlobalLoading]);

  useEffect(() => {
    if (authError) {
      setError(decodeURIComponent(authError));
    }
  }, [authError]);

  const handleGoogleLogin = () => {
    setLoading(true);
    setError(null);
    setShowSetupHelper(false);
    localStorage.removeItem('wedding_session_token');
    
    const currentOrigin = window.location.origin;
    
    fetch(`${API_BASE}/api/auth/google?origin=${encodeURIComponent(currentOrigin)}`, {
      headers: { 'Accept': 'application/json' }
    })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || data.error || 'Failed to initialize Google login');
        if (data.url) {
          window.location.href = data.url;
        } else {
          throw new Error('No URL returned from server');
        }
      })
      .catch(err => {
        console.error('Google login prep error:', err);
        const message = err instanceof Error ? err.message : 'An error occurred during sign in';
        setError(message);
        
        if (message.includes('403') || 
            message.includes('Forbidden') || 
            message.includes('client_id') ||
            message.includes('invalid_client')) {
          setShowSetupHelper(true);
        }
        setLoading(false);
      });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      setLoading(false);
      return;
    }

    if (email.toLowerCase().endsWith('@gmail.com')) {
      setError('Please use the "Continue with Google" button for Gmail accounts.');
      setLoading(false);
      return;
    }

    if (mode !== 'forgot-password' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      localStorage.removeItem('wedding_session_token');

      const endpoint = mode === 'forgot-password' ? '/api/auth/forgot-password' : '/api/auth/email';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, mode }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.success) {
          if (mode === 'forgot-password') {
            setSuccess('If this email is registered, you will receive a password reset link shortly.');
          } else {
            setSuccess(mode === 'signup' 
              ? 'Account created! Please check your email for a verification link.' 
              : 'A secure login link has been sent to your email.');
          }
          setError(null);
        } else {
          setError(data.error || 'Authentication failed.');
        }
      } else {
        if (data.error?.includes('already exists')) {
          setError('This email is already registered. If you have not verified it, try signing up again.');
        } else {
          setError(data.error || (mode === 'signup' ? 'Failed to create account.' : 'Invalid credentials.'));
        }
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const titles = {
    login: 'Agency & Studio Sign In',
    signup: 'Create Agency Account',
    'forgot-password': 'Reset Your Password',
  };

  const subtitles = {
    login: 'Access your white-label weddings, live moderation, and invitations.',
    signup: 'Start delivering custom digital wedding suites to your clients.',
    'forgot-password': 'Enter your registered email address to receive reset instructions.',
  };

  return (
    <AuthLayout title={titles[mode]} subtitle={subtitles[mode]}>
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Google Continue */}
        <Button
          variant="outline"
          size="md"
          onClick={handleGoogleLogin}
          isLoading={loading}
          className="w-full"
          leftIcon={
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          }
        >
          Continue with Google
        </Button>

        {showSetupHelper && (
          <div className="p-3 bg-[#FAF9F7] rounded-md border border-[#E8E8E5] text-[11px] text-[#777777] space-y-1.5">
            <div className="font-medium text-[#252525]">Google OAuth Configuration:</div>
            <p>Ensure your OAuth redirect URI includes:</p>
            <code className="block p-1.5 bg-white border border-[#E8E8E5] rounded font-mono text-[10px] text-[#252525] select-all break-all">
              {window.location.origin}/api/auth/callback
            </code>
          </div>
        )}

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E8E8E5]" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-3 bg-white text-[#777777]">or email</span>
          </div>
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailAuth} className="space-y-3">
          <Input
            label="Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="planner@studio.com"
            required
          />

          {mode !== 'forgot-password' && (
            <div>
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
              />
              {mode === 'login' && (
                <div className="flex justify-end mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot-password');
                      setError(null);
                      setSuccess(null);
                    }}
                    className="text-xs text-[#777777] hover:text-[#252525] transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={loading}
            className="w-full mt-2"
          >
            {mode === 'login' ? 'Sign In to Workspace' : mode === 'signup' ? 'Create Agency Account' : 'Send Reset Link'}
          </Button>
        </form>

        <div className="pt-2 text-center text-xs text-[#777777]">
          {mode === 'login' ? (
            <span>
              New agency?{' '}
              <button
                onClick={() => {
                  setMode('signup');
                  setError(null);
                  setSuccess(null);
                }}
                className="text-[#252525] font-medium hover:underline"
              >
                Create an account
              </button>
            </span>
          ) : (
            <span>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccess(null);
                }}
                className="text-[#252525] font-medium hover:underline"
              >
                Sign in
              </button>
            </span>
          )}
        </div>

        {/* Link to Couple Portal */}
        <div className="pt-4 border-t border-[#E8E8E5] text-center">
          <span className="text-xs text-[#777777]">Are you a bride or groom? </span>
          <button
            onClick={() => navigate('/couple/login')}
            className="text-xs text-[#8B806F] font-medium hover:underline"
          >
            Couple Event Login &rarr;
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
