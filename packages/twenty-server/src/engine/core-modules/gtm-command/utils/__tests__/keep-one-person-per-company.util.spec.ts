import {
  extractProfileCompanyKey,
  isOnlyOnePersonPerCompanyEnabled,
  keepSeniorPersonPerCompany,
  scoreProfileSeniority,
} from 'src/engine/core-modules/gtm-command/utils/keep-one-person-per-company.util';

describe('keep-one-person-per-company', () => {
  it('groups by current_positions company_id before top-level companyId', () => {
    expect(
      extractProfileCompanyKey({
        companyId: 'crm-uuid',
        current_positions: [{ role: 'CFO', company: 'Acme', company_id: '1441' }],
      }),
    ).toBe('1441');
  });

  it('falls back to company name when no company id is present', () => {
    expect(extractProfileCompanyKey({ company: 'Acme Inc.' })).toBe(
      'name:acme',
    );
  });

  it('scores CXO titles above director and manager', () => {
    expect(scoreProfileSeniority({ title: 'CFO' })).toBeGreaterThan(
      scoreProfileSeniority({ title: 'Finance Director' }),
    );
    expect(scoreProfileSeniority({ title: 'MD' })).toBeGreaterThan(
      scoreProfileSeniority({ title: 'Head of Finance' }),
    );
    expect(scoreProfileSeniority({ title: 'CEO' })).toBeGreaterThan(
      scoreProfileSeniority({ title: 'CFO' }),
    );
  });

  it('keeps the more senior matched person per company and rejects the rest', () => {
    const cfo = {
      name: 'Priya Shah',
      title: 'CFO',
      current_positions: [
        { role: 'CFO', company: 'Acme', company_id: '1441' },
      ],
    };
    const director = {
      name: 'Alex Kim',
      title: 'Finance Director',
      current_positions: [
        { role: 'Finance Director', company: 'Acme', company_id: '1441' },
      ],
    };
    const otherCeo = {
      name: 'Sam Lee',
      title: 'CEO',
      current_positions: [
        { role: 'CEO', company: 'Globex', company_id: '999' },
      ],
    };

    const result = keepSeniorPersonPerCompany(
      [
        {
          index: 0,
          matches: true,
          reason: 'Finance director at Acme.',
          profile: director,
        },
        {
          index: 1,
          matches: true,
          reason: 'CFO at Acme.',
          profile: cfo,
        },
        {
          index: 2,
          matches: true,
          reason: 'CEO at Globex.',
          profile: otherCeo,
        },
        {
          index: 3,
          matches: false,
          reason: 'Not a decision maker.',
          profile: { title: 'Analyst', companyId: '1441' },
        },
      ],
      (assessment) => assessment.profile,
    );

    expect(result[0]?.matches).toBe(false);
    expect(result[0]?.reason).toContain(
      'A more senior person from the same company was kept',
    );
    expect(result[1]?.matches).toBe(true);
    expect(result[2]?.matches).toBe(true);
    expect(result[3]?.matches).toBe(false);
  });

  it('keeps people who have no company identity', () => {
    const result = keepSeniorPersonPerCompany(
      [
        { index: 0, matches: true, reason: 'ok', profile: { title: 'CEO' } },
        { index: 1, matches: true, reason: 'ok', profile: { title: 'CFO' } },
      ],
      (assessment) => assessment.profile,
    );

    expect(result.every((assessment) => assessment.matches)).toBe(true);
  });

  it('treats true and "true" as enabled', () => {
    expect(isOnlyOnePersonPerCompanyEnabled(true)).toBe(true);
    expect(isOnlyOnePersonPerCompanyEnabled('true')).toBe(true);
    expect(isOnlyOnePersonPerCompanyEnabled(false)).toBe(false);
    expect(isOnlyOnePersonPerCompanyEnabled(null)).toBe(false);
  });
});
