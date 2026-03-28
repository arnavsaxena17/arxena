import * as Sentry from '@sentry/react';
import { ErrorInfo, ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

import { GenericErrorFallback } from '@/error-handler/components/GenericErrorFallback';

export const AppErrorBoundary = ({ children }: { children: ReactNode }) => {
  const handleError = (_error: Error, _info: ErrorInfo) => {
    // Ignore Chrome extension errors - they're not app errors and shouldn't trigger reloads
    if (_error?.message?.includes('chrome-extension://') || 
        _error?.stack?.includes('chrome-extension://') ||
        _error?.message?.includes('Failed to fetch dynamically imported module')) {
      console.warn('Ignoring Chrome extension error in error boundary:', _error);
      return;
    }

    Sentry.captureException(_error, (scope) => {
      scope.setExtras({ _info });
      return scope;
    });
  };

  // TODO: Implement a better reset strategy, hard reload for now
  const handleReset = () => {
    console.log('handleReset causing a whole new reload of the page');
    // window.location.reload();
  };

  return (
    <ErrorBoundary
      FallbackComponent={GenericErrorFallback}
      onError={handleError}
      onReset={handleReset}
    >
      {children}
    </ErrorBoundary>
  );
};
