// Context sections that can feed a sample first LinkedIn message. Shared by
// the AI-column engine (outreach-command) and the drafter (tool module).
export type OutreachSampleMessageInclude = {
  senderProfile?: boolean;
  prospectEnrichment?: boolean;
  profile?: boolean;
  posts?: boolean;
  chatHistory?: boolean;
  companyNews?: boolean;
};

export type OutreachSampleMessageProspect = {
  // Set for rows that are enrolled candidates; absent for Find-list rows.
  candidateId?: string;
  name: string;
  title?: string;
  companyName?: string;
  linkedinUrl?: string;
};

export type OutreachSampleMessageDraft = {
  message: string;
  warnings: string[];
};

export type OutreachSampleMessageDrafter = {
  draftForProspect(input: {
    workspaceId: string;
    prospect: OutreachSampleMessageProspect;
    include?: OutreachSampleMessageInclude;
  }): Promise<OutreachSampleMessageDraft>;
};

export const OUTREACH_SAMPLE_MESSAGE_DRAFTER =
  'OUTREACH_SAMPLE_MESSAGE_DRAFTER';
export const OUTREACH_SAMPLE_MESSAGE_COLUMN_KEY = 'sampleLinkedinMessage';
