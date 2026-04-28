"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDefined = void 0;
const guards_1 = require("@sniptt/guards");
const isDefined = (value) => !(0, guards_1.isUndefined)(value) && !(0, guards_1.isNull)(value);
exports.isDefined = isDefined;
//# sourceMappingURL=isDefined.js.map