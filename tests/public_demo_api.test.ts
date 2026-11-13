/**
 * Integration Test Suite: Public Demo Messages API (Cloudflare Worker + Shared Core)
 *
 * Tests the live Hono Worker app (worker/index.ts) via app.request(...) and verifies:
 * 1. GET /api/demo/messages returns sample messages (200)
 * 2. Empty demo room automatically initializes sample data
 * 3. Repeated GET requests do not duplicate sample messages
 * 4. POST /api/demo/messages creates a new message (201) & sanitizes input
 * 5. GET /api/demo/messages returns newly submitted messages
 * 6. Missing or invalid name/message/spam is rejected (400) and rate limit enforced (429)
 * 7. Unauthenticated visitors access and use demo without auth headers/cookies
 * 8. Demo messages cannot leak into real events or production rooms
 * 9. Controlled DELETE /api/demo/messages resets cleanly & SSE stream endpoint responds 200
 */

import fs from 'node:fs';
import path from 'node:path';
import workerApp from '../worker/index';
import {
  PUBLIC_DEMO_ROOM_ID,
  resetDemoRoomForTesting
} from '../server/demoMessageCore';
import {
  addDemoGuestMessage,
  getDemoMessagesSnapshot,
  resetPublicDemoRoom
} from '../server/demoMessageService';
import { postMessage } from '../src/lib/api';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✅ PASS: ${message}`);
}

const mockEnv = {
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-secret',
  JWT_SECRET: 'test-jwt',
  APP_URL: 'https://eventframe.io',
  SUPABASE_URL: '',
  VITE_SUPABASE_URL: '',
  SUPABASE_SERVICE_ROLE_KEY: '',
  SUPABASE_SERVICE_KEY: '',
  SUPABASE_SECRET_KEY: '',
  VITE_SUPABASE_ANON_KEY: '',
  STRIPE_SECRET_KEY: '',
  STRIPE_WEBHOOK_SECRET: '',
  GMAIL_USER: '',
  GMAIL_PASS: '',
  RESEND_API_KEY: '',
  GEMINI_API_KEY: ''
};

async function reqWorker(pathAndQuery: string, init: RequestInit = {}) {
  const url = `https://eventframe.io${pathAndQuery}`;
  return await workerApp.request(url, init, mockEnv as any);
}

