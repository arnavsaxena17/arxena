import {
  foldUnipileChatMessagesToTranscript,
  truncateTranscriptAfterLastInbound,
  truncateTranscriptAfterOurReply,
  type UnipileChatMessageLike,
} from 'src/engine/core-modules/outreach-command/prompts/fixtures/fold-unipile-chat-messages.util';

const foldThrough = (messages: UnipileChatMessageLike[], throughIndex: number) =>
  foldUnipileChatMessagesToTranscript(messages.slice(0, throughIndex + 1));

// Curated from naresh-positive-sn-chats.json — contact literals kept for grounding tests.
const KUNAL_MESSAGES: UnipileChatMessageLike[] = [
  {
    is_sender: 1,
    timestamp: '2024-09-25T05:33:00.000Z',
    text: 'Hi Kunal, I’d like to show you a quick demo of our management reporting platform over a 30 min call if possible.',
  },
  {
    is_sender: 0,
    timestamp: '2024-09-25T23:57:00.000Z',
    text: 'Hi Naresh\nCan I know what this would be about ? Are you consulting or offering  software ?',
  },
  {
    is_sender: 1,
    timestamp: '2024-09-26T12:06:00.000Z',
    text: "Hi Kunal, thanks for getting back. It's a SaaS software platform.",
  },
  {
    is_sender: 0,
    timestamp: '2024-09-26T12:16:00.000Z',
    text: 'Pl send me mail on kunal@matrixlifescience.com',
  },
  {
    is_sender: 1,
    timestamp: '2025-01-31T05:42:00.000Z',
    text: 'I was wondering if you’d be open to a quick chat sometime to discuss this?',
  },
  {
    is_sender: 0,
    timestamp: '2025-01-31T07:59:00.000Z',
    text: 'Hi\nWe are currently caught up with lot of projects. Lets re visit sometime in June.',
  },
];

const ASHLYN_MESSAGES: UnipileChatMessageLike[] = [
  {
    is_sender: 1,
    timestamp: '2024-09-25T05:35:00.000Z',
    text: 'Hi Ashlyn, I’d like to show you a quick demo over a 30 min call if possible.',
  },
  {
    is_sender: 0,
    timestamp: '2024-09-29T10:32:00.000Z',
    text: 'Hi Naresh will forward to the CFO',
  },
  {
    is_sender: 1,
    timestamp: '2024-10-01T07:35:00.000Z',
    text: 'Thanks Ashlyn. Appreciate it. If you could share his/her email address, happy to send an introductory note about our platform.',
  },
  {
    is_sender: 0,
    timestamp: '2024-10-03T11:20:00.000Z',
    text: 'Jitendar Singh +91 8139-898930 cfo@redlandsmotors.com',
  },
];

const RAJESH_MESSAGES: UnipileChatMessageLike[] = [
  {
    is_sender: 1,
    timestamp: '2024-10-08T11:30:00.000Z',
    text: 'Hi Rajesh, I’d like to show you a quick demo over a 30 min call if possible.',
  },
  {
    is_sender: 0,
    timestamp: '2024-10-08T11:31:00.000Z',
    text: 'Please connect prassann Daphal our ceo',
  },
];

const SUNIL_MESSAGES: UnipileChatMessageLike[] = [
  {
    is_sender: 1,
    timestamp: '2024-11-06T08:12:00.000Z',
    text: 'Hi Sunil. I was wondering if you might be able to spare 30-mins for a short call sometime?',
  },
  {
    is_sender: 0,
    timestamp: '2024-11-07T07:36:00.000Z',
    text: 'Hello Naresh\n\nCan we have call tomorrow at around 2.30 PM',
  },
  {
    is_sender: 1,
    timestamp: '2024-11-07T07:47:00.000Z',
    text: 'Sure. Can i send meeting invite on your email id in linkedin ie sunil@naturalcapsules.com',
  },
  {
    is_sender: 1,
    timestamp: '2024-11-08T09:00:00.000Z',
    text: 'https://teams.microsoft.com/l/meetup-join/demo',
  },
  {
    is_sender: 1,
    timestamp: '2024-11-20T03:21:00.000Z',
    text: 'Hi Sunilji. Just checking on way forward. Can we move to next steps of implementation?',
  },
];

