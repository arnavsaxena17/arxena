import {
  peekAccountRateLimitReservationBase,
  runWithAccountRateLimitReservation,
  takeAccountRateLimitReservationMember,
  workflowRunIdFromReservationBase,
} from 'src/engine/core-modules/account-rate-limit/account-rate-limit-reservation.context';

describe('account rate limit reservation context', () => {
  it('issues stable per-step members so a retry reuses the same Redis slot', async () => {
    const first: string[] = [];
    const second: string[] = [];

    await runWithAccountRateLimitReservation('run-1:step-1', async () => {
      first.push(takeAccountRateLimitReservationMember() as string);
      first.push(takeAccountRateLimitReservationMember() as string);
    });

    await runWithAccountRateLimitReservation('run-1:step-1', async () => {
      second.push(takeAccountRateLimitReservationMember() as string);
      second.push(takeAccountRateLimitReservationMember() as string);
    });

    expect(first).toEqual(['run-1:step-1:0', 'run-1:step-1:1']);
    expect(second).toEqual(first);
  });

  it('returns undefined outside a reservation context', () => {
    expect(takeAccountRateLimitReservationMember()).toBeUndefined();
    expect(peekAccountRateLimitReservationBase()).toBeUndefined();
  });

  it('extracts the workflow run id from a reservation base', () => {
    expect(
      workflowRunIdFromReservationBase(
        '54a99d20-8be6-4869-8eeb-aa1aeadfb694:c416d226:0',
      ),
    ).toBe('54a99d20-8be6-4869-8eeb-aa1aeadfb694');
    expect(workflowRunIdFromReservationBase('run-1:step-1')).toBeUndefined();
  });
});
