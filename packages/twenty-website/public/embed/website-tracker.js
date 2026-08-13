(function () {
  var GLOBAL = 'arxenaTracker';
  var DEFAULT_API = 'https://api.arxena.com';

  function flushQueue(api) {
    var queue = (api && api.q) || [];
    api.q = [];
    for (var i = 0; i < queue.length; i += 1) {
      api.apply(null, queue[i]);
    }
  }

  function sendCollect(config) {
    if (!config || !config.appId) {
      console.error('[arxenaTracker] appId is required');
      return;
    }

    var apiBaseUrl = (config.apiBaseUrl || DEFAULT_API).replace(/\/$/, '');
    var pageUrl = window.location.href;
    var path = window.location.pathname + window.location.search;
    var referrer = document.referrer || '';
    var hostDomain = window.location.hostname.replace(/^www\./, '');

    var payload = {
      appId: config.appId,
      path: path,
      pageUrl: pageUrl,
      referrer: referrer,
      hostDomain: hostDomain,
    };

    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([JSON.stringify(payload)], {
          type: 'application/json',
        });
        navigator.sendBeacon(apiBaseUrl + '/website-tracker/collect', blob);
        return;
      }
    } catch (e) {
      // fall through to fetch
    }

    fetch(apiBaseUrl + '/website-tracker/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    }).catch(function () {
      // Tracking failures should never break the host page
    });
  }

  function createApi() {
    var config = null;
    var api = function (command, payload) {
      if (command === 'init') {
        config = payload || {};
        sendCollect(config);
        return;
      }
      if (command === 'track') {
        sendCollect(Object.assign({}, config || {}, payload || {}));
      }
    };
    api.q = (window[GLOBAL] && window[GLOBAL].q) || [];
    return api;
  }

  var api = createApi();
  window[GLOBAL] = api;
  flushQueue(api);
})();
