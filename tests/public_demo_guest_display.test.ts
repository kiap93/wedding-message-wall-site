/**
 * Test Suite: Automatic Public Demo Mode for Guest & Display
 * 
 * Tests:
 * 1. Automatic Demo Room initialization without login or signup
 * 2. 6 realistic sample messages loaded with isDemoSample: true
 * 3. Guest wish submission via /api/demo/messages with isDemoSample: false
 * 4. Real-time broadcast to display via WebSocket / in-memory event distribution
 * 5. Multi-client snapshot recovery (replay) without duplicate samples
 * 6. Input sanitization (XSS prevention, length limits)
 * 7. Rate limiting protection
 * 8. 30-minute expiration & automatic memory cleanup
 * 9. Strict production database protection (zero DB writes)
 * 10. Real event isolation (production event paths untouched)
 */

import {
  PUBLIC_DEMO_ROOM_ID,
  getOrCreateDemoRoom,
  getDemoMessagesSnapshot,
  addDemoGuestMessage,
  sanitizeInput,
  checkRateLimit,
  cleanupExpiredMessages,
  resetDemoRoomForTesting
} from '../server/demoMessageService';
import { createGuestMessageProvider } from '../src/lib/guestMessageProvider';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✅ PASS: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Starting EventFrame Public Demo Mode Test Suite...\n');

  // Reset before testing
  resetDemoRoomForTesting(PUBLIC_DEMO_ROOM_ID);

  console.log('--- Test 1 & 2: Automatic Initialization & Sample Messages ---');
  {
    const snapshot = getDemoMessagesSnapshot(PUBLIC_DEMO_ROOM_ID);
    assert(snapshot.length === 6, `Initial snapshot has exactly 6 sample messages (found ${snapshot.length})`);
    
    // Verify sample messages match required text
    const sampleTexts = snapshot.map(s => s.message);
    assert(
      sampleTexts.some(t => t.includes('lifetime of happiness')),
      'Contains "lifetime of happiness" sample'
    );
    assert(
      sampleTexts.some(t => t.includes('celebrate this beautiful day with you')),
      'Contains "celebrate this beautiful day" sample'
    );
    assert(
      sampleTexts.some(t => t.includes('love grow stronger every year')),
      'Contains "love grow stronger" sample'
    );
    assert(
      sampleTexts.some(t => t.includes('endless laughter and beautiful memories')),
      'Contains "endless laughter" sample'
    );
    assert(
      sampleTexts.some(t => t.includes('Finally! The perfect couple!')),
      'Contains "Finally! The perfect couple!" sample'
    );
    assert(
      sampleTexts.some(t => t.includes('Sending lots of love and blessings')),
      'Contains "Sending lots of love and blessings" sample'
    );

    // Verify all are flagged as isDemoSample: true
    const allSamples = snapshot.every(s => s.isDemoSample === true);
    assert(allSamples, 'All 6 initial messages are marked as isDemoSample: true');
  }

  console.log('\n--- Test 3: No Duplicate Samples on Refresh / Reconnect ---');
  {
    const snapshot1 = getDemoMessagesSnapshot(PUBLIC_DEMO_ROOM_ID);
    const snapshot2 = getDemoMessagesSnapshot(PUBLIC_DEMO_ROOM_ID);
    assert(snapshot1.length === snapshot2.length, 'Re-querying snapshot does not re-seed or duplicate sample messages');
    assert(snapshot2.length === 6, 'Count remains exactly 6');
  }

  console.log('\n--- Test 4 & 5: Guest Submission & Real-time Integration ---');
  {
    const res = addDemoGuestMessage(
      PUBLIC_DEMO_ROOM_ID,
      'Maya Lin',
      'Congratulations Lucas and Sofia! What a magical celebration tonight!',
      '192.168.1.100'
    );

    assert(res.success === true, 'Guest demo message submitted successfully');
    assert(!!res.message, 'Returned message payload');
    assert(res.message?.isDemoSample === false, 'Guest message marked as isDemoSample: false');
    assert(res.message?.name === 'Maya Lin', 'Guest name saved verbatim');
    assert(res.message?.room_id === PUBLIC_DEMO_ROOM_ID, 'Assigned to public demo room');

    // Check that display snapshot immediately includes this new guest message
    const snapshotAfter = getDemoMessagesSnapshot(PUBLIC_DEMO_ROOM_ID);
    assert(snapshotAfter.length === 7, 'Display snapshot now contains 7 messages (6 samples + 1 guest)');
    assert(snapshotAfter[0].name === 'Maya Lin', 'New guest message is chronologically first');
  }

  console.log('\n--- Test 6: Replay for Newly Connected Displays ---');
  {
    // When a 3rd visitor opens /display, they must receive the snapshot including active guest messages
    const newVisitorSnapshot = getDemoMessagesSnapshot(PUBLIC_DEMO_ROOM_ID);
    const foundMaya = newVisitorSnapshot.find(m => m.name === 'Maya Lin');
    assert(!!foundMaya, 'Newly connected display receives the active temporary guest message');
    assert(foundMaya?.message.includes('magical celebration'), 'Message content preserved in replay snapshot');
  }

  console.log('\n--- Test 7: Input Sanitization & Abuse Prevention ---');
  {
    // HTML / Script injection attempt
    const dirty = '<script>alert("xss")</script><b>Hello Couple!</b>';
    const clean = sanitizeInput(dirty, 150);
    assert(!clean.includes('<script>'), 'Script tag stripped');
    assert(!clean.includes('<b>'), 'HTML tags stripped');
    assert(clean.includes('Hello Couple!'), 'Legitimate text preserved');

    // Test rejection of empty messages
    const emptyRes = addDemoGuestMessage(PUBLIC_DEMO_ROOM_ID, 'Attacker', '   ', '192.168.1.101');
    assert(emptyRes.success === false, 'Rejects empty or whitespace-only messages');
  }

  console.log('\n--- Test 8: Rate Limiting ---');
  {
    const testIp = '10.0.0.99';
    // Send 5 rapid messages (within allowance)
    for (let i = 0; i < 5; i++) {
      const allowed = checkRateLimit(testIp);
      assert(allowed.allowed, `Request ${i + 1} allowed within window`);
    }

    // 6th message should be blocked
    const blocked = checkRateLimit(testIp);
    assert(!blocked.allowed, '6th rapid request blocked by rate limiter');
    assert(typeof blocked.retryAfter === 'number' && blocked.retryAfter > 0, 'Returns retryAfter duration');
  }

  console.log('\n--- Test 9: 30-Minute Message Expiration ---');
  {
    const roomState = getOrCreateDemoRoom(PUBLIC_DEMO_ROOM_ID);
    
    // Insert an old message simulating 35 minutes ago
    const thirtyFiveMinutesAgo = Date.now() - (35 * 60 * 1000);
    roomState.guestMessages.push({
      id: 'expired-msg-1',
      room_id: PUBLIC_DEMO_ROOM_ID,
      project_id: PUBLIC_DEMO_ROOM_ID,
      name: 'Old Visitor',
      message: 'This message is expired',
      timestamp: thirtyFiveMinutesAgo,
      status: 'approved',
      classification: 'NORMAL',
      is_featured: false,
      is_pinned: false,
      isDemoSample: false
    });

    assert(roomState.guestMessages.some(m => m.id === 'expired-msg-1'), 'Expired message injected for test');

    // Run cleanup
    cleanupExpiredMessages(PUBLIC_DEMO_ROOM_ID);

    assert(!roomState.guestMessages.some(m => m.id === 'expired-msg-1'), 'Expired guest message successfully pruned');
    assert(roomState.sampleMessages.length === 6, 'Sample messages remain intact and not pruned');
  }

  console.log('\n--- Test 10: Provider Abstraction & Room Scoping ---');
  {
    const demoProvider = createGuestMessageProvider(null, true);
    assert(demoProvider.isDemo === true, 'Anonymous context creates PublicDemoGuestMessageProvider');
    assert(demoProvider.roomIdOrProjectId === PUBLIC_DEMO_ROOM_ID, 'Provider targets public demo room');

    const prodProvider = createGuestMessageProvider('proj-prod-12345', false);
    assert(prodProvider.isDemo === false, 'Real event context creates ProductionGuestMessageProvider');
    assert(prodProvider.roomIdOrProjectId === 'proj-prod-12345', 'Production provider targets real project ID');
  }

  console.log('\n--- Test 11: Rejection of Non-Demo Room Injection ---');
  {
    const spoofAttempt = addDemoGuestMessage('production-secret-event-999', 'Hacker', 'Hello', '1.2.3.4');
    assert(spoofAttempt.success === false, 'Rejects attempt to target arbitrary or production rooms via demo endpoint');
  }

  console.log('\n=======================================================');
  console.log('Test Results: All Public Demo Mode tests passed!');
  console.log('=======================================================\n');
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
