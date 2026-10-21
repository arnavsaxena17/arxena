import { generateLinkedInSearchUrl } from 'src/engine/core-modules/candidate-search/utils/search-parameter.utils';

describe('Sales Navigator location exclude URL encoding', () => {
  it('emits selectionType:EXCLUDED for location.exclude ids', () => {
    const url = generateLinkedInSearchUrl(
      {
        company: { include: ['1406'], exclude: null },
        company_display: [{ id: '1406', title: 'Acme' }],
        location: {
          include: null,
          exclude: ['106164952', '90000084'],
        },
        location_display: [
          { id: '106164952', title: 'Mumbai' },
          { id: '90000084', title: 'Bengaluru' },
        ],
      },
      'sales_navigator',
      'people',
    );

    expect(url).toBeTruthy();
    const decoded = decodeURIComponent(url!);
    expect(decoded).toContain('selectionType:EXCLUDED');
    expect(decoded).toContain('id:106164952');
    expect(decoded).toContain('id:90000084');
    expect(decoded).toContain('type:REGION');
  });
});
