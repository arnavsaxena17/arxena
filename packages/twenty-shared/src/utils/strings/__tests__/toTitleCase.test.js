"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const toTitleCase_1 = require("../toTitleCase");
describe('toTitleCase', () => {
    it('converts job titles with prepositions correctly', () => {
        expect((0, toTitleCase_1.toTitleCase)('director of engineering')).toBe('Director of Engineering');
        expect((0, toTitleCase_1.toTitleCase)('head of sales')).toBe('Head of Sales');
        expect((0, toTitleCase_1.toTitleCase)('vice president of product')).toBe('Vice President of Product');
    });
    it('capitalizes first and last words even when small', () => {
        expect((0, toTitleCase_1.toTitleCase)('the lord of the rings')).toBe('The Lord of the Rings');
    });
    it('handles names', () => {
        expect((0, toTitleCase_1.toTitleCase)('john smith')).toBe('John Smith');
        expect((0, toTitleCase_1.toTitleCase)('mary jane watson')).toBe('Mary Jane Watson');
    });
    it('handles company names and locations', () => {
        expect((0, toTitleCase_1.toTitleCase)('acme corporation')).toBe('Acme Corporation');
        expect((0, toTitleCase_1.toTitleCase)('new york')).toBe('New York');
        expect((0, toTitleCase_1.toTitleCase)('san francisco bay area')).toBe('San Francisco Bay Area');
    });
    it('handles abbreviations correctly', () => {
        expect((0, toTitleCase_1.toTitleCase)('ceo')).toBe('CEO');
        expect((0, toTitleCase_1.toTitleCase)('director of ios development')).toBe('Director of iOS Development');
        expect((0, toTitleCase_1.toTitleCase)('head of hr')).toBe('Head of HR');
        expect((0, toTitleCase_1.toTitleCase)('ibm')).toBe('IBM');
        expect((0, toTitleCase_1.toTitleCase)('vp of engineering')).toBe('VP of Engineering');
    });
    it('ignores punctuation when matching abbreviations', () => {
        expect((0, toTitleCase_1.toTitleCase)('vp, sales and marketing')).toBe('VP, Sales and Marketing');
        expect((0, toTitleCase_1.toTitleCase)('evp. product')).toBe('EVP. Product');
    });
    it('handles country and function root names', () => {
        expect((0, toTitleCase_1.toTitleCase)('argentina')).toBe('Argentina');
        expect((0, toTitleCase_1.toTitleCase)('new zealand')).toBe('New Zealand');
        expect((0, toTitleCase_1.toTitleCase)('hong kong')).toBe('Hong Kong');
        expect((0, toTitleCase_1.toTitleCase)('fullcompany')).toBe('Full Company');
        expect((0, toTitleCase_1.toTitleCase)('human resources')).toBe('Human Resources');
        expect((0, toTitleCase_1.toTitleCase)('supply chain')).toBe('Supply Chain');
    });
    it('handles empty and null inputs', () => {
        expect((0, toTitleCase_1.toTitleCase)('')).toBe('');
        expect((0, toTitleCase_1.toTitleCase)(null)).toBe('');
        expect((0, toTitleCase_1.toTitleCase)(undefined)).toBe('');
    });
    it('splits underscores and title cases', () => {
        expect((0, toTitleCase_1.toTitleCase)('Information_technology_and_services')).toBe('Information Technology and Services');
        expect((0, toTitleCase_1.toTitleCase)('Consumer_electronics')).toBe('Consumer Electronics');
    });
    it('trims whitespace', () => {
        expect((0, toTitleCase_1.toTitleCase)('  director of engineering  ')).toBe('Director of Engineering');
    });
    it('is idempotent for already-cased strings', () => {
        expect((0, toTitleCase_1.toTitleCase)('Director of Engineering')).toBe('Director of Engineering');
    });
    it('skips title case for masked/anonymized when skipIfMasked', () => {
        expect((0, toTitleCase_1.toTitleCase)('xxx', { skipIfMasked: true })).toBe('xxx');
        expect((0, toTitleCase_1.toTitleCase)('xxxx xxx', { skipIfMasked: true })).toBe('xxxx xxx');
        expect((0, toTitleCase_1.toTitleCase)('out of network profile', { skipIfMasked: true })).toBe('out of network profile');
        expect((0, toTitleCase_1.toTitleCase)('xx yy', { skipIfMasked: true })).toBe('xx yy');
    });
    it('still applies title case to masked when skipIfMasked is false', () => {
        expect((0, toTitleCase_1.toTitleCase)('xxx')).toBe('Xxx');
    });
});
describe('isMaskedOrAnonymized', () => {
    it('returns true for masked/anonymized strings', () => {
        expect((0, toTitleCase_1.isMaskedOrAnonymized)('xxx')).toBe(true);
        expect((0, toTitleCase_1.isMaskedOrAnonymized)('xxxx xxx')).toBe(true);
        expect((0, toTitleCase_1.isMaskedOrAnonymized)('out of network profile')).toBe(true);
        expect((0, toTitleCase_1.isMaskedOrAnonymized)('xx yy')).toBe(true);
    });
    it('returns false for real names', () => {
        expect((0, toTitleCase_1.isMaskedOrAnonymized)('john smith')).toBe(false);
        expect((0, toTitleCase_1.isMaskedOrAnonymized)('Director of Engineering')).toBe(false);
    });
});
//# sourceMappingURL=toTitleCase.test.js.map