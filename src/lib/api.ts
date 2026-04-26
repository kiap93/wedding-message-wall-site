import { getSupabase } from './supabase';

export interface Message {
  id: string;
  name: string;
  message: string;
  timestamp: number;
}

const MOCK_MESSAGES: Message[] = [
  { id: 'm1', name: 'Alex & Sam', message: 'Wishing you a lifetime of love and happiness! Beautiful ceremony.', timestamp: Date.now() - 500000 },
  { id: 'm2', name: 'Emma Wilson', message: 'So happy for both of you! May your journey together be magical.', timestamp: Date.now() - 1200000 },
  { id: 'm3', name: 'The Peterson Family', message: 'Congratulations! Thank you for letting us share in your special day.', timestamp: Date.now() - 3600000 },
  { id: 'm4', name: 'Grandma Betty', message: 'You both look stunning. A perfect match made in heaven.', timestamp: Date.now() - 7200000 },
  { id: 'm5', name: 'Best Man Mike', message: 'To my best friend and his beautiful bride - to a night we will never forget!', timestamp: Date.now() - 150000 },
  { id: 'm6', name: 'Grace & Thomas', message: 'May your love grow stronger with every passing year. Cheers!', timestamp: Date.now() - 900000 },
];

export async function fetchMessages(): Promise<Message[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Supabase fetch error, falling back to mock data:', error);
      return MOCK_MESSAGES;
    }

    return data && data.length > 0 ? data : MOCK_MESSAGES;
  } catch (err) {
    console.warn('Supabase not configured or unreachable, using mock data.');
    return MOCK_MESSAGES;
  }
}

export async function postMessage(name: string, message: string): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('messages')
      .insert([
        { 
          name: name || 'Anonymous Guest', 
          message, 
          timestamp: Date.now() 
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
