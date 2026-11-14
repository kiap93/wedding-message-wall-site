import { Message, WeddingEvent, Agency } from '../types';
import { API_BASE } from './config';

export const PUBLIC_DEMO_ROOM_ID = 'eventframe-public-demo';

export const PUBLIC_DEMO_PROJECT: WeddingEvent = {
  id: PUBLIC_DEMO_ROOM_ID,
  agency_id: 'eventframe-demo-agency',
  groom_name: 'Lucas',
  bride_name: 'Sofia',
  name: "Lucas & Sofia's Wedding Celebration",
  slug: 'demo',
  theme_id: 'garden',
  image_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80',
  wedding_date: '2026-06-20',
  location: 'The Glasshouse Estate, Napa Valley',
  auto_approve_messages: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export const PUBLIC_DEMO_AGENCY: Agency = {
  id: 'eventframe-demo-agency',
  name: 'EventFrame Demo',
  slug: 'demo',
  user_id: 'demo-public-user',
  user_role: 'agency',
  subscription_status: 'active',
  is_demo: true,
  logo_url: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=100&h=100',
  theme_config: { primaryColor: '#8B806F', accentColor: '#252525' },
  created_at: new Date().toISOString()
};

/**
 * Fetch current snapshot of demo messages from temporary server memory
 */
export async function fetchDemoMessages(roomId: string = PUBLIC_DEMO_ROOM_ID): Promise<Message[]> {
  try {
    const res = await fetch(`${API_BASE}/api/demo/messages?room=${encodeURIComponent(roomId)}`, {
      cache: 'no-store'
    });
    if (!res.ok) {
      console.warn(`Failed to fetch demo messages: HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return data.messages || [];
  } catch (err) {
    console.warn('Network error fetching demo messages:', err);
    return [];
  }
}

/**
 * Submit a demo message to temporary in-memory store
 */
export async function postDemoMessage(
  name: string,
  message: string,
  roomId: string = PUBLIC_DEMO_ROOM_ID,
  wishCategory?: string
): Promise<Message> {
  const res = await fetch(`${API_BASE}/api/demo/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId,
      name,
      message,
      ...(wishCategory ? { wish_category: wishCategory } : {})
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit demo message');
  }

  const data = await res.json();
  return data.message;
}

/**
 * Real-time subscription to demo messages.
 * Uses WebSocket with seamless fallback to Server-Sent Events (SSE) and polling.
 */
export function subscribeToDemoMessages(
  roomId: string = PUBLIC_DEMO_ROOM_ID,
  onNewMessage: (msg: Message) => void,
  onSnapshot?: (messages: Message[]) => void
): () => void {
  let isClosed = false;
  let ws: WebSocket | null = null;
  let eventSource: EventSource | null = null;
  let pollInterval: any = null;
  const seenIds = new Set<string>();

  const handleMessage = (msg: Message) => {
    if (!msg || !msg.id) return;
    if (seenIds.has(msg.id)) return;
    seenIds.add(msg.id);
    onNewMessage(msg);
  };

  const handleSnapshot = (messages: Message[]) => {
    if (!Array.isArray(messages)) return;
    seenIds.clear();
    for (const m of messages) {
      if (m?.id) seenIds.add(m.id);
    }
    if (onSnapshot) {
      onSnapshot(messages);
    }
  };

  let wsReconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  // Helper to fallback to SSE
  const setupSSE = () => {
    if (isClosed || eventSource) return;
    try {
      const sseUrl = `${API_BASE}/api/demo/stream?room=${encodeURIComponent(roomId)}`;
      eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'snapshot' && payload.messages) {
            handleSnapshot(payload.messages);
          } else if (payload.type === 'new_message' && payload.message) {
            handleMessage(payload.message);
          }
        } catch (e) {
          console.error('[DemoSSE] Parse error:', e);
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        setupPolling();
      };
    } catch {
      setupPolling();
    }
  };

  // Helper to fallback to polling with snapshot reconciliation
  const setupPolling = () => {
    if (isClosed || pollInterval) return;
    pollInterval = setInterval(async () => {
      if (isClosed) return;
      try {
        const msgs = await fetchDemoMessages(roomId);
        if (msgs.length === 0) return;

        // Detect controlled reset (previously seen IDs removed) or initial population
        const incomingIds = new Set(msgs.map(m => m.id));
        const hasRemovedIds = seenIds.size > 0 && Array.from(seenIds).some(id => !incomingIds.has(id));
        if (hasRemovedIds || seenIds.size === 0) {
          handleSnapshot(msgs);
          return;
        }

        for (const m of msgs) {
          if (!seenIds.has(m.id)) {
            handleMessage(m);
          }
        }
      } catch {
        // Silent polling error
      }
    }, 3000);
  };

  const connectWebSocket = () => {
    if (isClosed) return;
    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProto = isHttps ? 'wss:' : 'ws:';
      const wsHost = window.location.host;
      const wsUrl = `${wsProto}//${wsHost}/api/demo-ws?room=${encodeURIComponent(roomId)}`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        wsReconnectAttempts = 0;
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'snapshot' && payload.messages) {
            handleSnapshot(payload.messages);
          } else if (payload.type === 'new_message' && payload.message) {
            handleMessage(payload.message);
          }
        } catch (err) {
          console.error('[DemoWS] Parse error:', err);
        }
      };

      ws.onerror = () => {
        if (!isClosed && !eventSource) {
          setupSSE();
        }
      };

      ws.onclose = () => {
        if (isClosed) return;
        ws = null;
        if (!eventSource) {
          setupSSE();
        }
        // Exponential backoff WS retry if dropped cleanly after having connected
        if (wsReconnectAttempts < 4) {
          const delay = Math.min(15000, 1500 * Math.pow(2, wsReconnectAttempts));
          wsReconnectAttempts += 1;
          reconnectTimer = setTimeout(() => {
            if (!isClosed) connectWebSocket();
          }, delay);
        }
      };
    } catch {
      setupSSE();
    }
  };

  connectWebSocket();

  // Cleanup function
  return () => {
    isClosed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      try { ws.close(); } catch {}
      ws = null;
    }
    if (eventSource) {
      try { eventSource.close(); } catch {}
      eventSource = null;
    }
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };
}
