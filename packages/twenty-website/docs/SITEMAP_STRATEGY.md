# Sitemap Strategy

## Overview

The sitemap uses `SITEMAP_EXPOSED_BATCH_COUNT` to gradually roll out org chart URLs (0–400). Only org chart pages are indexed; `/companies` browse pages are not in the sitemap. Pagination uses `search_after` at runtime (chained ES requests).

## Batch Sizes (URL-Based)

| Sitemap | URLs        |
| ------- | ----------- |
| 0       | 500         |
| 1       | 2,500       |
| 2       | 5,000       |
| 3       | 25,000      |
| 4       | 50,000      |
| 5+      | 50,000 each |

## Phased Rollout by Depth

### Phase 1: Global fullcompany only (cutoff is data-driven)

- **Content:** Only `/org-chart/{companyId}` (global fullcompany), ordered by `count_org` desc.
- **Browse pages:** `/companies/global`, `/companies/global/fullcompany`
- **Cutoff:** Computed from total global fullcompany URL count. Batches 0 through (cutoff-1) cover all full companies.

### Phase 2: Country and function (after cutoff)

- **Content:** Country fullcompany (`/org-chart/{id}/{country}`) and country+function (`/org-chart/{id}/{country}/{type}`) URLs.
- **Browse pages:** `/companies/{country}`, `/companies/{country}/{functionRoot}`
- **SITEMAP_EXPOSED_BATCH_COUNT ≥ cutoff:** Country and function sitemaps and browse pages are populated.

## Filter: Exclude Function Root '0'

All sitemap and browse queries exclude org charts with `type: '0'`.

## Companies Browse URLs

### By company name (alphabetical)

- `/companies` – Letter index (A–Z)
- `/companies/{letter}-{page}` – e.g. `/companies/a-1`, `/companies/b-5`

### By country (geo)

- `/companies/{country}` – e.g. `/companies/united-states`, `/companies/germany`
- `/companies/{country}/{page}` – e.g. `/companies/united-states/2` (pagination)

### By country + function

- `/companies/{country}/{functionRoot}` – e.g. `/companies/united-states/sales`
- `/companies/{country}/{functionRoot}/{page}` – pagination

**URL disambiguation:** Segment `{letter}-{page}` (e.g. `a-1`) = letter browse. Otherwise = country or country/function.

**Gating:** Browse pages are gated by `SITEMAP_EXPOSED_BATCH_COUNT`. Only companies within the exposed sitemap batches are shown (`maxExposedCount`).

## Environment

- `SITEMAP_EXPOSED_BATCH_COUNT`: Number of sitemap batches to expose (0–400). Increment over several weeks as org charts are indexed. Use 0 for no org chart sitemaps.
- **twenty-server:** `ES_ENDPOINT` must be set for org chart URLs to appear. Without it, sitemaps contain only static routes.
