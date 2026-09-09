import {
  OUTREACH_DONT_RESPOND_SENTINEL,
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

describe('buildOutreachSalesChatDraftPrompt', () => {
  const prompt = buildOutreachSalesChatDraftPrompt({
    name: 'Naresh',
    title: 'Founder',
    transcript: SAMPLE_THREADS.join('\n---\n'),
    slots: '2024-11-25T15:00:00.000Z, 2024-11-30T11:00:00.000Z',
    conversationStage: 'FOLLOW_UP_MEETING',
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

  it('should require JSON times only when a slot is agreed', () => {
    expect(prompt).toContain('"startsAt"');
    expect(prompt).toContain('"endsAt"');
    expect(prompt).toContain('Fill startsAt/endsAt');
    expect(prompt).toContain('leave times empty');
    expect(prompt).toContain('Never invent times');
    expect(prompt).toContain(OUTREACH_DONT_RESPOND_SENTINEL);
  });

  it('should inject the full multi-round transcript and conversation stage', () => {
    expect(prompt).toContain('Read the full thread, not only the last line');
    expect(prompt).toContain('Conversation stage: FOLLOW_UP_MEETING');
    expect(prompt).toContain('Lets do Sat 11 am');
    expect(prompt).toContain('gaurav.zatakia@flomattress.com');
    expect(prompt).toContain('discuss internally and revert');
    expect(prompt).toContain('8826545599');
  });

  it('should answer on the last inbound channel', () => {
    expect(prompt).toContain('Last inbound channel: LINKEDIN');
    expect(prompt).toContain('"replyChannel"');
    expect(prompt).toContain('LINKEDIN, WHATSAPP, or EMAIL');
  });

  it('should tell the model to pause or ack instead of pitching closed threads', () => {
    expect(prompt).toContain('discuss internally / revert');
    expect(prompt).toContain('thank them, confirm you will pause');
  });
});
