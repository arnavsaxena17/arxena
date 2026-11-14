import {
  isRoundExhausted,
  shouldStop,
  type SourcingRound,
  type SourcingStopState,
} from 'src/engine/core-modules/candidate-sourcing/run/stop.util';

const round = (overrides: Partial<SourcingRound> = {}): SourcingRound => ({
  qualifiedAdded: 10,
  fetched: 100,
  duplicates: 0,
  hasMorePages: true,
  ...overrides,
});

const state = (
  overrides: Partial<SourcingStopState> = {},
): SourcingStopState => ({
  target: 100,
  qualified: 0,
  spentUsd: 0,
  budgetUsd: 10,
  rounds: [],
  liveCandidates: 3,
  ...overrides,
});

describe('shouldStop', () => {
  it('should continue when nothing has run yet', () => {
    expect(shouldStop(state())).toEqual({ stop: false });
  });

  it('should stop when qualified reaches the target', () => {
    expect(shouldStop(state({ qualified: 100, rounds: [round()] }))).toEqual({
      stop: true,
      because: 'target_met',
    });
  });

  it('should stop when spend reaches the budget', () => {
    expect(shouldStop(state({ spentUsd: 10 }))).toEqual({
      stop: true,
      because: 'budget',
    });
  });

  it('should stop when no candidate can return new rows', () => {
    expect(shouldStop(state({ rounds: [round()], liveCandidates: 0 }))).toEqual(
      { stop: true, because: 'exhausted' },
    );
  });

  it('should stop after two flat rounds in a row', () => {
    const flat = round({ qualifiedAdded: 4 });

    expect(shouldStop(state({ rounds: [round(), flat, flat] }))).toEqual({
      stop: true,
      because: 'flat',
    });
  });

  it('should continue when a flat round is followed by a productive one', () => {
    const flat = round({ qualifiedAdded: 4 });

    expect(shouldStop(state({ rounds: [flat, round()] }))).toEqual({
      stop: false,
    });
  });

  it('should treat exactly 5% of the target as not flat', () => {
    const atThreshold = round({ qualifiedAdded: 5 });

    expect(shouldStop(state({ rounds: [atThreshold, atThreshold] }))).toEqual({
      stop: false,
    });
  });

  it('should stop after five rounds', () => {
    expect(
      shouldStop(state({ rounds: Array.from({ length: 5 }, () => round()) })),
    ).toEqual({ stop: true, because: 'rounds' });
  });

  it('should call a round that qualified nobody flat when there is no target', () => {
    const empty = round({ qualifiedAdded: 0 });

    expect(shouldStop(state({ target: null, rounds: [empty, empty] }))).toEqual(
      { stop: true, because: 'flat' },
    );
  });

  it('should keep an exhaustive run going past the target, flat rounds and the round cap', () => {
    const flat = round({ qualifiedAdded: 0 });

    expect(
      shouldStop(
        state({
          coverage: 'exhaustive',
          qualified: 500,
          rounds: Array.from({ length: 6 }, () => flat),
        }),
      ),
    ).toEqual({ stop: false });
  });

  it('should still stop an exhaustive run on budget', () => {
    expect(shouldStop(state({ coverage: 'exhaustive', spentUsd: 11 }))).toEqual(
      { stop: true, because: 'budget' },
    );
  });
});

describe('isRoundExhausted', () => {
  it('should be exhausted when the duplicate share is above 80%', () => {
    expect(isRoundExhausted(round({ duplicates: 81 }))).toBe(true);
    expect(isRoundExhausted(round({ duplicates: 80 }))).toBe(false);
  });

  it('should be exhausted when the source has no more pages', () => {
    expect(isRoundExhausted(round({ hasMorePages: false }))).toBe(true);
  });

  it('should be exhausted when nothing came back', () => {
    expect(isRoundExhausted(round({ fetched: 0 }))).toBe(true);
  });
});
