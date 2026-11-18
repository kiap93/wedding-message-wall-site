import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import {
  submitContactInquiry,
  validateContactSubmission,
  listContactInquiries,
  getContactInquiryById,
  updateContactInquiry,
  resetContactRateLimitStore,
  CONTACT_ENQUIRY_CATEGORIES,
} from '../server/contactService';
import { validateCookieMutationCsrf } from '../server/apiResponse';
import { resolveRouteMetadata } from '../src/seo/routes';
import { buildCanonicalUrl, buildLocalizedRoutePath } from '../src/seo/canonical';
import { buildSitemapXml } from '../src/seo/sitemap';
import { shouldServeCleanAppShell } from '../src/seo/appShell';
import { MarketingTranslationProvider } from '../src/lib/i18n/MarketingTranslationContext';
import ContactPage from '../src/pages/ContactPage';
import workerApp from '../worker/index';

function createInMemoryContactSupabase() {
  const rows: any[] = [];
  const activityLogs: any[] = [];
  let seq = 1;

  function matchesFilters(row: any, filters: Array<{ col: string; val: any }>) {
    return filters.every((f) => row[f.col] === f.val);
  }

  return {
    rows,
    activityLogs,
    from(table: string) {
      if (table === 'platform_activity_logs') {
        return {
          insert(payload: any) {
            const items = Array.isArray(payload) ? payload : [payload];
            for (const item of items) {
              activityLogs.push({ id: `log-${activityLogs.length + 1}`, ...item });
            }
            return Promise.resolve({ data: items, error: null });
          },
        };
      }

      if (table === 'contact_inquiries') {
        const filters: Array<{ col: string; val: any }> = [];
        let orderCol: string | null = null;
        let orderAsc = true;

        const builder: any = {
          select() {
            return builder;
          },
          eq(col: string, val: any) {
            filters.push({ col, val });
            return builder;
          },
          order(col: string, opts?: { ascending?: boolean }) {
            orderCol = col;
            orderAsc = opts?.ascending !== false;
            return builder;
          },
          insert(payload: any) {
            const now = new Date(Date.now() + seq * 1000).toISOString();
            const record = {
              id: `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`,
              internal_notes: null,
              notification_error: null,
              created_at: now,
              updated_at: now,
              ...payload,
            };
            rows.push(record);
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: { ...record }, error: null });
                  },
                };
              },
            };
          },
          update(patch: any) {
            const updateFilters: Array<{ col: string; val: any }> = [];
            const applyPatch = () => {
              const matched = rows.filter((r) => matchesFilters(r, updateFilters));
              for (const r of matched) {
                Object.assign(r, patch);
              }
              return matched[0] ? { ...matched[0] } : null;
            };
            const updateChain: any = {
              eq(col: string, val: any) {
                updateFilters.push({ col, val });
                return updateChain;
              },
              select() {
                return {
                  single() {
                    const updated = applyPatch();
                    return Promise.resolve({
                      data: updated,
                      error: updated ? null : { message: 'Not found' },
                    });
                  },
                };
              },
              then(resolve: any, reject: any) {
                const updated = applyPatch();
                return Promise.resolve({ data: updated, error: null }).then(resolve, reject);
              },
              catch(fn: any) {
                return Promise.resolve({ data: null, error: null }).catch(fn);
              },
            };
            return updateChain;
          },
          maybeSingle() {
            const found = rows.find((r) => matchesFilters(r, filters)) || null;
            return Promise.resolve({ data: found ? { ...found } : null, error: null });
          },
          then(resolve: any, reject: any) {
            let result = rows.filter((r) => matchesFilters(r, filters)).map((r) => ({ ...r }));
            if (orderCol) {
              result.sort((a, b) => {
                const cmp = String(a[orderCol!]).localeCompare(String(b[orderCol!]));
                return orderAsc ? cmp : -cmp;
              });
            }
            return Promise.resolve({ data: result, error: null }).then(resolve, reject);
          },
        };
        return builder;
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

