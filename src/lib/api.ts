import { getSupabase } from './supabase';
import { RSVP } from '../types';

export interface Message {
  id: string;
  name: string;
  message: string;
  timestamp: number;
  project_id?: string;
}

const MOCK_MESSAGES: Message[] = [
  { id: 'm1', name: 'Alex & Sam', message: 'Wishing you a lifetime of love and happiness! Beautiful ceremony.', timestamp: Date.now() - 500000 },
  { id: 'm2', name: 'Emma Wilson', message: 'So happy for both of you! May your journey together be magical.', timestamp: Date.now() - 1200000 },
];

export async function fetchMessages(projectId?: string): Promise<Message[]> {
  try {
    const supabase = getSupabase();
    let query = supabase
      .from('messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);
    
    if (projectId) {
      query = query.eq('project_id', projectId);
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

export async function postMessage(name: string, message: string, projectId?: string): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('messages')
      .insert([
        { 
          name: name || 'Anonymous Guest', 
          message, 
          timestamp: Date.now(),
          project_id: projectId
        }
      ]);
    
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
    const supabase = getSupabase();
    const { error } = await supabase
      .from('rsvps')
      .insert([
        { 
          ...rsvp,
          created_at: new Date().toISOString()
        }
      ]);
    
    if (error) {
      console.error('Supabase RSVP error:', error);
      throw new Error(error.message);
    }
  } catch (err) {
    console.error('Failed to post RSVP:', err);
    if (String(err).includes('Supabase configuration is missing')) {
      return;
    }
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
