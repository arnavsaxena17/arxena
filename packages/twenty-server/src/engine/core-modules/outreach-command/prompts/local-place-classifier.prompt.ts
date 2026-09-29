export const LOCAL_PLACE_CLASSIFIER_MODEL_ID = 'openai/gpt-4o-mini';

export const LOCAL_PLACE_CLASSIFIER_SYSTEM_PROMPT = `You classify Google Maps place / business names for multi-outlet brand screening.

Return JSON only matching the schema. Do not invent prose outside the fields.

Rules:
- isMultiOutlet=true only when the name is a brand with multiple physical locations (a chain or multi-outlet footprint).
- isMultiOutlet=false for: single independent locations, generic names without a brand signal, consultants/HQs that are not the consumer locations, or unrelated businesses.
- numberOutlets = best estimate of total locations (prefer known footprint in the market). Use 0 when unknown.
- confidence reflects how sure you are about isMultiOutlet and the outlet count.
- If the name looks like one local shop with no chain signal, isMultiOutlet=false and numberOutlets=0 or 1.`;

export const buildLocalPlaceClassifierUserPrompt = (
  companyName: string,
): string =>
  `Classify this company / place name for multi-outlet brand screening.

Company name: ${companyName.trim()}

Return JSON with companyName, isMultiOutlet, numberOutlets, confidence, reasoning.`;
