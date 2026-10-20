import { stripAiColumnKeys } from 'src/engine/core-modules/outreach-command/utils/strip-ai-column-keys.util';

describe('stripAiColumnKeys', () => {
  it('returns null when the keys are not present', () => {
    expect(
      stripAiColumnKeys({ name: 'Acme', aiColumns: { isCeo: { type: 'boolean' } } }, [
        'revenueUsd',
      ]),
    ).toBeNull();
  });

  it('removes value keys and aiColumns meta, dropping empty aiColumns', () => {
    expect(
      stripAiColumnKeys(
        {
          isCeo: true,
          keepMe: 1,
          aiColumns: {
            isCeo: { label: 'Is CEO', type: 'boolean', status: 'ok' },
          },
        },
        ['isCeo'],
      ),
    ).toEqual({ keepMe: 1 });
  });

  it('keeps unrelated aiColumns entries', () => {
    expect(
      stripAiColumnKeys(
        {
          isCeo: true,
          revenueUsd: 10,
          aiColumns: {
            isCeo: { label: 'Is CEO', type: 'boolean' },
            revenueUsd: { label: 'Revenue', type: 'number' },
          },
        },
        ['isCeo'],
      ),
    ).toEqual({
      revenueUsd: 10,
      aiColumns: {
        revenueUsd: { label: 'Revenue', type: 'number' },
      },
    });
  });
});
