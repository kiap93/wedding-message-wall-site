import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SEO_CONFIG } from '../src/seo/config.ts';
import { PUBLIC_SEO_ROUTES } from '../src/seo/routes.ts';
import { buildCanonicalUrl } from '../src/seo/canonical.ts';
import { getStructuredDataForType } from '../src/seo/structuredData.ts';
import { DEFAULT_TEMPLATES } from '../src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.resolve(rootDir, 'dist');

// Reusable editorial header and footer for prerendered pages
const prerenderHeader = `
  <header class="border-b border-[#E8E8E5] bg-[#F7F7F5] py-4 px-6">
    <div class="max-w-6xl mx-auto flex items-center justify-between">
      <a href="/" class="text-base font-semibold tracking-tight text-[#252525]">EventFrame<span class="text-[#8B806F]">.io</span></a>
      <nav class="flex items-center gap-6 text-xs text-[#777777]">
        <a href="/">Home</a>
        <a href="/wedding-planner-software">Planners</a>
        <a href="/templates">Themes</a>
        <a href="/pricing">Pricing</a>
        <a href="/login" class="text-[#252525] font-medium">Sign In</a>
      </nav>
    </div>
  </header>
`;

const prerenderFooter = `
  <footer class="border-t border-[#E8E8E5] bg-white py-12 px-6 mt-20">
    <div class="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-xs text-[#777777]">
      <div>
        <div class="font-semibold text-[#252525] mb-2">Solutions</div>
        <ul class="space-y-1.5">
          <li><a href="/wedding-planner-software">Wedding Planner Software</a></li>
          <li><a href="/white-label-wedding-software">White-Label Software</a></li>
          <li><a href="/digital-wedding-invitations">Digital Invitations</a></li>
          <li><a href="/wedding-rsvp-management">RSVP Management</a></li>
          <li><a href="/wedding-guest-management">Guest Management</a></li>
          <li><a href="/wedding-reception-display">Reception Displays</a></li>
        </ul>
      </div>
      <div>
        <div class="font-semibold text-[#252525] mb-2">Themes</div>
        <ul class="space-y-1.5">
          <li><a href="/templates">Template Catalog</a></li>
          <li><a href="/display?template=minimal_luxury">Minimal Luxury</a></li>
          <li><a href="/display?template=garden">Natural Garden</a></li>
          <li><a href="/display?template=romantic">Romantic Love</a></li>
        </ul>
      </div>
      <div>
        <div class="font-semibold text-[#252525] mb-2">Platform</div>
        <ul class="space-y-1.5">
          <li><a href="/pricing">Pricing & Plans</a></li>
          <li><a href="/login">Studio Workspace</a></li>
          <li><a href="/couple/login">Couple PIN Portal</a></li>
        </ul>
      </div>
      <div>
        <div class="font-semibold text-[#252525] mb-2">EventFrame.io</div>
        <p class="leading-relaxed">The integrated wedding platform for modern wedding studios, planners and couples.</p>
        <div class="mt-4">© ${new Date().getFullYear()} EventFrame.io</div>
      </div>
    </div>
  </footer>
`;

