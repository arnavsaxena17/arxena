"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const getProxiedImageUrl_1 = require("./getProxiedImageUrl");
describe('getProxiedImageUrl', () => {
    it('prefixes backend base for already proxied relative URLs', () => {
        expect((0, getProxiedImageUrl_1.getProxiedImageUrl)('/org-chart/image-proxy/images-1/abc/medium/jpg', 'http://localhost:3000')).toBe('http://localhost:3000/org-chart/image-proxy/images-1/abc/medium/jpg');
    });
    it('wraps external absolute image URLs with the backend proxy', () => {
        expect((0, getProxiedImageUrl_1.getProxiedImageUrl)('https://cdn.theorg.com/abc_medium.jpg', 'http://localhost:3000')).toBe('http://localhost:3000/org-chart/image-proxy/images-1/abc/medium/jpg');
    });
    it('encodes approved external URLs without passing the raw URL directly', () => {
        expect((0, getProxiedImageUrl_1.getProxiedImageUrl)('https://media.licdn.com/dms/image/v2/test-profile-photo?e=123&v=beta&t=abc', 'http://localhost:3000')).toBe('http://localhost:3000/org-chart/image-proxy/images-2/bWVkaWEubGljZG4uY29t/L2Rtcy9pbWFnZS92Mi90ZXN0LXByb2ZpbGUtcGhvdG8_ZT0xMjMmdj1iZXRhJnQ9YWJj');
    });
});
//# sourceMappingURL=getProxiedImageUrl.test.js.map