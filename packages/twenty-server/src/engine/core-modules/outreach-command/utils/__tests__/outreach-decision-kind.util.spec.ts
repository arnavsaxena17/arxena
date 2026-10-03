import {
  decisionKindFromFormStepName,
  draftBodyFromFormFields,
  outreachDecisionSourceKey,
} from 'src/engine/core-modules/outreach-command/utils/outreach-decision-kind.util';

describe('decisionKindFromFormStepName', () => {
  it('maps sequencer FORM names onto Today kinds', () => {
    expect(decisionKindFromFormStepName('Approve connection note')).toEqual({
      kind: 'CONNECTION_NOTE',
      urgency: 'APPROVE',
    });
    expect(
      decisionKindFromFormStepName('Approve connection note (no company)'),
    ).toEqual({ kind: 'CONNECTION_NOTE', urgency: 'APPROVE' });
    expect(decisionKindFromFormStepName('Approve LinkedIn comment')).toEqual({
      kind: 'COMMENT_DRAFT',
      urgency: 'APPROVE',
    });
    expect(
      decisionKindFromFormStepName('Approve second LinkedIn comment'),
    ).toEqual({ kind: 'COMMENT_DRAFT', urgency: 'APPROVE' });
    expect(
      decisionKindFromFormStepName('Approve / edit first message'),
    ).toEqual({ kind: 'MESSAGE_DRAFT', urgency: 'APPROVE' });
    expect(decisionKindFromFormStepName('Approve / edit InMail')).toEqual({
      kind: 'MESSAGE_DRAFT',
      urgency: 'APPROVE',
    });
    expect(decisionKindFromFormStepName('Approve / edit email')).toEqual({
      kind: 'MESSAGE_DRAFT',
      urgency: 'APPROVE',
    });
    expect(
      decisionKindFromFormStepName('Approve post-reply follow-up 1'),
    ).toEqual({ kind: 'MESSAGE_DRAFT', urgency: 'APPROVE' });
    expect(
      decisionKindFromFormStepName('Approve post-reply follow-up 2'),
    ).toEqual({ kind: 'MESSAGE_DRAFT', urgency: 'APPROVE' });
    expect(decisionKindFromFormStepName('Approve LinkedIn reply')).toEqual({
      kind: 'REPLY_DRAFT',
      urgency: 'NOW',
    });
    expect(decisionKindFromFormStepName('Approve WhatsApp reply')).toEqual({
      kind: 'REPLY_DRAFT',
      urgency: 'NOW',
    });
    expect(decisionKindFromFormStepName('Approve email reply')).toEqual({
      kind: 'REPLY_DRAFT',
      urgency: 'NOW',
    });
    expect(decisionKindFromFormStepName('Approve referral intro')).toEqual({
      kind: 'REPLY_DRAFT',
      urgency: 'NOW',
    });
    expect(decisionKindFromFormStepName('Approve meeting reminder')).toEqual({
      kind: 'MEETING_ACTION',
      urgency: 'NOW',
    });
    expect(decisionKindFromFormStepName('Approve no-show ping')).toEqual({
      kind: 'MEETING_ACTION',
      urgency: 'NOW',
    });
    expect(decisionKindFromFormStepName('Approve reschedule offer')).toEqual({
      kind: 'MEETING_ACTION',
      urgency: 'NOW',
    });
    expect(decisionKindFromFormStepName('Some other form')).toEqual({
      kind: 'MESSAGE_DRAFT',
      urgency: 'APPROVE',
    });
  });
});

describe('outreachDecisionSourceKey', () => {
  it('keys a row by the run step', () => {
    expect(outreachDecisionSourceKey('run-1', 'step-1')).toBe('run-1:step-1');
  });
});

describe('draftBodyFromFormFields', () => {
  it('prefers the resolved editedBody field', () => {
    expect(
      draftBodyFromFormFields([
        { name: 'approve', value: undefined },
        { name: 'editedBody', value: 'Hello there' },
      ]),
    ).toBe('Hello there');
  });
});
