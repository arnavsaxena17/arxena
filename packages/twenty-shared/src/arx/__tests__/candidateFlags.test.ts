import {
  buildCandidateFlagsUpdate,
  detectChatControlStarts,
  flattenCandidateFlags,
  getCandidateFlag,
  matchesCandidateFlagFilter,
  matchesCandidateFlagFilters,
  mergeCandidateFlags,
  parseCandidateFlags,
  resolveCandidateFlags,
} from '../candidateFlags';

describe('candidateFlags', () => {
  it('parses boolean flags with defaults', () => {
    expect(parseCandidateFlags(null)).toBeNull();
    expect(parseCandidateFlags({ startChat: true, stopChat: false })).toEqual({
      startChat: true,
      stopChat: false,
    });
    expect(resolveCandidateFlags({ candidateFlags: { startChat: true } })).toEqual(
      expect.objectContaining({
        startChat: true,
        stopChat: false,
        engagementStatus: false,
      }),
    );
  });

  it('merges patches immutably', () => {
    const merged = mergeCandidateFlags(
      { startChat: true, stopChat: false },
      { stopChat: true, startChatCompleted: true },
    );

    expect(merged).toEqual(
      expect.objectContaining({
        startChat: true,
        stopChat: true,
        startChatCompleted: true,
      }),
    );
  });

  it('builds GraphQL update payload', () => {
    const update = buildCandidateFlagsUpdate({
      existingFlags: { startChat: false },
      patch: { startChat: true, stopChat: false },
    });

    expect(update).toEqual({
      candidateFlags: expect.objectContaining({
        startChat: true,
        stopChat: false,
      }),
    });
  });

  it('flattens flags onto candidate view objects', () => {
    const flattened = flattenCandidateFlags({
      id: 'candidate-1',
      name: 'Jane Doe',
      candidateFlags: { startChat: true, stopChat: false },
    });

    expect(flattened.startChat).toBe(true);
    expect(flattened.stopChat).toBe(false);
    expect(flattened.name).toBe('Jane Doe');
  });

  it('matches single and OR filter specs', () => {
    const candidate = {
      candidateFlags: {
        startChat: true,
        stopChat: false,
        engagementStatus: false,
      },
    };

    expect(
      matchesCandidateFlagFilter(candidate, {
        startChat: { eq: true },
        stopChat: { eq: false },
      }),
    ).toBe(true);
    expect(
      matchesCandidateFlagFilter(candidate, {
        engagementStatus: { eq: true },
      }),
    ).toBe(false);
    expect(
      matchesCandidateFlagFilters(candidate, [
        { engagementStatus: { eq: true } },
        { startChat: { eq: true }, stopChat: { eq: false } },
      ]),
    ).toBe(true);
  });

  it('detects chat control start flips', () => {
    expect(
      detectChatControlStarts(
        { startChat: false },
        { startChat: true, stopChat: false },
      ),
    ).toEqual(['startChat']);
    expect(
      detectChatControlStarts(
        { startChat: true },
        { startChat: true, startVideoInterviewChat: true },
      ),
    ).toEqual(['startVideoInterviewChat']);
  });

  it('reads individual flags via helper', () => {
    expect(
      getCandidateFlag(
        { candidateFlags: { isProfilePurchased: true } },
        'isProfilePurchased',
      ),
    ).toBe(true);
  });
});
