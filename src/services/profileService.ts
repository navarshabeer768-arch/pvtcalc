import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<ProfileRow, 'name' | 'avatar_path' | 'pronoun_label'>>
): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}
