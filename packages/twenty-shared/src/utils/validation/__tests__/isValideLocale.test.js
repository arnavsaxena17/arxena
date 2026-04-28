"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AppLocales_1 = require("src/i18n/constants/AppLocales");
const isValidLocale_1 = require("../isValidLocale");
describe('isValidLocale', () => {
    it('should return true for valid locales', () => {
        Object.keys(AppLocales_1.APP_LOCALES).forEach((locale) => {
            expect((0, isValidLocale_1.isValidLocale)(locale)).toBe(true);
        });
    });
    it('should return false for invalid locales', () => {
        expect((0, isValidLocale_1.isValidLocale)('invalidLocale')).toBe(false);
        expect((0, isValidLocale_1.isValidLocale)(null)).toBe(false);
    });
});
//# sourceMappingURL=isValideLocale.test.js.map