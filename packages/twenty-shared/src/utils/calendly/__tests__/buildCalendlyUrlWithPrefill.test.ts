import {
    applyCalendlyInlineEmbedParams,
    buildCalendlyUrlWithPrefill,
    formatCalendlyInviteeName,
} from '../buildCalendlyUrlWithPrefill';

describe('formatCalendlyInviteeName', () => {
  it('joins first and last name', () => {
    expect(
      formatCalendlyInviteeName({ firstName: 'Jane', lastName: 'Doe' }),
    ).toBe('Jane Doe');
  });

  it('returns undefined when both empty', () => {
    expect(formatCalendlyInviteeName({ firstName: '', lastName: '' })).toBe(
      undefined,
    );
  });
});

describe('buildCalendlyUrlWithPrefill', () => {
  it('appends name, email, custom answers, and utm params', () => {
    const out = buildCalendlyUrlWithPrefill(
      'https://calendly.com/arxena/30min',
      {
        name: 'Jane Doe',
        email: 'jane@example.com',
        customAnswers: { a1: 'Arxena app — test' },
        utm: {
          source: 'arxena_app',
          medium: 'onboarding',
          campaign: 'deal_diligence',
        },
      },
    );

    const url = new URL(out);

    expect(url.searchParams.get('name')).toBe('Jane Doe');
    expect(url.searchParams.get('email')).toBe('jane@example.com');
    expect(url.searchParams.get('a1')).toBe('Arxena app — test');
    expect(url.searchParams.get('utm_source')).toBe('arxena_app');
    expect(url.searchParams.get('utm_medium')).toBe('onboarding');
    expect(url.searchParams.get('utm_campaign')).toBe('deal_diligence');
  });

  it('appends inline embed params when hideEventTypeDetails is set', () => {
    const out = buildCalendlyUrlWithPrefill(
      'https://calendly.com/arxena/30min',
      { hideEventTypeDetails: true },
    );
    const url = new URL(out);

    expect(url.searchParams.get('hide_event_type_details')).toBe('1');
    expect(url.searchParams.get('hide_gdpr_banner')).toBe('1');
  });

  it('preserves existing query params on the base URL', () => {
    const out = buildCalendlyUrlWithPrefill(
      'https://calendly.com/arxena/demo?hide_gdpr_banner=1',
      { email: 'a@b.com' },
    );

    expect(out).toContain('hide_gdpr_banner=1');
    expect(new URL(out).searchParams.get('email')).toBe('a@b.com');
  });

  it('returns the original string when the URL is invalid', () => {
    expect(buildCalendlyUrlWithPrefill('not-a-url', { email: 'x@y.com' })).toBe(
      'not-a-url',
    );
  });
});

describe('applyCalendlyInlineEmbedParams', () => {
  it('adds calendar-only embed query params', () => {
    const out = applyCalendlyInlineEmbedParams(
      'https://calendly.com/arxena/30min?name=Jane',
    );
    const url = new URL(out);

    expect(url.searchParams.get('name')).toBe('Jane');
    expect(url.searchParams.get('hide_event_type_details')).toBe('1');
    expect(url.searchParams.get('hide_gdpr_banner')).toBe('1');
  });
});