const SANIL_MESSAGES: UnipileChatMessageLike[] = [
  {
    is_sender: 1,
    timestamp: '2024-11-07T00:00:00.000Z',
    text: 'Hi Sanil, I’d like to show you a quick demo over a 30 min call if possible.',
  },
  {
    is_sender: 0,
    timestamp: '2024-11-09T00:00:00.000Z',
    text: "Hi Naresh, Thanks for reaching out. I'd like to learn more.",
  },
  {
    is_sender: 0,
    timestamp: '2024-11-09T00:01:00.000Z',
    text: 'We can discuss for this matters my Contact no is 9376828884 at 2:30 pm tomorrow it convenient for u.',
  },
];

const PULKIT_MESSAGES: UnipileChatMessageLike[] = [
  {
    is_sender: 1,
    timestamp: '2024-11-11T00:00:00.000Z',
    text: 'Hello Pulkit, Would love to catch up and tell you more.',
  },
  {
    is_sender: 0,
    timestamp: '2024-11-11T01:00:00.000Z',
    text: 'Hello Naresh Ji, Can we do a demo tomorrow? Second half?',
  },
  {
    is_sender: 1,
    timestamp: '2024-11-11T01:10:00.000Z',
    text: 'Sure. Let me know if 2:30 pm tomorrow is suitable for you?',
  },
  {
    is_sender: 0,
    timestamp: '2024-11-11T01:20:00.000Z',
    text: 'Can we do 3:30?',
  },
  {
    is_sender: 1,
    timestamp: '2024-11-22T00:00:00.000Z',
    text: 'Hi Pulkit i am sure you must be busy.  Please revert on way forward.',
  },
];

const GAURAV_MESSAGES: UnipileChatMessageLike[] = [
  {
    is_sender: 1,
    timestamp: '2024-11-18T00:00:00.000Z',
    text: 'Hi Gaurav, I’d like to show you a quick demo over a 30 min call if possible.',
  },
  {
    is_sender: 0,
    timestamp: '2024-11-19T00:00:00.000Z',
    text: 'Please email me at gaurav.zatakia@flomattress.com',
  },
];

const KAMALLATH_MESSAGES: UnipileChatMessageLike[] = [
  {
    is_sender: 1,
    timestamp: '2025-01-16T00:00:00.000Z',
    text: 'Hi Kamal, Did you get a chance to see my previous messages?',
  },
  {
    is_sender: 0,
    timestamp: '2025-01-17T00:00:00.000Z',
    text: 'Hi Naresh\nThanks for your messages - lets plan a time to discuss this virtually. My email is kamallath@gmail.com and phone is 9311097166. Kindly drop me a WhatsApp message',
  },
];

const YOGESH_MESSAGES: UnipileChatMessageLike[] = [
  {
    is_sender: 1,
    timestamp: '2024-10-27T00:00:00.000Z',
    text: 'Hi Yogesh, I got your reference from Mr. Sandesh Bhagwat. Look forward to connecting with you here.',
  },
  {
    is_sender: 0,
    timestamp: '2024-11-20T00:00:00.000Z',
    text: 'Sure',
  },
  {
    is_sender: 0,
    timestamp: '2024-11-20T00:01:00.000Z',
    text: 'Please connect on Yogesh.shinde@kshinternational.com',
  },
  {
    is_sender: 1,
    timestamp: '2024-11-20T00:02:00.000Z',
    text: 'Ok Satyam from my team will connect with you for demo',
  },
];

const NEGATIVE_SILENCE_MESSAGES: UnipileChatMessageLike[] = [
  {
    is_sender: 1,
    timestamp: '2024-10-01T00:00:00.000Z',
    text: 'Hi, I’d like to show you a quick demo over a 30 min call if possible.',
  },
  {
    is_sender: 1,
    timestamp: '2024-10-08T00:00:00.000Z',
    text: 'Hello, circling back with a short note on IMAGE-I if useful.',
  },
];

export const OUTREACH_AI_LEGACY_SAMPLE_THREADS = [
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
] as const;

export const OUTREACH_AI_LEGACY_SAMPLE_TRANSCRIPT =
  OUTREACH_AI_LEGACY_SAMPLE_THREADS.join('\n---\n');

