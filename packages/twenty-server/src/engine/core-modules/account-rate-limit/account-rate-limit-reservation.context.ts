import { AsyncLocalStorage } from 'node:async_hooks';

type AccountRateLimitReservationStore = {
  reservationBase: string;
  nextSeq: number;
};

export type AccountRateLimitAcquireRecord = {
  provider: string;
  accountId: string;
  method: string;
  member: string;
  keys: string[];
};

type AccountRateLimitAcquireStore = {
  stack: AccountRateLimitAcquireRecord[];
};

const accountRateLimitReservationStorage =
  new AsyncLocalStorage<AccountRateLimitReservationStore>();

const accountRateLimitAcquireStorage =
  new AsyncLocalStorage<AccountRateLimitAcquireStore>();

export const runWithAccountRateLimitReservation = async <T>(
  reservationBase: string,
  fn: () => Promise<T>,
): Promise<T> => {
  const trimmed = reservationBase.trim();
  if (!trimmed) {
    return fn();
  }

  return accountRateLimitReservationStorage.run(
    { reservationBase: trimmed, nextSeq: 0 },
    fn,
  );
};

export const takeAccountRateLimitReservationMember = ():
  | string
  | undefined => {
  const store = accountRateLimitReservationStorage.getStore();
  if (!store) {
    return undefined;
  }

  const seq = store.nextSeq;
  store.nextSeq += 1;

  return `${store.reservationBase}:${seq}`;
};

export const peekAccountRateLimitReservationBase = (): string | undefined =>
  accountRateLimitReservationStorage.getStore()?.reservationBase;

const WORKFLOW_RUN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export const workflowRunIdFromReservationBase = (
  reservationBase: string | undefined,
): string | undefined => {
  const match = reservationBase?.match(WORKFLOW_RUN_ID_PATTERN);

  return match?.[0];
};

export const runWithAccountRateLimitAcquireScope = async <T>(
  fn: () => Promise<T>,
): Promise<T> => accountRateLimitAcquireStorage.run({ stack: [] }, fn);

export const hasAccountRateLimitAcquireScope = (): boolean =>
  accountRateLimitAcquireStorage.getStore() != null;

export const pushAccountRateLimitAcquireRecord = (
  record: AccountRateLimitAcquireRecord,
): boolean => {
  const store = accountRateLimitAcquireStorage.getStore();
  if (!store) {
    return false;
  }

  const last = store.stack[store.stack.length - 1];
  if (
    last &&
    last.member === record.member &&
    last.provider === record.provider &&
    last.accountId === record.accountId &&
    last.method === record.method
  ) {
    return false;
  }

  store.stack.push(record);

  return true;
};

export const popAccountRateLimitAcquireRecord = ():
  | AccountRateLimitAcquireRecord
  | undefined => accountRateLimitAcquireStorage.getStore()?.stack.pop();
