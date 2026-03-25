import { isDefined } from 'twenty-shared';

const LINKEDIN_HOST_REGEX = /(?:^|\.)linkedin\.com$/i;
const LINKEDIN_PAGE_REGEX = /^https?:\/\/(?:[\w-]+\.)?linkedin\.com/i;

type LinkedinSyncStatus = {
  success: boolean;
  authenticated: boolean;
  onLinkedinPage: boolean;
  cookies?: {
    hasLiAt: boolean;
    hasLiA: boolean;
  };
  linkedin?: {
    accountId: string | null;
    status:
      | 'connected'
      | 'disconnected'
      | 'pending'
      | 'checkpoint_required'
      | 'not_connected';
    connected: boolean;
  };
  reconnect?: {
    attempted: boolean;
    succeeded: boolean;
    message: string | null;
  };
  error?: string;
};

// Open options page programmatically in a new tab.
// chrome.runtime.onInstalled.addListener((details) => {
//   if (details.reason === 'install') {
//     openOptionsPage();
//   }
// });

// chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// This listens for an event from other parts of the extension, such as the content script, and performs the required tasks.
// The cases themselves are labelled such that their operations are reflected by their names.
// chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
//   switch (message.action) {
//     case 'getActiveTab': {
//       // e.g. "https://linkedin.com/company/twenty/"
//       chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
//         if (isDefined(tab) && isDefined(tab.id)) {
//           sendResponse({ tab });
//         }
//       });
//       break;
//     }
//     case 'openSidepanel': {
//       chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
//         if (isDefined(tab) && isDefined(tab.id)) {
//           chrome.sidePanel.open({ tabId: tab.id });
//         }
//       });
//       break;
//     }
//     default:
//       break;
//   }

//   return true;
// });

// chrome.tabs.onUpdated.addListener(async (tabId, _, tab) => {
//   const isDesiredRoute =
//     tab.url?.match(/^https?:\/\/(?:www\.)?linkedin\.com\/company(?:\/\S+)?/) ||
//     tab.url?.match(/^https?:\/\/(?:www\.)?linkedin\.com\/in(?:\/\S+)?/);

//   if (tab.active === true) {
//     if (isDefined(isDesiredRoute)) {
//       chrome.tabs.sendMessage(tabId, { action: 'executeContentScript' });
//     }
//   }

//   await chrome.sidePanel.setOptions({
//     tabId,
//     path: tab.url?.match(/^https?:\/\/(?:www\.)?linkedin\.com/)
//       ? 'sidepanel.html'
//       : 'page-inaccessible.html',
//     enabled: true,
//   });
// });

const setTokenStateFromCookie = (cookie: string) => {
  const decodedValue = decodeURIComponent(cookie);
  const tokenPair = JSON.parse(decodedValue);
  if (isDefined(tokenPair)) {
    chrome.storage.local.set({
      isAuthenticated: true,
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
    });
  }
};

const getStoredAccessToken = async (): Promise<string | null> => {
  const store = await chrome.storage.local.get(['accessToken']);
  const accessToken = store.accessToken;

  if (!isDefined(accessToken)) {
    return null;
  }

  if (typeof accessToken === 'string') {
    return accessToken;
  }

  if (typeof accessToken?.token === 'string') {
    return accessToken.token;
  }

  return null;
};

const getServerBaseUrl = async (): Promise<string> => {
  const store = await chrome.storage.local.get(['serverBaseUrl']);

  return isDefined(store.serverBaseUrl)
    ? store.serverBaseUrl
    : import.meta.env.VITE_SERVER_BASE_URL;
};

const getLinkedinCookieValues = async (): Promise<{
  liAt: string | null;
  liA: string | null;
}> => {
  const cookies = await chrome.cookies.getAll({});
  const linkedinCookies = cookies.filter(
    (cookie) =>
      LINKEDIN_HOST_REGEX.test(cookie.domain.replace(/^\./, '')) &&
      (cookie.name === 'li_at' || cookie.name === 'li_a'),
  );

  return {
    liAt: linkedinCookies.find((cookie) => cookie.name === 'li_at')?.value ?? null,
    liA: linkedinCookies.find((cookie) => cookie.name === 'li_a')?.value ?? null,
  };
};

