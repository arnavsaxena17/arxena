/**
 * Runs 5 Voyager GraphQL people searches (same scenarios as sample-local-linkedin-raw-search-plans).
 *
 * Requires a logged-in browser session:
 *   LINKEDIN_COOKIE  — full Cookie header value (include li_at, JSESSIONID, etc.)
 *
 * Optional:
 *   LINKEDIN_CSRF_TOKEN — defaults to JSESSIONID cookie value (ajax:…)
 *   LINKEDIN_USER_AGENT — defaults to Chrome/macOS string below
 *   VOYAGER_SEARCH_QUERY_ID — override persisted query id if LinkedIn rotates it
 *   LINKEDIN_REFERER — e.g. https://www.linkedin.com/preload/ (some sessions expect this)
 *
 * Example:
 *   LINKEDIN_COOKIE='li_at=...; JSESSIONID="ajax:123"; ...' \
 *   yarn test:run-voyager-people-search-samples
 */

import { VoyagerPeopleSearchGraphqlBuilder } from 'src/engine/core-modules/linkedin-search/utils/voyager-people-search-graphql.util';

const defaultUserAgent =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';

function parseJsessionIdFromCookie(cookie: string): string | null {
  const m = cookie.match(/JSESSIONID="?([^";]+)"?/i);
  return m?.[1] ?? null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const searches: Array<{
  name: string;
  params: Parameters<typeof VoyagerPeopleSearchGraphqlBuilder.buildGraphqlUrl>[0];
  options: { start?: number };
  delayMs: number;
}> = [
  {
    name: 'Arnav Saxena keywords',
    params: { keywords: 'Arnav Saxena' },
    options: {},
    delayMs: 3_000,
  },
  {
    name: 'Arnav Saxena first/last name',
    params: {
      advanced_keywords: {
        first_name: 'Arnav',
        last_name: 'Saxena',
      },
    },
    options: {},
    delayMs: 3_000,
  },
  {
    name: 'Arnav Saxena recruiter + Founder title, page 2',
    params: {
      keywords: 'Arnav Saxena recruiter',
      advanced_keywords: {
        first_name: 'Arnav',
        last_name: 'Saxena',
        title: 'Founder',
      },
    },
    options: { start: 10 },
    delayMs: 3_000,
  },
  {
    name: 'People from Unipile (company filter)',
    params: {
      advanced_keywords: {
        company: 'Unipile',
      },
    },
    options: {},
    delayMs: 3_000,
  },
  {
    name: 'Unipile + platform keywords',
    params: {
      keywords: 'Unipile messaging api',
      advanced_keywords: {
        company: 'Unipile',
      },
    },
    options: {},
    delayMs: 4_000,
  },
];

async function main(): Promise<void> {
  const cookie = process.env.LINKEDIN_COOKIE?.trim();
  if (!cookie) {
    console.error(
      'Set LINKEDIN_COOKIE to your browser Cookie header value (li_at, JSESSIONID, etc.).',
    );
    process.exit(1);
  }

  const csrf =
    process.env.LINKEDIN_CSRF_TOKEN?.trim() ?? parseJsessionIdFromCookie(cookie);
  if (!csrf) {
    console.error(
      'Could not determine csrf-token: set LINKEDIN_CSRF_TOKEN or include JSESSIONID in LINKEDIN_COOKIE.',
    );
    process.exit(1);
  }

  const userAgent = process.env.LINKEDIN_USER_AGENT?.trim() ?? defaultUserAgent;
  const queryId = process.env.VOYAGER_SEARCH_QUERY_ID?.trim();
  const referer =
    process.env.LINKEDIN_REFERER?.trim() ??
    'https://www.linkedin.com/search/results/people/';

  for (let i = 0; i < searches.length; i += 1) {
    const item = searches[i];
    const url = VoyagerPeopleSearchGraphqlBuilder.buildGraphqlUrl(item.params, {
      start: item.options.start,
      ...(queryId ? { queryId } : {}),
    });

    console.log(`\n=== ${i + 1}/5 ${item.name} ===`);
    console.log('GET', url);
    console.log(
      'variables=',
      VoyagerPeopleSearchGraphqlBuilder.buildVariablesString(
        item.params,
        item.options.start ?? 0,
      ),
    );

    const res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'application/vnd.linkedin.normalized+json+2.1',
        'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'csrf-token': csrf,
        dnt: '1',
        priority: 'u=1, i',
        referer,
        'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': userAgent,
        'x-li-lang': 'en_US',
        'x-restli-protocol-version': '2.0.0',
        cookie,
      },
    });

    const text = await res.text();
    let preview: unknown = text.slice(0, 800);
    try {
      preview = JSON.parse(text);
    } catch {
      // keep truncated text
    }

    if (res.status >= 300 && res.status < 400) {
      console.log('redirect', res.status, res.headers.get('location'));
    }

    console.log('status', res.status, res.statusText);
    console.log('body preview', JSON.stringify(preview, null, 2).slice(0, 4000));

    if (i < searches.length - 1) {
      await sleep(item.delayMs);
    }
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
