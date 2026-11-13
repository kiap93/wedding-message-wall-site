import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useMarketingTranslation } from '../lib/i18n/MarketingTranslationContext';
import { MarketingLanguageSelector } from '../components/MarketingLanguageSelector';

export interface MarketingLayoutProps {
  children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { t, getLocalizedPath } = useMarketingTranslation();
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigateTo = (href: string) => {
    setSolutionsOpen(false);
    setMobileMenuOpen(false);
    navigate(getLocalizedPath(href));
  };

  const solutions = [
    {
      title: t('nav.solutionsMenu.planner.title'),
      href: '/wedding-planner-software',
      desc: t('nav.solutionsMenu.planner.desc'),
    },
    {
      title: t('nav.solutionsMenu.whiteLabel.title'),
      href: '/white-label-wedding-software',
      desc: t('nav.solutionsMenu.whiteLabel.desc'),
    },
    {
      title: t('nav.solutionsMenu.invitations.title'),
      href: '/digital-wedding-invitations',
      desc: t('nav.solutionsMenu.invitations.desc'),
    },
    {
      title: t('nav.solutionsMenu.rsvp.title'),
      href: '/wedding-rsvp-management',
      desc: t('nav.solutionsMenu.rsvp.desc'),
    },
    {
      title: t('nav.solutionsMenu.guest.title'),
      href: '/wedding-guest-management',
      desc: t('nav.solutionsMenu.guest.desc'),
    },
    {
      title: t('nav.solutionsMenu.display.title'),
      href: '/wedding-reception-display',
      desc: t('nav.solutionsMenu.display.desc'),
    },
  ];

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    navigateTo(href);
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5] text-[#252525] flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#F7F7F5]/90 backdrop-blur-md border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Brand Wordmark */}
          <a
            href={getLocalizedPath('/')}
            onClick={(e) => handleLinkClick(e, '/')}
            className="text-base font-semibold tracking-tight text-[#252525] whitespace-nowrap shrink-0 hover:text-[#8B806F] transition-colors"
          >
            EventFrame<span className="text-[#8B806F]">.io</span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#777777]">
            {/* Solutions Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setSolutionsOpen(true)}
              onMouseLeave={() => setSolutionsOpen(false)}
            >
              <button
                type="button"
                className="flex items-center gap-1 hover:text-[#252525] transition-colors py-2 whitespace-nowrap"
                onClick={() => setSolutionsOpen(!solutionsOpen)}
              >
                {t('nav.solutions')}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${solutionsOpen ? 'rotate-180' : ''}`} />
              </button>

              {solutionsOpen && (
                <div className="absolute top-full left-0 w-72 bg-white border border-[#E8E8E5] rounded-lg shadow-lg p-3 z-50 space-y-1">
                  {solutions.map((item, idx) => (
                    <a
                      key={idx}
                      href={getLocalizedPath(item.href)}
                      onClick={(e) => handleLinkClick(e, item.href)}
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
              href={getLocalizedPath('/templates')}
              onClick={(e) => handleLinkClick(e, '/templates')}
              className="hover:text-[#252525] transition-colors whitespace-nowrap shrink-0"
            >
              {t('nav.themesSuites')}
            </a>
            <a
              href={getLocalizedPath('/pricing')}
              onClick={(e) => handleLinkClick(e, '/pricing')}
              className="hover:text-[#252525] transition-colors whitespace-nowrap shrink-0"
            >
              {t('nav.pricing')}
            </a>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <MarketingLanguageSelector variant="header" />

            <a
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                navigate('/login');
              }}
              className="hidden sm:inline-block text-xs font-medium text-[#777777] hover:text-[#252525] px-2.5 py-1.5 transition-colors whitespace-nowrap"
            >
              {t('nav.signIn')}
            </a>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate('/login');
              }}
              className="h-8 px-3 sm:px-3.5 text-xs font-medium bg-[#252525] text-white rounded-md hover:bg-[#383838] transition-colors shadow-sm whitespace-nowrap shrink-0"
            >
              {t('nav.getStarted')}
            </button>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#E8E8E5] bg-white/80 text-[#252525] hover:bg-white transition-colors"
              aria-expanded={mobileMenuOpen}
              aria-label={t('nav.menu')}
              data-testid="mobile-menu-toggle"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E8E8E5] bg-[#F7F7F5] px-4 py-5 space-y-5 shadow-md">
            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[#8B806F]">
                {t('nav.solutions')}
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {solutions.map((item, idx) => (
                  <a
                    key={idx}
                    href={getLocalizedPath(item.href)}
                    onClick={(e) => handleLinkClick(e, item.href)}
                    className="block p-2.5 rounded-md bg-white border border-[#E8E8E5] hover:border-[#8B806F] transition-colors"
                  >
                    <div className="text-xs font-semibold text-[#252525]">{item.title}</div>
                    <div className="text-[11px] text-[#777777]">{item.desc}</div>
                  </a>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-[#E8E8E5] text-xs font-medium">
              <a
                href={getLocalizedPath('/templates')}
                onClick={(e) => handleLinkClick(e, '/templates')}
                className="py-2 text-[#252525] hover:text-[#8B806F]"
              >
                {t('nav.themesSuites')}
              </a>
              <a
                href={getLocalizedPath('/pricing')}
                onClick={(e) => handleLinkClick(e, '/pricing')}
                className="py-2 text-[#252525] hover:text-[#8B806F]"
              >
                {t('nav.pricing')}
              </a>
              <a
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  navigate('/login');
                }}
                className="py-2 text-[#555555] hover:text-[#252525]"
              >
                {t('nav.signIn')}
              </a>
            </div>

            <div className="pt-3 border-t border-[#E8E8E5]">
              <MarketingLanguageSelector variant="mobile" />
            </div>
          </div>
        )}
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
              <a
                href={getLocalizedPath('/')}
                onClick={(e) => handleLinkClick(e, '/')}
                className="text-base font-semibold tracking-tight text-[#252525]"
              >
                EventFrame<span className="text-[#8B806F]">.io</span>
              </a>
              <p className="text-xs text-[#777777] leading-relaxed max-w-sm">
                {t('footer.description')}
              </p>
              <div className="pt-2 text-[11px] text-[#8B806F]">
                {t('footer.tagline')}
              </div>
            </div>

            {/* Column 2: Platform Solutions */}
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-[#252525] uppercase tracking-wider text-[11px]">
                {t('footer.columns.solutions')}
              </div>
              <ul className="space-y-2 text-[#777777]">
                <li>
                  <a
                    href={getLocalizedPath('/wedding-planner-software')}
                    onClick={(e) => handleLinkClick(e, '/wedding-planner-software')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.plannerSoftware')}
                  </a>
                </li>
                <li>
                  <a
                    href={getLocalizedPath('/white-label-wedding-software')}
                    onClick={(e) => handleLinkClick(e, '/white-label-wedding-software')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.whiteLabelSoftware')}
                  </a>
                </li>
                <li>
                  <a
                    href={getLocalizedPath('/digital-wedding-invitations')}
                    onClick={(e) => handleLinkClick(e, '/digital-wedding-invitations')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.digitalInvitations')}
                  </a>
                </li>
                <li>
                  <a
                    href={getLocalizedPath('/wedding-rsvp-management')}
                    onClick={(e) => handleLinkClick(e, '/wedding-rsvp-management')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.rsvpManagement')}
                  </a>
                </li>
                <li>
                  <a
                    href={getLocalizedPath('/wedding-guest-management')}
                    onClick={(e) => handleLinkClick(e, '/wedding-guest-management')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.guestManagement')}
                  </a>
                </li>
                <li>
                  <a
                    href={getLocalizedPath('/wedding-reception-display')}
                    onClick={(e) => handleLinkClick(e, '/wedding-reception-display')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.receptionDisplays')}
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Themes & Templates */}
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-[#252525] uppercase tracking-wider text-[11px]">
                {t('footer.columns.themes')}
              </div>
              <ul className="space-y-2 text-[#777777]">
                <li>
                  <a
                    href={getLocalizedPath('/templates')}
                    onClick={(e) => handleLinkClick(e, '/templates')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.allDisplayThemes')}
                  </a>
                </li>
                <li>
                  <a
                    href="/display?template=minimal_luxury"
                    onClick={(e) => handleLinkClick(e, '/display?template=minimal_luxury')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.minimalLuxury')}
                  </a>
                </li>
                <li>
                  <a
                    href="/display?template=garden"
                    onClick={(e) => handleLinkClick(e, '/display?template=garden')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.naturalGarden')}
                  </a>
                </li>
                <li>
                  <a
                    href="/display?template=romantic"
                    onClick={(e) => handleLinkClick(e, '/display?template=romantic')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.romanticLove')}
                  </a>
                </li>
                <li>
                  <a
                    href="/display?template=postal"
                    onClick={(e) => handleLinkClick(e, '/display?template=postal')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.postalArchive')}
                  </a>
                </li>
                <li>
                  <a
                    href="/display?template=vintage"
                    onClick={(e) => handleLinkClick(e, '/display?template=vintage')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.vintageNoir')}
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Access & Account */}
            <div className="space-y-3 text-xs">
              <div className="font-semibold text-[#252525] uppercase tracking-wider text-[11px]">
                {t('footer.columns.portals')}
              </div>
              <ul className="space-y-2 text-[#777777]">
                <li>
                  <a
                    href={getLocalizedPath('/pricing')}
                    onClick={(e) => handleLinkClick(e, '/pricing')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.pricingPlans')}
                  </a>
                </li>
                <li>
                  <a
                    href="/login"
                    onClick={(e) => handleLinkClick(e, '/login')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.studioSignIn')}
                  </a>
                </li>
                <li>
                  <a
                    href="/couple/login"
                    onClick={(e) => handleLinkClick(e, '/couple/login')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.couplePortalLogin')}
                  </a>
                </li>
                <li>
                  <a
                    href="/login"
                    onClick={(e) => handleLinkClick(e, '/login')}
                    className="hover:text-[#252525] transition-colors"
                  >
                    {t('footer.links.startTrial')}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="pt-8 border-t border-[#E8E8E5] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#777777]">
            <div>
              {t('footer.copyright', { year: new Date().getFullYear() })}
            </div>
            <div className="flex items-center gap-6">
              <a
                href={getLocalizedPath('/pricing')}
                onClick={(e) => handleLinkClick(e, '/pricing')}
                className="hover:text-[#252525] transition-colors"
              >
                {t('footer.links.subscriptionTerms')}
              </a>
              <span>·</span>
              <a
                href="/login"
                onClick={(e) => handleLinkClick(e, '/login')}
                className="hover:text-[#252525] transition-colors"
              >
                {t('footer.links.agencyPortal')}
              </a>
              <span>·</span>
              <span className="text-[#8B806F]">{t('footer.crafted')}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MarketingLayout;
