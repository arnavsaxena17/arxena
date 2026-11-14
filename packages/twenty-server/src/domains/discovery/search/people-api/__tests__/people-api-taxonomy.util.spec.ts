import { buildTaxonomyTreeFromFlatLists } from '../utils/build-taxonomy-tree.util';
import { extractCandidateExperience } from '../utils/extract-candidate-experience.util';
import {
  candidateCurrentlyWorksAtTargetCompany,
  extractCandidateCompanyName,
  extractCandidateJobTitle,
} from '../utils/extract-candidate-job-title.util';
import {
  classificationToResolvedFields,
  matchesTaxonomyFilter,
} from '../utils/filter-people-by-taxonomy.util';

describe('buildTaxonomyTreeFromFlatLists', () => {
  it('nests functions under matching parent_id roots', () => {
    const tree = buildTaxonomyTreeFromFlatLists(
      [
        {
          id: 'engineering',
          label: 'engineering',
          name: 'engineering',
          parent_id: null,
          level: 1,
        },
        {
          id: 'sales',
          label: 'sales',
          name: 'sales',
          parent_id: null,
          level: 1,
        },
      ],
      [
        {
          id: 'software engineering',
          label: 'software engineering',
          name: 'software engineering',
          parent_id: 'engineering',
          level: 2,
        },
        {
          id: 'account management',
          label: 'account management',
          name: 'account management',
          parent_id: 'sales',
          level: 2,
        },
      ],
    );

    expect(tree).toEqual([
      {
        id: 'engineering',
        label: 'engineering',
        functions: [
          {
            id: 'software engineering',
            label: 'software engineering',
          },
        ],
      },
      {
        id: 'sales',
        label: 'sales',
        functions: [
          {
            id: 'account management',
            label: 'account management',
          },
        ],
      },
    ]);
  });
});

describe('extractCandidateJobTitle', () => {
  it('prefers jobTitle then currentPositions title', () => {
    expect(extractCandidateJobTitle({ jobTitle: 'VP Sales' })).toBe('VP Sales');
    expect(
      extractCandidateJobTitle({
        currentPositions: [{ title: 'Account Executive' }],
      }),
    ).toBe('Account Executive');
  });

  it('prefers Unipile current_positions.role over headline', () => {
    expect(
      extractCandidateJobTitle({
        headline:
          'Director of Talent Solutions | Interim Executive Search | Hogan Assessment & Leadership Development | Speaker & Facilitator | Strategic Communication',
        current_positions: [
          {
            role: 'Director of Talent Solutions | Interim Executive & Professional Search',
          },
        ],
      }),
    ).toBe(
      'Director of Talent Solutions | Interim Executive & Professional Search',
    );
  });

  it('uses jobTitles when current positions are missing', () => {
    expect(
      extractCandidateJobTitle({
        headline: 'Managing Partner @ 3-P Solutions Consulting, LLC',
        jobTitles: ['Executive Consultant - Business and People Transformation'],
      }),
    ).toBe('Executive Consultant - Business and People Transformation');
  });

  it('falls back to headline only when no role exists', () => {
    expect(
      extractCandidateJobTitle({
        headline: 'Head of Talent at Korn Ferry',
      }),
    ).toBe('Head of Talent at Korn Ferry');
  });

  it('uses the company_id-matching current_position instead of [0]', () => {
    expect(
      extractCandidateJobTitle(
        {
          jobTitles: ['Co-Founder'],
          current_positions: [
            {
              role: 'Co-Founder',
              company: 'Intelligent Brain project management',
              company_id: '111',
            },
            {
              role: 'Operation Manager',
              company: 'Mazaya international',
              company_id: '68533040',
            },
          ],
        },
        { companyName: 'Mazaya', companyId: '68533040' },
      ),
    ).toBe('Operation Manager');
  });

  it('uses a later current_position when only the company name matches', () => {
    expect(
      extractCandidateJobTitle(
        {
          current_positions: [
            {
              role: 'Co-Founder',
              company: 'Intelligent Brain project management',
            },
            {
              role: 'Operation Manager',
              company: 'Mazaya international',
            },
          ],
        },
        { companyName: 'Mazaya' },
      ),
    ).toBe('Operation Manager');
  });

  it('does not classify current_positions[0] when it belongs to another company', () => {
    expect(
      extractCandidateJobTitle(
        {
          jobTitles: ['Co-Founder'],
          current_positions: [
            {
              role: 'Co-Founder',
              company: 'Intelligent Brain project management',
              company_id: '111',
            },
          ],
        },
        { companyName: 'Mazaya', companyId: '68533040' },
      ),
    ).toBeNull();
  });
});

describe('extractCandidateCompanyName', () => {
  it('reads Unipile current_positions.company', () => {
    expect(
      extractCandidateCompanyName({
        headline:
          'Leading sustainable electric transportation initiatives with global collaboration.',
        current_positions: [
          {
            role: 'Senior Director , Government of Saudi Arabia',
            company: 'Industrial Clusters | التجمعات الصناعية',
            company_id: '324236',
          },
        ],
      }),
    ).toBe('Industrial Clusters | التجمعات الصناعية');
  });

  it('prefers the company_id-matching current_position', () => {
    expect(
      extractCandidateCompanyName(
        {
          current_positions: [
            { company: 'Other Co', company_id: '1', role: 'Advisor' },
            { company: 'Mazaya', company_id: '68533040', role: 'PM' },
          ],
        },
        { companyName: 'Mazaya', companyId: '68533040' },
      ),
    ).toBe('Mazaya');
  });
});

