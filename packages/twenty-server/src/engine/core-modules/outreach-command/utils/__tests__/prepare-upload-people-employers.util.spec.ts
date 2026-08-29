import {
  buildUploadSearchIntent,
  collectUniqueEmployerHits,
  prepareUploadPersonEmployer,
  stampCrmCompanyIds,
} from '../prepare-upload-people-employers.util';

describe('buildUploadSearchIntent', () => {
  it('does not treat a person company or taxonomy as a skip filter', () => {
    expect(
      buildUploadSearchIntent({
        workflowCompany: undefined,
      }),
    ).toEqual({});
  });

  it('scopes only to the workflow company', () => {
    expect(
      buildUploadSearchIntent({
        workflowCompany: {
          id: '3616d8a1-0219-408a-a6e9-75105117be4e',
          name: 'Hinduja Hospital',
          linkedinId: '946958',
        },
      }),
    ).toEqual({
      companyId: '946958',
      companyName: 'Hinduja Hospital',
    });
  });
});

describe('prepareUploadPersonEmployer', () => {
  it('keeps classified search hits when there is no workflow company', () => {
    const prepared = prepareUploadPersonEmployer(
      {
        name: 'Ziad Daoud',
        title: 'Chief Executive Officer',
        company: 'INJAZ',
        companyName: 'INJAZ',
        stdFunction: 'ceo',
        stdFunctionRoot: 'ceo',
        stdGrade: 'leadership',
        linkedinUrl: 'https://www.linkedin.com/in/ziad-daoud-33aa8a98',
        current_positions: [
          {
            role: 'Chief Executive Officer',
            company: 'INJAZ',
            company_id: '12345',
          },
        ],
      },
      buildUploadSearchIntent({ workflowCompany: undefined }),
    );

    expect(prepared.skip).toBe(false);
    expect(prepared.employerHit).toEqual({ id: '12345', name: 'INJAZ' });
    expect(prepared.person.title).toBe('Chief Executive Officer');
  });

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
