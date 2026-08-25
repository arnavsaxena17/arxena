import { AsyncLocalStorage } from 'node:async_hooks';

type AccountRateLimitReservationStore = {
  reservationBase: string;
  nextSeq: number;
};

const accountRateLimitReservationStorage =
  new AsyncLocalStorage<AccountRateLimitReservationStore>();

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
