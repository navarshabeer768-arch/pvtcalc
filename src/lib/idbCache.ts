import { openDB, type IDBPDatabase } from 'idb';
import type { ChatMessage } from '../types/chat';

const DB_NAME = 'calc-cache';
const DB_VERSION = 1;
const KEY_STORE = 'calc-keys';
const MESSAGE_STORE = 'calc-messages';
const OUTBOX_STORE = 'calc-outbox';
const MAX_CACHED_MESSAGES = 200;

export interface OutboxItem {
  id: string; // client-generated message UUID, used for idempotent send
  conversationId: string;
  senderId: string;
  content: string;
  replyToId: string | null;
  createdAt: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(KEY_STORE)) db.createObjectStore(KEY_STORE);
        if (!db.objectStoreNames.contains(MESSAGE_STORE)) {
          const store = db.createObjectStore(MESSAGE_STORE, { keyPath: 'id' });
          store.createIndex('by-conversation', 'conversationId');
        }
        if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
      },
    });
  }
  return dbPromise;
}

/**
 * Gets (or creates) a non-extractable AES-GCM key stored in IndexedDB, used
 * to encrypt cached messages at rest. This protects against casual
 * inspection of browser storage; it is not a substitute for server-side
 * security (see the README's stated limitations).
 */
async function getOrCreateKey(): Promise<CryptoKey> {
  const db = await getDb();
  const existing = await db.get(KEY_STORE, 'aes-key');
  if (existing) return existing as CryptoKey;

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await db.put(KEY_STORE, key, 'aes-key');
  return key;
}

async function encrypt(key: CryptoKey, data: unknown): Promise<{ iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer }> {
  const iv = new Uint8Array(new ArrayBuffer(12));
  crypto.getRandomValues(iv);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { iv, ciphertext };
}

async function decrypt<T>(key: CryptoKey, iv: Uint8Array<ArrayBuffer>, ciphertext: ArrayBuffer): Promise<T> {
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export async function cacheMessages(conversationId: string, messages: ChatMessage[]): Promise<void> {
  const db = await getDb();
  const key = await getOrCreateKey();
  const tx = db.transaction(MESSAGE_STORE, 'readwrite');

  for (const message of messages) {
    const { iv, ciphertext } = await encrypt(key, message);
    await tx.store.put({ id: message.id, conversationId, iv, ciphertext, createdAt: message.createdAt });
  }
  await tx.done;

  // Trim to the most recent MAX_CACHED_MESSAGES for this conversation.
  const all = await db.getAllFromIndex(MESSAGE_STORE, 'by-conversation', conversationId);
  if (all.length > MAX_CACHED_MESSAGES) {
    const sorted = all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const toRemove = sorted.slice(0, sorted.length - MAX_CACHED_MESSAGES);
    const delTx = db.transaction(MESSAGE_STORE, 'readwrite');
    for (const row of toRemove) await delTx.store.delete(row.id);
    await delTx.done;
  }
}

export async function loadCachedMessages(conversationId: string): Promise<ChatMessage[]> {
  const db = await getDb();
  const key = await getOrCreateKey();
  const rows = await db.getAllFromIndex(MESSAGE_STORE, 'by-conversation', conversationId);
  const decrypted = await Promise.all(rows.map((r) => decrypt<ChatMessage>(key, r.iv, r.ciphertext)));
  return decrypted.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function clearCachedMessages(): Promise<void> {
  const db = await getDb();
  await db.clear(MESSAGE_STORE);
}

export async function enqueueOutbox(item: OutboxItem): Promise<void> {
  const db = await getDb();
  await db.put(OUTBOX_STORE, item);
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const db = await getDb();
  return db.getAll(OUTBOX_STORE);
}

export async function removeFromOutbox(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(OUTBOX_STORE, id);
}

export async function clearCachedMedia(): Promise<void> {
  // Signed media URLs are not persisted to IndexedDB; this clears the
  // browser's HTTP cache entries for them via the Cache Storage API, if any.
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.includes('media')).map((n) => caches.delete(n)));
  }
}
