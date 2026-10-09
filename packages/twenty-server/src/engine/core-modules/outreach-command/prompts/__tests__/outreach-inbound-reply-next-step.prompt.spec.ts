import {
  OUTREACH_DONT_RESPOND_SENTINEL,
  OUTREACH_HUMANIZER_DONT_RESPOND_RULE,
  OUTREACH_HUMANIZER_RULES,
  buildOutreachConnectionNotePrompt,
  buildOutreachFirstMessagePrompt,
  buildOutreachInboundSignalExtractionPrompt,
  buildOutreachLinkedinPostCommentPrompt,
  buildOutreachMeetingReminderPrompt,
  buildOutreachNoShowPingPrompt,
  buildOutreachPostReplyFollowUpPrompt,
  buildOutreachRescheduleOfferPrompt,
  buildOutreachSalesChatDraftPrompt,
} from 'src/engine/core-modules/outreach-command/prompts/outreach.prompts';
import { OUTREACH_AI_LEGACY_SAMPLE_TRANSCRIPT } from 'src/engine/core-modules/outreach-command/prompts/fixtures/transcripts/outreach-ai-naresh-transcripts';

const TRANSCRIPT = OUTREACH_AI_LEGACY_SAMPLE_TRANSCRIPT;

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

  it('should fold sales closer rules', () => {
    expect(prompt).toContain(
      'book a short intro using the sender meeting defaults',
    );
    expect(prompt).toContain('sales outreach conversation');
    expect(prompt).not.toContain('recruit');
    expect(prompt).not.toContain('job description');
    expect(prompt).not.toContain('CTC');
    expect(prompt).not.toContain('notice period');
  });

  it('should ask for copy only and never for times, channel, or contacts', () => {
    expect(prompt).toContain('"linkedinMessage"');
    expect(prompt).toContain('"emailSubject"');
    expect(prompt).toContain('"emailBody"');
    expect(prompt).toContain('"referralMessage"');
    expect(prompt).toContain('"whatsappMessage"');
    expect(prompt).toContain('"referralCandidateId"');
    expect(prompt).not.toContain('"startsAt"');
    expect(prompt).not.toContain('"endsAt"');
    expect(prompt).not.toContain('"replyChannel"');
    expect(prompt).not.toContain('"referralEmail"');
    expect(prompt).toContain('do not invent contacts or slots');
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
    expect(prompt).toContain('WhatsApp to: (none)');
    expect(prompt).toContain('Email to: (none)');
    expect(prompt).toContain('was already sent');
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
    expect(bare).toContain('Preferred channel to stamp: (none)');
    expect(bare).toContain('WhatsApp to: (none)');
    expect(bare).toContain('Email to: (none)');
    expect(bare).toContain('Asked to stop: false');
    expect(bare).toContain('prospect_profile: (none)');
    expect(bare).not.toContain('CANDIDATE TOOL CALLS');
  });

  it('should instruct candidate CRUD tool stamps when candidateId is set', () => {
    const withTools = buildOutreachSalesChatDraftPrompt({
      name: 'Naresh',
      title: 'Founder',
      transcript: TRANSCRIPT,
      slots: '',
      conversationStage: 'INTENT',
      candidateId: 'candidate-1',
      preferredChannelToStamp: 'EMAIL',
      prospectEmail: 'a@b.com',
    });

    expect(withTools).toContain('CANDIDATE TOOL CALLS');
    expect(withTools).toContain('update_one_person');
    expect(withTools).toContain('Candidate id: candidate-1');
    expect(withTools).toContain('Preferred channel to stamp: EMAIL');
    expect(withTools).toContain(
      'Do not set outreachSequenceStage or outreachConversationStage here.',
    );
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
      `If "Asked to stop" below is true, set linkedinMessage to "${OUTREACH_DONT_RESPOND_SENTINEL}"`,
    );
  });

  it('should format the prospect profile for light personalization', () => {
    const withProfile = buildOutreachSalesChatDraftPrompt({
      name: 'Mohammad',
      title: 'Director Of Operations',
      transcript: '',
      slots: '',
      conversationStage: 'NONE',
      prospectProfileText: '{"headline":"Director Of Operations"}',
    });

    expect(withProfile).toContain('prospect_profile: Director Of Operations');
    expect(withProfile).toContain(
      'Use PROSPECT_ENRICHMENT hooks, prospect_profile, and prospect_posts',
    );
  });

  it('should soft-ask until a window, then propose one concrete range from Available slots', () => {
    expect(prompt).toContain('Interested but no time named: soft ask only');
    expect(prompt).toContain('propose ONE concrete range built from the');
    expect(prompt).toContain('Available slots are the only source of times WE propose');
    expect(prompt).toContain('INTENT / ACKNOWLEDGEMENT: acknowledge');
    expect(prompt).toContain('No Available slots.');
    expect(prompt).toContain(
      'FOLLOW_UP_MEETING with no confirmed time: they named a window',
    );
    expect(prompt).toContain('sometime this week or next');
    expect(prompt).toContain('never restart with a');
    expect(prompt).toContain('T1-style observation pitch');
  });

  it('should honour a time the prospect named, even outside our slots', () => {
    expect(prompt).toContain('A time the PROSPECT named is different');
    expect(prompt).toContain('sending a calendar invite');
    expect(prompt).toContain('weekday, date and time');
  });

  it('should route follow-up-later, email, phone and referral replies', () => {
    expect(prompt).toContain('Follow up on:');
    expect(prompt).toContain('Attachment file:');
    expect(prompt).toContain('never call send_files');
    expect(prompt).toContain('ask for');
    expect(prompt).toContain("the colleague's email or phone");
  });

  it('should seed the local first LinkedIn message prompt', () => {
    const opener = buildOutreachFirstMessagePrompt({
      senderJson: '{{member.text}}',
      prospectEnrichmentJson: '{{find.first.outreachProspectEnrichment}}',
      prospectProfileText: '{{profile.text}}',
      prospectPostsText: '{{posts.text}}',
      chatHistory: '{{messages.text}}',
      kind: 'opener',
    });

    expect(opener).toContain(
      "The prospect has just accepted the senders' connection request with the text: {{messages.text}}",
    );
    expect(opener).toContain(
      'Happy to walk you through how this would look for you.',
    );
    expect(opener).toContain('I noticed in your post that');
    expect(opener).toContain(
      'Would you be open to a quick chat coming Thursday or Friday?',
    );
    expect(opener).toContain("sit inside the sender's current offer");
    expect(opener).toContain('Sender Profile:{{member.text}}');
    expect(opener).toContain(
      'Prospect: {{find.first.outreachProspectEnrichment}}',
    );
    expect(opener).toContain('Prospect Profile: {{profile.text}}');
    expect(opener).toContain('Prospect Posts: {{posts.text}}');
    expect(opener).toContain('Chat History: {{messages.text}}');
    expect(opener).toContain('Return JSON only: { "message": "<body>" }');
    expect(opener).not.toContain('curiosity question only');
    expect(opener).not.toContain('calendar (ignore — do not use)');
    expect(opener).not.toContain(OUTREACH_HUMANIZER_RULES);
  });

  it('should add company news to the opener only when it is passed', () => {
    const baseInput = {
      senderJson: '{}',
      prospectEnrichmentJson: '{}',
      kind: 'opener' as const,
    };
    const withoutNews = buildOutreachFirstMessagePrompt(baseInput);
    const withNews = buildOutreachFirstMessagePrompt({
      ...baseInput,
      companyNews: 'Acme raised a Series B',
    });

    expect(withoutNews).not.toContain('Company News');
    expect(withoutNews).toContain(
      'The message must contain "I noticed" and either "in your post" or "on your profile".',
    );
    expect(withNews).toContain('Company News: Acme raised a Series B');
    expect(withNews).toContain('"that {company}"');
  });

  it('should escalate cold cadence ask types without contradicting T1', () => {
    const fu1 = buildOutreachFirstMessagePrompt({
      senderJson: '{}',
      prospectEnrichmentJson: '{}',
      kind: 'fu1',
    });
    const fu2 = buildOutreachFirstMessagePrompt({
      senderJson: '{}',
      prospectEnrichmentJson: '{}',
      kind: 'fu2',
    });
    const fu3 = buildOutreachFirstMessagePrompt({
      senderJson: '{}',
      prospectEnrichmentJson: '{}',
      kind: 'fu3',
    });

    expect(fu1).toContain('interest CTA only');
    expect(fu1).not.toContain('sometime this week or next');
    expect(fu1).not.toContain(
      'Close with "Either way, happy to stay in touch here."',
    );

    expect(fu2).toContain('one primary meeting ask');
    expect(fu2).toContain('point me to whoever owns it');
    expect(fu2).not.toContain(
      'Close with "Either way, happy to stay in touch here."',
    );

    expect(fu3).toContain('zero asks');
    expect(fu3).toContain(
      'Close with "Either way, happy to stay in touch here."',
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
    expect(prompt).toContain('(0) Mon, Nov 25 · 8:30–9:00 PM IST');
    expect(prompt).toContain('Interested, can you call on 8826545599');
  });

  it('should default the channel switch to NONE', () => {
    expect(prompt).toContain('"requestedChannelSwitch"');
    expect(prompt).toContain('NONE unless they explicitly asked to receive');
    expect(prompt).toContain('"sendWhatsappReply"');
    expect(prompt).toContain('"prospectPhone"');
  });
});

