export type ChatMessage =
  | { sender: 'bot' | 'user'; text: string; time: string }
  | {
      sender: 'bot' | 'user';
      attachment: { type: 'document'; filename: string; size?: string };
      time: string;
    };

export const SAMPLE_CHAT: ChatMessage[] = [
  {
    sender: 'bot',
    text: "Hey Manu, I'm Arnav, Director at Arxena Inc, A Global Recruitment Firm. I'm hiring for a Head of Corporate Strategy and Planning role for Global leader in electrical insulators, based out of Mumbai, Maharashtra and got your application on my job posting. I believe this might be a good fit. Wanted to speak to you in regards your interests in our new role. Would you be available for a short call sometime today?",
    time: '20:19',
  },
  {
    sender: 'user',
    text: 'Hi Arnav, I just got time to check your message. Can we connect tomorrow with a fresh start.',
    time: '21:11',
  },
  // {
  //     sender: 'bot',
  //     text: 'Sure, we can connect tomorrow. Please let me know your available time slots for the call.',
  //     time: '21:20',
  // },
  {
    sender: 'bot',
    attachment: {
      type: 'document',
      filename: 'JD_Head_of_Corporate_Strategy.pdf',
      size: '312 KB',
    },
    time: '20:20',
  },
  {
    sender: 'bot',
    text: 'I have shared the job description with you. Let me know if this role interests you.',
    time: '21:20',
  },
  {
    sender: 'user',
    text: "Hi, good morning we can connect at 11:00 am, hope it's ok with you",
    time: '09:52',
  },
  {
    sender: 'user',
    text: 'If my phone not connecting, you can call me on WhatsApp as well',
    time: '09:53',
  },
  {
    sender: 'bot',
    text: 'I will get back to you shortly to confirm the timing.',
    time: '10:04',
  },
  {
    sender: 'bot',
    text: 'Can you please share a copy of your updated CV',
    time: '10:15',
  },
  {
    sender: 'bot',
    text: 'Also, could you please provide the following details: \n 1. What is your current and expected CTC? \n2. Who do you report to, and which functions report to you? 3. What is your notice period?',
    time: '10:16',
  },
  {
    sender: 'user',
    text: 'I report to JMD, and sales and service function report to me, notice period is one month',
    time: '10:43',
  },
  {
    sender: 'user',
    attachment: {
      type: 'document',
      filename: 'Manu_Resume.pdf',
      size: '245 KB',
    },
    time: '10:45',
  },
  {
    sender: 'bot',
    text: 'Great. Could you also let me know your current and expected CTC?',
    time: '10:52',
  },
  {
    sender: 'user',
    text: 'Current is around 62 L. expectations: We can negotiate on this based on the budget of the organisation.',
    time: '11:11',
  },
  {
    sender: 'bot',
    text: 'Please provide a more specific expected CTC so we can better assess fitment for the role.',
    time: '11:20',
  },
  {
    sender: 'user',
    text: '75 lacs',
    time: '11:35',
  },
  {
    sender: 'bot',
    text: 'Sure, let me get back to you.',
    time: '12:39',
  },
];
