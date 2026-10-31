import { buildSerpEvidence } from 'src/engine/core-modules/arx-web-search/utils/extract-serp-evidence.util';

describe('buildSerpEvidence', () => {
  it('should return null when Google returned neither an overview nor snippets', () => {
    expect(buildSerpEvidence('q', {})).toBeNull();
    expect(
      buildSerpEvidence('q', { organic: [{ title: 'Only a title' }] }),
    ).toBeNull();
  });

  it('should put the AI overview before the organic snippets', () => {
    const evidence = buildSerpEvidence('zoho revenue', {
      ai_overview: { texts: ['Zoho earned', { text: 'Rs 12,313 crore' }] },
      organic: [
        {
          title: 'Zoho Corporation',
          link: 'https://zoho.com',
          description: 'Revenue 12,313 crore Read more',
        },
      ],
    });

    expect(evidence?.aiOverview).toBe('Zoho earned\nRs 12,313 crore');
    expect(evidence?.text.indexOf('AI OVERVIEW')).toBeLessThan(
      evidence?.text.indexOf('SEARCH RESULTS') ?? -1,
    );
    expect(evidence?.snippets[0].description).toBe('Revenue 12,313 crore');
  });

  it('should read the bullets of a list-shaped AI overview', () => {
    const evidence = buildSerpEvidence('acme procurement head', {
      ai_overview: {
        texts: [
          { type: 'paragraph', snippet: 'Procurement is led by:' },
          {
            type: 'list',
            title: 'Veeramani M P - Head of Procurement',
            list: [
              { snippet: 'Veeramani M P - Head of Procurement' },
              { snippet: 'Suresh N - Purchase Lead' },
            ],
          },
        ],
      },
    });

    expect(evidence?.aiOverview).toBe(
      'Procurement is led by:\nVeeramani M P - Head of Procurement\nSuresh N - Purchase Lead',
    );
  });

  it('should work from organic snippets alone and cap them', () => {
    const organic = Array.from({ length: 10 }, (_, index) => ({
      title: `T${index}`,
      url: `https://e${index}.com`,
      description: `D${index}`,
    }));
    const evidence = buildSerpEvidence('q', { organic });

    expect(evidence?.aiOverview).toBeNull();
    expect(evidence?.snippets).toHaveLength(6);
  });
});
