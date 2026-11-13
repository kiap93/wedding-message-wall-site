/**
 * Runtime-Agnostic Public Demo Message Core
 *
 * Shared by both Node.js (server.ts / demoMessageService.ts) and
 * Cloudflare Workers (worker/index.ts). Contains zero Node-specific dependencies.
 *
 * Strict Production Database Protection:
 * - Operates strictly in isolated ephemeral state (never writes to Supabase / SQL)
 * - Enforces public demo room allowlist
 * - Automatically expires temporary guest messages after 30 minutes
 * - Validates and sanitizes inputs and enforces per-IP rate limiting & spam checks
 */

export interface DemoMessage {
  id: string;
  room_id: string;
  project_id: string;
  name: string;
  message: string;
  timestamp: number;
  status: 'approved';
  classification: 'NORMAL' | 'COUPLE_SELECTED' | 'SPECIAL_GUEST';
  is_featured: boolean;
  is_pinned: boolean;
  isDemoSample: boolean;
  guest_category?: string;
}

export interface DemoRoomState {
  sampleMessages: DemoMessage[];
  guestMessages: DemoMessage[];
  lastInitialized: number;
}

export const PUBLIC_DEMO_ROOM_ID = 'eventframe-public-demo';

// Expire temporary guest messages after 30 minutes (1,800,000 ms)
export const MESSAGE_EXPIRATION_MS = 30 * 60 * 1000;

// Maximum number of temporary guest messages retained per room
export const MAX_TEMPORARY_MESSAGES = 50;

// Rate limiting: max 5 messages per 30 seconds per IP
const RATE_LIMIT_WINDOW_MS = 30 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

const rooms = new Map<string, DemoRoomState>();
const ipRequestTimestamps = new Map<string, number[]>();

export function isAllowedDemoRoom(roomId?: string | null): boolean {
  return roomId === PUBLIC_DEMO_ROOM_ID;
}

export function normalizeDemoRoomId(roomId?: string | null): string {
  if (!roomId || typeof roomId !== 'string' || !roomId.trim()) {
    return PUBLIC_DEMO_ROOM_ID;
  }
  return roomId.trim();
}

// Seed sample messages strictly once per empty room
export function createInitialSampleMessages(roomId: string = PUBLIC_DEMO_ROOM_ID): DemoMessage[] {
  const now = Date.now();
  return [
    {
      id: `sample-${roomId}-1`,
      room_id: roomId,
      project_id: roomId,
      name: 'Emma & David',
      message: 'Congratulations! Wishing you both a lifetime of happiness ❤️',
      timestamp: now - 300000,
      status: 'approved',
      classification: 'COUPLE_SELECTED',
      is_featured: true,
      is_pinned: true,
      isDemoSample: true
    },
    {
      id: `sample-${roomId}-2`,
      room_id: roomId,
      project_id: roomId,
      name: 'Uncle Robert',
      message: 'So happy to celebrate this beautiful day with you!',
      timestamp: now - 240000,
      status: 'approved',
      classification: 'SPECIAL_GUEST',
      is_featured: true,
      is_pinned: false,
      isDemoSample: true,
      guest_category: 'Family'
    },
    {
      id: `sample-${roomId}-3`,
      room_id: roomId,
      project_id: roomId,
      name: 'Sarah Jenkins',
      message: 'May your love grow stronger every year.',
      timestamp: now - 180000,
      status: 'approved',
      classification: 'NORMAL',
      is_featured: false,
      is_pinned: false,
      isDemoSample: true
    },
    {
      id: `sample-${roomId}-4`,
      room_id: roomId,
      project_id: roomId,
      name: 'The Anderson Family',
      message: 'Wishing you endless laughter and beautiful memories.',
      timestamp: now - 120000,
      status: 'approved',
      classification: 'NORMAL',
      is_featured: false,
      is_pinned: false,
      isDemoSample: true
    },
    {
      id: `sample-${roomId}-5`,
      room_id: roomId,
      project_id: roomId,
      name: 'Marcus & Chloe',
      message: 'Finally! The perfect couple! Congratulations!',
      timestamp: now - 60000,
      status: 'approved',
      classification: 'NORMAL',
      is_featured: false,
      is_pinned: false,
      isDemoSample: true
    },
    {
      id: `sample-${roomId}-6`,
      room_id: roomId,
      project_id: roomId,
      name: 'Grandma Evelyn',
      message: 'Sending lots of love and blessings to both of you.',
      timestamp: now - 30000,
      status: 'approved',
      classification: 'SPECIAL_GUEST',
      is_featured: true,
      is_pinned: false,
      isDemoSample: true,
      guest_category: 'VIP'
    }
  ];
}

