/**
 * Guest Message Provider & Backend Realtime Stream Abstraction
 *
 * Enforces strict separation between Production and Public Demo data flows
 * while routing all database and realtime communication through EventFrame's backend API.
 */

import { Message, MessageDisplayConfig, WishCategory } from '../types';
import { API_BASE } from './config';
import { fetchMessages, postMessage as postProductionMessage } from './api';
import {
  PUBLIC_DEMO_ROOM_ID,
  fetchDemoMessages,
  postDemoMessage,
  subscribeToDemoMessages,
} from './demoService';

export interface GuestMessageSubmitOptions {
  autoApprove?: boolean;
  guestCategory?: string;
  wishCategory?: WishCategory;
}

export interface GuestMessageProvider {
  isDemo: boolean;
  roomIdOrProjectId: string;
  loadInitialMessages(): Promise<Message[]>;
  subscribe(
    onNewMessage: (msg: Message) => void,
    onSnapshot?: (messages: Message[]) => void
  ): () => void;
  submitMessage(
    name: string,
    message: string,
    options?: GuestMessageSubmitOptions
  ): Promise<any>;
}

export interface ProjectStreamOptions {
  projectId: string;
  includeAll?: boolean;
  pin?: string;
  onMessageUpsert?: (msg: Message) => void;
  onMessageRemove?: (messageId: string) => void;
  onSnapshot?: (messages: Message[]) => void;
  onConfigUpdate?: (payload: {
    message_display_config?: MessageDisplayConfig;
    theme_id?: string;
  }) => void;
}

/**
 * Shared Server-Sent Events (SSE) subscription against GET /api/messages/stream
 * with automatic exponential backoff reconnect and snapshot reconciliation.
 */
export function subscribeToProjectStream(options: ProjectStreamOptions): () => void {
  const {
    projectId,
    includeAll = false,
    pin,
    onMessageUpsert,
    onMessageRemove,
    onSnapshot,
    onConfigUpdate,
  } = options;

  if (!projectId) {
    return () => {};
  }

  let eventSource: EventSource | null = null;
  let isClosed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let fallbackPoll: ReturnType<typeof setInterval> | null = null;
  let reconnectAttempt = 0;

  const reconcileSnapshot = async () => {
    if (isClosed || !onSnapshot) return;
    try {
      const latest = await fetchMessages(projectId, includeAll, pin);
      if (!isClosed) onSnapshot(latest);
    } catch {
      // Silent recovery; next SSE heartbeat or poll will catch up
    }
  };

  const buildStreamUrl = () => {
    const params = new URLSearchParams({
      projectId,
      includeAll: includeAll ? 'true' : 'false',
    });
    if (pin) {
      params.set('pin', pin);
    }
    return `${API_BASE}/api/messages/stream?${params.toString()}`;
  };

  const connect = () => {
    if (isClosed || typeof EventSource === 'undefined') return;
    try {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      const source = new EventSource(buildStreamUrl(), { withCredentials: true });
      eventSource = source;

      source.addEventListener('open', () => {
        if (isClosed) return;
        if (reconnectAttempt > 0) {
          void reconcileSnapshot();
        }
        reconnectAttempt = 0;
      });

      source.addEventListener('snapshot', (event: Event) => {
        if (isClosed || !onSnapshot) return;
        try {
          const parsed = JSON.parse((event as MessageEvent).data);
          if (Array.isArray(parsed)) {
            onSnapshot(parsed as Message[]);
          }
        } catch {
          // Ignore malformed frame
        }
      });

      source.addEventListener('message:upsert', (event: Event) => {
        if (isClosed || !onMessageUpsert) return;
        try {
          const msg = JSON.parse((event as MessageEvent).data) as Message;
          if (!msg?.id) return;
          if (!includeAll && msg.status && msg.status !== 'approved') {
            onMessageRemove?.(msg.id);
            return;
          }
          onMessageUpsert(msg);
        } catch {
          // Ignore malformed frame
        }
      });

      source.addEventListener('message:remove', (event: Event) => {
        if (isClosed) return;
        try {
          const payload = JSON.parse((event as MessageEvent).data);
          if (payload?.id && onMessageRemove) {
            onMessageRemove(String(payload.id));
          } else if (onSnapshot) {
            void reconcileSnapshot();
          }
        } catch {
          // Ignore malformed frame
        }
      });

      source.addEventListener('config:update', (event: Event) => {
        if (isClosed || !onConfigUpdate) return;
        try {
          const payload = JSON.parse((event as MessageEvent).data);
          if (payload && typeof payload === 'object') {
            onConfigUpdate(payload);
          }
        } catch {
          // Ignore malformed frame
        }
      });

      source.onerror = () => {
        if (isClosed) return;
        try {
          source.close();
        } catch {}
        if (eventSource === source) {
          eventSource = null;
        }
        if (!reconnectTimer) {
          const backoff = Math.min(16000, 1500 * Math.pow(2, reconnectAttempt));
          reconnectAttempt += 1;
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
          }, backoff);
        }
      };
    } catch {
      // Fallback polling still keeps clients synchronized
    }
  };

  connect();

  if (onSnapshot) {
    fallbackPoll = setInterval(() => {
      void reconcileSnapshot();
    }, 20000);
  }

  return () => {
    isClosed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (fallbackPoll) {
      clearInterval(fallbackPoll);
      fallbackPoll = null;
    }
    if (eventSource) {
      try {
        eventSource.close();
      } catch {}
      eventSource = null;
    }
  };
}

