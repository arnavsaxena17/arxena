import { AuthModal } from '@/auth/components/AuthModal';
import { signInBackgroundUseOrgChartMockState } from '@/client-config/states/signInBackgroundUseOrgChartMockState';
import { CommandMenuRouter } from '@/command-menu/components/CommandMenuRouter';
import { AppErrorBoundary } from '@/error-handler/components/AppErrorBoundary';
import { InformationBannerWrapper } from '@/information-banner/components/InformationBannerWrapper';
import { KeyboardShortcutMenu } from '@/keyboard-shortcut-menu/components/KeyboardShortcutMenu';
import { AppNavigationDrawer } from '@/navigation/components/AppNavigationDrawer';
import { MobileNavigationBar } from '@/navigation/components/MobileNavigationBar';
import { useIsSettingsPage } from '@/navigation/hooks/useIsSettingsPage';
import { OBJECT_SETTINGS_WIDTH } from '@/settings/data-model/constants/ObjectSettings';
import { SignInAppNavigationDrawerMock } from '@/sign-in-background-mock/components/SignInAppNavigationDrawerMock';
import { SignInBackgroundMockPage } from '@/sign-in-background-mock/components/SignInBackgroundMockPage';
import { SupportChatBootstrap } from '@/support/components/SupportChatBootstrap';
import { AppPath } from '@/types/AppPath';
import { useShowAuthModal } from '@/ui/layout/hooks/useShowAuthModal';
import { NAV_DRAWER_WIDTHS } from '@/ui/navigation/navigation-drawer/constants/NavDrawerWidths';
import { useIsMobile } from '@/ui/utilities/responsive/hooks/useIsMobile';
import { Global, css, useTheme } from '@emotion/react';
import styled from '@emotion/styled';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { useScreenSize } from 'twenty-ui';

const StyledLayout = styled.div`
  background: ${({ theme }) => theme.background.noisy};
  display: flex;
  flex-direction: column;
  height: 100dvh;
  position: relative;
  scrollbar-color: ${({ theme }) => theme.border.color.medium};
  scrollbar-width: 4px;
  width: 100%;

  *::-webkit-scrollbar {
    height: 4px;
    width: 4px;
  }

  *::-webkit-scrollbar-corner {
    background-color: transparent;
  }

  *::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: ${({ theme }) => theme.border.radius.sm};
  }
`;

const StyledPageContainer = styled(motion.div)`
  display: flex;
  flex: 1 1 auto;
  flex-direction: row;
  min-height: 0;
`;

const StyledAppNavigationDrawer = styled(AppNavigationDrawer)`
  flex-shrink: 0;
`;

const StyledAppNavigationDrawerMock = styled(SignInAppNavigationDrawerMock)`
  flex-shrink: 0;
`;

const StyledMainContainer = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;

const StyledRoutedContent = styled.div`
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
`;

export const DefaultLayout = () => {
  const isMobile = useIsMobile();
  const isSettingsPage = useIsSettingsPage();
  const location = useLocation();
  const theme = useTheme();
  const windowsWidth = useScreenSize().width;
  const showAuthModal = useShowAuthModal();
  const signInBackgroundUseOrgChartMock = useRecoilValue(
    signInBackgroundUseOrgChartMockState,
  );
  const usesIntentWideAuthModal =
    location.pathname === AppPath.IntentChoice ||
    location.pathname === AppPath.CompetitiveResearchOnboarding ||
    location.pathname === AppPath.CorporateTaOnboarding ||
    location.pathname === AppPath.DealDiligenceOnboarding;

  const useTopAlignedAuthModalContent =
    usesIntentWideAuthModal ||
    location.pathname === AppPath.ExtensionInstallOnboarding;

  return (
    <>
      <Global
        styles={css`
          body {
            background: ${theme.background.tertiary};
          }
        `}
      />
      <StyledLayout>
        {!showAuthModal && (
          <>
            <CommandMenuRouter />
            <KeyboardShortcutMenu />
          </>
        )}
        <StyledPageContainer
          animate={{
            marginLeft:
              isSettingsPage && !isMobile
                ? (windowsWidth -
                    (OBJECT_SETTINGS_WIDTH +
                      NAV_DRAWER_WIDTHS.menu.desktop.expanded +
                      64)) /
                  50
                : 0,
          }}
          transition={{ duration: theme.animation.duration.normal }}
        >
          <SupportChatBootstrap />
          {showAuthModal ? (
            <>
              {!signInBackgroundUseOrgChartMock && (
                <StyledAppNavigationDrawerMock />
              )}
              <SignInBackgroundMockPage />
              <AnimatePresence mode="wait">
                <LayoutGroup>
                  <AuthModal
                    contentVerticalAlign={
                      useTopAlignedAuthModalContent ? 'start' : 'center'
                    }
                    size={usesIntentWideAuthModal ? 'large' : 'medium'}
                  >
                    <Outlet />
                  </AuthModal>
                </LayoutGroup>
              </AnimatePresence>
            </>
          ) : (
            <>
              <StyledAppNavigationDrawer />
              <StyledMainContainer>
                <AppErrorBoundary>
                  <InformationBannerWrapper />
                  <StyledRoutedContent>
                    <Outlet />
                  </StyledRoutedContent>
                </AppErrorBoundary>
              </StyledMainContainer>
            </>
          )}
        </StyledPageContainer>
        {isMobile && <MobileNavigationBar />}
      </StyledLayout>
    </>
  );
};
