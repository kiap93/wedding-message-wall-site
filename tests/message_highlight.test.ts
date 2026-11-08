import { 
  CLASSIFICATION_PRIORITY, 
  getMessagePriorityScore, 
  compareMessagesByPriority, 
  getMessageDuration, 
  scheduleMessageRotation 
} from '../src/lib/displayScheduler';
import { Message, MessageDisplayConfig, DEFAULT_MESSAGE_DISPLAY_CONFIG } from '../src/types';

function runTests() {
  console.log('🧪 Starting Message Highlight & Priority System Test Suite...\n');
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

  // TEST 1: Strict Classification Priority Order
  console.log('--- Test Group 1: Priority Hierarchy ---');
  assert(
    CLASSIFICATION_PRIORITY['COUPLE_SELECTED'] < CLASSIFICATION_PRIORITY['SPECIAL_GUEST'],
    'COUPLE_SELECTED (1) ranks higher than SPECIAL_GUEST (2)'
  );
  assert(
    CLASSIFICATION_PRIORITY['SPECIAL_GUEST'] < CLASSIFICATION_PRIORITY['AI_SUGGESTED'],
    'SPECIAL_GUEST (2) ranks higher than AI_SUGGESTED (3)'
  );
  assert(
    CLASSIFICATION_PRIORITY['AI_SUGGESTED'] < CLASSIFICATION_PRIORITY['NORMAL'],
    'AI_SUGGESTED (3) ranks higher than NORMAL (4)'
  );

  // TEST 2: Priority Scoring & Pinned Boost
  console.log('\n--- Test Group 2: Pinned & Manual Overrides ---');
  const normalMsg: Message = { id: 'm-norm', name: 'Bob', message: 'Congrats!', timestamp: 100, classification: 'NORMAL', status: 'approved' };
  const aiMsg: Message = { id: 'm-ai', name: 'Alice', message: 'Touching story...', timestamp: 100, classification: 'AI_SUGGESTED', status: 'approved' };
  const vipMsg: Message = { id: 'm-vip', name: 'Grandpa', message: 'Cherished memories', timestamp: 100, classification: 'SPECIAL_GUEST', status: 'approved' };
  const coupleMsg: Message = { id: 'm-couple', name: 'Parents', message: 'We love you so much', timestamp: 100, classification: 'COUPLE_SELECTED', status: 'approved' };
  const pinnedNormalMsg: Message = { id: 'm-pinned', name: 'Host', message: 'Welcome everyone', timestamp: 100, classification: 'NORMAL', is_pinned: true, status: 'approved' };

  assert(getMessagePriorityScore(coupleMsg) < getMessagePriorityScore(vipMsg), 'Couple Selected score is lower (higher priority) than VIP');
  assert(getMessagePriorityScore(vipMsg) < getMessagePriorityScore(aiMsg), 'VIP score is lower than AI Suggested');
  assert(getMessagePriorityScore(aiMsg) < getMessagePriorityScore(normalMsg), 'AI Suggested score is lower than Normal');
  assert(getMessagePriorityScore(pinnedNormalMsg) < getMessagePriorityScore(coupleMsg), 'Pinned message receives negative boost (-10) to appear ahead of unpinned cards');

  // TEST 3: Duration Timing per Classification
  console.log('\n--- Test Group 3: Duration Timing ---');
  const customConfig: MessageDisplayConfig = {
    normalDuration: 7,
    specialGuestDuration: 14,
    coupleSelectedDuration: 21,
    featuredFrequency: 3,
    spotlightAnimation: 'elegant-spotlight',
    maxConsecutiveFeatured: 1
  };

  assert(getMessageDuration(normalMsg, customConfig) === 7, 'Normal message gets configured normalDuration (7s)');
  assert(getMessageDuration(vipMsg, customConfig) === 14, 'Special Guest message gets configured specialGuestDuration (14s)');
  assert(getMessageDuration(coupleMsg, customConfig) === 21, 'Couple Selected message gets configured coupleSelectedDuration (21s)');
  assert(getMessageDuration(normalMsg, DEFAULT_MESSAGE_DISPLAY_CONFIG) === 8, 'Defaults to 8s for normal duration');

  // TEST 4: Anti-Starvation & Interleaving Scheduler
  console.log('\n--- Test Group 4: Rotation Scheduling & Anti-Starvation ---');
  const testMessages: Message[] = [
    { id: 'norm-1', name: 'G1', message: 'M1', timestamp: 1, classification: 'NORMAL', status: 'approved' },
    { id: 'norm-2', name: 'G2', message: 'M2', timestamp: 2, classification: 'NORMAL', status: 'approved' },
    { id: 'norm-3', name: 'G3', message: 'M3', timestamp: 3, classification: 'NORMAL', status: 'approved' },
    { id: 'norm-4', name: 'G4', message: 'M4', timestamp: 4, classification: 'NORMAL', status: 'approved' },
    { id: 'norm-5', name: 'G5', message: 'M5', timestamp: 5, classification: 'NORMAL', status: 'approved' },
    { id: 'norm-6', name: 'G6', message: 'M6', timestamp: 6, classification: 'NORMAL', status: 'approved' },
    { id: 'feat-A', name: 'Best Friend', message: 'Speech excerpt', timestamp: 7, classification: 'COUPLE_SELECTED', status: 'approved' },
    { id: 'feat-B', name: 'Maid of Honor', message: 'Unforgettable day', timestamp: 8, classification: 'COUPLE_SELECTED', status: 'approved' },
    { id: 'pinned-1', name: 'Ceremony Host', message: 'Reception starts soon', timestamp: 9, classification: 'NORMAL', is_pinned: true, status: 'approved' }
  ];

  const scheduled = scheduleMessageRotation(testMessages, customConfig);

  // Assertion 4.1: Pinned is first
  assert(scheduled[0].id === 'pinned-1', 'Pinned message is placed at index 0');

  // Assertion 4.2: Normal messages are NOT starved
  const normalInScheduled = scheduled.filter(m => m.classification === 'NORMAL' && !m.is_pinned);
  assert(normalInScheduled.length === 6, 'All 6 normal messages are present in scheduled rotation');

  // Assertion 4.3: Max consecutive featured is respected (maxConsecutiveFeatured = 1)
  let maxConsecutiveFound = 0;
  let currentConsecutive = 0;
  for (const m of scheduled) {
    if (m.classification === 'COUPLE_SELECTED' || m.is_featured) {
      currentConsecutive++;
      if (currentConsecutive > maxConsecutiveFound) maxConsecutiveFound = currentConsecutive;
    } else {
      currentConsecutive = 0;
    }
  }
  assert(maxConsecutiveFound <= customConfig.maxConsecutiveFeatured, `Max consecutive featured (${maxConsecutiveFound}) does not exceed limit (1)`);

  // Assertion 4.4: Does not repeat the same featured card back-to-back when multiple exist
  const featuredOnly = scheduled.filter(m => m.classification === 'COUPLE_SELECTED');
  let hasImmediateRepeat = false;
  for (let i = 1; i < featuredOnly.length; i++) {
    if (featuredOnly[i].id === featuredOnly[i - 1].id) {
      hasImmediateRepeat = true;
    }
  }
  assert(!hasImmediateRepeat, 'Featured messages rotate across available candidates without immediate identical repeats');

  // TEST 5: Fallback Heuristic Analysis
  console.log('\n--- Test Group 5: AI & Heuristic Suggestion Rules ---');
  // Emulate heuristic logic from server.ts
  function analyzeHeuristic(text: string) {
    const memoryKeywords = ['remember', 'memory', 'first met', 'college', 'years ago', 'childhood'];
    const blessingKeywords = ['bless', 'blessing', 'lifetime', 'forever', 'honor', 'may your', 'wishing you both'];
    const lower = text.toLowerCase();
    const hasMemory = memoryKeywords.some(k => lower.includes(k));
    const hasBlessing = blessingKeywords.some(k => lower.includes(k));
    const isSpecial = hasMemory || hasBlessing || text.length > 80;
    return {
      suggested: isSpecial,
      reason: hasMemory ? 'Personal memories shared' : hasBlessing ? 'Meaningful blessing' : 'Heartfelt message'
    };
  }

  const analysis1 = analyzeHeuristic('I will never forget when you two first met in college, you were meant for each other!');
  const analysis2 = analyzeHeuristic('Wishing you both a lifetime of boundless joy and eternal love!');
  const analysis3 = analyzeHeuristic('Congrats guys!');

  assert(analysis1.suggested && analysis1.reason.includes('memories'), 'Heuristic successfully identifies personal memories');
  assert(analysis2.suggested && analysis2.reason.includes('blessing'), 'Heuristic successfully identifies heartfelt blessings');
  assert(!analysis3.suggested, 'Heuristic does NOT artificially suggest plain short generic messages');

  console.log(`\n================================`);
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
