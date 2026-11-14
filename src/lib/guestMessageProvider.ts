/**
 * Guest Message Provider Abstraction
 * 
 * Enforces strict separation between Production and Public Demo data flows:
 * - PublicDemoGuestMessageProvider: Operates strictly in temporary server memory via /api/demo/messages.
 *   Never touches Supabase or production database tables.
 * - ProductionGuestMessageProvider: Operates on real Supabase tables for authorized production events.
 */

import { Message, WishCategory } from '../types';
import { fetchMessages, postMessage as postProductionMessage } from './api';
import { getSupabase } from './supabase';
import {
  PUBLIC_DEMO_ROOM_ID,
  fetchDemoMessages,
  postDemoMessage,
  subscribeToDemoMessages
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

  constructor(projectId: string) {
    this.roomIdOrProjectId = projectId;
  }

  async loadInitialMessages(): Promise<Message[]> {
    return await fetchMessages(this.roomIdOrProjectId);
  }

  subscribe(
    onNewMessage: (msg: Message) => void,
    onSnapshot?: (messages: Message[]) => void
  ): () => void {
    let channel: any = null;
    let isClosed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackPoll: ReturnType<typeof setInterval> | null = null;
    let reconnectAttempt = 0;

    const reconcileSnapshot = async () => {
      if (isClosed || !onSnapshot) return;
      try {
        const latest = await fetchMessages(this.roomIdOrProjectId);
        if (!isClosed) onSnapshot(latest);
      } catch {
        // Silent recovery error
      }
    };

    const startChannel = () => {
      if (isClosed) return;
      try {
        const supabase = getSupabase();
        if (channel) {
          try { supabase.removeChannel(channel); } catch {}
          channel = null;
        }

        channel = supabase
          .channel(`messages-realtime-${this.roomIdOrProjectId}-${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `project_id=eq.${this.roomIdOrProjectId}`
            },
            (payload) => {
              const eventType = payload.eventType;
              const newMessage = payload.new as Message | undefined;
              const oldMessage = payload.old as Partial<Message> | undefined;

              if (eventType === 'DELETE' || (newMessage && newMessage.status && newMessage.status !== 'approved')) {
                void reconcileSnapshot();
                return;
              }

              if (newMessage && newMessage.id && (!newMessage.status || newMessage.status === 'approved')) {
                onNewMessage(newMessage);
              } else if (oldMessage?.id) {
                void reconcileSnapshot();
              }
            }
          )
          .subscribe((status) => {
            if (isClosed) return;
            if (status === 'SUBSCRIBED') {
              if (reconnectAttempt > 0) {
                // Catch up cleanly on any messages sent while offline
                void reconcileSnapshot();
              }
              reconnectAttempt = 0;
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              const backoff = Math.min(16000, 1500 * Math.pow(2, reconnectAttempt));
              reconnectAttempt += 1;
              if (!reconnectTimer) {
                reconnectTimer = setTimeout(() => {
                  reconnectTimer = null;
                  startChannel();
                }, backoff);
              }
            }
          });
      } catch (err) {
        console.error('[ProductionProvider] Realtime subscription error:', err);
      }
    };

    startChannel();

    // Gentle 20s reconciliation heartbeat ensures zero lost or orphaned messages across network blips
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
      if (channel) {
        try {
          const supabase = getSupabase();
          supabase.removeChannel(channel);
        } catch {}
        channel = null;
      }
    };
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
  isExplicitDemo?: boolean
): GuestMessageProvider {
  if (isExplicitDemo || !projectId || projectId === PUBLIC_DEMO_ROOM_ID || projectId === 'demo' || projectId === 'demo-project') {
    return new PublicDemoGuestMessageProvider(PUBLIC_DEMO_ROOM_ID);
  }
  return new ProductionGuestMessageProvider(projectId);
}
