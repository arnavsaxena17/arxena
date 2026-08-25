import {
  buildMissingCandidatePatch,
  buildMissingPersonPatch,
  isUploadFieldEmpty,
} from 'src/engine/core-modules/candidate-sourcing/utils/upload-profile-fill-missing.utils';

describe('upload-profile fill missing fields', () => {
  it('treats empty strings, blank links, and blank emails as empty', () => {
    expect(isUploadFieldEmpty('')).toBe(true);
    expect(isUploadFieldEmpty('  ')).toBe(true);
    expect(isUploadFieldEmpty({ primaryEmail: '' })).toBe(true);
    expect(isUploadFieldEmpty({ primaryLinkUrl: '' })).toBe(true);
    expect(isUploadFieldEmpty({ firstName: '', lastName: '' })).toBe(true);
    expect(isUploadFieldEmpty('jane@arxena.com')).toBe(false);
  });

  it('fills person fields that are missing and leaves populated ones alone', () => {
    const patch = buildMissingPersonPatch(
      {
        emails: { primaryEmail: '' },
        phones: { primaryPhoneNumber: '+15551212' },
        linkedinLink: { primaryLinkUrl: '' },
        jobTitle: 'Engineer',
        name: { firstName: 'Jane', lastName: '' },
      },
      {
        emails: { primaryEmail: 'jane@arxena.com' },
        phones: { primaryPhoneNumber: '+19999999' },
        linkedinLink: {
          primaryLinkUrl: 'https://linkedin.com/in/jane-doe',
          primaryLinkLabel: 'https://linkedin.com/in/jane-doe',
        },
        jobTitle: 'Director',
        name: { firstName: 'Janet', lastName: 'Doe' },
        companyId: 'company-1',
      },
    );

    expect(patch).toEqual({
      emails: { primaryEmail: 'jane@arxena.com' },
      linkedinLink: {
        primaryLinkUrl: 'https://linkedin.com/in/jane-doe',
        primaryLinkLabel: 'https://linkedin.com/in/jane-doe',
      },
      name: { firstName: 'Jane', lastName: 'Doe' },
    });
    expect(patch.phones).toBeUndefined();
    expect(patch.jobTitle).toBeUndefined();
    expect(patch.companyId).toBeUndefined();
  });

  it('fills candidate fields that are missing and does not overwrite existing values', () => {
    const patch = buildMissingCandidatePatch(
      {
        email: { primaryEmail: 'kept@arxena.com' },
        phoneNumber: { primaryPhoneNumber: '' },
        linkedinUrl: { primaryLinkUrl: '' },
        jobTitle: '',
        jobCompanyName: 'Acme',
        linkedinProfileId: '',
      },
      {
        email: { primaryEmail: 'new@arxena.com' },
        phoneNumber: { primaryPhoneNumber: '+15550000' },
        linkedinUrl: {
          primaryLinkUrl: 'https://linkedin.com/in/jane-doe',
          primaryLinkLabel: 'https://linkedin.com/in/jane-doe',
        },
        linkedinProfileId: 'jane-doe',
        jobTitle: 'Engineer',
        jobCompanyName: 'Other Co',
      },
    );

    expect(patch).toEqual({
      phoneNumber: { primaryPhoneNumber: '+15550000' },
      linkedinUrl: {
        primaryLinkUrl: 'https://linkedin.com/in/jane-doe',
        primaryLinkLabel: 'https://linkedin.com/in/jane-doe',
      },
      linkedinProfileId: 'jane-doe',
      jobTitle: 'Engineer',
    });
    expect(patch.email).toBeUndefined();
    expect(patch.jobCompanyName).toBeUndefined();
  });
});
