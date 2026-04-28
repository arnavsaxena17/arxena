"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProxiedImageUrl = void 0;
/**
 * Returns a same-origin proxy URL for external image URLs so the browser
 * can load them without Cross-Origin-Resource-Policy blocking (e.g. LinkedIn).
 * Same-origin or non-http(s) URLs are returned unchanged.
 */
const ALLOWED_IMAGE_HOSTS = new Set([
    'media.licdn.com',
    'media-exp1.licdn.com',
    'static.licdn.com',
    'st2.depositphotos.com',
]);
const ALLOWED_IMAGE_HOST_SUFFIXES = ['.theorg.com'];
const toBase64Url = (value) => {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(value, 'utf8').toString('base64url');
    }
    const utf8 = encodeURIComponent(value).replace(/%([0-9A-F]{2})/giu, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return btoa(utf8)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
};
const buildDeterministicProxyPath = (imageUrl) => {
    const parsed = new URL(imageUrl);
    const normalizedHost = parsed.hostname.toLowerCase();
    if (ALLOWED_IMAGE_HOST_SUFFIXES.some((suffix) => normalizedHost.endsWith(suffix))) {
        const match = parsed.pathname.match(/^\/([a-z0-9-]+?)(?:_([a-z0-9-]+))?\.([a-z0-9]+)$/iu);
        if (match) {
            const [, imageId, variant, ext] = match;
            return `/org-chart/image-proxy/images-1/${imageId}/${variant || 'original'}/${ext.toLowerCase()}`;
        }
    }
    if (ALLOWED_IMAGE_HOSTS.has(normalizedHost)) {
        const encodedHost = toBase64Url(normalizedHost);
        const encodedPath = toBase64Url(`${parsed.pathname}${parsed.search}`);
        return `/org-chart/image-proxy/images-2/${encodedHost}/${encodedPath}`;
    }
    return null;
};
function getProxiedImageUrl(imageUrl, apiBaseUrl) {
    if (!imageUrl || typeof imageUrl !== 'string')
        return imageUrl !== null && imageUrl !== void 0 ? imageUrl : '';
    const trimmed = imageUrl.trim();
    if (!trimmed) {
        return imageUrl;
    }
    const normalizedBase = apiBaseUrl.replace(/\/$/, '');
    if (trimmed.startsWith('/org-chart/image-proxy/')) {
        return normalizedBase ? `${normalizedBase}${trimmed}` : trimmed;
    }
    if (!trimmed.startsWith('http:') && !trimmed.startsWith('https:')) {
        return imageUrl;
    }
    try {
        const imageOrigin = new URL(trimmed).origin;
        const apiOrigin = new URL(normalizedBase).origin;
        if (imageOrigin === apiOrigin)
            return imageUrl;
        const proxyPath = buildDeterministicProxyPath(trimmed);
        if (!proxyPath) {
            return imageUrl;
        }
        return normalizedBase ? `${normalizedBase}${proxyPath}` : proxyPath;
    }
    catch (_a) {
        return imageUrl;
    }
}
exports.getProxiedImageUrl = getProxiedImageUrl;
//# sourceMappingURL=getProxiedImageUrl.js.map