export class PublicDemoGuestMessageProvider implements GuestMessageProvider {
  isDemo = true;
  roomIdOrProjectId: string;

  constructor(roomId: string = PUBLIC_DEMO_ROOM_ID) {
    this.roomIdOrProjectId = roomId;
  }

  async loadInitialMessages(): Promise<Message[]> {
    return await fetchDemoMessages(this.roomIdOrProjectId);
  }

  subscribe(
    onNewMessage: (msg: Message) => void,
    onSnapshot?: (messages: Message[]) => void
  ): () => void {
    return subscribeToDemoMessages(this.roomIdOrProjectId, onNewMessage, onSnapshot);
  }

  async submitMessage(
    name: string,
    message: string,
    options?: GuestMessageSubmitOptions
  ): Promise<any> {
    return await postDemoMessage(name, message, this.roomIdOrProjectId, options?.wishCategory);
  }
}

export class ProductionGuestMessageProvider implements GuestMessageProvider {
  isDemo = false;
  roomIdOrProjectId: string;
  private onConfigUpdate?: ProjectStreamOptions['onConfigUpdate'];

  constructor(
    projectId: string,
    options?: { onConfigUpdate?: ProjectStreamOptions['onConfigUpdate'] }
  ) {
    this.roomIdOrProjectId = projectId;
    this.onConfigUpdate = options?.onConfigUpdate;
  }

  async loadInitialMessages(): Promise<Message[]> {
    return await fetchMessages(this.roomIdOrProjectId);
  }

  subscribe(
    onNewMessage: (msg: Message) => void,
    onSnapshot?: (messages: Message[]) => void
  ): () => void {
    return subscribeToProjectStream({
      projectId: this.roomIdOrProjectId,
      includeAll: false,
      onMessageUpsert: onNewMessage,
      onSnapshot,
      onMessageRemove: onSnapshot
        ? () => {
            void fetchMessages(this.roomIdOrProjectId).then((latest) => onSnapshot(latest));
          }
        : undefined,
      onConfigUpdate: this.onConfigUpdate,
    });
  }

  async submitMessage(
    name: string,
    message: string,
    options?: GuestMessageSubmitOptions
  ): Promise<any> {
    return await postProductionMessage(
      name,
      message,
      this.roomIdOrProjectId,
      options?.autoApprove ?? false,
      options?.guestCategory,
      options?.wishCategory
    );
  }
}

/**
 * Factory to instantiate the appropriate provider based on context
 */
export function createGuestMessageProvider(
  projectId?: string | null,
  isExplicitDemo?: boolean,
  options?: { onConfigUpdate?: ProjectStreamOptions['onConfigUpdate'] }
): GuestMessageProvider {
  if (
    isExplicitDemo ||
    !projectId ||
    projectId === PUBLIC_DEMO_ROOM_ID ||
    projectId === 'demo' ||
    projectId === 'demo-project'
  ) {
    return new PublicDemoGuestMessageProvider(PUBLIC_DEMO_ROOM_ID);
  }
  return new ProductionGuestMessageProvider(projectId, options);
}
