import { AppErrorBoundaryEffect } from '@/error-handler/components/internal/AppErrorBoundaryEffect';
import { checkIfItsAViteStaleChunkLazyLoadingError } from '@/error-handler/utils/checkIfItsAViteStaleChunkLazyLoadingError';
import { type ErrorInfo, type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';
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

type AppErrorBoundaryContentProps = AppErrorBoundaryProps & {
  resetKeys?: string[];
};

const AppErrorBoundaryContent = ({
  children,
  FallbackComponent,
  resetOnLocationChange = true,
  resetKeys,
}: AppErrorBoundaryContentProps) => {
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

  // Soft remount only — Reload buttons hard-refresh. Location changes clear
  // the boundary via resetKeys (and Effect as a fallback) so the shell stays
  // hydrated and nav links remount the next route.
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
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

const AppErrorBoundaryWithLocationReset = ({
  children,
  FallbackComponent,
  resetOnLocationChange = true,
}: AppErrorBoundaryProps) => {
  const location = useLocation();

  return (
    <AppErrorBoundaryContent
      FallbackComponent={FallbackComponent}
      resetOnLocationChange={resetOnLocationChange}
      resetKeys={[location.pathname, location.search]}
    >
      {children}
    </AppErrorBoundaryContent>
  );
};

export const AppErrorBoundary = ({
  children,
  FallbackComponent,
  resetOnLocationChange = true,
}: AppErrorBoundaryProps) => {
  // Root boundary sits outside the router — never call useLocation there.
  if (!resetOnLocationChange) {
    return (
      <AppErrorBoundaryContent
        FallbackComponent={FallbackComponent}
        resetOnLocationChange={false}
      >
        {children}
      </AppErrorBoundaryContent>
    );
  }

  return (
    <AppErrorBoundaryWithLocationReset
      FallbackComponent={FallbackComponent}
      resetOnLocationChange={resetOnLocationChange}
    >
      {children}
    </AppErrorBoundaryWithLocationReset>
  );
};
