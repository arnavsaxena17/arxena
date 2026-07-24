import { inferLinkedInSearchTypeFromUnipileOwnerProfile } from './inferLinkedInSearchTypeFromUnipileOwnerProfile';

describe('inferLinkedInSearchTypeFromUnipileOwnerProfile', () => {
  it('returns sales_navigator when sales_navigator seat exists', () => {
    const result = inferLinkedInSearchTypeFromUnipileOwnerProfile({
      sales_navigator: { contract_id: '2018307205', owner_seat_id: '1549565576' },
      recruiter: null,
    });
    console.log('sales_navigator profile ->', result);
    expect(result).toBe('sales_navigator');
  });

  it('returns recruiter when only recruiter seat exists', () => {
    const result = inferLinkedInSearchTypeFromUnipileOwnerProfile({
      sales_navigator: null,
      recruiter: { contract_id: '2046470038', owner_seat_id: '1593520148' },
    });
    console.log('recruiter profile ->', result);
    expect(result).toBe('recruiter');
  });

  it('prefers sales_navigator when both seats exist', () => {
    const result = inferLinkedInSearchTypeFromUnipileOwnerProfile({
      sales_navigator: { contract_id: '1', owner_seat_id: '2' },
      recruiter: { contract_id: '3', owner_seat_id: '4' },
    });
    console.log('both seats ->', result);
    expect(result).toBe('sales_navigator');
  });

  it('returns classic when neither seat exists', () => {
    const result = inferLinkedInSearchTypeFromUnipileOwnerProfile({
      sales_navigator: null,
      recruiter: null,
    });
    console.log('no seats ->', result);
    expect(result).toBe('classic');
  });
});
