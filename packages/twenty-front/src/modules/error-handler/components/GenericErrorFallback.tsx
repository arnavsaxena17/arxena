import { AnimatedPlaceholder, AnimatedPlaceholderEmptyContainer, AnimatedPlaceholderEmptySubTitle, AnimatedPlaceholderEmptyTextContainer, AnimatedPlaceholderEmptyTitle, Button } from 'twenty-ui';
import { IconRefresh } from 'twenty-ui/icons';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { useEffect, useState } from 'react';
import { FallbackProps } from 'react-error-boundary';
import { useLocation } from 'react-router-dom';

type GenericErrorFallbackProps = FallbackProps & {
  title?: string;
  hidePageHeader?: boolean;
};

export const GenericErrorFallback = ({
  error,
  resetErrorBoundary,
  title = 'Sorry, something went wrong',
  hidePageHeader = false,
}: GenericErrorFallbackProps) => {
  const location = useLocation();

  const [previousLocation] = useState(location);

  useEffect(() => {
    // Ignore Chrome extension errors - don't auto-reset on location changes for these
    const isChromeExtensionError = 
      error?.message?.includes('chrome-extension://') || 
      error?.stack?.includes('chrome-extension://') ||
      error?.message?.includes('Failed to fetch dynamically imported module');
    
    if (isChromeExtensionError) {
      console.warn('Chrome extension error detected, skipping auto-reset on location change');
      return;
    }

    // Only reset if the pathname actually changed (not just query params or hash)
    // This prevents unnecessary reloads on minor location changes
    if (previousLocation.pathname !== location.pathname) {
      resetErrorBoundary();
    }
  }, [previousLocation.pathname, location.pathname, resetErrorBoundary, error]);

  return (
    <PageContainer>
      {!hidePageHeader && <PageHeader />}

      <PageBody>
        <AnimatedPlaceholderEmptyContainer>
          <AnimatedPlaceholder type="errorIndex" />
          <AnimatedPlaceholderEmptyTextContainer>
            <AnimatedPlaceholderEmptyTitle>
              {title}
            </AnimatedPlaceholderEmptyTitle>
            <AnimatedPlaceholderEmptySubTitle>
              {error.message}
            </AnimatedPlaceholderEmptySubTitle>
          </AnimatedPlaceholderEmptyTextContainer>
          <Button
            Icon={IconRefresh}
            title="Reload"
            variant={'secondary'}
            onClick={resetErrorBoundary}
          />
        </AnimatedPlaceholderEmptyContainer>
      </PageBody>
    </PageContainer>
  );
};
