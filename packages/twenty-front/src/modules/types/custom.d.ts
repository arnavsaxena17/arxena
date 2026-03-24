declare interface Window {
  FrontChat?: (method: string, ...args: any[]) => void;
  chatwootSettings?: Record<string, unknown>;
  chatwootSDK?: {
    run: (args: {
      websiteToken: string;
      baseUrl: string;
    }) => void;
  };
  $chatwoot?: {
    toggle: (state?: 'open' | 'close') => void;
    setUser?: (
      identifier: string,
      user: {
        email?: string;
        name?: string;
        identifier_hash?: string;
      },
    ) => void;
    setCustomAttributes?: (attributes: Record<string, unknown>) => void;
    reset?: () => void;
  };
}
