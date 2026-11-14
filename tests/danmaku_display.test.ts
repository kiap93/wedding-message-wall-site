/**
 * Test Suite: Luxury Wedding Danmaku Engine & Display System
 *
 * Verifies:
 * 1. Dynamic track calculation across 16:9 LED walls, monitors, and mobile heights
 * 2. Strict horizontal non-overlap & gap invariants over full frame-by-frame simulation
 * 3. Mathematical anti-catch-up guard (faster trailing item blocked from colliding before exit)
 * 4. Bidirectional RTL and LTR motion geometry
 * 5. Zero auto-special promotion on emoji-only normal messages
 * 6. Explicit wish categories (heartfelt, family, funny) + SPECIAL_GUEST + AI_SUGGESTED
 * 7. Couple Spotlight interruption, configurable duration, and seamless resume
 * 8. Pinned priority + repeat cooldown fairness
 * 9. Live arrival prioritization, strict ID deduplication, and moderation snapshot pruning
 * 10. Density presets (relaxed, balanced, celebration) & backward-compatible config resolution
 * 11. Demo backend wish_category sanitization & allowlisting
 * 12. Responsive resize handling without dropping active in-flight messages
 */

import {
  DanmakuScheduler,
  calculateTrackLayout,
  calculateVerticalTrackLayout,
  canLaunchOnTrack,
  canLaunchOnVerticalTrack,
  classifyDanmakuMessage,
  computeItemScreenX,
  computeItemScreenY,
  computeItemSpeedPxPerSec,
  estimateDanmakuDimensions,
  mergeAndDeduplicateMessages,
  normalizeWishCategory,
  willCrossAxesIntersect,
} from '../src/lib/danmakuEngine';
import {
  addDemoGuestMessageCore,
  PUBLIC_DEMO_ROOM_ID,
  resetDemoRoomForTesting,
} from '../server/demoMessageCore';
import {
  DANMAKU_DENSITY_PRESETS,
  DEFAULT_MESSAGE_DISPLAY_CONFIG,
  DanmakuDirection,
  Message,
  resolveDisplayConfig,
} from '../src/types';

