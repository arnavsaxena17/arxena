"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidLinkedInProfileUrl = void 0;
/**
 * True when the value is a usable LinkedIn *person* profile URL.
 * Rejects placeholders (e.g. "https://"), bare schemes, company pages, and the LinkedIn home path.
 */
const isValidLinkedInProfileUrl = (url) => {
    if (url == null || typeof url !== 'string')
        return false;
    const t = url.trim();
    if (!t || t === '0')
        return false;
    const normalized = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    try {
        const u = new URL(normalized);
        const host = u.hostname.toLowerCase().replace(/^www\./, '');
        if (!host.endsWith('linkedin.com')) {
            return false;
        }
        const path = u.pathname;
        if (/\/company\//i.test(path)) {
            return false;
        }
        if (/\/in\/[^/]+/i.test(path))
            return true;
        if (/\/pub\//i.test(path))
            return true;
        if (/\/sales\/lead\//i.test(path))
            return true;
        return false;
    }
    catch (_a) {
        return false;
    }
};
exports.isValidLinkedInProfileUrl = isValidLinkedInProfileUrl;
//# sourceMappingURL=isValidLinkedInProfileUrl.js.map