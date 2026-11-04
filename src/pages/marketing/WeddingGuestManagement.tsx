import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Check, 
  Users, 
  ShieldCheck, 
  MessageSquare, 
  Camera, 
  Sparkles, 
  ChevronDown, 
  CheckCircle2, 
  XCircle,
  Key
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import celebrationVenueImage from '../../assets/images/celebration_venue_mood_1793501242406.jpg';

export default function WeddingGuestManagement() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const guestTools = [
    {
      title: 'Attendee Roster & Headcount Sync',
      description: 'Track total confirmed guests, regrets, party sizes, and meal counts in real-time. Keep a clean record of who has responded and who needs a gentle reminder.',
      icon: <Users className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Live Banquet Moderation Queue',
      description: 'Review photos and messages submitted by guests before they appear on the ballroom projector screen. Approve warm wishes and filter out accidental uploads with one tap.',
      icon: <ShieldCheck className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Dedicated Couple Access Portal',
      description: 'Share a private couple hub protected with a secure PIN. Couples can browse their guest list, check RSVPs, and moderate memories without needing agency login credentials.',
      icon: <Key className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Permanent Memory Archive',
      description: 'All guest congratulations, intimate reception notes, and candid photos remain safely preserved in the wedding dashboard for couples to cherish for years.',
      icon: <Camera className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const faqs = [
    {
      q: 'How does live message and photo moderation work?',
      a: 'During the celebration, guests upload photos and notes from their phones. If auto-approve is disabled, submissions enter a live moderation queue in the dashboard where planners or couples can tap "Approve" or "Reject" before anything reaches the screen.'
    },
    {
      q: 'Can couples check guest responses from their smartphones?',
      a: 'Yes. The couple portal is fully responsive and touch-optimized. Couples can log in from their phones using their event access PIN to view attendee counts and approve live photos during the reception.'
    },
    {
      q: 'Can we turn on auto-approve for trusted guest messages?',
      a: 'Yes. In the event configuration settings, you can toggle "Auto-Approve Messages" on or off at any point during the event.'
    },
    {
      q: 'Can guest lists be exported for place cards and caterers?',
      a: 'Yes. You can export the entire guest list to CSV with names, attending status, party counts, meal preferences, and dietary requirements in seconds.'
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
                <span>Unified Guest Operations</span>
                <span className="text-[#8B806F]">·</span>
                <span>Attendee Lists & Live Moderation</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                Bring Your Wedding Guest Experience Together
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                Coordinate RSVP headcounts, dietary restrictions, and live reception memory moderation in one elegant dashboard designed for wedding planners and couples.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Manage Wedding Guests
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/wedding-reception-display')}
                >
                  Explore Reception Displays
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Real-time guest moderation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Private couple PIN access</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Permanent memory archive</span>
                </div>
              </div>
            </div>

            {/* Right Visual: Moderation Queue Mockup */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-4 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5] text-xs">
                  <div>
                    <span className="font-semibold text-[#252525]">Reception Moderation Queue</span>
                    <span className="text-[11px] text-[#777777] block">Live banquet updates</span>
                  </div>
                  <span className="text-[10px] font-mono text-[#8B806F] bg-[#FAF9F7] px-2 py-0.5 rounded border border-[#E8E8E5]">
                    3 PENDING
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-[#FAF9F7] rounded border border-[#E8E8E5] space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-[#252525]">Marcus & Elena Vance</span>
                      <span className="text-[#777777] font-mono">Table 4 · 2m ago</span>
                    </div>
                    <p className="text-[11px] text-[#555555] italic">
                      “The vows were breathtaking! Dancing the night away with you both.”
                    </p>
                    <div className="flex justify-end gap-2 pt-1 border-t border-[#EFEFEA]">
                      <button className="px-2 py-1 text-[11px] text-[#777777] hover:text-red-600 rounded">
                        Decline
                      </button>
                      <button className="px-2.5 py-1 text-[11px] bg-[#252525] text-white rounded font-medium">
                        Broadcast to Screen
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded border border-emerald-200 bg-emerald-50/40 space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-semibold text-[#252525]">The Sterling Family</span>
                      <span className="text-emerald-700 font-mono text-[10px]">APPROVED</span>
                    </div>
                    <p className="text-[11px] text-[#555555]">
                      “Wishing Celia & Elias endless happiness!”
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-[11px] text-[#777777] border-t border-[#E8E8E5]">
                  <span>Auto-Approve: OFF</span>
                  <span className="font-mono text-[#8B806F]">142 Confirmed RSVPs</span>
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
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">Guest Lifecycle Management</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              Hospitality tools that keep everyone informed and welcomed.
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              From managing dietary restrictions with the caterer to curating which guest selfies appear on the reception projector, EventFrame puts you in control.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {guestTools.map((tool, idx) => (
              <div 
                key={idx} 
                className="p-6 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg shadow-subtle flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-md bg-white border border-[#E8E8E5] flex items-center justify-center">
                    {tool.icon}
                  </div>
                  <h3 className="text-sm font-semibold text-[#252525]">{tool.title}</h3>
                  <p className="text-xs text-[#777777] leading-relaxed">{tool.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Internal Navigation Links */}
      <section className="py-16 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">Related Solutions</h3>
            <p className="text-base font-serif text-[#252525] mt-1">Explore all capabilities across EventFrame</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <a href="/wedding-reception-display" className="p-4 bg-white hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Reception Displays</div>
              <div className="text-[11px] text-[#777777]">Live ballroom screen stream</div>
            </a>
            <a href="/wedding-rsvp-management" className="p-4 bg-white hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">RSVP Management</div>
              <div className="text-[11px] text-[#777777]">Conditional questionnaires</div>
            </a>
            <a href="/digital-wedding-invitations" className="p-4 bg-white hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Digital Invitations</div>
              <div className="text-[11px] text-[#777777]">Canvas stationery editor</div>
            </a>
            <a href="/wedding-planner-software" className="p-4 bg-white hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Studio Software</div>
              <div className="text-[11px] text-[#777777]">Multi-client workspace</div>
            </a>
            <a href="/white-label-wedding-software" className="p-4 bg-white hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">White-Label Software</div>
              <div className="text-[11px] text-[#777777]">Studio branding & subdomains</div>
            </a>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center space-y-2 mb-12">
            <span className="text-xs font-medium text-[#8B806F] tracking-wider uppercase">Frequently Asked Questions</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525]">
              Guest Management Questions
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg overflow-hidden transition-colors"
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
            <h3 className="font-serif text-2xl text-[#252525]">Organize your guest experience with confidence</h3>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              Everything needed to manage attendees, dietary restrictions, and reception memories.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Start Free Trial
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
