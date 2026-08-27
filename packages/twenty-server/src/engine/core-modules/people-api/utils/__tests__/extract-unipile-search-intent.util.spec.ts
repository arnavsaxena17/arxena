import {
  extractUnipilePeopleSearchIntent,
  parseSalesNavUrlSearchIntent,
} from '../extract-unipile-search-intent.util';

describe('extractUnipilePeopleSearchIntent', () => {
  it('reads Unipile config.params.company.include and seniority.include', () => {
    expect(
      extractUnipilePeopleSearchIntent({
        params: {
          company: { include: ['946958', '15115627'] },
          seniority: { include: ['director', 'cxo'] },
        },
      }),
    ).toEqual({
      companyIds: ['946958', '15115627'],
      seniorities: ['director', 'cxo'],
    });
  });
});

describe('parseSalesNavUrlSearchIntent', () => {
  it('parses CURRENT_COMPANY organization ids and SENIORITY_LEVEL text', () => {
    const url =
      'https://www.linkedin.com/sales/search/people?query=(filters:List((type:CURRENT_COMPANY,values:List((id:urn:li:organization:946958,text:Hinduja))),(type:SENIORITY_LEVEL,values:List((id:10,text:Director),(id:9,text:CXO)))))';

    expect(parseSalesNavUrlSearchIntent(url)).toEqual({
      companyIds: ['946958'],
      seniorities: ['director', 'cxo'],
    });
  });
});
