import { Message, MessageClassification, MessageDisplayConfig, DEFAULT_MESSAGE_DISPLAY_CONFIG } from '../types';

/**
 * Priority rank map (lower number = higher priority)
 * 1. COUPLE_SELECTED
 * 2. SPECIAL_GUEST
 * 3. AI_SUGGESTED
 * 4. NORMAL
 */
export const CLASSIFICATION_PRIORITY: Record<MessageClassification, number> = {
  COUPLE_SELECTED: 1,
  SPECIAL_GUEST: 2,
  AI_SUGGESTED: 3,
  NORMAL: 4,
};

/**
 * Returns numerical priority score for sorting:
 * Lower value = higher priority.
 * Pinned messages get a major priority boost (-10) so they always lead.
 */
export function getMessagePriorityScore(message: Message): number {
  const basePriority = CLASSIFICATION_PRIORITY[message.classification || 'NORMAL'] ?? 4;
  const pinAdjustment = message.is_pinned ? -10 : 0;
  // Featured adds extra boost if not already COUPLE_SELECTED
  const featuredAdjustment = (message.is_featured && message.classification !== 'COUPLE_SELECTED') ? -0.5 : 0;
  return basePriority + pinAdjustment + featuredAdjustment;
}

/**
 * Compares two messages by priority order:
 * 1. Priority score (Pinned -> Couple Selected -> Special Guest -> AI Suggested -> Normal)
 * 2. Timestamp (Newer first)
 */
export function compareMessagesByPriority(a: Message, b: Message): number {
  const scoreA = getMessagePriorityScore(a);
  const scoreB = getMessagePriorityScore(b);

  if (scoreA !== scoreB) {
    return scoreA - scoreB;
  }
  return (b.timestamp || 0) - (a.timestamp || 0);
}

/**
 * Calculate display duration in seconds for a given message based on its classification
 */
export function getMessageDuration(message: Message, config: MessageDisplayConfig = DEFAULT_MESSAGE_DISPLAY_CONFIG): number {
  if (message.classification === 'COUPLE_SELECTED' || message.is_featured) {
    return config.coupleSelectedDuration || 18;
  }
  if (message.classification === 'SPECIAL_GUEST') {
    return config.specialGuestDuration || 12;
  }
  return config.normalDuration || 8;
}

/**
 * Interleaving & Anti-Starvation Message Rotation Scheduler
 * 
 * Guarantees:
 * 1. Pinned messages always appear first.
 * 2. Featured / Couple Selected messages are rotated into the display queue every `featuredFrequency` regular items.
 * 3. Never places more than `maxConsecutiveFeatured` featured messages in a row (prevents starvation of normal messages).
 * 4. Rotates through available featured messages in a round-robin queue, avoiding immediate back-to-back repetitions.
 * 5. Special Guest messages receive higher frequency than normal messages.
 * 6. Normal messages are never blocked or starved from display.
 */
export function scheduleMessageRotation(
  messages: Message[],
  config: MessageDisplayConfig = DEFAULT_MESSAGE_DISPLAY_CONFIG
): Message[] {
  if (!messages || messages.length === 0) return [];

  // 1. Separate into buckets
  const pinnedList: Message[] = [];
  const featuredList: Message[] = [];
  const specialGuestList: Message[] = [];
  const standardList: Message[] = [];

  for (const msg of messages) {
    if (msg.is_pinned) {
      pinnedList.push(msg);
    } else if (msg.classification === 'COUPLE_SELECTED' || msg.is_featured) {
      featuredList.push(msg);
    } else if (msg.classification === 'SPECIAL_GUEST') {
      specialGuestList.push(msg);
    } else {
      // NORMAL and AI_SUGGESTED
      standardList.push(msg);
    }
  }

  // Sort pinned by classification priority, then timestamp
  pinnedList.sort(compareMessagesByPriority);

  // If there are no standard or special guest messages, return pinned + featured
  if (standardList.length === 0 && specialGuestList.length === 0) {
    return [...pinnedList, ...featuredList];
  }

  // If there are no featured messages, interleave special guest with standard
  if (featuredList.length === 0) {
    // Interleave special guest: 1 special guest every 2 standard messages
    const regularCombined: Message[] = [];
    let sgIdx = 0;
    let stdIdx = 0;

    while (stdIdx < standardList.length || sgIdx < specialGuestList.length) {
      if (sgIdx < specialGuestList.length) {
        regularCombined.push(specialGuestList[sgIdx++]);
      }
      for (let i = 0; i < 2 && stdIdx < standardList.length; i++) {
        regularCombined.push(standardList[stdIdx++]);
      }
    }
    return [...pinnedList, ...regularCombined];
  }

  // Combine regular messages: special guest given elevated placement
  const regularQueue: Message[] = [];
  let sgIndex = 0;
  let stdIndex = 0;

  while (stdIndex < standardList.length || sgIndex < specialGuestList.length) {
    if (sgIndex < specialGuestList.length) {
      regularQueue.push(specialGuestList[sgIndex++]);
    }
    for (let i = 0; i < 2 && stdIndex < standardList.length; i++) {
      regularQueue.push(standardList[stdIndex++]);
    }
  }

  // Interleave featured messages according to config
  const frequency = Math.max(1, config.featuredFrequency || 4);
  const maxConsecutive = Math.max(1, config.maxConsecutiveFeatured || 1);

  const result: Message[] = [...pinnedList];
  let regularPtr = 0;
  let featuredPtr = 0;
  let consecutiveFeaturedCount = 0;
  let itemsSinceLastFeatured = 0;
  let lastFeaturedId: string | null = null;

  while (regularPtr < regularQueue.length) {
    // Check if it's time to inject a featured message
    const shouldInsertFeatured = 
      itemsSinceLastFeatured >= frequency &&
      consecutiveFeaturedCount < maxConsecutive &&
      featuredList.length > 0;

    if (shouldInsertFeatured) {
      // Pick next featured message, ensuring we avoid back-to-back repetitions if multiple exist
      let candidate = featuredList[featuredPtr % featuredList.length];
      if (featuredList.length > 1 && candidate.id === lastFeaturedId) {
        featuredPtr++;
        candidate = featuredList[featuredPtr % featuredList.length];
      }

      result.push(candidate);
      lastFeaturedId = candidate.id;
      featuredPtr++;
      consecutiveFeaturedCount++;
      itemsSinceLastFeatured = 0;
    } else {
      // Insert regular message
      result.push(regularQueue[regularPtr++]);
      itemsSinceLastFeatured++;
      consecutiveFeaturedCount = 0;
    }
  }

  // If there are featured messages that haven't been shown and total output is short,
  // append remaining featured messages respecting maxConsecutive
  const shownFeaturedIds = new Set(result.filter(m => m.classification === 'COUPLE_SELECTED' || m.is_featured).map(m => m.id));
  for (const f of featuredList) {
    if (!shownFeaturedIds.has(f.id)) {
      result.push(f);
      shownFeaturedIds.add(f.id);
    }
  }

  return result;
}
