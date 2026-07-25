import { AppErrorBoundaryEffect } from '@/error-handler/components/internal/AppErrorBoundaryEffect';
import { checkIfItsAViteStaleChunkLazyLoadingError } from '@/error-handler/utils/checkIfItsAViteStaleChunkLazyLoadingError';
import { type ErrorInfo, type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { isDefined, type CustomError } from 'twenty-shared/utils';

type AppErrorBoundaryProps = {
  children: ReactNode;
  FallbackComponent: React.ComponentType<FallbackProps>;
  resetOnLocationChange?: boolean;
};

const hasErrorCode = (
  error: Error | CustomError,
): error is CustomError & { code: string } => {
  return 'code' in error && isDefined(error.code);
};

export const AppErrorBoundary = ({
  children,
  FallbackComponent,
  resetOnLocationChange = true,
}: AppErrorBoundaryProps) => {
  const handleError = async (error: Error | CustomError, info: ErrorInfo) => {
    try {
      const { captureException } = await import('@sentry/react');
      captureException(error, (scope) => {
        scope.setExtras({ info });

        const fingerprint = hasErrorCode(error) ? error.code : error.message;
        scope.setFingerprint([fingerprint]);
        error.name = error.message;
        return scope;
      });
    } catch (sentryError) {
      // oxlint-disable-next-line no-console
      console.error('Failed to capture exception with Sentry:', sentryError);
    }

    const isViteStaleChunkLazyLoadingError =
      checkIfItsAViteStaleChunkLazyLoadingError(error);

    if (isViteStaleChunkLazyLoadingError) {
      window.location.reload();
    }
  };

  // Soft remount only — Reload buttons hard-refresh; location change remounts
  // the route so the shell (nav drawer) stays hydrated and links keep working.
  return (
    <ErrorBoundary
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <>
          {resetOnLocationChange && (
            <AppErrorBoundaryEffect resetErrorBoundary={resetErrorBoundary} />
          )}
          <FallbackComponent
            error={error}
            resetErrorBoundary={resetErrorBoundary}
          />
        </>
      )}
      onError={handleError}
    >
      {children}
    </ErrorBoundary>
  );
};
