import { resolvePeopleCompanyIds } from 'src/engine/core-modules/outreach-command/utils/resolve-people-company-ids.util';

type TestPerson = { companyId?: string; companyName: string };

const companies = [
  { id: 'c-monginis', name: 'Monginis' },
  { id: 'c-baskin', name: 'Baskin Robbins India' },
  { id: 'c-tata', name: 'Tata' },
  { id: 'c-tata-motors', name: 'Tata Motors' },
  { id: 'c-subway', name: 'Subway South Asia' },
];

describe('resolvePeopleCompanyIds', () => {
  it('should link an employer with a legal suffix to its company', () => {
    const [person] = resolvePeopleCompanyIds<TestPerson>(
      [{ companyName: 'Monginis Foods Pvt. Ltd.' }],
      companies,
    );

    expect(person.companyId).toBe('c-monginis');
  });

  it('should match exactly after dropping suffixes like India', () => {
    const [person] = resolvePeopleCompanyIds<TestPerson>(
      [{ companyName: 'Baskin Robbins' }],
      companies,
    );

    expect(person.companyId).toBe('c-baskin');
  });

  it('should link a brand name on the profile to the longer tab name', () => {
    const [person] = resolvePeopleCompanyIds<TestPerson>(
      [{ companyName: 'Subway' }],
      companies,
    );

    expect(person.companyId).toBe('c-subway');
  });

  it('should leave a person unlinked when two companies match', () => {
    const [person] = resolvePeopleCompanyIds<TestPerson>(
      [{ companyName: 'Tata Motors Finance' }],
      companies,
    );

    expect(person.companyId).toBeUndefined();
  });

  it('should keep an existing companyId and ignore unknown employers', () => {
    const people = resolvePeopleCompanyIds<TestPerson>(
      [
        { companyId: 'given', companyName: 'Monginis' },
        { companyName: 'Unrelated Co' },
      ],
      companies,
    );

    expect(people[0].companyId).toBe('given');
    expect(people[1].companyId).toBeUndefined();
  });
});
