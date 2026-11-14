// Project persona guidance (outreachConfig.personaGuidance) is free text the
// client writes in Setup. It is wrapped in markers so the post-resolve rewrite
// can (1) turn an empty chip, which resolves to "undefined", into (none) and
// (2) keep the labeled-section formatters from rewriting client text that
// happens to contain "prospect: " or "calendar: ".

export const OUTREACH_PERSONA_GUIDANCE_START =
  '<<<OUTREACH_PERSONA_GUIDANCE>>>';
export const OUTREACH_PERSONA_GUIDANCE_END =
  '<<<END_OUTREACH_PERSONA_GUIDANCE>>>';

const OUTREACH_PERSONA_GUIDANCE_SLOT = (index: number) =>
  `<<<OUTREACH_PERSONA_GUIDANCE_SLOT_${index}>>>`;

const UNRESOLVED_CHIP_PATTERN = /\{\{[^{}]+\}\}/;

const normalizeOutreachPersonaGuidance = (raw: string): string => {
  const trimmed = raw.trim();

  if (
    trimmed === '' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    UNRESOLVED_CHIP_PATTERN.test(trimmed)
  ) {
    return '(none)';
  }

  return trimmed;
};

export const formatOutreachPersonaGuidanceForPrompt = (
  personaGuidance?: string,
): string => {
  const trimmed = personaGuidance?.trim() ?? '';

  if (trimmed === '') {
    return '(none)';
  }

  return `${OUTREACH_PERSONA_GUIDANCE_START}${trimmed}${OUTREACH_PERSONA_GUIDANCE_END}`;
};

// Swaps each marked block for a slot, runs `rewrite`, then puts the normalized
// guidance back.
export const rewriteAroundOutreachPersonaGuidance = (
  prompt: string,
  rewrite: (shieldedPrompt: string) => string,
): string => {
  const guidanceBlocks: string[] = [];
  let shielded = prompt;
  let startIndex = shielded.indexOf(OUTREACH_PERSONA_GUIDANCE_START);

  while (startIndex >= 0) {
    const valueStart = startIndex + OUTREACH_PERSONA_GUIDANCE_START.length;
    const endIndex = shielded.indexOf(
      OUTREACH_PERSONA_GUIDANCE_END,
      valueStart,
    );

    if (endIndex < 0) {
      break;
    }

    const slot = OUTREACH_PERSONA_GUIDANCE_SLOT(guidanceBlocks.length);

    guidanceBlocks.push(
      normalizeOutreachPersonaGuidance(shielded.slice(valueStart, endIndex)),
    );
    shielded =
      shielded.slice(0, startIndex) +
      slot +
      shielded.slice(endIndex + OUTREACH_PERSONA_GUIDANCE_END.length);
    startIndex = shielded.indexOf(
      OUTREACH_PERSONA_GUIDANCE_START,
      startIndex + slot.length,
    );
  }

  return guidanceBlocks.reduce(
    (result, guidance, index) =>
      result.replace(OUTREACH_PERSONA_GUIDANCE_SLOT(index), () => guidance),
    rewrite(shielded),
  );
};
