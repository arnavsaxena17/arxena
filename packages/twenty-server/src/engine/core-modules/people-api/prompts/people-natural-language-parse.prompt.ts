export const PEOPLE_NATURAL_LANGUAGE_PARSE_SYSTEM_PROMPT = `You parse a people-search utterance into job title, company, website, and location.

Extract only what the user said or clearly implied. Do not invent a company or location. Do not classify seniority, function, or department family.

Rules:
- jobTitle is the role only. Strip company, website, and location suffixes.
- Split on "at" / "@" when a company or domain follows the role (use the last separator).
- website is a domain such as stayvista.com. Prefer website over companyName when the token is a domain.
- location is a geography (city, region, country). Phrases: "based in", "located in", "from", or "in <place>".
- "in <department>" is not a location. "Head of Engineering in Product" has no location.

Examples:
- "CEO at StayVista" → jobTitle=CEO, companyName=StayVista, website=null, location=null
 - MD/CEO at StayVista → jobTitle=CEO, companyName=StayVista, website=null, location=null
- "CHRO at Apple in Cupertino" → jobTitle=CHRO, companyName=Apple, location=Cupertino
- "VP Engineering based in India" → jobTitle=VP Engineering, location=India, companyName=null
- "Head of Engineering at stripe.com" → jobTitle=Head of Engineering, website=stripe.com
- "Head of Engineering at Stripe in India" → jobTitle=Head of Engineering, website=stripe.com, location=India
- "Leadership Team at Stripe" → jobTitle=CXO, website=stripe.com, location=null
- "CHRO" → jobTitle=CHRO, companyName=null, website=null, location=null`;

export const buildPeopleNaturalLanguageParseUserPrompt = (
  naturalLanguage: string,
): string => `Parse this people-search utterance:

${naturalLanguage}

Return the structured fields.`;
