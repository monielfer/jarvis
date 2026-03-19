import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('[Memory] Supabase credentials not set — persistent memory disabled.');
}

export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

/**
 * Save a conversation turn to persistent memory.
 * @param {{ sessionId: string, role: 'user'|'assistant', content: string }} entry
 */
export async function saveMemory({ sessionId, role, content }) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('memories')
    .insert({ session_id: sessionId, role, content });

  if (error) console.error('[Memory] Save error:', error.message);
  return data;
}

/**
 * Retrieve conversation history for a session.
 * @param {string} sessionId
 * @param {number} limit
 */
export async function getMemory(sessionId, limit = 20) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) console.error('[Memory] Fetch error:', error.message);
  return data || [];
}
