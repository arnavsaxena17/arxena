import {
  dimensionOfCriterion,
  planScoring,
} from 'src/engine/core-modules/tool/tools/source-capabilities-tool/enrichment-plan.util';
import {
  readCompanyCoverage,
  readPersonCoverage,
} from 'src/engine/core-modules/tool/tools/source-capabilities-tool/row-coverage.util';

const criteria = (descriptions: Array<[string, boolean]>) =>
  descriptions.map(([description, mustHave], index) => ({
    key: `c${index}`,
    description,
    mustHave,
  }));

describe('row coverage', () => {
  it('reads a search snapshot as identity and evidence only', () => {
    const coverage = readPersonCoverage({
      title: 'VP of Engineering',
      companyName: 'Pice',
      otherFields: {},
    });

    expect(coverage.level).toBe('snapshot');
    expect(coverage.answered).toEqual(
      expect.arrayContaining(['identity', 'employerIdentity', 'evidence']),
    );
    // A result title is not a confirmed current title
    expect(coverage.partial).toContain('role');
    expect(coverage.blind).toEqual(
      expect.arrayContaining(['tenure', 'skills', 'employerRevenue']),
    );
  });

  it('reads a row with a Bright Data profile as profile level', () => {
    const coverage = readPersonCoverage({
      title: 'VP of Engineering',
      companyName: 'Pice',
      otherFields: {
        profile: {
          source: 'bright_data',
          fetchedAt: '2026-10-01T00:00:00.000Z',
          fieldsPresent: ['headline', 'about', 'experience'],
          headline: 'VP Engineering at Pice',
          about: 'Built UPI and lending platforms',
          experience: 'VP Engineering, Pice, 2021 - now',
        },
      },
    });

    expect(coverage.level).toBe('profile');
    expect(coverage.answered).toEqual(
      expect.arrayContaining(['role', 'tenure', 'skills', 'employerIdentity']),
    );
    expect(coverage.answered).not.toContain('employerRevenue');
  });

  it('reads a company row with employees but no revenue', () => {
    const coverage = readCompanyCoverage({
      industry: 'Motor Vehicle Parts Manufacturing',
      employees: '4200',
      otherFields: { hqCity: 'Pune' },
    });

    expect(coverage.answered).toEqual(
      expect.arrayContaining(['employerIndustry', 'employerSize', 'location']),
    );
    expect(coverage.blind).toContain('employerRevenue');
  });
});

describe('enrichment plan', () => {
  it('pays for a profile when a must-have needs work history', () => {
    const plan = planScoring({
      coverage: readPersonCoverage({
        title: 'VP of Engineering',
        companyName: 'Pice',
        otherFields: {},
      }),
      criteria: criteria([['Payments or lending platform experience', true]]),
      budgetUsd: 0.1,
    });

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].step).toBe('fetch_profile');
    expect(plan.unsettleable).toEqual([]);
  });

  it('does not pay again when the profile is already on the row', () => {
    const plan = planScoring({
      coverage: readPersonCoverage({
        title: 'VP of Engineering',
        companyName: 'Pice',
        otherFields: {
          profile: {
            source: 'bright_data',
            fetchedAt: '2026-10-01T00:00:00.000Z',
            fieldsPresent: ['experience', 'about'],
            about: 'Payments and lending platforms',
            experience: 'VP Engineering, Pice',
          },
        },
      }),
      criteria: criteria([['Payments or lending platform experience', true]]),
      budgetUsd: 0.1,
    });

    expect(plan.steps).toEqual([]);
    expect(plan.unsettleable).toEqual([]);
  });

  it('uses a company web step for revenue, and never a profile', () => {
    const plan = planScoring({
      coverage: readPersonCoverage({
        title: 'COO',
        companyName: 'Bharat Forge',
        otherFields: {},
      }),
      criteria: criteria([['Company revenue of Rs 2000 Cr or more', true]]),
      budgetUsd: 0.1,
    });

    expect(plan.steps.map((step) => step.step)).toEqual(['company_web']);
  });

  it('reports a criterion no source can settle instead of spending', () => {
    const plan = planScoring({
      coverage: readPersonCoverage({ title: 'COO', otherFields: {} }),
      criteria: criteria([['Email address available', true]]),
      budgetUsd: 0.1,
    });

    expect(plan.steps).toEqual([]);
    expect(plan.unsettleable[0].reason).toContain('No source settles contact');
  });

  it('stops at the budget and says why', () => {
    const plan = planScoring({
      coverage: readPersonCoverage({ title: 'COO', otherFields: {} }),
      criteria: criteria([['Payments platform experience', true]]),
      budgetUsd: 0.005,
    });

    expect(plan.steps).toEqual([]);
    expect(plan.unsettleable).toHaveLength(1);
    expect(plan.unsettleable[0].reason).toContain('Budget');
  });

  it('leaves nice-to-haves out of the spend, and still fills them when useful', () => {
    const plan = planScoring({
      coverage: readCompanyCoverage({ industry: 'Retail' }),
      criteria: criteria([
        ['Industry is retail', true],
        ['Revenue above Rs 500 Cr', false],
      ]),
      budgetUsd: 0.1,
    });

    // Only must-haves open a step; the nice-to-have stays unknown
    expect(plan.steps).toEqual([]);
    expect(plan.unsettleable).toEqual([]);
  });

  it('maps the words of a criterion to a dimension', () => {
    expect(dimensionOfCriterion('Annual revenue of at least 800 Cr')).toBe(
      'employerRevenue',
    );
    expect(dimensionOfCriterion('Has carried a P&L of 500 Cr')).toBe('skills');
    expect(dimensionOfCriterion('Plant head with continuous process')).toBe(
      'role',
    );
    expect(dimensionOfCriterion('Based in Pune')).toBe('location');
  });

  it('calls a thin profile a data gap, not a missing step', () => {
    const plan = planScoring({
      coverage: readPersonCoverage({
        title: 'COO',
        companyName: 'Acme',
        otherFields: {
          profile: {
            source: 'bright_data',
            fetchedAt: '2026-10-01T00:00:00.000Z',
            fieldsPresent: ['headline'],
            headline: 'COO at Acme',
          },
        },
      }),
      criteria: criteria([['Payments platform experience', true]]),
      budgetUsd: 0.1,
    });

    expect(plan.steps).toEqual([]);
    expect(plan.unsettleable[0].reason).toContain(
      'profile on the row does not show',
    );
  });
});
