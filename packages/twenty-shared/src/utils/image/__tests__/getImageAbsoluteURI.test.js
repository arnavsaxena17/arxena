"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const getImageAbsoluteURI_1 = require("../getImageAbsoluteURI");
describe('getImageAbsoluteURI', () => {
    it('should return baseUrl if imageUrl is empty string', () => {
        const imageUrl = '';
        const baseUrl = 'http://localhost:3000';
        const result = (0, getImageAbsoluteURI_1.getImageAbsoluteURI)({ imageUrl, baseUrl });
        expect(result).toBe('http://localhost:3000/files/');
    });
    it('should return absolute url if the imageUrl is an absolute url', () => {
        const imageUrl = 'https://XXX';
        const baseUrl = 'http://localhost:3000';
        const result = (0, getImageAbsoluteURI_1.getImageAbsoluteURI)({ imageUrl, baseUrl });
        expect(result).toBe(imageUrl);
    });
    it('should return fully formed url if imageUrl is a relative url starting with /', () => {
        const imageUrl = '/path/pic.png';
        const baseUrl = 'http://localhost:3000';
        const result = (0, getImageAbsoluteURI_1.getImageAbsoluteURI)({ imageUrl, baseUrl });
        expect(result).toBe('http://localhost:3000/files/path/pic.png');
    });
    it('should return fully formed url if imageUrl is a relative url nost starting with slash', () => {
        const imageUrl = 'pic.png';
        const baseUrl = 'http://localhost:3000';
        const result = (0, getImageAbsoluteURI_1.getImageAbsoluteURI)({ imageUrl, baseUrl });
        expect(result).toBe('http://localhost:3000/files/pic.png');
    });
    it('should handle queryParameters in the imageUrl', () => {
        const imageUrl = '/pic.png?token=XXX';
        const baseUrl = 'http://localhost:3000';
        const result = (0, getImageAbsoluteURI_1.getImageAbsoluteURI)({ imageUrl, baseUrl });
        expect(result).toBe('http://localhost:3000/files/pic.png?token=XXX');
    });
});
//# sourceMappingURL=getImageAbsoluteURI.test.js.map