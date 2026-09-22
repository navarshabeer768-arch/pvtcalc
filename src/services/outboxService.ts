import { enqueueOutbox, listOutbox, removeFromOutbox, type OutboxItem } from '../lib/idbCache';
import { sendTextMessage } from './messageService';

export async function queueTextMessage(item: OutboxItem): Promise<void> {
  await enqueueOutbox(item);
}

/**
 * Flushes the outbox on reconnect. Each item carries the client-generated
 * message id used on the first send attempt, so a retry after a partial
 * success (network dropped after the insert committed) is a harmless
 * duplicate-key no-op rather than a double-send.
 */
export async function flushOutbox(): Promise<{ sent: number; failed: number }> {
  const items = await listOutbox();
  let sent = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await sendTextMessage({
        id: item.id,
        conversationId: item.conversationId,
        senderId: item.senderId,
        content: item.content,
        replyToId: item.replyToId,
      });
      await removeFromOutbox(item.id);
      sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      // Duplicate primary key => already sent successfully before; drop it.
      if (message.includes('duplicate key')) {
        await removeFromOutbox(item.id);
        sent++;
      } else {
        failed++;
      }
    }
  }

  return { sent, failed };
}
