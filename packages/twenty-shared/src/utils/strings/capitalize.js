"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capitalize = void 0;
const guards_1 = require("@sniptt/guards");
const capitalize = (stringToCapitalize) => {
    if (!(0, guards_1.isNonEmptyString)(stringToCapitalize))
        return '';
    return stringToCapitalize[0].toUpperCase() + stringToCapitalize.slice(1);
};
exports.capitalize = capitalize;
//# sourceMappingURL=capitalize.js.map