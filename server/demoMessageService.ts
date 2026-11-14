/**
 * Node.js Temporary In-Memory Demo Message Service
 *
 * Delegates all core validation, sanitization, seeding, rate limiting, and
 * storage logic to ./demoMessageCore.ts and adds WebSocket & SSE broadcasting
 * for the Express dev/server runtime.
 */

import { WebSocket } from 'ws';
import {
  DemoMessage,
  PUBLIC_DEMO_ROOM_ID,
  isAllowedDemoRoom,
  normalizeDemoRoomId,
  getOrCreateDemoRoom,
  sanitizeInput,
  checkRateLimit,
  cleanupExpiredMessages,
  getDemoMessagesSnapshot,
  addDemoGuestMessageCore,
  resetPublicDemoRoom as resetPublicDemoRoomCore,
  getDemoRoomCoreStats,
  resetDemoRoomForTesting,
  AddDemoMessageResult
} from './demoMessageCore';

export type { DemoMessage, AddDemoMessageResult };
export {
  PUBLIC_DEMO_ROOM_ID,
  isAllowedDemoRoom,
  normalizeDemoRoomId,
  getOrCreateDemoRoom,
  sanitizeInput,
  checkRateLimit,
  cleanupExpiredMessages,
  getDemoMessagesSnapshot,
  resetDemoRoomForTesting
};

const wsClients = new Set<{ ws: WebSocket; roomId: string }>();
const sseClients = new Set<{ res: any; roomId: string }>();

// Add a guest message to temporary in-memory store and broadcast in real-time
export function addDemoGuestMessage(
  roomId: string,
  rawName: unknown,
  rawMessage: unknown,
  ip: string = 'unknown',
  rawWishCategory?: unknown
): AddDemoMessageResult {
  const result = addDemoGuestMessageCore(roomId, rawName, rawMessage, ip, rawWishCategory);
  if (result.success && result.message) {
    broadcastDemoMessage(roomId, result.message);
  }
  return result;
}

// Controlled demo reset + broadcast updated snapshot
export function resetPublicDemoRoom(roomId: string = PUBLIC_DEMO_ROOM_ID) {
  const result = resetPublicDemoRoomCore(roomId);
  if (result.success && result.messages) {
    broadcastDemoSnapshot(roomId, result.messages);
  }
  return result;
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

// Broadcast new message to all connected clients
export function broadcastDemoMessage(roomId: string, message: DemoMessage): void {
  const payloadStr = JSON.stringify({
    type: 'new_message',
    roomId,
    message
  });

  for (const client of wsClients) {
    if (client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payloadStr);
      } catch (err) {
        console.error('[DemoWS] Broadcast error:', err);
      }
    }
  }

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

// Broadcast full snapshot (e.g., on controlled reset)
export function broadcastDemoSnapshot(roomId: string, messages: DemoMessage[]): void {
  const payloadStr = JSON.stringify({
    type: 'snapshot',
    roomId,
    messages
  });

  for (const client of wsClients) {
    if (client.roomId === roomId && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(payloadStr);
      } catch (err) {
        console.error('[DemoWS] Snapshot broadcast error:', err);
      }
    }
  }

  for (const client of sseClients) {
    if (client.roomId === roomId) {
      try {
        client.res.write(`data: ${payloadStr}\n\n`);
      } catch (err) {
        console.error('[DemoSSE] Snapshot broadcast error:', err);
      }
    }
  }
}

// Diagnostics / stats
export function getDemoRoomStats(roomId: string = PUBLIC_DEMO_ROOM_ID) {
  const core = getDemoRoomCoreStats(roomId);
  return {
    ...core,
    wsClientCount: Array.from(wsClients).filter(c => c.roomId === roomId).length,
    sseClientCount: Array.from(sseClients).filter(c => c.roomId === roomId).length
  };
}
