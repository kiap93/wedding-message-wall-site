import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Check, 
  Globe, 
  ShieldCheck, 
  Layers, 
  Key, 
  Palette, 
  ChevronDown, 
  Share2,
  Users
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import heroWeddingImage from '../../assets/images/hero_wedding_editorial_1793501242401.jpg';
import invitationCraftImage from '../../assets/images/invitation_craft_showcase_1793501242453.jpg';

export default function WhiteLabelWeddingSoftware() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const whiteLabelPillars = [
    {
      title: 'Dedicated Agency Subdomains',
      description: 'Host all client portals, invitation viewer links, and RSVP pages under your custom studio subdomain (e.g., yourstudio.eventframe.io). Maintain client trust with consistent branding.',
      icon: <Globe className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Agency Identity & Palette',
      description: 'Display your studio name, monogram, and curated theme palette across client touchpoints. Clients perceive the platform as your proprietary high-tech service offering.',
      icon: <Palette className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Private Couple PIN Portals',
      description: 'Provide each couple with a streamlined client hub. Couples access their guest list and moderate banquet notes using an event access PIN without seeing other studio accounts.',
      icon: <Key className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Studio-Branded Guest Touchpoints',
      description: 'From mobile-friendly digital invitations to live reception screens, the guest experience reflects the high-touch editorial standard your agency is hired for.',
      icon: <ShieldCheck className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const faqs = [
    {
      q: 'How does the agency subdomain setup work?',
      a: 'During agency workspace creation, you select your studio slug (e.g. "atelier-events"). Your client invitations, RSVP links, and couple dashboards immediately operate at atelier-events.eventframe.io with cookie isolation and custom branding.'
    },
    {
      q: 'Will our couples see EventFrame branding or ads?',
      a: 'No. On agency plans, client-facing pages (digital invitations, RSVP questionnaires, live reception display, and the couple portal) are presented cleanly with your studio identity and zero external advertisements.'
    },
    {
      q: 'Can couples accidentally alter our agency settings?',
      a: 'No. EventFrame enforces strict role separation. Couple portals are scoped exclusively to their individual wedding event via their unique access PIN. They cannot view your agency billing, other couples, or studio settings.'
    },
    {
      q: 'Can we customize the look and feel for each individual couple?',
      a: 'Yes. Each wedding event within your agency workspace can have its own Display Art Aesthetic (Natural Garden, Minimal Luxury, Romantic Love, Vintage Noir, and more) along with custom invitation canvas layouts.'
    }
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28 border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-2.5 py-1 rounded">
                <span>Agency White-Label Infrastructure</span>
                <span className="text-[#8B806F]">·</span>
                <span>Custom Subdomains & Client Portals</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                Your Wedding Platform. Your Brand.
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                Elevate your wedding agency by offering bespoke digital invitations, custom RSVP tracking, and live reception screens hosted entirely under your own studio identity.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Build Your Branded Workspace
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/pricing')}
                >
                  View Agency Tiers
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Custom studio subdomain</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Private client PIN logins</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Zero third-party branding</span>
                </div>
              </div>
            </div>

            {/* Right Visual: Agency Subdomain Mockup */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-4 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="font-mono text-[#252525] font-medium">atelier-weddings.eventframe.io</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8B806F] bg-[#FAF9F7] px-2 py-0.5 rounded border border-[#E8E8E5]">
                    AGENCY ACTIVE
                  </span>
                </div>

                <div className="aspect-[4/3] rounded overflow-hidden relative border border-[#E8E8E5]">
                  <img
                    src={heroWeddingImage}
                    alt="Agency white-label wedding platform dashboard preview"
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    width={800}
                    height={600}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm p-3 rounded border border-[#E8E8E5] shadow-sm flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-[#252525]">Atelier Wedding Studio</div>
                      <div className="text-[10px] text-[#777777]">Client: Madeleine & Christopher · Sonoma</div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      LIVE PORTAL
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-[#FAF9F7] rounded text-xs text-[#777777] flex items-center justify-between">
                  <span>Client Access Link:</span>
                  <span className="font-mono text-[#252525] text-[11px]">atelier-weddings.eventframe.io/couple/login</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 White-Label Pillars */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">Built for Agency Scale</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              Deliver software that matches the prestige of your event design.
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              When high-net-worth couples hire an editorial wedding studio, every detail matters — including the digital RSVP form and reception technology.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {whiteLabelPillars.map((pillar, idx) => (
              <div 
                key={idx} 
                className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg shadow-subtle space-y-4"
              >
                <div className="w-10 h-10 rounded-md bg-white border border-[#E8E8E5] flex items-center justify-center">
                  {pillar.icon}
                </div>
                <h3 className="text-base font-semibold text-[#252525]">{pillar.title}</h3>
                <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Couple Experience Section */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-5">
              <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">Client Onboarding</span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] leading-tight">
                Simple, secure PIN access for your couples.
              </h2>
              <p className="text-xs md:text-sm text-[#777777] leading-relaxed">
                Rather than asking your clients to create complex passwords or manage third-party software accounts, EventFrame generates a unique event access PIN for every wedding on your roster.
              </p>
              
              <ul className="space-y-3 pt-2 text-xs sm:text-sm text-[#555555]">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>Couples view live RSVP headcounts and meal requests 24/7</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>Couples can approve or review live banquet messages during dinner</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#8B806F] shrink-0" />
                  <span>Export attendee spreadsheets with one click for caterers and venue staff</span>
                </li>
              </ul>

              <div className="pt-4 flex flex-wrap gap-4 text-xs font-medium">
                <a href="/wedding-guest-management" className="text-[#8B806F] hover:underline flex items-center gap-1">
                  Learn About Guest List Tools →
                </a>
                <a href="/digital-wedding-invitations" className="text-[#8B806F] hover:underline flex items-center gap-1">
                  Explore Digital Stationery Studio →
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-lg overflow-hidden border border-[#E8E8E5] shadow-card bg-white p-3">
                <img
                  src={invitationCraftImage}
                  alt="Wedding stationery craft preview showing luxury editorial branding"
                  className="w-full h-auto rounded object-cover"
                  loading="lazy"
                  decoding="async"
                  width={600}
                  height={400}
                  referrerPolicy="no-referrer"
                />
                <div className="p-3 text-xs text-[#777777] flex justify-between items-center border-t border-[#E8E8E5] mt-2">
                  <span>Custom Typography & Palette</span>
                  <span className="font-mono text-[#252525]">Cormorant Garamond + Inter</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Internal Navigation Grid */}
      <section className="py-16 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">Related Solutions</h3>
            <p className="text-base font-serif text-[#252525] mt-1">Explore all tools built into the EventFrame studio suite</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <a href="/wedding-planner-software" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Wedding Planner Software</div>
              <div className="text-[11px] text-[#777777]">Full studio management</div>
            </a>
            <a href="/digital-wedding-invitations" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Digital Invitations</div>
              <div className="text-[11px] text-[#777777]">Canvas stationery editor</div>
            </a>
            <a href="/wedding-rsvp-management" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">RSVP Management</div>
              <div className="text-[11px] text-[#777777]">Conditional questionnaires</div>
            </a>
            <a href="/wedding-guest-management" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Guest Management</div>
              <div className="text-[11px] text-[#777777]">Attendee lists & moderation</div>
            </a>
            <a href="/wedding-reception-display" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Reception Displays</div>
              <div className="text-[11px] text-[#777777]">Live ballroom screen stream</div>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 md:py-28 bg-[#FAF9F7]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center space-y-2 mb-12">
            <span className="text-xs font-medium text-[#8B806F] tracking-wider uppercase">Frequently Asked Questions</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525]">
              Agency White-Label Details
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white border border-[#E8E8E5] rounded-lg overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4"
                  >
                    <span className="text-xs sm:text-sm font-semibold text-[#252525]">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#777777] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[#777777] leading-relaxed border-t border-[#EFEFEA]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-center space-y-4">
            <h3 className="font-serif text-2xl text-[#252525]">Ready to establish your agency's branded wedding platform?</h3>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              Create your agency workspace in under 60 seconds with full access to subdomains and multi-event tools.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Launch Studio Workspace
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/templates')}
              >
                Browse Theme Gallery
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
