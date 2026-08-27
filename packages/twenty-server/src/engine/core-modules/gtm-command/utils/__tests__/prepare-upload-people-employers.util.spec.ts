import {
  collectUniqueEmployerHits,
  prepareUploadPersonEmployer,
  stampCrmCompanyIds,
} from '../prepare-upload-people-employers.util';

describe('prepareUploadPersonEmployer', () => {
  it('keeps Gopala at Hinduja and skips Gaurav at Namokar', () => {
    const intent = { companyId: '946958', companyName: 'Hinduja Hospital' };
    const kept = prepareUploadPersonEmployer(
      {
        name: 'Gopala Krishnan',
        current_positions: [
          {
            role: 'Group President',
            company: 'Hinduja Group Limited',
            company_id: '946958',
          },
        ],
      },
      intent,
      '3616d8a1-0219-408a-a6e9-75105117be4e',
    );
    const skipped = prepareUploadPersonEmployer(
      {
        name: 'Gaurav Mittal',
        current_positions: [
          { role: 'Founder', company: 'Namokar', company_id: null },
        ],
      },
      intent,
      '3616d8a1-0219-408a-a6e9-75105117be4e',
    );

    expect(kept.skip).toBe(false);
    expect(kept.employerHit).toEqual({
      id: '946958',
      name: 'Hinduja Group Limited',
    });
    expect(kept.person.companyId).toBe(
      '3616d8a1-0219-408a-a6e9-75105117be4e',
    );
    expect(kept.person.jobCompanyId).toBe('946958');
    expect(skipped.skip).toBe(true);
  });

  it('dedupes employer hits and stamps CRM UUIDs from upsert order', () => {
    const hits = collectUniqueEmployerHits([
      { id: '946958', name: 'Hinduja Hospital' },
      { id: '946958', name: 'P.D. Hinduja National Hospital' },
    ]);

    expect(hits).toEqual([{ id: '946958', name: 'Hinduja Hospital' }]);

    const stamped = stampCrmCompanyIds(
      [
        {
          name: 'Gopala',
          jobCompanyId: '946958',
        },
      ],
      hits,
      ['3616d8a1-0219-408a-a6e9-75105117be4e'],
    );

    expect(stamped[0].companyId).toBe(
      '3616d8a1-0219-408a-a6e9-75105117be4e',
    );
  });
});
