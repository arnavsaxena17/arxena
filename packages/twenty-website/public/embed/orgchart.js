(function () {
  var GLOBAL = 'arxenaOrgChart';
  var DEFAULT_BASE = 'https://arxena.com';

  function resolveBaseUrl() {
    var scripts = document.getElementsByTagName('script');
    for (var i = scripts.length - 1; i >= 0; i -= 1) {
      var src = scripts[i].getAttribute('src') || '';
      if (src.indexOf('/embed/orgchart.js') !== -1) {
        try {
          var url = new URL(src, window.location.href);
          return url.origin;
        } catch (e) {
          break;
        }
      }
    }
    return DEFAULT_BASE;
  }

  function resolveContainer(container) {
    if (!container) {
      return document.getElementById('arxena-orgchart');
    }
    if (typeof container === 'string') {
      return document.querySelector(container);
    }
    return container;
  }

  function mountIframe(config, baseUrl) {
    var target = resolveContainer(config.container);
    if (!target) {
      console.error('[arxenaOrgChart] container not found');
      return;
    }

    var height = config.height || '600px';
    target.style.width = config.width || '100%';
    target.style.height = height;
    target.style.position = target.style.position || 'relative';
    target.innerHTML = '';

    var params = new URLSearchParams();
    params.set('key', config.embedKey);
    if (config.domain) {
      params.set('domain', config.domain);
    }

    var iframe = document.createElement('iframe');
    iframe.src = baseUrl + '/embed/org-chart?' + params.toString();
    iframe.title = 'Arxena Org Chart';
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.display = 'block';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('allow', 'fullscreen');
    target.appendChild(iframe);

    window.addEventListener('message', function (event) {
      if (!event.data || event.data.source !== 'arxena-orgchart-embed') {
        return;
      }
      if (event.data.type === 'resize' && typeof event.data.height === 'number') {
        target.style.height = event.data.height + 'px';
      }
    });
  }

  function processCommand(args) {
    var command = args[0];
    var config = args[1] || {};
    if (command !== 'init') {
      return;
    }
    if (!config.embedKey) {
      console.error('[arxenaOrgChart] embedKey is required');
      return;
    }

    var baseUrl = (config.baseUrl || resolveBaseUrl()).replace(/\/$/, '');
    var mode = config.mode || 'iframe';

    if (mode === 'inline') {
      if (window.arxenaOrgChartInline) {
        window.arxenaOrgChartInline.mount(config, baseUrl);
        return;
      }

      var inlineScript = document.createElement('script');
      inlineScript.async = true;
      inlineScript.src = baseUrl + '/embed/arxena-orgchart.inline.js';
      inlineScript.onload = function () {
        if (window.arxenaOrgChartInline) {
          window.arxenaOrgChartInline.mount(config, baseUrl);
        }
      };
      document.head.appendChild(inlineScript);
      return;
    }

    mountIframe(config, baseUrl);
  }

  var existing = window[GLOBAL];
  var queue = existing && existing.q ? existing.q.slice() : [];

  window[GLOBAL] = function () {
    processCommand(arguments);
  };
  window[GLOBAL].q = [];

  for (var i = 0; i < queue.length; i += 1) {
    processCommand(queue[i]);
  }
})();
