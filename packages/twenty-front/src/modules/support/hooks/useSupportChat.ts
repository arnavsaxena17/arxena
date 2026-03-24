import { currentUserState } from '@/auth/states/currentUserState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { supportChatState } from '@/client-config/states/supportChatState';
import { useIsPrefetchLoading } from '@/prefetch/hooks/useIsPrefetchLoading';
import { isNonEmptyString } from '@sniptt/guards';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { isDefined } from 'twenty-shared';
import { User, WorkspaceMember } from '~/generated-metadata/graphql';

const insertScript = ({
  src,
  innerHTML,
  onLoad,
  defer = false,
}: {
  src?: string;
  innerHTML?: string;
  onLoad?: (...args: any[]) => void;
  defer?: boolean;
}) => {
  const script = document.createElement('script');
  if (isNonEmptyString(src)) script.src = src;
  if (isNonEmptyString(innerHTML)) script.innerHTML = innerHTML;
  if (isDefined(onLoad)) script.onload = onLoad;
  script.defer = defer;
  document.body.appendChild(script);
};

export const useSupportChat = () => {
  const currentUser = useRecoilValue(currentUserState);
  const currentWorkspaceMember = useRecoilValue(currentWorkspaceMemberState);
  const supportChat = useRecoilValue(supportChatState);
  const [isSupportChatReady, setIsSupportChatReady] = useState(false);
  const loading = useIsPrefetchLoading();

  const configureFront = useCallback(
    (
      chatId: string,
      currentUser: Pick<User, 'email' | 'supportUserHash'>,
      currentWorkspaceMember: Pick<WorkspaceMember, 'name'>,
    ) => {
      const url = 'https://chat-assets.frontapp.com/v1/chat.bundle.js';
      let script = document.querySelector(`script[src="${url}"]`);

      // This function only gets called when front chat is not loaded
      // If the script is already defined, but front chat is not loaded
      // then there was an error loading the script; reload the script
      if (isDefined(script)) {
        script.parentNode?.removeChild(script);
        script = null;
      }

      insertScript({
        src: url,
        defer: true,
        onLoad: () => {
          window.FrontChat?.('init', {
            chatId,
            useDefaultLauncher: false,
            email: currentUser.email,
            name:
              currentWorkspaceMember.name.firstName +
              ' ' +
              currentWorkspaceMember.name.lastName,
            userHash: currentUser?.supportUserHash,
          });
          setIsSupportChatReady(true);
        },
      });
    },
    [],
  );

  const configureChatwoot = useCallback(
    (
      baseUrl: string,
      websiteToken: string,
      currentUser: Pick<User, 'email' | 'supportUserHash'> | null,
      currentWorkspaceMember: Pick<WorkspaceMember, 'name'> | null,
    ) => {
      const sdkUrl = `${baseUrl.replace(/\/$/, '')}/packs/js/sdk.js`;
      let script = document.querySelector(`script[src="${sdkUrl}"]`);

      if (isDefined(script) && !window.chatwootSDK) {
        script.parentNode?.removeChild(script);
        script = null;
      }

      window.chatwootSettings = {
        hideMessageBubble: true,
        position: 'right',
        locale: 'en',
        darkMode: 'auto',
        launcherTitle: 'Chat with Arxena',
      };

      const onReady = () => {
        if (
          isNonEmptyString(currentUser?.email) &&
          isDefined(currentWorkspaceMember)
        ) {
          window.$chatwoot?.setUser?.(currentUser.email, {
            email: currentUser.email,
            name:
              currentWorkspaceMember.name.firstName +
              ' ' +
              currentWorkspaceMember.name.lastName,
          });
          window.$chatwoot?.setCustomAttributes?.({
            source: 'twenty-front',
            product: 'arxena',
          });
        }
        setIsSupportChatReady(true);
      };

      window.addEventListener('chatwoot:ready', onReady, { once: true });

      if (window.chatwootSDK) {
        window.chatwootSDK.run({
          websiteToken,
          baseUrl,
        });
        return;
      }

      insertScript({
        src: sdkUrl,
        defer: true,
        onLoad: () => {
          window.chatwootSDK?.run({
            websiteToken,
            baseUrl,
          });
        },
      });
    },
    [],
  );

  useEffect(() => {
    if (
      supportChat?.supportDriver === 'front' &&
      isNonEmptyString(supportChat.supportFrontChatId) &&
      isNonEmptyString(currentUser?.email) &&
      isDefined(currentWorkspaceMember) &&
      !isSupportChatReady
    ) {
      setTimeout(() => {
        configureFront(
          supportChat.supportFrontChatId as string,
          currentUser,
          currentWorkspaceMember,
        );
      }, 500);
    }
  }, [
    configureFront,
    currentUser,
    isSupportChatReady,
    supportChat?.supportDriver,
    supportChat.supportFrontChatId,
    currentWorkspaceMember,
  ]);

  useEffect(() => {
    if (
      supportChat?.supportDriver === 'chatwoot' &&
      isNonEmptyString(supportChat.supportChatwootBaseUrl) &&
      isNonEmptyString(supportChat.supportChatwootWebsiteToken) &&
      !isSupportChatReady
    ) {
      configureChatwoot(
        supportChat.supportChatwootBaseUrl,
        supportChat.supportChatwootWebsiteToken,
        currentUser,
        currentWorkspaceMember,
      );
    }
  }, [
    configureChatwoot,
    currentUser,
    currentWorkspaceMember,
    isSupportChatReady,
    supportChat?.supportDriver,
    supportChat.supportChatwootBaseUrl,
    supportChat.supportChatwootWebsiteToken,
  ]);

  const openSupportChat = useCallback(() => {
    if (supportChat?.supportDriver === 'front') {
      window.FrontChat?.('show');
      return;
    }

    if (supportChat?.supportDriver === 'chatwoot') {
      window.$chatwoot?.toggle?.('open');
    }
  }, [supportChat?.supportDriver]);

  return { loading, isSupportChatReady, openSupportChat };
};