async function runTests() {
  console.log('Running Contact Page, Resend Dual Email, Admin API & SEO tests...');
  resetContactRateLimitStore();

  // 1. Validation & Honeypot Checks
  assert.equal(CONTACT_ENQUIRY_CATEGORIES.length, 4);

  const missingCheck = validateContactSubmission({
    name: '',
    email: 'bad-email',
    enquiryType: 'unknown_cat',
    subject: '',
    message: 'short',
  });
  assert.equal(missingCheck.ok, false);
  if (missingCheck.ok === false) {
    assert.equal(missingCheck.statusCode, 400);
    assert.ok((missingCheck.issues || []).length >= 4);
  }

  const spamCheck = validateContactSubmission({
    name: 'Spam Bot',
    email: 'bot@spam.example',
    enquiryType: 'general',
    subject: 'Buy links',
    message: 'Click this promotional message right now!',
    website: 'https://spam.example',
  });
  assert.equal(spamCheck.ok, false);
  if (spamCheck.ok === false) {
    assert.equal(spamCheck.code, 'SPAM_DETECTED');
  }

  // 2. Dual Email Sending via Mocked Resend API (Admin + Customer Ack) + Sanitization
  const db = createInMemoryContactSupabase();
  const capturedEmails: any[] = [];

  const mockResendFetch: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body || '{}'));
    capturedEmails.push(body);
    return new Response(JSON.stringify({ id: `re_msg_${capturedEmails.length}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const submitRes = await submitContactInquiry(
    {
      supabase: db,
      resendApiKey: 're_test_secret_key',
      clientIp: '203.0.113.10',
      fetchImpl: mockResendFetch,
    },
    {
      name: 'Jane Doe\r\nBcc: attacker@evil.com',
      email: 'Jane.Doe@Studio.com',
      enquiryType: 'technical_support',
      subject: 'Cannot open seating layout\r\nCc: hijack@evil.com',
      eventName: 'Celia & Elias <script>alert(1)</script>',
      message: 'Hello team,\nWe saw <img src=x onerror=alert(1)> in the layout preview. Please check.',
      website: '',
    }
  );

  assert.equal(submitRes.ok, true);
  if (submitRes.ok) {
    assert.equal(submitRes.statusCode, 201);
    assert.equal(
      submitRes.message,
      "Thank you for reaching out! Your message has been sent successfully. Our team will get back to you as soon as possible."
    );
    assert.equal(submitRes.inquiry.status, 'NEW');
    assert.equal(submitRes.inquiry.adminNotificationSent, true);
    assert.equal(submitRes.inquiry.customerAckSent, true);
  }

  assert.equal(capturedEmails.length, 2, 'Expected exactly 2 emails (admin + customer ack)');

  const adminEmail = capturedEmails[0];
  assert.equal(adminEmail.from, 'EventFrame <noreply@eventframe.io>');
  assert.deepEqual(adminEmail.to, ['eventframeio@gmail.com']);
  assert.deepEqual(adminEmail.reply_to, ['jane.doe@studio.com']);
  assert.equal(adminEmail.cc, undefined, 'Admin notification must NOT CC eventframeio@gmail.com or anyone else');
  assert.ok(!adminEmail.subject.includes('\r') && !adminEmail.subject.includes('\n'), 'CRLF injection must be stripped');
  assert.ok(adminEmail.subject.startsWith('[EventFrame Contact] Technical Support – Cannot open seating layout'));
  assert.ok(adminEmail.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'HTML must escape eventName');
  assert.ok(adminEmail.html.includes('&lt;img src=x onerror=alert(1)&gt;'), 'HTML must escape message');

  const customerAck = capturedEmails[1];
  assert.equal(customerAck.from, 'EventFrame <noreply@eventframe.io>');
  assert.deepEqual(customerAck.to, ['jane.doe@studio.com']);
  assert.equal(customerAck.cc, undefined, 'Customer acknowledgement must NOT CC eventframeio@gmail.com');
  assert.equal((customerAck as any).bcc, undefined, 'Customer acknowledgement must NOT BCC anyone');
  assert.equal(customerAck.subject, "We've received your message – EventFrame");
  assert.ok(customerAck.text.includes('Thank you for contacting EventFrame!'));
  assert.ok(customerAck.text.includes('https://eventframe.io'));

  // 3. Notification Failure Resilience: DB Record Preserved!
  const failingFetch: typeof fetch = async () => {
    return new Response(JSON.stringify({ message: 'Resend 500 internal error' }), { status: 500 });
  };

  const failRes = await submitContactInquiry(
    {
      supabase: db,
      resendApiKey: 're_test_secret_key',
      clientIp: '203.0.113.11',
      fetchImpl: failingFetch,
    },
    {
      name: 'Mark Smith',
      email: 'mark@agency.io',
      enquiryType: 'billing',
      subject: 'Invoice receipt needed',
      message: 'Please resend our receipt for our recent $5 event activation.',
    }
  );

  assert.equal(failRes.ok, false);
  if (failRes.ok === false) {
    assert.equal(failRes.statusCode, 502);
    assert.equal(failRes.saved, true, 'Enquiry must be preserved in DB even when Resend fails');
    assert.ok(failRes.inquiryId);
    assert.ok(!failRes.error.includes('re_test_secret_key'));
  }
  assert.equal(db.rows.length, 2, 'Both inquiries must remain persisted in database');

  // 4. Rate Limiting Enforcement
  resetContactRateLimitStore();
  for (let i = 0; i < 6; i++) {
    const r = await submitContactInquiry(
      {
        supabase: db,
        resendApiKey: 're_test_secret_key',
        clientIp: '198.51.100.77',
        fetchImpl: mockResendFetch,
      },
      {
        name: `User ${i}`,
        email: `user${i}@example.com`,
        enquiryType: 'general',
        subject: `Inquiry ${i}`,
        message: 'Checking rate limiting threshold cleanly across requests.',
      }
    );
    assert.equal(r.ok, true);
  }
  const rateLimited = await submitContactInquiry(
    {
      supabase: db,
      resendApiKey: 're_test_secret_key',
      clientIp: '198.51.100.77',
      fetchImpl: mockResendFetch,
    },
    {
      name: 'User 7',
      email: 'user7@example.com',
      enquiryType: 'general',
      subject: 'Inquiry 7',
      message: 'This 7th request from same IP should hit the rate limiter.',
    }
  );
  assert.equal(rateLimited.ok, false);
  if (rateLimited.ok === false) {
    assert.equal(rateLimited.statusCode, 429);
    assert.equal(rateLimited.code, 'RATE_LIMITED');
  }

  // 5. Admin Listing, Filtering & Triage Update
  const billingList = await listContactInquiries(db, { enquiryType: 'billing' });
  assert.equal(billingList.total, 1);
  assert.equal(billingList.items[0].email, 'mark@agency.io');
  assert.equal(billingList.items[0].adminNotificationSent, false);

  const fetchedOne = await getContactInquiryById(db, billingList.items[0].id);
  assert.ok(fetchedOne);
  assert.equal(fetchedOne?.subject, 'Invoice receipt needed');

  const updateRes = await updateContactInquiry(
    db,
    billingList.items[0].id,
    { status: 'IN_PROGRESS', internalNotes: 'Sent PDF receipt manually.' },
    { id: 'admin-1', email: 'admin@eventframe.io', role: 'super_admin' }
  );
  assert.equal(updateRes.ok, true);
  if (updateRes.ok) {
    assert.equal(updateRes.inquiry.status, 'IN_PROGRESS');
    assert.equal(updateRes.inquiry.internalNotes, 'Sent PDF receipt manually.');
  }
  assert.equal(db.activityLogs[0]?.action, 'CONTACT_INQUIRY_UPDATED');

  // 6. Security: CSRF Exemption for Logged-in Users + Worker Developer Endpoint RBAC
  const csrfCheck = validateCookieMutationCsrf({
    method: 'POST',
    path: '/api/contact',
    hasSessionCookie: true,
    hasBearerToken: false,
    hasEventPin: false,
  });
  assert.equal(csrfCheck.ok, true, 'Logged-in visitors should be able to POST /api/contact');

  const unauthAdminReq = await workerApp.request('http://localhost/api/developer/contact-enquiries', {
    method: 'GET',
  });
  assert.equal(unauthAdminReq.status, 401, 'Unauthenticated admin contact enquiry access must be 401');

  // 7. SEO, Sitemap, AppShell & SSR Rendering Check
  const contactSeo = resolveRouteMetadata('/contact');
  assert.equal(contactSeo.meta.title, 'Contact Us | EventFrame');
  assert.equal(
    contactSeo.meta.description,
    'Get in touch with EventFrame for event planning support, technical assistance, business partnerships and billing enquiries.'
  );
  assert.equal(buildCanonicalUrl('/contact'), 'https://eventframe.io/contact');
  assert.equal(buildLocalizedRoutePath('/contact', 'zh-CN'), '/zh-cn/contact');
  assert.equal(buildLocalizedRoutePath('/contact', 'zh-TW'), '/zh-tw/contact');
  assert.equal(buildLocalizedRoutePath('/contact', 'ms'), '/ms/contact');
  assert.equal(shouldServeCleanAppShell('/contact'), false);
  assert.equal(shouldServeCleanAppShell('/zh-cn/contact'), false);

  const sitemapXml = buildSitemapXml();
  assert.ok(sitemapXml.includes('<loc>https://eventframe.io/contact</loc>'));
  assert.ok(sitemapXml.includes('<loc>https://eventframe.io/zh-cn/contact</loc>'));

  const ssrMarkup = renderToString(
    React.createElement(
      StaticRouter,
      { location: '/contact' },
      React.createElement(
        MarketingTranslationProvider,
        { initialLanguage: 'en', children: React.createElement(ContactPage) }
      )
    )
  );
  assert.ok(ssrMarkup.includes("Let&#x27;s Make Your Event Unforgettable.") || ssrMarkup.includes("Let's Make Your Event Unforgettable."));
  assert.ok(ssrMarkup.includes('General Enquiries'));
  assert.ok(ssrMarkup.includes('Technical Support'));
  assert.ok(ssrMarkup.includes('Business Partnerships'));
  assert.ok(ssrMarkup.includes('Billing &amp; Payments'));
  assert.ok(ssrMarkup.includes('Send Message'));

  console.log('✅ All Contact Page, Resend Email, Admin API & SEO tests passed!');
}

runTests().catch((err) => {
  console.error('❌ Contact Page test suite failed:', err);
  process.exit(1);
});