describe('candidateCurrentlyWorksAtTargetCompany', () => {
  const mazayaTarget = { companyName: 'Mazaya', companyId: '68533040' };

  it('keeps a person whose current_position company_id matches', () => {
    expect(
      candidateCurrentlyWorksAtTargetCompany(
        {
          current_positions: [
            {
              role: 'Co-Founder',
              company: 'Intelligent Brain project management',
              company_id: '111',
            },
            {
              role: 'Operation Manager',
              company: 'Mazaya international',
              company_id: '68533040',
            },
          ],
        },
        mazayaTarget,
      ),
    ).toBe(true);
  });

  it('drops a person whose current roles are only at another company', () => {
    expect(
      candidateCurrentlyWorksAtTargetCompany(
        {
          jobTitles: ['Co-Founder'],
          current_positions: [
            {
              role: 'Co-Founder',
              company: 'Intelligent Brain project management',
              company_id: '111',
            },
          ],
        },
        mazayaTarget,
      ),
    ).toBe(false);
  });

  it('keeps a person with no employer identity on the hit', () => {
    expect(
      candidateCurrentlyWorksAtTargetCompany(
        { jobTitle: 'Head of Talent', name: 'Alex' },
        mazayaTarget,
      ),
    ).toBe(true);
  });

  it('drops a top-level company field that does not match', () => {
    expect(
      candidateCurrentlyWorksAtTargetCompany(
        { jobTitle: 'Head of Talent', company: 'Other Co' },
        mazayaTarget,
      ),
    ).toBe(false);
  });
});

describe('extractCandidateExperience', () => {
  it('reads nested title.name and snake_case dates', () => {
    expect(
      extractCandidateExperience({
        experience: [
          {
            title: { name: 'VP Product' },
            start_date: '2022-01-01',
            end_date: '2024-06-01',
            is_current: false,
          },
          { title: '  ' },
        ],
      }),
    ).toEqual([
      {
        title: 'VP Product',
        startDate: '2022-01-01',
        endDate: '2024-06-01',
        isCurrent: false,
      },
    ]);
  });

  it('merges current_positions, work_experience, and experience', () => {
    expect(
      extractCandidateExperience({
        headline: 'Speaker & Facilitator | Strategic Communication',
        current_positions: [
          {
            role: 'Director of Talent Solutions',
            start: { year: 2021, month: 3 },
          },
        ],
        work_experience: [
          {
            role: 'Director of Talent Solutions',
            start: { year: 2021, month: 3 },
          },
          {
            role: 'Talent Lead',
            start: { year: 2018, month: 1 },
            end: { year: 2021, month: 2 },
          },
        ],
        experience: [
          {
            title: 'HR Coordinator',
            start_date: '2015-06-01',
            end_date: '2017-12-01',
            is_current: false,
          },
        ],
      }),
    ).toEqual([
      {
        title: 'Director of Talent Solutions',
        startDate: '2021-03-01',
        endDate: null,
        isCurrent: true,
      },
      {
        title: 'Talent Lead',
        startDate: '2018-01-01',
        endDate: '2021-02-01',
        isCurrent: false,
      },
      {
        title: 'HR Coordinator',
        startDate: '2015-06-01',
        endDate: '2017-12-01',
        isCurrent: false,
      },
    ]);
  });
});

describe('matchesTaxonomyFilter', () => {
  const resolved = classificationToResolvedFields({
    title: 'VP Engineering',
    normalized_title: 'vp engineering',
    function_root: {
      id: 'engineering',
      label: 'engineering',
      name: 'engineering',
      parent_id: null,
      level: 1,
    },
    function: {
      id: 'software engineering',
      label: 'software engineering',
      name: 'software engineering',
      parent_id: 'engineering',
      level: 2,
    },
    grade: {
      id: 'leadership',
      label: 'leadership',
      name: 'leadership',
      parent_id: null,
      level: null,
    },
    confidence: 0.9,
  });

  it('matches function root and optional grade', () => {
    expect(
      matchesTaxonomyFilter(resolved, {
        stdFunctionRoot: 'engineering',
        stdGrade: 'leadership',
      }),
    ).toBe(true);
    expect(
      matchesTaxonomyFilter(resolved, {
        stdFunctionRoot: 'engineering',
        stdGrade: 'entry',
      }),
    ).toBe(false);
  });

  it('requires a function dimension', () => {
    expect(
      matchesTaxonomyFilter(resolved, {
        stdGrade: 'leadership',
      }),
    ).toBe(false);
  });

  it('treats project stdFunction == stdFunctionRoot as a root match', () => {
    expect(
      matchesTaxonomyFilter(resolved, {
        stdFunction: 'engineering',
        stdFunctionRoot: 'engineering',
        stdGrade: 'leadership',
      }),
    ).toBe(true);
    expect(
      matchesTaxonomyFilter(
        {
          stdFunction: 'talent acquisition',
          stdFunctionRoot: 'human resources',
          stdGrade: 'leadership',
          confidence: 0.8,
        },
        {
          stdFunction: 'human resources',
          stdFunctionRoot: 'human resources',
          stdGrade: 'leadership',
        },
      ),
    ).toBe(true);
    expect(
      matchesTaxonomyFilter(
        {
          stdFunction: 'talent acquisition',
          stdFunctionRoot: 'human resources',
          stdGrade: 'leadership',
          confidence: 0.8,
        },
        {
          stdFunction: 'compensation',
          stdFunctionRoot: 'human resources',
          stdGrade: 'leadership',
        },
      ),
    ).toBe(false);
  });
});
