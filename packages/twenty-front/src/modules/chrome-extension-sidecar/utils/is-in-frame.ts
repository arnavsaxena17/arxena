export const isInFrame = (): boolean =>
  typeof window !== 'undefined' && window.self !== window.top;
