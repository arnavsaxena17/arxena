"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWorkspaceActiveOrSuspended = void 0;
const WorkspaceActivationStatus_1 = require("../types/WorkspaceActivationStatus");
const isWorkspaceActiveOrSuspended = (workspace) => {
    return ((workspace === null || workspace === void 0 ? void 0 : workspace.activationStatus) === WorkspaceActivationStatus_1.WorkspaceActivationStatus.ACTIVE ||
        (workspace === null || workspace === void 0 ? void 0 : workspace.activationStatus) === WorkspaceActivationStatus_1.WorkspaceActivationStatus.SUSPENDED);
};
exports.isWorkspaceActiveOrSuspended = isWorkspaceActiveOrSuspended;
//# sourceMappingURL=isWorkspaceActiveOrSuspended.js.map