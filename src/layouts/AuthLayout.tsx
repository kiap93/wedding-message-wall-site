import React from 'react';
import { useNavigate } from 'react-router-dom';

export interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex flex-col md:flex-row font-sans">
      {/* Editorial Visual Column */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#EFECE6] overflow-hidden flex-col justify-between p-12">
        <img
          src="/src/assets/images/hero_wedding_editorial_1793501242401.jpg"
          alt="Modern Wedding Editorial"
          className="absolute inset-0 w-full h-full object-cover grayscale-[15%] contrast-[105%]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#252525]/85 via-[#252525]/30 to-transparent" />

        {/* Brand in Image */}
        <div className="relative z-10">
          <button
            onClick={() => navigate('/')}
            className="text-white text-base font-semibold tracking-tight hover:opacity-80 transition-opacity"
          >
            EventFrame<span className="text-[#C5BDAC]">.io</span>
          </button>
        </div>

        {/* Editorial Quote */}
        <div className="relative z-10 max-w-md text-white">
          <blockquote className="font-serif text-3xl font-normal leading-snug tracking-tight text-[#FAF9F7]">
            “The standard of elegance and real-time execution for modern wedding studios.”
          </blockquote>
          <p className="text-xs text-[#FAF9F7]/75 mt-3 tracking-wide">
            White-label digital stationery, live moderation, and RSVP infrastructure.
          </p>
        </div>
      </div>

      {/* Auth Content Column */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          {/* Mobile brand mark */}
          <div className="lg:hidden mb-8 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-lg font-semibold tracking-tight text-[#252525]"
            >
              EventFrame<span className="text-[#8B806F]">.io</span>
            </button>
          </div>

          {/* Card Surface */}
          <div className="bg-white border border-[#E8E8E5] rounded-lg p-6 sm:p-8 shadow-card">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[#252525] tracking-tight">{title}</h2>
              {subtitle && (
                <p className="text-xs text-[#777777] mt-1 leading-relaxed">{subtitle}</p>
              )}
            </div>

            {children}
          </div>

          {/* Simple footer note */}
          <div className="mt-8 text-center text-xs text-[#777777]">
            <span>Need help? Contact </span>
            <a href="mailto:support@eventframe.io" className="text-[#252525] hover:underline">
              support@eventframe.io
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
