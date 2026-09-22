import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

export interface ConversationBootstrap {
  conversationId: string;
  partner: Database['public']['Tables']['profiles']['Row'];
  me: Database['public']['Tables']['profiles']['Row'];
}

/**
 * This app has exactly one conversation between exactly two people. RLS
 * ensures a user only ever sees conversations they're a member of, so this
 * simply loads "the" conversation for the signed-in user.
 */
export async function bootstrapConversation(userId: string): Promise<ConversationBootstrap> {
  const { data: membership, error: membershipError } = await supabase
    .from('conversation_members')
    .select('conversation_id')
    .eq('user_id', userId)
    .limit(1)
    .single();
  if (membershipError) throw membershipError;

  const conversationId = membership.conversation_id;

  const { data: members, error: membersError } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', conversationId);
  if (membersError) throw membersError;

  const partnerId = members.map((m) => m.user_id).find((id) => id !== userId);
  if (!partnerId) throw new Error('No partner found in this conversation yet.');

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .in('id', [userId, partnerId]);
  if (profilesError) throw profilesError;

  const me = profiles.find((p) => p.id === userId);
  const partner = profiles.find((p) => p.id === partnerId);
  if (!me || !partner) throw new Error('Could not load both profiles.');

  return { conversationId, partner, me };
}
