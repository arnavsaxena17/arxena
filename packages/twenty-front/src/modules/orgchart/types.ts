export type ContextResultItem = {
  id: string;
  fullName: string;
  headline: string;
  company: string;
  linkedinUrl?: string;
  email?: string;
  phone?: string;
  raw: Record<string, unknown>;
};
