"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const isValidLinkedInProfileUrl_1 = require("./isValidLinkedInProfileUrl");
describe('isValidLinkedInProfileUrl', () => {
    it('rejects placeholders and empty values', () => {
        expect((0, isValidLinkedInProfileUrl_1.isValidLinkedInProfileUrl)(undefined)).toBe(false);
        expect((0, isValidLinkedInProfileUrl_1.isValidLinkedInProfileUrl)('')).toBe(false);
        expect((0, isValidLinkedInProfileUrl_1.isValidLinkedInProfileUrl)('   ')).toBe(false);
        expect((0, isValidLinkedInProfileUrl_1.isValidLinkedInProfileUrl)('0')).toBe(false);
        expect((0, isValidLinkedInProfileUrl_1.isValidLinkedInProfileUrl)('https://')).toBe(false);
        expect((0, isValidLinkedInProfileUrl_1.isValidLinkedInProfileUrl)('http://')).toBe(false);
    });
    it('accepts /in/ profile URLs', () => {
        expect((0, isValidLinkedInProfileUrl_1.isValidLinkedInProfileUrl)('https://www.linkedin.com/in/rk-kushwaha-b7a15442')).toBe(true);
        expect((0, isValidLinkedInProfileUrl_1.isValidLinkedInProfileUrl)('linkedin.com/in/someone')).toBe(true);
    });
    it('rejects company pages', () => {
        expect((0, isValidLinkedInProfileUrl_1.isValidLinkedInProfileUrl)('https://www.linkedin.com/company/batliboi-ltd/')).toBe(false);
    });
    it('rejects linkedin home path', () => {
        expect((0, isValidLinkedInProfileUrl_1.isValidLinkedInProfileUrl)('https://www.linkedin.com/')).toBe(false);
    });
});
//# sourceMappingURL=isValidLinkedInProfileUrl.test.js.map