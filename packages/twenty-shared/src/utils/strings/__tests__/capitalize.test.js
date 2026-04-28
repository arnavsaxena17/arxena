"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const capitalize_1 = require("../capitalize");
describe('capitalize', () => {
    it('should capitalize a string', () => {
        expect((0, capitalize_1.capitalize)('test')).toBe('Test');
    });
    it('should return an empty string if input is an empty string', () => {
        expect((0, capitalize_1.capitalize)('')).toBe('');
    });
});
//# sourceMappingURL=capitalize.test.js.map