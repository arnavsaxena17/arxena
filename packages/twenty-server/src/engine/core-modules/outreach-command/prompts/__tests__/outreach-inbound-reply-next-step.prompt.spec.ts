import {
  OUTREACH_DONT_RESPOND_SENTINEL,
  buildOutreachInboundSignalExtractionPrompt,
  buildOutreachSalesChatDraftPrompt,
} from 'src/engine/core-modules/outreach-command/prompts/outreach-inbound-reply-next-step.prompt';

const SAMPLE_THREADS = [
  'Thanks for reaching out. Contact no is 9376828884 at 2:30 pm tomorrow',
  'Can we do a demo tomorrow? Second half? Can we do 3:30?',
  'Let us plan a VC next week. 25th Nov around 3 pm. anil@slntech.com',
  'Please email me at gaurav.zatakia@flomattress.com // Sure',
  'Demo on Thursday around noon. My number is 995 817 7936.',
  'Sure please connect on Yogesh.shinde@kshinternational.com',
  'Sure lets keep on Sat // Lets do Sat 11 am',
  'Interested, can you call on 8826545599',
  'We can have a call on Monday 25/11/24 at 11.30am. We will discuss internally and revert.',
  'This sounds useful // Friday next week is relatively free OK',
];

const TRANSCRIPT = SAMPLE_THREADS.join('\n---\n');

describe('buildOutreachSalesChatDraftPrompt', () => {
  const prompt = buildOutreachSalesChatDraftPrompt({
    name: 'Naresh',
    title: 'Founder',
    transcript: TRANSCRIPT,
    slots: '2024-11-25T15:00:00.000Z, 2024-11-30T11:00:00.000Z',
    conversationStage: 'FOLLOW_UP_MEETING',
    replyChannel: 'WHATSAPP',
    confirmedStartsAt: '2024-11-25T15:00:00.000Z',
    referralName: 'Anil',
    prospectEmail: 'gaurav.zatakia@flomattress.com',
  });

  it('should fold sales closer rules without recruiting tools', () => {
    expect(prompt).toContain('book a 20–30 minute intro, not recruit');
    expect(prompt).toContain('Do not share a job description');
    expect(prompt).toContain('Do not ask CTC, notice period');
    expect(prompt).not.toContain('share_jd');
    expect(prompt).not.toContain('update_answer');
    expect(prompt).not.toContain('share_interview_link');
    expect(prompt).not.toContain('schedule_meeting');
  });

  it('should ask for copy only and never for times, channel, or contacts', () => {
    expect(prompt).toContain('"message"');
    expect(prompt).toContain('"emailSubject"');
    expect(prompt).toContain('"emailBody"');
    expect(prompt).toContain('"referralMessage"');
    expect(prompt).not.toContain('"startsAt"');
    expect(prompt).not.toContain('"endsAt"');
    expect(prompt).not.toContain('"replyChannel"');
    expect(prompt).not.toContain('"referralEmail"');
    expect(prompt).toContain('do not extract contacts');
    expect(prompt).toContain(OUTREACH_DONT_RESPOND_SENTINEL);
  });

  it('should inject the validated facts it must write around', () => {
    expect(prompt).toContain('Reply channel: WHATSAPP');
    expect(prompt).toContain(
      'Confirmed meeting time: 2024-11-25T15:00:00.000Z',
    );
    expect(prompt).toContain('Referred person: Anil');
    expect(prompt).toContain(
      'Prospect email for details: gaurav.zatakia@flomattress.com',
    );
  });

  it('should mark unset facts as absent rather than leaving them blank', () => {
    const bare = buildOutreachSalesChatDraftPrompt({
      name: 'Naresh',
      title: 'Founder',
      transcript: TRANSCRIPT,
      slots: '',
      conversationStage: 'INTENT',
    });

    expect(bare).toContain('Reply channel: LINKEDIN');
    expect(bare).toContain('Confirmed meeting time: (none)');
    expect(bare).toContain('Referred person: (none)');
    expect(bare).toContain('Asked to stop: false');
  });

  it('should hand the opt-out decision to the validated flag', () => {
    const optedOut = buildOutreachSalesChatDraftPrompt({
      name: 'Naresh',
      title: 'Founder',
      transcript: TRANSCRIPT,
      slots: '',
      conversationStage: 'NOT_INTERESTED',
      shouldNotRespond: 'true',
    });

    expect(optedOut).toContain('Asked to stop: true');
    expect(optedOut).toContain(
      `If "Asked to stop" below is true, set message to "${OUTREACH_DONT_RESPOND_SENTINEL}"`,
    );
  });

  it('should inject the full multi-round transcript and conversation stage', () => {
    expect(prompt).toContain('Read the full thread, not only the last line');
    expect(prompt).toContain('Conversation stage: FOLLOW_UP_MEETING');
    expect(prompt).toContain('Lets do Sat 11 am');
    expect(prompt).toContain('gaurav.zatakia@flomattress.com');
    expect(prompt).toContain('discuss internally and revert');
    expect(prompt).toContain('8826545599');
  });

  it('should tell the model to pause or ack instead of pitching closed threads', () => {
    expect(prompt).toContain('discuss internally / revert');
    expect(prompt).toContain('thank them, confirm you will pause');
  });
});

describe('buildOutreachInboundSignalExtractionPrompt', () => {
  const prompt = buildOutreachInboundSignalExtractionPrompt({
    transcript: TRANSCRIPT,
    slots:
      '[{"startsAt":"2024-11-25T15:00:00.000Z","endsAt":"2024-11-25T15:30:00.000Z"}]',
    lastChannel: 'WHATSAPP',
  });

  // The injected slots legitimately contain startsAt, so the ban on free-text
  // times only applies to what the model is asked to return.
  const returnContract = prompt.slice(prompt.indexOf('Return JSON only:'));

  it('should ask for a slot index rather than a free-text time', () => {
    expect(returnContract).toContain('"acceptedSlotIndex"');
    expect(prompt).toContain('0-based index into Available slots');
    expect(returnContract).toContain('-1 when none');
    expect(returnContract).not.toContain('startsAt');
    expect(returnContract).not.toContain('endsAt');
  });

  it('should refuse to infer contacts or times', () => {
    expect(prompt).toContain('Copy only what is literally in the transcript');
    expect(prompt).toContain('Never infer a time or a contact detail');
    expect(prompt).toContain('character for character');
  });

  it('should not draft anything', () => {
    expect(returnContract).not.toContain('"message"');
    expect(prompt).toContain('You do not write a message');
  });

  it('should inject the thread, the slots, and the last inbound channel', () => {
    expect(prompt).toContain('Last inbound channel: WHATSAPP');
    expect(prompt).toContain('2024-11-25T15:00:00.000Z');
    expect(prompt).toContain('Interested, can you call on 8826545599');
  });

  it('should default the channel switch to NONE', () => {
    expect(prompt).toContain('"requestedChannelSwitch"');
    expect(prompt).toContain('NONE unless they explicitly asked to move');
  });
});
