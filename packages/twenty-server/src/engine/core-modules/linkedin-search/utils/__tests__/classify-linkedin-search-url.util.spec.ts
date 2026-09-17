import {
  classifyLinkedInSearchUrl,
  extractSalesNavigatorAccountListId,
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

  it('classifies Sales Navigator saved people list URLs for Unipile, not Harvest', () => {
    const classified = classifyLinkedInSearchUrl(
      'https://www.linkedin.com/sales/lists/people/7242931776162041856?sortCriteria=CREATED_TIME&sortOrder=DESCENDING',
    );

    expect(classified).toMatchObject({
      category: 'people',
      product: 'sales_navigator',
    });
    expect(isHarvestSalesNavigatorPeopleSearchUrl(classified)).toBe(false);
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

  it('extracts Sales Navigator account list ids', () => {
    expect(
      extractSalesNavigatorAccountListId(
        'https://www.linkedin.com/sales/accounts/dashboard?listGroup=CUSTOM_LISTS&listId=7496487791112110080',
      ),
    ).toBe('7496487791112110080');

    expect(
      extractSalesNavigatorAccountListId(
        'https://www.linkedin.com/sales/accounts/dashboard?listGroup=CUSTOM_LISTS&listId=ACCOUNT_7378394885466337283',
      ),
    ).toBe('7378394885466337283');

    expect(
      extractSalesNavigatorAccountListId(
        'https://www.linkedin.com/sales/lists/people/7242931776162041856?sortCriteria=CREATED_TIME&sortOrder=DESCENDING',
      ),
    ).toBeNull();

    expect(
      extractSalesNavigatorAccountListId(
        'https://www.linkedin.com/sales/search/company?query=(filters:List((type:COMPANY_HEADCOUNT)))',
      ),
    ).toBeNull();
  });
});
