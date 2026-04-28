"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const isValidUuid_1 = require("../isValidUuid");
describe('isValidUuid', () => {
    it('should return true for a valid UUID', () => {
        expect((0, isValidUuid_1.isValidUuid)('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
        expect((0, isValidUuid_1.isValidUuid)('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });
    it('should return false for an invalid UUID', () => {
        expect((0, isValidUuid_1.isValidUuid)('invalid-uuid')).toBe(false);
        expect((0, isValidUuid_1.isValidUuid)('12345')).toBe(false);
        expect((0, isValidUuid_1.isValidUuid)('550e8400e29b41d4a716446655440000')).toBe(false);
        expect((0, isValidUuid_1.isValidUuid)('')).toBe(false);
        expect((0, isValidUuid_1.isValidUuid)('123e4567-e89b-12d3-a456-42661417400-')).toBe(false);
        expect((0, isValidUuid_1.isValidUuid)('123e4567-e89b-12d3-a456-42661417400')).toBe(false);
        expect((0, isValidUuid_1.isValidUuid)('123e4567-e89b-12d3-a456-42661417400)')).toBe(false);
        expect((0, isValidUuid_1.isValidUuid)('123e4567-e89b-12d3-a456-4266141740001')).toBe(false);
    });
});
//# sourceMappingURL=isValidUuid.test.js.map