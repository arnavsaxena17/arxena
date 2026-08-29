import {
  buildOutreachQueuedCreateFields,
  isOutreachSourcingEnrollment,
} from 'src/engine/core-modules/outreach-command/utils/outreach-queued-enrollment.util';

describe('isOutreachSourcingEnrollment', () => {
  it('matches GTM upload origin', () => {
    expect(
      isOutreachSourcingEnrollment('gtm-workflow-upload-profiles', { name: 'Harvest' }),
    ).toBe(true);
  });

  it('matches GTM project names', () => {
    expect(
      isOutreachSourcingEnrollment('linkedin_search', { name: 'GTM Harvest' }),
    ).toBe(true);
  });

  it('matches projects with an icpSpec', () => {
    expect(
      isOutreachSourcingEnrollment('linkedin_search', {
        name: 'Harvest',
        icpSpec: '{}',
      }),
    ).toBe(true);
  });

  it('does not match unrelated sourcing', () => {
    expect(
      isOutreachSourcingEnrollment('spreadsheet_import', { name: 'Backend Hire' }),
    ).toBe(false);
  });
});

describe('buildOutreachQueuedCreateFields', () => {
  it('sets QUEUED and extracts a LinkedIn slug', () => {
    expect(
      buildOutreachQueuedCreateFields({
        linkedinUrl: 'https://www.linkedin.com/in/jane-doe/',
      }),
    ).toEqual({
      outreachSequenceStage: 'QUEUED',
      linkedinProfileId: 'jane-doe',
    });
  });

  it('keeps an explicit linkedinProfileId when the URL is missing', () => {
    expect(
      buildOutreachQueuedCreateFields({
        linkedinProfileId: 'ACoAAA123',
      }),
    ).toEqual({
      outreachSequenceStage: 'QUEUED',
      linkedinProfileId: 'ACoAAA123',
    });
  });
});