describe('outreach humanizer rules', () => {
  it('should humanize the listed draft prompts', () => {
    const connectionNote = buildOutreachConnectionNotePrompt({
      senderJson: '{}',
      prospectEnrichmentJson: '{}',
    });
    const opener = buildOutreachFirstMessagePrompt({
      senderJson: '{}',
      prospectEnrichmentJson: '{}',
      kind: 'opener',
    });
    const followUp = buildOutreachFirstMessagePrompt({
      senderJson: '{}',
      prospectEnrichmentJson: '{}',
      kind: 'fu2',
    });
    const reminder = buildOutreachMeetingReminderPrompt({
      senderJson: '{}',
      name: 'Naresh',
    });
    const noShow = buildOutreachNoShowPingPrompt({
      senderJson: '{}',
      name: 'Naresh',
    });
    const reschedule = buildOutreachRescheduleOfferPrompt({
      senderJson: '{}',
      name: 'Naresh',
    });

    for (const prompt of [
      connectionNote,
      followUp,
      reminder,
      noShow,
      reschedule,
    ]) {
      expect(prompt).toContain(OUTREACH_HUMANIZER_RULES);
      expect(prompt).not.toContain(OUTREACH_HUMANIZER_DONT_RESPOND_RULE);
    }

    expect(connectionNote).toContain('Hard limit 280 characters.');
    expect(connectionNote).toContain('not X, but Y');
    expect(connectionNote.split('Em dashes').length - 1).toBe(1);
    expect(opener).toContain(
      'Would you be open to a quick chat coming Thursday or Friday?',
    );
    expect(opener).not.toContain(OUTREACH_HUMANIZER_RULES);
    expect(followUp).toContain('40–60 words');
  });

  it('should leave the do-not-respond sentinel unchanged on sales reply', () => {
    const prompt = buildOutreachSalesChatDraftPrompt({
      name: 'Naresh',
      title: 'Founder',
      transcript: TRANSCRIPT,
      slots: '',
      conversationStage: 'NOT_INTERESTED',
      shouldNotRespond: 'true',
    });

    expect(prompt).toContain(OUTREACH_HUMANIZER_RULES);
    expect(prompt).toContain(OUTREACH_HUMANIZER_DONT_RESPOND_RULE);
    expect(prompt).toContain(
      `If linkedinMessage is "${OUTREACH_DONT_RESPOND_SENTINEL}", return that exact string.`,
    );
    expect(prompt).toContain('message wording only');
    expect(prompt.split('Em dashes').length - 1).toBe(1);
  });

  it('should not humanize comments or post-reply follow-ups', () => {
    const comment = buildOutreachLinkedinPostCommentPrompt({
      senderJson: '{}',
      prospectEnrichmentJson: '{}',
      postText: 'We shipped a new plant.',
    });
    const postReply = buildOutreachPostReplyFollowUpPrompt({
      senderJson: '{}',
      prospectEnrichmentJson: '{}',
      kind: 'fu1',
    });

    expect(comment).not.toContain(OUTREACH_HUMANIZER_RULES);
    expect(postReply).not.toContain(OUTREACH_HUMANIZER_RULES);
  });
});