const syncLinkedinCookiesWithBackend = async (input: {
  pageUrl?: string;
  userAgent?: string;
}): Promise<LinkedinSyncStatus> => {
  const pageUrl = input.pageUrl ?? '';

  if (!LINKEDIN_PAGE_REGEX.test(pageUrl)) {
    return {
      success: false,
      authenticated: true,
      onLinkedinPage: false,
      error: 'Open the extension on a LinkedIn page.',
    };
  }

  const accessToken = await getStoredAccessToken();

  if (!accessToken) {
    const status = {
      success: false,
      authenticated: false,
      onLinkedinPage: true,
      error: 'Sign in to Arxena in the extension first.',
    } satisfies LinkedinSyncStatus;

    await chrome.storage.local.set({ linkedinSyncStatus: status });
    return status;
  }

  const { liAt, liA } = await getLinkedinCookieValues();
  const serverBaseUrl = await getServerBaseUrl();

  try {
    const response = await fetch(
      `${serverBaseUrl.replace(/\/$/, '')}/linkedin-unipile/extension/sync-cookies`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          li_at: liAt ?? undefined,
          li_a: liA ?? undefined,
          user_agent: input.userAgent ?? navigator.userAgent,
          page_url: pageUrl,
        }),
      },
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `HTTP ${response.status}: ${response.statusText}`,
      );
    }

    const status = {
      success: Boolean(data?.success),
      authenticated: true,
      onLinkedinPage: true,
      cookies: data?.cookies ?? {
        hasLiAt: Boolean(liAt),
        hasLiA: Boolean(liA),
      },
      linkedin: data?.linkedin,
      reconnect: data?.reconnect,
    } satisfies LinkedinSyncStatus;

    await chrome.storage.local.set({ linkedinSyncStatus: status });

    return status;
  } catch (error) {
    const status = {
      success: false,
      authenticated: true,
      onLinkedinPage: true,
      error: error instanceof Error ? error.message : 'Failed to sync LinkedIn cookies',
      cookies: {
        hasLiAt: Boolean(liAt),
        hasLiA: Boolean(liA),
      },
    } satisfies LinkedinSyncStatus;

    await chrome.storage.local.set({ linkedinSyncStatus: status });

    return status;
  }
};

chrome.cookies.onChanged.addListener(async ({ cookie }) => {
  if (cookie.name === 'tokenPair') {
    const store = await chrome.storage.local.get(['clientUrl']);
    const clientUrl = isDefined(store.clientUrl)
      ? store.clientUrl
      : import.meta.env.VITE_FRONT_BASE_URL;
    chrome.cookies.get({ name: 'tokenPair', url: `${clientUrl}` }, (cookie) => {
      if (isDefined(cookie)) {
        setTokenStateFromCookie(cookie.value);
      }
    });
  }
});

// Handle WhatsApp message failure notifications
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'whatsapp_message_failed') {
    const { phoneNumber, error, message: failedMessage } = message.data;
    
    // Create Chrome notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'logo/32-32.png',
      title: 'WhatsApp Message Failed',
      message: `Failed to send message to ${phoneNumber}. ${error}`,
      buttons: [
        { title: 'Retry' },
        { title: 'Dismiss' }
      ],
      priority: 2
    }, (notificationId) => {
      console.log('WhatsApp failure notification created:', notificationId);
    });
  }
  
  return true;
});

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message.action === 'syncLinkedinCookies') {
    syncLinkedinCookiesWithBackend({
      pageUrl: message.pageUrl,
      userAgent: message.userAgent,
    })
      .then((status) => sendResponse(status))
      .catch((error) =>
        sendResponse({
          success: false,
          authenticated: true,
          onLinkedinPage: Boolean(message.pageUrl),
          error:
            error instanceof Error
              ? error.message
              : 'Failed to sync LinkedIn cookies',
        } satisfies LinkedinSyncStatus),
      );

    return true;
  }

  if (message.action === 'getLinkedinSyncStatus') {
    chrome.storage.local
      .get(['linkedinSyncStatus'])
      .then((store) => {
        sendResponse(
          (store.linkedinSyncStatus as LinkedinSyncStatus | undefined) ?? null,
        );
      })
      .catch(() => sendResponse(null));

    return true;
  }

  return false;
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // Retry button clicked
    console.log('Retry WhatsApp message clicked');
    // You could implement retry logic here
  } else if (buttonIndex === 1) {
    // Dismiss button clicked
    chrome.notifications.clear(notificationId);
  }
});

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  console.log('WhatsApp failure notification clicked:', notificationId);
  chrome.notifications.clear(notificationId);
});

// This will only run the very first time the extension loads, after we have stored the
// cookiesRead variable to true, this will not allow to change the token state everytime background script runs
chrome.cookies.get(
  { name: 'tokenPair', url: `${import.meta.env.VITE_FRONT_BASE_URL}` },
  async (cookie) => {
    const store = await chrome.storage.local.get(['cookiesRead']);
    if (isDefined(cookie) && !isDefined(store.cookiesRead)) {
      setTokenStateFromCookie(cookie.value);
      chrome.storage.local.set({ cookiesRead: true });
    }
  },
);
