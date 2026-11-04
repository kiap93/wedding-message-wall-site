import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Check, 
  Calendar, 
  Layers, 
  Users, 
  MessageSquare, 
  Monitor, 
  Sliders, 
  ChevronDown, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import heroWeddingImage from '../../assets/images/hero_wedding_editorial_1793501242401.jpg';
import celebrationVenueImage from '../../assets/images/celebration_venue_mood_1793501242406.jpg';

export default function WeddingPlannerSoftware() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const plannerCapabilities = [
    {
      title: 'Multi-Wedding Studio Workspace',
      description: 'Manage multiple concurrent client celebrations from a single command center. View upcoming dates on an interactive calendar, monitor RSVP counts, and organize client assets.',
      icon: <Calendar className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Bespoke Digital Invitations',
      description: 'Design editorial stationery with drag-and-drop coordinates, elegant serif typography, venue directions, and integrated RSVP buttons tailored to each couple.',
      icon: <Layers className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Conditional RSVP Collection',
      description: 'Eliminate manual spreadsheet entry. Collect meal choices, dietary needs, plus-ones, and lodging information with intelligent questions shown only to attending guests.',
      icon: <Sliders className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Live Reception Screen Moderation',
      description: 'Provide an unforgettable interactive guestbook during the banquet. Guests stream photos and heartfelt wishes directly to venue projectors after planner approval.',
      icon: <MessageSquare className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const faqs = [
    {
      q: 'How does EventFrame replace disconnected wedding planning tools?',
      a: 'Instead of combining third-party RSVP forms, generic stationery websites, and disjointed photo-sharing apps, EventFrame unifies client invitations, custom RSVP questionnaires, attendee management, and live ballroom reception displays in one elegant studio platform.'
    },
    {
      q: 'Can our studio manage dozens of weddings in one season?',
      a: 'Yes. The agency dashboard gives you a calendar schedule and instant access to all active client events. You can switch between couples in seconds, duplicate event settings, and export attendee data.'
    },
    {
      q: 'Can client couples access their own wedding dashboard?',
      a: 'Yes. Planners can share a private couple portal link protected with an event access PIN. Couples can review RSVP attendance lists and moderate live banquet messages without accessing other agency clients.'
    },
    {
      q: 'Does EventFrame require guests to download an app?',
      a: 'No app download is required. Guests simply tap an invitation link or scan a table QR code in their mobile browser to RSVP and share celebratory photos.'
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
                <span>EventFrame for Studios</span>
                <span className="text-[#8B806F]">·</span>
                <span>Complete Wedding Guest Operating System</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                A Better Way to Manage the Wedding Experience
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                Modern wedding planners and luxury studios use EventFrame to orchestrate digital stationery, custom RSVP flows, and live reception screen experiences under one coordinated roof.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create Studio Workspace
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/templates')}
                >
                  Explore Theme Catalog
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>White-label agency subdomains</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Live banquet moderation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Real-time CSV export</span>
                </div>
              </div>
            </div>

            {/* Right Visual */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-lg overflow-hidden border border-[#E8E8E5] shadow-card bg-white p-2">
                <div className="aspect-[4/3] overflow-hidden rounded">
                  <img
                    src={heroWeddingImage}
                    alt="Wedding planning software interface showcasing studio event management"
                    className="w-full h-full object-cover"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    width={800}
                    height={600}
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-4 flex items-center justify-between border-t border-[#E8E8E5] mt-2 bg-[#FAF9F7] rounded">
                  <div>
                    <div className="text-xs font-semibold text-[#252525]">The Glasshouse Pavilion</div>
                    <div className="text-[11px] text-[#777777]">Studio Roster · 18 Active Client Weddings</div>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-[#8B806F] bg-white px-2 py-0.5 rounded border border-[#E8E8E5]">
                    STUDIO PRO
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Studio Capabilities */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">Integrated Studio Tools</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              Crafted specifically for event studios who refuse generic wedding tools.
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              Every feature in EventFrame is calibrated to maintain aesthetic balance while handling the real-world operational complexities of luxury weddings.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-stretch">
            {plannerCapabilities.map((cap, idx) => (
              <div 
                key={idx} 
                className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg shadow-subtle flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-md bg-white border border-[#E8E8E5] flex items-center justify-center">
                    {cap.icon}
                  </div>
                  <h3 className="text-base font-semibold text-[#252525]">{cap.title}</h3>
                  <p className="text-xs sm:text-sm text-[#777777] leading-relaxed">{cap.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow Deep-Dive & Screenshot */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">Unified Guest Architecture</span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] leading-tight">
                From first digital save-the-date to the midnight ballroom sendoff.
              </h2>
              <p className="text-xs md:text-sm text-[#777777] leading-relaxed">
                Wedding planners spend countless hours following up on dietary restrictions, tracking party sizes, and setting up reception activities. EventFrame connects the entire journey:
              </p>
              
              <div className="space-y-4 pt-2">
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#252525] text-white text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5">1</span>
                  <div>
                    <h4 className="text-xs font-semibold text-[#252525]">Publish the Digital Stationery</h4>
                    <p className="text-xs text-[#777777] mt-0.5">Send custom responsive invitations with maps, schedule, dress code, and wedding story.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#252525] text-white text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5">2</span>
                  <div>
                    <h4 className="text-xs font-semibold text-[#252525]">Capture RSVPs with Conditional Precision</h4>
                    <p className="text-xs text-[#777777] mt-0.5">Tailor custom questions based on attendance status, party headcount, and dinner options.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#252525] text-white text-[11px] font-mono flex items-center justify-center shrink-0 mt-0.5">3</span>
                  <div>
                    <h4 className="text-xs font-semibold text-[#252525]">Broadcast Live Guest Memories at Reception</h4>
                    <p className="text-xs text-[#777777] mt-0.5">Project live attendee wishes and photos in ballroom display themes with real-time approval.</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap gap-4 text-xs font-medium">
                <a href="/white-label-wedding-software" className="text-[#8B806F] hover:underline flex items-center gap-1">
                  Explore White-Label Agency Features →
                </a>
                <a href="/wedding-rsvp-management" className="text-[#8B806F] hover:underline flex items-center gap-1">
                  Learn About RSVP Questionnaires →
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-lg overflow-hidden border border-[#E8E8E5] shadow-card bg-white p-2">
                <div className="aspect-[16/10] overflow-hidden rounded relative">
                  <img
                    src={celebrationVenueImage}
                    alt="Live wedding reception wall displayed on venue projector"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    width={800}
                    height={500}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent flex items-end p-6">
                    <div className="text-white space-y-1">
                      <div className="text-xs font-mono text-white/80">LIVE MODERATION ACTIVE</div>
                      <div className="text-sm font-medium">“To many decades of spontaneous joy, Celia and Elias.”</div>
                      <div className="text-[11px] text-white/60">— The Montgomery Family · Approved by Planner</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Internal Solution Cross-Links */}
      <section className="py-16 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">Explore Platform Solutions</h3>
            <p className="text-base font-serif text-[#252525] mt-1">Specialized capabilities across the EventFrame ecosystem</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <a href="/white-label-wedding-software" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">White-Label Software</div>
              <div className="text-[11px] text-[#777777]">Studio branding & subdomains</div>
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
            <span className="text-xs font-medium text-[#8B806F] tracking-wider uppercase">Answers for Studios & Planners</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525]">
              Frequently Asked Questions
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
            <h3 className="font-serif text-2xl text-[#252525]">Ready to upgrade your studio's wedding workflow?</h3>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              Start with a 30-day studio trial or activate a single celebration license.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Start Studio Trial
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => navigate('/pricing')}
              >
                View Plans & Pricing
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
