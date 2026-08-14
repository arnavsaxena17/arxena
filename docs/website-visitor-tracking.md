# Website visitor tracking

Track companies that visit your website with a small installable script (Apollo-style inbound).

## Settings

**Settings → Accounts → Website**

1. Copy the tracking snippet and paste it in your site `<head>` (or GTM).
2. Add each domain you want to track (limit 3).
3. Open a page on that domain, then **Test connection**.
4. Review the **Website visitors** feed for company-level visits.

## Script

```html
<script>
(function(w,d,s,u,a){
  w.arxenaTracker=w.arxenaTracker||function(){(w.arxenaTracker.q=w.arxenaTracker.q||[]).push(arguments)};
  var n=d.createElement(s);n.async=1;n.src=u;
  var f=d.getElementsByTagName(s)[0];f.parentNode.insertBefore(n,f);
  w.arxenaTracker('init',{appId:'trk_…',apiBaseUrl:'https://api.arxena.com'});
})(window,document,'script','https://arxena.com/embed/website-tracker.js');
</script>
```

Loader: [`packages/twenty-website/public/embed/website-tracker.js`](../packages/twenty-website/public/embed/website-tracker.js)

## Data model

| Store | What |
| --- | --- |
| `core.workspace.websiteTrackingAppId` / `websiteTrackingEnabled` | Public script id + kill switch |
| CRM `websiteDomain` | Registered domains + status |
| CRM `websiteVisitor` | Company-level visit sessions for the product feed |
| ClickHouse `website_pageview` | Raw pageview / IP→company stream |

IP→company resolution reuses `IpCompanyResolutionService` (geo module).

## APIs

| Method | Path | Auth |
| --- | --- | --- |
| `POST`/`GET` | `/website-tracker/collect` | Public |
| `GET` | `/website-tracker/snippet` | JWT |
| `GET`/`POST`/`DELETE` | `/website-tracker/domains` | JWT |
| `POST` | `/website-tracker/domains/:id/test-connection` | JWT |
| `GET` | `/website-tracker/visitors` | JWT |

Nest serves these on `:3000`. Production nginx must proxy `/website-tracker/`
before the SPA `location /` (same pattern as `/s/` and `/website/`). Snippet:
[`scripts/nginx/twenty-website-tracker-location.conf.snippet`](../scripts/nginx/twenty-website-tracker-location.conf.snippet).

`location ^~ /website/` does **not** cover `/website-tracker`. Without the
dedicated block, GET returns `index.html` and POST/OPTIONS return nginx **405**.

## Upgrade

1. Fast instance cmd `1785600000020` — workspace columns
2. Workspace cmd `1785600000021` — sync `websiteDomain` + `websiteVisitor` (or `workspace:sync-arxena-standard`)

GDPR: obtain consent before firing the beacon for EU traffic.
