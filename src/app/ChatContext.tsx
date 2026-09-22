import { createContext, useContext } from 'react';
import type { ConversationBootstrap } from '../services/conversationService';
import type { UserSettings } from '../services/settingsService';

export interface ChatContextValue extends ConversationBootstrap {
  settings: UserSettings;
  refreshSettings: () => Promise<void>;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatContext.Provider');
  return ctx;
}
