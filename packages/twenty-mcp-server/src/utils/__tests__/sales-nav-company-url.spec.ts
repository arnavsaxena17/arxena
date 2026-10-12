import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isSalesNavCompanySearchUrl,
  parseSalesNavCompanyUrl,
} from '../sales-nav-company-url';

const RESTAURANTS_URL =
  'https://www.linkedin.com/sales/search/company?query=(filters%3AList((type%3AREGION%2Cvalues%3AList((id%3A102713980%2Ctext%3AIndia%2CselectionType%3AINCLUDED)))%2C(type%3AINDUSTRY%2Cvalues%3AList((id%3A32%2Ctext%3ARestaurants%2CselectionType%3AINCLUDED)%2C(id%3A34%2Ctext%3AFood%2520and%2520Beverage%2520Services%2CselectionType%3AINCLUDED)))%2C(type%3ACOMPANY_HEADCOUNT%2Cvalues%3AList((id%3AD%2Ctext%3A51-200%2CselectionType%3AINCLUDED)%2C(id%3AE%2Ctext%3A201-500%2CselectionType%3AINCLUDED)%2C(id%3AF%2Ctext%3A501-1%252C000%2CselectionType%3AINCLUDED)%2C(id%3AG%2Ctext%3A1%252C001-5%252C000%2CselectionType%3AINCLUDED)))))&sessionId=BbJc7dmZRuKIwrUBrrX66w%3D%3D&viewAllFilters=true';

describe('parseSalesNavCompanyUrl', () => {
  it('should convert region, industry and headcount filters into a Unipile payload', () => {
    const { payload, unsupportedFilters } =
      parseSalesNavCompanyUrl(RESTAURANTS_URL);

    assert.deepEqual(payload, {
      api: 'sales_navigator',
      category: 'companies',
      location: { include: ['102713980'] },
      industry: { include: ['32', '34'] },
      headcount: [
        { min: 51, max: 200 },
        { min: 201, max: 500 },
        { min: 501, max: 1000 },
        { min: 1001, max: 5000 },
      ],
    });
    assert.deepEqual(unsupportedFilters, []);
  });

  it('should keep excluded values and keywords', () => {
    const { payload } = parseSalesNavCompanyUrl(
      'https://www.linkedin.com/sales/search/company?query=(filters%3AList((type%3AREGION%2Cvalues%3AList((id%3A1%2Ctext%3AA%2CselectionType%3AINCLUDED)%2C(id%3A2%2Ctext%3AB%2CselectionType%3AEXCLUDED))))%2Ckeywords%3Acloud%2520kitchen)',
    );

    assert.deepEqual(payload.location, { include: ['1'], exclude: ['2'] });
    assert.equal(payload.keywords, 'cloud kitchen');
  });

  it('should report filters the payload cannot express', () => {
    const { unsupportedFilters } = parseSalesNavCompanyUrl(
      'https://www.linkedin.com/sales/search/company?query=(filters%3AList((type%3ACOMPANY_TYPE%2Cvalues%3AList((id%3AP%2Ctext%3APrivate%2CselectionType%3AINCLUDED)))))',
    );

    assert.deepEqual(unsupportedFilters, ['COMPANY_TYPE']);
  });

  it('should reject people-search URLs', () => {
    assert.equal(
      isSalesNavCompanySearchUrl(
        'https://www.linkedin.com/sales/search/people?query=(a)',
      ),
      false,
    );
    assert.throws(() =>
      parseSalesNavCompanyUrl(
        'https://www.linkedin.com/sales/search/people?query=(a)',
      ),
    );
  });
});