export const OUTREACH_AI_TRANSCRIPTS = {
  kunalIntentClarify: {
    sourcePublicIdentifier: 'kunal-sikchi-5632b215',
    transcript: truncateTranscriptAfterLastInbound(foldThrough(KUNAL_MESSAGES, 1)),
  },
  kunalEmailAsk: {
    sourcePublicIdentifier: 'kunal-sikchi-5632b215',
    transcript: truncateTranscriptAfterLastInbound(foldThrough(KUNAL_MESSAGES, 3)),
  },
  kunalSnoozeJune: {
    sourcePublicIdentifier: 'kunal-sikchi-5632b215',
    // Only the snooze exchange — earlier email ask would otherwise dominate extract.
    transcript: truncateTranscriptAfterLastInbound(
      foldUnipileChatMessagesToTranscript(KUNAL_MESSAGES.slice(4)),
    ),
  },
  ashlynReferralWithContact: {
    sourcePublicIdentifier: 'ashlyn-antony-245166b',
    transcript: truncateTranscriptAfterLastInbound(foldThrough(ASHLYN_MESSAGES, 3)),
  },
  rajeshReferralNoContact: {
    sourcePublicIdentifier: 'rajesh-gupta-recyclekaro',
    transcript: truncateTranscriptAfterLastInbound(foldThrough(RAJESH_MESSAGES, 1)),
  },
  sunilBookSlot: {
    sourcePublicIdentifier: 'sunil-mundra-25672219',
    transcript: truncateTranscriptAfterLastInbound(foldThrough(SUNIL_MESSAGES, 1)),
  },
  sunilPostMeetingChase: {
    sourcePublicIdentifier: 'sunil-mundra-25672219',
    transcript: truncateTranscriptAfterOurReply(
      foldUnipileChatMessagesToTranscript(SUNIL_MESSAGES),
    ),
  },
  sanilPhoneAndRelativeTime: {
    sourcePublicIdentifier: 'sanil-suthar-01443b60',
    transcript: truncateTranscriptAfterLastInbound(
      foldUnipileChatMessagesToTranscript(SANIL_MESSAGES),
    ),
  },
  explicitSlotAccept: {
    sourcePublicIdentifier: undefined,
    transcript: [
      'us: Would either of these work for a 30-min walkthrough: (0) Sun 10 Nov 2:30pm IST or (1) Mon 11 Nov 2:30pm IST?',
      'them: The first one works — please send the invite for slot 0.',
    ].join('\n---\n'),
  },
  pulkitVagueTime: {
    sourcePublicIdentifier: 'pulkitlive',
    transcript: truncateTranscriptAfterLastInbound(foldThrough(PULKIT_MESSAGES, 1)),
  },
  pulkitSilentAfterReply: {
    sourcePublicIdentifier: 'pulkitlive',
    transcript: truncateTranscriptAfterOurReply(
      foldUnipileChatMessagesToTranscript(PULKIT_MESSAGES),
    ),
  },
  gauravEmail: {
    sourcePublicIdentifier: 'gaurav-zatakia-19676a9a',
    transcript: truncateTranscriptAfterLastInbound(
      foldUnipileChatMessagesToTranscript(GAURAV_MESSAGES),
    ),
  },
  kamallathWhatsapp: {
    sourcePublicIdentifier: 'kamallath',
    transcript: truncateTranscriptAfterLastInbound(
      foldUnipileChatMessagesToTranscript(KAMALLATH_MESSAGES),
    ),
  },
  yogeshReferralEmail: {
    sourcePublicIdentifier: 'yogesh-shinde-65337bb1',
    transcript: truncateTranscriptAfterOurReply(
      foldUnipileChatMessagesToTranscript(YOGESH_MESSAGES),
    ),
  },
  negativeSilence: {
    sourcePublicIdentifier: 'prasanna-shetty-a27042106',
    transcript: foldUnipileChatMessagesToTranscript(NEGATIVE_SILENCE_MESSAGES),
  },
  syntheticOptOut: {
    sourcePublicIdentifier: undefined,
    transcript: [
      'us: Hi, would a short IMAGE-I walkthrough help this week?',
      'them: Please stop messaging me and unsubscribe from further outreach.',
    ].join('\n---\n'),
  },
} as const;
