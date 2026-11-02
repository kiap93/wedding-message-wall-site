import React from 'react';
import { useNavigate } from 'react-router-dom';

export interface MarketingLayoutProps {
  children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#252525] flex flex-col font-sans">
      {/* Top Bar Contract: Exactly 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#F7F7F5]/90 backdrop-blur-md border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); navigate('/'); }}
            className="text-base font-semibold tracking-tight text-[#252525] whitespace-nowrap shrink-0 hover:text-[#8B806F] transition-colors"
          >
            EventFrame<span className="text-[#8B806F]">.io</span>
          </a>

          {/* Zone 2: 4–5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#777777]">
            <a href="#features" className="hover:text-[#252525] transition-colors whitespace-nowrap shrink-0">
              Platform Features
            </a>
            <a href="#agencies" className="hover:text-[#252525] transition-colors whitespace-nowrap shrink-0">
              For Agencies
            </a>
            <a href="#templates" className="hover:text-[#252525] transition-colors whitespace-nowrap shrink-0">
              Invitation Suites
            </a>
            <a href="#pricing" className="hover:text-[#252525] transition-colors whitespace-nowrap shrink-0">
              Pricing
            </a>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => navigate('/login')}
              className="text-xs font-medium text-[#777777] hover:text-[#252525] px-2.5 py-1.5 transition-colors whitespace-nowrap"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/login')}
              className="h-8 px-3.5 text-xs font-medium bg-[#252525] text-white rounded-md hover:bg-[#383838] transition-colors shadow-sm whitespace-nowrap shrink-0"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Clean Editorial Footer */}
      <footer className="border-t border-[#E8E8E5] bg-[#FFFFFF] py-12 px-6 mt-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="text-sm font-semibold tracking-tight text-[#252525]">
              EventFrame<span className="text-[#8B806F]">.io</span>
            </div>
            <p className="text-xs text-[#777777] mt-1 max-w-sm">
              The modern white-label digital suite for luxury wedding planners, studios, and couples.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-[#777777]">
            <a href="/login" className="hover:text-[#252525] transition-colors">Sign In</a>
            <a href="/templates" className="hover:text-[#252525] transition-colors">Templates</a>
            <a href="/couple/login" className="hover:text-[#252525] transition-colors">Couple Portal</a>
            <span className="text-[#E8E8E5]">|</span>
            <span>&copy; {new Date().getFullYear()} EventFrame.io. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLayout;
