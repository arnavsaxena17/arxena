/**
 * Calendly scheduling URLs support query-string prefill (name, email, custom questions a1/a2/…, UTM).
 * @see https://help.calendly.com/hc/en-us/articles/22676676756931-Pre-fill-invitee-information-on-the-scheduling-page
 */

export type CalendlyUtmParams = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
};

export type BuildCalendlyUrlWithPrefillOptions = {
  name?: string;
  email?: string;
  /** Custom invitee questions: first question is `a1`, second `a2`, etc. */
  customAnswers?: Record<string, string>;
  utm?: CalendlyUtmParams;
};

const UTM_QUERY_KEYS: Record<keyof CalendlyUtmParams, string> = {
  source: 'utm_source',
  medium: 'utm_medium',
  campaign: 'utm_campaign',
  content: 'utm_content',
  term: 'utm_term',
};

export const formatCalendlyInviteeName = (parts: {
  firstName?: string | null;
  lastName?: string | null;
}): string | undefined => {
  const raw = `${parts.firstName ?? ''} ${parts.lastName ?? ''}`.trim();

  return raw.length > 0 ? raw : undefined;
};

export const buildCalendlyUrlWithPrefill = (
  schedulingPageUrl: string,
  options: BuildCalendlyUrlWithPrefillOptions = {},
): string => {
  let url: URL;

  try {
    url = new URL(schedulingPageUrl);
  } catch {
    return schedulingPageUrl;
  }

  const trimmedName = options.name?.trim();
  const trimmedEmail = options.email?.trim();

  if (trimmedName) {
    url.searchParams.set('name', trimmedName);
  }
  if (trimmedEmail) {
    url.searchParams.set('email', trimmedEmail);
  }

  if (options.customAnswers) {
    for (const [key, value] of Object.entries(options.customAnswers)) {
      const trimmed = value?.trim();

      if (trimmed) {
        url.searchParams.set(key, trimmed);
      }
    }
  }

  if (options.utm) {
    (Object.keys(options.utm) as (keyof CalendlyUtmParams)[]).forEach(
      (utmKey) => {
        const value = options.utm?.[utmKey]?.trim();

        if (value) {
          url.searchParams.set(UTM_QUERY_KEYS[utmKey], value);
        }
      },
    );
  }

  return url.toString();
};
