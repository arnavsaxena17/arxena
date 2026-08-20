import { config } from 'dotenv';
import { UnipileV2Client } from './src/engine/core-modules/unipile-client/unipile-v2.client';

config({ path: './.env' });

class LoggingClient extends UnipileV2Client {
  readonly paths: string[] = [];
  override async request<T = unknown>(args: {
    path: string;
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    binary?: boolean;
    returnStatus?: boolean;
  }): Promise<T> {
    this.paths.push(`${args.method ?? 'GET'} ${args.path}`);
    return super.request(args);
  }
}

const names = (payload: unknown) => {
  const record = payload as { data?: unknown[]; items?: unknown[] };
  const items = record.items ?? record.data ?? [];
  return {
    count: Array.isArray(items) ? items.length : 0,
    preview: (Array.isArray(items) ? items : [])
      .slice(0, 3)
      .map((item) => {
        const row = item as { name?: string; display_name?: string };
        return row.name ?? row.display_name;
      }),
    cursor:
      (payload as { next_cursor?: string; cursor?: string }).next_cursor ??
      (payload as { cursor?: string }).cursor ??
      null,
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const client = new LoggingClient();
  const classicId = 'acc_01m0fbz90yenavmrdrhcge1kda';
  const snId = 'acc_01m0fbzbw3enavmref14wjyr8c';

  console.log('=== LinkedInSearchService-equivalent: Classic people limit=25 ===');
  client.paths.length = 0;
  const classic1 = await client.searchLinkedIn({
    accountId: classicId,
    api: 'classic',
    category: 'people',
    body: { keywords: 'software engineer' },
    limit: 25,
  });
  console.log({ route: 'POST /linkedin-search/search/people', ...names(classic1), unipile: [...client.paths] });

  await sleep(5000);
  client.paths.length = 0;
  const classic2 = await client.searchLinkedIn({
    accountId: classicId,
    api: 'classic',
    category: 'people',
    body: { keywords: 'software engineer' },
    cursor: names(classic1).cursor ?? undefined,
    limit: 25,
  });
  console.log({ route: 'POST /linkedin-search/search/continue', ...names(classic2), unipile: [...client.paths] });

  await sleep(8000);
  console.log('=== LinkedInSearchService-equivalent: SN people limit=50 x2 ===');
  client.paths.length = 0;
  const sn1 = await client.searchLinkedIn({
    accountId: snId,
    api: 'sales_navigator',
    category: 'people',
    body: { keywords: 'software engineer' },
    limit: 50,
  });
  console.log({ route: 'POST /linkedin-search/search/sales-navigator/people', ...names(sn1), unipile: [...client.paths] });

  await sleep(8000);
  client.paths.length = 0;
  const sn2 = await client.searchLinkedIn({
    accountId: snId,
    api: 'sales_navigator',
    category: 'people',
    body: { keywords: 'software engineer' },
    offset: 50,
    limit: 50,
  });
  console.log({
    route: 'POST /linkedin-search/search/sales-navigator/people?cursor=50',
    ...names(sn2),
    unipile: [...client.paths],
  });
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
