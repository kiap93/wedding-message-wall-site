import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useUser } from '../../lib/UserContext';
import { developerApi, DeveloperAdminIdentity, DeveloperApiError } from '../../lib/developerApi';

interface DeveloperRouteGuardProps {
  children: (admin: DeveloperAdminIdentity) => React.ReactNode;
}

export const DeveloperRouteGuard: React.FC<DeveloperRouteGuardProps> = ({ children }) => {
  const { user, isLoading: isUserLoading, isSessionVerified } = useUser();
  const location = useLocation();
  const navigate = useNavigate();

  const [verifying, setVerifying] = useState(true);
  const [admin, setAdmin] = useState<DeveloperAdminIdentity | null>(null);
  const [redirectNonDeveloper, setRedirectNonDeveloper] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unauthenticated, setUnauthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    async function verifyServerDeveloper() {
      if (isUserLoading || !isSessionVerified) return;

      const token = localStorage.getItem('wedding_session_token');
      if (!user && !token) {
        if (active) {
          setUnauthenticated(true);
          setRedirectNonDeveloper(false);
          setVerifying(false);
        }
        return;
      }

      if (user && user.is_developer !== true && user.isDeveloper !== true) {
        if (active) {
          setRedirectNonDeveloper(true);
          setUnauthenticated(false);
          setVerifying(false);
        }
        return;
      }

      setVerifying(true);
      try {
        const res = await developerApi.getMe();
        if (!active) return;
        if (res?.admin?.is_developer === true || res?.admin?.isDeveloper === true) {
          setAdmin(res.admin);
          setRedirectNonDeveloper(false);
          setErrorMessage(null);
          setUnauthenticated(false);
        } else {
          setRedirectNonDeveloper(true);
        }
      } catch (err: any) {
        if (!active) return;
        if (err instanceof DeveloperApiError) {
          if (err.status === 401) {
            setUnauthenticated(true);
            setRedirectNonDeveloper(false);
          } else if (err.status === 403) {
            setRedirectNonDeveloper(true);
          } else {
            setErrorMessage(err.message || 'Unable to verify developer authorization.');
          }
        } else {
          setErrorMessage('Unable to verify developer authorization.');
        }
      } finally {
        if (active) setVerifying(false);
      }
    }

    verifyServerDeveloper();
    return () => {
      active = false;
    };
  }, [user?.id, user?.email, user?.is_developer, isUserLoading, isSessionVerified]);

  if (isUserLoading || !isSessionVerified || verifying) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-6 h-6 border-2 border-[#252525] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs text-[#666666]">Verifying platform developer authorization...</p>
      </div>
    );
  }

  if (unauthenticated) {
    const redirectTarget = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirectTarget}`} replace />;
  }

  if (redirectNonDeveloper) {
    return <Navigate to="/workspace" replace />;
  }

  if (errorMessage || !admin) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-md bg-white border border-[#E8E8E5] rounded-lg p-6 text-center">
          <div className="w-10 h-10 rounded-md bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#B91C1C]">
            Authorization Check Failed
          </div>
          <h1 className="text-base font-semibold text-[#1A1A1A] mt-1">
            Developer Access Unavailable
          </h1>
          <p className="text-xs text-[#666666] mt-2 leading-relaxed">
            {errorMessage || 'Your account does not hold developer privileges required for platform administration.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/workspace')}
              className="h-9 px-4 bg-[#252525] text-white text-xs font-medium rounded-md hover:bg-[#3A3A3A] inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Workspace</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(admin)}</>;
};

export default DeveloperRouteGuard;
