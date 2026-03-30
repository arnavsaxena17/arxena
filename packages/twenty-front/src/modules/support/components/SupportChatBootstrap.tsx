import { useSupportChat } from '@/support/hooks/useSupportChat';

/**
 * Mounts support chat initialization (e.g. Chatwoot sdk.js) without UI.
 * Used when the sign-in mock navigation drawer — which normally hosts
 * SupportDropdown — is hidden (org chart sign-in background).
 */
export const SupportChatBootstrap = () => {
  useSupportChat();
  return null;
};
