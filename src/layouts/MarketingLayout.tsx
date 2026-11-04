import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowRight } from 'lucide-react';

export interface MarketingLayoutProps {
  children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const [solutionsOpen, setSolutionsOpen] = useState(false);

  const solutions = [
    { title: 'Wedding Planner Software', href: '/wedding-planner-software', desc: 'Studio management & client workflows' },
    { title: 'White-Label Software', href: '/white-label-wedding-software', desc: 'Custom agency subdomains & branding' },
    { title: 'Digital Wedding Invitations', href: '/digital-wedding-invitations', desc: 'Canvas stationery studio & RSVP links' },
    { title: 'Wedding RSVP Management', href: '/wedding-rsvp-management', desc: 'Conditional questionnaires & CSV export' },
    { title: 'Wedding Guest Management', href: '/wedding-guest-management', desc: 'Attendance tracking & live moderation' },
    { title: 'Wedding Reception Display', href: '/wedding-reception-display', desc: 'Ballroom projector memory wall' },
  ];

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#252525] flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#F7F7F5]/90 backdrop-blur-md border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Brand Wordmark */}
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); navigate('/'); }}
            className="text-base font-semibold tracking-tight text-[#252525] whitespace-nowrap shrink-0 hover:text-[#8B806F] transition-colors"
          >
            EventFrame<span className="text-[#8B806F]">.io</span>
          </a>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#777777]">
            {/* Solutions Dropdown */}
            <div 
              className="relative"
              onMouseEnter={() => setSolutionsOpen(true)}
              onMouseLeave={() => setSolutionsOpen(false)}
            >
              <button
                className="flex items-center gap-1 hover:text-[#252525] transition-colors py-2 whitespace-nowrap"
                onClick={() => setSolutionsOpen(!solutionsOpen)}
              >
                Solutions
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${solutionsOpen ? 'rotate-180' : ''}`} />
              </button>

              {solutionsOpen && (
                <div className="absolute top-full left-0 w-72 bg-white border border-[#E8E8E5] rounded-lg shadow-lg p-3 z-50 space-y-1">
                  {solutions.map((item, idx) => (
                    <a
                      key={idx}
                      href={item.href}
                      onClick={(e) => { e.preventDefault(); setSolutionsOpen(false); navigate(item.href); }}
                      className="block p-2 rounded hover:bg-[#FAF9F7] transition-colors group"
                    >
                      <div className="text-xs font-semibold text-[#252525] group-hover:text-[#8B806F] transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[#777777]">
                        {item.desc}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <a 
              href="/templates" 
              onClick={(e) => { e.preventDefault(); navigate('/templates'); }}
              className="hover:text-[#252525] transition-colors whitespace-nowrap shrink-0"
            >
              Themes & Suites
            </a>
            <a 
              href="/pricing" 
              onClick={(e) => { e.preventDefault(); navigate('/pricing'); }}
              className="hover:text-[#252525] transition-colors whitespace-nowrap shrink-0"
            >
              Pricing
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/login"
              onClick={(e) => { e.preventDefault(); navigate('/login'); }}
              className="text-xs font-medium text-[#777777] hover:text-[#252525] px-2.5 py-1.5 transition-colors whitespace-nowrap"
            >
              Sign In
            </a>
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

      {/* Comprehensive Editorial Footer */}
      <footer className="border-t border-[#E8E8E5] bg-[#FFFFFF] py-14 px-6 mt-20">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Column 1: Brand Info */}
            <div className="col-span-2 space-y-3">
              <a href="/" className="text-base font-semibold tracking-tight text-[#252525]">
                EventFrame<span className="text-[#8B806F]">.io</span>
              </a>
              <p className="text-xs text-[#777777] leading-relaxed max-w-sm">
                The integrated wedding platform for modern studios, planners and couples. Unifying digital stationery, custom RSVP logic, guest moderation, and live reception screens.
              </p>
              <div className="pt-2 text-[11px] text-[#8B806F]">
                White-label infrastructure for luxury ceremonies.
              </div>
            </div>

            {/* Column 2: Platform Solutions */}
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-[#252525] uppercase tracking-wider text-[11px]">Solutions</div>
              <ul className="space-y-2 text-[#777777]">
                <li><a href="/wedding-planner-software" className="hover:text-[#252525] transition-colors">Planner Software</a></li>
                <li><a href="/white-label-wedding-software" className="hover:text-[#252525] transition-colors">White-Label Software</a></li>
                <li><a href="/digital-wedding-invitations" className="hover:text-[#252525] transition-colors">Digital Invitations</a></li>
                <li><a href="/wedding-rsvp-management" className="hover:text-[#252525] transition-colors">RSVP Management</a></li>
                <li><a href="/wedding-guest-management" className="hover:text-[#252525] transition-colors">Guest Management</a></li>
                <li><a href="/wedding-reception-display" className="hover:text-[#252525] transition-colors">Reception Displays</a></li>
              </ul>
            </div>

            {/* Column 3: Themes & Templates */}
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-[#252525] uppercase tracking-wider text-[11px]">Themes & Suites</div>
              <ul className="space-y-2 text-[#777777]">
                <li><a href="/templates" className="hover:text-[#252525] transition-colors">All Display Themes</a></li>
                <li><a href="/display?template=minimal_luxury" className="hover:text-[#252525] transition-colors">Minimal Luxury</a></li>
                <li><a href="/display?template=garden" className="hover:text-[#252525] transition-colors">Natural Garden</a></li>
                <li><a href="/display?template=romantic" className="hover:text-[#252525] transition-colors">Romantic Love</a></li>
                <li><a href="/display?template=postal" className="hover:text-[#252525] transition-colors">Postal Archive</a></li>
                <li><a href="/display?template=vintage" className="hover:text-[#252525] transition-colors">Vintage Noir</a></li>
              </ul>
            </div>

            {/* Column 4: Access & Account */}
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-[#252525] uppercase tracking-wider text-[11px]">Portals & Plans</div>
              <ul className="space-y-2 text-[#777777]">
                <li><a href="/pricing" className="hover:text-[#252525] transition-colors">Pricing & Plans</a></li>
                <li><a href="/login" className="hover:text-[#252525] transition-colors">Studio Sign In</a></li>
                <li><a href="/couple/login" className="hover:text-[#252525] transition-colors">Couple Portal Login</a></li>
                <li><a href="/login" className="hover:text-[#252525] transition-colors">Start 30-Day Trial</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="pt-8 border-t border-[#E8E8E5] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#777777]">
            <div>
              &copy; {new Date().getFullYear()} EventFrame.io. All rights reserved.
            </div>
            <div className="flex items-center gap-6">
              <a href="/pricing" className="hover:text-[#252525] transition-colors">Subscription Terms</a>
              <span>·</span>
              <a href="/login" className="hover:text-[#252525] transition-colors">Agency Portal</a>
              <span>·</span>
              <span className="text-[#8B806F]">Crafted for luxury wedding studios</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLayout;
