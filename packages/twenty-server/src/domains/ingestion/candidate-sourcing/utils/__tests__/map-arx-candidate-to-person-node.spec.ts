import { mapArxCandidateToPersonNode } from '../data-transformation-utility';

describe('mapArxCandidateToPersonNode companyId', () => {
  it('copies a CRM UUID and ignores a LinkedIn numeric jobCompanyId', () => {
    const person = mapArxCandidateToPersonNode({
      firstName: 'Gopala',
      lastName: 'Krishnan',
      companyId: '3616d8a1-0219-408a-a6e9-75105117be4e',
      jobCompanyId: '946958',
    });

    expect(person.companyId).toBe('3616d8a1-0219-408a-a6e9-75105117be4e');
  });

  it('does not write a LinkedIn numeric id onto Person.companyId', () => {
    const person = mapArxCandidateToPersonNode({
      firstName: 'Gopala',
      lastName: 'Krishnan',
      companyId: '946958',
      jobCompanyId: '946958',
    });

    expect(person.companyId).toBeUndefined();
  });
});
