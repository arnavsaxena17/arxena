import { isDefined } from 'twenty-shared';
import { insertButtonForCompany } from '~/contentScript/extractCompanyProfile';
import { insertButtonForPerson } from '~/contentScript/extractPersonProfile';

// Inject buttons into the DOM when SPA is reloaded on the resource url.
// e.g. reload the page when on https://www.linkedin.com/in/mabdullahabaid/
// await insertButtonForCompany();

console.log("Content script loaded from index.ts");

const companyRoute = /^https?:\/\/(?:www\.)?linkedin\.com\/company(?:\/\S+)?/;
const personRoute = /^https?:\/\/(?:www\.)?linkedin\.com\/in(?:\/\S+)?/;
const linkedinRoute = /^https?:\/\/(?:[\w-]+\.)?linkedin\.com/;

const executeScript = async () => {
  const loc = window.location.href;
  switch (true) {
    case companyRoute.test(loc):
      await insertButtonForCompany();
      break;
    case personRoute.test(loc):
      await insertButtonForPerson();
      break;
    default:
      break;
  }
};

const syncLinkedinCookies = async () => {
  if (!linkedinRoute.test(window.location.href)) {
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      action: 'syncLinkedinCookies',
      pageUrl: window.location.href,
      userAgent: window.navigator.userAgent,
    });
  } catch (error) {
    console.warn('Failed to sync LinkedIn cookies', error);
  }
};

const runForCurrentPage = async () => {
  await executeScript();
  await syncLinkedinCookies();
};

// The content script gets executed upon load, so the the content script is executed when a user visits https://www.linkedin.com/feed/.
// However, there would never be another reload in a single page application unless triggered manually.
// Therefore, if the user navigates to a person or a company page, we must manually re-execute the content script to create the "Add to Twenty" button.
// e.g. create "Add to Twenty" button when a user navigates to https://www.linkedin.com/in/mabdullahabaid/ from https://www.linkedin.com/feed/
chrome.runtime.onMessage.addListener(async (message, _, sendResponse) => {
  if (message.action === 'executeContentScript') {
    await executeScript();
  }

  if (message.action === 'getLinkedinPageContext') {
    sendResponse({
      pageUrl: window.location.href,
      userAgent: window.navigator.userAgent,
      onLinkedinPage: linkedinRoute.test(window.location.href),
    });
    return;
  }

  sendResponse('Executing!');
});

chrome.storage.local.onChanged.addListener(async (store) => {
  if (isDefined(store.accessToken)) {
    if (isDefined(store.accessToken.newValue)) {
      await executeScript();
    }
  }
});

void runForCurrentPage();

let lastHref = window.location.href;

const handleLocationChange = async () => {
  if (window.location.href === lastHref) {
    return;
  }

  lastHref = window.location.href;
  await runForCurrentPage();
};

const originalPushState = window.history.pushState;
window.history.pushState = function (...args) {
  const result = originalPushState.apply(this, args);
  void handleLocationChange();
  return result;
};

const originalReplaceState = window.history.replaceState;
window.history.replaceState = function (...args) {
  const result = originalReplaceState.apply(this, args);
  void handleLocationChange();
  return result;
};

window.addEventListener('popstate', () => {
  void handleLocationChange();
});
