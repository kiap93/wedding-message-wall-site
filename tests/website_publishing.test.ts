import { createDefaultWebsiteConfig, WEBSITE_TEMPLATES } from '../src/website-builder/presets';
import { useWebsiteStore } from '../src/website-builder/store/websiteStore';
import { WeddingEvent } from '../src/types';
import { isEventActive, add12CalendarMonths } from '../src/lib/packages';
import { EVENT_PRICING, formatPrice } from '../config/pricing';

async function runTests() {
  console.log('🧪 Starting Website Publishing, SEO & Lifecycle Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const mockActiveProject: WeddingEvent = {
    id: 'test-event-pub-1',
    agency_id: 'agency-1',
    name: 'Arthur & Genevieve Wedding',
    slug: 'arthur-genevieve',
    groom_name: 'Arthur',
    bride_name: 'Genevieve',
    wedding_date: '2026-10-24',
    location: 'Carmel Valley, CA',
    theme_id: 'minimal_luxury',
    image_url: 'https://images.unsplash.com/photo-1519741497674-611481863552',
    status: 'active',
    payment_status: 'paid',
    package_id: 'standard',
    expires_at: add12CalendarMonths(new Date().toISOString()),
    access_password: 'PIN_TEST_123',
    website_status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockUnpaidProject: WeddingEvent = {
    ...mockActiveProject,
    id: 'test-event-unpaid',
    slug: 'unpaid-wedding',
    status: 'draft',
    payment_status: 'unpaid',
    expires_at: undefined,
    website_status: 'draft'
  };

  // TEST GROUP 1: Default SEO Configuration & Presets
  console.log('--- Test Group 1: Default SEO Configuration & Presets ---');
  const defaultConfig = createDefaultWebsiteConfig(mockActiveProject);

  assert(Boolean(defaultConfig.seo), 'Website config contains seo configuration object');
  assert(
    Boolean(defaultConfig.seo?.pageTitle?.includes('Arthur & Genevieve')),
    'Default pageTitle dynamically includes couple names'
  );
  assert(
    Boolean(defaultConfig.seo?.metaDescription?.includes('Arthur') && defaultConfig.seo?.metaDescription?.includes('Genevieve') && defaultConfig.seo?.metaDescription?.includes('Carmel Valley')),
    'Default metaDescription includes names and location'
  );
  assert(
    defaultConfig.seo?.ogTitle === defaultConfig.seo?.pageTitle,
    'Open Graph title matches pageTitle by default'
  );
  assert(
    defaultConfig.seo?.noIndex === false,
    'Default search indexing preference is set to index (noIndex: false)'
  );

  // TEST GROUP 2: Pay-Per-Event Validation & Publication Eligibility
  console.log('\n--- Test Group 2: Pay-Per-Event Validation & Eligibility ---');
  assert(
    isEventActive(mockActiveProject, null) === true,
    'Active paid project with valid expires_at is eligible to publish'
  );
  assert(
    isEventActive(mockUnpaidProject, null) === false,
    'Unpaid draft project is NOT eligible to publish (requires $5 license)'
  );

  // TEST GROUP 3: Website Store Publishing Actions & Lifecycle
  console.log('\n--- Test Group 3: Website Store Publishing Lifecycle ---');
  useWebsiteStore.getState().init(mockActiveProject);
  let state = useWebsiteStore.getState();

  assert(state.publicationStatus === 'draft', 'Initial store publication status is draft');
  assert(state.isPublishModalOpen === false, 'Publish modal is initially closed');

  // Open modal
  useWebsiteStore.getState().setIsPublishModalOpen(true);
  state = useWebsiteStore.getState();
  assert(state.isPublishModalOpen === true, 'setIsPublishModalOpen(true) opens publish modal');

  // Update SEO configuration
  useWebsiteStore.getState().updateSEO({
    pageTitle: 'Arthur & Genevieve Wedding | Official Celebration',
    metaDescription: 'Celebrate with us under the redwoods in Carmel Valley.',
    noIndex: false
  });
  state = useWebsiteStore.getState();
  assert(
    state.config.seo?.pageTitle === 'Arthur & Genevieve Wedding | Official Celebration',
    'updateSEO updates pageTitle correctly'
  );
  assert(
    state.config.seo?.metaDescription === 'Celebrate with us under the redwoods in Carmel Valley.',
    'updateSEO updates metaDescription correctly'
  );

  // Preview URL Generation
  const previewUrl = await useWebsiteStore.getState().getPreviewUrl();
  assert(
    previewUrl.startsWith('/arthur-genevieve/website?preview=true'),
    'getPreviewUrl returns formatted preview URL with slug and preview query parameter'
  );

  // TEST GROUP 4: Public Guest Access Control Resolution
  console.log('\n--- Test Group 4: Guest Access Control Matrix ---');
  // Scenario A: Published website
  function resolveGuestAccess(websiteStatus: string, hasValidToken: boolean, isOwner: boolean) {
    if (websiteStatus === 'published') {
      return { allowed: true, mode: 'published' };
    }
    if (hasValidToken || isOwner) {
      return { allowed: true, mode: 'preview' };
    }
    return { allowed: false, mode: websiteStatus === 'unpublished' ? 'offline' : 'private' };
  }

  const publishedAccess = resolveGuestAccess('published', false, false);
  assert(publishedAccess.allowed === true && publishedAccess.mode === 'published', 'Public guest can view published site');

  const draftPublicAccess = resolveGuestAccess('draft', false, false);
  assert(draftPublicAccess.allowed === false && draftPublicAccess.mode === 'private', 'Public guest cannot view unpublished draft without token');

  const draftTokenAccess = resolveGuestAccess('draft', true, false);
  assert(draftTokenAccess.allowed === true && draftTokenAccess.mode === 'preview', 'Visitor with preview token can view draft in preview mode');

  const unpubGuestAccess = resolveGuestAccess('unpublished', false, false);
  assert(unpubGuestAccess.allowed === false && unpubGuestAccess.mode === 'offline', 'Public guest sees offline notice when site is unpublished');

  // TEST GROUP 5: Dynamic XML Sitemap Filter
  console.log('\n--- Test Group 5: Dynamic XML Sitemap Filtering ---');
  const sampleProjects = [
    { slug: 'live-wedding-1', website_status: 'published', website_config: { seo: { noIndex: false } } },
    { slug: 'live-wedding-2', website_status: 'published', website_config: { seo: { noIndex: true } } }, // opted out of indexing
    { slug: 'draft-wedding-3', website_status: 'draft', website_config: {} },
    { slug: 'unpub-wedding-4', website_status: 'unpublished', website_config: {} }
  ];

  const sitemapUrls = sampleProjects
    .filter(p => p.website_status === 'published' && p.website_config?.seo?.noIndex !== true)
    .map(p => `/${p.slug}/website`);

  assert(sitemapUrls.length === 1, 'Only published events with noIndex !== true are included in sitemap');
  assert(sitemapUrls[0] === '/live-wedding-1/website', 'live-wedding-1 is correctly included');
  assert(!sitemapUrls.includes('/live-wedding-2/website'), 'Events with noIndex: true are excluded');
  assert(!sitemapUrls.includes('/draft-wedding-3/website'), 'Draft events are excluded');
  assert(!sitemapUrls.includes('/unpub-wedding-4/website'), 'Unpublished events are excluded');

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
