import { ApolloProvider } from '@/apollo/components/ApolloProvider';
import { GotoHotkeysEffectsProvider } from '@/app/effect-components/GotoHotkeysEffectsProvider';
import { PageChangeEffect } from '@/app/effect-components/PageChangeEffect';
import { AuthProvider } from '@/auth/components/AuthProvider';
import { ChromeExtensionSidecarEffect } from '@/chrome-extension-sidecar/components/ChromeExtensionSidecarEffect';
import { ChromeExtensionSidecarProvider } from '@/chrome-extension-sidecar/components/ChromeExtensionSidecarProvider';
import { ClientConfigProvider } from '@/client-config/components/ClientConfigProvider';
import { ClientConfigProviderEffect } from '@/client-config/components/ClientConfigProviderEffect';
import { MainContextStoreProvider } from '@/context-store/components/MainContextStoreProvider';
import { PromiseRejectionEffect } from '@/error-handler/components/PromiseRejectionEffect';
import { ApolloMetadataClientProvider } from '@/object-metadata/components/ApolloMetadataClientProvider';
import { ObjectMetadataItemsGater } from '@/object-metadata/components/ObjectMetadataItemsGater';
import { ObjectMetadataItemsProvider } from '@/object-metadata/components/ObjectMetadataItemsProvider';
import { ModalProvider } from '@/object-record/resumes-import/ModalContext';
import { PrefetchDataProvider } from '@/prefetch/components/PrefetchDataProvider';
import { DialogManager } from '@/ui/feedback/dialog-manager/components/DialogManager';
import { DialogManagerScope } from '@/ui/feedback/dialog-manager/scopes/DialogManagerScope';
import { SnackBarProvider } from '@/ui/feedback/snack-bar-manager/components/SnackBarProvider';
import { UserThemeProviderEffect } from '@/ui/theme/components/AppThemeProvider';
import { BaseThemeProvider } from '@/ui/theme/components/BaseThemeProvider';
import { PageFavicon } from '@/ui/utilities/page-favicon/components/PageFavicon';
import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';
import { UserProvider } from '@/users/components/UserProvider';
import { UserProviderEffect } from '@/users/components/UserProviderEffect';
import { UploadProgressProvider } from '@/websocket-context/UploadProgressProvider';
import { WebSocketProvider } from '@/websocket-context/WebSocketContextProvider';
import { WorkspaceProviderEffect } from '@/workspace/components/WorkspaceProviderEffect';
import { StrictMode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { getPageTitleFromPath } from '~/utils/title-utils';

const UPLOAD_PROGRESS_PATHS = ['/jobs', '/job', '/objects', '/search', '/org-chart'];

const useIsUploadProgressRoute = () => {
  const { pathname } = useLocation();
  return UPLOAD_PROGRESS_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/'),
  );
};

export const MinimalProviders: React.FC = () => (
  <ApolloProvider>
    <BaseThemeProvider>
      <Outlet />
    </BaseThemeProvider>
  </ApolloProvider>
);

const AppContentWithOptionalUploadProgress = ({ children }: { children: React.ReactNode }) => {
  const isUploadProgressRoute = useIsUploadProgressRoute();
  if (isUploadProgressRoute) {
    return <UploadProgressProvider>{children}</UploadProgressProvider>;
  }
  return <>{children}</>;
};

export const AppRouterProviders = () => {
  const { pathname } = useLocation();
  const pageTitle = getPageTitleFromPath(pathname);
  console.log('pageTitle', pageTitle);
  return (
    <ApolloProvider>

      <BaseThemeProvider>
        <ClientConfigProviderEffect />
        <ClientConfigProvider>
          <ChromeExtensionSidecarEffect />
          <ChromeExtensionSidecarProvider>
            <UserProviderEffect />
            <WorkspaceProviderEffect />
            <UserProvider>
              <AuthProvider>
                <ApolloMetadataClientProvider>
                  <ObjectMetadataItemsProvider>
                    <ObjectMetadataItemsGater>
                      <PrefetchDataProvider>
                        <UserThemeProviderEffect />
                        <SnackBarProvider>
                          <DialogManagerScope dialogManagerScopeId="dialog-manager">
                            <DialogManager>
                              <ModalProvider>
                                <StrictMode>
                                  <PromiseRejectionEffect />
                                  <GotoHotkeysEffectsProvider />
                                  <PageTitle title={pageTitle} />
                                  <PageFavicon />
                                  <WebSocketProvider>
                                    <AppContentWithOptionalUploadProgress>
                                      <Outlet />
                                    </AppContentWithOptionalUploadProgress>
                                  </WebSocketProvider>
                                </StrictMode>
                              </ModalProvider>
                            </DialogManager>
                          </DialogManagerScope>
                        </SnackBarProvider>
                        <MainContextStoreProvider />
                      </PrefetchDataProvider>
                      <PageChangeEffect />
                    </ObjectMetadataItemsGater>
                  </ObjectMetadataItemsProvider>
                </ApolloMetadataClientProvider>
              </AuthProvider>
            </UserProvider>
          </ChromeExtensionSidecarProvider>
        </ClientConfigProvider>
      </BaseThemeProvider>
    </ApolloProvider>
  );
};
