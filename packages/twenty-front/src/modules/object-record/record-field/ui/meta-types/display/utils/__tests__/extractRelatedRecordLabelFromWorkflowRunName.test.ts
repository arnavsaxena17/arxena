import { extractRelatedRecordLabelFromWorkflowRunName } from '@/object-record/record-field/ui/meta-types/display/utils/extractRelatedRecordLabelFromWorkflowRunName';

describe('extractRelatedRecordLabelFromWorkflowRunName', () => {
  it('extracts the trigger record label from a named run', () => {
    expect(
      extractRelatedRecordLabelFromWorkflowRunName(
        '#30 - Mohamed Mazen Batterjee · GTM Outreach — Candidate Updated',
      ),
    ).toBe('Mohamed Mazen Batterjee');
  });

  it('returns undefined when the run has no related record label', () => {
    expect(
      extractRelatedRecordLabelFromWorkflowRunName(
        '#5 - Fetch & Save People Profiles',
      ),
    ).toBeUndefined();
  });

  it('returns undefined for non-string values', () => {
    expect(extractRelatedRecordLabelFromWorkflowRunName(null)).toBeUndefined();
    expect(
      extractRelatedRecordLabelFromWorkflowRunName(undefined),
    ).toBeUndefined();
  });
});
