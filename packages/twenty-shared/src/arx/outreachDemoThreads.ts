export type OutreachDemoMessageRole = 'us' | 'them';

export type OutreachDemoMessage = {
  role: OutreachDemoMessageRole;
  text: string;
  timestamp?: string;
};

// Curated from naresh-positive-sn-chats.json — contact literals kept for grounding tests.
export const OUTREACH_DEMO_KUNAL_SALES_THREAD: OutreachDemoMessage[] = [
  {
    role: 'us',
    text: 'Hi Kunal, I’d like to show you a quick demo of our management reporting platform over a 30 min call if possible.',
    timestamp: '2024-09-25T05:33:00.000Z',
  },
  {
    role: 'them',
    text: 'Hi Naresh\nCan I know what this would be about ? Are you consulting or offering  software ?',
    timestamp: '2024-09-25T23:57:00.000Z',
  },
  {
    role: 'us',
    text: "Hi Kunal, thanks for getting back. It's a SaaS software platform.",
    timestamp: '2024-09-26T12:06:00.000Z',
  },
  {
    role: 'them',
    text: 'Pl send me mail on kunal@matrixlifescience.com',
    timestamp: '2024-09-26T12:16:00.000Z',
  },
  {
    role: 'us',
    text: 'I was wondering if you’d be open to a quick chat sometime to discuss this?',
    timestamp: '2025-01-31T05:42:00.000Z',
  },
  {
    role: 'them',
    text: 'Hi\nWe are currently caught up with lot of projects. Lets re visit sometime in June.',
    timestamp: '2025-01-31T07:59:00.000Z',
  },
];

// Marketing /engage recruiting sequencer demo (Arnav / Arxena).
export const OUTREACH_DEMO_MANU_RECRUITING_THREAD: OutreachDemoMessage[] = [
  {
    role: 'us',
    text: "Hey Manu, I'm Arnav at Arxena. I'm hiring for a VP of Enterprise Sales role for a global industrial manufacturer in Mumbai — your profile looked like a strong fit. Open to a short call today?",
    timestamp: '2024-11-12T14:49:00.000Z',
  },
  {
    role: 'them',
    text: 'Hi Arnav, just saw this. Can we connect tomorrow with a fresh start?',
    timestamp: '2024-11-12T15:41:00.000Z',
  },
  {
    role: 'us',
    text: 'Absolutely. I can share the JD — let me know if the role interests you.',
    timestamp: '2024-11-12T15:50:00.000Z',
  },
  {
    role: 'them',
    text: "Good morning — 11:00 am works. If my phone doesn't connect, WhatsApp is fine too.",
    timestamp: '2024-11-13T04:22:00.000Z',
  },
  {
    role: 'us',
    text: 'Confirmed for 11:00. Could you also share current / expected CTC and notice period?',
    timestamp: '2024-11-13T04:46:00.000Z',
  },
  {
    role: 'them',
    text: 'I report to JMD; sales and service report to me. Notice is one month. Current ~62L — expectations flexible around budget.',
    timestamp: '2024-11-13T05:13:00.000Z',
  },
];