// Get or initialize room state (idempotent, avoids duplicate samples)
export function getOrCreateDemoRoom(roomId: string = PUBLIC_DEMO_ROOM_ID): DemoRoomState {
  let state = rooms.get(roomId);
  if (!state) {
    state = {
      sampleMessages: createInitialSampleMessages(roomId),
      guestMessages: [],
      lastInitialized: Date.now()
    };
    rooms.set(roomId, state);
  }
  cleanupExpiredMessages(roomId);
  return state;
}

// Hydrate room state from external ephemeral cache (e.g., Cloudflare Cache API)
export function hydrateDemoRoom(roomId: string, incoming: DemoRoomState | null | undefined): DemoRoomState {
  if (
    incoming &&
    Array.isArray(incoming.sampleMessages) &&
    incoming.sampleMessages.length > 0 &&
    Array.isArray(incoming.guestMessages)
  ) {
    rooms.set(roomId, {
      sampleMessages: incoming.sampleMessages,
      guestMessages: incoming.guestMessages,
      lastInitialized: incoming.lastInitialized || Date.now()
    });
  }
  return getOrCreateDemoRoom(roomId);
}

// Export serializable snapshot of room state
export function exportDemoRoomState(roomId: string = PUBLIC_DEMO_ROOM_ID): DemoRoomState {
  const state = getOrCreateDemoRoom(roomId);
  return {
    sampleMessages: [...state.sampleMessages],
    guestMessages: [...state.guestMessages],
    lastInitialized: state.lastInitialized
  };
}

// Sanitize user inputs to prevent HTML and script injection
export function sanitizeInput(input: string, maxLength: number): string {
  if (typeof input !== 'string' || !input) return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // Replace control characters
    .replace(/<[^>]*>?/gm, '') // Strip HTML tags
    .replace(/[<>'"]/g, (tag) => {
      switch (tag) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case "'": return '&#39;';
        case '"': return '&quot;';
        default: return tag;
      }
    })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

// Basic spam pattern check
export function isSpamContent(text: string): boolean {
  if (!text) return false;
  // Block script/data URIs and excessive URLs
  if (/(?:javascript|data):/i.test(text)) return true;
  const urlMatches = text.match(/https?:\/\/\S+/gi);
  if (urlMatches && urlMatches.length > 0) return true;
  // Block 15+ consecutive identical characters (e.g. aaaaaaaaaaaaaaa)
  if (/(.)\1{14,}/.test(text)) return true;
  return false;
}

// Rate limiting check
export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  let timestamps = ipRequestTimestamps.get(ip) || [];
  timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  timestamps.push(now);
  ipRequestTimestamps.set(ip, timestamps);
  return { allowed: true };
}

// Clean up expired guest messages
export function cleanupExpiredMessages(roomId: string = PUBLIC_DEMO_ROOM_ID): void {
  const state = rooms.get(roomId);
  if (!state) return;

  const now = Date.now();
  state.guestMessages = state.guestMessages.filter(msg => {
    return (now - msg.timestamp) < MESSAGE_EXPIRATION_MS;
  });

  if (state.guestMessages.length > MAX_TEMPORARY_MESSAGES) {
    state.guestMessages = state.guestMessages.slice(0, MAX_TEMPORARY_MESSAGES);
  }
}

