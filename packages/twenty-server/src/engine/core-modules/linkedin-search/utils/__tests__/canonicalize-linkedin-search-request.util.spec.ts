import {
  type LinkedInClassicPeopleSearchRequest,
  type LinkedInRecruiterPeopleSearchRequest,
  type LinkedInSalesNavigatorPeopleSearchRequest,
  type LinkedInSearchRequest,
} from 'src/engine/core-modules/linkedin-search/types/linkedin-search-request.type';
import { canonicalizeLinkedInSearchRequest } from 'src/engine/core-modules/linkedin-search/utils/canonicalize-linkedin-search-request.util';

const classic = (
  overrides: Partial<LinkedInClassicPeopleSearchRequest>,
): LinkedInClassicPeopleSearchRequest => ({
  api: 'classic',
  category: 'people',
  ...overrides,
});

const recruiter = (
  overrides: Partial<LinkedInRecruiterPeopleSearchRequest>,
): LinkedInRecruiterPeopleSearchRequest => ({
  api: 'recruiter',
  category: 'people',
  ...overrides,
});

const salesNavigator = (
  overrides: Partial<LinkedInSalesNavigatorPeopleSearchRequest>,
): LinkedInSalesNavigatorPeopleSearchRequest => ({
  api: 'sales_navigator',
  category: 'people',
  ...overrides,
});

const canonical = (request: LinkedInSearchRequest): unknown =>
  canonicalizeLinkedInSearchRequest(request);

describe('canonicalizeLinkedInSearchRequest', () => {
  it('collapses the legal forms of one employer', () => {
    expect(
      canonical(classic({ company: ['Jubilant FoodWorks Ltd.'] })),
    ).toEqual(canonical(classic({ company: ['Jubilant Foodworks'] })));
    expect(
      canonical(
        classic({ past_company: ['Jubilant FoodWorks Private Limited'] }),
      ),
    ).toEqual(canonical(classic({ past_company: ['JUBILANT FOODWORKS'] })));
  });

  it('leaves fields that are not company names alone', () => {
    expect(
      canonical(
        classic({
          keywords: 'Supply Chain Head',
          location: ['Mumbai, Maharashtra, India'],
          company: ['Jubilant FoodWorks Ltd.'],
        }),
      ),
    ).toEqual({
      api: 'classic',
      category: 'people',
      keywords: 'Supply Chain Head',
      location: ['Mumbai, Maharashtra, India'],
      company: ['jubilant foodworks'],
    });
  });

  it('keeps a company id and a company URL as they are', () => {
    const request = recruiter({
      company: [
        { id: 'c_123-abc', name: 'Jubilant FoodWorks Ltd.' },
        { keywords: 'Jubilant FoodWorks Ltd.' },
      ],
      current_company: [{ id: 'c_123-abc' }],
    });

    expect(canonical(request)).toEqual({
      api: 'recruiter',
      category: 'people',
      company: [
        { id: 'c_123-abc', name: 'jubilant foodworks' },
        { keywords: 'jubilant foodworks' },
      ],
      current_company: [{ id: 'c_123-abc' }],
    });
  });

  it('canonicalises the include/exclude company filter but not its URLs', () => {
    const request = salesNavigator({
      company: {
        include: [
          'Jubilant FoodWorks Ltd.',
          'https://www.linkedin.com/company/jubilant',
        ],
        exclude: ['Jubilant FoodWorks Group'],
      },
    });

    expect(canonical(request)).toEqual(
      salesNavigator({
        company: {
          include: [
            'jubilant foodworks',
            'https://www.linkedin.com/company/jubilant',
          ],
          exclude: ['jubilant foodworks group'],
        },
      }),
    );
  });

  it('canonicalises advanced keyword company text', () => {
    const request = classic({
      advanced_keywords: { company: 'Jubilant FoodWorks Ltd.', title: 'Head' },
    });

    expect(canonical(request)).toEqual(
      classic({
        advanced_keywords: { company: 'jubilant foodworks', title: 'Head' },
      }),
    );
  });
});
