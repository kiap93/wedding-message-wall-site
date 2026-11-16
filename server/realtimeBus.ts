/**
 * Server-side Real-Time Project Stream Hub (SSE + WebSocket) for Node Express.
 * Replaces direct client Supabase Realtime channels so browsers never connect to Supabase directly.
 */

import type { Response } from 'express';
import type WebSocket from 'ws';

interface SseSubscription {
  res: Response;
  projectId: string;
  includeAll: boolean;
  heartbeatTimer: ReturnType<typeof setInterval>;
}

interface WsSubscription {
  ws: WebSocket;
  projectId: string;
  includeAll: boolean;
}

const sseClients = new Map<string, Set<SseSubscription>>();
const wsClients = new Map<string, Set<WsSubscription>>();

function sendSseFrame(res: Response, eventName: string, data: unknown) {
  try {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Ignore closed stream writes
  }
}

export function registerProjectSseClient(
  res: Response,
  projectId: string,
  includeAll: boolean,
  initialMessages: any[],
  initialConfig?: any
): () => void {
  const key = String(projectId);
  if (!sseClients.has(key)) {
    sseClients.set(key, new Set());
  }

  sendSseFrame(res, 'snapshot', {
    projectId: key,
    messages: initialMessages,
    config: initialConfig || null,
    timestamp: Date.now(),
  });

  const heartbeatTimer = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      // Closed
    }
  }, 20000);

  const sub: SseSubscription = {
    res,
    projectId: key,
    includeAll,
    heartbeatTimer,
  };
  sseClients.get(key)!.add(sub);

  return () => {
    clearInterval(heartbeatTimer);
    const set = sseClients.get(key);
    if (set) {
      set.delete(sub);
      if (set.size === 0) {
        sseClients.delete(key);
      }
    }
  };
}

export function registerProjectWsClient(
  ws: WebSocket,
  projectId: string,
  includeAll: boolean,
  initialMessages: any[],
  initialConfig?: any
): () => void {
  const key = String(projectId);
  if (!wsClients.has(key)) {
    wsClients.set(key, new Set());
  }

  const sub: WsSubscription = { ws, projectId: key, includeAll };
  wsClients.get(key)!.add(sub);

  try {
    if (ws.readyState === 1) {
      ws.send(
        JSON.stringify({
          type: 'snapshot',
          projectId: key,
          messages: initialMessages,
          config: initialConfig || null,
          timestamp: Date.now(),
        })
      );
    }
  } catch {
    // Ignore initial send errors
  }

  return () => {
    const set = wsClients.get(key);
    if (set) {
      set.delete(sub);
      if (set.size === 0) {
        wsClients.delete(key);
      }
    }
  };
}

export function broadcastProjectMessageUpsert(projectId: string, message: any) {
  const key = String(projectId || message?.project_id || '');
  if (!key || !message) return;

  const isApproved = !message.status || message.status === 'approved';

  const subs = sseClients.get(key);
  if (subs) {
    for (const sub of subs) {
      if (sub.includeAll || isApproved) {
        sendSseFrame(sub.res, 'message:upsert', message);
      } else if (message.id) {
        sendSseFrame(sub.res, 'message:remove', { id: message.id });
      }
    }
  }

  const wSubs = wsClients.get(key);
  if (wSubs) {
    for (const sub of wSubs) {
      if (sub.ws.readyState !== 1) continue;
      try {
        if (sub.includeAll || isApproved) {
          sub.ws.send(JSON.stringify({ type: 'message:upsert', payload: message }));
        } else if (message.id) {
          sub.ws.send(JSON.stringify({ type: 'message:remove', payload: { id: message.id } }));
        }
      } catch {
        // Ignore
      }
    }
  }
}

export function broadcastProjectConfigUpdate(
  projectId: string,
  patch: { message_display_config?: any; theme_id?: string }
) {
  const key = String(projectId);
  const subs = sseClients.get(key);
  if (subs) {
    for (const sub of subs) {
      sendSseFrame(sub.res, 'config:update', patch);
    }
  }

  const wSubs = wsClients.get(key);
  if (wSubs) {
    for (const sub of wSubs) {
      if (sub.ws.readyState !== 1) continue;
      try {
        sub.ws.send(JSON.stringify({ type: 'config:update', payload: patch }));
      } catch {
        // Ignore
      }
    }
  }
}
