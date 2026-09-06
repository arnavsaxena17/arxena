import {
  extractOrgChartNodeCandidateRows,
  hydrateOrgChartNodePeople,
  listOrgChartNodesMatching,
} from 'src/engine/core-modules/org-chart/utils/org-chart-node-people.util';

describe('org-chart-node-people.util', () => {
  const orgChartData = {
    orgchart: [
      {
        key: 14,
        parent: 1000000,
        headline: 'SOFTWARE LEADERSHIP',
        std_function: 'software',
        std_function_root: 'technology',
        std_grade: 'leadership',
        len_candidates: 1,
        candidates: [
          {
            full_name: 'julian lord',
            job_title: 'director it operations',
            linkedin_url: 'linkedin.com/in/lordjulian',
          },
        ],
      },
      {
        key: 24,
        parent: 25,
        headline: 'INFORMATION TECHNOLOGY MANAGERS',
        std_function: 'information technology',
        std_function_root: 'technology',
        std_grade: 'mid',
        name_0: 'richard clutterbuck',
        title_0: 'it commercial manager',
        url_0: 'https://www.linkedin.com/in/richard-clutterbuck',
      },
    ],
  };

  it('extracts candidates from the node array and indexed GoJS fields', () => {
    const leadership = listOrgChartNodesMatching(orgChartData, {
      nodeKey: 14,
    });
    const managers = listOrgChartNodesMatching(orgChartData, {
      nodeKey: 24,
    });

    expect(extractOrgChartNodeCandidateRows(leadership[0].raw)).toEqual([
      {
        full_name: 'julian lord',
        job_title: 'director it operations',
        linkedin_url: 'linkedin.com/in/lordjulian',
      },
    ]);
    expect(extractOrgChartNodeCandidateRows(managers[0].raw)).toEqual([
      {
        full_name: 'richard clutterbuck',
        job_title: 'it commercial manager',
        linkedin_url: 'https://www.linkedin.com/in/richard-clutterbuck',
      },
    ]);
  });

  it('lists nodes by taxonomy when nodeKey is omitted', () => {
    const matches = listOrgChartNodesMatching(orgChartData, {
      stdFunctionRoot: 'technology',
      stdGrade: 'mid',
    });

    expect(matches.map((match) => match.resolved.key)).toEqual([24]);
  });

  it('hydrates headline and summary from stored S3 people by LinkedIn URL', () => {
    const items = hydrateOrgChartNodePeople(
      [
        {
          full_name: 'julian lord',
          job_title: 'director it operations',
          linkedin_url: 'linkedin.com/in/lordjulian',
        },
      ],
      [
        {
          name: 'Julian Lord',
          jobTitle: 'Director IT Operations',
          headline: 'Director of IT Operations at British Airways',
          linkedinSummary:
            'Owns cloud and infrastructure operations including AWS compute.',
          linkedinUrl: 'https://www.linkedin.com/in/lordjulian',
          locationName: 'United Kingdom',
        },
      ],
    );

    expect(items).toEqual([
      {
        full_name: 'Julian Lord',
        job_title: 'Director IT Operations',
        headline: 'Director of IT Operations at British Airways',
        summary:
          'Owns cloud and infrastructure operations including AWS compute.',
        linkedin_url: 'https://www.linkedin.com/in/lordjulian',
        location: 'United Kingdom',
      },
    ]);
  });

  it('keeps node people when S3 stored people are missing', () => {
    const items = hydrateOrgChartNodePeople(
      [
        {
          full_name: 'sue daniels',
          job_title: 'group it business manager',
        },
      ],
      null,
    );

    expect(items).toEqual([
      {
        full_name: 'sue daniels',
        job_title: 'group it business manager',
      },
    ]);
  });
});
