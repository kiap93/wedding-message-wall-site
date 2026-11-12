/**
 * Temporary In-Memory Demo Message Service
 * 
 * Strict Production Database Protection:
 * - Keeps demo messages purely in server-side memory
 * - Never persists to Supabase or production tables
 * - Automatically expires guest demo messages after 30 minutes
 * - Enforces rate limiting and input sanitization
 * - Broadcasts in real-time to all connected WebSocket and SSE clients
 */

import { WebSocket } from 'ws';

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

export const PUBLIC_DEMO_ROOM_ID = 'eventframe-public-demo';

// Expire temporary guest messages after 30 minutes (1800000 ms)
const MESSAGE_EXPIRATION_MS = 30 * 60 * 1000;

// Maximum number of temporary messages retained in memory
const MAX_TEMPORARY_MESSAGES = 50;

// Rate limiting: max 5 messages per 30 seconds per IP
const RATE_LIMIT_WINDOW_MS = 30 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;

// In-memory store
interface DemoRoomState {
  sampleMessages: DemoMessage[];
  guestMessages: DemoMessage[];
  lastInitialized: number;
}

const rooms = new Map<string, DemoRoomState>();
const ipRequestTimestamps = new Map<string, number[]>();
const wsClients = new Set<{ ws: WebSocket; roomId: string }>();
const sseClients = new Set<{ res: any; roomId: string }>();

// Seed sample messages strictly once
function createInitialSampleMessages(roomId: string): DemoMessage[] {
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
  // Automatically purge expired guest messages
  cleanupExpiredMessages(roomId);
  return state;
}

// Sanitize user inputs to prevent HTML and script injection
export function sanitizeInput(input: string, maxLength: number): string {
  if (!input) return '';
  return input
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
    .trim()
    .slice(0, maxLength);
}

// Rate limiting check
export function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  let timestamps = ipRequestTimestamps.get(ip) || [];
  // Filter timestamps within the current window
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

  // Also cap total guest messages to prevent memory unbounded growth
  if (state.guestMessages.length > MAX_TEMPORARY_MESSAGES) {
    state.guestMessages = state.guestMessages.slice(-MAX_TEMPORARY_MESSAGES);
  }
}

// Get all active messages for a room (sample + guest messages, sorted chronologically descending)
export function getDemoMessagesSnapshot(roomId: string = PUBLIC_DEMO_ROOM_ID): DemoMessage[] {
  const state = getOrCreateDemoRoom(roomId);
  const allMessages = [...state.guestMessages, ...state.sampleMessages];
  // Sort descending by timestamp
  return allMessages.sort((a, b) => b.timestamp - a.timestamp);
}

// Add a guest message to temporary in-memory store
export function addDemoGuestMessage(
  roomId: string,
  rawName: string,
  rawMessage: string,
  ip: string = 'unknown'
): { success: boolean; message?: DemoMessage; error?: string } {
  // Validate room
  if (!roomId || roomId !== PUBLIC_DEMO_ROOM_ID) {
    return { success: false, error: 'Invalid demo room. Only public demo rooms are permitted.' };
  }

  // Rate limiting check
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Please wait ${rateLimit.retryAfter} seconds before sending another message.`
    };
  }

  // Sanitize
  const cleanName = sanitizeInput(rawName, 50) || 'Anonymous Guest';
  const cleanMessage = sanitizeInput(rawMessage, 150);

  if (!cleanMessage) {
    return { success: false, error: 'Message cannot be empty.' };
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

  // Prepend new message
  state.guestMessages.unshift(newMsg);

  // Enforce cleanup
  cleanupExpiredMessages(roomId);

  // Broadcast to all active listeners (WebSockets + SSE)
  broadcastDemoMessage(roomId, newMsg);

  return { success: true, message: newMsg };
}

// WebSocket Management
export function registerWebSocketClient(ws: WebSocket, roomId: string = PUBLIC_DEMO_ROOM_ID): () => void {
  const client = { ws, roomId };
  wsClients.add(client);

  // Send initial snapshot immediately upon connection
  try {
    const snapshot = getDemoMessagesSnapshot(roomId);
    ws.send(JSON.stringify({
      type: 'snapshot',
      roomId,
      messages: snapshot
    }));
  } catch (err) {
    console.error('[DemoWS] Error sending snapshot:', err);
  }

  return () => {
    wsClients.delete(client);
  };
}

// SSE Management
export function registerSSEClient(res: any, roomId: string = PUBLIC_DEMO_ROOM_ID): () => void {
  const client = { res, roomId };
  sseClients.add(client);

  // Send initial snapshot immediately
  try {
    const snapshot = getDemoMessagesSnapshot(roomId);
    res.write(`data: ${JSON.stringify({ type: 'snapshot', roomId, messages: snapshot })}\n\n`);
  } catch (err) {
    console.error('[DemoSSE] Error sending snapshot:', err);
  }

  return () => {
    sseClients.delete(client);
  };
}

// Broadcast to all connected clients
export function broadcastDemoMessage(roomId: string, message: DemoMessage): void {
  const payloadStr = JSON.stringify({
    type: 'new_message',
    roomId,
    message
  });

  // Broadcast to WebSockets
  for (const client of wsClients) {
    if (client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payloadStr);
      } catch (err) {
        console.error('[DemoWS] Broadcast error:', err);
      }
    }
  }

  // Broadcast to SSE
  for (const client of sseClients) {
    if (client.roomId === roomId) {
      try {
        client.res.write(`data: ${payloadStr}\n\n`);
      } catch (err) {
        console.error('[DemoSSE] Broadcast error:', err);
      }
    }
  }
}

// Diagnostics / stats
export function getDemoRoomStats(roomId: string = PUBLIC_DEMO_ROOM_ID) {
  const state = getOrCreateDemoRoom(roomId);
  return {
    roomId,
    sampleCount: state.sampleMessages.length,
    guestCount: state.guestMessages.length,
    totalCount: state.sampleMessages.length + state.guestMessages.length,
    wsClientCount: Array.from(wsClients).filter(c => c.roomId === roomId).length,
    sseClientCount: Array.from(sseClients).filter(c => c.roomId === roomId).length
  };
}

// Reset/clear for test suites
export function resetDemoRoomForTesting(roomId: string = PUBLIC_DEMO_ROOM_ID): void {
  rooms.delete(roomId);
  ipRequestTimestamps.clear();
}
