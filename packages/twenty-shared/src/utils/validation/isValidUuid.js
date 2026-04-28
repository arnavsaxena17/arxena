"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidUuid = void 0;
const isValidUuid = (value) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
};
exports.isValidUuid = isValidUuid;
//# sourceMappingURL=isValidUuid.js.map