"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const isDefined_1 = require("../isDefined");
describe('isDefined', () => {
    it('returns true if value is not undefined nor null', () => {
        expect((0, isDefined_1.isDefined)('')).toBe(true);
    });
    it('returns false if value is null', () => {
        expect((0, isDefined_1.isDefined)(null)).toBe(false);
    });
    it('returns false if value is undefined', () => {
        expect((0, isDefined_1.isDefined)(undefined)).toBe(false);
    });
});
//# sourceMappingURL=isDefined.test.js.map