async function runTests() {
  console.log('🧪 Starting EventFrame Public Demo API Integration Tests...\n');

  resetDemoRoomForTesting(PUBLIC_DEMO_ROOM_ID);

  console.log('--- 1 & 2. GET /api/demo/messages initializes empty room & returns sample messages ---');
  {
    const res = await reqWorker('/api/demo/messages?room=eventframe-public-demo');
    assert(res.status === 200, `GET /api/demo/messages returns 200 (got ${res.status})`);
    const json = await res.json();
    assert(json.success === true, 'Response has success: true');
    assert(json.roomId === PUBLIC_DEMO_ROOM_ID, 'Response includes roomId: eventframe-public-demo');
    assert(Array.isArray(json.messages) && json.messages.length === 6, `Initial room seeded with 6 sample messages (got ${json.messages?.length})`);
    assert(json.messages.every((m: any) => m.isDemoSample === true), 'All initial messages flagged isDemoSample: true');

    // Also test default room when query param omitted
    const defaultRes = await reqWorker('/api/demo/messages');
    assert(defaultRes.status === 200, 'GET /api/demo/messages without ?room defaults to public demo room');
    const defaultJson = await defaultRes.json();
    assert(defaultJson.roomId === PUBLIC_DEMO_ROOM_ID, 'Default roomId matches PUBLIC_DEMO_ROOM_ID');
  }

  console.log('\n--- 3. Repeated GET requests do not duplicate sample messages ---');
  {
    const res1 = await reqWorker('/api/demo/messages?room=eventframe-public-demo');
    const res2 = await reqWorker('/api/demo/messages?room=eventframe-public-demo');
    const data1 = await res1.json();
    const data2 = await res2.json();
    assert(data1.messages.length === 6 && data2.messages.length === 6, 'Message count remains 6 across repeated GET calls');
    assert(
      data1.messages.map((m: any) => m.id).join(',') === data2.messages.map((m: any) => m.id).join(','),
      'Sample message IDs are identical and not duplicated'
    );
  }

  console.log('\n--- 4 & 5. POST /api/demo/messages creates message (201) & GET returns it ---');
  {
    const postRes = await reqWorker('/api/demo/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '203.0.113.10'
      },
      body: JSON.stringify({
        roomId: PUBLIC_DEMO_ROOM_ID,
        name: 'Elena & Marco',
        message: '<script>alert("xss")</script>Wishing you eternal joy tonight!'
      })
    });

    assert(postRes.status === 201, `POST /api/demo/messages returns 201 (got ${postRes.status})`);
    const postJson = await postRes.json();
    assert(postJson.success === true, 'POST returns success: true');
    assert(postJson.message?.name === 'Elena & Marco', 'Created message preserves name');
    assert(!postJson.message?.message.includes('<script>'), 'XSS script tag stripped from message');
    assert(postJson.message?.message.includes('Wishing you eternal joy tonight!'), 'Sanitized message content preserved');
    assert(postJson.message?.isDemoSample === false, 'Submitted message marked isDemoSample: false');

    // Subsequent GET includes new message
    const getRes = await reqWorker('/api/demo/messages?room=eventframe-public-demo');
    const getJson = await getRes.json();
    assert(getJson.messages.length === 7, `GET now returns 7 messages (got ${getJson.messages.length})`);
    assert(getJson.messages[0].name === 'Elena & Marco', 'Newly created message appears first in GET response');
  }

  console.log('\n--- 6. Invalid payloads, missing fields, spam & rate limits rejected ---');
  {
    const missingMsgRes = await reqWorker('/api/demo/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.11' },
      body: JSON.stringify({ roomId: PUBLIC_DEMO_ROOM_ID, name: 'Guest', message: '   ' })
    });
    assert(missingMsgRes.status === 400, `Empty message rejected with 400 (got ${missingMsgRes.status})`);

    const missingNameRes = await reqWorker('/api/demo/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.11' },
      body: JSON.stringify({ roomId: PUBLIC_DEMO_ROOM_ID, name: '  ', message: 'Congratulations!' })
    });
    assert(missingNameRes.status === 400, `Missing name rejected with 400 (got ${missingNameRes.status})`);

    const spamRes = await reqWorker('/api/demo/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.11' },
      body: JSON.stringify({ roomId: PUBLIC_DEMO_ROOM_ID, name: 'Bot', message: 'Win free prizes https://spam.example.com' })
    });
    assert(spamRes.status === 400, `URL spam rejected with 400 (got ${spamRes.status})`);

    // Rate limit check (5 allowed, 6th returns 429)
    const rateIp = '203.0.113.77';
    for (let i = 0; i < 5; i++) {
      const okRes = await reqWorker('/api/demo/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': rateIp },
        body: JSON.stringify({ roomId: PUBLIC_DEMO_ROOM_ID, name: `Guest ${i}`, message: `Warm wishes #${i}` })
      });
      assert(okRes.status === 201, `Rate-limit request ${i + 1}/5 succeeds with 201`);
    }
    const blockedRes = await reqWorker('/api/demo/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': rateIp },
      body: JSON.stringify({ roomId: PUBLIC_DEMO_ROOM_ID, name: 'Guest 6', message: 'Too fast!' })
    });
    assert(blockedRes.status === 429, `6th rapid request rejected with 429 (got ${blockedRes.status})`);
  }

  console.log('\n--- 7. Unauthenticated visitors & SSE/stats endpoints ---');
  {
    const streamRes = await reqWorker('/api/demo/stream?room=eventframe-public-demo');
    assert(streamRes.status === 200, `GET /api/demo/stream returns 200 without auth (got ${streamRes.status})`);
    const streamText = await streamRes.text();
    assert(streamText.includes('"type":"snapshot"'), 'SSE stream yields initial demo snapshot payload');

    const statsRes = await reqWorker('/api/demo/stats?room=eventframe-public-demo');
    assert(statsRes.status === 200, `GET /api/demo/stats returns 200 without auth (got ${statsRes.status})`);
    const statsJson = await statsRes.json();
    assert(statsJson.sampleCount === 6 && statsJson.guestCount >= 1, 'Stats report sample and guest counts accurately');
  }

  console.log('\n--- 8. Production isolation (no leaking into real events) ---');
  {
    const badGet = await reqWorker('/api/demo/messages?room=production-event-123');
    assert(badGet.status === 400, `GET /api/demo/messages rejects non-demo room with 400 (got ${badGet.status})`);

    const badPost = await reqWorker('/api/demo/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'production-event-123', name: 'Spoofer', message: 'Inject' })
    });
    assert(badPost.status === 400, `POST /api/demo/messages rejects non-demo room with 400 (got ${badPost.status})`);

    const prodGuard = await reqWorker('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: PUBLIC_DEMO_ROOM_ID, name: 'Test', message: 'Leak attempt' })
    });
    assert(prodGuard.status === 400, `POST /api/messages rejects demo project_id with 400 (got ${prodGuard.status})`);

    let clientThrew = false;
    try {
      await postMessage('Test', 'Leak attempt', PUBLIC_DEMO_ROOM_ID);
    } catch {
      clientThrew = true;
    }
    assert(clientThrew, 'Client postMessage() blocks demo project IDs from touching Supabase');
  }

  console.log('\n--- 9. Controlled DELETE reset & Express/Worker parity ---');
  {
    const badDel = await reqWorker('/api/demo/messages?room=production-event-123', { method: 'DELETE' });
    assert(badDel.status === 400, `DELETE /api/demo/messages rejects non-demo room with 400 (got ${badDel.status})`);

    const delRes = await reqWorker('/api/demo/messages?room=eventframe-public-demo', { method: 'DELETE' });
    assert(delRes.status === 200, `DELETE /api/demo/messages resets public demo room (200)`);
    const delJson = await delRes.json();
    assert(delJson.messages.length === 6, `After reset, snapshot contains only 6 fresh sample messages (got ${delJson.messages.length})`);
    assert(delJson.messages.every((m: any) => m.isDemoSample === true), 'All messages after reset are clean samples');

    // Verify Node demoMessageService shares exact same core
    const nodeAdd = addDemoGuestMessage(PUBLIC_DEMO_ROOM_ID, 'Noah & Ava', 'Cheers to forever!', '198.51.100.5');
    assert(nodeAdd.success === true, 'Node demoMessageService addDemoGuestMessage succeeds');
    assert(getDemoMessagesSnapshot(PUBLIC_DEMO_ROOM_ID).length === 7, 'Node snapshot reflects submitted message');
    const nodeReset = resetPublicDemoRoom(PUBLIC_DEMO_ROOM_ID);
    assert(nodeReset.success === true && nodeReset.messages?.length === 6, 'Node resetPublicDemoRoom resets to 6 samples');

    // Verify Express server.ts also defines GET, POST, DELETE /demo/messages
    const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
    assert(serverSrc.includes("apiRouter.get('/demo/messages'"), 'server.ts defines GET /demo/messages');
    assert(serverSrc.includes("apiRouter.post('/demo/messages'"), 'server.ts defines POST /demo/messages');
    assert(serverSrc.includes("apiRouter.delete('/demo/messages'"), 'server.ts defines DELETE /demo/messages');
  }

  console.log('\n=======================================================');
  console.log('Test Results: All Public Demo API integration tests passed!');
  console.log('=======================================================\n');
}

runTests().catch((err) => {
  console.error('Public Demo API Test Suite failed:', err);
  process.exit(1);
});
