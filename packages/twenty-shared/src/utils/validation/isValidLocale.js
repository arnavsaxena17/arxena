"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidLocale = void 0;
const AppLocales_1 = require("src/i18n/constants/AppLocales");
const isValidLocale = (value) => value !== null && value in AppLocales_1.APP_LOCALES;
exports.isValidLocale = isValidLocale;
//# sourceMappingURL=isValidLocale.js.map