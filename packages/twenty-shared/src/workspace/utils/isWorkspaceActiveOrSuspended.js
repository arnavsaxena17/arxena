"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWorkspaceActiveOrSuspended = void 0;
const isWorkspaceActiveOrSuspended = (workspace) => {
    return ((workspace === null || workspace === void 0 ? void 0 : workspace.activationStatus) === "ACTIVE" ||
        (workspace === null || workspace === void 0 ? void 0 : workspace.activationStatus) === "SUSPENDED");
};
exports.isWorkspaceActiveOrSuspended = isWorkspaceActiveOrSuspended;
//# sourceMappingURL=isWorkspaceActiveOrSuspended.js.map