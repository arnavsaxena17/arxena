import {
  classifyLinkedInSearchUrl,
  isHarvestSalesNavigatorPeopleSearchUrl,
} from '../classify-linkedin-search-url.util';

describe('classifyLinkedInSearchUrl', () => {
  it('classifies Sales Navigator saved people search URLs', () => {
    const classified = classifyLinkedInSearchUrl(
      'linkedin.com/sales/search/people?savedSearchId=1936431145',
    );

    expect(classified).toMatchObject({
      category: 'people',
      product: 'sales_navigator',
    });
    expect(isHarvestSalesNavigatorPeopleSearchUrl(classified)).toBe(true);
  });

  it('classifies classic people and company search URLs', () => {
    expect(
      classifyLinkedInSearchUrl(
        'https://www.linkedin.com/search/results/people/?keywords=helo&origin=SWITCH_SEARCH_VERTICAL',
      ),
    ).toMatchObject({
      category: 'people',
      product: 'classic',
    });

    expect(
      classifyLinkedInSearchUrl(
        'https://www.linkedin.com/search/results/companies/?keywords=helo&origin=SWITCH_SEARCH_VERTICAL',
      ),
    ).toMatchObject({
      category: 'companies',
      product: 'classic',
    });
  });

  it('classifies recruiter people URLs', () => {
    expect(
      classifyLinkedInSearchUrl(
        'https://www.linkedin.com/talent/search?keywords=engineer',
      ),
    ).toMatchObject({
      category: 'people',
      product: 'recruiter',
    });
  });

  it('returns null for profile URLs', () => {
    expect(
      classifyLinkedInSearchUrl('https://www.linkedin.com/in/someone'),
    ).toBeNull();
  });
});
