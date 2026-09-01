import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { type ReactNode } from 'react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';

import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { FeatureFlagKey } from '~/generated-metadata/graphql';
import { messages } from '~/locales/generated/en';
import { WorkspaceSetup } from '~/pages/onboarding/WorkspaceSetup';
import { mockCurrentWorkspace } from '~/testing/mock-data/users';

i18n.load({ [SOURCE_LOCALE]: messages });
i18n.activate(SOURCE_LOCALE);

const defaultHomePagePath = '/objects/companies';

jest.mock('twenty-shared/utils', () => ({
  ...jest.requireActual('twenty-shared/utils'),
  getAppPath: () => '/chat',
}));

jest.mock('@/navigation/hooks/useDefaultHomePagePath', () => ({
  useDefaultHomePagePath: () => ({ defaultHomePagePath }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  Navigate: (props: { to: string }) => {
    mockNavigate(props.to);
    return <div data-testid="navigate" />;
  },
}));

const setOnboardingAiChatFeatureFlag = (value: boolean) => {
  jotaiStore.set(currentWorkspaceState.atom, {
    ...mockCurrentWorkspace,
    featureFlags: [
      { key: FeatureFlagKey.IS_ONBOARDING_AI_CHAT_ENABLED, value },
    ],
  });
};

const Wrapper = ({ children }: { children: ReactNode }) => (
  <JotaiProvider store={jotaiStore}>
    <I18nProvider i18n={i18n}>{children}</I18nProvider>
  </JotaiProvider>
);

describe('WorkspaceSetup', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetJotaiStore();
    mockNavigate.mockClear();
  });

  it('should redirect to the enlarged chat page when the feature flag is enabled', () => {
    setOnboardingAiChatFeatureFlag(true);

    const { getByTestId } = render(<WorkspaceSetup />, { wrapper: Wrapper });

    expect(getByTestId('navigate')).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/chat');
  });

  it('should redirect home when the onboarding ai chat feature flag is disabled', () => {
    setOnboardingAiChatFeatureFlag(false);

    render(<WorkspaceSetup />, { wrapper: Wrapper });

    expect(mockNavigate).toHaveBeenCalledWith(defaultHomePagePath);
  });
});
