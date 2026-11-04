import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowRight, 
  Check, 
  Sliders, 
  Users, 
  Download, 
  Utensils, 
  FileSpreadsheet, 
  ChevronDown, 
  ShieldCheck,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import MarketingLayout from '../../layouts/MarketingLayout';
import Button from '../../design-system/components/Button';
import heroWeddingImage from '../../assets/images/hero_wedding_editorial_1793501242401.jpg';

export default function WeddingRsvpManagement() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const rsvpFeatures = [
    {
      title: 'Conditional Questionnaires',
      description: 'Show meal preferences, shuttle pickup locations, and lodging questions only to guests who confirm attendance. Keep regrets short and polite.',
      icon: <Sliders className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Custom Field Types',
      description: 'Collect exact information with dropdown menus, checkboxes, multiple choice, number counters for party sizes, and open text areas for dietary allergies.',
      icon: <Utensils className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Instant CSV & Caterer Export',
      description: 'Export clean spreadsheets with full attendee names, party counts, meal choices, and custom questionnaire answers ready for caterers and seating planners.',
      icon: <FileSpreadsheet className="w-5 h-5 text-[#8B806F]" />,
    },
    {
      title: 'Aesthetic Visual Harmony',
      description: 'Your RSVP questionnaire automatically adopts the event’s Display Art Aesthetic (Natural Garden, Minimal Luxury, Romantic Love) so guests enjoy a cohesive visual journey.',
      icon: <ShieldCheck className="w-5 h-5 text-[#8B806F]" />,
    },
  ];

  const sampleQuestions = [
    { field: 'Attendance Status', type: 'Attending / Regretfully Declining', condition: 'All guests' },
    { field: 'Total Party Size', type: 'Number counter (1–6 guests)', condition: 'Shown if attending' },
    { field: 'Entrée Selection', type: 'Dropdown (Wagyu, Chilean Sea Bass, Wild Mushroom)', condition: 'Shown if attending' },
    { field: 'Dietary Restrictions & Allergies', type: 'Text field (Gluten-free, vegan, nut allergy)', condition: 'Shown if attending' },
    { field: 'Saturday Shuttle Service', type: 'Checkbox (Downtown Hotel ↔ Vineyard)', condition: 'Shown if attending' },
    { field: 'Song Request for DJ', type: 'Optional text field', condition: 'Shown if attending' },
  ];

  const faqs = [
    {
      q: 'Do guests need an account or password to submit an RSVP?',
      a: 'No. Guests simply open the wedding RSVP link on their smartphone or computer, type their name, and answer the questions. The process takes less than 60 seconds.'
    },
    {
      q: 'Can planners or couples add custom questions to the RSVP form?',
      a: 'Yes. In the event configuration editor, you can create custom fields with custom labels, field types (dropdown, radio, checkbox, text, number), and mark them as required or optional.'
    },
    {
      q: 'How are meal selections and dietary requirements tracked?',
      a: 'All responses are logged in real-time in your workspace dashboard. You can review submissions by guest, filter by attending status, and export the entire dataset to CSV at any time.'
    },
    {
      q: 'Can couples update an RSVP on behalf of a guest?',
      a: 'Yes. Studio planners and couples can manually view, update, or edit guest RSVP details directly from the dashboard if someone calls or messages with changes.'
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
                <span>Wedding RSVP Automation</span>
                <span className="text-[#8B806F]">·</span>
                <span>Conditional Questionnaires & Real-Time Sync</span>
              </div>

              <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-[#252525] leading-[1.12]">
                A Simpler Way to Manage Wedding RSVPs
              </h1>

              <p className="text-sm md:text-base text-[#777777] max-w-xl leading-relaxed">
                Replace messy text messages and lost paper reply cards. Collect wedding guest attendance, meal selections, plus-ones, and dietary restrictions with beautiful online questionnaires.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigate('/login')}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Create RSVP Questionnaire
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => navigate('/wedding-guest-management')}
                >
                  Explore Guest Management
                </Button>
              </div>

              <div className="pt-6 flex flex-wrap items-center gap-6 text-xs text-[#777777]">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Conditional field logic</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>Instant CSV export</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#8B806F]" />
                  <span>No guest account needed</span>
                </div>
              </div>
            </div>

            {/* Right Visual: RSVP Card Mockup */}
            <div className="lg:col-span-5 relative">
              <div className="rounded-lg border border-[#E8E8E5] shadow-card bg-white p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E8E8E5]">
                  <div>
                    <span className="text-xs font-semibold text-[#252525]">Celia & Elias Wedding</span>
                    <span className="text-[11px] text-[#777777] block">Sonoma Valley · RSVP Questionnaire</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    LIVE
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] text-[#777777] block mb-1">Your Full Name</label>
                    <div className="p-2 bg-[#FAF9F7] rounded border border-[#E8E8E5] font-medium text-[#252525]">
                      Sarah & David Sterling
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] text-[#777777] block mb-1">Will you be attending?</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-[#252525] text-white rounded text-center font-medium flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Attending (2)</span>
                      </div>
                      <div className="p-2 bg-[#FAF9F7] text-[#777777] rounded text-center border border-[#E8E8E5]">
                        Regretfully Decline
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-[#FAF9F7] rounded border border-[#E8E8E5] space-y-2">
                    <span className="text-[10px] font-mono text-[#8B806F] uppercase">Conditional Question</span>
                    <div className="text-xs font-medium text-[#252525]">Meal Selections:</div>
                    <div className="text-[11px] text-[#555555]">
                      • Guest 1: Grilled Halibut w/ Asparagus<br />
                      • Guest 2: Prime Ribeye w/ Truffle Potato
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-between items-center text-[11px] text-[#777777] border-t border-[#E8E8E5]">
                  <span>Total Responses: 142 Confirmed</span>
                  <span className="font-mono text-[#8B806F]">94% Turnout</span>
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
            <span className="text-xs font-medium text-[#8B806F] tracking-wide uppercase">Intelligent Data Collection</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#252525] mt-2 leading-tight">
              Collect exactly what your vendors and venue coordinators need.
            </h2>
            <p className="text-xs md:text-sm text-[#777777] mt-3 leading-relaxed">
              Never follow up three times about food allergies or plus-one spelling. EventFrame collects clean, structured responses from day one.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {rsvpFeatures.map((feat, idx) => (
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

      {/* Questionnaire Field Breakdown Table */}
      <section className="py-20 md:py-28 border-b border-[#E8E8E5] bg-[#FAF9F7]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center space-y-2 mb-12">
            <span className="text-xs font-medium text-[#8B806F] tracking-wider uppercase">Field Editor</span>
            <h2 className="font-serif text-3xl md:text-4xl font-normal text-[#252525]">
              Flexible Question Logic
            </h2>
            <p className="text-xs sm:text-sm text-[#777777] max-w-xl mx-auto">
              Configure custom questions tailored to your wedding itinerary, lodging arrangements, and catering requirements.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-[#E8E8E5] shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF9F7] border-b border-[#E8E8E5] text-[#777777]">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Question / Field</th>
                    <th className="py-3 px-4 font-semibold">Input Type</th>
                    <th className="py-3 px-4 font-semibold">Display Condition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFEFEA]">
                  {sampleQuestions.map((q, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF9F7]/50">
                      <td className="py-3.5 px-4 font-medium text-[#252525]">{q.field}</td>
                      <td className="py-3.5 px-4 text-[#777777] font-mono text-[11px]">{q.type}</td>
                      <td className="py-3.5 px-4 text-[#8B806F]">{q.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Internal Navigation Links */}
      <section className="py-16 border-b border-[#E8E8E5] bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-8">
            <h3 className="text-xs font-semibold text-[#8B806F] uppercase tracking-wider">Related Solutions</h3>
            <p className="text-base font-serif text-[#252525] mt-1">Discover other integrated tools in EventFrame</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <a href="/wedding-guest-management" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Guest Management</div>
              <div className="text-[11px] text-[#777777]">Attendee records & moderation</div>
            </a>
            <a href="/digital-wedding-invitations" className="p-4 bg-[#FAF9F7] hover:bg-[#F2EFE9] border border-[#E8E8E5] rounded transition-colors text-xs space-y-1">
              <div className="font-semibold text-[#252525]">Digital Invitations</div>
              <div className="text-[11px] text-[#777777]">Canvas stationery editor</div>
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
              Wedding RSVP Questions
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
            <h3 className="font-serif text-2xl text-[#252525]">Ready to collect RSVPs effortlessly?</h3>
            <p className="text-xs sm:text-sm text-[#777777] max-w-md mx-auto">
              Set up your custom wedding RSVP questionnaire in minutes and invite guests with a simple link.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/login')}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Your RSVP Form
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
