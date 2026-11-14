import { BlogPost } from './types';

export const BLOG_POSTS: BlogPost[] = [
  {
    id: 'digital-wedding-invitations-guide',
    slug: 'digital-wedding-invitations-guide',
    title: 'The Complete Guide to Digital Wedding Invitations for Modern Couples & Studios',
    seoTitle: 'Complete Guide to Digital Wedding Invitations | EventFrame Journal',
    description:
      'Learn how to design, send, and manage digital wedding invitations with responsive typography, integrated online RSVP tracking, and optional guest privacy PINs.',
    excerpt:
      'Paper suites take weeks to print and mail, while generic forms break the aesthetic. Here is how modern couples and wedding planners craft editorial digital invitations connected directly to RSVPs.',
    category: 'Invitations & Design',
    publishedAt: '2026-10-12',
    updatedAt: '2026-11-05',
    readingTimeMinutes: 7,
    authorName: 'EventFrame Editorial Team',
    authorRole: 'Wedding Design & Guest Experience',
    coverImage: '/images/seo/digital-wedding-invitations-stationery.webp',
    coverImageWidth: 1200,
    coverImageHeight: 896,
    coverImageAlt: 'Editorial digital wedding invitation suite with serif typography and monogram details',
    keywords: [
      'digital wedding invitations',
      'online wedding invitations',
      'wedding invitation RSVP link',
      'luxury wedding stationery studio',
    ],
    sections: [
      {
        id: 'why-digital-stationery',
        heading: 'Why Digital Wedding Invitations Have Replaced Disjointed Paper Workflows',
        paragraphs: [
          'For decades, couples mailed printed invitations alongside tiny reply cards and then spent months chasing missing responses by text message. Digital wedding invitations solve both the logistics gap and the timing bottleneck: guests tap a clean link on their phone, read ceremony and dress-code guidance, and submit their RSVP immediately.',
          'The best modern platforms no longer force a trade-off between convenience and craft. With coordinate-level typography layout, serif display pairings, and curated color palettes, online invitations preserve the poise of fine letterpress stationery while syncing straight into your guest roster.',
        ],
        bullets: [
          'Zero printing delays, postage loss, or manual spreadsheet transcription',
          'Instant updates if ceremony times, shuttle stops, or weather plans change',
          'Direct transition from invitation view into conditional RSVP questions',
          'Optional access PIN protection so ceremony details remain invite-only',
        ],
      },
      {
        id: 'design-anatomy',
        heading: 'What Every High-Converting Digital Invitation Should Include',
        paragraphs: [
          'A well-structured digital wedding invitation balances emotional storytelling with operational clarity. Guests scanning on mobile want key facts within three seconds without hunting through buried menus.',
        ],
        bullets: [
          'Names, host wording, ceremony date, and local time zone clearly set above the fold',
          'Venue name, street address, and one-tap map directions for out-of-town travelers',
          'Clear dress code notes, arrival timing, and shuttle transportation schedules',
          'A prominent RSVP call-to-action button paired with an explicit reply deadline',
        ],
        callout:
          'Tip for wedding studios: Keep invitation typography consistent with your couple website and reception screen display theme so every guest touchpoint feels bespoke.',
      },
      {
        id: 'privacy-and-etiquette',
        heading: 'Etiquette, Plus-Ones, and Privacy Controls',
        paragraphs: [
          'Sharing a link does not mean broadcasting private venue coordinates to the open web. Studios and couples can require a dedicated event PIN before displaying guest details, disable search indexing on private celebrations, and connect invitations directly to controlled party-size counters on the RSVP form.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Do guests need to download an app to view a digital wedding invitation?',
        a: 'No. EventFrame digital invitations open directly in Safari, Chrome, or any mobile browser without logins or app installations.',
      },
      {
        q: 'Can we update ceremony times after sending invitation links?',
        a: 'Yes. Any adjustment saved in the stationery canvas or website studio updates immediately for every guest opening the link.',
      },
    ],
    relatedToolLinks: [
      {
        href: '/digital-wedding-invitations',
        label: 'Digital Wedding Invitations',
        desc: 'Coordinate canvas editor, mobile previews & RSVP buttons',
      },
      {
        href: '/wedding-website-builder',
        label: 'Wedding Website Builder',
        desc: 'Pair stationery suites with full schedule & travel pages',
      },
      {
        href: '/templates',
        label: 'Theme Catalog',
        desc: 'Browse Minimal Luxury, Natural Garden & Romantic palettes',
      },
    ],
    relatedPostSlugs: ['wedding-website-vs-digital-invitation', 'how-to-manage-wedding-rsvps'],
  },
  {
    id: 'how-to-manage-wedding-rsvps',
    slug: 'how-to-manage-wedding-rsvps',
    title: 'How to Manage Wedding RSVPs Without Spreadsheets, Chasing Guests, or Missed Allergies',
    seoTitle: 'How to Manage Wedding RSVPs & Meal Selections | EventFrame Journal',
    description:
      'A practical system for managing wedding RSVPs online using conditional questionnaires, household party counts, dietary allergy tracking, and instant caterer CSV exports.',
    excerpt:
      'Tracking attendance, entrée selections, shuttle seats, and allergies across texts and spreadsheets invites costly catering errors. Replace friction with structured RSVP logic.',
    category: 'RSVP & Guest Lists',
    publishedAt: '2026-10-16',
    updatedAt: '2026-11-06',
    readingTimeMinutes: 8,
    authorName: 'EventFrame Editorial Team',
    authorRole: 'Event Operations & Catering Workflows',
    coverImage: '/images/seo/wedding-management-workspace-dashboard.webp',
    coverImageWidth: 1200,
    coverImageHeight: 670,
    coverImageAlt: 'Wedding RSVP analytics dashboard showing attending headcounts and dietary export status',
    keywords: [
      'how to manage wedding RSVPs',
      'wedding RSVP management',
      'wedding dietary restrictions tracking',
      'online wedding RSVP questionnaire',
    ],
    sections: [
      {
        id: 'why-rsvp-chaos-happens',
        heading: 'Why Traditional Wedding RSVP Collection Breaks Down',
        paragraphs: [
          'Most RSVP headaches stem from unstructured replies. A guest texts "Count us in!", forgets to specify whether their partner is vegetarian, and leaves out their plus-one’s full name for place cards.',
          'When planners manually copy answers from email threads into spreadsheets, dietary allergies and headcount revisions easily slip out of sync just before catering lock.',
        ],
      },
      {
        id: 'conditional-question-blueprint',
        heading: 'Build a Conditional RSVP Flow That Respects Guests’ Time',
        paragraphs: [
          'Conditional logic keeps your form short for guests who decline while collecting every logistical detail from attending parties.',
        ],
        bullets: [
          'Step 1: Full Name and Attendance Status (Attending / Regretfully Declining)',
          'Step 2 (Only if attending): Total Party Headcount and Named Guest Confirmation',
          'Step 3 (Only if attending): Entrée Selection & Explicit Allergy Notes (gluten-free, nut allergy, vegan, halal)',
          'Step 4 (Only if attending): Shuttle Boarding Preference, Welcome Dinner Attendance & Song Requests',
        ],
      },
      {
        id: 'catering-and-seating-sync',
        heading: 'Turning RSVP Submissions Directly Into Seating & Caterer Lists',
        paragraphs: [
          'When RSVPs live in the same platform as your guest roster and seating planner, confirmed guests flow straight into dietary counts and table assignment queues. With one click, export a clean CSV organized by table, meal choice, and allergy flag for venue captains.',
        ],
        callout:
          'Always set your online RSVP cutoff 3–4 weeks before the wedding date so you have margin for table finalizing and place-card printing.',
      },
    ],
    faqs: [
      {
        q: 'What if an older relative prefers calling instead of filling out an online RSVP?',
        a: 'Both couples (via PIN portal) and planners can manually record or adjust any guest’s attendance status and meal choice inside the dashboard.',
      },
      {
        q: 'Can we customize RSVP fields per wedding?',
        a: 'Yes. Add dropdowns, checkboxes, radio options, numeric counters, or open text prompts tailored to multi-day ceremonies or custom menus.',
      },
    ],
    relatedToolLinks: [
      {
        href: '/wedding-rsvp-management',
        label: 'Wedding RSVP Management',
        desc: 'Conditional questions, dietary tracking & CSV export',
      },
      {
        href: '/wedding-guest-management',
        label: 'Guest List Management',
        desc: 'Household tracking, VIP tags & live headcount sync',
      },
      {
        href: '/wedding-seating-chart',
        label: 'Seating Chart Planner',
        desc: 'Assign confirmed guests to tables with meal visibility',
      },
    ],
    relatedPostSlugs: ['how-to-organize-wedding-guest-list', 'wedding-seating-chart-guide'],
  },
  {
    id: 'wedding-seating-chart-guide',
    slug: 'wedding-seating-chart-guide',
    title: 'How to Plan a Wedding Seating Chart & Venue Floor Plan Without Stress',
    seoTitle: 'Wedding Seating Chart & Venue Floor Plan Guide | EventFrame Journal',
    description:
      'Step-by-step framework for measuring real ballroom dimensions, laying out banquet tables and dance floors, balancing guest groups, and finalizing your wedding seating chart.',
    excerpt:
      'An effective seating chart balances guest chemistry with architectural reality. Here is how planners map real-world venue dimensions, table capacities, and VIP sightlines.',
    category: 'Seating & Floor Plans',
    publishedAt: '2026-10-20',
    updatedAt: '2026-11-08',
    readingTimeMinutes: 9,
    authorName: 'EventFrame Editorial Team',
    authorRole: 'Venue Architecture & Seating Systems',
    coverImage: '/images/seo/wedding-seating-chart-floor-plan.webp',
    coverImageWidth: 1200,
    coverImageHeight: 670,
    coverImageAlt: 'Interactive wedding hall floor plan and seating chart editor scaled in meters with banquet tables',
    keywords: [
      'wedding seating chart',
      'wedding floor plan software',
      'wedding hall layout editor',
      'banquet table seating planner',
    ],
    sections: [
      {
        id: 'start-with-venue-dimensions',
        heading: 'Start With True Venue Dimensions Before Placing a Single Table',
        paragraphs: [
          'The most common seating chart mistake is drawing tables on an arbitrary canvas without knowing real ballroom proportions. A 30m × 20m grand ballroom behaves very differently from a narrow 35m × 12m reception pavilion.',
          'Configure your canvas in real-world meters or feet first, verify pillar clearances and service aisles, and anchor fixed focal points—the stage, sweetheart or head table, dance floor, and bar stations—before arranging guest tables around them.',
        ],
        bullets: [
          'Reserve at least 1.5m–1.8m between round table edges for comfortable chair clearance and catering service',
          'Keep clear sightlines from parent and VIP tables toward the stage and sweetheart table',
          'Place elderly family members away from direct speaker stacks while keeping them close to main aisles',
        ],
      },
      {
        id: 'grouping-strategy',
        heading: 'Smart Guest & Household Grouping Rules',
        paragraphs: [
          'Assign families, households, and college or colleague friend groups together rather than seating guests one-by-one from an alphabetical list. Grouping by social circle naturally breaks the ice while keeping couples and children together.',
        ],
        callout:
          'Pro tip: Use Fit-to-Screen and Maximize Workspace modes during final table reviews with couples so you can inspect the entire room topology alongside unassigned guest counts.',
      },
      {
        id: 'syncing-capacity-and-dietary',
        heading: 'Prevent Table Overflows & Sync Dietary Notes With Catering',
        paragraphs: [
          'When each table tracks live seat occupancy against its seat limit—and highlights guest dietary tags directly inside the seating drawer—planners immediately spot empty seats, over-capacity tables, and special meal placements across the floor.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can I switch between meters and feet in the wedding hall planner?',
        a: 'Yes. Configure any custom venue width and height in meters (m) or feet (ft), choose portrait or landscape orientation, or start from hall presets.',
      },
      {
        q: 'Can I assign an entire household group to a table at once?',
        a: 'Yes. Assign individual guests or whole household groups directly onto available banquet tables while respecting table seat capacity.',
      },
    ],
    relatedToolLinks: [
      {
        href: '/wedding-seating-chart',
        label: 'Wedding Seating Chart & Hall Editor',
        desc: 'Custom venue dimensions, drag-and-drop tables & seat assignment',
      },
      {
        href: '/wedding-guest-management',
        label: 'Guest List Management',
        desc: 'Organize households, VIP guests & RSVP status',
      },
      {
        href: '/wedding-planner-software',
        label: 'Studio Command Center',
        desc: 'Manage floor plans across every active client wedding',
      },
    ],
    relatedPostSlugs: ['how-to-organize-wedding-guest-list', 'how-to-manage-wedding-rsvps'],
  },
  {
    id: 'wedding-website-vs-digital-invitation',
    slug: 'wedding-website-vs-digital-invitation',
    title: 'Wedding Website vs. Digital Invitation: What Couples and Planners Actually Need',
    seoTitle: 'Wedding Website vs Digital Invitation: Complete Comparison | EventFrame',
    description:
      'Understand the difference between a wedding website and a digital wedding invitation, when you need both, and how unified publishing connects design, RSVPs, and SEO privacy.',
    excerpt:
      'Should you send a bespoke digital invitation card, build a multi-section wedding website, or connect both into one coherent guest journey? Here is how to decide.',
    category: 'Wedding Websites',
    publishedAt: '2026-10-25',
    updatedAt: '2026-11-08',
    readingTimeMinutes: 6,
    authorName: 'EventFrame Editorial Team',
    authorRole: 'Digital Stationery & Web Architecture',
    coverImage: '/images/seo/wedding-website-builder-studio.webp',
    coverImageWidth: 1200,
    coverImageHeight: 670,
    coverImageAlt: 'EventFrame wedding website builder studio displaying modular story, schedule, and RSVP sections',
    keywords: [
      'wedding website vs digital invitation',
      'custom wedding website builder',
      'editorial wedding website software',
    ],
    sections: [
      {
        id: 'distinct-roles',
        heading: 'Distinct Roles in the Guest Journey',
        paragraphs: [
          'A digital wedding invitation acts as the formal announcement—crisp typography, host wording, ceremony date, and an immediate RSVP trigger. A wedding website acts as the living event hub holding multi-day itineraries, accommodation blocks, travel tips, engagement galleries, and live reception links.',
          'Historically, couples had to use one vendor for invitations, another for their website, and a third tool for RSVPs—creating broken styling and fragmented guest data.',
        ],
      },
      {
        id: 'unified-architecture',
        heading: 'How Combining Both Eliminates Friction',
        paragraphs: [
          'When your digital invitation and couple wedding website share one data model, every schedule update, color palette, typography pairing, and RSVP submission stays synchronized automatically.',
        ],
        bullets: [
          'Use the Canvas Stationery Editor for ceremonial invitation cards and direct WhatsApp/SMS sharing',
          'Use the Wedding Website Studio to publish full Story, Schedule, Venue Directions, Photo Gallery, and Live Wish Wall sections',
          'Control public search engine visibility independently—keep private family sites hidden with noindex, or publish public showcase weddings with custom Open Graph social previews',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can we keep our wedding website unpublished while we design it?',
        a: 'Yes. Sites stay in private draft mode until explicitly published, and secret preview tokens let planners and couples review drafts before launch.',
      },
      {
        q: 'Can published wedding websites be hidden from Google search?',
        a: 'Yes. Toggle the SEO noindex setting in Website Studio at any time to prevent search engine indexing while keeping the URL live for invited guests.',
      },
    ],
    relatedToolLinks: [
      {
        href: '/wedding-website-builder',
        label: 'Wedding Website Builder',
        desc: 'Modular sections, live preview & publishing controls',
      },
      {
        href: '/digital-wedding-invitations',
        label: 'Digital Invitations',
        desc: 'Precision canvas stationery & mobile cards',
      },
      {
        href: '/pricing',
        label: 'Simple Event Pricing',
        desc: '$5.00 USD one-time per wedding · 12 months access',
      },
    ],
    relatedPostSlugs: ['digital-wedding-invitations-guide', 'best-software-for-wedding-planners'],
  },
  {
    id: 'wedding-reception-guest-experience-ideas',
    slug: 'wedding-reception-guest-experience-ideas',
    title: 'Interactive Wedding Reception Ideas: Live Photo Walls, Digital Guestbooks & Moderation',
    seoTitle: 'Interactive Wedding Reception Display & Guestbook Ideas | EventFrame',
    description:
      'Turn dinner and dancing into an interactive celebration with QR-code digital guestbooks, moderated live ballroom photo walls, VIP highlight wishes, and editorial projector themes.',
    excerpt:
      'Paper guestbooks collect ten signatures by the coat check. Live moderated reception displays invite every table to share photos and toasts that light up the ballroom.',
    category: 'Reception Experience',
    publishedAt: '2026-10-29',
    updatedAt: '2026-11-09',
    readingTimeMinutes: 7,
    authorName: 'EventFrame Editorial Team',
    authorRole: 'Live Event Technology',
    coverImage: '/images/seo/wedding-reception-live-display.webp',
    coverImageWidth: 1200,
    coverImageHeight: 670,
    coverImageAlt: 'Luxury ballroom wedding reception showcasing a live moderated guest photo and wishes wall',
    keywords: [
      'wedding reception display',
      'live wedding photo wall',
      'digital wedding guestbook',
      'interactive wedding reception ideas',
    ],
    sections: [
      {
        id: 'why-table-qr-works',
        heading: 'Why Table QR Guestbooks Outperform Entrance Sign-In Books',
        paragraphs: [
          'Guests rarely leave conversations during cocktail hour to wait in line beside a traditional bound book. Placing a minimalist QR card at each table setting lets guests capture candid dinner moments and heartfelt toasts right from their seat without downloading any app.',
        ],
      },
      {
        id: 'moderation-and-priority',
        heading: 'Keeping the Screen Editorial With Moderation & Highlighting',
        paragraphs: [
          'Luxury weddings require curation. With live queue moderation, planners or designated bridal party members tap Approve from a phone before photos or wishes reach the ballroom projector or LED wall.',
          'Better still, Priority Highlighting lets couples pin parent toasts, mark VIP Special Guest wishes, and feature standout notes on screen while preserving every candid submission in a permanent wedding archive.',
        ],
        bullets: [
          'Works on any Mac, Windows, or smart TV connected via HDMI or AirPlay',
          'Supports Masonry Stream, Hanging Garden, Floating Cosmos, and Editorial Grid layouts',
          'Interactive live demo rooms let couples and studios preview the experience instantly',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can we test the live reception wall before the wedding?',
        a: 'Yes. Open our live Display Wall and Guest portal anytime to preview real-time wish animations and theme layouts.',
      },
      {
        q: 'What if a guest posts a blurry photo by accident?',
        a: 'Keep manual moderation enabled so every photo and message waits in your private approval queue before projecting onto the reception screen.',
      },
    ],
    relatedToolLinks: [
      {
        href: '/wedding-reception-display',
        label: 'Live Reception Displays',
        desc: 'Real-time ballroom photo wall & QR guestbook',
      },
      {
        href: '/wedding-guest-management',
        label: 'Guest Moderation',
        desc: 'Approve messages, highlight VIP wishes & archive photos',
      },
      {
        href: '/templates',
        label: 'Display Themes',
        desc: 'Preview 8+ curated visual display themes',
      },
    ],
    relatedPostSlugs: ['best-software-for-wedding-planners', 'how-to-organize-wedding-guest-list'],
  },
  {
    id: 'best-software-for-wedding-planners',
    slug: 'best-software-for-wedding-planners',
    title: 'How Modern Wedding Planners Choose All-in-One Studio Software',
    seoTitle: 'Best Software for Wedding Planners & Studios (2026 Guide) | EventFrame',
    description:
      'Evaluate wedding planning software for multi-client studios: white-label branding, custom subdomains, pay-per-event economics, seating floor plans, and couple portals.',
    excerpt:
      'Wedding agencies lose dozens of hours monthly stitching together invitation tools, spreadsheet RSVPs, seating diagrams, and photo apps. Here is what to demand from a modern wedding OS.',
    category: 'Planner Operations',
    publishedAt: '2026-11-01',
    updatedAt: '2026-11-10',
    readingTimeMinutes: 8,
    authorName: 'EventFrame Editorial Team',
    authorRole: 'Studio Workflows & Agency Strategy',
    coverImage: '/images/seo/eventframe-wedding-platform-showcase.webp',
    coverImageWidth: 1200,
    coverImageHeight: 670,
    coverImageAlt: 'EventFrame all-in-one wedding agency software interface showing websites, seating, and moderation',
    keywords: [
      'wedding planner software',
      'all-in-one wedding planning software',
      'white label wedding software',
      'wedding studio management platform',
    ],
    sections: [
      {
        id: 'cost-of-tool-sprawl',
        heading: 'The Hidden Operational Cost of Tool Sprawl',
        paragraphs: [
          'When an agency manages twelve concurrent weddings across five disconnected software subscriptions, every RSVP update has to be copied manually into seating tools, caterer sheets, and couple email recaps. One missed dietary revision or wrong shuttle count damages studio reputation.',
        ],
      },
      {
        id: 'agency-evaluation-checklist',
        heading: '6 Essential Capabilities for Professional Wedding Studios',
        paragraphs: [
          'When comparing wedding management platforms for your studio roster, prioritize architecture built for agencies rather than single-couple consumer templates:',
        ],
        bullets: [
          'White-label agency subdomains (yourstudio.eventframe.io) with zero third-party ads',
          'Multi-wedding command center calendar with instant project switching',
          'Couples-only PIN access portals so clients review RSVPs and moderate walls safely',
          'Integrated website builder, digital stationery canvas, and conditional RSVP forms',
          'Real-dimension venue floor plan and seating chart planner in meters or feet',
          'Pay-per-event pricing ($5.00 USD / 12 months per wedding) instead of bloated monthly retainers during off-peak seasons',
        ],
      },
    ],
    faqs: [
      {
        q: 'Do wedding planners pay monthly retainers during slow seasons?',
        a: 'No. With EventFrame, agency registration and draft creation are free—you pay $5.00 USD one-time per active wedding event for 12 months of full access.',
      },
      {
        q: 'Can each couple in our studio have a completely different visual aesthetic?',
        a: 'Yes. Every client event carries its own color palette, typography pairing, website sections, and reception display theme.',
      },
    ],
    relatedToolLinks: [
      {
        href: '/wedding-planner-software',
        label: 'Wedding Planner Software',
        desc: 'Multi-wedding workspace & calendar command center',
      },
      {
        href: '/white-label-wedding-software',
        label: 'White-Label Software',
        desc: 'Custom agency subdomains & private couple PIN portals',
      },
      {
        href: '/pricing',
        label: 'Pay-Per-Event Pricing',
        desc: '$5.00 USD per wedding · zero monthly lock-in',
      },
    ],
    relatedPostSlugs: ['wedding-seating-chart-guide', 'wedding-website-vs-digital-invitation'],
  },
  {
    id: 'how-to-organize-wedding-guest-list',
    slug: 'how-to-organize-wedding-guest-list',
    title: 'How to Organize Your Wedding Guest List, Households, VIPs & Dietary Needs',
    seoTitle: 'How to Organize a Wedding Guest List & Dietary Needs | EventFrame',
    description:
      'A clean framework for structuring wedding guest lists by household group, VIP priority status, attendance stage, dietary tags, and table readiness.',
    excerpt:
      'Before invitations go out or tables are drawn, a well-structured guest directory prevents duplicate invites, missed plus-ones, and last-minute seating scrambles.',
    category: 'RSVP & Guest Lists',
    publishedAt: '2026-11-04',
    updatedAt: '2026-11-11',
    readingTimeMinutes: 7,
    authorName: 'EventFrame Editorial Team',
    authorRole: 'Guest Experience Architecture',
    coverImage: '/images/seo/editorial-wedding-couple-showcase.webp',
    coverImageWidth: 1200,
    coverImageHeight: 896,
    coverImageAlt: 'Editorial wedding couple celebration supported by organized guest and seating management',
    keywords: [
      'how to organize wedding guest list',
      'wedding guest list management',
      'VIP wedding guests',
      'wedding household grouping',
    ],
    sections: [
      {
        id: 'household-structure',
        heading: 'Think in Households and Groups, Not Just Flat Rows',
        paragraphs: [
          'Treating every attendee as an isolated spreadsheet row breaks down the moment invitations, children, or seating assignments enter the picture. Grouping guests by household or social circle keeps addresses, plus-ones, and group seating aligned cleanly.',
        ],
        bullets: [
          'Assign clear group labels (e.g., Bride Family, Groom College Friends, VIP Parents)',
          'Tag VIP guests intentionally so ushers, photographers, and live message displays recognize priority guests',
          'Track dietary flags and allergies directly on the guest profile rather than buried in notes',
        ],
      },
      {
        id: 'vip-and-couple-collaboration',
        heading: 'Collaborating Smoothly Between Planner & Couple',
        paragraphs: [
          'Instead of emailing "GuestList_v14_FINAL.xlsx" back and forth, share a live PIN-protected Couple Portal connected directly to the planner workspace. Both sides stay aligned on confirmed headcount, table readiness, and reception notes in real time.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Can we designate VIP guests in EventFrame?',
        a: 'Yes. Designated VIP guests stay synced across your guest roster and receive Special Guest priority treatment on the live reception display when they share wishes.',
      },
      {
        q: 'How do we share the finalized guest roster with caterers?',
        a: 'Export the full guest list and dietary preferences straight to CSV in one click from Guest Management.',
      },
    ],
    relatedToolLinks: [
      {
        href: '/wedding-guest-management',
        label: 'Wedding Guest Management',
        desc: 'Groups, VIP tags, RSVPs & CSV exports',
      },
      {
        href: '/wedding-seating-chart',
        label: 'Seating Chart Planner',
        desc: 'Assign households & guests onto ballroom floor plans',
      },
      {
        href: '/wedding-rsvp-management',
        label: 'RSVP Questionnaires',
        desc: 'Automated attendance & dietary collection',
      },
    ],
    relatedPostSlugs: ['how-to-manage-wedding-rsvps', 'wedding-seating-chart-guide'],
  },
];
