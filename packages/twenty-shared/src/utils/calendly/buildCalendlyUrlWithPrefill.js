"use strict";
/**
 * Calendly scheduling URLs support query-string prefill (name, email, custom questions a1/a2/…, UTM).
 * @see https://help.calendly.com/hc/en-us/articles/22676676756931-Pre-fill-invitee-information-on-the-scheduling-page
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCalendlyUrlWithPrefill = exports.formatCalendlyInviteeName = void 0;
const UTM_QUERY_KEYS = {
    source: 'utm_source',
    medium: 'utm_medium',
    campaign: 'utm_campaign',
    content: 'utm_content',
    term: 'utm_term',
};
const formatCalendlyInviteeName = (parts) => {
    var _a, _b;
    const raw = `${(_a = parts.firstName) !== null && _a !== void 0 ? _a : ''} ${(_b = parts.lastName) !== null && _b !== void 0 ? _b : ''}`.trim();
    return raw.length > 0 ? raw : undefined;
};
exports.formatCalendlyInviteeName = formatCalendlyInviteeName;
const buildCalendlyUrlWithPrefill = (schedulingPageUrl, options = {}) => {
    var _a, _b;
    let url;
    try {
        url = new URL(schedulingPageUrl);
    }
    catch (_c) {
        return schedulingPageUrl;
    }
    const trimmedName = (_a = options.name) === null || _a === void 0 ? void 0 : _a.trim();
    const trimmedEmail = (_b = options.email) === null || _b === void 0 ? void 0 : _b.trim();
    if (trimmedName) {
        url.searchParams.set('name', trimmedName);
    }
    if (trimmedEmail) {
        url.searchParams.set('email', trimmedEmail);
    }
    if (options.customAnswers) {
        for (const [key, value] of Object.entries(options.customAnswers)) {
            const trimmed = value === null || value === void 0 ? void 0 : value.trim();
            if (trimmed) {
                url.searchParams.set(key, trimmed);
            }
        }
    }
    if (options.utm) {
        Object.keys(options.utm).forEach((utmKey) => {
            var _a, _b;
            const value = (_b = (_a = options.utm) === null || _a === void 0 ? void 0 : _a[utmKey]) === null || _b === void 0 ? void 0 : _b.trim();
            if (value) {
                url.searchParams.set(UTM_QUERY_KEYS[utmKey], value);
            }
        });
    }
    return url.toString();
};
exports.buildCalendlyUrlWithPrefill = buildCalendlyUrlWithPrefill;
//# sourceMappingURL=buildCalendlyUrlWithPrefill.js.map