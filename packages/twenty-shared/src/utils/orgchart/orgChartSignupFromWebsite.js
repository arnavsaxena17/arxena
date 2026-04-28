"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appendOrgChartSignupSearchParams = exports.formatOrgChartSliceLabel = exports.ORG_CHART_SIGNUP_SEARCH_PARAMS = void 0;
/** Query params appended when linking from the marketing org chart to app sign-up (/welcome). */
exports.ORG_CHART_SIGNUP_SEARCH_PARAMS = {
    company: 'orgChartCompany',
    function: 'orgChartFunction',
    country: 'orgChartCountry',
};
const formatOrgChartSliceLabel = (s) => s
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
exports.formatOrgChartSliceLabel = formatOrgChartSliceLabel;
const appendOrgChartSignupSearchParams = (baseUrl, params) => {
    var _a, _b;
    const baseForRelative = typeof window !== 'undefined' && ((_a = window.location) === null || _a === void 0 ? void 0 : _a.origin)
        ? window.location.origin
        : 'https://app.arxena.com';
    let url;
    try {
        url = baseUrl.startsWith('http')
            ? new URL(baseUrl)
            : new URL(baseUrl, baseForRelative);
    }
    catch (_c) {
        return baseUrl;
    }
    const companyTrimmed = (_b = params.companyName) === null || _b === void 0 ? void 0 : _b.trim();
    if (companyTrimmed) {
        url.searchParams.set(exports.ORG_CHART_SIGNUP_SEARCH_PARAMS.company, companyTrimmed);
    }
    if (params.selectedFunctionRoot &&
        params.selectedFunctionRoot !== 'fullcompany') {
        url.searchParams.set(exports.ORG_CHART_SIGNUP_SEARCH_PARAMS.function, params.selectedFunctionRoot);
    }
    if (params.selectedCountry && params.selectedCountry !== 'global') {
        url.searchParams.set(exports.ORG_CHART_SIGNUP_SEARCH_PARAMS.country, params.selectedCountry);
    }
    return url.toString();
};
exports.appendOrgChartSignupSearchParams = appendOrgChartSignupSearchParams;
//# sourceMappingURL=orgChartSignupFromWebsite.js.map