function assert(condition: boolean, label: string) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${label}`);
    throw new Error(label);
  }
  console.log(`  ✅ PASS: ${label}`);
}

function runTests() {
  console.log('🧪 Starting Luxury Wedding Danmaku Display Test Suite...\n');

  // Group 1: Config defaults & Density presets
  console.log('--- Test Group 1: Config Resolution & Density Presets ---');
  {
    const def = resolveDisplayConfig();
    assert(def.danmakuEnabled === true, 'Danmaku enabled by default');
    assert(def.danmakuDirection === 'rtl', 'Default direction is rtl');
    assert(def.danmakuDensity === 'balanced', 'Default density is balanced');
    assert(def.spotlightDuration === 7, 'Default spotlight duration is 7s');
    assert(def.showSenderNames === true, 'Sender names shown by default');
    assert(
      DANMAKU_DENSITY_PRESETS.relaxed.minGapPx > DANMAKU_DENSITY_PRESETS.balanced.minGapPx &&
        DANMAKU_DENSITY_PRESETS.balanced.minGapPx > DANMAKU_DENSITY_PRESETS.celebration.minGapPx,
      'Relaxed > Balanced > Celebration spacing presets'
    );
  }

  // Group 2: Dynamic Track Layout
  console.log('\n--- Test Group 2: Responsive Track Calculation ---');
  {
    const cfg = resolveDisplayConfig();
    const hdLayout = calculateTrackLayout(720, cfg);
    const uhdLayout = calculateTrackLayout(1080, cfg);
    const mobileLayout = calculateTrackLayout(380, cfg);

    assert(hdLayout.trackCount >= 6, `720p stage allocates >= 6 tracks (got ${hdLayout.trackCount})`);
    assert(uhdLayout.trackCount > hdLayout.trackCount, `1080p stage allocates more tracks than 720p (${uhdLayout.trackCount} > ${hdLayout.trackCount})`);
    assert(mobileLayout.trackCount >= 3, `Compact viewport preserves >= 3 tracks (got ${mobileLayout.trackCount})`);

    const fixedCfg = resolveDisplayConfig({ danmakuTracks: 5 });
    const fixedLayout = calculateTrackLayout(1080, fixedCfg);
    assert(fixedLayout.trackCount === 5, 'Explicit danmakuTracks override honored');
  }

  // Group 3: Strict Anti-Collision & Anti-Catch-Up Math
  console.log('\n--- Test Group 3: Anti-Overlap & Anti-Catch-Up Math ---');
  {
    const viewportW = 1280;
    const minGap = 88;
    // Active slow item just entered + width 240, distTraveled = 260 (tail is only 20px inside < 88px)
    const blockingEntry = canLaunchOnTrack(
      [{ distTraveled: 260, width: 240, speed: 100 }],
      200,
      100,
      viewportW,
      minGap
    );
    assert(!blockingEntry, 'Blocks launch when trailing edge has not cleared entry gap');

    // Active slow item cleared entry gap cleanly (tail at 120px inside), speed 75 px/s,
    // Remaining travel = 1280 + 240 - 360 = 1160px -> tExit = 15.47s.
    // Fast new item at 150 px/s would travel 2320px > 1280 -> catches up mid-screen!
    const catchupBlocked = canLaunchOnTrack(
      [{ distTraveled: 360, width: 240, speed: 75 }],
      200,
      150,
      viewportW,
      minGap
    );
    assert(!catchupBlocked, 'Blocks faster trailing item that would catch up before leading item exits');

    // Slower or equal item with cleared entry gap is permitted cleanly
    const safeAllowed = canLaunchOnTrack(
      [{ distTraveled: 360, width: 240, speed: 110 }],
      200,
      95,
      viewportW,
      minGap
    );
    assert(safeAllowed, 'Permits launch when entry gap cleared and trailing item is slower');
  }

  // Group 4: Multi-Frame Simulation Zero-Overlap Invariant (RTL + LTR)
  console.log('\n--- Test Group 4: Multi-Frame Simulation Non-Overlap (RTL & LTR) ---');
  {
    for (const dir of ['rtl', 'ltr'] as const) {
      const samplePool: Message[] = Array.from({ length: 14 }, (_, idx) => ({
        id: `sim-${idx}`,
        name: `Guest ${idx + 1}`,
        message:
          idx % 3 === 0
            ? 'Wishing you a lifetime of laughter, quiet mornings, and endless adventures together!'
            : idx % 2 === 0
              ? 'Congratulations!!'
              : 'May every chapter together shine brighter than the last.',
        timestamp: 1000 + idx,
        status: 'approved',
        classification: idx === 0 ? 'SPECIAL_GUEST' : 'NORMAL',
      }));

      const scheduler = new DanmakuScheduler(1280, 720, {
        ...DEFAULT_MESSAGE_DISPLAY_CONFIG,
        danmakuDirection: dir,
        danmakuDensity: 'celebration',
        danmakuTracks: 4,
      });
      scheduler.setMessages(samplePool);

      let maxActiveSeen = 0;
      for (let frame = 0; frame < 900; frame++) {
        scheduler.step(32);
        const items = scheduler.getActiveItems();
        if (items.length > maxActiveSeen) maxActiveSeen = items.length;

        // Group active items by track and check pairwise bounding boxes never intersect
        const byTrack = new Map<number, typeof items>();
        for (const item of items) {
          const arr = byTrack.get(item.trackIndex) || [];
          arr.push(item);
          byTrack.set(item.trackIndex, arr);
        }

        for (const lane of byTrack.values()) {
          lane.sort((a, b) => a.x - b.x);
          for (let i = 1; i < lane.length; i++) {
            const left = lane[i - 1];
            const right = lane[i];
            if (left.x + left.width > right.x + 0.5) {
              throw new Error(
                `${dir.toUpperCase()} overlap between [${left.instanceId}] and [${right.instanceId}] at frame ${frame}`
              );
            }
          }
        }
      }
      assert(true, `${dir.toUpperCase()} simulation maintained zero overlap across 900 frames`);
      assert(maxActiveSeen >= 4, `${dir.toUpperCase()} simulation populated multiple tracks (${maxActiveSeen} concurrent)`);
    }

    // Verify exact RTL vs LTR X-progression math
    assert(computeItemScreenX(0, 200, 1280, 'rtl') === 1280, 'RTL starts cleanly off right edge (1280)');
    assert(computeItemScreenX(300, 200, 1280, 'rtl') === 980, 'RTL advances leftward correctly (980)');
    assert(computeItemScreenX(0, 200, 1280, 'ltr') === -200, 'LTR starts cleanly off left edge (-200)');
    assert(computeItemScreenX(300, 200, 1280, 'ltr') === 100, 'LTR advances rightward correctly (100)');
  }

  // Group 5: Emoji-Only Does NOT Auto-Promote + Explicit Categories & Tier Speeds
  console.log('\n--- Test Group 5: Tier Classification & Anti-Emoji-Upgrade ---');
  {
    const emojiNormalMsg: Message = {
      id: 'emoji-only',
      name: 'Sam',
      message: 'Yay!! ❤️❤️🥳🎉🥂✨',
      timestamp: 100,
      classification: 'NORMAL',
      status: 'approved',
    };
    const infoEmoji = classifyDanmakuMessage(emojiNormalMsg);
    assert(infoEmoji.tier === 'normal', 'Plain message with emojis remains normal tier');
    assert(!infoEmoji.isSpecial, 'Plain message with emojis is NOT promoted to special');
    assert(infoEmoji.wishCategory === 'normal', 'Wish category stays normal');

    const heartfeltMsg: Message = {
      id: 'hf-1',
      name: 'Clara',
      message: 'Watching your love grow over ten years has been our greatest joy.',
      timestamp: 101,
      classification: 'NORMAL',
      wish_category: 'heartfelt',
      status: 'approved',
    };
    const infoHf = classifyDanmakuMessage(heartfeltMsg);
    assert(infoHf.isSpecial && infoHf.wishCategory === 'heartfelt', 'Explicit heartfelt wish receives special styling');

    const vipMsg: Message = {
      id: 'vip-1',
      name: 'Grandma Rose',
      message: 'Blessings always',
      timestamp: 102,
      classification: 'SPECIAL_GUEST',
      guest_category: 'Family',
      status: 'approved',
    };
    const cfg = resolveDisplayConfig();
    const speedNorm = computeItemSpeedPxPerSec(emojiNormalMsg, cfg, infoEmoji, 0.5);
    const speedVip = computeItemSpeedPxPerSec(vipMsg, cfg, classifyDanmakuMessage(vipMsg), 0.5);
    assert(speedVip < speedNorm, `Special Guest scrolls slower (${speedVip} px/s) than normal (${speedNorm} px/s)`);
  }

  // Group 6: Spotlight Interruption, Resume & Pinned Cooldown
  console.log('\n--- Test Group 6: Spotlight Interruption & Pinned Cooldown ---');
  {
    const msgs: Message[] = [
      { id: 'n1', name: 'A', message: 'Congrats!', timestamp: 1, classification: 'NORMAL', status: 'approved' },
      { id: 'n2', name: 'B', message: 'Best wishes!', timestamp: 2, classification: 'NORMAL', status: 'approved' },
      { id: 'pin-1', name: 'Host', message: 'Dinner served at 7 PM', timestamp: 3, classification: 'NORMAL', is_pinned: true, status: 'approved' },
      { id: 'cup-1', name: 'Maid of Honor', message: 'Best day ever!', timestamp: 4, classification: 'COUPLE_SELECTED', is_featured: true, status: 'approved' },
    ];

    const scheduler = new DanmakuScheduler(1280, 720, {
      ...DEFAULT_MESSAGE_DISPLAY_CONFIG,
      spotlightDuration: 6,
      featuredFrequency: 2,
    });
    scheduler.setMessages(msgs);

    let sawPinnedSpotlight = false;
    let sawCoupleSpotlight = false;
    let sawResumedAfterSpotlight = false;
    let spotlightShownIds: string[] = [];

    // Simulate ~45 seconds in 50ms steps (900 steps)
    for (let s = 0; s < 900; s++) {
      const res = scheduler.step(50);
      if (res.spotlightChanged) {
        if (res.spotlight.activeMessage) {
          spotlightShownIds.push(res.spotlight.activeMessage.id);
          if (res.spotlight.activeMessage.id === 'pin-1') sawPinnedSpotlight = true;
          if (res.spotlight.activeMessage.id === 'cup-1') sawCoupleSpotlight = true;
        } else if (spotlightShownIds.length > 0) {
          sawResumedAfterSpotlight = true;
        }
      }
    }

    assert(sawPinnedSpotlight, 'Pinned message entered spotlight priority');
    assert(sawCoupleSpotlight, 'Couple selected message entered spotlight rotation');
    assert(sawResumedAfterSpotlight, 'Danmaku smoothly resumed after spotlight ended');
    assert(
      !(spotlightShownIds[0] === 'pin-1' && spotlightShownIds[1] === 'pin-1'),
      'Pinned message cooldown prevented immediate back-to-back repetition'
    );
  }

  // Group 7: Deduplication, Live Arrival & Moderation Snapshot Pruning
  console.log('\n--- Test Group 7: Deduplication, Live Queue & Moderation Sync ---');
  {
    const base: Message[] = [
      { id: 'm1', name: 'Ann', message: 'Congrats!', timestamp: 100, status: 'approved' },
      { id: 'm2', name: 'Ben', message: 'Cheers!', timestamp: 200, status: 'approved' },
    ];
    const dupMerged = mergeAndDeduplicateMessages(base, [{ id: 'm1', name: 'Ann', message: 'Congrats!', timestamp: 100, status: 'approved' }]);
    assert(dupMerged.length === 2, 'Deduplicates repeated identical message ID');

    const moderatedOut = mergeAndDeduplicateMessages(
      base,
      [{ id: 'm2', name: 'Ben', message: 'Cheers!', timestamp: 200, status: 'rejected' }],
      100,
      false
    );
    assert(moderatedOut.length === 1 && moderatedOut[0].id === 'm1', 'Rejected message immediately pruned from live stream');

    const scheduler = new DanmakuScheduler(1280, 720, DEFAULT_MESSAGE_DISPLAY_CONFIG);
    scheduler.setMessages(base);
    const addedFirst = scheduler.enqueueLiveMessage({
      id: 'live-99',
      name: 'Live Guest',
      message: 'Just arrived at the reception!',
      timestamp: 500,
      status: 'approved',
    });
    const addedDup = scheduler.enqueueLiveMessage({
      id: 'live-99',
      name: 'Live Guest',
      message: 'Just arrived at the reception!',
      timestamp: 500,
      status: 'approved',
    });
    assert(addedFirst === true, 'Live new message queued cleanly');
    assert(addedDup === false, 'Duplicate live message ignored cleanly');
  }

  // Group 8: Resize & Demo Wish Category Allowlisting
  console.log('\n--- Test Group 8: Resize Handling & Demo API Category Allowlisting ---');
  {
    const scheduler = new DanmakuScheduler(1280, 720, DEFAULT_MESSAGE_DISPLAY_CONFIG);
    scheduler.setMessages([{ id: 'r1', name: 'Guest', message: 'Happy wedding!', timestamp: 1, status: 'approved' }]);
    scheduler.step(20);
    assert(scheduler.getActiveItems().length === 1, 'Item spawned on 720p stage');
    scheduler.resize(1920, 1080);
    assert(scheduler.getLayout().trackCount > 6, 'Tracks expand seamlessly on resize to 1080p');
    assert(scheduler.getActiveItems().length === 1, 'In-flight message preserved across viewport resize');

    resetDemoRoomForTesting(PUBLIC_DEMO_ROOM_ID);
    assert(normalizeWishCategory('heartfelt') === 'heartfelt', 'Valid wish category accepted');
    assert(normalizeWishCategory('vip-hacked-admin') === 'normal', 'Invalid wish category sanitized to normal');

    const demoValid = addDemoGuestMessageCore(
      PUBLIC_DEMO_ROOM_ID,
      'Olivia',
      'So joyful to be here! ❤️',
      '10.1.1.1',
      'family'
    );
    assert(demoValid.success && demoValid.message?.wish_category === 'family', 'Demo core stores valid explicit wish_category');

    const demoInvalid = addDemoGuestMessageCore(
      PUBLIC_DEMO_ROOM_ID,
      'Noah',
      'Cheers! 🎉',
      '10.1.1.2',
      'unknown_tier'
    );
    assert(demoInvalid.success && demoInvalid.message?.wish_category === 'normal', 'Demo core defaults unrecognized wish_category to normal');
  }

  // Group 9: Four-Direction Config Persistence & Backward Compatibility
  console.log('\n--- Test Group 9: Nested Config Schema & Backward Compatibility ---');
  {
    const legacyCfg = resolveDisplayConfig({
      danmakuDirection: 'ltr',
      danmakuDensity: 'relaxed',
    });
    assert(legacyCfg.danmakuDirectionMode === 'single', 'Legacy horizontal-only config stays single-direction mode');
    assert(legacyCfg.danmakuDirection === 'ltr', 'Legacy ltr direction preserved');
    assert(legacyCfg.danmaku.directionMode === 'single', 'Nested danmaku mirror matches single mode');
    assert(legacyCfg.danmaku.preset === 'relaxed', 'Nested danmaku mirror preserves preset');

    const nestedMixedCfg = resolveDisplayConfig({
      danmaku: {
        directionMode: 'mixed',
        directions: ['right-to-left', 'left-to-right', 'top-to-bottom', 'bottom-to-top'],
        preset: 'celebration',
      },
    });
    assert(nestedMixedCfg.danmakuDirectionMode === 'mixed', 'Nested danmaku.directionMode=mixed resolved');
    assert(nestedMixedCfg.danmakuDensity === 'celebration', 'Nested danmaku.preset=celebration resolved');
    assert(
      nestedMixedCfg.danmakuDirections.length === 4 &&
        nestedMixedCfg.danmakuDirections.includes('rtl') &&
        nestedMixedCfg.danmakuDirections.includes('ltr') &&
        nestedMixedCfg.danmakuDirections.includes('ttb') &&
        nestedMixedCfg.danmakuDirections.includes('btt'),
      'Nested direction slugs normalized to all 4 internal codes'
    );
  }

  // Group 10: Single Direction Vertical Danmaku (TTB & BTT) Geometry & Non-Overlap
  console.log('\n--- Test Group 10: Vertical Danmaku Geometry & Column Non-Overlap (TTB & BTT) ---');
  {
    const cfg = resolveDisplayConfig();
    const hdVert = calculateVerticalTrackLayout(1280, 720, cfg);
    const uhdVert = calculateVerticalTrackLayout(1920, 1080, cfg);
    const mobileVert = calculateVerticalTrackLayout(390, 844, cfg);

    assert(hdVert.trackCount >= 3, `1280px screen allocates >= 3 vertical columns (got ${hdVert.trackCount})`);
    assert(uhdVert.trackCount >= hdVert.trackCount, '1920px stage allocates >= columns than 1280px');
    assert(mobileVert.trackCount >= 1 && mobileVert.cardMaxWidth <= 215, 'Mobile stage constrains vertical card width cleanly');

    // Verify vertical Y math
    assert(computeItemScreenY(0, 110, 720, 'ttb') === -110, 'TTB starts cleanly above top edge (-110)');
    assert(computeItemScreenY(250, 110, 720, 'ttb') === 140, 'TTB moves downward correctly (140)');
    assert(computeItemScreenY(0, 110, 720, 'btt') === 720, 'BTT starts cleanly below bottom edge (720)');
    assert(computeItemScreenY(250, 110, 720, 'btt') === 470, 'BTT moves upward correctly (470)');

    // Verify horizontal-text vertical dimensions constrain width instead of stretching onto 1 vertical rotated line
    const longMsg: Message = {
      id: 'long-vert',
      name: 'Grace',
      message: 'May your marriage be filled with warmth, laughter, music, and joy every single morning.',
      timestamp: 1000,
      status: 'approved',
    };
    const vertDims = estimateDanmakuDimensions(longMsg, cfg, classifyDanmakuMessage(longMsg), 'ttb', 248);
    assert(vertDims.width <= 248 && vertDims.height >= 90, `Vertical card wraps horizontally (${vertDims.width}x${vertDims.height})`);

    // Vertical anti-catchup check
    const vertBlocked = canLaunchOnVerticalTrack(
      [{ distTraveled: 200, height: 110, speed: 60, direction: 'ttb' }],
      110,
      140,
      720,
      72,
      4,
      'ttb'
    );
    assert(!vertBlocked, 'Blocks faster vertical card from catching up before leading vertical card exits');

    for (const dir of ['ttb', 'btt'] as const) {
      const pool: Message[] = Array.from({ length: 14 }, (_, idx) => ({
        id: `vsim-${idx}`,
        name: `Guest ${idx + 1}`,
        message: idx % 2 === 0 ? 'Cheers to forever together!' : 'Warmest wedding wishes for a radiant future!',
        timestamp: 2000 + idx,
        status: 'approved',
        classification: idx === 1 ? 'SPECIAL_GUEST' : 'NORMAL',
      }));

      const scheduler = new DanmakuScheduler(1280, 720, {
        ...DEFAULT_MESSAGE_DISPLAY_CONFIG,
        danmakuDirectionMode: 'single',
        danmakuDirection: dir,
        danmakuDensity: 'celebration',
      });
      scheduler.setMessages(pool);

      let maxActiveSeen = 0;
      for (let frame = 0; frame < 900; frame++) {
        scheduler.step(32);
        const items = scheduler.getActiveItems();
        if (items.length > maxActiveSeen) maxActiveSeen = items.length;

        const byCol = new Map<number, typeof items>();
        for (const item of items) {
          if (item.direction !== dir) {
            throw new Error(`Single vertical mode spawned unexpected direction ${item.direction} (expected ${dir})`);
          }
          const arr = byCol.get(item.trackIndex) || [];
          arr.push(item);
          byCol.set(item.trackIndex, arr);
        }

        for (const col of byCol.values()) {
          col.sort((a, b) => a.y - b.y);
          for (let i = 1; i < col.length; i++) {
            const top = col[i - 1];
            const bottom = col[i];
            if (top.y + top.height > bottom.y + 0.5) {
              throw new Error(
                `${dir.toUpperCase()} vertical overlap between [${top.instanceId}] and [${bottom.instanceId}] at frame ${frame}`
              );
            }
          }
        }
      }
      assert(true, `${dir.toUpperCase()} simulation maintained zero vertical overlap across 900 frames`);
      assert(maxActiveSeen >= 3, `${dir.toUpperCase()} simulation populated multiple vertical columns (${maxActiveSeen} concurrent)`);
    }
  }

  // Group 11: Opposing-Lane Isolation & Swept-AABB Cross-Axis Collision Prediction
  console.log('\n--- Test Group 11: Opposing Lane Lock & Cross-Axis Intersection Predictor ---');
  {
    const opposingHoriz = canLaunchOnTrack(
      [{ distTraveled: 420, width: 200, speed: 100, direction: 'rtl' }],
      200,
      100,
      1280,
      88,
      5,
      'ltr'
    );
    assert(!opposingHoriz, 'Prevents launching ltr onto track occupied by rtl');

    const opposingVert = canLaunchOnVerticalTrack(
      [{ distTraveled: 320, height: 100, speed: 80, direction: 'ttb' }],
      100,
      80,
      720,
      72,
      4,
      'btt'
    );
    assert(!opposingVert, 'Prevents launching btt onto column occupied by ttb');

    // Direct cross-axis collision test:
    // Horizontal RTL item entering x=1280 at speed=100, y=300..344 -> reaches x=640 around t=6.4s
    // Vertical TTB item at x=600..800 currently at y=200 at speed=100 -> spans y=300..344 around t=1.0..1.4s -> NO collision!
    const safeCross = willCrossAxesIntersect(
      { x: 1280, y: 300, width: 200, height: 44, direction: 'rtl', speed: 100 },
      [
        {
          instanceId: 'v-safe',
          message: { id: 'vs', name: 'A', message: 'Hi', timestamp: 1 },
          tierInfo: classifyDanmakuMessage({ id: 'vs', name: 'A', message: 'Hi', timestamp: 1 }),
          trackIndex: 1,
          axis: 'vertical',
          direction: 'ttb',
          width: 200,
          height: 100,
          speed: 100,
          distTraveled: 300,
          x: 600,
          y: 200,
          launchedAt: 0,
          isLiveArrival: false,
        },
      ],
      28,
      1280,
      720
    );
    assert(!safeCross, 'Cross-axis predictor permits items crossing same screen region at different times');

    // Now force exact same arrival time at intersection (x=500..700, y=300..344 at t=6.0s):
    // Horizontal RTL: starts at x=1280, speed=110 -> reaches x=620 at t=6.0s
    // Vertical TTB: at y=-300, speed=100 -> reaches y=300 at t=6.0s -> MUST collide!
    const collidingCross = willCrossAxesIntersect(
      { x: 1280, y: 300, width: 220, height: 44, direction: 'rtl', speed: 110 },
      [
        {
          instanceId: 'v-hit',
          message: { id: 'vh', name: 'B', message: 'Hi', timestamp: 1 },
          tierInfo: classifyDanmakuMessage({ id: 'vh', name: 'B', message: 'Hi', timestamp: 1 }),
          trackIndex: 1,
          axis: 'vertical',
          direction: 'ttb',
          width: 220,
          height: 100,
          speed: 100,
          distTraveled: 0,
          x: 520,
          y: -300,
          launchedAt: 0,
          isLiveArrival: false,
        },
      ],
      28,
      1280,
      720
    );
    assert(collidingCross, 'Cross-axis predictor catches simultaneous horizontal+vertical intersection');
  }

  // Group 12: Mixed 4-Direction Mode Distribution & Full Screen Non-Intersection Simulation
  console.log('\n--- Test Group 12: Mixed 4-Direction Distribution & Collision-Free Coexistence ---');
  {
    const pool: Message[] = Array.from({ length: 18 }, (_, idx) => ({
      id: `mix-${idx}`,
      name: `Guest ${idx + 1}`,
      message: idx % 3 === 0 ? 'May love guide every step ahead!' : 'Congratulations to the happy couple!',
      timestamp: 3000 + idx,
      status: 'approved',
      classification: idx % 5 === 0 ? 'SPECIAL_GUEST' : 'NORMAL',
    }));

    for (const preset of ['relaxed', 'balanced', 'celebration'] as const) {
      const scheduler = new DanmakuScheduler(1280, 720, {
        ...DEFAULT_MESSAGE_DISPLAY_CONFIG,
        danmaku: {
          directionMode: 'mixed',
          directions: ['right-to-left', 'left-to-right', 'top-to-bottom', 'bottom-to-top'],
          preset,
        },
        danmakuDirectionMode: 'mixed',
        danmakuDirections: ['rtl', 'ltr', 'ttb', 'btt'],
        danmakuDensity: preset,
      });
      scheduler.setMessages(pool);

      let maxActive = 0;
      for (let frame = 0; frame < 1600; frame++) {
        scheduler.step(32);
        const items = scheduler.getActiveItems();
        if (items.length > maxActive) maxActive = items.length;

        // Pairwise check EVERY active item on screen (both same-axis and cross-axis!)
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i];
            const b = items[j];
            const overlapX = a.x < b.x + b.width - 0.5 && a.x + a.width > b.x + 0.5;
            const overlapY = a.y < b.y + b.height - 0.5 && a.y + a.height > b.y + 0.5;
            if (overlapX && overlapY) {
              throw new Error(
                `Mixed (${preset}) overlap between [${a.direction}:${a.instanceId}] and [${b.direction}:${b.instanceId}] at frame ${frame}`
              );
            }
          }
        }
      }
      assert(true, `Mixed (${preset}) maintained zero same-axis or cross-axis overlap across 1600 frames`);

      const counts = scheduler.getDirectionLaunchCounts();
      const dirs: DanmakuDirection[] = ['rtl', 'ltr', 'ttb', 'btt'];
      for (const d of dirs) {
        assert(counts[d] >= 2, `Mixed (${preset}) distributed wishes to ${d} (${counts[d]} launched)`);
      }
      assert(
        maxActive <= DANMAKU_DENSITY_PRESETS[preset].maxTotalActive,
        `Mixed (${preset}) stayed within readable screen cap (${maxActive} <= ${DANMAKU_DENSITY_PRESETS[preset].maxTotalActive})`
      );
    }
  }

  console.log('\n=======================================================');
  console.log('Test Results: All Luxury Wedding Danmaku tests passed!');
  console.log('=======================================================\n');
}

runTests();
