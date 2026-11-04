import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Check, 
  Monitor, 
  QrCode, 
  Camera, 
  Sparkles, 
  Palette, 
  ShieldCheck, 
  ChevronDown, 
  ExternalLink,
  Maximize2
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import celebrationVenueImage from '../../assets/images/celebration_venue_mood_1793501242406.jpg';

export default function WeddingReceptionDisplay() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const displayFeatures = [
    {
      title: 'Universal Hardware Compatibility',
      description: 'Open the live display URL on any browser-equipped laptop or smart TV. Connect via HDMI or wireless screen mirroring to venue projectors and LED ballroom video walls.',
      icon: <Monitor className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Instant Table QR Code Scanning',
      description: 'Display an on-screen QR code or print tabletop cards. Guests scan with their phone camera to instantly upload banquet photos and warm wishes without downloading an app.',
      icon: <QrCode className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: '8 Curated Display Art Aesthetics',
      description: 'Choose from 8 distinct visual themes (Minimal Luxury, Natural Garden, Romantic Love, Postal Archive, Polaroid Wall, Starry Dream, Vintage Noir, Digital Edge) tailored to your floral decor.',
      icon: <Palette className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Live Banquet Moderation Queue',
      description: 'Maintain complete decorum. Event planners or designated bridal party members approve incoming photos and notes from their phones before they broadcast to the screen.',
      icon: <ShieldCheck className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const animationLayouts = [
    { name: 'Masonry Stream', desc: 'Continuous flowing stream of cards, ideal for high-volume photo uploads and varied note lengths.' },
    { name: 'Hanging Garden', desc: 'Suspended cards with gentle organic swaying animations, ideal for botanical and outdoor venue aesthetics.' },
    { name: 'Floating Cosmos', desc: 'Ethereal floating cards against deep starry backgrounds, perfect for evening dance floors and romantic lighting.' },
    { name: 'Editorial Grid', desc: 'Architectural, clean-lined grid layout that pairs letterpress typography with instant photo polaroids.' },
  ];

  const faqs = [
    {
      q: 'What hardware is required to run the wedding reception display?',
      a: 'Any standard laptop (Mac, Windows, or Chromebook) connected to a projector, large smart TV, or LED wall via HDMI or AirPlay. The display runs inside full-screen Chrome, Safari, or Edge.'
    },
    {
      q: 'How quickly do guest photos appear on screen?',
      a: 'Submissions sync in real-time. Once approved in the moderation dashboard, photos and notes animate onto the screen within seconds.'
    },
    {
      q: 'What happens if venue Wi-Fi is slow?',
      a: 'EventFrame uses lightweight vector styling and progressive image loading. Once the display URL is loaded in full-screen, incoming messages stream smoothly with low bandwidth consumption.'
    },
    {
      q: 'Can couples download the full gallery of guest photos after the wedding?',
      a: 'Yes. All submitted guest messages, candid reception photos, and timestamps are permanently stored in the couple portal for high-resolution download.'
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
                <span>Interactive Venue Displays</span>
                <span className="text-[#8B806F]">·</span>
                <span>Live Projector Memory Wall</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                Make Your Wedding Reception More Interactive
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                Connect any venue display, projector, or LED screen to broadcast guest photos and warm wishes in real-time. Curated with editorial typography and planner moderation.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/templates')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Explore Display Themes
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/login')}
                >
                  Configure Live Screen
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Works with any HDMI projector</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Instant QR code table access</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Real-time photo moderation</span>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-3 space-y-3">
                <div className="aspect-[16/10] rounded overflow-hidden relative border border-[#E8E8E5]">
                  <img
                    src={celebrationVenueImage}
                    alt="Live wedding reception screen display projected on ballroom wall"
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    width={800}
                    height={500}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex flex-col justify-between p-4">
                    <div className="flex justify-between items-center text-white">
                      <span className="text-[10px] font-mono tracking-wider bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded border border-white/20">
                        RECEPTION SCREEN 01
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE STREAM
                      </span>
                    </div>
                    <div className="text-white space-y-1">
                      <div className="text-sm font-medium">“Wishing Celia & Elias an eternity of laughter and shared horizons.”</div>
                      <div className="text-[11px] text-white/70">— The Sterling Family</div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-[#FAF9F7] rounded text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#8B806F]" />
                    <span className="text-[#252525] font-medium">Guests Scan to Post: eventframe.io/g/celia-elias</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8B806F] bg-white px-2 py-0.5 rounded border border-[#E8E8E5]">
                    SCAN READY
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Feature Pillars */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">Venue Technology</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              An immersive digital guestbook that comes alive during dinner.
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              Traditional guestbooks are often forgotten on a table by the entrance. EventFrame turns well-wishes into a shared visual focal point for the entire room.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayFeatures.map((feat, idx) => (
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

      {/* Animation Layouts Grid */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">Dynamic Layout Styles</span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] mt-1">
                Calibrated animations that never distract from speeches.
              </h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/templates')}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Preview Themes
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {animationLayouts.map((layout, idx) => (
              <div 
                key={idx} 
                className="bg-white border border-[#E8E8E5] rounded-lg p-6 shadow-subtle flex flex-col justify-between space-y-4"
              >
                <div>
                  <h3 className="text-sm font-semibold text-[#252525]">{layout.name}</h3>
                  <p className="text-xs text-[#777777] leading-relaxed mt-2">{layout.desc}</p>
                </div>
                <div className="pt-3 border-t border-[#EFEFEA] flex justify-between items-center text-[11px] text-[#8B806F]">
                  <span>Supports Photos + Notes</span>
                  <span className="font-mono capitalize">Auto-loop</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal Navigation Links */}
      <section className="py-16 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">Related Solutions</h3>
            <p className="text-base font-serif text-[#252525] mt-1">Integrated wedding software tools</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <a href="/templates" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Theme Catalog</div>
              <div className="text-[11px] text-[#777777]">Display aesthetics & layouts</div>
            </a>
            <a href="/digital-wedding-invitations" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Digital Invitations</div>
              <div className="text-[11px] text-[#777777]">Canvas stationery editor</div>
            </a>
            <a href="/wedding-guest-management" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Guest Management</div>
              <div className="text-[11px] text-[#777777]">Attendee records & moderation</div>
            </a>
            <a href="/wedding-rsvp-management" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">RSVP Management</div>
              <div className="text-[11px] text-[#777777]">Conditional questionnaires</div>
            </a>
            <a href="/wedding-planner-software" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Studio Software</div>
              <div className="text-[11px] text-[#777777]">Multi-client workspace</div>
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
              Wedding Reception Screens
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
            <h3 className="font-serif text-2xl text-[#252525]">Ready to light up your reception ballroom?</h3>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              Configure your live display theme in minutes and test on any monitor before the wedding day.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Launch Display Setup
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
