export const GTM_FILTER_PROFILES_SYSTEM_PROMPT = `You are screening one professional profile against a recruiter's filter criteria.

Decide whether this single candidate matches the criteria. Use the full profile JSON (title, experience, education, skills, location, company, etc.). Do not invent facts that are not in the profile. If the profile is too thin to judge, matches is false.

matches is true only when the profile clearly satisfies the criteria.
reason is a short explanation citing concrete evidence from the profile.

Return JSON matching the schema.`;

export const buildGtmFilterProfilesUserPrompt = (input: {
  criteria: string;
  profileJson: string;
}): string =>
  [
    'Does this candidate match the following criteria?',
    '',
    '## Criteria',
    input.criteria,
    '',
    '## Profile',
    input.profileJson,
    '',
    'Return a single JSON object with matches (boolean) and reason (string).',
  ].join('\n');
