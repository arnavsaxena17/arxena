"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getImageAbsoluteURI = void 0;
const getImageAbsoluteURI = ({ imageUrl, baseUrl, }) => {
    if (imageUrl.startsWith('https:') || imageUrl.startsWith('http:')) {
        return imageUrl;
    }
    if (imageUrl.startsWith('/')) {
        return new URL(`/files${imageUrl}`, baseUrl).toString();
    }
    return new URL(`/files/${imageUrl}`, baseUrl).toString();
};
exports.getImageAbsoluteURI = getImageAbsoluteURI;
//# sourceMappingURL=getImageAbsoluteURI.js.map