// Get all active messages for a room (sample + guest messages, sorted chronologically descending)
export function getDemoMessagesSnapshot(roomId: string = PUBLIC_DEMO_ROOM_ID): DemoMessage[] {
  const state = getOrCreateDemoRoom(roomId);
  const allMessages = [...state.guestMessages, ...state.sampleMessages];
  return allMessages.sort((a, b) => b.timestamp - a.timestamp);
}

export interface AddDemoMessageResult {
  success: boolean;
  message?: DemoMessage;
  error?: string;
  statusCode?: number;
}

// Add a guest message to isolated demo store
export function addDemoGuestMessageCore(
  roomId: string,
  rawName: unknown,
  rawMessage: unknown,
  ip: string = 'unknown'
): AddDemoMessageResult {
  // Validate room strictly
  if (!isAllowedDemoRoom(roomId)) {
    return {
      success: false,
      statusCode: 400,
      error: 'Invalid demo room. Only public demo rooms are permitted.'
    };
  }

  // Validate required types
  if (typeof rawName !== 'string' || typeof rawMessage !== 'string') {
    return {
      success: false,
      statusCode: 400,
      error: 'Both guest name and message content are required.'
    };
  }

  // Sanitize inputs
  const cleanName = sanitizeInput(rawName, 50);
  const cleanMessage = sanitizeInput(rawMessage, 150);

  if (!cleanName) {
    return {
      success: false,
      statusCode: 400,
      error: 'Guest name is required.'
    };
  }

  if (!cleanMessage) {
    return {
      success: false,
      statusCode: 400,
      error: 'Message content cannot be empty.'
    };
  }

  if (isSpamContent(cleanName) || isSpamContent(cleanMessage)) {
    return {
      success: false,
      statusCode: 400,
      error: 'Message rejected by spam protection. Please enter a plain wedding wish without links.'
    };
  }

  // Rate limiting check (after basic validation so invalid payloads don't exhaust quota silently, or check before)
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return {
      success: false,
      statusCode: 429,
      error: `Rate limit exceeded. Please wait ${rateLimit.retryAfter} seconds before sending another message.`
    };
  }

  const state = getOrCreateDemoRoom(roomId);

  const newMsg: DemoMessage = {
    id: `guest-${roomId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    room_id: roomId,
    project_id: roomId,
    name: cleanName,
    message: cleanMessage,
    timestamp: Date.now(),
    status: 'approved',
    classification: 'NORMAL',
    is_featured: false,
    is_pinned: false,
    isDemoSample: false
  };

  state.guestMessages.unshift(newMsg);
  cleanupExpiredMessages(roomId);

  return { success: true, statusCode: 201, message: newMsg };
}

// Controlled reset for public demo room (re-initializes clean sample messages, clears guest messages)
export function resetPublicDemoRoom(roomId: string = PUBLIC_DEMO_ROOM_ID): {
  success: boolean;
  messages?: DemoMessage[];
  error?: string;
} {
  if (!isAllowedDemoRoom(roomId)) {
    return {
      success: false,
      error: 'Invalid room. Only the public demo room can be reset.'
    };
  }

  const freshState: DemoRoomState = {
    sampleMessages: createInitialSampleMessages(roomId),
    guestMessages: [],
    lastInitialized: Date.now()
  };
  rooms.set(roomId, freshState);

  return {
    success: true,
    messages: getDemoMessagesSnapshot(roomId)
  };
}

// Diagnostics / stats
export function getDemoRoomCoreStats(roomId: string = PUBLIC_DEMO_ROOM_ID) {
  const state = getOrCreateDemoRoom(roomId);
  return {
    roomId,
    sampleCount: state.sampleMessages.length,
    guestCount: state.guestMessages.length,
    totalCount: state.sampleMessages.length + state.guestMessages.length
  };
}

// Reset/clear for test suites
export function resetDemoRoomForTesting(roomId: string = PUBLIC_DEMO_ROOM_ID): void {
  rooms.delete(roomId);
  ipRequestTimestamps.clear();
}
