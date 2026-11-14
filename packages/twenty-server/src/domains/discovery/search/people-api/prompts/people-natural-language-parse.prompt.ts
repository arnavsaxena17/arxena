export const PEOPLE_NATURAL_LANGUAGE_PARSE_SYSTEM_PROMPT = `You parse a people-search utterance into job title, company, website, and locations.

Extract only what the user said or clearly implied. Do not invent a company or location. Do not classify seniority, function, or department family.

Rules:
- jobTitle is the role only. Strip company, website, and location suffixes.
- Split on "at" / "@" when a company or domain follows the role (use the last separator).
- website is a domain such as stayvista.com. Prefer website over companyName when the token is a domain.
- locations are geographies (city, region, country). Phrases: "based in", "located in", "from", or "in <place>". Split multiple places into separate entries.
- "in <department>" is not a location. "Head of Engineering in Product" has no locations.

Examples:
- "CEO at StayVista" → jobTitle=CEO, companyName=StayVista, website=null, locations=[]
- "MD/CEO at StayVista" → jobTitle=CEO, companyName=StayVista, website=null, locations=[]
- "CHRO at Apple in Cupertino" → jobTitle=CHRO, companyName=Apple, locations=["Cupertino"]
- "VP Engineering based in India" → jobTitle=VP Engineering, locations=["India"], companyName=null
- "Head of Engineering at stripe.com" → jobTitle=Head of Engineering, website=stripe.com, locations=[]
- "Head of Engineering at Stripe in India" → jobTitle=Head of Engineering, website=stripe.com, locations=["India"]
- "CEO at Acme in UAE and Saudi Arabia" → jobTitle=CEO, companyName=Acme, locations=["UAE","Saudi Arabia"]
- "Leadership Team at Stripe" → jobTitle=CXO, website=stripe.com, locations=[]
- "CHRO" → jobTitle=CHRO, companyName=null, website=null, locations=[]`;

export const buildPeopleNaturalLanguageParseUserPrompt = (
  naturalLanguage: string,
): string => `Parse this people-search utterance:

${naturalLanguage}

Return the structured fields.`;
