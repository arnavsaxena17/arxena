"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const orgChartSignupFromWebsite_1 = require("./orgChartSignupFromWebsite");
describe('orgChartSignupFromWebsite', () => {
    it('appendOrgChartSignupSearchParams adds company and function', () => {
        const out = (0, orgChartSignupFromWebsite_1.appendOrgChartSignupSearchParams)('https://app.example.com/welcome', {
            companyName: 'Acme Inc',
            selectedFunctionRoot: 'engineering',
        });
        const url = new URL(out);
        expect(url.searchParams.get(orgChartSignupFromWebsite_1.ORG_CHART_SIGNUP_SEARCH_PARAMS.company)).toBe('Acme Inc');
        expect(url.searchParams.get(orgChartSignupFromWebsite_1.ORG_CHART_SIGNUP_SEARCH_PARAMS.function)).toBe('engineering');
    });
    it('skips fullcompany function and omits country when global', () => {
        const out = (0, orgChartSignupFromWebsite_1.appendOrgChartSignupSearchParams)('https://app.example.com/welcome', {
            companyName: 'Acme',
            selectedFunctionRoot: 'fullcompany',
            selectedCountry: 'global',
        });
        const url = new URL(out);
        expect(url.searchParams.has(orgChartSignupFromWebsite_1.ORG_CHART_SIGNUP_SEARCH_PARAMS.function)).toBe(false);
        expect(url.searchParams.has(orgChartSignupFromWebsite_1.ORG_CHART_SIGNUP_SEARCH_PARAMS.country)).toBe(false);
    });
    it('formatOrgChartSliceLabel formats slug segments', () => {
        expect((0, orgChartSignupFromWebsite_1.formatOrgChartSliceLabel)('engineering_lead')).toBe('Engineering Lead');
    });
});
//# sourceMappingURL=orgChartSignupFromWebsite.test.js.map