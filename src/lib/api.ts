import { RSVP, Message, MessageClassification, MessageDisplayConfig, DEFAULT_MESSAGE_DISPLAY_CONFIG } from '../types';
import { API_BASE } from './config';
import { authenticatedFetch, extractApiErrorMessage, unwrapApiData } from './auth';

export type { Message, MessageClassification, MessageDisplayConfig };
export { DEFAULT_MESSAGE_DISPLAY_CONFIG };

function buildHeaders(includeJson: boolean, eventPin?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  if (eventPin) {
    headers['X-Event-PIN'] = eventPin;
  }
  return headers;
}

export async function fetchMessages(
  projectId?: string,
  includeAll: boolean = false,
  eventPin?: string
): Promise<Message[]> {
  if (!projectId) {
    return [];
  }
  try {
    const params = new URLSearchParams({
      projectId,
      includeAll: includeAll ? 'true' : 'false',
      limit: '100',
    });
    const response = await authenticatedFetch(`${API_BASE}/api/messages?${params.toString()}`, {
      headers: buildHeaders(false, eventPin),
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json().catch(() => null);
    const data = unwrapApiData<any>(json);
    if (Array.isArray(data)) return data as Message[];
    if (Array.isArray(json?.messages)) return json.messages as Message[];
    return [];
  } catch (err) {
    console.warn('Unable to reach backend messages API:', err);
    return [];
  }
}

export async function updateMessageStatus(
  messageId: string,
  status: 'approved' | 'rejected',
  eventPin?: string
): Promise<void> {
  const response = await authenticatedFetch(`${API_BASE}/api/messages/${encodeURIComponent(messageId)}/status`, {
    method: 'POST',
    headers: buildHeaders(true, eventPin),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(err, 'Failed to update message status'));
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
  },
  eventPin?: string
): Promise<void> {
  const response = await authenticatedFetch(`${API_BASE}/api/messages/${encodeURIComponent(messageId)}/highlight`, {
    method: 'POST',
    headers: buildHeaders(true, eventPin),
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(err, 'Failed to update message highlight'));
  }
}

export async function analyzeMessagesWithAI(
  projectId: string,
  eventPin?: string
): Promise<{ suggestions: Array<{ id: string; classification: MessageClassification; reason: string }> }> {
  const response = await authenticatedFetch(`${API_BASE}/api/messages/ai-suggest`, {
    method: 'POST',
    headers: buildHeaders(true, eventPin),
    body: JSON.stringify({ projectId }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(extractApiErrorMessage(json, 'Failed to run AI highlight suggestions'));
  }

  const data = unwrapApiData<any>(json);
  return {
    suggestions: Array.isArray(data?.suggestions)
      ? data.suggestions
      : Array.isArray(json?.suggestions)
      ? json.suggestions
      : [],
  };
}

export async function updateMessageDisplayConfig(
  projectId: string,
  config: MessageDisplayConfig,
  eventPin?: string
): Promise<void> {
  const response = await authenticatedFetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/message-config`, {
    method: 'POST',
    headers: buildHeaders(true, eventPin),
    body: JSON.stringify({ config }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(err, 'Failed to update display configuration'));
  }
}

export async function postMessage(
  name: string,
  message: string,
  projectId?: string,
  autoApprove: boolean = false,
  guestCategory?: string,
  wishCategory?: 'normal' | 'funny' | 'heartfelt' | 'family'
): Promise<Message> {
  if (!projectId || projectId === 'eventframe-public-demo' || projectId === 'demo' || projectId === 'demo-project') {
    throw new Error('Demo messages cannot be persisted to production database. Use /api/demo/messages endpoint.');
  }

  const response = await fetch(`${API_BASE}/api/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'EventFrame',
    },
    credentials: 'include',
    body: JSON.stringify({
      project_id: projectId,
      name: name || 'Anonymous Guest',
      message,
      autoApprove,
      guestCategory,
      wishCategory,
    }),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || json?.success === false) {
    throw new Error(extractApiErrorMessage(json, 'Failed to post message'));
  }

  return unwrapApiData<Message>(json);
}

export async function postRSVP(rsvp: Partial<RSVP>): Promise<void> {
  const response = await fetch(`${API_BASE}/api/rsvps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'EventFrame',
    },
    credentials: 'include',
    body: JSON.stringify(rsvp),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(extractApiErrorMessage(err, 'Failed to submit RSVP'));
  }
}

export async function fetchRSVPs(projectId: string, eventPin?: string): Promise<RSVP[]> {
  try {
    const response = await authenticatedFetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/rsvps`, {
      headers: buildHeaders(false, eventPin),
    });

    if (!response.ok) {
      return [];
    }

    const json = await response.json().catch(() => null);
    const data = unwrapApiData<any>(json);
    if (Array.isArray(data)) return data as RSVP[];
    if (Array.isArray(json?.rsvps)) return json.rsvps as RSVP[];
    return [];
  } catch (err) {
    console.warn('Unable to reach backend RSVP API:', err);
    return [];
  }
}

export async function updateRSVPVIP(
  rsvpId: string,
  isVip: boolean,
  category?: string,
  eventPin?: string
): Promise<void> {
  const res = await authenticatedFetch(`${API_BASE}/api/rsvps/${encodeURIComponent(rsvpId)}/vip`, {
    method: 'PATCH',
    headers: buildHeaders(true, eventPin),
    body: JSON.stringify({ is_vip: isVip, guest_category: category }),
  });

  if (!res.ok) {
    const errJson = await res.json().catch(() => null);
    throw new Error(extractApiErrorMessage(errJson, 'Failed to update VIP status'));
  }
}
