// Words that mean the user is past finding and wants to act on the rows:
// save them to the CRM, enroll them, or send outreach
const OUTREACH_ACTION_PATTERN =
  /\b(outreach|enrol+(?:ed|ing|ment)?|sequenc\w*|connection requests?|connect with|invite|send|message (?:them|these|him|her)|dm|crm|save|start|launch|campaign workflow|workflow|candidates?)\b/i;

// The campaign page's rules for Save to CRM, start outreach and enrollment,
// plus the seeded workflow list, are about a thousand tokens a request. A find
// never uses them, so they are sent only when the user's message asks for one
// of those actions or rows are selected (the usual first step of acting).
export const shouldIncludeOutreachActionRules = ({
  lastUserText,
  selectedPersonIds,
  selectedCandidateIds,
}: {
  lastUserText: string;
  selectedPersonIds?: string[];
  selectedCandidateIds?: string[];
}): boolean =>
  OUTREACH_ACTION_PATTERN.test(lastUserText) ||
  (selectedPersonIds?.length ?? 0) > 0 ||
  (selectedCandidateIds?.length ?? 0) > 0;
