import { describe, it } from 'node:test';
import assert from 'node:assert';
import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';
import { isEventActive } from '../src/lib/packages';
import { createDefaultWebsiteConfig } from '../src/website-builder/presets';
import { WebsiteConfig } from '../src/website-builder/types';

const TEST_API_BASE = 'http://localhost:3000';

function getTestSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:54321';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'anon';
  return createClient(url, key);
}

describe('Phase 4: Wedding Website Publishing, SEO & Lifecycle Test Suite', () => {
  const supabase = getTestSupabase();
  const testRunId = `p4_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  let testAgencyId: string;
  let unpaidProjectId: string;
  let paidProjectId: string;
  const paidSlug = `pub-test-${testRunId}`;
  const unpaidSlug = `unpaid-test-${testRunId}`;

  it('1. Sets up test agency and projects (unpaid vs paid)', async () => {
    // Create test agency
    const { data: agency, error: agencyErr } = await supabase
      .from('agencies')
      .insert({
        name: `Phase 4 Agency ${testRunId}`,
        slug: `agency-${testRunId}`,
        user_id: `user_${testRunId}`,
        user_role: 'couple',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    assert.ok(!agencyErr, `Agency creation failed: ${agencyErr?.message}`);
    testAgencyId = agency.id;

    // Create unpaid project
    const { data: unpaidProj, error: unpaidErr } = await supabase
      .from('projects')
      .insert({
        name: 'Unpaid Wedding',
        slug: unpaidSlug,
        agency_id: testAgencyId,
        groom_name: 'Alex',
        bride_name: 'Sam',
        wedding_date: '2026-10-15',
        location: 'Monterey, CA',
        status: 'draft',
        payment_status: 'unpaid',
        package_id: 'standard',
        access_password: 'PIN_UNPAID',
        website_status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    assert.ok(!unpaidErr, `Unpaid project creation failed: ${unpaidErr?.message}`);
    unpaidProjectId = unpaidProj.id;

    // Create paid project (active 12-month license)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 12);

    const { data: paidProj, error: paidErr } = await supabase
      .from('projects')
      .insert({
        name: 'Paid Wedding Celebration',
        slug: paidSlug,
        agency_id: testAgencyId,
        groom_name: 'Arthur',
        bride_name: 'Genevieve',
        wedding_date: '2026-12-31',
        location: 'Carmel Valley, CA',
        status: 'active',
        payment_status: 'paid',
        package_id: 'standard',
        expires_at: expiresAt.toISOString(),
        access_password: 'PIN_PAID_OK',
        website_status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    assert.ok(!paidErr, `Paid project creation failed: ${paidErr?.message}`);
    paidProjectId = paidProj.id;

    // Verify eligibility check via isEventActive
    assert.strictEqual(isEventActive(unpaidProj, agency), false, 'Unpaid event must be inactive');
    assert.strictEqual(isEventActive(paidProj, agency), true, 'Paid event must be active');
  });

  it('2. Enforces Pay-Per-Event validation: Unpaid event cannot publish (HTTP 402)', async () => {
    const draftConfig = createDefaultWebsiteConfig({
      id: unpaidProjectId,
      name: 'Unpaid Wedding',
      groom_name: 'Alex',
      bride_name: 'Sam',
      slug: unpaidSlug
    } as any);

    const res = await fetch(`${TEST_API_BASE}/api/projects/${unpaidProjectId}/website/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-event-pin': 'PIN_UNPAID'
      },
      body: JSON.stringify({ website_config: draftConfig })
    });

    assert.strictEqual(res.status, 402, 'Should reject publishing unpaid event with HTTP 402 Payment Required');
    const body = await res.json();
    assert.strictEqual(body.code, 'PAYMENT_REQUIRED');
  });

  it('3. Publishes paid event: Separates draft and immutable published snapshots', async () => {
    const initialConfig = createDefaultWebsiteConfig({
      id: paidProjectId,
      name: 'Paid Wedding Celebration',
      groom_name: 'Arthur',
      bride_name: 'Genevieve',
      slug: paidSlug
    } as any);

    // Customize announcement text in draft
    initialConfig.preferences.announcementText = 'First Published Version';
    initialConfig.seo.pageTitle = 'Arthur & Genevieve Wedding | Official Site';
    initialConfig.seo.metaDescription = 'Join us in Carmel Valley for our romantic wedding celebration.';

    const res = await fetch(`${TEST_API_BASE}/api/projects/${paidProjectId}/website/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-event-pin': 'PIN_PAID_OK'
      },
      body: JSON.stringify({ website_config: initialConfig })
    });

    assert.strictEqual(res.status, 200, 'Publishing paid event should succeed');
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.status, 'published');
    assert.ok(body.publishedAt);
    assert.strictEqual(body.publicUrl, `/${paidSlug}/website`);

    // Verify in database
    const { data: dbProj } = await supabase
      .from('projects')
      .select('website_status, website_published_at, website_published_config, website_config')
      .eq('id', paidProjectId)
      .single();

    assert.strictEqual(dbProj.website_status, 'published');
    assert.ok(dbProj.website_published_at);
    assert.strictEqual(dbProj.website_published_config.preferences.announcementText, 'First Published Version');
  });

  it('4. Public Guest API returns published configuration without leaking unpublished draft edits', async () => {
    // Simulate author editing draft in Studio WITHOUT re-publishing
    const updatedDraftConfig: WebsiteConfig = createDefaultWebsiteConfig({
      id: paidProjectId,
      name: 'Paid Wedding Celebration',
      groom_name: 'Arthur',
      bride_name: 'Genevieve',
      slug: paidSlug
    } as any);
    updatedDraftConfig.preferences.announcementText = 'Draft In Progress - DO NOT SHOW GUESTS YET';

    await supabase
      .from('projects')
      .update({ website_config: updatedDraftConfig })
      .eq('id', paidProjectId);

    // Guest visits public website endpoint
    const guestRes = await fetch(`${TEST_API_BASE}/api/events/${paidSlug}/website-data`);
    assert.strictEqual(guestRes.status, 200);

    const guestData = await guestRes.json();
    assert.strictEqual(guestData.status, 'published');
    assert.strictEqual(guestData.published, true);
    assert.strictEqual(guestData.isPreview, false);
    // CRITICAL: Public guest MUST see published snapshot ("First Published Version"), NOT unapproved draft
    assert.strictEqual(
      guestData.config.preferences.announcementText,
      'First Published Version',
      'Public guests must receive immutable website_published_config snapshot'
    );
  });

  it('5. Secret Draft Preview Token allows authorized preview of working draft', async () => {
    // Generate preview token
    const tokenRes = await fetch(`${TEST_API_BASE}/api/projects/${paidProjectId}/website/preview-token`, {
      method: 'POST',
      headers: {
        'x-event-pin': 'PIN_PAID_OK'
      }
    });
    assert.strictEqual(tokenRes.status, 200);
    const tokenData = await tokenRes.json();
    assert.ok(tokenData.previewToken);
    assert.ok(tokenData.previewUrl.includes(tokenData.previewToken));

    // Access public endpoint WITH valid preview token
    const previewRes = await fetch(`${TEST_API_BASE}/api/events/${paidSlug}/website-data?token=${tokenData.previewToken}`);
    assert.strictEqual(previewRes.status, 200);
    const previewData = await previewRes.json();
    assert.strictEqual(previewData.isPreview, true);
    // In preview mode, user sees current draft
    assert.strictEqual(previewData.config.preferences.announcementText, 'Draft In Progress - DO NOT SHOW GUESTS YET');

    // Access with INVALID preview token
    const invalidRes = await fetch(`${TEST_API_BASE}/api/events/${unpaidSlug}/website-data?token=invalid_token_12345`);
    const invalidData = await invalidRes.json();
    assert.strictEqual(invalidData.isPreview, false);
    assert.strictEqual(invalidData.published, false);
  });

  it('6. Unpublishing website takes it offline gracefully while preserving configs', async () => {
    const unpublishRes = await fetch(`${TEST_API_BASE}/api/projects/${paidProjectId}/website/unpublish`, {
      method: 'POST',
      headers: {
        'x-event-pin': 'PIN_PAID_OK'
      }
    });

    assert.strictEqual(unpublishRes.status, 200);
    const unpublishData = await unpublishRes.json();
    assert.strictEqual(unpublishData.success, true);
    assert.strictEqual(unpublishData.status, 'unpublished');

    // Public guest fetching website data now receives polite offline response
    const guestRes = await fetch(`${TEST_API_BASE}/api/events/${paidSlug}/website-data`);
    assert.strictEqual(guestRes.status, 200);
    const guestData = await guestRes.json();
    assert.strictEqual(guestData.status, 'unpublished');
    assert.strictEqual(guestData.published, false);
    assert.strictEqual(guestData.isPreview, false);
    assert.ok(guestData.error.includes('unpublished'));
  });

  it('7. Dynamic XML Sitemap includes published websites and excludes drafts / unpub / noIndex', async () => {
    // 1. Re-publish paid project
    const config = createDefaultWebsiteConfig({
      id: paidProjectId,
      name: 'Paid Wedding Celebration',
      slug: paidSlug
    } as any);
    config.seo.noIndex = false;

    await fetch(`${TEST_API_BASE}/api/projects/${paidProjectId}/website/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-event-pin': 'PIN_PAID_OK'
      },
      body: JSON.stringify({ website_config: config })
    });

    // 2. Fetch /sitemap.xml
    const sitemapRes = await fetch(`${TEST_API_BASE}/sitemap.xml`);
    assert.strictEqual(sitemapRes.status, 200);
    const contentType = sitemapRes.headers.get('content-type') || '';
    assert.ok(contentType.includes('xml'), `Content-Type should be XML, got: ${contentType}`);

    const xml = await sitemapRes.text();
    assert.ok(xml.includes('<urlset'), 'Sitemap must contain <urlset>');
    assert.ok(xml.includes(`/${paidSlug}/website`), `Sitemap should include published slug: ${paidSlug}`);
    assert.ok(!xml.includes(`/${unpaidSlug}/website`), `Sitemap must NOT include unpaid draft slug: ${unpaidSlug}`);

    // 3. Test noIndex toggle exclusion
    config.seo.noIndex = true;
    await fetch(`${TEST_API_BASE}/api/projects/${paidProjectId}/website/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-event-pin': 'PIN_PAID_OK'
      },
      body: JSON.stringify({ website_config: config })
    });

    const sitemapNoIndexRes = await fetch(`${TEST_API_BASE}/sitemap.xml`);
    const xmlNoIndex = await sitemapNoIndexRes.text();
    assert.ok(!xmlNoIndex.includes(`/${paidSlug}/website`), 'Sitemap must exclude website when seo.noIndex is true');
  });

  it('8. Cleans up test artifacts', async () => {
    await supabase.from('projects').delete().in('id', [unpaidProjectId, paidProjectId]);
    await supabase.from('agencies').delete().eq('id', testAgencyId);
  });
});
