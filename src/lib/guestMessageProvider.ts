/**
 * Guest Message Provider Abstraction
 * 
 * Enforces strict separation between Production and Public Demo data flows:
 * - PublicDemoGuestMessageProvider: Operates strictly in temporary server memory via /api/demo/messages.
 *   Never touches Supabase or production database tables.
 * - ProductionGuestMessageProvider: Operates on real Supabase tables for authorized production events.
 */

import { Message, MessageClassification } from '../types';
import { fetchMessages, postMessage as postProductionMessage } from './api';
import { getSupabase } from './supabase';
import {
  PUBLIC_DEMO_ROOM_ID,
  fetchDemoMessages,
  postDemoMessage,
  subscribeToDemoMessages
} from './demoService';

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
    options?: { autoApprove?: boolean; guestCategory?: string }
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

  async submitMessage(name: string, message: string): Promise<any> {
    return await postDemoMessage(name, message, this.roomIdOrProjectId);
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
    onNewMessage: (msg: Message) => void
  ): () => void {
    let channel: any = null;
    try {
      const supabase = getSupabase();
      channel = supabase
        .channel(`messages-realtime-${this.roomIdOrProjectId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `project_id=eq.${this.roomIdOrProjectId}`
          },
          (payload) => {
            const newMessage = payload.new as Message;
            if (newMessage && newMessage.status === 'approved') {
              onNewMessage(newMessage);
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.error('[ProductionProvider] Realtime subscription error:', err);
    }

    return () => {
      if (channel) {
        try {
          const supabase = getSupabase();
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  }

  async submitMessage(
    name: string,
    message: string,
    options?: { autoApprove?: boolean; guestCategory?: string }
  ): Promise<any> {
    return await postProductionMessage(
      name,
      message,
      this.roomIdOrProjectId,
      options?.autoApprove ?? false,
      options?.guestCategory
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
