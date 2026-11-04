import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Check, 
  Smartphone, 
  Monitor, 
  Layers, 
  Type, 
  Sparkles, 
  ChevronDown, 
  Sliders, 
  ExternalLink,
  MapPin
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import invitationCraftImage from '../../assets/images/invitation_craft_showcase_1793501242453.jpg';
import heroWeddingImage from '../../assets/images/hero_wedding_editorial_1793501242401.jpg';

export default function DigitalWeddingInvitations() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const invitationFeatures = [
    {
      title: 'Precision Stationery Canvas',
      description: 'Fine-tune typography, monograms, schedule timelines, and photos on a coordinate-based drag-and-drop canvas designed for high-end wedding aesthetics.',
      icon: <Layers className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Mobile-Optimized Guest Viewports',
      description: 'Preview exactly how guests will experience your invitation on iPhone and Android screens, as well as widescreen desktop monitors, before publishing.',
      icon: <Smartphone className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Integrated RSVP Action',
      description: 'Guests can read ceremony details, view venue directions, and immediately submit their RSVP questionnaire in one continuous, friction-free flow.',
      icon: <Sliders className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Editorial Typography Presets',
      description: 'Pair Cormorant Garamond serif headings with crisp Inter body copy and clean JetBrains Mono details for an archival stationery feel without paper waste.',
      icon: <Type className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const stationeryAesthetics = [
    { name: 'Minimal Luxury', desc: 'Metallic gold accents, high-contrast serif headlines, and marble-inspired serenity.', variant: 'Masonry' },
    { name: 'Natural Garden', desc: 'Eucalyptus greens, earth tones, and clean organic textures for vineyard celebrations.', variant: 'Hanging' },
    { name: 'Romantic Love', desc: 'Blush pink hues, dreamy serif titles, and soft floral undertones.', variant: 'Masonry' },
    { name: 'Postal Archive', desc: 'Vintage postal stamps, wax seal aesthetics, and archival letterpress layouts.', variant: 'Grid' },
    { name: 'Vintage Noir', desc: 'Cinematic film nostalgia, sepia palettes, and retro typography.', variant: 'Masonry' },
    { name: 'Starry Dream', desc: 'Midnight blues, celestial gold sparkles, and evening banquet atmosphere.', variant: 'Floating' },
  ];

  const faqs = [
    {
      q: 'How do guests receive and open their digital invitation?',
      a: 'Guests receive a clean web link (e.g., yourstudio.eventframe.io/wedding-name/invitation or eventframe.io/wedding-name/invitation). They can tap it on any mobile device without logging in or downloading an app.'
    },
    {
      q: 'Can we change the invitation design after sending it out?',
      a: 'Yes. Since EventFrame invitations are digital, you can update schedule details, shuttle departure times, or weather guidance at any moment. Changes reflect instantly for all guests.'
    },
    {
      q: 'Does the invitation link directly to the RSVP questionnaire?',
      a: 'Yes. The digital invitation includes an integrated RSVP button that transitions smoothly into your custom questions (dietary preferences, attendance headcount, transport options).'
    },
    {
      q: 'Can we password-protect our digital wedding invitation?',
      a: 'Yes. EventFrame allows you to set an optional access PIN so only invited friends and family can view ceremony details.'
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
                <span>Digital Wedding Stationery</span>
                <span className="text-[#8B806F]">·</span>
                <span>Responsive Canvas & Real-Time RSVP</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                Beautiful Digital Wedding Invitations, Made Personal
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                Design bespoke online wedding invitations with editorial typography, interactive venue maps, and integrated RSVP collection. The modern alternative to generic paper suites.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/templates')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Explore Invitation Templates
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/login')}
                >
                  Create Your Invitation
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Instant mobile loading</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Integrated RSVP buttons</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Interactive venue maps</span>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-3 space-y-3">
                <div className="aspect-[4/3] rounded overflow-hidden relative border border-[#E8E8E5] bg-[#FAF9F7]">
                  <img
                    src={invitationCraftImage}
                    alt="Luxury digital wedding stationery showcase with letterpress typography"
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    width={800}
                    height={600}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-3 right-3 bg-white/95 px-2.5 py-1 rounded text-[11px] font-mono text-[#8B806F] border border-[#E8E8E5] shadow-xs">
                    CANVAS STUDIO
                  </div>
                </div>
                <div className="p-3 bg-[#FAF9F7] rounded text-xs flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[#252525]">Celia & Elias</span>
                    <span className="text-[11px] text-[#777777] block">Sonoma Valley · Saturday, October 18</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    RSVP READY
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Canvas Capabilities */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">Crafted With Intent</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              A dedicated digital stationery studio for modern ceremonies.
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              Every invitation is rendered in clean web technology that loads instantly across smartphones and tablets, while maintaining exquisite typographical hierarchy.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {invitationFeatures.map((feat, idx) => (
              <div 
                key={idx} 
                className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg shadow-subtle flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-md bg-white border border-[#E8E8E5] flex items-center justify-center">
                    {feat.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-[#252525]">{feat.title}</h3>
                  <p className="text-xs text-[#777777] leading-relaxed">{feat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Available Themes Preview */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">Curated Aesthetic Themes</span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] mt-1">
                Aesthetics that match your wedding floral and stationery design.
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/templates')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Browse Full Catalog
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stationeryAesthetics.map((style, idx) => (
              <div 
                key={idx} 
                className="bg-white border border-[#E8E8E5] rounded-lg p-6 shadow-subtle flex flex-col justify-between space-y-4 hover:border-[#252525] transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-[#252525]">{style.name}</h3>
                    <span className="text-[10px] font-mono text-[#8B806F] bg-[#FAF9F7] px-2 py-0.5 rounded border border-[#E8E8E5]">
                      {style.variant}
                    </span>
                  </div>
                  <p className="text-xs text-[#777777] leading-relaxed">{style.desc}</p>
                </div>
                <div className="pt-3 border-t border-[#EFEFEA] flex items-center justify-between text-xs text-[#777777]">
                  <span className="text-[11px]">Includes Mobile RSVP</span>
                  <a href="/templates" className="text-[#252525] font-medium hover:underline flex items-center gap-1 text-[11px]">
                    Preview Suite <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related Internal Links */}
      <section className="py-16 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">Related Solutions</h3>
            <p className="text-base font-serif text-[#252525] mt-1">Complementary features for your wedding celebration</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <a href="/wedding-rsvp-management" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">RSVP Management</div>
              <div className="text-[11px] text-[#777777]">Conditional questionnaires</div>
            </a>
            <a href="/wedding-guest-management" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Guest Management</div>
              <div className="text-[11px] text-[#777777]">Attendee records & moderation</div>
            </a>
            <a href="/wedding-reception-display" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Reception Displays</div>
              <div className="text-[11px] text-[#777777]">Live ballroom screen stream</div>
            </a>
            <a href="/wedding-planner-software" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Studio Software</div>
              <div className="text-[11px] text-[#777777]">Multi-client workspace</div>
            </a>
            <a href="/white-label-wedding-software" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">White-Label Software</div>
              <div className="text-[11px] text-[#777777]">Studio branding & subdomains</div>
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
              Digital Wedding Invitations
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
            <h3 className="font-serif text-2xl text-[#252525]">Ready to create your wedding invitation?</h3>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              Select an aesthetic template and customize your wedding suite with coordinate snapping and live preview.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/templates')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Browse Invitation Templates
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/login')}
              >
                Start Creating Free
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
