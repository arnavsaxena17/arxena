# Org Chart Embed

Embed Arxena org charts on your own website with a JavaScript snippet.

## Quickstart

1. Sign in to [app.arxena.com](https://app.arxena.com) and open **Settings → Developers → Org chart embed**.
2. Create an embed key with your company domain and allowed origins (e.g. `https://www.yourcompany.com`).
3. Copy the snippet and paste it into your HTML page.

## Snippet

The generated snippet uses the branded `function(A,r,x,e,n,a)` loader (spells **ARXENA**):

```html
<!-- Arxena Org Chart -->
<div id="arxena-orgchart" style="width:100%;height:600px"></div>
<script>
(function(A,r,x,e,n,a){
  A[a]=A[a]||function(){(A[a].q=A[a].q||[]).push(arguments)};
  n=r.getElementsByTagName(e)[0];
  x=r.createElement(e);
  x.async=1;x.src='https://arxena.com/embed/orgchart.js';
  n.parentNode.insertBefore(x,n);
})(window,document,'script','script',null,'arxenaOrgChart');
arxenaOrgChart('init', {
  embedKey: 'emb_xxx',
  domain: 'acme.com',
  container: '#arxena-orgchart',
  height: '600px',
  mode: 'iframe'
});
</script>
```

### Init options

| Option | Required | Description |
|--------|----------|-------------|
| `embedKey` | Yes | Public embed key from Developers settings |
| `domain` | Live mode | Company website domain (e.g. `acme.com`) |
| `container` | No | CSS selector or element (default: `#arxena-orgchart`) |
| `height` | No | Container height (default: `600px`) |
| `mode` | No | `iframe` (default) or `inline` |

## Allowed origins

Every embed key has an origin allowlist. Requests from origins not on the list are rejected with `403 Origin not allowed`.

Examples:

- `https://www.acme.com`
- `https://*.acme.com` (subdomains)

## Modes

### Live (`mode: live`)

Resolves the company from `domain` and serves the org chart in real time.

### Published (`mode: published`)

Serves a fixed snapshot from a publish slug (same data as `/org/{slug}` on arxena.com). Best for careers pages and stable enterprise embeds.

## iframe vs inline

| | iframe | inline |
|--|--------|--------|
| Setup | Default, no extra config | Requires inline SDK bundle |
| CORS | Not needed for chart data | Per-origin CORS on `/api/embed/org-chart` |
| Bundle size | Small loader only | Includes GoJS diagram bundle |
| Customization | Limited | Node click events, `postMessage` |

## API

### Resolve (public)

```
GET https://arxena.com/api/embed/org-chart?domain=acme.com
Header: X-Embed-Key: emb_xxx
```

Returns `{ status, companyId, companyName, mode, result }`.

### Manage (authenticated)

```
POST   https://app.arxena.com/org-chart/embed
GET    https://app.arxena.com/org-chart/embed
GET    https://app.arxena.com/org-chart/embed/:embedKey
PATCH  https://app.arxena.com/org-chart/embed/:embedKey
DELETE https://app.arxena.com/org-chart/embed/:embedKey
```

Use your workspace JWT (`Authorization: Bearer ...`).

## Security

- The embed key is public (visible in HTML). Protection is via **origin allowlist** and rate limits.
- Never put workspace API keys in client-side embed code.
- For enterprise, use **published** mode and optional domain lock.

## Enterprise

- Custom branding via `options.theme` (CSS variables on inline embed container)
- Hide "Powered by Arxena" — enable in embed detail settings (enterprise; also bypasses free-tier view cap)
- Usage analytics — views today and 30-day total in embed detail page
- Webhooks — subscribe to `embed.viewed` or `embed.node_clicked` in Developers → Webhooks
- Billing gate — free tier capped at `ORG_CHART_EMBED_MONTHLY_VIEW_LIMIT` views/month (default 10,000)

### Webhook events

| Event | When |
|-------|------|
| `embed.viewed` | Each successful resolve |
| `embed.node_clicked` | Inline embed node click (via `postMessage` or POST `/org-chart/embed/event`) |

Webhook payload `record` includes `embedKey`, `companyId`, `companyName`, and event-specific fields.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Chart blank | Check embed key, domain, and allowed origins |
| 403 Origin not allowed | Add your site origin to the embed key |
| 429 Too many requests | Rate limit per key; contact support for higher limits |

Public setup guide: https://arxena.com/solutions/org-chart-embed
