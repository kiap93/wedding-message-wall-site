import { getSupabase } from './supabase';
import { RSVP, Message, MessageClassification, MessageDisplayConfig, DEFAULT_MESSAGE_DISPLAY_CONFIG } from '../types';
import { API_BASE } from './config';

export type { Message, MessageClassification, MessageDisplayConfig };
export { DEFAULT_MESSAGE_DISPLAY_CONFIG };

const MOCK_MESSAGES: Message[] = [
  { id: 'm1', name: 'Alex & Sam', message: 'Wishing you a lifetime of love and happiness! Beautiful ceremony.', timestamp: Date.now() - 500000, status: 'approved', classification: 'NORMAL', is_featured: false, is_pinned: false },
  { id: 'm2', name: 'Emma Wilson (Maid of Honor)', message: 'From our university dorms to this breathtaking altar—Sofia, you have never looked more radiant. Lucas, take care of my best friend forever!', timestamp: Date.now() - 1200000, status: 'approved', classification: 'COUPLE_SELECTED', is_featured: true, is_pinned: true },
  { id: 'm3', name: 'Grandmother Rose', message: 'May your marriage be blessed with the quiet patience, unending grace, and deep laughter that carried your grandfather and me through fifty-two wonderful years.', timestamp: Date.now() - 1800000, status: 'approved', classification: 'SPECIAL_GUEST', is_featured: true, is_pinned: false, guest_category: 'VIP' },
];

export async function fetchMessages(projectId?: string, includeAll: boolean = false): Promise<Message[]> {
  try {
    const supabase = getSupabase();
    let query = supabase
      .from('messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    if (!includeAll) {
      query = query.eq('status', 'approved');
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase fetch error:', error);
      return [];
    }

    return data && data.length > 0 ? data : (projectId ? [] : MOCK_MESSAGES);
  } catch (err) {
    console.warn('Supabase not configured or unreachable.');
    return projectId ? [] : MOCK_MESSAGES;
  }
}

export async function updateMessageStatus(messageId: string, status: 'approved' | 'rejected'): Promise<void> {
  try {
    const { authenticatedFetch } = await import('./auth');
    const response = await authenticatedFetch(`${API_BASE}/api/messages/${messageId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update message status');
    }
  } catch (err) {
    console.error('Failed to update message status:', err);
    throw err;
  }
}

export async function updateMessageHighlight(
  messageId: string, 
  updates: { 
    classification?: MessageClassification; 
    is_featured?: boolean; 
    is_pinned?: boolean;
    ai_highlight_reason?: string;
    guest_category?: string;
    wish_category?: 'normal' | 'funny' | 'heartfelt' | 'family';
  }
): Promise<void> {
  try {
    const { authenticatedFetch } = await import('./auth');
    const response = await authenticatedFetch(`${API_BASE}/api/messages/${messageId}/highlight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update message highlight');
    }
  } catch (err) {
    console.error('Failed to update message highlight:', err);
    throw err;
  }
}

export async function analyzeMessagesWithAI(
  projectId: string
): Promise<{ suggestions: Array<{ id: string; classification: MessageClassification; reason: string }> }> {
  try {
    const { authenticatedFetch } = await import('./auth');
    const response = await authenticatedFetch(`${API_BASE}/api/messages/ai-suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to run AI highlight suggestions');
    }

    return await response.json();
  } catch (err) {
    console.error('Failed to analyze messages with AI:', err);
    throw err;
  }
}

export async function updateMessageDisplayConfig(
  projectId: string,
  config: MessageDisplayConfig
): Promise<void> {
  try {
    const { authenticatedFetch } = await import('./auth');
    const response = await authenticatedFetch(`${API_BASE}/api/projects/${projectId}/message-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update display configuration');
    }
  } catch (err) {
    console.error('Failed to update message display config:', err);
    throw err;
  }
}

export async function postMessage(
  name: string, 
  message: string, 
  projectId?: string, 
  autoApprove: boolean = false,
  guestCategory?: string,
  wishCategory?: 'normal' | 'funny' | 'heartfelt' | 'family'
): Promise<void> {
  if (!projectId || projectId === 'eventframe-public-demo' || projectId === 'demo' || projectId === 'demo-project') {
    throw new Error('Demo messages cannot be persisted to production database. Use /api/demo/messages endpoint.');
  }
  try {
    const supabase = getSupabase();
    const isVip = guestCategory === 'VIP' || guestCategory === 'Family' || guestCategory === 'Bridal Party';
    const classification: MessageClassification = isVip ? 'SPECIAL_GUEST' : 'NORMAL';
    const cleanWishCategory = wishCategory && ['normal', 'funny', 'heartfelt', 'family'].includes(wishCategory)
      ? wishCategory
      : undefined;

    const payload: Record<string, any> = {
      name: name || 'Anonymous Guest', 
      message, 
      timestamp: Date.now(),
      project_id: projectId,
      status: autoApprove ? 'approved' : 'pending',
      classification,
      is_featured: false,
      is_pinned: false,
      guest_category: guestCategory || null,
    };

    if (cleanWishCategory) {
      payload.wish_category = cleanWishCategory;
    }

    let { error } = await supabase
      .from('messages')
      .insert([payload]);

    // Graceful schema fallback if Supabase table doesn't yet have wish_category column
    if (error && cleanWishCategory && /wish_category/i.test(error.message || '')) {
      delete payload.wish_category;
      const retry = await supabase.from('messages').insert([payload]);
      error = retry.error;
    }
    
    if (error) {
      console.error('Supabase insert error:', error);
      throw new Error(error.message);
    }
  } catch (err) {
    console.error('Failed to post message:', err);
    // If it's a config error, we just simulate success so the UI doesn't look broken for the demo
    if (String(err).includes('Supabase configuration is missing')) {
      return;
    }
    throw err;
  }
}

export async function postRSVP(rsvp: Partial<RSVP>): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/rsvps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rsvp)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to submit RSVP');
    }
  } catch (err) {
    console.error('Failed to post RSVP:', err);
    throw err;
  }
}

export async function fetchRSVPs(projectId: string): Promise<RSVP[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('rsvps')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase RSVP fetch error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.warn('Supabase not configured or unreachable.');
    return [];
  }
}

export async function updateRSVPVIP(
  rsvpId: string, 
  isVip: boolean, 
  category?: string
): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('rsvps')
      .update({
        is_vip: isVip,
        guest_category: isVip ? (category || 'VIP') : null
      })
      .eq('id', rsvpId);

    if (error) {
      console.warn('Direct Supabase RSVP VIP update failed, trying API proxy:', error.message);
      const res = await fetch(`${API_BASE}/api/rsvps/${rsvpId}/vip`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_vip: isVip, guest_category: category })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to update VIP status');
      }
    }
  } catch (err) {
    console.error('Failed to update RSVP VIP status:', err);
    throw err;
  }
}

