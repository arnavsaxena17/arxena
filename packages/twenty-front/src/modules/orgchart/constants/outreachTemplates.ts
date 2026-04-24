export type OutreachChannelKey =
  | 'linkedin_invite'
  | 'whatsapp'
  | 'google_contact'
  | 'email';

export type OutreachTemplate = {
  id: string;
  label: string;
  body: string;
};

export const OUTREACH_TEMPLATES: Record<OutreachChannelKey, OutreachTemplate[]> = {
  linkedin_invite: [
    {
      id: 'li_short',
      label: 'Short intro',
      body: "Hi — I'd love to connect regarding a role that may be a great fit.",
    },
    {
      id: 'li_recruiter',
      label: 'Recruiter',
      body:
        "Hi, I'm reaching out about an opportunity I thought you'd want to hear about.",
    },
  ],
  whatsapp: [
    {
      id: 'wa_hello',
      label: 'Hello',
      body: 'Hi — I wanted to reach out about a role we are hiring for.',
    },
  ],
  google_contact: [
    {
      id: 'gc_empty',
      label: 'No note',
      body: '',
    },
  ],
  email: [
    {
      id: 'em_intro',
      label: 'Introduction',
      body: 'Hi,\n\nI came across your profile and wanted to reach out about an opportunity.\n\nBest,',
    },
  ],
};

export const outreachModalTitle = (channel: OutreachChannelKey): string => {
  switch (channel) {
    case 'linkedin_invite':
      return 'LinkedIn connection request';
    case 'whatsapp':
      return 'Send WhatsApp message';
    case 'google_contact':
      return 'Add to Google Contacts';
    case 'email':
      return 'Send email';
    default:
      return 'Outreach';
  }
};
