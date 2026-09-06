import { isNonEmptyString } from '@sniptt/guards';

// Deterministic AI_AGENT results for local outreach path testing when
// IS_OUTREACH_MOCK_UNIPILE_ENABLED is on (same flag as mock LinkedIn send).

export const buildOutreachMockAiAgentResult = (
  userPrompt: string,
): Record<string, unknown> => {
  const prompt = userPrompt.toLowerCase();

  if (
    prompt.includes('subject') ||
    prompt.includes('fallback email') ||
    prompt.includes('draft a short icp-aligned email')
  ) {
    return {
      subject: 'Quick note after LinkedIn',
      message:
        'Hi — we reached out on LinkedIn and wanted to share a short note here as well. Open to a brief intro call this week?',
    };
  }

  if (
    prompt.includes('sales reply') ||
    prompt.includes('inbound') ||
    prompt.includes('transcript') ||
    prompt.includes('calendar')
  ) {
    return {
      message:
        'Thanks for the reply — happy to meet. I can do Tue 4pm or Wed 11am IST; does either work?',
      intent: 'times_proposed',
    };
  }

  if (prompt.includes('follow-up 3') || prompt.includes('breakup')) {
    return {
      message:
        'Closing the loop for now — happy to reconnect whenever timing is better. Wishing you a great quarter.',
    };
  }

  if (prompt.includes('follow-up 2')) {
    return {
      message:
        'Following up with one more useful angle for your team. Worth a 15-min chat?',
    };
  }

  if (prompt.includes('follow-up 1') || prompt.includes('follow-up')) {
    return {
      message:
        'Wanted to bump this — curious if solving pipeline coverage is still on your radar.',
    };
  }

  // Default opener / first LinkedIn message
  const nameMatch = userPrompt.match(/Name:\s*([^\n]+)/i);
  const name = isNonEmptyString(nameMatch?.[1]?.trim())
    ? nameMatch[1].trim()
    : 'there';

  return {
    message: `Hi ${name.split(' ')[0]} — great to connect. Would love a short intro on how we help talent teams move faster. Open to a quick chat?`,
  };
};
