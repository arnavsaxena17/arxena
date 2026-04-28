"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const buildCalendlyUrlWithPrefill_1 = require("../buildCalendlyUrlWithPrefill");
describe('formatCalendlyInviteeName', () => {
    it('joins first and last name', () => {
        expect((0, buildCalendlyUrlWithPrefill_1.formatCalendlyInviteeName)({ firstName: 'Jane', lastName: 'Doe' })).toBe('Jane Doe');
    });
    it('returns undefined when both empty', () => {
        expect((0, buildCalendlyUrlWithPrefill_1.formatCalendlyInviteeName)({ firstName: '', lastName: '' })).toBe(undefined);
    });
});
describe('buildCalendlyUrlWithPrefill', () => {
    it('appends name, email, custom answers, and utm params', () => {
        const out = (0, buildCalendlyUrlWithPrefill_1.buildCalendlyUrlWithPrefill)('https://calendly.com/arxena/demo', {
            name: 'Jane Doe',
            email: 'jane@example.com',
            customAnswers: { a1: 'Arxena app — test' },
            utm: {
                source: 'arxena_app',
                medium: 'onboarding',
                campaign: 'deal_diligence',
            },
        });
        const url = new URL(out);
        expect(url.searchParams.get('name')).toBe('Jane Doe');
        expect(url.searchParams.get('email')).toBe('jane@example.com');
        expect(url.searchParams.get('a1')).toBe('Arxena app — test');
        expect(url.searchParams.get('utm_source')).toBe('arxena_app');
        expect(url.searchParams.get('utm_medium')).toBe('onboarding');
        expect(url.searchParams.get('utm_campaign')).toBe('deal_diligence');
    });
    it('preserves existing query params on the base URL', () => {
        const out = (0, buildCalendlyUrlWithPrefill_1.buildCalendlyUrlWithPrefill)('https://calendly.com/arxena/demo?hide_gdpr_banner=1', { email: 'a@b.com' });
        expect(out).toContain('hide_gdpr_banner=1');
        expect(new URL(out).searchParams.get('email')).toBe('a@b.com');
    });
    it('returns the original string when the URL is invalid', () => {
        expect((0, buildCalendlyUrlWithPrefill_1.buildCalendlyUrlWithPrefill)('not-a-url', { email: 'x@y.com' })).toBe('not-a-url');
    });
});
//# sourceMappingURL=buildCalendlyUrlWithPrefill.test.js.map