// Pre-render content generators for public marketing pages
const PRERENDER_CONTENT: Record<string, { h1: string; contentHtml: string }> = {
  '/': {
    h1: 'Wedding Planning Software for Modern Wedding Studios',
    contentHtml: `
      ${prerenderHeader}
      <main class="max-w-6xl mx-auto px-6 py-16">
        <div class="space-y-6 max-w-2xl">
          <div class="text-xs font-medium text-[#736959]">EventFrame Studio Platform · White-Label Wedding OS</div>
          <h1 class="font-serif text-4xl sm:text-5xl font-normal text-[#252525] leading-tight">Wedding Planning Software for Modern Wedding Studios</h1>
          <p class="text-[#777777] text-base leading-relaxed">Bring digital wedding invitations, guest RSVPs, guest experiences and live reception displays together in one platform.</p>
          <div class="flex gap-3 pt-2">
            <a href="/login" class="inline-block px-5 py-2.5 bg-[#252525] text-white text-xs font-medium rounded-md">Create Agency Workspace</a>
            <a href="/templates" class="inline-block px-5 py-2.5 border border-[#E8E8E5] text-[#252525] text-xs font-medium rounded-md">Browse Invitation Suites</a>
          </div>
        </div>

        <section class="mt-16 pt-12 border-t border-[#E8E8E5]">
          <h2 class="text-xs font-medium text-[#8B806F] tracking-wide uppercase mb-6">Integrated Wedding Software Solutions</h2>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div class="p-5 border border-[#E8E8E5] rounded-lg bg-white">
              <h3 class="font-semibold text-sm text-[#252525]"><a href="/wedding-planner-software">Wedding Planner Software</a></h3>
              <p class="text-xs text-[#777777] mt-1">Multi-wedding client management, event schedules, and coordinated guest workflows.</p>
            </div>
            <div class="p-5 border border-[#E8E8E5] rounded-lg bg-white">
              <h3 class="font-semibold text-sm text-[#252525]"><a href="/white-label-wedding-software">White-Label Wedding Software</a></h3>
              <p class="text-xs text-[#777777] mt-1">Agency subdomains, custom branding, and private PIN couple portals.</p>
            </div>
            <div class="p-5 border border-[#E8E8E5] rounded-lg bg-white">
              <h3 class="font-semibold text-sm text-[#252525]"><a href="/digital-wedding-invitations">Digital Wedding Invitations</a></h3>
              <p class="text-xs text-[#777777] mt-1">Canvas stationery studio, typography hierarchy, and integrated RSVP buttons.</p>
            </div>
            <div class="p-5 border border-[#E8E8E5] rounded-lg bg-white">
              <h3 class="font-semibold text-sm text-[#252525]"><a href="/wedding-rsvp-management">Wedding RSVP Management</a></h3>
              <p class="text-xs text-[#777777] mt-1">Conditional questionnaires, dietary requirements, and instant caterer export.</p>
            </div>
            <div class="p-5 border border-[#E8E8E5] rounded-lg bg-white">
              <h3 class="font-semibold text-sm text-[#252525]"><a href="/wedding-guest-management">Wedding Guest Management</a></h3>
              <p class="text-xs text-[#777777] mt-1">Attendee rosters, headcount tracking, and live memory moderation.</p>
            </div>
            <div class="p-5 border border-[#E8E8E5] rounded-lg bg-white">
              <h3 class="font-semibold text-sm text-[#252525]"><a href="/wedding-reception-display">Wedding Reception Displays</a></h3>
              <p class="text-xs text-[#777777] mt-1">Real-time venue screen projection, guest photo walls, and aesthetic themes.</p>
            </div>
          </div>
        </section>
      </main>
      ${prerenderFooter}
    `
  },
  '/templates': {
    h1: 'Wedding Display Themes & Invitation Suite Catalog',
    contentHtml: `
      ${prerenderHeader}
      <main class="max-w-6xl mx-auto px-6 py-12">
        <div class="space-y-3 mb-10">
          <h1 class="font-serif text-3xl sm:text-4xl text-[#252525]">Wedding Display Themes & Invitation Suite Catalog</h1>
          <p class="text-xs sm:text-sm text-[#777777] max-w-2xl leading-relaxed">Curated visual aesthetics and typography suites for live venue projectors, interactive guestbooks, and luxury wedding stationery.</p>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          ${DEFAULT_TEMPLATES.map(t => `
            <article class="p-6 bg-white border border-[#E8E8E5] rounded-lg shadow-sm">
              <h2 class="text-sm font-semibold text-[#252525]">${t.name}</h2>
              <p class="text-xs text-[#777777] mt-2 leading-relaxed">${t.description}</p>
              <div class="mt-4 pt-3 border-t border-[#EFEFEA] flex justify-between items-center text-[11px] text-[#8B806F]">
                <span class="font-mono capitalize">${t.variant} layout</span>
                <a href="/display?template=${t.id}" class="text-[#252525] font-medium">Preview Theme →</a>
              </div>
            </article>
          `).join('')}
        </div>
      </main>
      ${prerenderFooter}
    `
  },
  '/pricing': {
    h1: 'EventFrame Pricing — Plans for Wedding Studios & Couples',
    contentHtml: `
      ${prerenderHeader}
      <main class="max-w-6xl mx-auto px-6 py-12">
        <div class="text-center space-y-3 max-w-xl mx-auto mb-12">
          <h1 class="font-serif text-3xl sm:text-4xl text-[#252525]">Transparent Pricing for Studios & Couples</h1>
          <p class="text-xs sm:text-sm text-[#777777] leading-relaxed">Choose the right plan for your boutique wedding studio or individual celebration.</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div class="bg-white border border-[#E8E8E5] rounded-lg p-6 shadow-sm space-y-4">
            <div>
              <span class="text-xs font-semibold text-[#8B806F]">Single Celebration</span>
              <h2 class="text-lg font-semibold text-[#252525] mt-1">Couple License</h2>
              <p class="text-xs text-[#777777] mt-1">Everything needed for a single unforgettable wedding event.</p>
            </div>
            <div class="text-3xl font-semibold text-[#252525]">$19 <span class="text-xs font-normal text-[#777777]">one-time</span></div>
            <ul class="text-xs text-[#777777] space-y-2 pt-2 border-t border-[#EFEFEA]">
              <li>✓ 1 Active Wedding Event</li>
              <li>✓ Unlimited RSVP Submissions</li>
              <li>✓ Live Guest Wall Moderation</li>
              <li>✓ Digital Invitation Studio</li>
            </ul>
            <a href="/login" class="block text-center py-2 px-4 bg-white border border-[#E8E8E5] text-[#252525] text-xs font-medium rounded">Select Couple Plan</a>
          </div>

          <div class="bg-white border-2 border-[#252525] rounded-lg p-6 shadow-md space-y-4 relative">
            <span class="absolute -top-3 right-4 bg-[#252525] text-white text-[10px] font-mono px-2 py-0.5 rounded">MOST POPULAR</span>
            <div>
              <span class="text-xs font-semibold text-[#8B806F]">Boutique Agency</span>
              <h2 class="text-lg font-semibold text-[#252525] mt-1">Studio Pro</h2>
              <p class="text-xs text-[#777777] mt-1">Designed for active wedding planners and boutique event studios.</p>
            </div>
            <div class="text-3xl font-semibold text-[#252525]">$49 <span class="text-xs font-normal text-[#777777]">/ month</span></div>
            <ul class="text-xs text-[#777777] space-y-2 pt-2 border-t border-[#EFEFEA]">
              <li>✓ Unlimited Client Events</li>
              <li>✓ White-label Agency Subdomain</li>
              <li>✓ Couple Access PIN Portals</li>
              <li>✓ Priority Live Screen Sync</li>
            </ul>
            <a href="/login" class="block text-center py-2 px-4 bg-[#252525] text-white text-xs font-medium rounded">Start 30-Day Free Trial</a>
          </div>

          <div class="bg-white border border-[#E8E8E5] rounded-lg p-6 shadow-sm space-y-4">
            <div>
              <span class="text-xs font-semibold text-[#8B806F]">Enterprise Agency</span>
              <h2 class="text-lg font-semibold text-[#252525] mt-1">Agency Annual</h2>
              <p class="text-xs text-[#777777] mt-1">For established studios managing large annual wedding rosters.</p>
            </div>
            <div class="text-3xl font-semibold text-[#252525]">$399 <span class="text-xs font-normal text-[#777777]">/ year</span></div>
            <ul class="text-xs text-[#777777] space-y-2 pt-2 border-t border-[#EFEFEA]">
              <li>✓ Unlimited Client Events</li>
              <li>✓ Custom Apex Domain CNAME</li>
              <li>✓ Bespoke Template Styling</li>
              <li>✓ Dedicated Support Manager</li>
            </ul>
            <a href="/login" class="block text-center py-2 px-4 bg-white border border-[#E8E8E5] text-[#252525] text-xs font-medium rounded">Select Annual Plan</a>
          </div>
        </div>
      </main>
      ${prerenderFooter}
    `
  },
  '/wedding-planner-software': {
    h1: 'A Better Way to Manage the Wedding Experience',
    contentHtml: `
      ${prerenderHeader}
      <main class="max-w-6xl mx-auto px-6 py-16">
        <div class="max-w-3xl space-y-4">
          <div class="text-xs font-medium text-[#736959]">EventFrame for Studios · Complete Wedding Operating System</div>
          <h1 class="font-serif text-4xl sm:text-5xl font-normal text-[#252525] leading-tight">A Better Way to Manage the Wedding Experience</h1>
          <p class="text-[#777777] text-base leading-relaxed">
            Modern wedding planners and luxury studios use EventFrame to orchestrate digital stationery, custom RSVP flows, and live reception screen experiences under one coordinated roof.
          </p>
        </div>

        <section class="mt-16 pt-12 border-t border-[#E8E8E5] grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Multi-Wedding Studio Workspace</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Manage multiple concurrent client celebrations from a single command center with an interactive calendar and attendee counts.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Bespoke Digital Invitations</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Design editorial stationery with drag-and-drop coordinates, elegant serif typography, and integrated RSVP buttons.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Conditional RSVP Collection</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Collect meal choices, dietary needs, plus-ones, and lodging information with intelligent questions shown only to attending guests.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Live Reception Moderation</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Provide an interactive guestbook during the banquet. Guests stream photos and wishes directly to venue projectors after approval.</p>
          </div>
        </section>

        <section class="mt-16 p-8 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg">
          <h2 class="font-serif text-2xl text-[#252525]">Explore Related Studio Solutions</h2>
          <div class="mt-4 flex flex-wrap gap-4 text-xs font-medium">
            <a href="/white-label-wedding-software" class="text-[#8B806F] hover:underline">White-Label Software →</a>
            <a href="/digital-wedding-invitations" class="text-[#8B806F] hover:underline">Digital Wedding Invitations →</a>
            <a href="/wedding-rsvp-management" class="text-[#8B806F] hover:underline">RSVP Management →</a>
            <a href="/wedding-guest-management" class="text-[#8B806F] hover:underline">Guest Management →</a>
            <a href="/wedding-reception-display" class="text-[#8B806F] hover:underline">Reception Displays →</a>
          </div>
        </section>
      </main>
      ${prerenderFooter}
    `
  },
  '/white-label-wedding-software': {
    h1: 'Your Wedding Platform. Your Brand.',
    contentHtml: `
      ${prerenderHeader}
      <main class="max-w-6xl mx-auto px-6 py-16">
        <div class="max-w-3xl space-y-4">
          <div class="text-xs font-medium text-[#736959]">Agency White-Label Infrastructure · Custom Subdomains</div>
          <h1 class="font-serif text-4xl sm:text-5xl font-normal text-[#252525] leading-tight">Your Wedding Platform. Your Brand.</h1>
          <p class="text-[#777777] text-base leading-relaxed">
            Elevate your wedding agency by offering bespoke digital invitations, custom RSVP tracking, and live reception screens hosted entirely under your own studio identity.
          </p>
        </div>

        <section class="mt-16 pt-12 border-t border-[#E8E8E5] grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Dedicated Agency Subdomains</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Host all client portals, invitation viewer links, and RSVP pages under your custom studio subdomain (e.g., yourstudio.eventframe.io).</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Agency Identity & Palette</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Display your studio name, monogram, and curated theme palette across client touchpoints with zero third-party ads.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Private Couple PIN Portals</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Provide each couple with a streamlined client hub. Couples access their guest list and moderate memories using an event access PIN.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Studio-Branded Touchpoints</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">From mobile-friendly invitations to live ballroom screens, the guest experience reflects the high-touch editorial standard you are hired for.</p>
          </div>
        </section>

        <section class="mt-16 p-8 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg">
          <h2 class="font-serif text-2xl text-[#252525]">Connected Studio Features</h2>
          <div class="mt-4 flex flex-wrap gap-4 text-xs font-medium">
            <a href="/wedding-planner-software" class="text-[#8B806F] hover:underline">Wedding Planner Software →</a>
            <a href="/digital-wedding-invitations" class="text-[#8B806F] hover:underline">Digital Wedding Invitations →</a>
            <a href="/wedding-rsvp-management" class="text-[#8B806F] hover:underline">RSVP Management →</a>
            <a href="/wedding-reception-display" class="text-[#8B806F] hover:underline">Reception Displays →</a>
          </div>
        </section>
      </main>
      ${prerenderFooter}
    `
  },
  '/digital-wedding-invitations': {
    h1: 'Beautiful Digital Wedding Invitations, Made Personal',
    contentHtml: `
      ${prerenderHeader}
      <main class="max-w-6xl mx-auto px-6 py-16">
        <div class="max-w-3xl space-y-4">
          <div class="text-xs font-medium text-[#736959]">Digital Wedding Stationery · Responsive Canvas</div>
          <h1 class="font-serif text-4xl sm:text-5xl font-normal text-[#252525] leading-tight">Beautiful Digital Wedding Invitations, Made Personal</h1>
          <p class="text-[#777777] text-base leading-relaxed">
            Design bespoke online wedding invitations with editorial typography, interactive venue maps, and integrated RSVP collection. The modern alternative to generic paper suites.
          </p>
        </div>

        <section class="mt-16 pt-12 border-t border-[#E8E8E5] grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Precision Stationery Canvas</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Fine-tune typography, monograms, schedule timelines, and photos on a coordinate-based drag-and-drop canvas.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Mobile-Optimized Viewports</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Preview exactly how guests will experience your invitation on iPhone and Android screens, as well as desktop monitors.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Integrated RSVP Action</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Guests read ceremony details, view directions, and immediately submit their RSVP questionnaire in one continuous flow.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Editorial Typography Presets</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Pair Cormorant Garamond serif headings with crisp Inter body copy and clean JetBrains Mono details for an archival feel.</p>
          </div>
        </section>

        <section class="mt-16 p-8 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg">
          <h2 class="font-serif text-2xl text-[#252525]">Explore Invitation Themes & Features</h2>
          <div class="mt-4 flex flex-wrap gap-4 text-xs font-medium">
            <a href="/templates" class="text-[#8B806F] hover:underline">Explore Template Catalog →</a>
            <a href="/wedding-rsvp-management" class="text-[#8B806F] hover:underline">RSVP Questionnaire System →</a>
            <a href="/wedding-reception-display" class="text-[#8B806F] hover:underline">Reception Displays →</a>
            <a href="/wedding-planner-software" class="text-[#8B806F] hover:underline">Planner Software →</a>
          </div>
        </section>
      </main>
      ${prerenderFooter}
    `
  },
  '/wedding-rsvp-management': {
    h1: 'A Simpler Way to Manage Wedding RSVPs',
    contentHtml: `
      ${prerenderHeader}
      <main class="max-w-6xl mx-auto px-6 py-16">
        <div class="max-w-3xl space-y-4">
          <div class="text-xs font-medium text-[#736959]">Wedding RSVP Automation · Conditional Questionnaires</div>
          <h1 class="font-serif text-4xl sm:text-5xl font-normal text-[#252525] leading-tight">A Simpler Way to Manage Wedding RSVPs</h1>
          <p class="text-[#777777] text-base leading-relaxed">
            Replace messy text messages and lost paper reply cards. Collect wedding guest attendance, meal selections, plus-ones, and dietary restrictions with beautiful online questionnaires.
          </p>
        </div>

        <section class="mt-16 pt-12 border-t border-[#E8E8E5] grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Conditional Questionnaires</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Show meal preferences, shuttle pickup locations, and lodging questions only to guests who confirm attendance.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Custom Field Types</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Collect exact information with dropdown menus, checkboxes, multiple choice, number counters, and open text areas.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Instant CSV & Caterer Export</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Export clean spreadsheets with full attendee names, party counts, meal choices, and custom questionnaire answers.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Aesthetic Visual Harmony</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Your RSVP form automatically adopts the event’s Display Art Aesthetic so guests enjoy a cohesive visual journey.</p>
          </div>
        </section>

        <section class="mt-16 p-8 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg">
          <h2 class="font-serif text-2xl text-[#252525]">Next Steps in Wedding Coordination</h2>
          <div class="mt-4 flex flex-wrap gap-4 text-xs font-medium">
            <a href="/wedding-guest-management" class="text-[#8B806F] hover:underline">Guest Management Software →</a>
            <a href="/digital-wedding-invitations" class="text-[#8B806F] hover:underline">Digital Wedding Invitations →</a>
            <a href="/wedding-reception-display" class="text-[#8B806F] hover:underline">Reception Displays →</a>
            <a href="/pricing" class="text-[#8B806F] hover:underline">View Pricing →</a>
          </div>
        </section>
      </main>
      ${prerenderFooter}
    `
  },
  '/wedding-guest-management': {
    h1: 'Bring Your Wedding Guest Experience Together',
    contentHtml: `
      ${prerenderHeader}
      <main class="max-w-6xl mx-auto px-6 py-16">
        <div class="max-w-3xl space-y-4">
          <div class="text-xs font-medium text-[#736959]">Unified Guest Operations · Attendee Lists & Live Moderation</div>
          <h1 class="font-serif text-4xl sm:text-5xl font-normal text-[#252525] leading-tight">Bring Your Wedding Guest Experience Together</h1>
          <p class="text-[#777777] text-base leading-relaxed">
            Coordinate RSVP headcounts, dietary restrictions, and live reception memory moderation in one elegant dashboard designed for wedding planners and couples.
          </p>
        </div>

        <section class="mt-16 pt-12 border-t border-[#E8E8E5] grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Attendee Roster & Headcount Sync</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Track confirmed guests, regrets, party sizes, and meal counts in real-time. Keep clean records of who has responded.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Live Banquet Moderation Queue</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Review photos and messages submitted by guests before they appear on the ballroom projector screen with one tap.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Dedicated Couple Access Portal</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Share a private couple hub protected with a secure PIN. Couples browse their guest list and moderate memories independently.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Permanent Memory Archive</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">All congratulations, reception notes, and candid photos remain safely preserved in the wedding dashboard for years.</p>
          </div>
        </section>

        <section class="mt-16 p-8 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg">
          <h2 class="font-serif text-2xl text-[#252525]">Explore More Guest Solutions</h2>
          <div class="mt-4 flex flex-wrap gap-4 text-xs font-medium">
            <a href="/wedding-reception-display" class="text-[#8B806F] hover:underline">Reception Displays →</a>
            <a href="/wedding-rsvp-management" class="text-[#8B806F] hover:underline">RSVP Management →</a>
            <a href="/digital-wedding-invitations" class="text-[#8B806F] hover:underline">Digital Invitations →</a>
            <a href="/wedding-planner-software" class="text-[#8B806F] hover:underline">Planner Software →</a>
          </div>
        </section>
      </main>
      ${prerenderFooter}
    `
  },
  '/wedding-reception-display': {
    h1: 'Make Your Wedding Reception More Interactive',
    contentHtml: `
      ${prerenderHeader}
      <main class="max-w-6xl mx-auto px-6 py-16">
        <div class="max-w-3xl space-y-4">
          <div class="text-xs font-medium text-[#736959]">Interactive Venue Displays · Live Projector Memory Wall</div>
          <h1 class="font-serif text-4xl sm:text-5xl font-normal text-[#252525] leading-tight">Make Your Wedding Reception More Interactive</h1>
          <p class="text-[#777777] text-base leading-relaxed">
            Connect any venue display, projector, or LED screen to broadcast guest photos and warm wishes in real-time. Curated with editorial typography and planner moderation.
          </p>
        </div>

        <section class="mt-16 pt-12 border-t border-[#E8E8E5] grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Universal Hardware Compatibility</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Open the live display URL on any laptop or smart TV. Connect via HDMI or wireless mirroring to venue projectors.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Instant Table QR Code Scanning</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Guests scan with their phone camera to instantly upload banquet photos and warm wishes without downloading an app.</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">8 Curated Display Aesthetics</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Choose from 8 distinct visual themes tailored to your floral decor (Minimal Luxury, Natural Garden, Romantic Love, etc.).</p>
          </div>
          <div class="p-6 bg-white border border-[#E8E8E5] rounded-lg">
            <h2 class="text-sm font-semibold text-[#252525]">Live Banquet Moderation Queue</h2>
            <p class="text-xs text-[#777777] mt-2 leading-relaxed">Planners or bridal party members approve incoming photos and notes from their phones before they broadcast to the screen.</p>
          </div>
        </section>

        <section class="mt-16 p-8 bg-[#FAF9F7] border border-[#E8E8E5] rounded-lg">
          <h2 class="font-serif text-2xl text-[#252525]">Connected Ceremony Experiences</h2>
          <div class="mt-4 flex flex-wrap gap-4 text-xs font-medium">
            <a href="/templates" class="text-[#8B806F] hover:underline">Explore Display Themes →</a>
            <a href="/digital-wedding-invitations" class="text-[#8B806F] hover:underline">Digital Invitations →</a>
            <a href="/wedding-guest-management" class="text-[#8B806F] hover:underline">Guest Management →</a>
            <a href="/wedding-planner-software" class="text-[#8B806F] hover:underline">Planner Software →</a>
          </div>
        </section>
      </main>
      ${prerenderFooter}
    `
  }
};

