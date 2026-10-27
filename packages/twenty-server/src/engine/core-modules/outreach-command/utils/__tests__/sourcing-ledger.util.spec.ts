import { type OutreachTabRow } from 'src/engine/core-modules/outreach-command/services/outreach-tab.service';
import { computeSourcingFunnel } from 'src/engine/core-modules/outreach-command/utils/sourcing-ledger.util';

const profile = (source: 'bright_data' | 'harvest') => ({
  source,
  fetchedAt: '2026-10-19T00:00:00.000Z',
  fieldsPresent: ['about'],
});

const row = (
  id: string,
  linkedinUrl: string | undefined,
  otherFields: Record<string, unknown> = {},
): OutreachTabRow => ({
  id,
  source: 'ephemeral',
  name: id,
  linkedinUrl,
  otherFields,
});

describe('computeSourcingFunnel', () => {
  it('should count only people who passed on a full profile as qualified', () => {
    const funnel = computeSourcingFunnel([
      row('a', 'u1', {
        fitmentOutcome: 'pass',
        profile: profile('bright_data'),
      }),
      row('b', 'u2', { fitmentOutcome: 'pass' }),
      row('c', 'u3', { fitmentOutcome: 'unknown' }),
      row('d', 'u4', { fitmentOutcome: 'fail', profile: profile('harvest') }),
      row('e', undefined, { fitmentOutcome: 'pass' }),
      row('f', 'u6'),
    ]);

    expect(funnel).toMatchObject({
      rows: 6,
      withLinkedinUrl: 5,
      withoutLinkedinUrl: 1,
      withProfile: { brightData: 1, harvest: 1 },
      notScored: 1,
      outcomes: { pass: 3, unknown: 1, fail: 1 },
      qualified: 1,
    });
  });

  it('should count people who still need a profile fetch', () => {
    const funnel = computeSourcingFunnel([
      row('a', 'u1', { fitmentOutcome: 'pass' }),
      row('b', 'u2', { fitmentOutcome: 'unknown' }),
      row('c', 'u3', { fitmentOutcome: 'fail' }),
      row('d', undefined, { fitmentOutcome: 'pass' }),
    ]);

    // pass and unknown with a URL and no profile; a failed row or one with no
    // URL cannot be fetched
    expect(funnel.awaitingProfile).toBe(2);
  });

  it('should read the snake-case key that CRM-backed rows carry', () => {
    const funnel = computeSourcingFunnel([
      row('a', 'u1', {
        fitment_outcome: 'pass',
        profile: profile('harvest'),
      }),
    ]);

    expect(funnel.qualified).toBe(1);
  });
});
