import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { ThemeProvider } from 'twenty-ui/theme-constants';

import { SignInToAnotherWorkspaceLink } from '@/auth/sign-in-up/components/SignInToAnotherWorkspaceLink';
import { isMultiWorkspaceEnabledState } from '@/client-config/states/isMultiWorkspaceEnabledState';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { dynamicActivate } from '~/utils/i18n/dynamicActivate';

const signOutMock = jest.fn();

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: signOutMock,
  }),
}));

dynamicActivate(SOURCE_LOCALE);

const renderLink = () =>
  render(
    <JotaiProvider store={jotaiStore}>
      <ThemeProvider colorScheme="light">
        <I18nProvider i18n={i18n}>
          <SignInToAnotherWorkspaceLink />
        </I18nProvider>
      </ThemeProvider>
    </JotaiProvider>,
  );

describe('SignInToAnotherWorkspaceLink', () => {
  beforeEach(() => {
    resetJotaiStore();
    signOutMock.mockClear();
  });

  it('does not render when multi-workspace is disabled', () => {
    jotaiStore.set(isMultiWorkspaceEnabledState.atom, false);

    renderLink();

    expect(
      screen.queryByText('Sign in to another workspace'),
    ).not.toBeInTheDocument();
  });

  it('signs out so the default domain can load without bouncing back', () => {
    jotaiStore.set(isMultiWorkspaceEnabledState.atom, true);

    renderLink();

    fireEvent.click(screen.getByText('Sign in to another workspace'));

    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