async function prerender() {
  console.log('--- Starting EventFrame.io Technical SEO Prerender Step ---');
  
  const templatePath = path.join(distDir, 'index.html');
  if (!fs.existsSync(templatePath)) {
    console.error('Error: dist/index.html not found. Please run vite build first.');
    process.exit(1);
  }

  const baseHtml = fs.readFileSync(templatePath, 'utf8');

  // Copy robots.txt and sitemap.xml to dist if present in public
  const publicDir = path.join(rootDir, 'public');
  if (fs.existsSync(path.join(publicDir, 'robots.txt'))) {
    fs.copyFileSync(path.join(publicDir, 'robots.txt'), path.join(distDir, 'robots.txt'));
    console.log('✓ Copied robots.txt to dist/robots.txt');
  }
  if (fs.existsSync(path.join(publicDir, 'sitemap.xml'))) {
    fs.copyFileSync(path.join(publicDir, 'sitemap.xml'), path.join(distDir, 'sitemap.xml'));
    console.log('✓ Copied sitemap.xml to dist/sitemap.xml');
  }

  const routesToPrerender = [
    '/',
    '/templates',
    '/pricing',
    '/wedding-planner-software',
    '/white-label-wedding-software',
    '/digital-wedding-invitations',
    '/wedding-rsvp-management',
    '/wedding-guest-management',
    '/wedding-reception-display'
  ];

  for (const route of routesToPrerender) {
    const meta = PUBLIC_SEO_ROUTES[route] || PUBLIC_SEO_ROUTES['/'];
    const prerenderData = PRERENDER_CONTENT[route] || PRERENDER_CONTENT['/'];
    const canonicalUrl = buildCanonicalUrl(meta.canonicalPath || route);

    const schemas = getStructuredDataForType(meta.structuredDataType);
    const jsonLdString = JSON.stringify(schemas);

    let html = baseHtml;

    // 1. Replace or update <title>
    if (html.includes('<title>')) {
      html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${meta.title}</title>`);
    } else {
      html = html.replace('</head>', `<title>${meta.title}</title>\n</head>`);
    }

    // 2. Build complete SEO meta tags
    const metaTags = `
    <meta name="description" content="${meta.description}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta name="robots" content="${meta.noindex ? 'noindex, nofollow' : 'index, follow'}" />
    <meta property="og:title" content="${meta.title}" />
    <meta property="og:description" content="${meta.description}" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:type" content="${meta.ogType || 'website'}" />
    <meta property="og:site_name" content="${SEO_CONFIG.siteName}" />
    <meta property="og:image" content="${meta.ogImage || SEO_CONFIG.defaultOgImage}" />
    <meta property="og:image:alt" content="${meta.ogImageAlt || SEO_CONFIG.defaultOgImageAlt}" />
    <meta name="twitter:card" content="${meta.twitterCard || 'summary_large_image'}" />
    <meta name="twitter:title" content="${meta.title}" />
    <meta name="twitter:description" content="${meta.description}" />
    <meta name="twitter:image" content="${meta.ogImage || SEO_CONFIG.defaultOgImage}" />
    <meta name="twitter:site" content="${SEO_CONFIG.twitterSite}" />
    <script id="eventframe-schema-jsonld" type="application/ld+json">${jsonLdString}</script>
    `;

    // Remove old meta description or canonical if already in baseHtml
    html = html.replace(/<meta name="description"[\s\S]*?>/i, '');
    html = html.replace(/<meta property="og:[\s\S]*?>/gi, '');
    html = html.replace(/<link rel="canonical"[\s\S]*?>/i, '');

    html = html.replace('</head>', `${metaTags}\n</head>`);

    // 3. Inject meaningful crawlable semantic HTML into <div id="root"></div>
    html = html.replace(
      '<div id="root"></div>',
      `<div id="root">${prerenderData.contentHtml}</div>`
    );

    // 4. Save to target output
    if (route === '/') {
      fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');
      console.log('✓ Prerendered / -> dist/index.html');
    } else {
      const targetDir = path.join(distDir, route.replace(/^\//, ''));
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');
      console.log(`✓ Prerendered ${route} -> dist/${route.replace(/^\//, '')}/index.html`);
    }
  }

  // Also create dist/subscription/index.html as alias to pricing
  const subTargetDir = path.join(distDir, 'subscription');
  if (!fs.existsSync(subTargetDir)) {
    fs.mkdirSync(subTargetDir, { recursive: true });
  }
  const pricingHtml = fs.readFileSync(path.join(distDir, 'pricing', 'index.html'), 'utf8');
  fs.writeFileSync(path.join(subTargetDir, 'index.html'), pricingHtml, 'utf8');
  console.log('✓ Prerendered /subscription -> dist/subscription/index.html');

  console.log('--- Prerender Step Completed Successfully ---');
}

prerender().catch(err => {
  console.error('Prerender error:', err);
  process.exit(1);
});
