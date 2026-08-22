import {
  buildGtmQueuedCreateFields,
  isGtmSourcingEnrollment,
} from 'src/engine/core-modules/gtm-command/utils/gtm-queued-enrollment.util';

describe('isGtmSourcingEnrollment', () => {
  it('matches GTM upload origin', () => {
    expect(
      isGtmSourcingEnrollment('gtm-workflow-upload-profiles', { name: 'Harvest' }),
    ).toBe(true);
  });

  it('matches GTM project names', () => {
    expect(
      isGtmSourcingEnrollment('linkedin_search', { name: 'GTM Harvest' }),
    ).toBe(true);
  });

  it('matches projects with an icpSpec', () => {
    expect(
      isGtmSourcingEnrollment('linkedin_search', {
        name: 'Harvest',
        icpSpec: '{}',
      }),
    ).toBe(true);
  });

  it('does not match unrelated sourcing', () => {
    expect(
      isGtmSourcingEnrollment('spreadsheet_import', { name: 'Backend Hire' }),
    ).toBe(false);
  });
});

describe('buildGtmQueuedCreateFields', () => {
  it('sets QUEUED and extracts a LinkedIn slug', () => {
    expect(
      buildGtmQueuedCreateFields({
        linkedinUrl: 'https://www.linkedin.com/in/jane-doe/',
      }),
    ).toEqual({
      outreachSequenceStage: 'QUEUED',
      linkedinProfileId: 'jane-doe',
    });
  });

  it('keeps an explicit linkedinProfileId when the URL is missing', () => {
    expect(
      buildGtmQueuedCreateFields({
        linkedinProfileId: 'ACoAAA123',
      }),
    ).toEqual({
      outreachSequenceStage: 'QUEUED',
      linkedinProfileId: 'ACoAAA123',
    });
  });
});
