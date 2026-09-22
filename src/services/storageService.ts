import { supabase } from '../lib/supabase';

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export type Bucket = 'chat-media' | 'avatars' | 'memories' | 'backgrounds';

export function buildStoragePath(conversationId: string, userId: string, filename: string): string {
  return `${conversationId}/${userId}/${crypto.randomUUID()}-${filename}`;
}

export async function uploadFile(bucket: Bucket, path: string, file: Blob, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType, upsert: false });
  if (error) throw error;
}

export async function getSignedUrl(bucket: Bucket, path: string): Promise<string> {
  const cacheKey = `${bucket}/${path}`;
  const cached = signedUrlCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt - now > 60_000) return cached.url;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw error ?? new Error('Could not sign URL');

  signedUrlCache.set(cacheKey, {
    url: data.signedUrl,
    expiresAt: now + SIGNED_URL_TTL_SECONDS * 1000,
  });
  return data.signedUrl;
}

export async function removeFile(bucket: Bucket, path: string): Promise<void> {
  await supabase.storage.from(bucket).remove([path]);
  signedUrlCache.delete(`${bucket}/${path}`);
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function assertValidUpload(file: Blob, allowedTypes: string[]): void {
  if (!allowedTypes.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'}`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File is too large (max 10 MB).');
  }
}
