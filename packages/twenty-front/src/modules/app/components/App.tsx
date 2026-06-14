import { AppRouter } from '@/app/components/AppRouter';
import { CaptchaProvider } from '@/captcha/components/CaptchaProvider';
import { ChromeExtensionAuthBridgeEffect } from '@/chrome-extension/components/ChromeExtensionAuthBridgeEffect';
import { ApolloDevLogEffect } from '@/debug/components/ApolloDevLogEffect';
import { RecoilDebugObserverEffect } from '@/debug/components/RecoilDebugObserver';
import { AppErrorBoundary } from '@/error-handler/components/AppErrorBoundary';
import { ExceptionHandlerProvider } from '@/error-handler/components/ExceptionHandlerProvider';
import { NotificationProvider } from '@/notification-context/NotificationContextProvider';
import { SnackBarProviderScope } from '@/ui/feedback/snack-bar-manager/scopes/SnackBarProviderScope';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { HelmetProvider } from 'react-helmet-async';
import { RecoilRoot } from 'recoil';
import { RecoilURLSyncJSON } from 'recoil-sync';
import { IconsProvider } from 'twenty-ui';
import { initialI18nActivate } from '~/utils/i18n/initialI18nActivate';
import { OrgChartLinkedinSearchTypeSyncEffect } from '../../unipile/components/OrgChartLinkedinSearchTypeSyncEffect';
import { UnipileProvider } from '../../unipile/contexts/UnipileContext';
import { UploadProgressProvider } from '../../websocket-context/UploadProgressProvider';
import { WebSocketProvider } from '../../websocket-context/WebSocketContextProvider';

initialI18nActivate();

export const App = () => {
  return (
    <RecoilRoot>
      <RecoilURLSyncJSON location={{ part: 'queryParams' }}>
        <AppErrorBoundary>
          <I18nProvider i18n={i18n}>
            <CaptchaProvider>
              <RecoilDebugObserverEffect />
              <ApolloDevLogEffect />
              <SnackBarProviderScope snackBarManagerScopeId="snack-bar-manager">
                <IconsProvider>
                  <ExceptionHandlerProvider>
                    <HelmetProvider>
                      {/* <BaileysProvider> */}
                        <UnipileProvider>
                          <OrgChartLinkedinSearchTypeSyncEffect />
                          <ChromeExtensionAuthBridgeEffect />
                          <WebSocketProvider>
                            <UploadProgressProvider>
                              <NotificationProvider>
                                <AppRouter />
                              </NotificationProvider>
                            </UploadProgressProvider>
                          </WebSocketProvider>
                        </UnipileProvider>
                      {/* </BaileysProvider> */}
                    </HelmetProvider>
                  </ExceptionHandlerProvider>
                </IconsProvider>
              </SnackBarProviderScope>
            </CaptchaProvider>
          </I18nProvider>
        </AppErrorBoundary>
      </RecoilURLSyncJSON>
    </RecoilRoot>
  );
};
