// One model step per LinkedIn page is the most expensive way to read a long
// search: a 1,000-row slice is dozens of pages. This follows the cursor on the
// server and hands back one response with all the items, so the list gets them
// in one ingest.

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Pages come back either bare or wrapped in `result`
const rootOf = (page: unknown): Loose | undefined => {
  if (!isRecord(page)) {
    return undefined;
  }

  return isRecord(page.result) ? page.result : page;
};

const itemsOf = (page: unknown): unknown[] => {
  const items = rootOf(page)?.items;

  return Array.isArray(items) ? items : [];
};

const cursorOf = (page: unknown): string | undefined => {
  const cursor = rootOf(page)?.cursor;

  return typeof cursor === 'string' && cursor.trim() !== ''
    ? cursor
    : undefined;
};

export type LinkedinPagesStop =
  | 'page_limit'
  | 'row_limit'
  | 'no_more_pages'
  | 'empty_page'
  | 'error';

export type CollectedLinkedinPages = {
  response: unknown;
  pages: number;
  rows: number;
  stoppedBecause: LinkedinPagesStop;
  error?: string;
};

export const MAX_LINKEDIN_AUTO_PAGES = 50;
export const DEFAULT_LINKEDIN_AUTO_ROWS = 1000;

export const collectLinkedinSearchPages = async ({
  firstCursor,
  fetchPage,
  maxPages,
  maxRows = DEFAULT_LINKEDIN_AUTO_ROWS,
}: {
  firstCursor: string;
  fetchPage: (cursor: string) => Promise<unknown>;
  maxPages: number;
  maxRows?: number;
}): Promise<CollectedLinkedinPages> => {
  const pageLimit = Math.max(
    1,
    Math.min(Math.floor(maxPages), MAX_LINKEDIN_AUTO_PAGES),
  );
  let first: unknown;
  let collected: unknown[] = [];
  let cursor: string | undefined = firstCursor;
  let lastCursor: string | undefined;
  let pages = 0;
  let stoppedBecause: LinkedinPagesStop = 'page_limit';
  let error: string | undefined;

  while (cursor !== undefined) {
    let page: unknown;

    try {
      page = await fetchPage(cursor);
    } catch (caught) {
      // Keep what was read: the cursor still continues from the last good page
      if (pages === 0) {
        throw caught;
      }

      stoppedBecause = 'error';
      error = caught instanceof Error ? caught.message : String(caught);
      break;
    }

    pages += 1;
    first ??= page;

    const items = itemsOf(page);

    collected = collected.concat(items);
    lastCursor = cursorOf(page);

    if (items.length === 0) {
      stoppedBecause = 'empty_page';
      break;
    }

    if (lastCursor === undefined) {
      stoppedBecause = 'no_more_pages';
      break;
    }

    if (collected.length >= maxRows) {
      stoppedBecause = 'row_limit';
      break;
    }

    if (pages >= pageLimit) {
      stoppedBecause = 'page_limit';
      break;
    }

    cursor = lastCursor;
  }

  const base = rootOf(first);

  if (!isRecord(first) || base === undefined) {
    return { response: first, pages, rows: collected.length, stoppedBecause };
  }

  const merged: Loose = {
    ...base,
    items: collected,
    ...(lastCursor !== undefined ? { cursor: lastCursor } : {}),
    autoContinue: {
      pages,
      rows: collected.length,
      stoppedBecause,
      ...(error !== undefined ? { error } : {}),
    },
  };

  if (lastCursor === undefined) {
    delete merged.cursor;
  }

  return {
    response: isRecord(first.result) ? { ...first, result: merged } : merged,
    pages,
    rows: collected.length,
    stoppedBecause,
    ...(error !== undefined ? { error } : {}),
  };
};
