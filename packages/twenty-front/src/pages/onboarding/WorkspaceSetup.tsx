import { Navigate } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { getAppPath } from 'twenty-shared/utils';

import { useDefaultHomePagePath } from '@/navigation/hooks/useDefaultHomePagePath';
import { useIsFeatureEnabled } from '@/workspace/hooks/useIsFeatureEnabled';
import { FeatureFlagKey } from '~/generated-metadata/graphql';

// Legacy route kept for bookmarks; enlarged chat now lives at /chat.
export const WorkspaceSetup = () => {
  const { defaultHomePagePath } = useDefaultHomePagePath();
  const isOnboardingAiChatEnabled = useIsFeatureEnabled(
    FeatureFlagKey.IS_ONBOARDING_AI_CHAT_ENABLED,
  );

  if (!isOnboardingAiChatEnabled) {
    return <Navigate to={defaultHomePagePath} replace />;
  }

  return (
    <Navigate to={getAppPath(AppPath.AiChat, { threadId: null })} replace />
  );
};
