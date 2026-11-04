import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Check, 
  Heart, 
  Layers, 
  Sparkles, 
  Smartphone, 
  Monitor, 
  ShieldCheck, 
  Sliders, 
  Users, 
  ChevronDown,
  Globe,
  MessageSquare
} from 'lucide-react';
import MarketingLayout from '../layouts/MarketingLayout';
import Button from '../design-system/components/Button';
import heroWeddingImage from '../assets/images/hero_wedding_editorial_1793501242401.jpg';
import invitationCraftImage from '../assets/images/invitation_craft_showcase_1793501242453.jpg';
import celebrationVenueImage from '../assets/images/celebration_venue_mood_1793501242406.jpg';

export default function Home() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [pricingCycle, setPricingCycle] = useState<'monthly' | 'annual'>('monthly');

  const features = [
    {
      title: 'Digital Stationery Suite',
      description: 'Precision typography and canvas customization. Deliver digital wedding invitations with custom RSVP flows matching your exact agency aesthetic.',
      icon: <Layers className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Real-Time Guest Moderation',
      description: 'Stream guest wishes and photos to venue displays with instant live moderation to ensure every moment on screen is tasteful and approved.',
      icon: <MessageSquare className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'White-Label Subdomains',
      description: 'Operate entirely under your studio name. Clients access their wedding dashboards through your customized subdomain with your logo and palette.',
      icon: <Globe className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Custom RSVP Logic',
      description: 'Collect dietary restrictions, plus-one names, meal selections, and transport requirements with custom conditional questionnaire fields.',
      icon: <Sliders className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const faqs = [
    {
      q: 'Can agencies brand the client experience under their own domain?',
      a: 'Yes. EventFrame is built specifically for wedding studios and planners. Your clients see your agency name, logo, and subdomain (e.g., yourstudio.eventframe.io).'
    },
    {
      q: 'How does live guest moderation work during the reception?',
      a: 'Guests scan a QR code on the table to post photos and well-wishes from their mobile browser. The studio or bridal party can approve or decline messages in real-time from the dashboard before they appear on the ballroom projector.'
    },
    {
      q: 'Do guests need to install an app to RSVP or post photos?',
      a: 'No app download is required. Everything runs in the mobile browser with responsive, lightweight, touch-optimized interfaces.'
    },
    {
      q: 'Can couples edit their wedding pages directly?',
      a: 'Yes. Couples receive a secure event access PIN that gives them access to their private dashboard to view RSVPs, download guest lists, and moderate celebration messages.'
    }
  ];

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28 border-b border-[#E8E8E5]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            {/* Left Content (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-[#736959] bg-[#EFECE6] px-2.5 py-1 rounded">
                <span>EventFrame Studio Platform</span>
                <span className="text-[#8B806F]">·</span>
                <span>White-Label Wedding OS</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                Wedding Planning Software for Modern Wedding Studios
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                Bring digital wedding invitations, guest RSVPs, guest experiences and live reception displays together in one platform.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create Agency Workspace
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/templates')}
                >
                  Browse Invitation Suites
                </Button>
              </div>

              <div className="pt-6 flex items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>White-label subdomain</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Real-time guest moderation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Instant RSVP export</span>
                </div>
              </div>
            </div>

            {/* Right Visual (5 cols) */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-lg overflow-hidden border border-[#E8E8E5] shadow-card bg-white p-2">
                <div className="aspect-[4/3] overflow-hidden rounded">
                  <img
                    src={heroWeddingImage}
                    alt="Editorial wedding photography of bride and groom in Sonoma Valley"
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
                    <div className="text-xs font-semibold text-[#252525]">Celia & Elias</div>
                    <div className="text-[11px] text-[#777777]">Sonoma Valley · 142 Confirmed RSVPs</div>
                  </div>
                  <span className="text-[10px] font-mono tabular-nums text-[#8B806F] bg-white px-2 py-0.5 rounded border border-[#E8E8E5]">
                    LIVE SUITE
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Integrated Product Ecosystem Grid (Phase 2 SEO Architecture) */}
      <section className="py-16 md:py-20 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
            <div>
              <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">Integrated Wedding Software</span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-1">
                A unified ecosystem for modern studios and couples.
              </h2>
            </div>
            <p className="text-xs md:text-sm text-[#777777] max-w-md">
              Six dedicated tools engineered to work seamlessly together — from initial digital stationery to live ballroom displays.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <a 
              href="/wedding-planner-software" 
              className="p-6 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle hover:border-[#252525] transition-colors group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-[#8B806F] uppercase">Studio Management</span>
                <h3 className="text-base font-semibold text-[#252525] group-hover:text-[#8B806F] transition-colors flex items-center justify-between">
                  Wedding Planner Software
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-[#777777] leading-relaxed">
                  Coordinate multiple client weddings, schedule calendars, and manage guest experiences from one studio command center.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#EFEFEA] text-[11px] font-medium text-[#252525]">
                Learn about planner software →
              </div>
            </a>

            <a 
              href="/white-label-wedding-software" 
              className="p-6 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle hover:border-[#252525] transition-colors group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-[#8B806F] uppercase">Agency Branding</span>
                <h3 className="text-base font-semibold text-[#252525] group-hover:text-[#8B806F] transition-colors flex items-center justify-between">
                  White-Label Wedding Software
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-[#777777] leading-relaxed">
                  Operate under your studio's custom subdomain with branded digital stationery and private client PIN logins.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#EFEFEA] text-[11px] font-medium text-[#252525]">
                Explore white-label features →
              </div>
            </a>

            <a 
              href="/digital-wedding-invitations" 
              className="p-6 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle hover:border-[#252525] transition-colors group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-[#8B806F] uppercase">Design Studio</span>
                <h3 className="text-base font-semibold text-[#252525] group-hover:text-[#8B806F] transition-colors flex items-center justify-between">
                  Digital Wedding Invitations
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-[#777777] leading-relaxed">
                  Design bespoke online invitations with drag-and-drop coordinates, editorial typography, and integrated RSVP buttons.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#EFEFEA] text-[11px] font-medium text-[#252525]">
                Design wedding invitations →
              </div>
            </a>

            <a 
              href="/wedding-rsvp-management" 
              className="p-6 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle hover:border-[#252525] transition-colors group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-[#8B806F] uppercase">Guest Responses</span>
                <h3 className="text-base font-semibold text-[#252525] group-hover:text-[#8B806F] transition-colors flex items-center justify-between">
                  Wedding RSVP Management
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-[#777777] leading-relaxed">
                  Collect attendance, meal choices, plus-one names, and dietary allergies with conditional questionnaire fields.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#EFEFEA] text-[11px] font-medium text-[#252525]">
                Manage wedding RSVPs →
              </div>
            </a>

            <a 
              href="/wedding-guest-management" 
              className="p-6 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle hover:border-[#252525] transition-colors group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-[#8B806F] uppercase">Operations</span>
                <h3 className="text-base font-semibold text-[#252525] group-hover:text-[#8B806F] transition-colors flex items-center justify-between">
                  Wedding Guest Management
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-[#777777] leading-relaxed">
                  Maintain confirmed headcount records, review dietary needs, and moderate live reception messages and photo uploads.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#EFEFEA] text-[11px] font-medium text-[#252525]">
                Explore guest operations →
              </div>
            </a>

            <a 
              href="/wedding-reception-display" 
              className="p-6 bg-white border border-[#E8E8E5] rounded-lg shadow-subtle hover:border-[#252525] transition-colors group flex flex-col justify-between"
            >
              <div className="space-y-3">
                <span className="text-[10px] font-mono text-[#8B806F] uppercase">Ballroom Experience</span>
                <h3 className="text-base font-semibold text-[#252525] group-hover:text-[#8B806F] transition-colors flex items-center justify-between">
                  Wedding Reception Displays
                  <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-[#777777] leading-relaxed">
                  Project live guest photo walls and well-wishes on ballroom screens with table QR code scanning and 8 curated themes.
                </p>
              </div>
              <div className="pt-4 mt-4 border-t border-[#EFEFEA] text-[11px] font-medium text-[#252525]">
                Set up reception display →
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* Craft & Stationery Showcase Section */}
      <section id="features" className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <span className="text-xs font-medium text-[#8B806F] tracking-wide">ARCHITECTURE & CRAFT</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              Designed for studios who refuse generic wedding software.
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              Every detail is calibrated to maintain the aesthetic integrity of high-end ceremonies. From typographical balance to guest moderation, EventFrame delivers quiet luxury.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center mb-16">
            <div className="rounded-lg overflow-hidden border border-[#E8E8E5] shadow-subtle bg-[#FAF9F7]">
              <img
                src={invitationCraftImage}
                alt="Luxury wedding invitation stationery showcase with letterpress typography"
                className="w-full h-auto object-cover"
                loading="lazy"
                decoding="async"
                width={600}
                height={400}
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="space-y-6">
              {features.map((feat, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="w-9 h-9 rounded-md bg-[#F7F7F5] border border-[#E8E8E5] flex items-center justify-center shrink-0 mt-0.5">
                    {feat.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#252525]">{feat.title}</h3>
                    <p className="text-xs text-[#777777] mt-1 leading-relaxed">{feat.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Live Reception Screen Spotlight */}
      <section id="agencies" className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5 space-y-5">
              <span className="text-xs font-medium text-[#8B806F]">VENUE STREAMING</span>
              <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] leading-tight">
                An immersive visual memory wall for the reception ballroom.
              </h2>
              <p className="text-xs md:text-sm text-[#777777] leading-relaxed">
                Connect any venue display, projector, or LED screen. Guests upload photos and warm wishes from their phones, while studio operators or bridal party members review entries before they broadcast.
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                >
                  Configure Live Display
                </Button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-lg overflow-hidden border border-[#E8E8E5] shadow-card bg-white p-2">
                <div className="aspect-[16/9] overflow-hidden rounded relative">
                  <img
                    src={celebrationVenueImage}
                    alt="Evening wedding reception venue display showcasing live guest memories"
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                    width={800}
                    height={450}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent flex items-end p-6">
                    <div className="text-white space-y-1">
                      <div className="text-xs font-mono text-white/80">RECEPTION SCREEN 01 · CONNECTED</div>
                      <div className="text-sm font-medium">“Wishing Celia and Elias an eternity of laughter and shared horizons.”</div>
                      <div className="text-[11px] text-white/60">— The Sterling Family</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-28 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-medium text-[#8B806F]">TRANSPARENT PLANS</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525] mt-2">
              Simple, predictable agency pricing.
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-2">
              Everything you need to deliver high-touch digital wedding experiences.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Starter Plan */}
            <div className="border border-[#E8E8E5] rounded-lg p-6 bg-white flex flex-col justify-between shadow-subtle">
              <div>
                <div className="text-xs font-semibold text-[#777777]">INDIVIDUAL WEDDING</div>
                <h3 className="text-lg font-semibold text-[#252525] mt-1">Single Event</h3>
                <p className="text-xs text-[#777777] mt-1">For single couples managing their personal wedding.</p>
                
                <div className="my-6">
                  <span className="text-3xl font-semibold font-mono text-[#252525] tabular-nums">$19</span>
                  <span className="text-xs text-[#777777]"> / event lifetime</span>
                </div>

                <div className="space-y-2.5 text-xs text-[#555555]">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>1 Custom Wedding URL</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>Up to 250 RSVP entries</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>Live Display & Moderation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>Digital Invitation Suite</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <Button
                  variant="outline"
                  size="md"
                  className="w-full"
                  onClick={() => navigate('/login')}
                >
                  Start Single Event
                </Button>
              </div>
            </div>

            {/* Studio Pro */}
            <div className="border-2 border-[#252525] rounded-lg p-6 bg-[#FAF9F7] flex flex-col justify-between shadow-card relative">
              <div className="absolute -top-3 right-6 bg-[#252525] text-white text-[10px] font-medium px-2 py-0.5 rounded">
                MOST POPULAR
              </div>
              <div>
                <div className="text-xs font-semibold text-[#8B806F]">STUDIO PRO</div>
                <h3 className="text-lg font-semibold text-[#252525] mt-1">Agency Suite</h3>
                <p className="text-xs text-[#777777] mt-1">For boutique wedding planners & photography studios.</p>
                
                <div className="my-6">
                  <span className="text-3xl font-semibold font-mono text-[#252525] tabular-nums">$49</span>
                  <span className="text-xs text-[#777777]"> / month</span>
                </div>

                <div className="space-y-2.5 text-xs text-[#252525]">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span className="font-medium">Unlimited Wedding Events</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>Custom Agency Subdomain</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>White-label Client Dashboards</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>Invitation Template Designer</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>Custom RSVP Fields & Export</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={() => navigate('/login')}
                >
                  Launch Agency Pro
                </Button>
              </div>
            </div>

            {/* Enterprise Plan */}
            <div className="border border-[#E8E8E5] rounded-lg p-6 bg-white flex flex-col justify-between shadow-subtle">
              <div>
                <div className="text-xs font-semibold text-[#777777]">BESPOKE ENTERPRISE</div>
                <h3 className="text-lg font-semibold text-[#252525] mt-1">Agency Network</h3>
                <p className="text-xs text-[#777777] mt-1">For multi-location event firms and luxury venues.</p>
                
                <div className="my-6">
                  <span className="text-3xl font-semibold font-mono text-[#252525] tabular-nums">$399</span>
                  <span className="text-xs text-[#777777]"> / year</span>
                </div>

                <div className="space-y-2.5 text-xs text-[#555555]">
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>Custom Apex Domain CNAME</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>Dedicated Priority Concierge</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>Multi-Team Seat Management</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#8B806F]" />
                    <span>Custom CSS & Asset CDN</span>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <Button
                  variant="outline"
                  size="md"
                  className="w-full"
                  onClick={() => navigate('/login')}
                >
                  Contact Enterprise
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 md:py-24 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12">
            <span className="text-xs font-medium text-[#8B806F]">FREQUENTLY ASKED QUESTIONS</span>
            <h2 className="font-serif text-3xl font-normal text-[#252525] mt-2">
              Everything you need to know.
            </h2>
          </div>

          <div className="divide-y divide-[#E8E8E5] border-y border-[#E8E8E5] bg-white rounded-lg shadow-subtle overflow-hidden">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={index} className="p-5">
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full flex items-center justify-between text-left gap-4"
                  >
                    <span className="text-xs md:text-sm font-semibold text-[#252525]">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-[#777777] shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <p className="text-xs text-[#777777] mt-3 leading-relaxed">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="py-20 bg-white text-center">
        <div className="max-w-3xl mx-auto px-6 space-y-6">
          <h2 className="font-serif text-3xl md:text-5xl font-normal text-[#252525] tracking-tight">
            Elevate your wedding agency experience today.
          </h2>
          <p className="text-xs md:text-sm text-[#777777] max-w-lg mx-auto leading-relaxed">
            Join hundreds of premier studios delivering bespoke digital stationery and seamless celebration moderation.
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/login')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Start Free Agency Trial
            </Button>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
